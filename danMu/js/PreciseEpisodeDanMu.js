// ignore
//@name:精准集数弹幕
//@version:4
//@type:400
//@remark:严格符合 danMu type:400；修复初始化语法错误；精准识别播放集数；API失败跳过
//@env:精准弹幕API##可选，兼容 dandanPlay API。格式：线路名@https://api.example.com|线路2@https://api2.example.com&&最小弹幕数量##可选，默认 1&&显示匹配提示##调试用，1显示，0不显示，默认0
//@order:A00
//@isAV:0
//@deprecated:0
// ignore

const appConfig = {
    _uzTag: '',
    get uzTag() {
        return this._uzTag
    },
    set uzTag(value) {
        this._uzTag = value
    },
}

class DanMu {
    constructor() {
        this.content = ''
        this.time = 0
        this.color = ''
    }
}

class BackData {
    constructor() {
        this.data = []
        this.error = ''
    }
}

class DanVideoPlatform {
    constructor() {
        this.name = ''
        this.isLineSwitchSupported = false
    }
}

class DanEpisode {
    constructor() {
        this.vod_name = ''
        this.vod_remarks = ''
        this.extData = {}
    }
}

class DanVideo extends DanEpisode {
    constructor() {
        super()
        this.vod_pic = ''
    }
}

function normalizeText(value) {
    if (value === undefined || value === null) return ''
    return String(value).trim()
}

function safeDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value)
    } catch (e) {
        return value
    }
}

function toNumberSafe(value) {
    if (value === undefined || value === null || value === '') return null
    var n = Number(value)
    if (!Number.isFinite(n)) return null
    if (n <= 0 || n > 3000) return null
    return Math.floor(n)
}

function getField(obj, keys) {
    if (!obj) return ''
    for (var i = 0; i < keys.length; i++) {
        var value = obj[keys[i]]
        if (value !== undefined && value !== null && value !== '') {
            return value
        }
    }
    return ''
}

function safeGetEnv(key) {
    try {
        if (typeof getEnv === 'function') {
            return normalizeText(getEnv(appConfig.uzTag, key))
        }
    } catch (e) {}
    return ''
}

function getMinDanmuCount() {
    var n = toNumberSafe(safeGetEnv('最小弹幕数量'))
    return n || 1
}

function shouldShowMatchTip() {
    var v = safeGetEnv('显示匹配提示')
    return v === '1' || v === 'true' || v === '是'
}

function makeSafeMatchTip(info) {
    info = normalizeText(info)
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim()

    if (info.length > 60) {
        info = info.substring(0, 60) + '...'
    }

    return info
}

function chineseNumberToInt(str) {
    str = normalizeText(str)
    if (!str) return null
    if (/^\d+$/.test(str)) return Number(str)

    var map = {
        零: 0,
        〇: 0,
        一: 1,
        二: 2,
        两: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
    }

    if (str === '十') return 10

    if (str.indexOf('百') >= 0) {
        var arr100 = str.split('百')
        var hundreds = arr100[0] ? map[arr100[0]] || Number(arr100[0]) || 1 : 1
        var rest = arr100[1] ? chineseNumberToInt(arr100[1]) : 0
        return hundreds * 100 + rest
    }

    if (str.indexOf('十') >= 0) {
        var arr10 = str.split('十')
        var tens = arr10[0] ? map[arr10[0]] || Number(arr10[0]) || 1 : 1
        var ones = arr10[1] ? map[arr10[1]] || Number(arr10[1]) || 0 : 0
        return tens * 10 + ones
    }

    return map[str] || null
}

function parseEpisodeNumber(text) {
    text = normalizeText(text)
    if (!text) return null

    var patterns = [
        /第\s*(\d{1,4})\s*[集话話回]/,
        /第\s*([零〇一二两三四五六七八九十百]+)\s*[集话話回]/,
        /(?:EP|Ep|ep|Episode|episode)\s*\.?\s*(\d{1,4})/,
        /(?:^|[^A-Za-z])E\s*(\d{1,4})(?:\D|$)/i,
        /(?:^|[^\d])(\d{1,4})\s*[集话話回]/,
        /(?:^|\s)(\d{1,4})(?:\s|$)/,
    ]

    for (var i = 0; i < patterns.length; i++) {
        var m = text.match(patterns[i])
        if (!m) continue

        var n = /^\d+$/.test(m[1]) ? Number(m[1]) : chineseNumberToInt(m[1])
        if (n && n > 0 && n < 3000) return n
    }

    return null
}

function parseSeasonEpisode(text) {
    text = normalizeText(text)

    var result = {
        season: null,
        episode: null,
        episodeTitle: '',
        source: '',
        confidence: 0,
    }

    if (!text) return result

    var m = text.match(/S\s*(\d{1,2})\s*E\s*(\d{1,4})/i)
    if (m) {
        result.season = toNumberSafe(m[1])
        result.episode = toNumberSafe(m[2])
        result.episodeTitle = '第' + result.episode + '集'
        result.source = 'SxxExx'
        result.confidence = 95
        return result
    }

    m = text.match(/第\s*(\d{1,2})\s*[季部].*?第\s*(\d{1,4})\s*[集话話回]/)
    if (m) {
        result.season = toNumberSafe(m[1])
        result.episode = toNumberSafe(m[2])
        result.episodeTitle = '第' + result.episode + '集'
        result.source = 'season_episode_number'
        result.confidence = 95
        return result
    }

    m = text.match(/第\s*([零〇一二两三四五六七八九十百]+)\s*[季部].*?第\s*([零〇一二两三四五六七八九十百]+)\s*[集话話回]/)
    if (m) {
        result.season = chineseNumberToInt(m[1])
        result.episode = chineseNumberToInt(m[2])
        result.episodeTitle = '第' + result.episode + '集'
        result.source = 'season_episode_cn'
        result.confidence = 95
        return result
    }

    var ep = parseEpisodeNumber(text)
    if (ep) {
        result.episode = ep
        result.episodeTitle = '第' + ep + '集'
        result.source = 'episode_only'
        result.confidence = 70
    }

    return result
}

function parseEpisodeFromUrl(url) {
    url = safeDecodeURIComponent(normalizeText(url))
    if (!url) return null

    var patterns = [
        /?:episode|ep|e|index|nid|vidIndex|play|page=(\d{1,4})(?:\D|$)/i,
        /\/(?:episode|episodes|ep|e)\/(\d{1,4})(?:[/?#]|$)/i,
        /(?:episode|episodes|ep|e)[-_]?(\d{1,4})(?:\D|$)/i,
        /\/(\d{1,4})\.html(?:[?#].*)?$/i,
        /第\s*(\d{1,4})\s*[集话話回]/,
    ]

    for (var i = 0; i < patterns.length; i++) {
        var m = url.match(patterns[i])
        if (!m) continue

        var n = toNumberSafe(m[1])
        if (n) return n
    }

    return null
}

function cleanEnglishRomanTitle(title) {
    title = normalizeText(title)
    if (!title) return ''

    return title
        .replace(/\bS\s*\d{1,2}\s*E\s*\d{1,4}\b/gi, '')
        .replace(/\bSeason\s*\d{1,2}\b/gi, '')
        .replace(/\b(?:EP|Ep|Episode)\s*\.?\s*\d{1,4}\b/gi, '')
        .replace(/\b(?:OVA|OAD|SP|Special|Trailer|Preview|PV)\s*\d*\b/gi, '')
        .replace(/\b(?:1080p|720p|2160p|4K|HEVC|H265|H264|x264|x265|WEB[- ]?DL|WEBRip|BDRip|BluRay|Baha|CR|AMZN|NF)\b/gi, '')
        .replace(/$$[^$$]*\]/g, '')
        .replace(/【[^】]*】/g, '')
        .replace(/$$[^)]*$$/g, '')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function cleanClickedTitle(title) {
    title = normalizeText(title)

    var cnClean = title
        .replace(/S\s*\d{1,2}\s*E\s*\d{1,4}/gi, '')
        .replace(/第\s*[零〇一二两三四五六七八九十百\d]+\s*[季部]/g, '')
        .replace(/第\s*[零〇一二两三四五六七八九十百\d]+\s*[集话話回]/g, '')
        .replace(/(?:EP|Episode)\s*\.?\s*\d{1,4}/gi, '')
        .replace(/更新至\s*\d{1,4}\s*[集话話回]/g, '')
        .replace(/[$$【(（].*?[$$】)）]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

    return cleanEnglishRomanTitle(cnClean)
}

function buildTitleCandidates(epInfo) {
    var list = []

    function push(v) {
        v = normalizeText(v)
        if (v && list.indexOf(v) < 0) list.push(v)
    }

    push(epInfo.clickedTitle)
    push(epInfo.cleanTitle)
    push(cleanEnglishRomanTitle(epInfo.clickedTitle))
    push(cleanClickedTitle(epInfo.clickedTitle))

    return list
}

function pickEpisodeInfo(item) {
    var p = item || {}

    var clickedTitle = normalizeText(getField(p, ['name', 'title', 'videoName', 'vodName']))

    var titleText = [
        p.name,
        p.title,
        p.videoName,
        p.vodName,
        p.originalTitle,
        p.subTitle,
        p.remark,
    ]
        .filter(Boolean)
        .join(' ')

    var info = {
        clickedTitle: clickedTitle,
        cleanTitle: cleanClickedTitle(clickedTitle),
        season: null,
        episode: null,
        episodeTitle: '',
        videoUrl: normalizeText(p.videoUrl || p.playUrl || p.url || ''),
        episodeId: '',
        source: '',
        confidence: 0,
    }

    if (p.danEpisode) {
        var epObj = p.danEpisode

        if (typeof epObj === 'string') {
            var parsedEp = parseSeasonEpisode(epObj)
            info.episode = parsedEp.episode
            info.season = parsedEp.season
            info.episodeTitle = epObj
            info.source = 'danEpisode_string'
            info.confidence = parsedEp.episode ? 100 : 0
            return info
        }

        var ext = epObj.extData || epObj.raw || {}

        info.episodeId = normalizeText(ext.episodeId || epObj.episodeId || epObj.id || '')

        var epTitle = normalizeText(
            getField(epObj, ['vod_name', 'name', 'title', 'episodeName', 'label']) ||
                getField(ext, ['episodeTitle', 'title', 'name'])
        )

        var epNum =
            toNumberSafe(ext.episode) ||
            toNumberSafe(ext.episodeNumber) ||
            toNumberSafe(epObj.episode) ||
            toNumberSafe(epObj.ep) ||
            toNumberSafe(epObj.number) ||
            parseEpisodeNumber(epTitle)

        info.episode = epNum
        info.season = toNumberSafe(ext.season) || toNumberSafe(epObj.season) || null
        info.episodeTitle = epTitle || (epNum ? '第' + epNum + '集' : '')
        info.videoUrl = normalizeText(epObj.url || epObj.videoUrl || ext.url || info.videoUrl)
        info.source = 'danEpisode_object'
        info.confidence = epNum || info.episodeId ? 100 : 0

        return info
    }

    if (p.episode !== undefined && p.episode !== null && p.episode !== '') {
        var epNum2 = toNumberSafe(p.episode) || parseEpisodeNumber(p.episode)

        if (epNum2) {
            info.episode = epNum2
            info.episodeTitle = '第' + epNum2 + '集'
            info.source = 'searchParameters.episode'
            info.confidence = 95
            return info
        }
    }

    var epFromUrl = parseEpisodeFromUrl(info.videoUrl)
    if (epFromUrl) {
        info.episode = epFromUrl
        info.episodeTitle = '第' + epFromUrl + '集'
        info.source = 'videoUrl'
        info.confidence = 80
        return info
    }

    var parsed = parseSeasonEpisode(titleText)
    if (parsed.episode) {
        info.season = parsed.season
        info.episode = parsed.episode
        info.episodeTitle = parsed.episodeTitle
        info.source = 'title:' + parsed.source
        info.confidence = parsed.confidence
        return info
    }

    return info
}

function normalizeApiBase(base) {
    return normalizeText(base).replace(/\/+$/, '')
}

function buildApiUrl(api, path) {
    var base = normalizeApiBase(api.base)
    if (!base) return ''

    if (base.endsWith('/api/v2')) {
        return base + path.replace(/^\/api\/v2/, '')
    }

    return base + path
}

function parseCustomApis() {
    var result = []
    var env = safeGetEnv('精准弹幕API')

    if (!env) return result

    var parts = env
        .split(/[|;]/)
        .map(function (x) {
            return x.trim()
        })
        .filter(Boolean)

    for (var i = 0; i < parts.length; i++) {
        var arr = parts[i].split('@')

        if (arr.length >= 2) {
            var name = normalizeText(arr.shift())
            var base = normalizeApiBase(arr.join('@'))

            if (name && base) {
                result.push({
                    name: name,
                    base: base,
                    builtin: false,
                })
            }
        }
    }

    return result
}

function getApiConfigs(preferredName) {
    var apis = [
        {
            name: 'dandanPlay',
            base: 'https://api.dandanplay.net',
            builtin: true,
        },
    ].concat(parseCustomApis())

    preferredName = normalizeText(preferredName)

    if (!preferredName || preferredName === '平台优先') {
        return apis
    }

    var selected = []
    var others = []

    for (var i = 0; i < apis.length; i++) {
        if (apis[i].name === preferredName) {
            selected.push(apis[i])
        } else {
            others.push(apis[i])
        }
    }

    return selected.concat(others)
}

function parseDandanPlayComments(comments) {
    var list = []

    if (!comments || comments.length === 0) return list

    for (var i = 0; i < comments.length; i++) {
        var element = comments[i]
        var params = normalizeText(element.p).split(',')

        var danMu = new DanMu()
        danMu.content = element.m || element.text || element.content || ''
        danMu.time = Number(params[0] || element.time || 0)
        danMu.color = params[2] || element.color || ''

        if (danMu.content) {
            list.push(danMu)
        }
    }

    return list
}

function createMatchInfoDanMu(info) {
    var danMu = new DanMu()
    danMu.time = 0.1
    danMu.color = '16776960'
    danMu.content = '匹配：' + makeSafeMatchTip(info)
    return danMu
}

function formatEpisodeTitle(item, index) {
    var rawTitle = normalizeText(item.episodeTitle || item.title || item.name)

    var epNum =
        toNumberSafe(item.episode) ||
        toNumberSafe(item.episodeNumber) ||
        parseEpisodeNumber(rawTitle)

    var epPrefix = epNum ? '第' + epNum + '集' : '剧集' + (index + 1)

    var cleanTitle = rawTitle
        .replace(/^第\s*[零〇一二两三四五六七八九十百\d]+\s*[集话話回]\s*[-:：]?\s*/g, '')
        .trim()

    var airDate = normalizeText(item.airDate || item.airdate || item.date)

    var title = cleanTitle && cleanTitle !== epPrefix ? epPrefix + ' - ' + cleanTitle : epPrefix

    if (airDate) {
        title += ' (' + airDate + ')'
    }

    return title
}

async function searchEpisodesByApi(api, animeName, episode) {
    var url = buildApiUrl(api, '/api/v2/search/episodes')
    if (!url) return null

    return await req(url, {
        queryParameters: {
            anime: animeName,
            episode: episode ? String(episode) : '',
        },
    })
}

async function getCommentsByApi(api, episodeId) {
    var locale = typeof kLocale !== 'undefined' ? normalizeText(kLocale) : ''
    var isSimplified = locale.indexOf('CN') !== -1

    var url = buildApiUrl(
        api,
        '/api/v2/comment/' +
            episodeId +
            '?withRelated=true&chConvert=' +
            (isSimplified ? '1' : '2')
    )

    if (!url) return null

    return await req(url)
}

async function getLines() {
    var apiNames = getApiConfigs('').map(function (x) {
        return x.name
    })

    return formatBackData({
        lines: apiNames,
        error: '',
    })
}

async function getVideoPlatformList() {
    var data = []

    var first = new DanVideoPlatform()
    first.name = '平台优先'
    first.isLineSwitchSupported = true
    data.push(first)

    var apis = getApiConfigs('')

    for (var i = 0; i < apis.length; i++) {
        var platform = new DanVideoPlatform()
        platform.name = apis[i].name
        platform.isLineSwitchSupported = false
        data.push(platform)
    }

    return formatBackData({
        data: data,
        error: '',
    })
}

async function getVideoList(args) {
    var backData = {
        data: [],
        error: '',
    }

    var errors = []

    try {
        args = args || {}

        var keyword = normalizeText(args.name || args.title || args.keyword || '')

        if (!keyword) {
            backData.error = '缺少搜索标题'
            return formatBackData(backData)
        }

        var apis = getApiConfigs(args.videoPlatformName)

        var titleCandidates = [keyword, cleanClickedTitle(keyword), cleanEnglishRomanTitle(keyword)]
            .filter(Boolean)
            .filter(function (v, i, a) {
                return a.indexOf(v) === i
            })

        for (var i = 0; i < apis.length; i++) {
            var api = apis[i]

            try {
                var found = []

                for (var t = 0; t < titleCandidates.length && found.length === 0; t++) {
                    var searchResult = await searchEpisodesByApi(api, titleCandidates[t], '')
                    found = searchResult && searchResult.data && searchResult.data.animes
                        ? searchResult.data.animes
                        : []
                }

                if (found.length === 0) continue

                for (var j = 0; j < found.length; j++) {
                    var anime = found[j]

                    var video = new DanVideo()
                    video.vod_name = anime.animeTitle || anime.title || anime.name || keyword
                    video.vod_remarks = api.name + (anime.type ? ' · ' + anime.type : '')
                    video.extData = anime
                    video.extData.apiName = api.name
                    video.extData.apiBase = api.base

                    backData.data.push(video)
                }

                if (normalizeText(args.videoPlatformName) === '平台优先' || !normalizeText(args.videoPlatformName)) {
                    break
                }
            } catch (error) {
                errors.push(api.name + ': ' + error.toString())
                continue
            }
        }
    } catch (error2) {
        backData.error = error2.toString()
    }

    if (backData.data.length === 0 && errors.length > 0) {
        backData.error = 'API均不可用或无结果：' + errors.join('；')
    }

    return formatBackData(backData)
}

async function getVideoEpisodes(args) {
    var backData = {
        data: [],
        error: '',
    }

    try {
        args = args || {}

        var danVideo = args.danVideo || {}
        var ext = danVideo.extData || danVideo.raw || danVideo
        var episodes = ext.episodes || []

        for (var i = 0; i < episodes.length; i++) {
            var item = episodes[i]

            var episode = new DanEpisode()
            var friendlyTitle = formatEpisodeTitle(item, i)

            var epNum =
                toNumberSafe(item.episode) ||
                toNumberSafe(item.episodeNumber) ||
                parseEpisodeNumber(friendlyTitle)

            episode.vod_name = friendlyTitle

            var remarks = []
            if (ext.apiName) remarks.push(ext.apiName)
            if (item.type) remarks.push(item.type)
            if (item.duration) remarks.push(String(item.duration))

            episode.vod_remarks = remarks.join(' · ')

            episode.extData = item
            episode.extData.apiName = ext.apiName || ''
            episode.extData.apiBase = ext.apiBase || ''
            episode.extData.episode = epNum
            episode.extData.episodeId = item.episodeId || item.id || ''
            episode.extData.episodeTitle = friendlyTitle

            backData.data.push(episode)
        }
    } catch (error) {
        backData.error = error.toString()
    }

    return formatBackData(backData)
}

async function searchDanMu(item) {
    var backData = new BackData()
    var lastInfo = ''

    try {
        item = item || {}

        var epInfo = pickEpisodeInfo(item)
        var titleCandidates = buildTitleCandidates(epInfo)

        if (titleCandidates.length === 0) {
            backData.error = '缺少标题，无法搜索弹幕'
            return formatBackData(backData)
        }

        if (!epInfo.episode && !epInfo.episodeId) {
            backData.error = '未识别到播放集数，请手动选择剧集'

            if (shouldShowMatchTip()) {
                backData.data.push(createMatchInfoDanMu('未识别集数：' + (epInfo.clickedTitle || '')))
            }

            return formatBackData(backData)
        }

        var result = await searchByApis(titleCandidates, epInfo, item)
        backData.data = result.list
        lastInfo = result.info
    } catch (error) {
        backData.error = error.toString()
    }

    if (lastInfo && shouldShowMatchTip()) {
        backData.data.unshift(createMatchInfoDanMu(lastInfo))
    }

    var realCount = backData.data.length

    if (lastInfo && shouldShowMatchTip()) {
        realCount = Math.max(0, backData.data.length - 1)
    }

    if (realCount === 0 && !backData.error) {
        backData.error = '未找到弹幕'
    }

    return formatBackData(backData)
}

async function searchByApis(titleCandidates, epInfo, item) {
    var minCount = getMinDanmuCount()
    var apis = getApiConfigs(item.videoPlatformName || item.line)

    var errors = []
    var lastTried = ''

    var manualApiName = ''
    if (item.danEpisode && item.danEpisode.extData) {
        manualApiName = normalizeText(item.danEpisode.extData.apiName)
    }

    if (manualApiName) {
        apis.sort(function (a, b) {
            if (a.name === manualApiName) return -1
            if (b.name === manualApiName) return 1
            return 0
        })
    }

    for (var i = 0; i < apis.length; i++) {
        var api = apis[i]

        try {
            var episodeId = epInfo.episodeId
            var matchedTitle = titleCandidates[0]

            if (!episodeId) {
                var animes = []

                for (var t = 0; t < titleCandidates.length && animes.length === 0; t++) {
                    matchedTitle = titleCandidates[t]

                    var searchResult = await searchEpisodesByApi(api, matchedTitle, epInfo.episode)

                    animes =
                        searchResult &&
                        searchResult.data &&
                        searchResult.data.animes
                            ? searchResult.data.animes
                            : []
                }

                if (animes.length === 0 || !animes[0].episodes || animes[0].episodes.length === 0) {
                    lastTried = api.name + '/' + matchedTitle + '/第' + (epInfo.episode || '') + '集：无搜索结果'
                    continue
                }

                episodeId = animes[0].episodes[0].episodeId
            }

            if (!episodeId) {
                lastTried = api.name + '/' + matchedTitle + '：无 episodeId'
                continue
            }

            var danMuResult = await getCommentsByApi(api, episodeId)

            var comments =
                danMuResult &&
                danMuResult.data &&
                danMuResult.data.comments
                    ? danMuResult.data.comments
                    : []

            var list = parseDandanPlayComments(comments)

            if (list.length < minCount) {
                lastTried =
                    api.name +
                    '/' +
                    matchedTitle +
                    '/episodeId=' +
                    episodeId +
                    '：弹幕数 ' +
                    list.length +
                    ' 小于阈值 ' +
                    minCount

                continue
            }

            return {
                list: list,
                info:
                    '成功；平台=' +
                    api.name +
                    '；标题=' +
                    matchedTitle +
                    '；集数=' +
                    (epInfo.episode || '') +
                    '；来源=' +
                    epInfo.source +
                    '；episodeId=' +
                    episodeId +
                    '；弹幕=' +
                    list.length,
            }
        } catch (error) {
            errors.push(api.name + ': ' + error.toString())
            continue
        }
    }

    var info =
        errors.length > 0
            ? '失败跳过；' + errors.join('；') + '；最后=' + lastTried
            : '失败；' + lastTried

    return {
        list: [],
        info: info,
    }
}

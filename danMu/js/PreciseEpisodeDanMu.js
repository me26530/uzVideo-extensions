// ignore
//@name:精准集数弹幕
//@version:4
//@type:400
//@remark:精准识别播放集数；环境变量API优先覆盖内置；修复JSC正则安装错误；显示实际API地址；弹幕数量校验；匹配信息提示
//@env:精准弹幕API##可选，兼容 dandanPlay API。格式：线路名@https://api.example.com|线路2@https://api2.example.com&&最小弹幕数量##可选，默认 1
//@order:A00
//@isAV:0
//@deprecated:0
// ignore

/*
 * danMu type:400 严格接口说明：
 * - getLines() 返回 formatBackData({ lines: string[], error: string })
 * - getVideoPlatformList() 返回 formatBackData({ data: DanVideoPlatform[], error: string })
 * - getVideoList(args) 返回 formatBackData({ data: DanVideo[], error: string })
 * - getVideoEpisodes(args) 返回 formatBackData({ data: DanEpisode[], error: string })
 * - searchDanMu(item) 返回 formatBackData(BackData)，BackData.data 为 DanMu[]
 * - 不使用 import/export；仅调用 uz 运行时内置 req、formatBackData、getEnv、kLocale
 */

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
    const n = Number(value)
    if (!Number.isFinite(n)) return null
    if (n <= 0 || n > 3000) return null
    return Math.floor(n)
}

function getField(obj, keys) {
    if (!obj) return ''
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const value = obj[key]
        if (value !== undefined && value !== null && value !== '') return value
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
    const n = toNumberSafe(safeGetEnv('最小弹幕数量'))
    return n || 1
}

function chineseNumberToInt(str) {
    str = normalizeText(str)
    if (!str) return null
    if (/^\d+$/.test(str)) return Number(str)

    const map = {
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
        const arr = str.split('百')
        const hundreds = arr[0] ? map[arr[0]] || Number(arr[0]) || 1 : 1
        const rest = arr[1] ? chineseNumberToInt(arr[1]) : 0
        return hundreds * 100 + rest
    }

    if (str.indexOf('十') >= 0) {
        const arr = str.split('十')
        const tens = arr[0] ? map[arr[0]] || Number(arr[0]) || 1 : 1
        const ones = arr[1] ? map[arr[1]] || Number(arr[1]) || 0 : 0
        return tens * 10 + ones
    }

    if (map[str] !== undefined) return map[str]
    return null
}

function parseEpisodeNumber(text) {
    text = normalizeText(text)
    if (!text) return null

    const patterns = [
        /第\s*(\d{1,4})\s*[集话話回]/,
        /第\s*([零〇一二两三四五六七八九十百]+)\s*[集话話回]/,
        /(?:EP|Ep|ep|Episode|episode)\s*\.?\s*(\d{1,4})/,
        /(?:^|[^A-Za-z])E\s*(\d{1,4})(?:\D|$)/i,
        /(?:^|[^\d])(\d{1,4})\s*[集话話回]/,
        /(?:^|\s)(\d{1,4})(?:\s|$)/,
    ]

    for (let i = 0; i < patterns.length; i++) {
        const m = text.match(patterns[i])
        if (!m) continue
        const n = /^\d+$/.test(m[1]) ? Number(m[1]) : chineseNumberToInt(m[1])
        if (n && n > 0 && n < 3000) return n
    }

    return null
}

function parseSeasonEpisode(text) {
    text = normalizeText(text)

    const result = {
        season: null,
        episode: null,
        episodeTitle: '',
        source: '',
        confidence: 0,
    }

    if (!text) return result

    let m = text.match(/S\s*(\d{1,2})\s*E\s*(\d{1,4})/i)
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

    const ep = parseEpisodeNumber(text)
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

    const patterns = [
        /[?&#](?:episode|ep|e|index|nid|vidIndex|play|page=)(\d{1,4})(?:\D|$)/i,
        /\/(?:episode|episodes|ep|e)\/(\d{1,4})(?:[/?#]|$)/i,
        /(?:episode|episodes|ep|e)[-_]?(\d{1,4})(?:\D|$)/i,
        /\/(\d{1,4})\.html(?:[?#].*)?$/i,
        /第\s*(\d{1,4})\s*[集话話回]/,
    ]

    for (let i = 0; i < patterns.length; i++) {
        const m = url.match(patterns[i])
        if (!m) continue
        const n = toNumberSafe(m[1])
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
        .replace(/\bEP\s*\.?\s*\d{1,4}\b/gi, '')
        .replace(/\bEpisode\s*\.?\s*\d{1,4}\b/gi, '')
        .replace(/\bOVA\s*\d*\b/gi, '')
        .replace(/\bOAD\s*\d*\b/gi, '')
        .replace(/\bSP\s*\d*\b/gi, '')
        .replace(/\bSpecial\s*\d*\b/gi, '')
        .replace(/\bTrailer\s*\d*\b/gi, '')
        .replace(/\bPreview\s*\d*\b/gi, '')
        .replace(/\bPV\s*\d*\b/gi, '')
        .replace(/\b1080p\b/gi, '')
        .replace(/\b720p\b/gi, '')
        .replace(/\b2160p\b/gi, '')
        .replace(/\b4K\b/gi, '')
        .replace(/\bHEVC\b/gi, '')
        .replace(/\bH265\b/gi, '')
        .replace(/\bH264\b/gi, '')
        .replace(/\bx264\b/gi, '')
        .replace(/\bx265\b/gi, '')
        .replace(/\bWEB[- ]?DL\b/gi, '')
        .replace(/\bWEBRip\b/gi, '')
        .replace(/\bBDRip\b/gi, '')
        .replace(/\bBluRay\b/gi, '')
        .replace(/\bBaha\b/gi, '')
        .replace(/\bCR\b/gi, '')
        .replace(/\bAMZN\b/gi, '')
        .replace(/\bNF\b/gi, '')
        .replace(/$$[^$$]*\]/g, '')
        .replace(/【[^】]*】/g, '')
        .replace(/$$[^)]*$$/g, '')
        .replace(/（[^）]*）/g, '')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function cleanClickedTitle(title) {
    title = normalizeText(title)
    if (!title) return ''

    const cnClean = title
        .replace(/S\s*\d{1,2}\s*E\s*\d{1,4}/gi, '')
        .replace(/第\s*[零〇一二两三四五六七八九十百\d]+\s*[季部]/g, '')
        .replace(/第\s*[零〇一二两三四五六七八九十百\d]+\s*[集话話回]/g, '')
        .replace(/EP\s*\.?\s*\d{1,4}/gi, '')
        .replace(/Episode\s*\.?\s*\d{1,4}/gi, '')
        .replace(/更新至\s*\d{1,4}\s*[集话話回]/g, '')
        .replace(/$$[^$$]*\]/g, '')
        .replace(/【[^】]*】/g, '')
        .replace(/$$[^)]*$$/g, '')
        .replace(/（[^）]*）/g, '')
        .replace(/\s+/g, ' ')
        .trim()

    return cleanEnglishRomanTitle(cnClean)
}

function buildTitleCandidates(epInfo) {
    const list = []

    const push = function (v) {
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
    const p = item || {}

    const clickedTitle = normalizeText(getField(p, ['name', 'title', 'videoName', 'vodName']))

    const titleText = [
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

    const info = {
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
        const ep = p.danEpisode

        if (typeof ep === 'string') {
            const parsed = parseSeasonEpisode(ep)
            info.episode = parsed.episode
            info.season = parsed.season
            info.episodeTitle = ep
            info.source = 'danEpisode_string'
            info.confidence = parsed.episode ? 100 : 0
            return info
        }

        const ext = ep.extData || ep.raw || {}

        info.episodeId = normalizeText(ext.episodeId || ep.episodeId || ep.id || '')

        const epTitle = normalizeText(
            getField(ep, ['vod_name', 'name', 'title', 'episodeName', 'label']) ||
                getField(ext, ['episodeTitle', 'title', 'name'])
        )

        const epNum =
            toNumberSafe(ext.episode) ||
            toNumberSafe(ext.episodeNumber) ||
            toNumberSafe(ep.episode) ||
            toNumberSafe(ep.ep) ||
            toNumberSafe(ep.number) ||
            parseEpisodeNumber(epTitle)

        info.episode = epNum
        info.season = toNumberSafe(ext.season) || toNumberSafe(ep.season) || null
        info.episodeTitle = epTitle || (epNum ? '第' + epNum + '集' : '')
        info.videoUrl = normalizeText(ep.url || ep.videoUrl || ext.url || info.videoUrl)
        info.source = 'danEpisode_object'
        info.confidence = epNum || info.episodeId ? 100 : 0
        return info
    }

    if (p.episode !== undefined && p.episode !== null && p.episode !== '') {
        const epNum = toNumberSafe(p.episode) || parseEpisodeNumber(p.episode)
        if (epNum) {
            info.episode = epNum
            info.episodeTitle = '第' + epNum + '集'
            info.source = 'searchParameters.episode'
            info.confidence = 95
            return info
        }
    }

    const epFromUrl = parseEpisodeFromUrl(info.videoUrl)
    if (epFromUrl) {
        info.episode = epFromUrl
        info.episodeTitle = '第' + epFromUrl + '集'
        info.source = 'videoUrl'
        info.confidence = 80
        return info
    }

    const parsed = parseSeasonEpisode(titleText)
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
    base = normalizeText(base).replace(/\/+$/, '')
    return base
}

function buildApiUrl(api, path) {
    let base = normalizeApiBase(api.base)
    if (!base) return ''

    if (base.endsWith('/api/v2')) {
        return base + path.replace(/^\/api\/v2/, '')
    }

    return base + path
}

function parseCustomApis() {
    const result = []
    const env = safeGetEnv('精准弹幕API')
    if (!env) return result

    const parts = env
        .split(/[|;]/)
        .map(function (x) {
            return x.trim()
        })
        .filter(Boolean)

    for (let i = 0; i < parts.length; i++) {
        const arr = parts[i].split('@')
        if (arr.length >= 2) {
            const name = normalizeText(arr.shift())
            const base = normalizeApiBase(arr.join('@'))
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
    const customApis = parseCustomApis()

    const builtinApis = [
        {
            name: 'dandanPlay',
            base: 'https://api.dandanplay.net',
            builtin: true,
        },
    ]

    const customNames = customApis.map(function (x) {
        return x.name
    })

    const filteredBuiltinApis = builtinApis.filter(function (x) {
        return customNames.indexOf(x.name) < 0
    })

    const apis = customApis.concat(filteredBuiltinApis)

    preferredName = normalizeText(preferredName)

    if (!preferredName || preferredName === '平台优先') return apis

    const selected = []
    const others = []

    for (let i = 0; i < apis.length; i++) {
        if (apis[i].name === preferredName) selected.push(apis[i])
        else others.push(apis[i])
    }

    return selected.concat(others)
}

function parseDandanPlayComments(comments) {
    const list = []
    if (!comments || comments.length === 0) return list

    for (let index = 0; index < comments.length; index++) {
        const element = comments[index] || {}
        const params = normalizeText(element.p).split(',')

        const danMu = new DanMu()
        danMu.content = element.m || element.text || element.content || ''
        danMu.time = Number(params[0] || element.time || 0)
        danMu.color = params[2] || element.color || ''

        if (danMu.content) list.push(danMu)
    }

    return list
}

function createMatchInfoDanMu(info) {
    const danMu = new DanMu()
    danMu.time = 0.1
    danMu.color = '16776960'
    danMu.content = '匹配信息：' + info
    return danMu
}

function formatEpisodeTitle(item, index) {
    item = item || {}

    const rawTitle = normalizeText(item.episodeTitle || item.title || item.name)
    const epNum = toNumberSafe(item.episode) || toNumberSafe(item.episodeNumber) || parseEpisodeNumber(rawTitle)
    const epPrefix = epNum ? '第' + epNum + '集' : '剧集' + (index + 1)

    const cleanTitle = rawTitle
        .replace(/^第\s*[零〇一二两三四五六七八九十百\d]+\s*[集话話回]\s*[-:：]?\s*/g, '')
        .trim()

    const airDate = normalizeText(item.airDate || item.airdate || item.date)

    let title = cleanTitle && cleanTitle !== epPrefix ? epPrefix + ' - ' + cleanTitle : epPrefix
    if (airDate) title += ' (' + airDate + ')'

    return title
}

async function searchEpisodesByApi(api, animeName, episode) {
    const url = buildApiUrl(api, '/api/v2/search/episodes')
    if (!url) return null

    return await req(url, {
        queryParameters: {
            anime: animeName,
            episode: episode ? String(episode) : '',
        },
    })
}

async function getCommentsByApi(api, episodeId) {
    const locale = typeof kLocale === 'undefined' ? '' : normalizeText(kLocale)
    const isSimplified = locale.indexOf('CN') !== -1

    const url = buildApiUrl(
        api,
        '/api/v2/comment/' + episodeId + '?withRelated=true&chConvert=' + (isSimplified ? '1' : '2')
    )

    if (!url) return null

    return await req(url)
}

async function getLines() {
    const apiNames = getApiConfigs('').map(function (x) {
        return x.name
    })

    return formatBackData({
        lines: apiNames,
        error: '',
    })
}

async function getVideoPlatformList() {
    const data = []

    const first = new DanVideoPlatform()
    first.name = '平台优先'
    first.isLineSwitchSupported = true
    data.push(first)

    const apis = getApiConfigs('')

    for (let i = 0; i < apis.length; i++) {
        const platform = new DanVideoPlatform()
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
    const backData = {
        data: [],
        error: '',
    }

    const errors = []

    try {
        args = args || {}

        const keyword = normalizeText(args.name || args.title || args.keyword || '')

        if (!keyword) {
            backData.error = '缺少搜索标题'
            return formatBackData(backData)
        }

        const apis = getApiConfigs(args.videoPlatformName)

        const titleCandidates = [keyword, cleanClickedTitle(keyword), cleanEnglishRomanTitle(keyword)]
            .filter(Boolean)
            .filter(function (v, i, a) {
                return a.indexOf(v) === i
            })

        for (let i = 0; i < apis.length; i++) {
            const api = apis[i]

            try {
                let found = []

                for (let t = 0; t < titleCandidates.length && found.length === 0; t++) {
                    const searchResult = await searchEpisodesByApi(api, titleCandidates[t], '')
                    found = searchResult && searchResult.data && searchResult.data.animes ? searchResult.data.animes : []
                }

                if (found.length === 0) continue

                for (let j = 0; j < found.length; j++) {
                    const anime = found[j] || {}

                    const video = new DanVideo()
                    video.vod_name = anime.animeTitle || anime.title || anime.name || keyword
                    video.vod_remarks = api.name + '@' + api.base + (anime.type ? ' · ' + anime.type : '')
                    video.extData = copyObject(anime)
                    video.extData.apiName = api.name
                    video.extData.apiBase = api.base

                    backData.data.push(video)
                }

                if (normalizeText(args.videoPlatformName) === '平台优先' || !normalizeText(args.videoPlatformName)) break
            } catch (error) {
                errors.push(api.name + '@' + api.base + ': ' + error.toString())
                continue
            }
        }
    } catch (error) {
        backData.error = error.toString()
    }

    if (backData.data.length === 0 && errors.length > 0) {
        backData.error = 'API均不可用或无结果：' + errors.join('；')
    }

    return formatBackData(backData)
}

async function getVideoEpisodes(args) {
    const backData = {
        data: [],
        error: '',
    }

    try {
        args = args || {}

        const danVideo = args.danVideo || {}
        const ext = danVideo.extData || danVideo.raw || danVideo
        const episodes = ext.episodes || []

        for (let i = 0; i < episodes.length; i++) {
            const item = episodes[i] || {}
            const episode = new DanEpisode()

            const friendlyTitle = formatEpisodeTitle(item, i)

            const epNum =
                toNumberSafe(item.episode) ||
                toNumberSafe(item.episodeNumber) ||
                parseEpisodeNumber(friendlyTitle)

            episode.vod_name = friendlyTitle

            episode.vod_remarks = [ext.apiName || '', item.type || '', item.duration ? String(item.duration) : '']
                .filter(Boolean)
                .join(' · ')

            episode.extData = copyObject(item)
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
    const backData = new BackData()
    let lastInfo = ''

    try {
        const epInfo = pickEpisodeInfo(item)
        const titleCandidates = buildTitleCandidates(epInfo)

        if (titleCandidates.length === 0) {
            backData.error = '缺少标题，无法搜索弹幕'
            return formatBackData(backData)
        }

        if (!epInfo.episode && !epInfo.episodeId) {
            backData.error = '未识别到播放集数，请手动选择剧集'
            backData.data.push(createMatchInfoDanMu('失败；原因=未识别集数；标题=' + (epInfo.clickedTitle || '')))
            return formatBackData(backData)
        }

        const result = await searchByApis(titleCandidates, epInfo, item)
        backData.data = result.list
        lastInfo = result.info
    } catch (error) {
        backData.error = error.toString()
    }

    if (lastInfo) {
        backData.data.unshift(createMatchInfoDanMu(lastInfo))
    }

    const realCount = Math.max(0, backData.data.length - (lastInfo ? 1 : 0))

    if (realCount === 0 && !backData.error) {
        backData.error = '未找到弹幕'
    }

    return formatBackData(backData)
}

async function searchByApis(titleCandidates, epInfo, item) {
    const minCount = getMinDanmuCount()
    item = item || {}

    const apis = getApiConfigs(item.videoPlatformName || item.line)

    const errors = []
    let lastTried = ''

    const danEpisode = item.danEpisode || {}
    const danEpisodeExt = danEpisode.extData || {}
    const manualApiName = normalizeText(danEpisodeExt.apiName)

    if (manualApiName) {
        apis.sort(function (a, b) {
            if (a.name === manualApiName) return -1
            if (b.name === manualApiName) return 1
            return 0
        })
    }

    for (let i = 0; i < apis.length; i++) {
        const api = apis[i]

        try {
            let episodeId = epInfo.episodeId
            let matchedTitle = titleCandidates[0]

            if (!episodeId) {
                let animes = []

                for (let t = 0; t < titleCandidates.length && animes.length === 0; t++) {
                    matchedTitle = titleCandidates[t]

                    const searchResult = await searchEpisodesByApi(api, matchedTitle, epInfo.episode)

                    animes =
                        searchResult && searchResult.data && searchResult.data.animes
                            ? searchResult.data.animes
                            : []
                }

                if (animes.length === 0 || !animes[0].episodes || animes[0].episodes.length === 0) {
                    lastTried =
                        api.name +
                        '@' +
                        api.base +
                        '/' +
                        matchedTitle +
                        '/第' +
                        (epInfo.episode || '') +
                        '集：无搜索结果'
                    continue
                }

                episodeId = animes[0].episodes[0].episodeId || animes[0].episodes[0].id || ''
            }

            if (!episodeId) {
                lastTried = api.name + '@' + api.base + '/' + matchedTitle + '：无 episodeId'
                continue
            }

            const danMuResult = await getCommentsByApi(api, episodeId)
            const comments =
                danMuResult && danMuResult.data && danMuResult.data.comments
                    ? danMuResult.data.comments
                    : []

            const list = parseDandanPlayComments(comments)

            if (list.length < minCount) {
                lastTried =
                    api.name +
                    '@' +
                    api.base +
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
                    '；API=' +
                    api.base +
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
            errors.push(api.name + '@' + api.base + ': ' + error.toString())
            continue
        }
    }

    const info =
        errors.length > 0
            ? '失败跳过；' + errors.join('；') + '；最后=' + lastTried
            : '失败；' + lastTried

    return {
        list: [],
        info: info,
    }
}

function copyObject(obj) {
    const result = {}
    if (!obj) return result

    for (const key in obj) {
        try {
            result[key] = obj[key]
        } catch (e) {}
    }

    return result
}

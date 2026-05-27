// ignore
//@name:自动弹幕
// 版本号纯数字
//@version:29
// 备注，没有的话就不填
//@remark:接入 danmu_api，支持多API线路、自动匹配和手动精准选集，不走 FongMi，无弹幕数量限制
// 加密 id，没有的话就不填
//@codeID:
// 使用的环境变量，没有的话就不填
//@env:自动弹幕API##多API列表，格式 aws@https://xxx/密钥|韩@https://xxx/密钥
// 是否是AV 1是  0否
//@isAV:0
//是否弃用 1是  0否
//@deprecated:0
// ignore

// ignore
// 不支持导入，这里只是本地开发用于代码提示
import {
    UZUtils,
    ProData,
    ReqResponseType,
    ReqAddressType,
    req,
    getEnv,
    setEnv,
    goToVerify,
    openWebToBindEnv,
    toast,
    kIsDesktop,
    kIsAndroid,
    kIsIOS,
    kIsWindows,
    kIsMacOS,
    kIsTV,
    kLocale,
    kAppVersion,
    formatBackData,
} from '../core/uzUtils.js'
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

class SearchParameters {
    constructor() {
        this.name = ''
        this.episode = ''
        this.videoUrl = ''
        this.line = ''
        this.videoPlatformName = ''
        this.danVideo = null
        this.danEpisode = null
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

/**
 * ==========================
 * 通用工具
 * ==========================
 */

function dmTrim(v) {
    return String(v || '').replace(/^\s+|\s+$/g, '')
}

function dmIsArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]'
}

function dmPad2(n) {
    n = parseInt(n || 1, 10)
    if (isNaN(n) || n <= 0) n = 1
    return n < 10 ? '0' + n : String(n)
}

function dmPick(obj, keys, def) {
    if (!obj) return def

    for (let i = 0; i < keys.length; i++) {
        const k = keys[i]

        if (obj[k] !== undefined && obj[k] !== null && dmTrim(obj[k]) !== '') {
            return obj[k]
        }
    }

    return def
}

function dmShowToast(message) {
    try {
        if (message) toast(message)
    } catch (e) {}
}

/**
 * ==========================
 * 环境变量
 * ==========================
 */

async function dmGetEnv(key, def) {
    try {
        let v = await getEnv(appConfig.uzTag, key)

        if (v !== undefined && v !== null) {
            if (typeof v === 'object') {
                if (v.data !== undefined) {
                    v = v.data
                } else if (v.value !== undefined) {
                    v = v.value
                } else if (v.content !== undefined) {
                    v = v.content
                } else {
                    v = ''
                }
            }

            v = dmTrim(v)

            if (v !== '') return v
        }
    } catch (e) {}

    return def
}

function dmNormalizeApiBase(base) {
    base = dmTrim(base)
    base = base.replace(/^['"]+|['"]+$/g, '')

    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
        base = base.substring(0, base.length - 1)
    }

    base = base.replace(/\/api\/v2\/match$/i, '')
    base = base.replace(/\/api\/v2\/comment.*$/i, '')
    base = base.replace(/\/api\/logs$/i, '')

    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
        base = base.substring(0, base.length - 1)
    }

    return base
}

/**
 * 解析多 API
 *
 * 推荐环境变量：
 * 自动弹幕API
 *
 * 格式：
 * aws@https://xxx/密钥|韩@https://xxx/密钥
 */
async function dmGetApiList() {
    // 新变量名
    let raw = await dmGetEnv('自动弹幕API', '')

    // 兼容旧变量名
    if (!raw) {
        raw = await dmGetEnv('自动匹配API', '')
    }

    // 兼容英文变量名
    if (!raw) {
        raw = await dmGetEnv('DANMU_API_LIST', '')
    }

    // 兼容单 API 旧变量
    if (!raw) {
        raw = await dmGetEnv('DANMU_API_BASE', '')
    }

    raw = dmTrim(raw)

    const list = []

    if (!raw) return list

    const parts = raw.split('|')

    for (let i = 0; i < parts.length; i++) {
        const item = dmTrim(parts[i])
        if (!item) continue

        let name = ''
        let url = ''

        const atIndex = item.indexOf('@')

        if (atIndex > 0) {
            name = dmTrim(item.substring(0, atIndex))
            url = dmTrim(item.substring(atIndex + 1))
        } else {
            name = '线路' + (list.length + 1)
            url = item
        }

        url = dmNormalizeApiBase(url)

        if (name && url && url.indexOf('http') === 0) {
            list.push({
                name: name,
                url: url
            })
        }
    }

    return list
}

/**
 * 根据 line 或 videoPlatformName 选择 API
 */
async function dmSelectApi(lineOrPlatform) {
    const list = await dmGetApiList()

    if (!list || list.length === 0) {
        return null
    }

    const target = dmTrim(lineOrPlatform)

    if (target) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].name === target) {
                return list[i]
            }
        }
    }

    return list[0]
}

/**
 * ==========================
 * 剧名 / 集数识别
 * ==========================
 */

function dmGetName(item) {
    let name = dmPick(item, [
        'name',
        'title',
        'vod_name',
        'videoName',
        'movieName',
        'showName'
    ], '')

    name = dmTrim(name)
    name = name.replace(/\s*第\s*\d+\s*[集话話]\s*$/g, '')
    name = name.replace(/\s*S\d+\s*E\d+\s*$/ig, '')
    name = dmTrim(name)

    return name
}

function dmGetBaseNameFromUrl(text) {
    text = dmTrim(text)

    if (!text) return ''

    try {
        text = decodeURIComponent(text)
    } catch (e) {}

    text = text.split('?')[0]
    text = text.split('#')[0]

    const arr = text.split(/[\\/]/)
    return arr[arr.length - 1] || text
}

function dmIsLikelyEpisodeNumber(n) {
    n = parseInt(n, 10)

    if (isNaN(n) || n <= 0) return false
    if (n > 2000) return false

    const badNums = [
        480, 720, 1080, 1440, 2160, 3840, 4096,
        1632, 1920, 1280, 2560
    ]

    if (badNums.indexOf(n) >= 0) return false
    if (n >= 1900 && n <= 2099) return false

    return true
}

function dmExtractEpisodeFromText(text, seriesName) {
    text = dmTrim(text)

    if (!text) return 0

    try {
        text = decodeURIComponent(text)
    } catch (e) {}

    const baseName = dmGetBaseNameFromUrl(text)

    const candidates = [
        baseName,
        text
    ]

    for (let c = 0; c < candidates.length; c++) {
        let s = candidates[c]

        if (!s) continue

        s = s.replace(/\.(mp4|mkv|avi|mov|flv|ts|m3u8|webm)$/i, '')

        const patterns = [
            /S\d+\s*E\s*0*(\d+)/i,
            /EP\s*0*(\d+)/i,
            /E\s*0*(\d+)/i,
            /第\s*0*(\d+)\s*[集话話]/,
            /[_\-\.\s]0*(\d{1,4})(?:$|[_\-\.\s])/,
        ]

        for (let i = 0; i < patterns.length; i++) {
            const m = s.match(patterns[i])

            if (m && m[1]) {
                const n = parseInt(m[1], 10)

                if (dmIsLikelyEpisodeNumber(n)) return n
            }
        }

        if (seriesName) {
            const safeName = dmTrim(seriesName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(safeName + '\\s*0*(\\d{1,4})', 'i')
            const m2 = s.match(re)

            if (m2 && m2[1]) {
                const n2 = parseInt(m2[1], 10)

                if (dmIsLikelyEpisodeNumber(n2)) return n2
            }
        }

        const allNums = s.match(/\d{1,4}/g)

        if (allNums && allNums.length > 0) {
            for (let j = allNums.length - 1; j >= 0; j--) {
                const n3 = parseInt(allNums[j], 10)

                if (dmIsLikelyEpisodeNumber(n3)) return n3
            }
        }
    }

    return 0
}

function dmGetEpisodeInfo(item) {
    const seriesName = dmGetName(item)

    const videoUrl = dmPick(item, ['videoUrl'], '')
    const epFromVideoUrl = dmExtractEpisodeFromText(videoUrl, seriesName)

    if (epFromVideoUrl > 0) {
        return {
            episode: epFromVideoUrl,
            source: 'videoUrl',
            raw: videoUrl
        }
    }

    try {
        if (item && item.danEpisode) {
            const epText =
                item.danEpisode.vod_name ||
                item.danEpisode.vod_remarks ||
                ''

            const epFromDanEpisode = dmExtractEpisodeFromText(epText, seriesName)

            if (epFromDanEpisode > 0) {
                return {
                    episode: epFromDanEpisode,
                    source: 'danEpisode',
                    raw: epText
                }
            }
        }
    } catch (e) {}

    try {
        if (item && item.danVideo) {
            const videoText =
                item.danVideo.vod_name ||
                item.danVideo.vod_remarks ||
                ''

            const epFromDanVideo = dmExtractEpisodeFromText(videoText, seriesName)

            if (epFromDanVideo > 0) {
                return {
                    episode: epFromDanVideo,
                    source: 'danVideo',
                    raw: videoText
                }
            }
        }
    } catch (e2) {}

    const title = dmTrim(dmPick(item, [
        'subTitle',
        'episodeName',
        'playName',
        'urlName',
        'vod_play_name'
    ], ''))

    const epFromTitle = dmExtractEpisodeFromText(title, seriesName)

    if (epFromTitle > 0) {
        return {
            episode: epFromTitle,
            source: 'title',
            raw: title
        }
    }

    let ep = dmPick(item, [
        'episode',
        'episodeIndex',
        'index',
        'serial',
        'playIndex',
        'number'
    ], '')

    if (ep !== undefined && ep !== null && dmTrim(ep) !== '') {
        const m = String(ep).match(/\d+/)

        if (m) {
            const n = parseInt(m[0], 10)

            if (!isNaN(n) && n > 0) {
                return {
                    episode: n,
                    source: 'uzEpisode',
                    raw: ep
                }
            }
        }
    }

    return {
        episode: 1,
        source: 'default',
        raw: ''
    }
}

function dmGetSeason(item) {
    const season = dmPick(item, [
        'season',
        'seasonIndex',
        'seasonNumber'
    ], '')

    if (season !== undefined && season !== null && dmTrim(season) !== '') {
        const m = String(season).match(/\d+/)

        if (m) {
            const n = parseInt(m[0], 10)

            if (!isNaN(n) && n > 0) return String(n)
        }
    }

    return '1'
}

/**
 * ==========================
 * 网络
 * ==========================
 */

function dmParseJson(text) {
    if (!text) return null
    if (typeof text === 'object') return text

    try {
        return JSON.parse(text)
    } catch (e) {
        return null
    }
}

function dmNormalizeResponse(res) {
    if (res === undefined || res === null) return ''

    if (typeof res === 'string') return res

    if (res.data !== undefined) {
        if (typeof res.data === 'string') return res.data
        return JSON.stringify(res.data)
    }

    if (res.body !== undefined) {
        if (typeof res.body === 'string') return res.body
        return JSON.stringify(res.body)
    }

    if (res.content !== undefined) {
        if (typeof res.content === 'string') return res.content
        return JSON.stringify(res.content)
    }

    return JSON.stringify(res)
}

async function dmHttpGet(url) {
    const res = await req(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json,text/plain,*/*'
        }
    })

    return dmNormalizeResponse(res)
}

async function dmHttpPostJson(url, body) {
    const res = await req(url, {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json,text/plain,*/*',
            'Content-Type': 'application/json',
            'content-type': 'application/json'
        },
        data: body || {}
    })

    return dmNormalizeResponse(res)
}

/**
 * ==========================
 * danmu_api 返回处理
 * ==========================
 */

function dmPickAnimeList(json) {
    if (!json) return []

    if (dmIsArray(json)) return json
    if (dmIsArray(json.animes)) return json.animes
    if (dmIsArray(json.data)) return json.data
    if (json.data && dmIsArray(json.data.animes)) return json.data.animes
    if (json.result && dmIsArray(json.result)) return json.result
    if (json.result && dmIsArray(json.result.animes)) return json.result.animes
    if (json.bangumi && dmIsArray(json.bangumi)) return json.bangumi

    return []
}

function dmPickEpisodeList(json) {
    if (!json) return []

    if (dmIsArray(json.episodes)) return json.episodes
    if (dmIsArray(json.data)) return json.data
    if (json.data && dmIsArray(json.data.episodes)) return json.data.episodes
    if (json.result && dmIsArray(json.result.episodes)) return json.result.episodes
    if (json.anime && dmIsArray(json.anime.episodes)) return json.anime.episodes
    if (json.bangumi && dmIsArray(json.bangumi.episodes)) return json.bangumi.episodes

    return []
}

function dmExtractEpisodeId(matchJson) {
    if (!matchJson) return ''

    if (
        matchJson.matches &&
        dmIsArray(matchJson.matches) &&
        matchJson.matches.length > 0
    ) {
        for (let i = 0; i < matchJson.matches.length; i++) {
            const item = matchJson.matches[i]

            if (!item) continue

            const id =
                item.episodeId ||
                item.commentId ||
                item.episodeID ||
                item.commentID ||
                item.id ||
                item.cid

            if (id !== undefined && id !== null && dmTrim(id) !== '') {
                return dmTrim(id)
            }
        }
    }

    return ''
}

/**
 * 解析匹配到的集数，只用于提示
 */
function dmExtractMatchedEpisode(matchJson) {
    if (
        !matchJson ||
        !matchJson.matches ||
        !dmIsArray(matchJson.matches) ||
        matchJson.matches.length === 0
    ) {
        return 0
    }

    const item = matchJson.matches[0]
    const epTitle = item.episodeTitle || ''
    const n = dmExtractEpisodeFromText(epTitle, '')

    return n > 0 ? n : 0
}

/**
 * 提示只保留：线路名 + 匹配到第几集
 */
function dmBuildSimpleMatchToast(matchJson, apiItem) {
    const apiName = apiItem ? apiItem.name : ''
    const matchedEp = dmExtractMatchedEpisode(matchJson)

    if (matchedEp > 0) {
        return apiName + '：匹配第' + matchedEp + '集'
    }

    return apiName + '：匹配成功'
}

function dmConvertColor(color) {
    if (color === undefined || color === null || color === '') {
        return '16777215'
    }

    return dmTrim(color)
}

/**
 * 取消弹幕数量限制：全量转换 comments
 */
async function dmConvertComments(commentJson) {
    const result = []

    if (!commentJson) return result

    const comments = commentJson.comments

    if (!comments || !dmIsArray(comments)) return result

    for (let i = 0; i < comments.length; i++) {
        const item = comments[i]

        if (!item) continue

        let content = item.m || item.text || item.content || item.comment || ''
        content = dmTrim(content)

        if (!content) continue

        let time = 0
        let color = '16777215'

        if (item.p !== undefined && item.p !== null) {
            const parts = String(item.p).split(',')

            if (parts.length > 0) time = parseFloat(parts[0])
            if (parts.length > 2) color = parts[2]
        } else {
            if (item.t !== undefined) {
                time = parseFloat(item.t)
            } else if (item.time !== undefined) {
                time = parseFloat(item.time)
            }

            color = item.color || '16777215'
        }

        if (isNaN(time)) time = 0

        const dan = new DanMu()
        dan.content = content
        dan.time = time
        dan.color = dmConvertColor(color)

        result.push(dan)
    }

    return result
}

async function dmGetCommentsByEpisodeId(apiBase, episodeId) {
    const commentUrl =
        apiBase +
        '/api/v2/comment/' +
        encodeURIComponent(episodeId) +
        '?format=json&duration=true'

    const commentText = await dmHttpGet(commentUrl)
    const commentJson = dmParseJson(commentText)

    if (!commentJson) {
        return {
            data: [],
            error: 'comment 接口返回不是 JSON：' + String(commentText).substring(0, 200)
        }
    }

    const all = await dmConvertComments(commentJson)

    return {
        data: all,
        error: ''
    }
}

/**
 * ==========================
 * UZ type:400
 * ==========================
 */

async function getLines() {
    const apiList = await dmGetApiList()
    const lines = []

    for (let i = 0; i < apiList.length; i++) {
        lines.push(apiList[i].name)
    }

    return formatBackData({
        lines: lines,
        error: lines.length > 0 ? '' : '请配置 自动弹幕API'
    })
}

/**
 * 手动搜索平台列表：
 * 这里显示线路名，例如 aws / 韩
 */
async function getVideoPlatformList() {
    const apiList = await dmGetApiList()
    const platforms = []

    for (let i = 0; i < apiList.length; i++) {
        const p = new DanVideoPlatform()
        p.name = apiList[i].name
        p.isLineSwitchSupported = true
        platforms.push(p)
    }

    return formatBackData({
        data: platforms,
        error: platforms.length > 0 ? '' : '请配置 自动弹幕API',
    })
}

/**
 * 手动搜索：根据选择的线路搜索
 */
async function getVideoList(args) {
    const back = {
        data: [],
        error: '',
    }

    try {
        const selectName =
            (args && args.videoPlatformName) ||
            (args && args.line) ||
            ''

        const apiItem = await dmSelectApi(selectName)

        if (!apiItem) {
            back.error = '请配置 自动弹幕API'
            return formatBackData(back)
        }

        const name = dmGetName(args)

        if (!name) {
            back.error = '缺少搜索名称'
            return formatBackData(back)
        }

        const url =
            apiItem.url +
            '/api/v2/search/anime?keyword=' +
            encodeURIComponent(name)

        const text = await dmHttpGet(url)
        const json = dmParseJson(text)

        if (!json) {
            back.error = '搜索接口返回不是 JSON：' + String(text).substring(0, 200)
            return formatBackData(back)
        }

        const list = dmPickAnimeList(json)

        for (let i = 0; i < list.length; i++) {
            const item = list[i]

            if (!item) continue

            const animeId =
                item.animeId ||
                item.id ||
                item.bangumiId ||
                item.mediaId

            const title =
                item.animeTitle ||
                item.title ||
                item.name ||
                item.vod_name ||
                ''

            if (!animeId || !title) continue

            const v = new DanVideo()
            v.vod_name = title
            v.vod_remarks =
                item.type ||
                item.typeDescription ||
                item.desc ||
                item.year ||
                ''

            v.vod_pic =
                item.imageUrl ||
                item.image ||
                item.cover ||
                item.pic ||
                ''

            v.extData = {
                animeId: animeId,
                apiName: apiItem.name,
                apiBase: apiItem.url,
                raw: item
            }

            back.data.push(v)
        }
    } catch (e) {
        back.error = e.toString()
    }

    return formatBackData(back)
}

/**
 * 手动选剧后获取剧集
 */
async function getVideoEpisodes(args) {
    const back = {
        data: [],
        error: '',
    }

    try {
        let apiBase = ''
        let apiName = ''

        if (
            args &&
            args.danVideo &&
            args.danVideo.extData &&
            args.danVideo.extData.apiBase
        ) {
            apiBase = args.danVideo.extData.apiBase
            apiName = args.danVideo.extData.apiName || ''
        } else {
            const selectName =
                (args && args.videoPlatformName) ||
                (args && args.line) ||
                ''

            const apiItem = await dmSelectApi(selectName)

            if (apiItem) {
                apiBase = apiItem.url
                apiName = apiItem.name
            }
        }

        if (!apiBase) {
            back.error = '请配置 自动弹幕API'
            return formatBackData(back)
        }

        if (
            !args ||
            !args.danVideo ||
            !args.danVideo.extData ||
            !args.danVideo.extData.animeId
        ) {
            back.error = '缺少 animeId'
            return formatBackData(back)
        }

        const animeId = args.danVideo.extData.animeId
        const url = apiBase + '/api/v2/bangumi/' + encodeURIComponent(animeId)

        const text = await dmHttpGet(url)
        const json = dmParseJson(text)

        if (!json) {
            back.error = '剧集接口返回不是 JSON：' + String(text).substring(0, 200)
            return formatBackData(back)
        }

        const episodes = dmPickEpisodeList(json)

        for (let i = 0; i < episodes.length; i++) {
            const ep = episodes[i]

            if (!ep) continue

            const episodeId =
                ep.episodeId ||
                ep.commentId ||
                ep.episodeID ||
                ep.commentID ||
                ep.id ||
                ep.cid

            const title =
                ep.episodeTitle ||
                ep.title ||
                ep.name ||
                ep.vod_name ||
                ('第' + (i + 1) + '集')

            if (!episodeId) continue

            const d = new DanEpisode()
            d.vod_name = title
            d.vod_remarks = apiName
            d.extData = {
                episodeId: episodeId,
                apiName: apiName,
                apiBase: apiBase,
                raw: ep
            }

            back.data.push(d)
        }
    } catch (e) {
        back.error = e.toString()
    }

    return formatBackData(back)
}

async function searchDanMu(item) {
    let backData = new BackData()

    try {
        if (!item) item = {}

        /**
         * 手动精准选集优先
         */
        if (
            item.danEpisode &&
            item.danEpisode.extData &&
            item.danEpisode.extData.episodeId
        ) {
            const episodeId = item.danEpisode.extData.episodeId
            const apiBase = item.danEpisode.extData.apiBase || ''
            const apiName = item.danEpisode.extData.apiName || ''

            if (!apiBase) {
                backData.error = '手动选集缺少 apiBase'
                return formatBackData(backData)
            }

            dmShowToast(apiName + '：手动选集')

            const ret = await dmGetCommentsByEpisodeId(apiBase, episodeId)

            backData.data = ret.data
            backData.error = ret.error

            if (backData.data.length === 0 && !backData.error) {
                backData.error = '未找到弹幕'
            }

            return formatBackData(backData)
        }

        /**
         * 自动匹配
         */
        const selectName =
            item.line ||
            item.videoPlatformName ||
            ''

        const apiItem = await dmSelectApi(selectName)

        if (!apiItem) {
            backData.error = '请配置 自动弹幕API'
            return formatBackData(backData)
        }

        const name = dmGetName(item)

        if (!name) {
            backData.error = '缺少影片名称'
            return formatBackData(backData)
        }

        const episodeInfo = dmGetEpisodeInfo(item)

        let episode = parseInt(episodeInfo.episode, 10)

        if (isNaN(episode) || episode <= 0) {
            episode = 1
        }

        let season = parseInt(dmGetSeason(item), 10)

        if (isNaN(season) || season <= 0) {
            season = 1
        }

        const keyword = name + ' S' + dmPad2(season) + 'E' + dmPad2(episode)

        const matchBody = {
            fileName: keyword,
            title: name,
            animeTitle: name,
            videoName: keyword,
            episode: episode,
            episodeNumber: episode,
            season: season,
            seasonNumber: season
        }

        const matchUrl = apiItem.url + '/api/v2/match'

        const matchText = await dmHttpPostJson(matchUrl, matchBody)
        const matchJson = dmParseJson(matchText)

        if (!matchJson) {
            backData.error = 'match 接口返回不是 JSON：' + String(matchText).substring(0, 200)
            return formatBackData(backData)
        }

        if (matchJson.success === false || matchJson.isMatched === false) {
            backData.error = matchJson.errorMessage || '自动匹配失败'
            return formatBackData(backData)
        }

        const episodeId = dmExtractEpisodeId(matchJson)

        if (!episodeId) {
            backData.error = '自动匹配成功但未找到 episodeId'
            return formatBackData(backData)
        }

        // 提示只保留：线路名 + 匹配到第几集
        dmShowToast(dmBuildSimpleMatchToast(matchJson, apiItem))

        const ret = await dmGetCommentsByEpisodeId(apiItem.url, episodeId)

        backData.data = ret.data
        backData.error = ret.error
    } catch (error) {
        backData.error = error.toString()
    }

    if (backData.data.length === 0 && !backData.error) {
        backData.error = '未找到弹幕'
    }

    return formatBackData(backData)
}

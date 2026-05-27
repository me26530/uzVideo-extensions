// ignore
//@name:danmu_api自动匹配
// 版本号纯数字
//@version:15
// 备注，没有的话就不填
//@remark:接入 huangxd-/danmu_api，自动匹配弹幕，不走 FongMi，环境变量版
// 加密 id，没有的话就不填
//@codeID:
// 使用的环境变量，没有的话就不填
//@env:DANMU_API_BASE##danmu_api服务地址，例如 https://xxx.on.aws/你的TOKEN&&DANMU_MAX_COUNT##最大弹幕数量，默认8000
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
        /**
         * 弹幕内容
         * @type {string}
         */
        this.content = ''

        /**
         * 弹幕出现时间，单位秒
         * @type {number}
         */
        this.time = 0

        /**
         * 弹幕颜色，支持 10 进制 / 16 进制
         * @type {string}
         */
        this.color = ''
    }
}

class BackData {
    constructor() {
        /**
         * 弹幕数据
         * @type {DanMu[]}
         */
        this.data = []

        /**
         * 错误信息
         * @type {string}
         */
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
 * 默认配置
 * ==========================
 */

// 不写死 API 地址。必须通过环境变量 DANMU_API_BASE 配置。
const DANMU_MAX_COUNT_DEFAULT = 8000

/**
 * ==========================
 * 工具函数
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

/**
 * 读取环境变量
 *
 * 兼容两种写法：
 * 1. getEnv(appConfig.uzTag, key)
 * 2. getEnv(key)
 */
function dmGetEnv(key, def) {
    try {
        const v = getEnv(appConfig.uzTag, key)
        if (v !== undefined && v !== null && dmTrim(v) !== '') {
            return dmTrim(v)
        }
    } catch (e) {}

    try {
        const v2 = getEnv(key)
        if (v2 !== undefined && v2 !== null && dmTrim(v2) !== '') {
            return dmTrim(v2)
        }
    } catch (e2) {}

    return def
}

function dmGetApiBase() {
    let base = dmGetEnv('DANMU_API_BASE', '')

    base = dmTrim(base)

    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
        base = base.substring(0, base.length - 1)
    }

    return base
}

function dmGetMaxCount() {
    const value = dmGetEnv('DANMU_MAX_COUNT', String(DANMU_MAX_COUNT_DEFAULT))
    const n = parseInt(value, 10)

    if (isNaN(n) || n <= 0) {
        return DANMU_MAX_COUNT_DEFAULT
    }

    return n
}

function dmGetName(item) {
    let name = dmPick(item, [
        'name',
        'title',
        'vod_name',
        'videoName',
        'movieName',
        'showName',
        'danVideo'
    ], '')

    name = dmTrim(name)
    name = name.replace(/\s*第\s*\d+\s*[集话話]\s*$/g, '')
    name = name.replace(/\s*S\d+\s*E\d+\s*$/ig, '')
    name = dmTrim(name)

    return name
}

function dmGetEpisode(item) {
    let ep = dmPick(item, [
        'episode',
        'danEpisode',
        'episodeIndex',
        'index',
        'serial',
        'playIndex',
        'number'
    ], '')

    if (ep !== undefined && ep !== null && dmTrim(ep) !== '') {
        const m = String(ep).match(/\d+/)
        if (m) return m[0]
    }

    const title = dmTrim(dmPick(item, [
        'subTitle',
        'episodeName',
        'playName',
        'urlName',
        'vod_play_name',
        'line'
    ], ''))

    const patterns = [
        /第\s*(\d+)\s*[集话話]/,
        /S\d+\s*E(\d+)/i,
        /E(\d+)/i,
        /EP\s*(\d+)/i,
        /(\d+)/
    ]

    for (let i = 0; i < patterns.length; i++) {
        const match = title.match(patterns[i])
        if (match) return match[1]
    }

    return '1'
}

function dmGetSeason(item) {
    const season = dmPick(item, [
        'season',
        'seasonIndex',
        'seasonNumber'
    ], '')

    if (season !== undefined && season !== null && dmTrim(season) !== '') {
        const m = String(season).match(/\d+/)
        if (m) return m[0]
    }

    return '1'
}

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

    if (typeof res === 'string') {
        return res
    }

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

/**
 * GET 请求
 */
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

/**
 * POST JSON 请求
 *
 * 重点：
 * UZ 的 req 在这里优先使用 data: 对象。
 * 如果服务端返回 Invalid JSON body，再尝试 data: JSON字符串 和 body: JSON字符串。
 */
async function dmHttpPostJson(url, body) {
    const payload = JSON.stringify(body || {})

    const headers = {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json,text/plain,*/*',
        'Content-Type': 'application/json',
        'content-type': 'application/json'
    }

    const tryList = [
        {
            method: 'POST',
            headers: headers,
            data: body || {}
        },
        {
            method: 'POST',
            headers: headers,
            data: payload
        },
        {
            method: 'POST',
            headers: headers,
            body: payload
        }
    ]

    let lastText = ''

    for (let i = 0; i < tryList.length; i++) {
        const res = await req(url, tryList[i])
        const text = dmNormalizeResponse(res)
        lastText = text

        const json = dmParseJson(text)

        if (!json || json.errorMessage !== 'Invalid JSON body') {
            return text
        }
    }

    return lastText
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

function dmConvertColor(color) {
    if (color === undefined || color === null || color === '') {
        return '16777215'
    }

    color = dmTrim(color)

    // danmu_api 返回的是 10 进制颜色，例如 16777215
    return color
}

function dmConvertComments(commentJson) {
    const result = []

    if (!commentJson) return result

    const comments = commentJson.comments

    if (!comments || !dmIsArray(comments)) {
        return result
    }

    const maxCount = dmGetMaxCount()

    for (let i = 0; i < comments.length; i++) {
        if (result.length >= maxCount) break

        const item = comments[i]
        if (!item) continue

        let content = item.m || item.text || item.content || item.comment || ''
        content = dmTrim(content)

        if (!content) continue

        let time = 0
        let color = '16777215'

        /**
         * danmu_api 返回格式：
         * {
         *   p: "0.00,1,16777215,[qq]",
         *   m: "弹幕内容"
         * }
         */
        if (item.p !== undefined && item.p !== null) {
            const parts = String(item.p).split(',')

            if (parts.length > 0) {
                time = parseFloat(parts[0])
            }

            if (parts.length > 2) {
                color = parts[2]
            }
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

/**
 * 获取所有弹幕线路
 */
async function getLines() {
    return formatBackData({
        lines: [
            '自动匹配'
        ],
        error: '',
    })
}

/**
 * 获取搜索资源平台名称列表，可选
 */
async function getVideoPlatformList() {
    return formatBackData({
        data: [],
        error: '',
    })
}

/**
 * 获取视频列表，可选
 */
async function getVideoList(args) {
    return formatBackData({
        data: [],
        error: '',
    })
}

/**
 * 获取剧集列表，可选
 */
async function getVideoEpisodes(args) {
    return formatBackData({
        data: [],
        error: '',
    })
}

/**
 * 搜索弹幕
 */
async function searchDanMu(item) {
    let backData = new BackData()

    try {
        if (!item) item = {}

        const apiBase = dmGetApiBase()

        if (!apiBase) {
            backData.error = '请先配置环境变量 DANMU_API_BASE'
            return formatBackData(backData)
        }

        if (apiBase.indexOf('http') !== 0) {
            backData.error = 'DANMU_API_BASE 格式错误，应类似 https://xxx/你的TOKEN'
            return formatBackData(backData)
        }

        const name = dmGetName(item)
        const episode = dmGetEpisode(item)
        const season = dmGetSeason(item)

        if (!name) {
            backData.error = '缺少影片名称'
            return formatBackData(backData)
        }

        const keyword = name + ' S' + dmPad2(season) + 'E' + dmPad2(episode)

        const matchBody = {
            fileName: keyword,
            title: name,
            animeTitle: name,
            videoName: keyword,
            episode: parseInt(episode || '1', 10),
            episodeNumber: parseInt(episode || '1', 10),
            season: parseInt(season || '1', 10),
            seasonNumber: parseInt(season || '1', 10)
        }

        const matchUrl = apiBase + '/api/v2/match'

        const matchText = await dmHttpPostJson(matchUrl, matchBody)
        const matchJson = dmParseJson(matchText)

        if (!matchJson) {
            backData.error = 'match 接口返回不是 JSON'
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

        const commentUrl =
            apiBase +
            '/api/v2/comment/' +
            encodeURIComponent(episodeId) +
            '?format=json&duration=true'

        const commentText = await dmHttpGet(commentUrl)
        const commentJson = dmParseJson(commentText)

        if (!commentJson) {
            backData.error = 'comment 接口返回不是 JSON'
            return formatBackData(backData)
        }

        const all = dmConvertComments(commentJson)

        backData.data = all
    } catch (error) {
        backData.error = error.toString()
    }

    if (backData.data.length === 0 && !backData.error) {
        backData.error = '未找到弹幕'
    }

    return formatBackData(backData)
}

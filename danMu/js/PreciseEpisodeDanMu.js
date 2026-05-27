// ignore
//@name:danmu_api自动匹配
// 版本号纯数字
//@version:20
// 备注，没有的话就不填
//@remark:接入 huangxd-/danmu_api，自动匹配弹幕，不走 FongMi，环境变量版，带匹配提示，修复 episode=0
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
 * 默认最大弹幕数
 * 可通过环境变量 DANMU_MAX_COUNT 覆盖
 */
const DANMU_MAX_COUNT_DEFAULT = 8000

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

    if (isNaN(n) || n <= 0) {
        n = 1
    }

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
 * 使用 getEnv(appConfig.uzTag, key) 读取扩展环境变量。
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

            if (v !== '') {
                return v
            }
        }
    } catch (e) {}

    return def
}

/**
 * 获取 danmu_api 基础地址
 *
 * 正确填写：
 * https://你的域名/你的TOKEN
 *
 * 不要填写：
 * /api/v2/match
 * /api/v2/comment
 * /api/logs
 */
async function dmGetApiBase() {
    let base = await dmGetEnv('DANMU_API_BASE', '')

    base = dmTrim(base)

    // 去掉可能误填的引号
    base = base.replace(/^['"]+|['"]+$/g, '')

    // 去掉末尾 /
    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
        base = base.substring(0, base.length - 1)
    }

    // 如果误填到了具体接口，自动裁剪到 token 层
    base = base.replace(/\/api\/v2\/match$/i, '')
    base = base.replace(/\/api\/v2\/comment.*$/i, '')
    base = base.replace(/\/api\/logs$/i, '')

    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
        base = base.substring(0, base.length - 1)
    }

    return base
}

async function dmGetMaxCount() {
    const value = await dmGetEnv('DANMU_MAX_COUNT', String(DANMU_MAX_COUNT_DEFAULT))
    const n = parseInt(value, 10)

    if (isNaN(n) || n <= 0) {
        return DANMU_MAX_COUNT_DEFAULT
    }

    return n
}

/**
 * ==========================
 * 参数解析
 * ==========================
 */

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

/**
 * 获取集数
 *
 * 修复：
 * - episode 为 0 时不直接使用；
 * - videoUrl 为纯数字时，优先作为集数兜底；
 * - 最终保证返回大于 0 的集数。
 */
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

        if (m) {
            const n = parseInt(m[0], 10)

            if (!isNaN(n) && n > 0) {
                return String(n)
            }
        }
    }

    /**
     * 兜底：
     * 有些情况下 UZ 会传 episode:0，
     * 但 videoUrl 里是实际集数，例如 videoUrl:"5"
     */
    const videoUrl = dmPick(item, [
        'videoUrl'
    ], '')

    if (videoUrl !== undefined && videoUrl !== null && dmTrim(videoUrl) !== '') {
        const vu = dmTrim(videoUrl)

        if (/^\d+$/.test(vu)) {
            const n2 = parseInt(vu, 10)

            if (!isNaN(n2) && n2 > 0) {
                return String(n2)
            }
        }
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

        if (match) {
            const n3 = parseInt(match[1], 10)

            if (!isNaN(n3) && n3 > 0) {
                return String(n3)
            }
        }
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

        if (m) {
            const n = parseInt(m[0], 10)

            if (!isNaN(n) && n > 0) {
                return String(n)
            }
        }
    }

    return '1'
}

/**
 * ==========================
 * 网络与 JSON
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

    if (typeof res === 'string') {
        return res
    }

    if (res.data !== undefined) {
        if (typeof res.data === 'string') {
            return res.data
        }

        return JSON.stringify(res.data)
    }

    if (res.body !== undefined) {
        if (typeof res.body === 'string') {
            return res.body
        }

        return JSON.stringify(res.body)
    }

    if (res.content !== undefined) {
        if (typeof res.content === 'string') {
            return res.content
        }

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
 * 已验证：
 * UZ req 对 danmu_api /api/v2/match 使用 data: 对象可正常请求。
 */
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
 * 构造匹配提示弹幕
 *
 * 示例：
 * 请求：仙逆 第6集 ｜ 已匹配：仙逆(2023)【3D动漫】from tencent - 【qq】 仙逆_06 ｜ID:10007 [3D动漫]
 */
function dmBuildMatchTip(matchJson, requestName, requestEpisode) {
    if (!matchJson) return ''

    if (
        matchJson.matches &&
        dmIsArray(matchJson.matches) &&
        matchJson.matches.length > 0
    ) {
        const item = matchJson.matches[0]

        if (!item) return ''

        const animeTitle = item.animeTitle || ''
        const episodeTitle = item.episodeTitle || ''
        const type = item.type || ''
        const episodeId = item.episodeId || item.commentId || item.id || ''

        let tip = '请求：' + requestName + ' 第' + requestEpisode + '集'

        if (animeTitle || episodeTitle) {
            tip += ' ｜ 已匹配：'
        }

        if (animeTitle) {
            tip += animeTitle
        }

        if (episodeTitle) {
            tip += ' - ' + episodeTitle
        }

        if (episodeId) {
            tip += ' ｜ID:' + episodeId
        }

        if (type) {
            tip += ' [' + type + ']'
        }

        return tip
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

async function dmConvertComments(commentJson) {
    const result = []

    if (!commentJson) return result

    const comments = commentJson.comments

    if (!comments || !dmIsArray(comments)) {
        return result
    }

    const maxCount = await dmGetMaxCount()

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

        if (isNaN(time)) {
            time = 0
        }

        const dan = new DanMu()
        dan.content = content
        dan.time = time
        dan.color = dmConvertColor(color)

        result.push(dan)
    }

    return result
}

/**
 * ==========================
 * UZ type:400 全局函数
 * ==========================
 */

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
        if (!item) {
            item = {}
        }

        const apiBase = await dmGetApiBase()

        if (!apiBase) {
            backData.error = '请先配置环境变量 DANMU_API_BASE'
            return formatBackData(backData)
        }

        if (apiBase.indexOf('http') !== 0) {
            backData.error = 'DANMU_API_BASE 读取值异常：' + apiBase
            return formatBackData(backData)
        }

        const name = dmGetName(item)

        let episode = parseInt(dmGetEpisode(item), 10)

        if (isNaN(episode) || episode <= 0) {
            episode = 1
        }

        let season = parseInt(dmGetSeason(item), 10)

        if (isNaN(season) || season <= 0) {
            season = 1
        }

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
            episode: episode,
            episodeNumber: episode,
            season: season,
            seasonNumber: season
        }

        const matchUrl = apiBase + '/api/v2/match'

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
        const matchTip = dmBuildMatchTip(matchJson, name, episode)

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
            backData.error = 'comment 接口返回不是 JSON：' + String(commentText).substring(0, 200)
            return formatBackData(backData)
        }

        const all = await dmConvertComments(commentJson)

        // 在弹幕最前面加入匹配提示
        // 不放在 0 秒，避免被大量 0 秒弹幕挤掉
        if (matchTip) {
            const tipTimes = [1, 3, 5]

            for (let i = tipTimes.length - 1; i >= 0; i--) {
                const tipDan = new DanMu()
                tipDan.content = matchTip
                tipDan.time = tipTimes[i]
                tipDan.color = '16776960' // 黄色

                all.unshift(tipDan)
            }
        }

        backData.data = all
    } catch (error) {
        backData.error = error.toString()
    }

    if (backData.data.length === 0 && !backData.error) {
        backData.error = '未找到弹幕'
    }

    return formatBackData(backData)
}

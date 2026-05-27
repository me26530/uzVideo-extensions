// ignore
//@name:danmu_api自动匹配
// 版本号纯数字
//@version:22
// 备注，没有的话就不填
//@remark:接入 huangxd-/danmu_api，自动匹配弹幕，不走 FongMi，优先从文件名识别真实集数
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

function dmShowToast(message) {
    try {
        if (message) {
            toast(message)
        }
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

            if (v !== '') {
                return v
            }
        }
    } catch (e) {}

    return def
}

async function dmGetApiBase() {
    let base = await dmGetEnv('DANMU_API_BASE', '')

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
 * 剧名与真实集数识别
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

/**
 * 从路径或 URL 中取文件名
 */
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

/**
 * 判断数字是否像集数
 * 避免把 3840、1632、1080、2160、2024 之类识别成集数。
 */
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

/**
 * 从文本、文件名、播放地址中提取真实集数。
 *
 * 支持：
 * 仙逆137.mp4
 * 仙逆_137
 * 仙逆-137
 * 仙逆 第137集
 * S01E137
 * EP137
 * E137
 * videoUrl: "5"
 */
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

                if (dmIsLikelyEpisodeNumber(n)) {
                    return n
                }
            }
        }

        /**
         * 特殊处理：
         * 仙逆137
         * 剑来05
         */
        if (seriesName) {
            const safeName = dmTrim(seriesName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(safeName + '\\s*0*(\\d{1,4})', 'i')
            const m2 = s.match(re)

            if (m2 && m2[1]) {
                const n2 = parseInt(m2[1], 10)

                if (dmIsLikelyEpisodeNumber(n2)) {
                    return n2
                }
            }
        }

        /**
         * 最后兜底：
         * 取文件名里的最后一个合理数字。
         * 例如：仙逆137 -> 137
         */
        const allNums = s.match(/\d{1,4}/g)

        if (allNums && allNums.length > 0) {
            for (let j = allNums.length - 1; j >= 0; j--) {
                const n3 = parseInt(allNums[j], 10)

                if (dmIsLikelyEpisodeNumber(n3)) {
                    return n3
                }
            }
        }
    }

    return 0
}

/**
 * 获取真实集数
 *
 * 优先级：
 * 1. videoUrl / 文件名 / 播放路径
 * 2. danEpisode / danVideo 名称
 * 3. UZ 给的 episode
 * 4. 其它标题字段
 * 5. 默认 1
 */
function dmGetEpisode(item) {
    const seriesName = dmGetName(item)

    /**
     * 第一优先级：从 videoUrl 或播放文件名识别
     */
    const videoUrl = dmPick(item, [
        'videoUrl'
    ], '')

    const epFromVideoUrl = dmExtractEpisodeFromText(videoUrl, seriesName)

    if (epFromVideoUrl > 0) {
        return String(epFromVideoUrl)
    }

    /**
     * 第二优先级：从 danEpisode 里识别
     */
    try {
        if (item && item.danEpisode) {
            const epText =
                item.danEpisode.vod_name ||
                item.danEpisode.vod_remarks ||
                ''

            const epFromDanEpisode = dmExtractEpisodeFromText(epText, seriesName)

            if (epFromDanEpisode > 0) {
                return String(epFromDanEpisode)
            }
        }
    } catch (e) {}

    /**
     * 第二优先级：从 danVideo 里识别
     */
    try {
        if (item && item.danVideo) {
            const videoText =
                item.danVideo.vod_name ||
                item.danVideo.vod_remarks ||
                ''

            const epFromDanVideo = dmExtractEpisodeFromText(videoText, seriesName)

            if (epFromDanVideo > 0) {
                return String(epFromDanVideo)
            }
        }
    } catch (e2) {}

    /**
     * 第三优先级：UZ 给的 episode
     * 仅 episode > 0 时使用
     */
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
                return String(n)
            }
        }
    }

    /**
     * 第四优先级：其它字段
     */
    const title = dmTrim(dmPick(item, [
        'subTitle',
        'episodeName',
        'playName',
        'urlName',
        'vod_play_name',
        'line'
    ], ''))

    const epFromTitle = dmExtractEpisodeFromText(title, seriesName)

    if (epFromTitle > 0) {
        return String(epFromTitle)
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

function dmBuildMatchToast(matchJson, requestName, requestEpisode) {
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
        const episodeId = item.episodeId || item.commentId || item.id || ''

        let tip = '识别集数：第' + requestEpisode + '集'

        if (animeTitle || episodeTitle) {
            tip += '\n匹配：'
        }

        if (animeTitle) {
            tip += animeTitle
        }

        if (episodeTitle) {
            tip += ' - ' + episodeTitle
        }

        if (episodeId) {
            tip += '\nID：' + episodeId
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

async function getLines() {
    return formatBackData({
        lines: [
            '自动匹配'
        ],
        error: '',
    })
}

async function getVideoPlatformList() {
    return formatBackData({
        data: [],
        error: '',
    })
}

async function getVideoList(args) {
    return formatBackData({
        data: [],
        error: '',
    })
}

async function getVideoEpisodes(args) {
    return formatBackData({
        data: [],
        error: '',
    })
}

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

        // 显示识别出来的真实集数，便于确认是否绕过 UZ 错误集数
        dmShowToast('自动识别集数：第' + episode + '集')

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

        if (!episodeId) {
            backData.error = '自动匹配成功但未找到 episodeId'
            return formatBackData(backData)
        }

        const matchToast = dmBuildMatchToast(matchJson, name, episode)
        dmShowToast(matchToast)

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

        backData.data = all
    } catch (error) {
        backData.error = error.toString()
    }

    if (backData.data.length === 0 && !backData.error) {
        backData.error = '未找到弹幕'
    }

    return formatBackData(backData)
}

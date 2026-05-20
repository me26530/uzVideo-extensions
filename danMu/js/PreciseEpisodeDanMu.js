// @name:精准集数弹幕
// @version:7
// @type:400
// @remark:适配 huangxd-/danmu_api；仅使用环境变量API；修复JSC正则nothing to repeat；保留match；支持videoUrl直取；强制JSON；精准集数匹配
// @env:精准弹幕API##必填，格式：线路名@https://api.example.com/TOKEN|线路2@https://api2.example.com/{TOKEN}&&TOKEN##可选，当精准弹幕API中包含{TOKEN}时替换&&最小弹幕数量##可选，默认1
// @order:A00
// @isAV:0
// @deprecated:0

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
    key = normalizeText(key)
    if (!key) return ''

    if (typeof getEnv !== 'function') return ''

    const tag = normalizeText(appConfig.uzTag || appConfig._uzTag || '')

    // 重点：只保留这个方向，避免把 uzTag 当环境变量名读取
    try {
        const value = getEnv(key, tag)
        const text = envValueToText(value, key)
        if (text) return text
    } catch (e) {}

    // 兼容部分旧版运行时：只传 key
    try {
        const value = getEnv(key)
        const text = envValueToText(value, key)
        if (text) return text
    } catch (e) {}

    return ''
}

function envValueToText(value, key) {
    if (value === undefined || value === null) return ''

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return normalizeText(value)
    }

    if (typeof value === 'object') {
        try {
            if (value.value !== undefined && value.value !== null) {
                const text = envValueToText(value.value, key)
                if (text) return text
            }
        } catch (e) {}

        try {
            if (value.data !== undefined && value.data !== null) {
                const text = envValueToText(value.data, key)
                if (text) return text
            }
        } catch (e) {}

        try {
            if (value.val !== undefined && value.val !== null) {
                const text = envValueToText(value.val, key)
                if (text) return text
            }
        } catch (e) {}

        try {
            if (value.result !== undefined && value.result !== null) {
                const text = envValueToText(value.result, key)
                if (text) return text
            }
        } catch (e) {}

        try {
            if (key && value[key] !== undefined && value[key] !== null) {
                const text = envValueToText(value[key], key)
                if (text) return text
            }
        } catch (e) {}
    }

    return ''
}

function safeGetEnv(key) {
    key = normalizeText(key)
    if (!key) return ''

    if (typeof getEnv !== 'function') return ''

    const tag = normalizeText(appConfig.uzTag || appConfig._uzTag || '')

    // uz 模板里原本就是 getEnv(appConfig.uzTag, key)，所以这里必须 tag 在前、key 在后。
    try {
        const value = getEnv(tag, key)
        const text = envValueToText(value, key)
        if (text) return text
    } catch (e) {}

    // 少数旧环境可能不需要 tag，作为兜底。
    try {
        const value = getEnv(key)
        const text = envValueToText(value, key)
        if (text) return text
    } catch (e) {}

    return ''
}



function getMinDanmuCount() {
    const n = toNumberSafe(safeGetEnv('最小弹幕数量'))
    return n || 1
}

function parseJsonIfString(result) {
    if (typeof result !== 'string') return result
    try {
        return JSON.parse(result)
    } catch (e) {
        return result
    }
}

function getResponseBody(result) {
    result = parseJsonIfString(result)
    if (!result) return result

    if (result.data !== undefined && result.data !== null) {
        const data = parseJsonIfString(result.data)
        if (
            data &&
            typeof data === 'object' &&
            (data.animes ||
                data.comments ||
                data.matches ||
                data.episodeId ||
                data.commentId ||
                data.anime ||
                data.episode ||
                data.match ||
                data.matched)
        ) {
            return data
        }
    }

    return result
}

function getAnimesFromSearchResult(result) {
    const body = getResponseBody(result)
    if (!body) return []

    if (body.data && body.data.animes) return body.data.animes
    if (body.animes) return body.animes
    if (body.results && body.results.animes) return body.results.animes
    if (Array.isArray(body)) return body

    return []
}

function getCommentsFromResult(result) {
    const body = getResponseBody(result)
    if (!body) return []

    if (body.data && body.data.comments) return body.data.comments
    if (body.comments) return body.comments
    if (body.comment) return body.comment
    if (body.danmakus) return body.danmakus
    if (body.danmus) return body.danmus
    if (Array.isArray(body)) return body

    return []
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

function isDigitCharForUrlParse(ch) {
    if (!ch || ch.length === 0) return false
    const code = ch.charCodeAt(0)
    return code >= 48 && code <= 57
}

function isLetterCharForUrlParse(ch) {
    if (!ch || ch.length === 0) return false
    const code = ch.charCodeAt(0)
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function isAlphaNumForUrlParse(ch) {
    return isDigitCharForUrlParse(ch) || isLetterCharForUrlParse(ch)
}

function numberFromDigitPrefixForUrlParse(text) {
    text = normalizeText(text)
    if (!text) return null

    let s = ''
    for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i)
        if (isDigitCharForUrlParse(ch)) s += ch
        else break
    }

    return toNumberSafe(s)
}

function tokenizeUrlForEpisodeParse(text) {
    text = normalizeText(text).toLowerCase()

    const list = []
    let current = ''

    for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i)

        if (isAlphaNumForUrlParse(ch)) {
            current += ch
        } else {
            if (current) {
                list.push(current)
                current = ''
            }
        }
    }

    if (current) list.push(current)

    return list
}

function parseChineseEpisodeFromUrlText(text) {
    text = normalizeText(text)
    if (!text) return null

    for (let i = 0; i < text.length; i++) {
        if (text.charAt(i) !== '第') continue

        let part = ''
        for (let j = i + 1; j < text.length; j++) {
            const ch = text.charAt(j)

            if (ch === '集' || ch === '话' || ch === '話' || ch === '回') {
                const n = /^\d+$/.test(part) ? Number(part) : chineseNumberToInt(part)
                if (n && n > 0 && n < 3000) return n
                break
            }

            if (
                isDigitCharForUrlParse(ch) ||
                '零〇一二两三四五六七八九十百'.indexOf(ch) >= 0
            ) {
                part += ch
            } else if (part) {
                break
            }
        }
    }

    return null
}

function parseEpisodeFromUrl(url) {
    url = safeDecodeURIComponent(normalizeText(url))
    if (!url) return null

    const cnEp = parseChineseEpisodeFromUrlText(url)
    if (cnEp) return cnEp

    const tokens = tokenizeUrlForEpisodeParse(url)

    const keys = [
        'episodes',
        'episode',
        'vidindex',
        'index',
        'play',
        'page',
        'nid',
        'ep',
        'e',
    ]

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]

        for (let k = 0; k < keys.length; k++) {
            const key = keys[k]

            if (token === key && i + 1 < tokens.length) {
                const n1 = numberFromDigitPrefixForUrlParse(tokens[i + 1])
                if (n1) return n1
            }

            if (token.indexOf(key) === 0 && token.length > key.length) {
                const rest = token.substring(key.length)
                const n2 = numberFromDigitPrefixForUrlParse(rest)
                if (n2) return n2
            }
        }
    }

    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i]
        if (token === 'html' || token === 'htm') continue

        const n = numberFromDigitPrefixForUrlParse(token)
        if (n) {
            if (n === 720 || n === 1080 || n === 2160 || n === 2024 || n === 2025 || n === 2026) {
                continue
            }
            return n
        }
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
        .replace(/\$\$[\s\S]*?\$\$/g, '')
        .replace(/【[^】]*】/g, '')
        .replace(/（[^）]*）/g, '')
        .replace(/\([^)]*\)/g, '')
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
        .replace(/\$\$[\s\S]*?\$\$/g, '')
        .replace(/【[^】]*】/g, '')
        .replace(/（[^）]*）/g, '')
        .replace(/\([^)]*\)/g, '')
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
        _matchedEpisodeTitle: '',
        _matchedScore: 0,
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

        info.episodeId = normalizeText(ext.episodeId || ext.commentId || ep.episodeId || ep.commentId || ep.id || '')

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
    return normalizeText(base).replace(/\/+$/, '')
}

function buildApiUrl(api, path) {
    let base = normalizeApiBase(api.base)
    if (!base) return ''

    // 只有 base 里真的包含 {TOKEN} 时，才读取 TOKEN
    // 如果你的 JSON env 没声明 TOKEN，请不要在 精准弹幕API 里使用 {TOKEN}
    if (base.indexOf('{TOKEN}') >= 0) {
        const token = normalizeText(safeGetEnv('TOKEN'))
        base = base.replace(/\{TOKEN\}/g, token || '')
        base = base.replace(/\/+$/, '')
    }

    if (base.endsWith('/api/v2')) {
        return base + path.replace(/^\/api\/v2/, '')
    }

    return base + path
}


function parseCustomApis() {
    const result = []

    // 只读取配置文件里声明过的环境变量，避免触发“未声明环境变量”错误
    let env = safeGetEnv('精准弹幕API')

    env = normalizeText(env)

    if (!env) return result

    env = env
        .replace(/^精准弹幕API\s*[:=：]\s*/i, '')
        .trim()

    const parts = env
        .split(/[|；;]/)
        .map(function (x) {
            return normalizeText(x)
        })
        .filter(Boolean)

    for (let i = 0; i < parts.length; i++) {
        const item = parts[i]

        let name = ''
        let base = ''

        const atIndex = item.indexOf('@')

        if (atIndex > 0) {
            name = normalizeText(item.substring(0, atIndex))
            base = normalizeApiBase(item.substring(atIndex + 1))
        } else {
            name = '默认线路' + String(i + 1)
            base = normalizeApiBase(item)
        }

        if (base) {
            result.push({
                name: name || '默认线路' + String(i + 1),
                base: base,
            })
        }
    }

    return result
}



function getApiConfigs(preferredName) {
    const apis = parseCustomApis()
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
        const p = normalizeText(element.p || element.param || '')
        const params = p ? p.split(',') : []

        const content = element.m || element.text || element.content || element.contentText || element.message || ''
        if (!content) continue

        const danMu = new DanMu()
        danMu.content = content

        const t = Number(params[0] || element.time || element.position || element.at || 0)
        danMu.time = Number.isFinite(t) && t >= 0 ? t : 0

        danMu.color = normalizeText(params[2] || element.color || element.colour || '')

        list.push(danMu)
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

function getAnimeTitle(anime) {
    anime = anime || {}
    return normalizeText(anime.animeTitle || anime.title || anime.name || '')
}

function getEpisodeIdFromItem(ep) {
    ep = ep || {}
    return normalizeText(ep.episodeId || ep.commentId || ep.id || '')
}

function getEpisodeNumberFromApiItem(ep) {
    ep = ep || {}
    const title = normalizeText(ep.episodeTitle || ep.title || ep.name)

    return (
        toNumberSafe(ep.episode) ||
        toNumberSafe(ep.episodeNumber) ||
        toNumberSafe(ep.sort) ||
        toNumberSafe(ep.index) ||
        parseEpisodeNumber(title)
    )
}

function isLikelySpecialEpisodeTitle(title) {
    title = normalizeText(title)
    return /花絮|彩蛋|预告|先导|PV|Trailer|Preview|SP|OVA|OAD|特别篇|总集篇|制作|访谈|采访|宣传|片花|番外|看点|速看|速览|会员专享|会员加长|纪录|解读|影评|盘点/i.test(title)
}

function scoreAnimeTitle(anchorTitle, animeTitle) {
    const anchor = cleanClickedTitle(anchorTitle || '')
    const target = cleanClickedTitle(animeTitle || '')

    if (!anchor || !target) return 0
    if (anchor === target) return 100
    if (target.indexOf(anchor) >= 0) return 80
    if (anchor.indexOf(target) >= 0) return 70

    return 0
}

function pickBestEpisodeFromAnimes(animes, epInfo, anchorTitle) {
    animes = animes || []

    const targetEpisode = toNumberSafe(epInfo.episode)
    let best = null
    let bestScore = -1

    for (let i = 0; i < animes.length; i++) {
        const anime = animes[i] || {}
        const animeTitle = getAnimeTitle(anime)
        const titleScore = scoreAnimeTitle(anchorTitle, animeTitle)

        if (titleScore <= 0) continue

        const episodes = anime.episodes || anime.episodeList || []

        for (let j = 0; j < episodes.length; j++) {
            const ep = episodes[j] || {}
            const episodeTitle = normalizeText(ep.episodeTitle || ep.title || ep.name)
            const episodeId = getEpisodeIdFromItem(ep)
            const epNum = getEpisodeNumberFromApiItem(ep)

            if (!episodeId) continue

            let score = titleScore

            if (targetEpisode) {
                if (epNum === targetEpisode) score += 120
                else continue
            }

            if (isLikelySpecialEpisodeTitle(episodeTitle)) score -= 80

            score -= i * 2
            score -= j

            if (score > bestScore) {
                bestScore = score
                best = {
                    anime: anime,
                    episode: ep,
                    episodeId: episodeId,
                    animeTitle: animeTitle,
                    episodeTitle: episodeTitle,
                    episodeNumber: epNum,
                    score: score,
                }
            }
        }
    }

    return best
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

function extractMatchEpisodeId(result) {
    const body = getResponseBody(result)
    if (!body) return ''

    const direct =
        body.episodeId ||
        body.commentId ||
        body.id ||
        (body.data && (body.data.episodeId || body.data.commentId || body.data.id))

    if (direct) return normalizeText(direct)

    const ep =
        body.episode ||
        body.matchedEpisode ||
        body.selectedEpisode ||
        (body.data && body.data.episode)

    if (ep) {
        const id = getEpisodeIdFromItem(ep)
        if (id) return id
    }

    const match =
        body.match ||
        body.matched ||
        (body.data && (body.data.match || body.data.matched))

    if (match) {
        const id = normalizeText(match.episodeId || match.commentId || match.id)
        if (id) return id

        if (match.episode) {
            const epId = getEpisodeIdFromItem(match.episode)
            if (epId) return epId
        }
    }

    const matches = body.matches || (body.data && body.data.matches)
    if (matches && matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
            const item = matches[i] || {}
            const id = normalizeText(item.episodeId || item.commentId || item.id)
            if (id) return id

            if (item.episode) {
                const epId = getEpisodeIdFromItem(item.episode)
                if (epId) return epId
            }
        }
    }

    return ''
}

async function searchEpisodesByApi(api, animeName, episode) {
    const url = buildApiUrl(api, '/api/v2/search/episodes')
    if (!url) return null

    return await req(url, {
        queryParameters: {
            keyword: animeName,
            anime: animeName,
            episode: episode ? String(episode) : '',
        },
    })
}

async function matchByApi(api, queryText, epInfo) {
    const url = buildApiUrl(api, '/api/v2/match')
    if (!url) return null

    const episode = epInfo && epInfo.episode ? String(epInfo.episode) : ''
    const season = epInfo && epInfo.season ? String(epInfo.season) : ''

    const bodyObj = {
        fileName: queryText,
        title: queryText,
        name: queryText,
        keyword: queryText,
        anime: queryText,
        episode: episode,
        season: season,
    }

    try {
        return await req(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyObj),
        })
    } catch (e1) {
        try {
            return await req(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(bodyObj),
            })
        } catch (e2) {
            try {
                return await req(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: bodyObj,
                })
            } catch (e3) {
                return null
            }
        }
    }
}

async function getCommentsByApi(api, episodeId) {
    const locale = typeof kLocale === 'undefined' ? '' : normalizeText(kLocale)
    const isSimplified =
        locale.indexOf('CN') !== -1 ||
        locale.indexOf('Hans') !== -1 ||
        locale.indexOf('zh') !== -1

    const url = buildApiUrl(
        api,
        '/api/v2/comment/' +
            encodeURIComponent(episodeId) +
            '?format=json&withRelated=true&chConvert=' +
            (isSimplified ? '1' : '2')
    )

    if (!url) return null

    return await req(url)
}

async function getCommentsByVideoUrl(api, videoUrl) {
    videoUrl = normalizeText(videoUrl)
    if (!videoUrl) return null

    const url =
        buildApiUrl(api, '/api/v2/comment') +
        '?format=json&url=' +
        encodeURIComponent(videoUrl)

    return await req(url)
}

async function getLines() {
    const apiNames = getApiConfigs('').map(function (x) {
        return x.name
    })

    return formatBackData({
        lines: apiNames,
        error: apiNames.length === 0 ? '请先配置环境变量：精准弹幕API' : '',
    })
}

async function getVideoPlatformList() {
    const data = []
    const apis = getApiConfigs('')

    const first = new DanVideoPlatform()
    first.name = '平台优先'
    first.isLineSwitchSupported = false
    data.push(first)

    for (let i = 0; i < apis.length; i++) {
        const platform = new DanVideoPlatform()
        platform.name = apis[i].name
        platform.isLineSwitchSupported = false
        data.push(platform)
    }

    return formatBackData({
        data: data,
        error: apis.length === 0 ? '请先配置环境变量：精准弹幕API，格式：线路名@https://域名/TOKEN' : '',
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

        if (apis.length === 0) {
            backData.error = '请先配置环境变量：精准弹幕API，格式：线路名@https://域名/TOKEN'
            return formatBackData(backData)
        }

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
                    found = getAnimesFromSearchResult(searchResult)
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

    if (backData.data.length === 0 && !backData.error) {
        backData.error = '未找到匹配视频'
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
        const episodes = ext.episodes || ext.episodeList || []

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
            episode.extData.episodeId = item.episodeId || item.commentId || item.id || ''
            episode.extData.commentId = item.commentId || item.episodeId || item.id || ''
            episode.extData.episodeTitle = friendlyTitle

            backData.data.push(episode)
        }
    } catch (error) {
        backData.error = error.toString()
    }

    if (backData.data.length === 0 && !backData.error) {
        backData.error = '未找到剧集列表'
    }

    return formatBackData(backData)
}

async function searchDanMu(item) {
    const backData = new BackData()
    let lastInfo = ''

    try {
        const epInfo = pickEpisodeInfo(item)
        const titleCandidates = buildTitleCandidates(epInfo)

        if (titleCandidates.length === 0 && !epInfo.videoUrl) {
            backData.error = '缺少标题或播放链接，无法搜索弹幕'
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

    if (apis.length === 0) {
    return {
        list: [],
        info:
            '失败；未读取到环境变量 精准弹幕API。请确认已点击“确定”保存；当前uzTag=' +
            normalizeText(appConfig.uzTag || appConfig._uzTag || '') +
            '；getEnv类型=' +
            (typeof getEnv),
    }
}


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
            if (epInfo.videoUrl) {
                try {
                    const byUrlResult = await getCommentsByVideoUrl(api, epInfo.videoUrl)
                    const byUrlComments = getCommentsFromResult(byUrlResult)
                    const byUrlList = parseDandanPlayComments(byUrlComments)

                    if (byUrlList.length >= minCount) {
                        return {
                            list: byUrlList,
                            info:
                                '成功；平台=' +
                                api.name +
                                '；API=' +
                                api.base +
                                '；方式=videoUrl直取；来源=' +
                                epInfo.source +
                                '；弹幕=' +
                                byUrlList.length,
                        }
                    }

                    if (byUrlList.length > 0) {
                        lastTried =
                            api.name +
                            '@' +
                            api.base +
                            '/videoUrl直取：弹幕数 ' +
                            byUrlList.length +
                            ' 小于阈值 ' +
                            minCount
                    }
                } catch (e0) {
                    errors.push(api.name + '@' + api.base + '/videoUrl直取: ' + e0.toString())
                }
            }

            let episodeId = epInfo.episodeId
            let matchedTitle = titleCandidates[0] || epInfo.clickedTitle || ''

            if (!episodeId && titleCandidates.length > 0) {
                for (let t = 0; t < titleCandidates.length && !episodeId; t++) {
                    const queryText = titleCandidates[t]
                    const matchText =
                        queryText +
                        (epInfo.season ? ' S' + String(epInfo.season) : '') +
                        (epInfo.episode ? ' E' + String(epInfo.episode) : '')

                    const matchResult = await matchByApi(api, matchText, epInfo)
                    const matchedEpisodeId = extractMatchEpisodeId(matchResult)

                    if (matchedEpisodeId) {
                        episodeId = matchedEpisodeId
                        matchedTitle = queryText
                        epInfo._matchedEpisodeTitle = 'match接口'
                        epInfo._matchedScore = 999
                        break
                    }
                }
            }

            if (!episodeId) {
                if (!epInfo.episode) {
                    lastTried =
                        api.name +
                        '@' +
                        api.base +
                        '：未识别集数，且match/videoUrl未获取到弹幕'
                    continue
                }

                let animes = []

                for (let t = 0; t < titleCandidates.length && animes.length === 0; t++) {
                    matchedTitle = titleCandidates[t]

                    const searchResult = await searchEpisodesByApi(api, matchedTitle, epInfo.episode)
                    animes = getAnimesFromSearchResult(searchResult)
                }

                if (animes.length === 0) {
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

                const picked = pickBestEpisodeFromAnimes(animes, epInfo, titleCandidates[0])

                if (!picked || !picked.episodeId) {
                    lastTried =
                        api.name +
                        '@' +
                        api.base +
                        '/' +
                        matchedTitle +
                        '/第' +
                        (epInfo.episode || '') +
                        '集：有搜索结果但未找到精确集数，避免误配'
                    continue
                }

                episodeId = picked.episodeId
                matchedTitle = picked.animeTitle || matchedTitle

                epInfo._matchedEpisodeTitle = picked.episodeTitle || ''
                epInfo._matchedScore = picked.score || 0
            }

            if (!episodeId) {
                lastTried = api.name + '@' + api.base + '/' + matchedTitle + '：无 episodeId/commentId'
                continue
            }

            const danMuResult = await getCommentsByApi(api, episodeId)
            const comments = getCommentsFromResult(danMuResult)
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
                    '；方式=episodeId获取；标题=' +
                    matchedTitle +
                    '；集数=' +
                    (epInfo.episode || '') +
                    '；来源=' +
                    epInfo.source +
                    '；匹配集标题=' +
                    (epInfo._matchedEpisodeTitle || '') +
                    '；匹配分=' +
                    (epInfo._matchedScore || '') +
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

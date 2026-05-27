// ignore
//@name:danmu_api自动匹配
//@version:6
//@remark:huangxd-/danmu_api 自动匹配弹幕，不走 FongMi，适配 matches[0].episodeId 和 comments[].p/m
//@codeID:
//@env:DANMU_API_BASE##danmu_api服务地址，例如 https://xxx.on.aws/你的TOKEN&&DANMU_MAX_COUNT##最大弹幕数量，默认8000
// ignore

var DANMU_API_BASE_DEFAULT = 'https://5m36yzdvtmqcrkubdau5axe5lu0qrizy.lambda-url.ap-northeast-1.on.aws/1105074072'
var DANMU_MAX_COUNT_DEFAULT = 8000

class DanmuApiAutoMatchV6 {
  constructor() {
    this.name = 'danmu_api自动匹配'
  }

  getLines() {
    return JSON.stringify({
      error: '',
      data: [
        {
          name: '自动匹配',
          id: 'auto'
        }
      ]
    })
  }

  getEnvValue(key, def) {
    try {
      if (typeof getEnv === 'function') {
        var v = getEnv(key)
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          return String(v).trim()
        }
      }
    } catch (e) {}

    return def
  }

  getBaseUrl() {
    var base = this.getEnvValue('DANMU_API_BASE', DANMU_API_BASE_DEFAULT)
    base = String(base || '').trim()

    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
      base = base.substring(0, base.length - 1)
    }

    return base
  }

  getMaxCount() {
    var n = parseInt(this.getEnvValue('DANMU_MAX_COUNT', DANMU_MAX_COUNT_DEFAULT), 10)
    if (isNaN(n) || n <= 0) return DANMU_MAX_COUNT_DEFAULT
    return n
  }

  pick(obj, keys, def) {
    if (!obj) return def

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
        return obj[k]
      }
    }

    return def
  }

  getName(req) {
    var name = this.pick(req, [
      'name',
      'title',
      'vod_name',
      'videoName',
      'movieName',
      'showName',
      'danVideo'
    ], '')

    name = String(name || '').trim()
    name = name.replace(/\s*第\s*\d+\s*[集话話]\s*$/g, '')
    name = name.replace(/\s*S\d+\s*E\d+\s*$/ig, '')
    name = name.trim()

    return name
  }

  getEpisode(req) {
    var ep = this.pick(req, [
      'episode',
      'danEpisode',
      'episodeIndex',
      'index',
      'serial',
      'playIndex',
      'number'
    ], '')

    if (ep !== undefined && ep !== null && String(ep).trim() !== '') {
      var m = String(ep).match(/\d+/)
      if (m) return m[0]
    }

    var title = this.pick(req, [
      'subTitle',
      'episodeName',
      'playName',
      'urlName',
      'vod_play_name',
      'line'
    ], '')

    title = String(title || '').trim()

    var patterns = [
      /第\s*(\d+)\s*[集话話]/,
      /S\d+\s*E(\d+)/i,
      /E(\d+)/i,
      /EP\s*(\d+)/i,
      /(\d+)/
    ]

    for (var i = 0; i < patterns.length; i++) {
      var match = title.match(patterns[i])
      if (match) return match[1]
    }

    return '1'
  }

  getSeason(req) {
    var season = this.pick(req, [
      'season',
      'seasonIndex',
      'seasonNumber'
    ], '')

    if (season !== undefined && season !== null && String(season).trim() !== '') {
      var m = String(season).match(/\d+/)
      if (m) return m[0]
    }

    return '1'
  }

  pad2(n) {
    n = parseInt(n || 1, 10)
    if (isNaN(n) || n <= 0) n = 1
    return n < 10 ? '0' + n : String(n)
  }

  normalizeResponse(res) {
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

  parseJson(text) {
    if (!text) return null
    if (typeof text === 'object') return text

    try {
      return JSON.parse(text)
    } catch (e) {
      return null
    }
  }

  async httpGet(url) {
    var opt = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json,text/plain,*/*'
      }
    }

    if (typeof req === 'function') {
      return this.normalizeResponse(await req(url, opt))
    }

    if (typeof request === 'function') {
      return this.normalizeResponse(await request(url, opt))
    }

    if (typeof fetch === 'function') {
      var r = await fetch(url, opt)
      return await r.text()
    }

    throw new Error('当前环境不支持 GET 请求')
  }

  async httpPostJson(url, body) {
    var opt = {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json,text/plain,*/*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }

    if (typeof req === 'function') {
      return this.normalizeResponse(await req(url, opt))
    }

    if (typeof request === 'function') {
      return this.normalizeResponse(await request(url, opt))
    }

    if (typeof fetch === 'function') {
      var r = await fetch(url, opt)
      return await r.text()
    }

    throw new Error('当前环境不支持 POST 请求')
  }

  extractEpisodeId(matchJson) {
    if (!matchJson) return ''

    if (
      matchJson.matches &&
      Object.prototype.toString.call(matchJson.matches) === '[object Array]' &&
      matchJson.matches.length > 0
    ) {
      for (var i = 0; i < matchJson.matches.length; i++) {
        var item = matchJson.matches[i]
        if (!item) continue

        var id =
          item.episodeId ||
          item.commentId ||
          item.episodeID ||
          item.commentID ||
          item.id ||
          item.cid

        if (id !== undefined && id !== null && String(id).trim() !== '') {
          return String(id).trim()
        }
      }
    }

    return ''
  }

  normalizeColor(color) {
    if (color === undefined || color === null || color === '') return '#ffffff'

    if (typeof color === 'number') {
      var h1 = color.toString(16)
      while (h1.length < 6) h1 = '0' + h1
      return '#' + h1.slice(-6)
    }

    color = String(color).trim()

    if (color.indexOf('#') === 0) return color

    if (/^\d+$/.test(color)) {
      var n = parseInt(color, 10)
      var h2 = n.toString(16)
      while (h2.length < 6) h2 = '0' + h2
      return '#' + h2.slice(-6)
    }

    return '#ffffff'
  }

  normalizeType(type) {
    var t = parseInt(type || 1, 10)

    // 1/2/3/6 通常都按滚动处理
    if (t === 4) return 4 // 底部
    if (t === 5) return 5 // 顶部

    return 1 // 滚动
  }

  convertComments(commentJson) {
    var list = []

    if (!commentJson) return list

    var comments = commentJson.comments

    if (!comments || Object.prototype.toString.call(comments) !== '[object Array]') {
      return list
    }

    var maxCount = this.getMaxCount()

    for (var i = 0; i < comments.length; i++) {
      if (list.length >= maxCount) break

      var item = comments[i]
      if (!item) continue

      var text = item.m || item.text || item.content || item.comment || ''
      text = String(text || '').trim()

      if (!text) continue

      var time = 0
      var type = 1
      var color = '#ffffff'

      if (item.p !== undefined && item.p !== null) {
        var parts = String(item.p).split(',')

        if (parts.length > 0) time = parseFloat(parts[0])
        if (parts.length > 1) type = parseInt(parts[1], 10)
        if (parts.length > 2) color = parts[2]
      } else {
        if (item.t !== undefined) time = parseFloat(item.t)
        else if (item.time !== undefined) time = parseFloat(item.time)

        type = item.type || item.mode || 1
        color = item.color || '#ffffff'
      }

      if (isNaN(time)) time = 0

      list.push({
        time: time,
        text: text,
        color: this.normalizeColor(color),
        type: this.normalizeType(type)
      })
    }

    return list
  }

  async searchDanMu(req) {
    try {
      if (!req) req = {}

      var name = this.getName(req)
      var episode = this.getEpisode(req)
      var season = this.getSeason(req)

      if (!name) {
        return JSON.stringify({
          error: '缺少影片名称',
          data: []
        })
      }

      var baseUrl = this.getBaseUrl()

      if (!baseUrl || baseUrl.indexOf('http') !== 0) {
        return JSON.stringify({
          error: '请配置 DANMU_API_BASE',
          data: []
        })
      }

      var keyword = name + ' S' + this.pad2(season) + 'E' + this.pad2(episode)

      var matchBody = {
        fileName: keyword,
        title: name,
        animeTitle: name,
        videoName: keyword,
        episode: parseInt(episode || '1', 10),
        season: parseInt(season || '1', 10)
      }

      var matchUrl = baseUrl + '/api/v2/match'
      var matchText = await this.httpPostJson(matchUrl, matchBody)
      var matchJson = this.parseJson(matchText)

      if (!matchJson) {
        return JSON.stringify({
          error: 'match 接口返回不是 JSON',
          data: []
        })
      }

      if (matchJson.success === false || matchJson.isMatched === false) {
        return JSON.stringify({
          error: matchJson.errorMessage || '自动匹配失败',
          data: []
        })
      }

      var episodeId = this.extractEpisodeId(matchJson)

      if (!episodeId) {
        return JSON.stringify({
          error: '自动匹配成功但未找到 episodeId',
          data: []
        })
      }

      var commentUrl =
        baseUrl +
        '/api/v2/comment/' +
        encodeURIComponent(episodeId) +
        '?format=json&duration=true'

      var commentText = await this.httpGet(commentUrl)
      var commentJson = this.parseJson(commentText)

      if (!commentJson) {
        return JSON.stringify({
          error: 'comment 接口返回不是 JSON',
          data: []
        })
      }

      var danmuList = this.convertComments(commentJson)

      return JSON.stringify({
        error: '',
        data: danmuList
      })
    } catch (e) {
      return JSON.stringify({
        error: e && e.message ? e.message : String(e),
        data: []
      })
    }
  }
}

var danmuApiAutoMatchV6 = new DanmuApiAutoMatchV6()

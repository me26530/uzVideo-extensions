// ignore
//@name:danmu_api自动匹配硬编码
//@version:9
//@remark:huangxd-/danmu_api 自动匹配弹幕，不走 FongMi，硬编码API地址
//@codeID:
//@env:
// ignore

var DANMU_API_BASE = 'https://5m36yzdvtmqcrkubdau5axe5lu0qrizy.lambda-url.ap-northeast-1.on.aws/1105074072'
var DANMU_MAX_COUNT = 8000

class DanmuApiHardCodeV9 {
  constructor() {
    this.name = 'danmu_api自动匹配硬编码'
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

  getBaseUrl() {
    return DANMU_API_BASE
  }

  pick(obj, keys, def) {
    if (!obj) return def

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (
        obj[k] !== undefined &&
        obj[k] !== null &&
        String(obj[k]).trim() !== ''
      ) {
        return obj[k]
      }
    }

    return def
  }

  getName(args) {
    var name = this.pick(args, [
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

  getEpisode(args) {
    var ep = this.pick(args, [
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

    var title = this.pick(args, [
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

  getSeason(args) {
    var season = this.pick(args, [
      'season',
      'seasonIndex',
      'seasonNumber'
    ], '')

    if (season !== undefined && season !== null && String(season).trim() !== '') {
      var m = String(season).match(/\d+/)
      if (m) return m[0]
    }

    var title = this.pick(args, [
      'subTitle',
      'episodeName',
      'playName',
      'urlName',
      'vod_play_name'
    ], '')

    var sm = String(title || '').match(/S(\d+)/i)
    if (sm) return sm[1]

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

    throw new Error('当前环境不支持 GET 请求：没有 req/request/fetch')
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

    throw new Error('当前环境不支持 POST 请求：没有 req/request/fetch')
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

    if (t === 4) return 4
    if (t === 5) return 5

    return 1
  }

  convertComments(commentJson) {
    var list = []

    if (!commentJson) return list

    var comments = commentJson.comments

    if (!comments || Object.prototype.toString.call(comments) !== '[object Array]') {
      return list
    }

    for (var i = 0; i < comments.length; i++) {
      if (list.length >= DANMU_MAX_COUNT) break

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

      /*
       * 同时返回两套字段：
       * 1. time/text/color/type：通用弹幕格式
       * 2. p/m：兼容 danmu_api / 弹弹play 原始格式
       */
      list.push({
        time: time,
        text: text,
        color: this.normalizeColor(color),
        type: this.normalizeType(type),
        p: item.p || (String(time) + ',' + String(type) + ',' + String(color)),
        m: text
      })
    }

    return list
  }

  async searchDanMu(args) {
    try {
      if (!args) args = {}

      var name = this.getName(args)
      var episode = this.getEpisode(args)
      var season = this.getSeason(args)

      if (!name) {
        return JSON.stringify({
          error: '缺少影片名称',
          data: []
        })
      }

      var baseUrl = this.getBaseUrl()

      var keyword = name + ' S' + this.pad2(season) + 'E' + this.pad2(episode)

      var matchBody = {
        fileName: keyword,
        title: name,
        animeTitle: name,
        videoName: keyword,
        episode: parseInt(episode || '1', 10),
        episodeNumber: parseInt(episode || '1', 10),
        season: parseInt(season || '1', 10),
        seasonNumber: parseInt(season || '1', 10)
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

var danmuApiHardCodeV9 = new DanmuApiHardCodeV9()

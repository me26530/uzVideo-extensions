// ignore
//@name:danmu_api自动匹配
//@version:4
//@remark:接入 huangxd-/danmu_api，使用 match 自动匹配，不走 FongMi
//@codeID:
//@env:DANMU_API_BASE##danmu_api服务地址，例如 https://xxx.vercel.app/你的TOKEN
// ignore

var DANMU_API_BASE_DEFAULT = 'https://你的域名/你的TOKEN'

class UzDanmuApiAutoMatch400 {
  constructor() {
    this.name = 'danmu_api自动匹配'
  }

  getLines() {
    return {
      error: '',
      data: [
        {
          name: '自动匹配',
          id: 'auto'
        }
      ]
    }
  }

  getEnv(key, def) {
    try {
      if (typeof getEnv === 'function') {
        var val = getEnv(key)
        if (val && String(val).trim().length > 0) {
          return String(val).trim()
        }
      }
    } catch (e) {}

    return def
  }

  getBaseUrl() {
    var base = this.getEnv('DANMU_API_BASE', DANMU_API_BASE_DEFAULT)
    base = String(base || '').trim()

    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
      base = base.substring(0, base.length - 1)
    }

    return base
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

  getVideoName(req) {
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

    name = name
      .replace(/\s*第\s*\d+\s*[集话話]\s*$/g, '')
      .replace(/\s*S\d+\s*E\d+\s*$/ig, '')
      .trim()

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
      ep = String(ep).trim()
      var m = ep.match(/\d+/)
      if (m) return m[0]
      return ep
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

    var title = this.pick(req, [
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

  pad2(num) {
    num = parseInt(num || 1, 10)
    if (isNaN(num) || num <= 0) num = 1
    return num < 10 ? '0' + num : String(num)
  }

  makeMatchKeyword(name, season, episode) {
    return name + ' S' + this.pad2(season) + 'E' + this.pad2(episode)
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

  parseJson(text) {
    if (!text) return null
    if (typeof text === 'object') return text

    try {
      return JSON.parse(text)
    } catch (e) {
      return null
    }
  }

  isArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]'
  }

  extractCommentId(json) {
    if (!json) return ''

    var arr = []

    function add(o) {
      if (!o) return

      arr.push(o)

      if (o.data) arr.push(o.data)
      if (o.result) arr.push(o.result)
      if (o.match) arr.push(o.match)
      if (o.matched) arr.push(o.matched)
      if (o.anime) arr.push(o.anime)
      if (o.episode) arr.push(o.episode)
      if (o.episodeInfo) arr.push(o.episodeInfo)
      if (o.episodeData) arr.push(o.episodeData)

      if (Object.prototype.toString.call(o.matches) === '[object Array]') {
        for (var i = 0; i < o.matches.length; i++) {
          arr.push(o.matches[i])
        }
      }

      if (Object.prototype.toString.call(o.episodes) === '[object Array]') {
        for (var j = 0; j < o.episodes.length; j++) {
          arr.push(o.episodes[j])
        }
      }
    }

    add(json)

    if (this.isArray(json)) {
      for (var a = 0; a < json.length; a++) add(json[a])
    }

    if (json.data && this.isArray(json.data)) {
      for (var b = 0; b < json.data.length; b++) add(json.data[b])
    }

    if (json.result && this.isArray(json.result)) {
      for (var c = 0; c < json.result.length; c++) add(json.result[c])
    }

    for (var x = 0; x < arr.length; x++) {
      var item = arr[x]
      if (!item) continue

      var id =
        item.commentId ||
        item.commentID ||
        item.episodeId ||
        item.episodeID ||
        item.episode_id ||
        item.cid ||
        item.id

      if (id !== undefined && id !== null && String(id).trim() !== '') {
        return String(id).trim()
      }
    }

    return ''
  }

  findCommentList(json) {
    if (!json) return null

    if (this.isArray(json)) return json

    if (this.isArray(json.comments)) return json.comments
    if (this.isArray(json.comment)) return json.comment
    if (this.isArray(json.data)) return json.data

    if (json.data && this.isArray(json.data.comments)) {
      return json.data.comments
    }

    if (json.result && this.isArray(json.result)) {
      return json.result
    }

    if (json.result && this.isArray(json.result.comments)) {
      return json.result.comments
    }

    return null
  }

  normalizeColor(color) {
    if (color === undefined || color === null || color === '') return '#ffffff'

    if (typeof color === 'number') {
      var hex = color.toString(16)
      while (hex.length < 6) hex = '0' + hex
      return '#' + hex.slice(-6)
    }

    color = String(color).trim()

    if (color.indexOf('#') === 0) return color

    if (/^\d+$/.test(color)) {
      var n = parseInt(color, 10)
      var h = n.toString(16)
      while (h.length < 6) h = '0' + h
      return '#' + h.slice(-6)
    }

    return '#ffffff'
  }

  normalizeMode(mode) {
    var m = parseInt(mode || 1, 10)

    if (m === 5) return 5
    if (m === 4) return 4

    return 1
  }

  convertDanmuList(json) {
    var sourceList = this.findCommentList(json)
    var list = []

    if (!sourceList) return list

    for (var i = 0; i < sourceList.length; i++) {
      var item = sourceList[i]
      if (!item) continue

      var text = item.text || item.m || item.content || item.comment || item.msg || ''
      text = String(text || '').trim()
      if (!text) continue

      var time = 0
      var mode = 1
      var color = '#ffffff'

      /*
       * danmu_api / 弹弹play常见格式：
       * {
       *   p: "12.345,1,25,16777215,...",
       *   m: "弹幕内容"
       * }
       */
      if (item.p !== undefined && item.p !== null) {
        var parts = String(item.p).split(',')

        if (parts.length > 0) time = parseFloat(parts[0])
        if (parts.length > 1) mode = parseInt(parts[1], 10)
        if (parts.length > 3) color = parts[3]
        else if (parts.length > 2) color = parts[2]
      } else {
        if (item.time !== undefined) time = parseFloat(item.time)
        else if (item.progress !== undefined) time = parseFloat(item.progress)
        else if (item.stime !== undefined) time = parseFloat(item.stime)
        else if (item.vpos !== undefined) time = parseFloat(item.vpos)

        mode = item.mode || item.type || item.position || 1
        color = item.color || item.c || '#ffffff'
      }

      if (isNaN(time)) time = 0

      if (time > 10000) {
        time = time / 1000
      }

      list.push({
        time: time,
        text: text,
        color: this.normalizeColor(color),
        type: this.normalizeMode(mode)
      })
    }

    return list
  }

  async searchDanMu(req) {
    try {
      if (!req) req = {}

      var name = this.getVideoName(req)
      var episode = this.getEpisode(req)
      var season = this.getSeason(req)

      if (!name) {
        return {
          error: '缺少影片名称',
          data: []
        }
      }

      var baseUrl = this.getBaseUrl()

      if (!baseUrl || baseUrl.indexOf('http') !== 0) {
        return {
          error: '请配置 DANMU_API_BASE，例如 https://xxx.vercel.app/你的TOKEN',
          data: []
        }
      }

      var keyword = this.makeMatchKeyword(name, season, episode)

      var matchUrl = baseUrl + '/api/v2/match'

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

      var matchText = await this.httpPostJson(matchUrl, matchBody)
      var matchJson = this.parseJson(matchText)

      if (!matchJson) {
        return {
          error: 'match 接口返回不是 JSON',
          data: []
        }
      }

      var directList = this.convertDanmuList(matchJson)

      if (directList && directList.length > 0) {
        return {
          error: '',
          data: directList
        }
      }

      var commentId = this.extractCommentId(matchJson)

      if (!commentId) {
        return {
          error: '自动匹配失败，未获取到 commentId / episodeId',
          data: []
        }
      }

      var commentUrl =
        baseUrl +
        '/api/v2/comment/' +
        encodeURIComponent(commentId) +
        '?format=json&duration=true'

      var commentText = await this.httpGet(commentUrl)
      var commentJson = this.parseJson(commentText)

      if (!commentJson) {
        return {
          error: 'comment 接口返回不是 JSON',
          data: []
        }
      }

      var danmuList = this.convertDanmuList(commentJson)

      return {
        error: '',
        data: danmuList
      }
    } catch (e) {
      return {
        error: e && e.message ? e.message : String(e),
        data: []
      }
    }
  }
}

var uzDanmuApiAutoMatch400 = new UzDanmuApiAutoMatch400()

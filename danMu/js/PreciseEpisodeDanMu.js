// ignore
//@name:danmu_api自动匹配弹幕
//@version:1
//@remark:接入 huangxd-/danmu_api，使用 /api/v2/match 自动匹配，不走 FongMi 接口
//@codeID:
//@env:DANMU_API_BASE##danmu_api服务地址，例如 https://xxx.vercel.app/你的TOKEN
// ignore

var DANMU_API_BASE_DEFAULT = 'https://你的域名/你的TOKEN'

class UzDanmuApiAutoMatch400 {
  constructor() {
    this.name = 'danmu_api自动匹配弹幕'
  }

  getEnv(key, def) {
    try {
      if (typeof getEnv === 'function') {
        var val = getEnv(key)
        if (val && String(val).trim().length > 0) return String(val).trim()
      }
    } catch (e) {}
    return def
  }

  getBaseUrl() {
    var base = this.getEnv('DANMU_API_BASE', DANMU_API_BASE_DEFAULT)
    base = String(base || '').trim()

    while (base.endsWith('/')) {
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
      'showName'
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
      'episodeIndex',
      'index',
      'serial',
      'playIndex',
      'number',
      '集数'
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
      'vod_play_name'
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

  makeMatchKeyword(name, season, episode) {
    var s = parseInt(season || '1', 10)
    var e = parseInt(episode || '1', 10)

    if (isNaN(s) || s <= 0) s = 1
    if (isNaN(e) || e <= 0) e = 1

    var ss = s < 10 ? '0' + s : String(s)
    var ee = e < 10 ? '0' + e : String(e)

    // danmu_api match 接口支持从类似 S01E01 这种命名里提取 title / season / episode
    return name + ' S' + ss + 'E' + ee
  }

  async httpGet(url) {
    if (typeof req === 'function') {
      var r1 = await req(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json,text/plain,*/*'
        }
      })
      return this.normalizeResponse(r1)
    }

    if (typeof request === 'function') {
      var r2 = await request(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json,text/plain,*/*'
        }
      })
      return this.normalizeResponse(r2)
    }

    if (typeof fetch === 'function') {
      var r3 = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json,text/plain,*/*'
        }
      })
      return await r3.text()
    }

    throw new Error('当前环境不支持 GET 请求')
  }

  async httpPostJson(url, body) {
    var bodyText = JSON.stringify(body || {})

    if (typeof req === 'function') {
      var r1 = await req(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json,text/plain,*/*',
          'Content-Type': 'application/json'
        },
        body: bodyText
      })
      return this.normalizeResponse(r1)
    }

    if (typeof request === 'function') {
      var r2 = await request(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json,text/plain,*/*',
          'Content-Type': 'application/json'
        },
        body: bodyText
      })
      return this.normalizeResponse(r2)
    }

    if (typeof fetch === 'function') {
      var r3 = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json,text/plain,*/*',
          'Content-Type': 'application/json'
        },
        body: bodyText
      })
      return await r3.text()
    }

    throw new Error('当前环境不支持 POST 请求')
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

  /**
   * 从 match 返回体里尽可能提取 commentId
   */
  extractCommentId(json) {
    if (!json) return ''

    var candidates = []

    function pushObj(obj) {
      if (!obj) return

      candidates.push(obj)

      if (obj.data) candidates.push(obj.data)
      if (obj.result) candidates.push(obj.result)
      if (obj.match) candidates.push(obj.match)
      if (obj.anime) candidates.push(obj.anime)
      if (obj.episode) candidates.push(obj.episode)
      if (obj.episodeInfo) candidates.push(obj.episodeInfo)
      if (obj.matched) candidates.push(obj.matched)
    }

    pushObj(json)

    if (Array.isArray(json)) {
      for (var i = 0; i < json.length; i++) pushObj(json[i])
    }

    if (json.data && Array.isArray(json.data)) {
      for (var j = 0; j < json.data.length; j++) pushObj(json.data[j])
    }

    if (json.result && Array.isArray(json.result)) {
      for (var k = 0; k < json.result.length; k++) pushObj(json.result[k])
    }

    for (var x = 0; x < candidates.length; x++) {
      var item = candidates[x]
      if (!item) continue

      var id =
        item.commentId ||
        item.commentID ||
        item.episodeId ||
        item.episodeID ||
        item.id ||
        item.cid

      if (id !== undefined && id !== null && String(id).trim() !== '') {
        return String(id).trim()
      }

      if (Array.isArray(item.episodes) && item.episodes.length > 0) {
        for (var e = 0; e < item.episodes.length; e++) {
          var ep = item.episodes[e]
          if (!ep) continue

          var eid =
            ep.commentId ||
            ep.commentID ||
            ep.episodeId ||
            ep.episodeID ||
            ep.id ||
            ep.cid

          if (eid !== undefined && eid !== null && String(eid).trim() !== '') {
            return String(eid).trim()
          }
        }
      }
    }

    return ''
  }

  /**
   * 如果 match 接口直接返回弹幕，则直接提取
   */
  extractDirectComments(json) {
    if (!json) return null

    if (Array.isArray(json.comments)) return json.comments
    if (Array.isArray(json.data)) return json.data
    if (json.data && Array.isArray(json.data.comments)) return json.data.comments
    if (json.result && Array.isArray(json.result.comments)) return json.result.comments
    if (json.comment && Array.isArray(json.comment)) return json.comment

    return null
  }

  convertDanmuList(jsonOrList) {
    var list = []

    if (!jsonOrList) return list

    var sourceList = null

    if (Array.isArray(jsonOrList)) {
      sourceList = jsonOrList
    } else if (Array.isArray(jsonOrList.comments)) {
      sourceList = jsonOrList.comments
    } else if (Array.isArray(jsonOrList.data)) {
      sourceList = jsonOrList.data
    } else if (jsonOrList.data && Array.isArray(jsonOrList.data.comments)) {
      sourceList = jsonOrList.data.comments
    } else if (jsonOrList.result && Array.isArray(jsonOrList.result)) {
      sourceList = jsonOrList.result
    } else if (jsonOrList.result && Array.isArray(jsonOrList.result.comments)) {
      sourceList = jsonOrList.result.comments
    }

    if (!sourceList) return list

    for (var i = 0; i < sourceList.length; i++) {
      var item = sourceList[i]
      if (!item) continue

      var text =
        item.text ||
        item.m ||
        item.content ||
        item.comment ||
        item.msg ||
        ''

      text = String(text || '').trim()
      if (!text) continue

      var time = item.time
      if (time === undefined) time = item.p
      if (time === undefined) time = item.progress
      if (time === undefined) time = item.stime
      if (time === undefined) time = item.vpos
      if (time === undefined) time = 0

      time = parseFloat(time)

      // 兼容毫秒 / 厘秒
      if (time > 10000) {
        time = time / 1000
      }

      var mode = item.mode || item.type || item.position || 1
      var color = item.color || item.c || '#ffffff'
      var size = item.size || item.fontSize || 25

      list.push({
        text: text,
        time: time,
        type: this.normalizeMode(mode),
        color: this.normalizeColor(color),
        fontSize: parseInt(size || 25, 10)
      })
    }

    return list
  }

  /**
   * 自动匹配：
   * 1. POST /api/v2/match
   * 2. 提取 commentId
   * 3. GET /api/v2/comment/:commentId?format=json&duration=true
   */
  async searchDanMu(req) {
    try {
      if (!req) req = {}

      var name = this.getVideoName(req)
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
          error: '请配置 DANMU_API_BASE，例如 https://xxx.vercel.app/你的TOKEN',
          data: []
        })
      }

      var keyword = this.makeMatchKeyword(name, season, episode)

      var matchUrl = baseUrl + '/api/v2/match'

      /**
       * danmu_api 的 match 支持从资源文件名提取 title / season / episode。
       * 这里同时传 fileName、title、episode，尽量兼容不同版本。
       */
      var matchBody = {
        fileName: keyword,
        title: name,
        animeTitle: name,
        episode: parseInt(episode || '1', 10),
        episodeNumber: parseInt(episode || '1', 10),
        season: parseInt(season || '1', 10),
        seasonNumber: parseInt(season || '1', 10),
        videoName: keyword
      }

      var matchText = await this.httpPostJson(matchUrl, matchBody)
      var matchJson = this.parseJson(matchText)

      if (!matchJson) {
        return JSON.stringify({
          error: 'match 接口返回内容不是 JSON',
          data: []
        })
      }

      // 有些实现可能 match 直接返回 comments
      var directComments = this.extractDirectComments(matchJson)
      if (directComments && directComments.length > 0) {
        var directList = this.convertDanmuList(directComments)

        return JSON.stringify({
          error: '',
          data: directList
        })
      }

      var commentId = this.extractCommentId(matchJson)

      if (!commentId) {
        return JSON.stringify({
          error: '自动匹配失败，未获取到 commentId',
          data: [],
          raw: matchJson
        })
      }

      var commentUrl =
        baseUrl +
        '/api/v2/comment/' +
        encodeURIComponent(commentId) +
        '?format=json&duration=true'

      var commentText = await this.httpGet(commentUrl)
      var commentJson = this.parseJson(commentText)

      if (!commentJson) {
        return JSON.stringify({
          error: 'comment 接口返回内容不是 JSON',
          data: []
        })
      }

      var danmuList = this.convertDanmuList(commentJson)

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

var uzDanmuApiAutoMatch400 = new UzDanmuApiAutoMatch400()

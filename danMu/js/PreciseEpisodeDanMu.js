// ignore
//@name:danmu_api自动匹配
//@version:2
//@remark:huangxd-/danmu_api 自动匹配弹幕，不走 FongMi
//@codeID:
//@env:DANMU_API_BASE##danmu_api服务地址，例如 https://xxx.vercel.app/你的TOKEN
// ignore

var DANMU_API_BASE_DEFAULT = 'https://你的域名/你的TOKEN'

function UzDanmuApiAuto() {
  this.name = 'danmu_api自动匹配'
}

UzDanmuApiAuto.prototype.getLines = function () {
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

UzDanmuApiAuto.prototype.getEnvValue = function (key, def) {
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

UzDanmuApiAuto.prototype.getBaseUrl = function () {
  var base = this.getEnvValue('DANMU_API_BASE', DANMU_API_BASE_DEFAULT)
  base = String(base || '').trim()

  while (base.length > 0 && base.charAt(base.length - 1) === '/') {
    base = base.substring(0, base.length - 1)
  }

  return base
}

UzDanmuApiAuto.prototype.pick = function (obj, keys, def) {
  if (!obj) return def

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k]
    }
  }

  return def
}

UzDanmuApiAuto.prototype.getVideoName = function (param) {
  var name = this.pick(param, [
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

UzDanmuApiAuto.prototype.getEpisode = function (param) {
  var ep = this.pick(param, [
    'episode',
    'danEpisode',
    'episodeIndex',
    'index',
    'serial',
    'playIndex',
    'number'
  ], '')

  if (ep !== undefined && ep !== null && String(ep).trim() !== '') {
    var m1 = String(ep).match(/\d+/)
    if (m1) return m1[0]
  }

  var txt = this.pick(param, [
    'subTitle',
    'episodeName',
    'playName',
    'urlName',
    'vod_play_name',
    'line'
  ], '')

  txt = String(txt || '').trim()

  var ps = [
    /第\s*(\d+)\s*[集话話]/,
    /S\d+\s*E(\d+)/i,
    /E(\d+)/i,
    /EP\s*(\d+)/i,
    /(\d+)/
  ]

  for (var i = 0; i < ps.length; i++) {
    var m2 = txt.match(ps[i])
    if (m2) return m2[1]
  }

  return '1'
}

UzDanmuApiAuto.prototype.getSeason = function (param) {
  var season = this.pick(param, [
    'season',
    'seasonIndex',
    'seasonNumber'
  ], '')

  if (season !== undefined && season !== null && String(season).trim() !== '') {
    var m1 = String(season).match(/\d+/)
    if (m1) return m1[0]
  }

  var txt = this.pick(param, [
    'subTitle',
    'episodeName',
    'playName',
    'urlName',
    'vod_play_name'
  ], '')

  var m2 = String(txt || '').match(/S(\d+)/i)
  if (m2) return m2[1]

  return '1'
}

UzDanmuApiAuto.prototype.pad2 = function (num) {
  num = parseInt(num, 10)
  if (isNaN(num) || num < 1) num = 1
  return num < 10 ? '0' + num : String(num)
}

UzDanmuApiAuto.prototype.makeKeyword = function (name, season, episode) {
  return name + ' S' + this.pad2(season) + 'E' + this.pad2(episode)
}

UzDanmuApiAuto.prototype.normalizeResponse = function (res) {
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

UzDanmuApiAuto.prototype.parseJson = function (text) {
  if (!text) return null
  if (typeof text === 'object') return text

  try {
    return JSON.parse(text)
  } catch (e) {
    return null
  }
}

UzDanmuApiAuto.prototype.httpGet = async function (url) {
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

  throw new Error('当前环境没有可用的 GET 请求函数')
}

UzDanmuApiAuto.prototype.httpPostJson = async function (url, body) {
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

  throw new Error('当前环境没有可用的 POST 请求函数')
}

UzDanmuApiAuto.prototype.normalizeColor = function (color) {
  if (color === undefined || color === null || color === '') return '#ffffff'

  if (typeof color === 'number') {
    var h1 = color.toString(16)
    while (h1.length < 6) h1 = '0' + h1
    return '#' + h1.slice(-6)
  }

  color = String(color).trim()

  if (color.charAt(0) === '#') return color

  if (/^\d+$/.test(color)) {
    var n = parseInt(color, 10)
    var h2 = n.toString(16)
    while (h2.length < 6) h2 = '0' + h2
    return '#' + h2.slice(-6)
  }

  return '#ffffff'
}

UzDanmuApiAuto.prototype.normalizeMode = function (mode) {
  var m = parseInt(mode || 1, 10)

  if (m === 5) return 5
  if (m === 4) return 4
  if (m === 6) return 1

  return 1
}

UzDanmuApiAuto.prototype.extractCommentId = function (json) {
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

    if (o.matches && Object.prototype.toString.call(o.matches) === '[object Array]') {
      for (var a = 0; a < o.matches.length; a++) arr.push(o.matches[a])
    }

    if (o.episodes && Object.prototype.toString.call(o.episodes) === '[object Array]') {
      for (var b = 0; b < o.episodes.length; b++) arr.push(o.episodes[b])
    }
  }

  add(json)

  if (Object.prototype.toString.call(json) === '[object Array]') {
    for (var i = 0; i < json.length; i++) add(json[i])
  }

  if (json.data && Object.prototype.toString.call(json.data) === '[object Array]') {
    for (var j = 0; j < json.data.length; j++) add(json.data[j])
  }

  if (json.result && Object.prototype.toString.call(json.result) === '[object Array]') {
    for (var k = 0; k < json.result.length; k++) add(json.result[k])
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
      item.id ||
      item.cid

    if (id !== undefined && id !== null && String(id).trim() !== '') {
      return String(id).trim()
    }
  }

  return ''
}

UzDanmuApiAuto.prototype.findCommentList = function (json) {
  if (!json) return null

  if (Object.prototype.toString.call(json) === '[object Array]') return json
  if (json.comments && Object.prototype.toString.call(json.comments) === '[object Array]') return json.comments
  if (json.comment && Object.prototype.toString.call(json.comment) === '[object Array]') return json.comment
  if (json.data && Object.prototype.toString.call(json.data) === '[object Array]') return json.data
  if (json.data && json.data.comments && Object.prototype.toString.call(json.data.comments) === '[object Array]') return json.data.comments
  if (json.result && Object.prototype.toString.call(json.result) === '[object Array]') return json.result
  if (json.result && json.result.comments && Object.prototype.toString.call(json.result.comments) === '[object Array]') return json.result.comments

  return null
}

UzDanmuApiAuto.prototype.convertDanmuList = function (json) {
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
      弹弹 play / danmu_api 常见格式：
      {
        p: "12.345,1,25,16777215,...",
        m: "弹幕内容"
      }
    */
    if (item.p !== undefined && item.p !== null) {
      var pstr = String(item.p)
      var parts = pstr.split(',')

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

    /*
      兼容毫秒 / 厘秒：
      - 大于 10000 通常是毫秒
      - 1000~10000 有些是厘秒，这里不强制除，避免误判
    */
    if (time > 10000) {
      time = time / 1000
    }

    list.push({
      text: text,
      time: time,
      type: this.normalizeMode(mode),
      color: this.normalizeColor(color),
      fontSize: 25
    })
  }

  return list
}

UzDanmuApiAuto.prototype.searchDanMu = async function (param) {
  try {
    if (!param) param = {}

    var name = this.getVideoName(param)
    var episode = this.getEpisode(param)
    var season = this.getSeason(param)

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

    var keyword = this.makeKeyword(name, season, episode)
    var matchUrl = baseUrl + '/api/v2/match'

    var matchBody = {
      fileName: keyword,
      title: name,
      animeTitle: name,
      videoName: keyword,
      episode: parseInt(episode, 10),
      episodeNumber: parseInt(episode, 10),
      season: parseInt(season, 10),
      seasonNumber: parseInt(season, 10)
    }

    var matchText = await this.httpPostJson(matchUrl, matchBody)
    var matchJson = this.parseJson(matchText)

    if (!matchJson) {
      return JSON.stringify({
        error: 'match 接口返回不是 JSON',
        data: []
      })
    }

    /*
      如果 match 直接返回 comments，直接转换
    */
    var directList = this.convertDanmuList(matchJson)

    if (directList && directList.length > 0) {
      return JSON.stringify({
        error: '',
        data: directList
      })
    }

    var commentId = this.extractCommentId(matchJson)

    if (!commentId) {
      return JSON.stringify({
        error: '自动匹配失败，未获取到 commentId / episodeId',
        data: []
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
        error: 'comment 接口返回不是 JSON',
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

var uzDanmuApiAuto = new UzDanmuApiAuto()

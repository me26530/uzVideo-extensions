// ignore
//@name:danmu_api硬编码ES5
//@version:10
//@remark:danmu_api 自动匹配弹幕，ES5写法，不走FongMi，硬编码API地址
//@codeID:
//@env:
// ignore

var DM_API_BASE_ES5 = 'https://5m36yzdvtmqcrkubdau5axe5lu0qrizy.lambda-url.ap-northeast-1.on.aws/1105074072'
var DM_MAX_COUNT_ES5 = 8000

function dmEs5Trim(s) {
  return String(s || '').replace(/^\s+|\s+$/g, '')
}

function dmEs5IsArray(v) {
  return Object.prototype.toString.call(v) === '[object Array]'
}

function dmEs5Pick(obj, keys, def) {
  if (!obj) return def

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (obj[k] !== undefined && obj[k] !== null && dmEs5Trim(obj[k]) !== '') {
      return obj[k]
    }
  }

  return def
}

function dmEs5GetName(args) {
  var name = dmEs5Pick(args, [
    'name',
    'title',
    'vod_name',
    'videoName',
    'movieName',
    'showName',
    'danVideo'
  ], '')

  name = dmEs5Trim(name)
  name = name.replace(/\s*第\s*\d+\s*[集话話]\s*$/g, '')
  name = name.replace(/\s*S\d+\s*E\d+\s*$/ig, '')
  name = dmEs5Trim(name)

  return name
}

function dmEs5GetEpisode(args) {
  var ep = dmEs5Pick(args, [
    'episode',
    'danEpisode',
    'episodeIndex',
    'index',
    'serial',
    'playIndex',
    'number'
  ], '')

  if (ep !== undefined && ep !== null && dmEs5Trim(ep) !== '') {
    var m1 = String(ep).match(/\d+/)
    if (m1) return m1[0]
  }

  var title = dmEs5Pick(args, [
    'subTitle',
    'episodeName',
    'playName',
    'urlName',
    'vod_play_name',
    'line'
  ], '')

  title = dmEs5Trim(title)

  var patterns = [
    /第\s*(\d+)\s*[集话話]/,
    /S\d+\s*E(\d+)/i,
    /E(\d+)/i,
    /EP\s*(\d+)/i,
    /(\d+)/
  ]

  for (var i = 0; i < patterns.length; i++) {
    var m2 = title.match(patterns[i])
    if (m2) return m2[1]
  }

  return '1'
}

function dmEs5GetSeason(args) {
  var season = dmEs5Pick(args, [
    'season',
    'seasonIndex',
    'seasonNumber'
  ], '')

  if (season !== undefined && season !== null && dmEs5Trim(season) !== '') {
    var m1 = String(season).match(/\d+/)
    if (m1) return m1[0]
  }

  return '1'
}

function dmEs5Pad2(n) {
  n = parseInt(n || 1, 10)
  if (isNaN(n) || n <= 0) n = 1
  return n < 10 ? '0' + n : String(n)
}

function dmEs5ParseJson(text) {
  if (!text) return null
  if (typeof text === 'object') return text

  try {
    return JSON.parse(text)
  } catch (e) {
    return null
  }
}

function dmEs5NormalizeResponse(res) {
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

function dmEs5HttpGet(url) {
  var opt = {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json,text/plain,*/*'
    }
  }

  if (typeof req === 'function') {
    return req(url, opt).then(function (res) {
      return dmEs5NormalizeResponse(res)
    })
  }

  if (typeof request === 'function') {
    return request(url, opt).then(function (res) {
      return dmEs5NormalizeResponse(res)
    })
  }

  if (typeof fetch === 'function') {
    return fetch(url, opt).then(function (res) {
      return res.text()
    })
  }

  return Promise.reject(new Error('当前环境不支持 GET 请求：没有 req/request/fetch'))
}

function dmEs5HttpPostJson(url, body) {
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
    return req(url, opt).then(function (res) {
      return dmEs5NormalizeResponse(res)
    })
  }

  if (typeof request === 'function') {
    return request(url, opt).then(function (res) {
      return dmEs5NormalizeResponse(res)
    })
  }

  if (typeof fetch === 'function') {
    return fetch(url, opt).then(function (res) {
      return res.text()
    })
  }

  return Promise.reject(new Error('当前环境不支持 POST 请求：没有 req/request/fetch'))
}

function dmEs5ExtractEpisodeId(matchJson) {
  if (!matchJson) return ''

  if (matchJson.matches && dmEs5IsArray(matchJson.matches) && matchJson.matches.length > 0) {
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

      if (id !== undefined && id !== null && dmEs5Trim(id) !== '') {
        return dmEs5Trim(id)
      }
    }
  }

  return ''
}

function dmEs5NormalizeColor(color) {
  if (color === undefined || color === null || color === '') return '#ffffff'

  if (typeof color === 'number') {
    var h1 = color.toString(16)
    while (h1.length < 6) h1 = '0' + h1
    return '#' + h1.slice(-6)
  }

  color = dmEs5Trim(color)

  if (color.charAt(0) === '#') return color

  if (/^\d+$/.test(color)) {
    var n = parseInt(color, 10)
    var h2 = n.toString(16)
    while (h2.length < 6) h2 = '0' + h2
    return '#' + h2.slice(-6)
  }

  return '#ffffff'
}

function dmEs5NormalizeType(type) {
  var t = parseInt(type || 1, 10)

  if (t === 4) return 4
  if (t === 5) return 5

  return 1
}

function dmEs5ConvertComments(commentJson) {
  var list = []

  if (!commentJson) return list

  var comments = commentJson.comments

  if (!comments || !dmEs5IsArray(comments)) {
    return list
  }

  for (var i = 0; i < comments.length; i++) {
    if (list.length >= DM_MAX_COUNT_ES5) break

    var item = comments[i]
    if (!item) continue

    var text = item.m || item.text || item.content || item.comment || ''
    text = dmEs5Trim(text)

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
      color: dmEs5NormalizeColor(color),
      type: dmEs5NormalizeType(type),

      // 兼容弹弹play / danmu_api 原始格式
      p: item.p || (String(time) + ',' + String(type) + ',' + String(color)),
      m: text
    })
  }

  return list
}

var danmuApiHardCodeES5 = {
  getLines: function () {
    return JSON.stringify({
      error: '',
      data: [
        {
          name: '自动匹配',
          id: 'auto'
        }
      ]
    })
  },

  searchDanMu: function (args) {
    if (!args) args = {}

    var name = dmEs5GetName(args)
    var episode = dmEs5GetEpisode(args)
    var season = dmEs5GetSeason(args)

    if (!name) {
      return JSON.stringify({
        error: '缺少影片名称',
        data: []
      })
    }

    var keyword = name + ' S' + dmEs5Pad2(season) + 'E' + dmEs5Pad2(episode)

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

    var matchUrl = DM_API_BASE_ES5 + '/api/v2/match'

    return dmEs5HttpPostJson(matchUrl, matchBody).then(function (matchText) {
      var matchJson = dmEs5ParseJson(matchText)

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

      var episodeId = dmEs5ExtractEpisodeId(matchJson)

      if (!episodeId) {
        return JSON.stringify({
          error: '自动匹配成功但未找到 episodeId',
          data: []
        })
      }

      var commentUrl =
        DM_API_BASE_ES5 +
        '/api/v2/comment/' +
        encodeURIComponent(episodeId) +
        '?format=json&duration=true'

      return dmEs5HttpGet(commentUrl).then(function (commentText) {
        var commentJson = dmEs5ParseJson(commentText)

        if (!commentJson) {
          return JSON.stringify({
            error: 'comment 接口返回不是 JSON',
            data: []
          })
        }

        var danmuList = dmEs5ConvertComments(commentJson)

        return JSON.stringify({
          error: '',
          data: danmuList
        })
      })
    }).catch(function (e) {
      return JSON.stringify({
        error: e && e.message ? e.message : String(e),
        data: []
      })
    })
  }
}

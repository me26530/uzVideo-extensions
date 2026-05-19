var danMuJS = {
    getLines: function () {
        return {
            error: '',
            data: [
                {
                    name: '精准匹配-测试',
                    value: 'precise_test'
                }
            ]
        }
    },

    searchDanMu: function (searchParameters) {
        var apiBases = getDanmuApiBases(searchParameters)

        return {
            error: '测试：读取到 API 数量 = ' + apiBases.length + '；API = ' + apiBases.join(' , '),
            data: []
        }
    }
}

function getDanmuApiBases(searchParameters) {
    var value = ''
    var tags = []
    var keys = ['DANMU_API_BASES', 'DANMU_API_BASE']
    var i
    var j

    try {
        if (typeof uzTag !== 'undefined' && uzTag) {
            tags.push(uzTag)
        }
    } catch (e) {}

    try {
        if (searchParameters && searchParameters.uzTag) {
            tags.push(searchParameters.uzTag)
        }
    } catch (e) {}

    tags.push('')

    for (i = 0; i < keys.length; i++) {
        for (j = 0; j < tags.length; j++) {
            try {
                if (typeof getEnv === 'function') {
                    value = getEnv(tags[j], keys[i])
                    if (value) {
                        return parseApiBases(value)
                    }
                }
            } catch (e) {}
        }
    }

    return []
}

function parseApiBases(value) {
    var arr = String(value || '').split(/\|\||\n|,/)
    var result = []
    var i
    var item

    for (i = 0; i < arr.length; i++) {
        item = normalizeApiBase(arr[i])
        if (item) {
            result.push(item)
        }
    }

    return result
}

function normalizeApiBase(base) {
    base = String(base || '').trim()

    if (!base) {
        return ''
    }

    base = base.replace(/\/api\/v2\/?$/i, '')
    base = base.replace(/\/+$/, '')

    return base
}

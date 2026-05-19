// ignore
//@name:精准集数弹幕
//@version:3
//@remark:测试环境变量读取
//@codeID:
//@env:DANMU_API_BASES##弹幕API地址，多个用 || 分隔
//@isAV:0
//@deprecated:0
// ignore

class PreciseEpisodeDanMu {
    async getLines() {
        return {
            error: '',
            data: [
                {
                    name: '精准匹配-测试',
                    value: 'precise_test'
                }
            ]
        }
    }

    async searchDanMu(searchParameters) {
        const apiBases = this.getDanmuApiBases(searchParameters)

        return {
            error: '测试：读取到 API 数量 = ' + apiBases.length + '；API = ' + apiBases.join(' , '),
            data: []
        }
    }

    getDanmuApiBases(searchParameters) {
        const keys = ['DANMU_API_BASES', 'DANMU_API_BASE']
        const tagCandidates = []

        try {
            if (this.uzTag) tagCandidates.push(this.uzTag)
        } catch (e) {}

        try {
            if (searchParameters && searchParameters.uzTag) {
                tagCandidates.push(searchParameters.uzTag)
            }
        } catch (e) {}

        try {
            if (typeof uzTag !== 'undefined' && uzTag) {
                tagCandidates.push(uzTag)
            }
        } catch (e) {}

        tagCandidates.push('')

        for (const key of keys) {
            for (const tag of tagCandidates) {
                try {
                    if (typeof getEnv === 'function') {
                        const value = getEnv(tag, key)
                        if (value) {
                            return this.parseApiBases(value)
                        }
                    }
                } catch (e) {}
            }
        }

        return []
    }

    parseApiBases(value) {
        return String(value || '')
            .split(/\|\||\n|,/)
            .map(x => this.normalizeApiBase(x))
            .filter(Boolean)
    }

    normalizeApiBase(base) {
        base = String(base || '').trim()
        if (!base) return ''

        base = base.replace(/\/api\/v2\/?$/i, '')
        base = base.replace(/\/+$/, '')

        return base
    }
}

var danMuJS = new PreciseEpisodeDanMu()

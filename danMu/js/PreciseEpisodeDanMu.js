var danMuJS = {
    getLines: function () {
        return {
            error: '',
            data: [
                {
                    name: '精准匹配',
                    value: 'precise'
                }
            ]
        };
    },

    searchDanMu: async function (searchParameters) {
        try {
            var apiBases = getDanmuApiBases(searchParameters);

            if (!apiBases || apiBases.length < 1) {
                return {
                    error: '请先配置 DANMU_API_BASES，多个 API 用 || 分隔',
                    data: []
                };
            }

            var title = getTitleFromSearchParameters(searchParameters);

            if (!title) {
                return {
                    error: '无法从参数中获取剧名',
                    data: []
                };
            }

            var resolved = resolveTitleSeasonEpisode(searchParameters, title);

            if (!resolved.ok) {
                return {
                    error: resolved.error,
                    data: []
                };
            }

            var platform = detectPlatform(searchParameters);
            var keywords = buildKeywordList(resolved.title, resolved.season, resolved.episode, platform);
            var i;
            var danmu;

            for (i = 0; i < keywords.length; i++) {
                danmu = await searchByMultiDanmuApi(apiBases, keywords[i]);
                if (danmu && danmu.length > 0) {
                    return {
                        error: '',
                        data: danmu
                    };
                }
            }

            danmu = await callMultiFongmiFallback(apiBases, resolved.title, resolved.episode);

            if (danmu && danmu.length > 0) {
                return {
                    error: '',
                    data: danmu
                };
            }

            return {
                error: '未找到匹配弹幕：' + resolved.title + ' S' + pad2(resolved.season) + 'E' + pad2(resolved.episode),
                data: []
            };
        } catch (e) {
            return {
                error: e && e.message ? e.message : String(e),
                data: []
            };
        }
    },

    getVideoPlatformList: function () {
        return {
            error: '',
            data: [
                {
                    name: '自动匹配',
                    value: 'auto'
                }
            ]
        };
    },

    getVideoList: function () {
        return {
            error: '当前扩展仅支持自动匹配',
            data: []
        };
    },

    getVideoEpisodes: function () {
        return {
            error: '当前扩展仅支持自动匹配',
            data: []
        };
    }
};

function getDanmuApiBases(searchParameters) {
    var value = '';
    var tags = [];
    var keys = ['DANMU_API_BASES', 'DANMU_API_BASE'];
    var i;
    var j;

    try {
        if (typeof uzTag !== 'undefined' && uzTag) {
            tags.push(uzTag);
        }
    } catch (e1) {}

    try {
        if (searchParameters && searchParameters.uzTag) {
            tags.push(searchParameters.uzTag);
        }
    } catch (e2) {}

    tags.push('');

    for (i = 0; i < keys.length; i++) {
        for (j = 0; j < tags.length; j++) {
            try {
                if (typeof getEnv === 'function') {
                    value = getEnv(tags[j], keys[i]);
                    if (value) {
                        return parseApiBases(value);
                    }
                }
            } catch (e3) {}
        }
    }

    return [];
}

function parseApiBases(value) {
    var text = String(value || '');
    var result = [];
    var arr;
    var i;
    var item;

    text = replaceAllText(text, '\r\n', '||');
    text = replaceAllText(text, '\n', '||');
    text = replaceAllText(text, ',', '||');

    arr = text.split('||');

    for (i = 0; i < arr.length; i++) {
        item = normalizeApiBase(arr[i]);
        if (item) {
            result.push(item);
        }
    }

    return uniqueArray(result);
}

function normalizeApiBase(base) {
    base = String(base || '').trim();

    if (!base) {
        return '';
    }

    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
        base = base.substring(0, base.length - 1);
    }

    if (endsWithIgnoreCase(base, '/api/v2')) {
        base = base.substring(0, base.length - 7);
    }

    while (base.length > 0 && base.charAt(base.length - 1) === '/') {
        base = base.substring(0, base.length - 1);
    }

    return base;
}

function getTitleFromSearchParameters(sp) {
    var list = [];
    var i;
    var item;
    var title;

    if (!sp) {
        return '';
    }

    list.push(sp.clickedTitle);
    list.push(sp.videoName);
    list.push(sp.name);
    list.push(sp.title);
    list.push(sp.rawTitle);

    if (sp.danVideo) {
        list.push(sp.danVideo.name);
        list.push(sp.danVideo.title);
    }

    for (i = 0; i < list.length; i++) {
        item = list[i];
        title = cleanVideoTitle(item);

        if (title && !isEpisodeOnly(title)) {
            return String(item || '').trim();
        }
    }

    return '';
}

function resolveTitleSeasonEpisode(sp, rawTitle) {
    var allText = '';
    var season;
    var epResult;
    var cleanTitle;

    allText = joinText([
        rawTitle,
        sp ? sp.name : '',
        sp ? sp.title : '',
        sp ? sp.videoName : '',
        sp ? sp.episodeName : '',
        sp ? sp.videoUrl : '',
        sp ? sp.url : '',
        sp ? sp.playUrl : '',
        sp && sp.danEpisode ? sp.danEpisode.name : '',
        sp && sp.danEpisode ? sp.danEpisode.title : '',
        sp && sp.danEpisode ? sp.danEpisode.url : ''
    ]);

    season = extractSeason(allText);
    epResult = resolveCurrentEpisode(sp);

    if (!epResult.episode) {
        return {
            ok: false,
            error: '无法确认当前集数',
            title: '',
            season: season,
            episode: 0
        };
    }

    cleanTitle = cleanVideoTitle(rawTitle);

    if (!cleanTitle) {
        return {
            ok: false,
            error: '无法确认剧名',
            title: '',
            season: season,
            episode: epResult.episode
        };
    }

    return {
        ok: true,
        error: '',
        title: cleanTitle,
        season: season,
        episode: epResult.episode
    };
}

function resolveCurrentEpisode(sp) {
    var candidates = [];
    var i;
    var ep;
    var list;
    var currentIndex;
    var analyzed;
    var current;
    var inferred;

    if (sp) {
        if (sp.episode) {
            ep = toPositiveInt(sp.episode);
            if (ep) {
                return {
                    episode: ep,
                    source: 'episode'
                };
            }
        }

        if (sp.danEpisode) {
            candidates.push(sp.danEpisode.name);
            candidates.push(sp.danEpisode.title);
            candidates.push(sp.danEpisode.url);
        }

        candidates.push(sp.episodeName);
        candidates.push(sp.videoUrl);
        candidates.push(sp.url);
        candidates.push(sp.playUrl);
        candidates.push(sp.name);
        candidates.push(sp.title);
    }

    for (i = 0; i < candidates.length; i++) {
        ep = extractEpisode(candidates[i]);
        if (ep) {
            return {
                episode: ep,
                source: 'explicit'
            };
        }
    }

    list = sp && sp.episodeList ? sp.episodeList : null;

    if (!list && sp && sp.episodes) {
        list = sp.episodes;
    }

    currentIndex = -1;

    if (sp && typeof sp.currentIndex === 'number') {
        currentIndex = sp.currentIndex;
    }

    if (list && list.length && currentIndex >= 0) {
        analyzed = analyzeEpisodeList(list);
        current = analyzed.parsed[currentIndex];

        if (current && current.episode) {
            return {
                episode: current.episode,
                source: 'list-title'
            };
        }

        inferred = inferEpisodeByIndex(currentIndex, analyzed);

        if (inferred) {
            return {
                episode: inferred,
                source: 'index-infer'
            };
        }
    }

    return {
        episode: null,
        source: 'unknown'
    };
}

function analyzeEpisodeList(episodes) {
    var parsed = [];
    var valid = [];
    var i;
    var ep;
    var title;
    var url;
    var episodeNum;
    var item;
    var inc = 0;
    var dec = 0;
    var order = 'unknown';
    var nums = [];
    var hasMissing = false;

    for (i = 0; i < episodes.length; i++) {
        ep = episodes[i] || {};
        title = ep.name || ep.title || ep.label || '';
        url = ep.url || ep.playUrl || '';

        episodeNum = extractEpisode(title);

        if (!episodeNum) {
            episodeNum = extractEpisode(url);
        }

        item = {
            index: i,
            raw: ep,
            title: title,
            url: url,
            episode: episodeNum,
            isSpecial: isSpecialEpisode(title)
        };

        parsed.push(item);

        if (episodeNum && !item.isSpecial) {
            valid.push(item);
            nums.push(episodeNum);
        }
    }

    if (valid.length >= 2) {
        for (i = 1; i < valid.length; i++) {
            if (valid[i].episode > valid[i - 1].episode) {
                inc++;
            }
            if (valid[i].episode < valid[i - 1].episode) {
                dec++;
            }
        }

        if (inc > dec) {
            order = 'asc';
        } else if (dec > inc) {
            order = 'desc';
        }

        nums = sortNumberArray(nums);

        for (i = 1; i < nums.length; i++) {
            if (nums[i] - nums[i - 1] > 1) {
                hasMissing = true;
                break;
            }
        }
    }

    return {
        order: order,
        hasMissing: hasMissing,
        parsed: parsed,
        valid: valid
    };
}

function inferEpisodeByIndex(currentIndex, analyzed) {
    var valid;
    var first;

    if (!analyzed || analyzed.order === 'unknown') {
        return null;
    }

    if (analyzed.hasMissing) {
        return null;
    }

    valid = analyzed.valid;

    if (!valid || !valid.length) {
        return null;
    }

    first = valid[0].episode;

    if (analyzed.order === 'asc') {
        return first + currentIndex;
    }

    if (analyzed.order === 'desc') {
        return first - currentIndex;
    }

    return null;
}

function buildKeywordList(title, season, episode, platform) {
    var s = pad2(season);
    var e = pad2(episode);
    var list = [];

    if (platform) {
        list.push(title + ' S' + s + 'E' + e + ' @' + platform);
    }

    list.push(title + ' S' + s + 'E' + e);
    list.push(title + '.S' + s + 'E' + e + '.mp4');
    list.push(title + ' 第' + season + '季 第' + episode + '集');
    list.push(title + ' 第' + episode + '集');

    return uniqueArray(list);
}

async function searchByMultiDanmuApi(apiBases, keyword) {
    var i;
    var danmu;

    for (i = 0; i < apiBases.length; i++) {
        try {
            danmu = await searchByDanmuApi(apiBases[i], keyword);
            if (danmu && danmu.length > 0) {
                return danmu;
            }
        } catch (e) {}
    }

    return [];
}

async function searchByDanmuApi(apiBase, keyword) {
    var matched;
    var danmu;

    matched = await callDanmuApiMatch(apiBase, keyword);

    if (!matched || !matched.ok || !matched.commentId) {
        return [];
    }

    danmu = await callDanmuApiComment(apiBase, matched.commentId);

    if (danmu && danmu.length > 0) {
        return danmu;
    }

    return [];
}

async function callDanmuApiMatch(apiBase, keyword) {
    var url = apiBase + '/api/v2/match';
    var bodies = [];
    var i;
    var res;
    var json;
    var commentId;

    bodies.push({
        fileName: keyword,
        fileHash: '',
        fileSize: 0,
        videoDuration: 0,
        matchMode: 'hashAndFileName'
    });

    bodies.push({
        fileName: keyword
    });

    bodies.push({
        keyword: keyword
    });

    for (i = 0; i < bodies.length; i++) {
        try {
            res = await req(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                data: JSON.stringify(bodies[i])
            });

            json = safeJsonParse(res && res.data ? res.data : res);
            commentId = pickCommentIdFromMatch(json);

            if (commentId) {
                return {
                    ok: true,
                    commentId: commentId,
                    raw: json
                };
            }
        } catch (e) {}
    }

    return {
        ok: false,
        commentId: '',
        raw: null
    };
}

async function callDanmuApiComment(apiBase, commentId) {
    var url = apiBase + '/api/v2/comment/' + encodeURIComponent(commentId) + '?format=json&duration=true';
    var res;
    var json;

    res = await req(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });

    json = safeJsonParse(res && res.data ? res.data : res);

    return convertDanmuApiJsonToUz(json);
}

async function callMultiFongmiFallback(apiBases, title, episode) {
    var i;
    var list;

    for (i = 0; i < apiBases.length; i++) {
        try {
            list = await callFongmiFallback(apiBases[i], title, episode);
            if (list && list.length > 0) {
                return list;
            }
        } catch (e) {}
    }

    return [];
}

async function callFongmiFallback(apiBase, title, episode) {
    var urls = [];
    var i;
    var res;
    var json;
    var list;

    urls.push(apiBase + '/api/v2/fongmi/danmaku?name=' + encodeURIComponent(title) + '&episode=' + encodeURIComponent(episode) + '&format=json');
    urls.push(apiBase + '/danmaku/api/v2/fongmi/danmaku?name=' + encodeURIComponent(title) + '&episode=' + encodeURIComponent(episode) + '&format=json');

    for (i = 0; i < urls.length; i++) {
        try {
            res = await req(urls[i], {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            json = safeJsonParse(res && res.data ? res.data : res);
            list = convertDanmuApiJsonToUz(json);

            if (list && list.length > 0) {
                return list;
            }
        } catch (e) {}
    }

    return [];
}

function pickCommentIdFromMatch(json) {
    var m;

    if (!json) {
        return '';
    }

    if (json.data) {
        if (json.data.commentId) {
            return json.data.commentId;
        }

        if (json.data.episodeId) {
            return json.data.episodeId;
        }

        if (json.data.id) {
            return json.data.id;
        }

        if (json.data.matches && json.data.matches.length > 0) {
            m = json.data.matches[0];
            return m.commentId || m.episodeId || m.id || '';
        }

        if (isArray(json.data) && json.data.length > 0) {
            m = json.data[0];
            return m.commentId || m.episodeId || m.id || '';
        }
    }

    if (json.matches && json.matches.length > 0) {
        m = json.matches[0];
        return m.commentId || m.episodeId || m.id || '';
    }

    if (json.match && json.match.length > 0) {
        m = json.match[0];
        return m.commentId || m.episodeId || m.id || '';
    }

    return json.commentId || json.episodeId || json.id || '';
}

function convertDanmuApiJsonToUz(json) {
    var list;
    var result = [];
    var i;
    var item;
    var text;
    var time;
    var color;
    var type;
    var pInfo;

    if (!json) {
        return [];
    }

    if (isArray(json)) {
        list = json;
    } else {
        list = json.comments || json.data || json.danmu || json.danmaku || json.comment || [];
    }

    if (!isArray(list)) {
        return [];
    }

    for (i = 0; i < list.length; i++) {
        item = list[i] || {};

        pInfo = parsePField(item.p);

        text = item.text || item.m || item.message || item.content || item.msg || '';

        if (!text) {
            continue;
        }

        time = item.time;

        if (time === undefined || time === null || time === '') {
            time = item.progress;
        }

        if (time === undefined || time === null || time === '') {
            time = item.position;
        }

        if (time === undefined || time === null || time === '') {
            time = item.vpos;
        }

        if ((time === undefined || time === null || time === '') && pInfo) {
            time = pInfo.time;
        }

        color = item.color || item.c || 16777215;

        if (pInfo && pInfo.color) {
            color = pInfo.color;
        }

        type = item.type || item.mode || item.ct || 1;

        if (pInfo && pInfo.type) {
            type = pInfo.type;
        }

        result.push({
            time: normalizeDanmuTime(time),
            text: String(text),
            color: normalizeColor(color),
            type: normalizeDanmuType(type)
        });
    }

    return result;
}

function parsePField(p) {
    var parts;

    if (!p) {
        return null;
    }

    parts = String(p).split(',');

    if (parts.length < 4) {
        return null;
    }

    return {
        time: parts[0],
        type: parts[1],
        color: parts[3]
    };
}

function normalizeDanmuTime(t) {
    var n = Number(t || 0);

    if (n > 10000) {
        return n / 1000;
    }

    return n;
}

function normalizeColor(color) {
    var n;
    var hex;

    if (typeof color === 'string') {
        if (startsWith(color, '#')) {
            return color;
        }

        n = parseInt(color, 10);

        if (isNaN(n)) {
            return '#ffffff';
        }
    } else {
        n = Number(color || 16777215);
    }

    hex = n.toString(16);

    while (hex.length < 6) {
        hex = '0' + hex;
    }

    if (hex.length > 6) {
        hex = hex.substring(hex.length - 6);
    }

    return '#' + hex;
}

function normalizeDanmuType(type) {
    var n = Number(type || 1);

    if (n === 4) {
        return 4;
    }

    if (n === 5) {
        return 5;
    }

    return 1;
}

function cleanVideoTitle(rawTitle) {
    var title = String(rawTitle || '').trim();

    if (!title) {
        return '';
    }

    title = removeBracketContent(title, '[', ']');
    title = removeBracketContent(title, '【', '】');
    title = removeBracketContent(title, '(', ')');
    title = removeBracketContent(title, '（', '）');

    title = replaceAllText(title, '_', ' ');
    title = replaceAllText(title, '-', ' ');
    title = replaceAllText(title, '.', ' ');

    title = removeQualityWords(title);
    title = removeSeasonEpisodeWords(title);

    title = compactSpaces(title);

    return title;
}

function removeQualityWords(title) {
    var words = [
        '4K',
        '8K',
        '1080P',
        '720P',
        '2160P',
        'HD',
        'BD',
        'WEB-DL',
        'WEBRip',
        'HDR',
        'HEVC',
        'H264',
        'H265',
        'H.264',
        'H.265',
        '国语',
        '国配',
        '粤语',
        '中字',
        '中文字幕',
        '简中',
        '繁中',
        '内嵌',
        '无删减',
        '全集',
        '完结',
        '更新至',
        '更至'
    ];

    var i;

    for (i = 0; i < words.length; i++) {
        title = replaceAllTextIgnoreCase(title, words[i], ' ');
    }

    return title;
}

function removeSeasonEpisodeWords(title) {
    title = removeChineseSeason(title);
    title = removeChineseEpisode(title);
    title = removeSEPatternText(title);
    return title;
}

function removeChineseSeason(title) {
    var start;
    var end;
    var left;
    var right;

    while (true) {
        start = title.indexOf('第');
        if (start < 0) {
            break;
        }

        end = title.indexOf('季', start + 1);

        if (end < 0) {
            break;
        }

        left = title.substring(0, start);
        right = title.substring(end + 1);
        title = left + ' ' + right;
    }

    return title;
}

function removeChineseEpisode(title) {
    var start;
    var end;
    var chars = ['集', '话', '話', '回'];
    var i;
    var foundEnd;
    var left;
    var right;

    while (true) {
        start = title.indexOf('第');
        if (start < 0) {
            break;
        }

        foundEnd = -1;

        for (i = 0; i < chars.length; i++) {
            end = title.indexOf(chars[i], start + 1);
            if (end >= 0 && (foundEnd < 0 || end < foundEnd)) {
                foundEnd = end;
            }
        }

        if (foundEnd < 0) {
            break;
        }

        left = title.substring(0, start);
        right = title.substring(foundEnd + 1);
        title = left + ' ' + right;
    }

    return title;
}

function removeSEPatternText(title) {
    var lower = title.toLowerCase();
    var sIndex;
    var eIndex;
    var endIndex;
    var left;
    var right;

    while (true) {
        lower = title.toLowerCase();
        sIndex = lower.indexOf('s');

        if (sIndex < 0) {
            break;
        }

        if (!isDigit(charAtSafe(lower, sIndex + 1)) && charAtSafe(lower, sIndex + 1) !== ' ') {
            break;
        }

        eIndex = lower.indexOf('e', sIndex + 1);

        if (eIndex < 0) {
            break;
        }

        endIndex = eIndex + 1;

        while (endIndex < title.length && isDigit(charAtSafe(title, endIndex))) {
            endIndex++;
        }

        left = title.substring(0, sIndex);
        right = title.substring(endIndex);
        title = left + ' ' + right;
    }

    return title;
}

function extractSeason(text) {
    var t = String(text || '');
    var n;

    n = extractSeasonByS(t);
    if (n) {
        return n;
    }

    n = extractChineseNumberBetween(t, '第', '季');
    if (n) {
        return n;
    }

    n = extractNumberAfterWordIgnoreCase(t, 'season');
    if (n) {
        return n;
    }

    return 1;
}

function extractEpisode(text) {
    var t = String(text || '');
    var n;

    n = extractEpisodeBySE(t);
    if (n) {
        return n;
    }

    n = extractNumberAfterWordIgnoreCase(t, 'ep');
    if (n) {
        return n;
    }

    n = extractNumberAfterWordIgnoreCase(t, 'e');
    if (n) {
        return n;
    }

    n = extractChineseEpisodeNumber(t);
    if (n) {
        return n;
    }

    n = extractLastSmallNumber(t);
    if (n) {
        return n;
    }

    return null;
}

function extractSeasonByS(text) {
    var lower = String(text || '').toLowerCase();
    var i;
    var ch;
    var num;

    for (i = 0; i < lower.length; i++) {
        ch = lower.charAt(i);

        if (ch === 's') {
            num = readNumberForward(lower, i + 1);
            if (num && num.value > 0 && num.value < 100) {
                return num.value;
            }
        }
    }

    return null;
}

function extractEpisodeBySE(text) {
    var lower = String(text || '').toLowerCase();
    var i;
    var ch;
    var sFound = false;
    var num;

    for (i = 0; i < lower.length; i++) {
        ch = lower.charAt(i);

        if (ch === 's') {
            num = readNumberForward(lower, i + 1);
            if (num) {
                sFound = true;
                i = num.end;
            }
        }

        if (sFound && lower.charAt(i) === 'e') {
            num = readNumberForward(lower, i + 1);
            if (num && num.value > 0 && num.value < 1000) {
                return num.value;
            }
        }
    }

    return null;
}

function extractChineseEpisodeNumber(text) {
    var t = String(text || '');
    var start;
    var end;
    var part;
    var n;
    var chars = ['集', '话', '話', '回'];
    var i;
    var foundEnd;

    start = t.indexOf('第');

    if (start < 0) {
        return null;
    }

    foundEnd = -1;

    for (i = 0; i < chars.length; i++) {
        end = t.indexOf(chars[i], start + 1);
        if (end >= 0 && (foundEnd < 0 || end < foundEnd)) {
            foundEnd = end;
        }
    }

    if (foundEnd < 0) {
        return null;
    }

    part = t.substring(start + 1, foundEnd);
    n = cnNumToInt(part);

    return n;
}

function extractChineseNumberBetween(text, leftMark, rightMark) {
    var t = String(text || '');
    var start = t.indexOf(leftMark);
    var end;
    var part;

    if (start < 0) {
        return null;
    }

    end = t.indexOf(rightMark, start + 1);

    if (end < 0) {
        return null;
    }

    part = t.substring(start + 1, end);

    return cnNumToInt(part);
}

function extractNumberAfterWordIgnoreCase(text, word) {
    var lower = String(text || '').toLowerCase();
    var w = String(word || '').toLowerCase();
    var index = lower.indexOf(w);
    var num;

    if (index < 0) {
        return null;
    }

    num = readNumberForward(lower, index + w.length);

    if (num && num.value > 0) {
        return num.value;
    }

    return null;
}

function extractLastSmallNumber(text) {
    var t = String(text || '');
    var i;
    var nums = [];
    var current = '';

    for (i = 0; i < t.length; i++) {
        if (isDigit(t.charAt(i))) {
            current = current + t.charAt(i);
        } else {
            if (current) {
                nums.push(parseInt(current, 10));
                current = '';
            }
        }
    }

    if (current) {
        nums.push(parseInt(current, 10));
    }

    if (nums.length < 1) {
        return null;
    }

    for (i = nums.length - 1; i >= 0; i--) {
        if (nums[i] > 0 && nums[i] < 1000) {
            return nums[i];
        }
    }

    return null;
}

function readNumberForward(text, startIndex) {
    var i = startIndex;
    var s = '';

    while (i < text.length && text.charAt(i) === ' ') {
        i++;
    }

    while (i < text.length && isDigit(text.charAt(i))) {
        s = s + text.charAt(i);
        i++;
    }

    if (!s) {
        return null;
    }

    return {
        value: parseInt(s, 10),
        end: i
    };
}

function cnNumToInt(str) {
    var s = String(str || '').trim();
    var map;
    var i;
    var ch;
    var num;
    var parts;
    var tens;
    var ones;

    if (!s) {
        return null;
    }

    num = toPositiveInt(s);

    if (num) {
        return num;
    }

    map = {
        '零': 0,
        '〇': 0,
        '一': 1,
        '二': 2,
        '两': 2,
        '三': 3,
        '四': 4,
        '五': 5,
        '六': 6,
        '七': 7,
        '八': 8,
        '九': 9,
        '十': 10
    };

    if (s === '十') {
        return 10;
    }

    if (s.indexOf('十') >= 0) {
        parts = s.split('十');
        tens = parts[0] ? map[parts[0]] : 1;
        ones = parts[1] ? map[parts[1]] : 0;

        if (tens === undefined || ones === undefined) {
            return null;
        }

        return tens * 10 + ones;
    }

    num = 0;

    for (i = 0; i < s.length; i++) {
        ch = s.charAt(i);

        if (map[ch] === undefined) {
            return null;
        }

        num = num * 10 + map[ch];
    }

    return num;
}

function isEpisodeOnly(title) {
    var t = String(title || '').trim();
    var clean = removeChineseEpisode(t);

    clean = compactSpaces(clean);

    if (!clean) {
        return true;
    }

    if (toPositiveInt(clean)) {
        return true;
    }

    return false;
}

function isSpecialEpisode(title) {
    var t = String(title || '');

    if (containsAny(t, ['预告', '花絮', '彩蛋', '特辑', '番外', '先导', '幕后', '加更', '会员版', '纯享', '看点', '速看', '解说', '影评'])) {
        return true;
    }

    return false;
}

function detectPlatform(sp) {
    var text = '';

    if (sp) {
        text = joinText([
            sp.videoUrl,
            sp.url,
            sp.playUrl,
            sp.line,
            sp.videoPlatformName
        ]).toLowerCase();
    }

    if (containsAny(text, ['iqiyi', 'qiyi', '爱奇艺'])) {
        return 'qiyi';
    }

    if (containsAny(text, ['qq.com', 'v.qq', '腾讯'])) {
        return 'qq';
    }

    if (containsAny(text, ['youku', '优酷'])) {
        return 'youku';
    }

    if (containsAny(text, ['mgtv', 'imgo', '芒果'])) {
        return 'imgo';
    }

    if (containsAny(text, ['bilibili', 'b站', '哔哩'])) {
        return 'bilibili1';
    }

    if (containsAny(text, ['migu', '咪咕'])) {
        return 'migu';
    }

    if (containsAny(text, ['sohu', '搜狐'])) {
        return 'sohu';
    }

    if (containsAny(text, ['leshi', '乐视', 'le.com'])) {
        return 'leshi';
    }

    if (containsAny(text, ['xigua', '西瓜'])) {
        return 'xigua';
    }

    return '';
}

function safeJsonParse(text) {
    try {
        if (typeof text === 'object') {
            return text;
        }

        return JSON.parse(String(text || '{}'));
    } catch (e) {
        return null;
    }
}

function pad2(n) {
    n = parseInt(n, 10);

    if (!n || n < 1) {
        return '01';
    }

    if (n < 10) {
        return '0' + n;
    }

    return String(n);
}

function toPositiveInt(value) {
    var n = parseInt(String(value || '').trim(), 10);

    if (isNaN(n) || n < 1) {
        return null;
    }

    return n;
}

function isDigit(ch) {
    return ch >= '0' && ch <= '9';
}

function charAtSafe(text, index) {
    if (index < 0 || index >= text.length) {
        return '';
    }

    return text.charAt(index);
}

function startsWith(text, prefix) {
    text = String(text || '');
    prefix = String(prefix || '');

    return text.indexOf(prefix) === 0;
}

function endsWithIgnoreCase(text, suffix) {
    var a = String(text || '').toLowerCase();
    var b = String(suffix || '').toLowerCase();

    if (b.length > a.length) {
        return false;
    }

    return a.substring(a.length - b.length) === b;
}

function replaceAllText(text, search, replacement) {
    return String(text || '').split(search).join(replacement);
}

function replaceAllTextIgnoreCase(text, search, replacement) {
    var source = String(text || '');
    var lower = source.toLowerCase();
    var target = String(search || '').toLowerCase();
    var index;
    var result = '';
    var last = 0;

    if (!target) {
        return source;
    }

    while (true) {
        index = lower.indexOf(target, last);

        if (index < 0) {
            result = result + source.substring(last);
            break;
        }

        result = result + source.substring(last, index) + replacement;
        last = index + target.length;
    }

    return result;
}

function compactSpaces(text) {
    var s = String(text || '');
    var result = '';
    var i;
    var ch;
    var lastSpace = false;

    for (i = 0; i < s.length; i++) {
        ch = s.charAt(i);

        if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
            if (!lastSpace) {
                result = result + ' ';
                lastSpace = true;
            }
        } else {
            result = result + ch;
            lastSpace = false;
        }
    }

    return result.trim();
}

function removeBracketContent(text, left, right) {
    var s = String(text || '');
    var start;
    var end;

    while (true) {
        start = s.indexOf(left);
        if (start < 0) {
            break;
        }

        end = s.indexOf(right, start + 1);
        if (end < 0) {
            break;
        }

        s = s.substring(0, start) + ' ' + s.substring(end + 1);
    }

    return s;
}

function containsAny(text, words) {
    var i;
    var t = String(text || '');

    for (i = 0; i < words.length; i++) {
        if (t.indexOf(words[i]) >= 0) {
            return true;
        }
    }

    return false;
}

function joinText(arr) {
    var result = '';
    var i;

    for (i = 0; i < arr.length; i++) {
        if (arr[i] !== undefined && arr[i] !== null && String(arr[i]) !== '') {
            if (result) {
                result = result + ' ';
            }

            result = result + String(arr[i]);
        }
    }

    return result;
}

function uniqueArray(arr) {
    var result = [];
    var i;
    var j;
    var exists;
    var value;

    for (i = 0; i < arr.length; i++) {
        value = String(arr[i] || '').trim();

        if (!value) {
            continue;
        }

        exists = false;

        for (j = 0; j < result.length; j++) {
            if (result[j] === value) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            result.push(value);
        }
    }

    return result;
}

function isArray(obj) {
    if (Array.isArray) {
        return Array.isArray(obj);
    }

    return Object.prototype.toString.call(obj) === '[object Array]';
}

function sortNumberArray(arr) {
    var a = [];
    var i;
    var j;
    var tmp;

    for (i = 0; i < arr.length; i++) {
        a.push(arr[i]);
    }

    for (i = 0; i < a.length; i++) {
        for (j = i + 1; j < a.length; j++) {
            if (a[j] < a[i]) {
                tmp = a[i];
                a[i] = a[j];
                a[j] = tmp;
            }
        }
    }

    return a;
}

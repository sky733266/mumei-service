/**
 * 外部免费 API 服务
 * 使用 Node.js 内置 fetch（Node 18+）
 * 无需 API Key 的公开接口
 */
class ExternalAPIService {

  // ============ 工具函数 ============
  static async safeFetch(url, options = {}) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  static ok(data, info) { return { success: true, data, _info: info }; }
  static err(msg) { return { success: false, error: msg }; }

  // ============ 随机名言 ============
  static async randomQuote(category = 'inspirational') {
    try {
      const res = await this.safeFetch('https://api.quotable.io/random?tags=' + category);
      if (res.ok) {
        const q = await res.json();
        return ExternalAPIService.ok({ quote: q.content, author: q.author, tags: q.tags || [] }, 'Quotable API');
      }
    } catch (_) {}
    const fb = [
      { quote: '代码是写给人读的，只是偶尔让机器执行。', author: 'Harold Abelson' },
      { quote: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
      { quote: 'Any fool can write code that a computer can understand.', author: 'Martin Fowler' },
      { quote: '程序员的三大谎言：1. 代码马上好 2. 只是小改动 3. 注释以后补', author: '社区智慧' },
    ];
    return ExternalAPIService.ok(fb[Math.floor(Math.random() * fb.length)], '内置数据');
  }

  // ============ 随机笑话 ============
  static async randomJoke(type = 'Programming') {
    try {
      const res = await this.safeFetch(`https://v2.jokeapi.dev/joke/${type}`);
      if (res.ok) {
        const j = await res.json();
        if (j.type === 'single') return ExternalAPIService.ok({ joke: j.joke }, 'JokeAPI');
        return ExternalAPIService.ok({ setup: j.setup, delivery: j.delivery }, 'JokeAPI');
      }
    } catch (_) {}
    const fb = [
      { joke: '为什么程序员分不清万圣节和圣诞节？因为 Oct 31 = Dec 25。' },
      { joke: '程序员的两大谎言：1. 代码马上好 2. 这个 bug 很简单' },
    ];
    return ExternalAPIService.ok(fb[Math.floor(Math.random() * fb.length)], '内置数据');
  }

  // ============ 随机用户 ============
  static async randomUser() {
    try {
      const res = await this.safeFetch('https://randomuser.me/api/');
      if (res.ok) {
        const r = (await res.json()).results[0];
        return ExternalAPIService.ok({
          name: `${r.name.first} ${r.name.last}`,
          gender: r.gender,
          email: r.email,
          phone: r.phone,
          city: r.location.city,
          country: r.location.country,
          picture: r.picture.large,
          username: r.login.username,
          birthday: r.dob.date,
        }, 'RandomUser API');
      }
    } catch (_) {}
    return ExternalAPIService.err('RandomUser API 暂时不可用');
  }

  // ============ 随机猫图 ============
  static async catImage() {
    try {
      const res = await this.safeFetch('https://api.thecatapi.com/v1/images/search');
      if (res.ok) {
        const d = await res.json();
        return ExternalAPIService.ok({ url: d[0].url, id: d[0].id }, 'TheCatAPI');
      }
    } catch (_) {}
    try {
      const res = await this.safeFetch('https://cataas.com/cat?json=true');
      if (res.ok) {
        const d = await res.json();
        return ExternalAPIService.ok({ url: `https://cataas.com${d.url}`, id: d.id }, 'Cataas API');
      }
    } catch (_) {}
    return ExternalAPIService.ok({ url: 'https://placekitten.com/400/300' }, 'PlaceKitten fallback');
  }

  // ============ 单词释义 ============
  static async wordDefinition(word) {
    if (!word) return ExternalAPIService.err('请提供要查询的单词');
    try {
      const res = await this.safeFetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
      );
      if (res.ok) {
        const entries = await res.json();
        const entry = entries[0];
        const meanings = entry.meanings.map(m => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions.slice(0, 2).map(d => ({
            definition: d.definition,
            example: d.example || null,
          })),
        }));
        return ExternalAPIService.ok({ word: entry.word, phonetic: entry.phonetic || '', meanings }, 'Free Dictionary API');
      }
      return ExternalAPIService.err('未找到该单词');
    } catch (_) {}
    return ExternalAPIService.err('词典 API 暂时不可用');
  }

  // ============ 单词同义词 ============
  static async wordSynonym(word, type = 'rel_trg') {
    if (!word) return ExternalAPIService.err('请提供要查询的单词');
    try {
      const res = await this.safeFetch(
        `https://api.datamuse.com/words?${type}=${encodeURIComponent(word)}&max=20`
      );
      if (res.ok) {
        const words = await res.json();
        if (!words.length) return ExternalAPIService.err('未找到相关词汇');
        return ExternalAPIService.ok({
          word, type,
          words: words.map(w => ({ word: w.word, score: w.score, tags: w.tags || [] })),
        }, 'Datamuse API');
      }
    } catch (_) {}
    return ExternalAPIService.err('Datamuse API 暂时不可用');
  }

  // ============ 彩虹屁 ============
  static async encouragingWord() {
    const words = [
      '你已经很棒了！继续加油 💪',
      '每天进步一点点，就是最大的成功 🌱',
      '代码写不出来？休息一下，灵感就在转角 ✨',
      '你比想象中更强大 🚀',
      'Bug 修不完？那是需求还没改完 😄',
      '愿你今天的代码零警告零报错 🎉',
      '坚持就是胜利，程序员永不放弃 💻',
      '累了就休息，没有人能 24 小时高效运转 🌙',
    ];
    return ExternalAPIService.ok({ content: words[Math.floor(Math.random() * words.length)] }, '内置数据');
  }

  // ============ 历史上的今天（内置数据） ============
  static async todayInHistory() {
    // Wikipedia API 在部分网络环境不可用，使用内置数据
    const now = new Date();
    const events = [
      { text: '今天是个好日子！继续加油', year: now.getFullYear() },
      { text: '坚持coding，终会成为大神 💪', year: now.getFullYear() },
      { text: '愿你今天的代码零警告零报错 🎉', year: now.getFullYear() },
    ];
    return ExternalAPIService.ok({
      date: `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`,
      events,
    }, '内置数据');
  }

  // ============ 新闻头条（RSS） ============
  static async newsHeadlines(category = 'tech') {
    const feeds = {
      tech: 'https://hnrss.org/frontpage',
      general: 'https://rss.todayq.com/topnews/rss.xml',
      china: 'https://rss.todayq.com/china/rss.xml',
    };
    const url = feeds[category] || feeds.tech;
    try {
      const res = await this.safeFetch(url, {
        headers: { 'User-Agent': 'MumeiService/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
      });
      if (res.ok) {
        const text = await res.text();
        const items = [];
        const re = /<item[^>]*>[\s\S]*?<title>(?:<!\[CDATA\[)?([^\]]+?)(?:\]\]>)?<\/title>[\s\S]*?<link>([^\s<]+)[\s\S]*?<\/item>/gi;
        let m;
        while ((m = re.exec(text)) !== null && items.length < 10) {
          items.push({ title: m[1].trim(), link: m[2].trim() });
        }
        if (items.length) return ExternalAPIService.ok({ category, items }, 'RSS Feed');
      }
    } catch (_) {}
    return ExternalAPIService.err(`新闻 RSS (${category}) 暂时不可用`);
  }

  // ============ GitHub Trending ============
  static async githubTrending(language = 'all') {
    try {
      const langParam = language !== 'all' ? `/${encodeURIComponent(language)}` : '';
      const res = await this.safeFetch(
        `https://github.com/trending${langParam}`,
        { headers: { 'User-Agent': 'MumeiService/1.0', 'Accept': 'text/html' } }
      );
      if (res.ok) {
        const text = await res.text();
        const projects = [];
        const re = /<article class="Box-row">[\s\S]*?<h2[^>]*>[\s\S]*?<a href="\/([^"]+)">/gi;
        let m;
        while ((m = re.exec(text)) !== null && projects.length < 20) {
          projects.push({ repo: m[1], name: m[1].split('/').pop() });
        }
        return ExternalAPIService.ok({ language, projects: projects.slice(0, 20) }, 'GitHub Trending');
      }
    } catch (_) {}
    return ExternalAPIService.err('GitHub Trending 暂时不可用');
  }

  // ============ AI 内容检测（启发式） ============
  static async detectAI(text) {
    if (!text || text.length < 50) return ExternalAPIService.err('请提供至少50个字符的文本');
    const words = text.split(/\s+/).filter(Boolean);
    const avgLen = words.reduce((s, w) => s + w.length, 0) / (words.length || 1);
    const uniqueRatio = new Set(text).size / text.length;
    const punctRatio = (text.match(/[。！？，、；：""''【】]/g) || []).length / text.length;
    const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    const hasAI = /作为一种语言模型|作为一个人工智能|我是一个AI|作为一个AI/i.test(text);
    let score = 0;
    if (avgLen > 8) score += 0.2;
    if (uniqueRatio < 0.3) score += 0.3;
    if (punctRatio < 0.02 && text.length > 200) score += 0.2;
    if (emojiCount === 0 && text.length > 300) score += 0.15;
    if (hasAI) score += 0.4;
    score = Math.min(0.95, Math.max(0, score));
    return ExternalAPIService.ok({
      ai_score: Math.round(score * 100) / 100,
      is_ai: score > 0.5,
      analysis: {
        avg_word_length: Math.round(avgLen * 10) / 10,
        unique_char_ratio: Math.round(uniqueRatio * 100) / 100,
        emoji_count: emojiCount,
      },
      note: '免费模式（本地启发式检测），结果仅供参考',
    }, '本地启发式检测');
  }

  // ============ 天气查询（Open-Meteo 免费无需 Key） ============
  static async weather(city = '北京') {
    try {
      const geoRes = await this.safeFetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`
      );
      if (!geoRes.ok) throw new Error('geo failed');
      const geoData = await geoRes.json();
      if (!geoData.results?.length) return ExternalAPIService.err('未找到该城市');
      const { latitude, longitude, name, country } = geoData.results[0];

      const weatherRes = await this.safeFetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=7&language=zh`
      );
      if (!weatherRes.ok) throw new Error('weather failed');
      const w = await weatherRes.json();

      const current = w.current;
      const daily = w.daily;
      const weatherMap = {
        0: '☀️ 晴', 1: '🌤️ 基本晴', 2: '⛅ 多云', 3: '☁️ 阴',
        45: '🌫️ 雾', 48: '🌫️ 雾凇',
        51: '🌦️ 小雨', 53: '🌦️ 中雨', 55: '🌧️ 大雨',
        61: '🌧️ 小雨', 63: '🌧️ 中雨', 65: '🌧️ 大雨',
        71: '🌨️ 小雪', 73: '🌨️ 中雪', 75: '❄️ 大雪',
        80: '🌦️ 阵雨', 81: '🌧️ 中阵雨', 82: '⛈️ 强阵雨',
        95: '⛈️ 雷暴', 96: '⛈️ 雷暴冰雹',
      };

      return ExternalAPIService.ok({
        location: `${name}, ${country}`,
        current: {
          temp: `${current.temperature_2m}°C`,
          feels: `${current.apparent_temperature}°C`,
          humidity: `${current.relative_humidity_2m}%`,
          wind: `${current.wind_speed_10m} km/h`,
          weather: weatherMap[current.weather_code] || '未知',
          precipitation: `${current.precipitation} mm`,
        },
        forecast: daily.time.map((d, i) => ({
          date: d,
          high: `${daily.temperature_2m_max[i]}°C`,
          low: `${daily.temperature_2m_min[i]}°C`,
          rain_prob: `${daily.precipitation_probability_max[i]}%`,
          weather: weatherMap[daily.weather_code[i]] || '未知',
        })),
      }, 'Open-Meteo API (免费，无需 Key)');
    } catch (e) {
      return ExternalAPIService.err('天气服务暂时不可用: ' + e.message);
    }
  }

  // ============ 汇率换算 ============
  static async exchangeRate(from = 'CNY', to = 'USD', amount = 1) {
    try {
      const res = await this.safeFetch(`https://open.er-api.com/v6/latest/${from}`);
      if (!res.ok) throw new Error('exchange failed');
      const data = await res.json();
      if (!data.rates || data.rates[to] === undefined) return ExternalAPIService.err('不支持该货币');
      const rate = data.rates[to];
      return ExternalAPIService.ok({
        from, to, amount,
        rate: rate,
        result: Math.round(amount * rate * 100) / 100,
        updated: data.time_last_update_utc,
      }, 'Open Exchange Rates API');
    } catch (_) {}
    return ExternalAPIService.err('汇率 API 暂时不可用');
  }

  // ============ 邮编查询 ============
  static async zipCode(zip) {
    if (!zip) return ExternalAPIService.err('请提供邮政编码');
    try {
      const res = await this.safeFetch(`https://api.zippopotam.us/cn/${zip}`);
      if (res.ok) {
        const d = await res.json();
        return ExternalAPIService.ok({
          zip,
          country: d['country abbreviation'],
          places: d.places.map(p => ({
            city: p['place name'],
            state: p.state,
            lat: p.latitude,
            lng: p.longitude,
          })),
        }, 'Zippopotam API');
      }
      return ExternalAPIService.err('未找到该邮编');
    } catch (_) {}
    return ExternalAPIService.err('邮编 API 暂时不可用');
  }

  // ============ 配色方案 ============
  static async colorScheme(baseColor = null) {
    if (baseColor) {
      const hex = baseColor.replace('#', '');
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return ExternalAPIService.err('无效的颜色值，请使用十六进制格式如 #FF5500');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const clamp = (x) => Math.max(0, Math.min(255, x));
      const toHex = (x) => clamp(x).toString(16).padStart(2, '0');
      return ExternalAPIService.ok({
        base: baseColor,
        palette: {
          lighter: `#${toHex(r+40)},${toHex(g+40)},${toHex(b+40)}`,
          base: baseColor,
          darker: `#${toHex(r-40)},${toHex(g-40)},${toHex(b-40)}`,
          complementary: `#${toHex(255-r)},${toHex(255-g)},${toHex(255-b)}`,
        },
      }, '本地计算');
    }
    const hue = Math.floor(Math.random() * 360);
    const hslToHex = (h, s, l) => {
      s /= 100; l /= 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };
    return ExternalAPIService.ok({
      scheme: 'analogous',
      colors: [
        { name: 'Primary', value: hslToHex(hue, 70, 50) },
        { name: 'Light', value: hslToHex(hue, 60, 80) },
        { name: 'Dark', value: hslToHex(hue, 70, 30) },
        { name: 'Complementary', value: hslToHex(hue + 180, 70, 50) },
        { name: 'Triadic A', value: hslToHex(hue + 120, 70, 50) },
        { name: 'Triadic B', value: hslToHex(hue + 240, 70, 50) },
      ],
    }, '本地随机生成');
  }

  // ============ UUID v4 ============
  static async uuid(quantity = 1) {
    const count = Math.min(Math.max(1, quantity), 100);
    const uuids = [];
    for (let i = 0; i < count; i++) {
      uuids.push(
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        })
      );
    }
    return ExternalAPIService.ok({ uuids: count === 1 ? uuids[0] : uuids }, 'UUID v4');
  }

  // ============ 时区转换 ============
  static async timezoneConvert(time, fromTz = 'Asia/Shanghai', toTz = 'America/New_York') {
    try {
      const date = new Date(time);
      const fmt = (tz) => new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, dateStyle: 'full', timeStyle: 'medium',
      }).format(date);
      return ExternalAPIService.ok({
        input_time: time,
        from_tz: fromTz,
        to_tz: toTz,
        from_formatted: fmt(fromTz),
        to_formatted: fmt(toTz),
        utc: date.toISOString(),
      }, 'Intl API');
    } catch (_) {}
    return ExternalAPIService.err('时区转换失败');
  }

  // ============ 随机密码 ============
  static async randomPassword(length = 16, options = {}) {
    const {
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
    } = options;
    let chars = '';
    if (uppercase) chars += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    if (lowercase) chars += 'abcdefghjkmnpqrstuvwxyz';
    if (numbers) chars += '23456789';
    if (symbols) chars += '!@#$%^&*';
    if (!chars) chars = 'abcdefghjkmnpqrstuvwxyz';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    const hasSym = /[!@#$%^&*]/.test(password);
    const strength = [hasUpper, hasLower, hasNum, hasSym].filter(Boolean).length;
    return ExternalAPIService.ok({
      password,
      strength: strength === 4 ? '强 💪' : strength >= 2 ? '中 ⚠️' : '弱 ❌',
      strength_score: strength,
      options,
    }, '本地生成');
  }

  // ============ 节假日查询 ============
  static async holidays(country = 'CN', year = null) {
    if (!year) year = new Date().getFullYear();
    try {
      const res = await this.safeFetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
      if (!res.ok) return ExternalAPIService.err('不支持该国家代码或年份');
      const holidays = await res.json();
      return ExternalAPIService.ok({ country, year, holidays }, 'DateNager API');
    } catch (_) {}
    return ExternalAPIService.err('节假日 API 暂时不可用');
  }

  // ============ 国家信息查询 ============
  static async countryInfo(name = '') {
    if (!name) return ExternalAPIService.err('请提供国家名称');
    try {
      // 搜索国家
      const res = await this.safeFetch(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,languages,currencies,region,population,flags,maps`
      );
      if (!res.ok) return ExternalAPIService.err('未找到该国家');
      const countries = await res.json();
      if (!countries.length) return ExternalAPIService.err('未找到该国家');
      const c = countries[0];
      return ExternalAPIService.ok({
        name: c.name.common,
        official: c.name.official,
        capital: c.capital?.[0] || '',
        region: c.region || '',
        population: c.population?.toLocaleString() || '',
        languages: c.languages ? Object.values(c.languages).join(', ') : '',
        currencies: c.currencies ? Object.entries(c.currencies).map(([k, v]) => `${v.name} (${k})`).join(', ') : '',
        flag: c.flags?.svg || c.flags?.png || '',
        map: c.maps?.googleMaps || '',
      }, 'REST Countries API');
    } catch (_) {}
    return ExternalAPIService.err('国家信息 API 暂时不可用');
  }

  // ============ Stack Overflow 搜索 ============
  static async stackOverflow(question = '', tags = '', sort = 'votes') {
    if (!question) return ExternalAPIService.err('请提供搜索关键词');
    const tagParam = tags ? `,${encodeURIComponent(tags)}` : '';
    try {
      const res = await this.safeFetch(
        `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=${sort}&q=${encodeURIComponent(question + tagParam)}&site=stackoverflow&pagesize=10`
      );
      if (!res.ok) return ExternalAPIService.err('搜索失败');
      const data = await res.json();
      if (!data.items?.length) return ExternalAPIService.err('未找到相关问题');
      return ExternalAPIService.ok({
        query: question,
        questions: data.items.map(q => ({
          title: q.title,
          score: q.score,
          answers: q.answer_count,
          tags: q.tags,
          link: q.link,
          is_answered: q.is_answered,
        })),
      }, 'Stack Exchange API');
    } catch (_) {}
    return ExternalAPIService.err('Stack Overflow 搜索暂时不可用');
  }

  // ============ 随机狗图 ============
  static async dogImage() {
    try {
      const res = await this.safeFetch('https://dog.ceo/api/breeds/image/random');
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'success') {
          return ExternalAPIService.ok({ url: d.message, breed: d.message.split('/')[4] || 'Unknown' }, 'Dog CEO API');
        }
      }
    } catch (_) {}
    return ExternalAPIService.ok({ url: 'https://placedog.net/400/300' }, 'PlaceDog fallback');
  }

  // ============ URL Slug 生成 ============
  static async slugify(text = '') {
    if (!text) return ExternalAPIService.err('请提供要转换的文本');
    const slug = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return ExternalAPIService.ok({ original: text, slug }, '本地计算');
  }

  // ============ JSON Schema 生成 ============
  static async jsonSchema(jsonText = '') {
    if (!jsonText) return ExternalAPIService.err('请提供 JSON 文本');
    try {
      const obj = JSON.parse(jsonText);
      const schema = this.generateSchema(obj, 'Root');
      return ExternalAPIService.ok({ original: jsonText, schema: JSON.stringify(schema, null, 2) }, '本地生成');
    } catch (e) {
      return ExternalAPIService.err('JSON 解析失败: ' + e.message);
    }
  }

  static generateSchema(obj, name = 'Root') {
    if (obj === null) return { type: 'null', description: 'null 值' };
    if (typeof obj === 'boolean') return { type: 'boolean' };
    if (typeof obj === 'number') return { type: obj % 1 === 0 ? 'integer' : 'number' };
    if (typeof obj === 'string') return { type: 'string' };
    if (Array.isArray(obj)) {
      const items = obj.length > 0 ? this.generateSchema(obj[0], name + 'Item') : {};
      return { type: 'array', items };
    }
    if (typeof obj === 'object') {
      const properties = {};
      const required = [];
      for (const [k, v] of Object.entries(obj)) {
        properties[k] = this.generateSchema(v, name + this.capitalize(k));
        if (v !== null && v !== undefined) required.push(k);
      }
      return { type: 'object', properties, required };
    }
    return {};
  }

  static capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ============ XML 格式化 ============
  static async xmlFormat(xmlText = '') {
    if (!xmlText) return ExternalAPIService.err('请提供 XML 文本');
    try {
      // 简单格式化：缩进
      let formatted = '';
      let indent = 0;
      const tokens = xmlText.replace(/>\s*</g, '><').split(/(<[^>]+>)/g).filter(Boolean);
      for (const token of tokens) {
        if (token.match(/^<\?/)) {
          formatted += token + '\n';
        } else if (token.match(/^<\//)) {
          indent = Math.max(0, indent - 1);
          formatted += '  '.repeat(indent) + token + '\n';
        } else if (token.match(/^<[^/].*[^>]$/)) {
          formatted += '  '.repeat(indent) + token + '\n';
          if (!token.endsWith('/>')) indent++;
        } else {
          formatted += '  '.repeat(indent) + token + '\n';
        }
      }
      return ExternalAPIService.ok({ original: xmlText, formatted: formatted.trim() }, '本地处理');
    } catch (e) {
      return ExternalAPIService.err('XML 格式化失败: ' + e.message);
    }
  }

  // ============ Cron 描述 ============
  static async cronDescription(expression = '') {
    if (!expression) return ExternalAPIService.err('请提供 Cron 表达式');
    try {
      const cronstrue = require('cronstrue');
      const desc = cronstrue.toString(expression, { locale: 'zh_CN' });
      return ExternalAPIService.ok({ expression, description: desc }, 'cronstrue');
    } catch (e) {
      return ExternalAPIService.err('Cron 表达式无效: ' + e.message);
    }
  }

  // ============ JSON 对比 ============
  static async jsonDiff(json1 = '', json2 = '') {
    if (!json1 || !json2) return ExternalAPIService.err('请提供两个 JSON 文本');
    try {
      const obj1 = JSON.parse(json1);
      const obj2 = JSON.parse(json2);
      const diff = this.deepDiff(obj1, obj2, '', []);
      return ExternalAPIService.ok({ diff: diff.length ? diff : [{ path: '(root)', change: '相同' }] }, '本地计算');
    } catch (e) {
      return ExternalAPIService.err('JSON 解析失败: ' + e.message);
    }
  }

  static deepDiff(obj1, obj2, path = '', results = []) {
    const bothObj = typeof obj1 === 'object' && typeof obj2 === 'object' && obj1 !== null && obj2 !== null;
    if (bothObj && !Array.isArray(obj1) && !Array.isArray(obj2)) {
      const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
      for (const key of allKeys) {
        this.deepDiff(obj1[key], obj2[key], path ? `${path}.${key}` : key, results);
      }
    } else if (JSON.stringify(obj1) !== JSON.stringify(obj2)) {
      results.push({ path: path || '(root)', from: obj1, to: obj2 });
    }
    return results;
  }

  // ============ .gitignore 生成 ============
  static async gitignoreGen(language = 'node') {
    const templates = {
      node: ['node_modules/', '.env', '.env.local', 'dist/', 'build/', 'coverage/', '.npm/', '.eslintcache', '*.log'],
      python: ['__pycache__/', '*.pyc', '*.pyo', '.venv/', 'venv/', 'env/', 'dist/', 'build/', '*.egg-info/', '.env'],
      java: ['target/', '*.class', '.idea/', '*.iml', '.gradle/', 'build/', '*.jar', '*.war'],
      go: ['vendor/', '*.exe', '*.test', '.exe', 'bin/', 'dist/'],
      rust: ['target/', 'debug/', 'release/', '*.rs.bk', '.cargo/'],
      default: ['node_modules/', 'dist/', 'build/', '.env', '*.log', '.DS_Store'],
    };
    const content = (templates[language] || templates.default).join('\n');
    return ExternalAPIService.ok({ language, gitignore: content }, '内置模板');
  }

  // ============ Dockerfile 生成 ============
  static async dockerfileGen(language = 'node') {
    const dockers = {
      node: 'FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]',
      python: 'FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["python", "app.py"]',
      go: 'FROM golang:1.22-alpine\nWORKDIR /app\nCOPY go.mod go.sum ./\nRUN go mod download\nCOPY . .\nRUN go build -o main .\nEXPOSE 8080\nCMD ["./main"]',
      java: 'FROM eclipse-temurin:21-jdk-alpine\nWORKDIR /app\nCOPY pom.xml .\nRUN mvn dependency:go-offline\nCOPY . .\nRUN mvn package -DskipTests\nEXPOSE 8080\nCMD ["java", "-jar", "target/*.jar"]',
    };
    const content = dockers[language] || dockers.node;
    return ExternalAPIService.ok({ language, dockerfile: content }, '内置模板');
  }

  // ============ 图片 Base64 互转 ============
  static async imageBase64(imageUrl = '', direction = 'url-to-base64') {
    if (!imageUrl) return ExternalAPIService.err('请提供图片 URL 或 Base64 文本');
    if (direction === 'url-to-base64') {
      try {
        const res = await this.safeFetch(imageUrl);
        if (!res.ok) return ExternalAPIService.err('图片下载失败');
        const buf = await res.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        const mimeMatch = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
        const mime = mimeMatch ? `image/${mimeMatch[1] === 'jpg' ? 'jpeg' : mimeMatch[1]}` : 'image/png';
        return ExternalAPIService.ok({ base64: `data:${mime};base64,${b64}`, mime, size: buf.byteLength }, '本地计算');
      } catch (e) {
        return ExternalAPIService.err('图片下载失败: ' + e.message);
      }
    } else {
      // base64-to-url: 简单解码返回信息
      try {
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return ExternalAPIService.err('Base64 格式无效，应为 data:image/xxx;base64,xxxx 格式');
        return ExternalAPIService.ok({ mime: match[1], size: Math.round(match[2].length * 0.75) }, '本地计算');
      } catch (e) {
        return ExternalAPIService.err('解析失败: ' + e.message);
      }
    }
  }

  // ============ 哈希验证 ============
  static async hashVerify(text = '', algorithm = 'md5') {
    if (!text) return ExternalAPIService.err('请提供要验证的文本');
    const crypto = require('crypto');
    const hash = crypto.createHash(algorithm).update(text).digest('hex');
    const algorithms = ['md5', 'sha1', 'sha256', 'sha512'];
    const results = {};
    for (const alg of algorithms) {
      results[alg] = crypto.createHash(alg).update(text).digest('hex');
    }
    return ExternalAPIService.ok({ text, algorithms: results }, '本地计算');
  }

  // ============ 时区当前时间 ============
  static async worldTime(tz = 'Asia/Shanghai') {
    try {
      const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, dateStyle: 'full', timeStyle: 'full',
      });
      const now = new Date();
      return ExternalAPIService.ok({
        timezone: tz,
        local: formatter.format(now),
        utc: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
      }, 'Intl API');
    } catch (_) {}
    return ExternalAPIService.err('时区查询失败');
  }

  // ============ 编程语言代码示例 ============
  static async codeExample(language = 'javascript', task = 'hello') {
    const examples = {
      javascript: {
        hello: 'console.log("Hello, World!");',
        fetch: "fetch('/api/data')\n  .then(r => r.json())\n  .then(d => console.log(d));",
        async: 'async function main() {\n  const res = await fetch("/api");\n  const data = await res.json();\n  console.log(data);\n}\nmain();',
      },
      python: {
        hello: 'print("Hello, World!")',
        fetch: 'import requests\n\nresponse = requests.get("/api/data")\ndata = response.json()\nprint(data)',
        async: 'import asyncio\nimport aiohttp\n\nasync def main():\n    async with aiohttp.ClientSession() as s:\n        async with s.get("/api") as r:\n            print(await r.json())\n\nasyncio.run(main())',
      },
      go: {
        hello: 'package main\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
        fetch: 'resp, err := http.Get("/api/data")\ndefer resp.Body.Close()\nbody, _ := io.ReadAll(resp.Body)\nfmt.Println(string(body))',
        async: 'package main\n\nfunc main() {\n    fmt.Println("Use goroutines with sync.WaitGroup")\n}',
      },
    };
    const langs = examples[language];
    if (!langs) return ExternalAPIService.err('不支持该语言，可选: javascript, python, go');
    const code = langs[task] || langs.hello;
    return ExternalAPIService.ok({ language, task, code }, '内置示例');
  }

  // ============ 正则表达式生成 ============
  static async regexGenerate(description = '') {
    if (!description) return ExternalAPIService.err('请提供正则表达式描述');
    // 简单规则映射
    const rules = [
      { desc: /手机|电话/, re: '^1[3-9]\\d{9}$', name: '中国手机号' },
      { desc: /邮箱|邮件|email/, re: '^[\\w.-]+@[\\w.-]+\\.\\w+$', name: '邮箱地址' },
      { desc: /身份证/, re: '^\\d{15}\\d{3}\\d{3}$', name: '身份证号' },
      { desc: /ip地址|IP/, re: '^(\\d{1,3}\\.){3}\\d{1,3}$', name: 'IP地址' },
      { desc: /url|链接|网址/, re: '^https?:\\/\\/[\\w.-]+(:\\d+)?(\\/.*)?$', name: 'URL' },
      { desc: /车牌/, re: '^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-Z0-9]{4,5}[A-Z0-9挂学]$', name: '车牌号' },
    ];
    for (const r of rules) {
      if (r.desc.test(description)) {
        return ExternalAPIService.ok({ description, regex: r.re, name: r.name, note: '基于关键词匹配，结果仅供参考' }, '规则映射');
      }
    }
    return ExternalAPIService.ok({ description, regex: '', note: '暂不支持该描述，请尝试更具体的关键词（手机、邮箱、身份证、IP、URL、车牌）' }, '规则映射');
  }

  // ============ 编程挑战/随机算法题 ============
  static async codingChallenge(language = 'javascript') {
    const challenges = [
      { title: '两数之和', difficulty: '简单', tags: ['数组', '哈希表'], description: '给定一个整数数组 nums 和一个整数目标值 target，返回两数之和的下标。', example: '输入: nums = [2,7,11,15], target = 9\n输出: [0,1]', languages: { javascript: 'function twoSum(nums, target) {\n  const map = {};\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (complement in map) return [map[complement], i];\n    map[nums[i]] = i;\n  }\n}', python: 'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i' }},
      { title: '回文数判断', difficulty: '简单', tags: ['数学'], description: '判断一个整数是否是回文数。', example: '输入: 121\n输出: true', languages: { javascript: 'function isPalindrome(x) {\n  if (x < 0) return false;\n  return x === +x.toString().split("").reverse().join("");\n}', python: 'def is_palindrome(x):\n    return str(x) == str(x)[::-1]' }},
      { title: '合并两个有序数组', difficulty: '中等', tags: ['数组', '双指针'], description: '合并两个有序数组。', example: '输入: nums1=[1,2,3], nums2=[2,5,6]\n输出: [1,2,2,3,5,6]', languages: { javascript: 'function merge(a, b) {\n  return [...a, ...b].sort((x, y) => x - y);\n}', python: 'def merge(a, b):\n    return sorted(a + b)' }},
    ];
    const challenge = challenges[Math.floor(Math.random() * challenges.length)];
    const code = challenge.languages[language] || challenge.languages.javascript;
    return ExternalAPIService.ok({ ...challenge, code, language }, '内置题库');
  }

  // ============ HTTP 状态码解释 ============
  static async httpStatus(code = 200) {
    const statuses = {
      100: { text: 'Continue', zh: '继续，服务器已收到请求头' },
      101: { text: 'Switching Protocols', zh: '切换协议' },
      200: { text: 'OK', zh: '请求成功' },
      201: { text: 'Created', zh: '资源创建成功' },
      204: { text: 'No Content', zh: '请求成功，无返回内容' },
      301: { text: 'Moved Permanently', zh: '永久重定向' },
      302: { text: 'Found', zh: '临时重定向' },
      304: { text: 'Not Modified', zh: '资源未修改，使用缓存' },
      400: { text: 'Bad Request', zh: '请求语法错误或参数错误' },
      401: { text: 'Unauthorized', zh: '未认证，需要登录' },
      403: { text: 'Forbidden', zh: '无权限访问' },
      404: { text: 'Not Found', zh: '资源不存在' },
      405: { text: 'Method Not Allowed', zh: '请求方法不允许' },
      429: { text: 'Too Many Requests', zh: '请求过于频繁，触发限流' },
      500: { text: 'Internal Server Error', zh: '服务器内部错误' },
      502: { text: 'Bad Gateway', zh: '网关错误，上游服务异常' },
      503: { text: 'Service Unavailable', zh: '服务暂时不可用' },
      504: { text: 'Gateway Timeout', zh: '网关超时' },
    };
    const s = statuses[code];
    if (!s) return ExternalAPIService.err(`未知 HTTP 状态码: ${code}`);
    return ExternalAPIService.ok({ code, ...s }, '内置数据库');
  }

  // ============ HTTP 方法解释 ============
  static async httpMethods(method = 'GET') {
    const methods = {
      GET: { desc: '获取资源，安全且幂等', category: '安全方法', example: '/users/123 — 获取 ID 为 123 的用户' },
      POST: { desc: '提交数据创建资源，非幂等', category: '写方法', example: '/users — 创建新用户' },
      PUT: { desc: '完整替换资源，幂等', category: '写方法', example: '/users/123 — 完整更新用户' },
      PATCH: { desc: '部分更新资源，非幂等', category: '写方法', example: '/users/123 — 只更新部分字段' },
      DELETE: { desc: '删除资源，幂等', category: '写方法', example: '/users/123 — 删除用户' },
      HEAD: { desc: '获取响应头，不返回 body', category: '安全方法', example: '/users — 检查资源是否存在' },
      OPTIONS: { desc: '获取支持的 HTTP 方法', category: '安全方法', example: '/users — 查看可用方法' },
    };
    const m = methods[method.toUpperCase()];
    if (!m) return ExternalAPIService.err(`未知 HTTP 方法: ${method}`);
    return ExternalAPIService.ok({ method: method.toUpperCase(), ...m }, '内置数据库');
  }

  // ============ JSON Web Token 解码（已存在，此处增强） ============
  static async jwtDecode(token = '') {
    if (!token) return ExternalAPIService.err('请提供 JWT Token');
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return ExternalAPIService.err('无效的 JWT 格式');
      const decode = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
      const header = decode(parts[0]);
      const payload = decode(parts[1]);
      return ExternalAPIService.ok({
        header,
        payload,
        signature: parts[2],
        isExpired: payload.exp ? Date.now() > payload.exp * 1000 : null,
      }, '本地解码');
    } catch (e) {
      return ExternalAPIService.err('JWT 解析失败: ' + e.message);
    }
  }

  // ============ IP 信息查询 ============
  static async ipInfo(ip = '') {
    try {
      const url = ip
        ? `https://ipinfo.io/${ip}/json`
        : 'https://ipinfo.io/json';
      const res = await this.safeFetch(url);
      if (res.ok) {
        const d = await res.json();
        if (d.error) throw new Error(d.error.message);
        return ExternalAPIService.ok({
          ip: d.ip || ip || 'unknown',
          city: d.city || '',
          region: d.region || '',
          country: d.country || '',
          org: d.org || '',
          timezone: d.timezone || '',
        }, 'IPInfo.io');
      }
    } catch (_) {}
    try {
      // 备用：ip-api.com (仅查询 IP，不支持指定 IP)
      if (!ip) {
        const res = await this.safeFetch('http://ip-api.com/json/?fields=status,country,city,org,timezone,query');
        if (res.ok) {
          const d = await res.json();
          if (d.status === 'fail') throw new Error('ip-api failed');
          return ExternalAPIService.ok({
            ip: d.query || '',
            city: d.city || '',
            country: d.country || '',
            org: d.org || '',
            timezone: d.timezone || '',
          }, 'IP-API.com');
        }
      }
    } catch (_) {}
    return ExternalAPIService.err('IP 查询暂时不可用（可能被网络限制拦截）');
  }

  // ============ 百度语音 API ============

  /**
   * 获取百度 Access Token
   */
  static async getBaiduToken() {
    const apiKey = process.env.BAIDU_API_KEY;
    const secretKey = process.env.BAIDU_SECRET_KEY;
    if (!apiKey || !secretKey) return null;
    
    // 缓存 token（有效期30天，这里提前1小时刷新）
    if (this._baiduToken && this._baiduTokenExpire > Date.now()) {
      return this._baiduToken;
    }
    
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
    const res = await this.safeFetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) {
      this._baiduToken = data.access_token;
      this._baiduTokenExpire = Date.now() + 29 * 24 * 60 * 60 * 1000; // 29天
      return this._baiduToken;
    }
    return null;
  }

  /**
   * 语音合成（TTS）- 将文字转为语音
   * @param {string} text - 要合成的文字（最多1024字节）
   * @param {object} options - 选项
   *   - per: 发音人选择, 0-女声, 1-男声, 3-情感合成-度逍遥, 4-情感合成-度丫丫
   *   - spd: 语速，取值0-15，默认5中语速
   *   - pit: 音调，取值0-15，默认5中音调
   *   - vol: 音量，取值0-15，默认5中音量
   * @returns {object} - { success, data: { audioUrl }, _info }
   */
  static async baiduTTS(text, options = {}) {
    const token = await this.getBaiduToken();
    if (!token) return ExternalAPIService.err('百度语音未配置或获取Token失败');
    
    const { per = 0, spd = 5, pit = 5, vol = 5 } = options;
    const url = `https://tsn.baidu.com/text2audio?tex=${encodeURIComponent(text)}&tok=${token}&cuid=mumei_service&ctp=1&lan=zh&per=${per}&spd=${spd}&pit=${pit}&vol=${vol}`;
    
    const res = await this.safeFetch(url);
    if (!res.ok) return ExternalAPIService.err('百度TTS请求失败');
    
    // 返回音频URL（百度直接返回音频数据，这里返回URL让前端直接播放）
    return ExternalAPIService.ok({ 
      audioUrl: url,
      format: 'mp3',
      text: text.slice(0, 50) + (text.length > 50 ? '...' : '')
    }, '百度语音合成');
  }

  /**
   * 语音识别（ASR）- 将语音转为文字
   * 注意：需要上传音频文件，这里提供API接口，实际使用需要前端上传
   * @param {string} audioBase64 - 音频文件的base64编码
   * @param {string} format - 音频格式：pcm/wav/amr/m4a
   * @param {number} rate - 采样率：16000/8000
   * @returns {object} - { success, data: { text }, _info }
   */
  static async baiduASR(audioBase64, format = 'wav', rate = 16000) {
    const token = await this.getBaiduToken();
    if (!token) return ExternalAPIService.err('百度语音未配置或获取Token失败');
    
    const url = `https://vop.baidu.com/server_api?cuid=mumei_service&token=${token}&dev_pid=1537`; // 1537=普通话(支持简单英文)
    
    const res = await this.safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: format,
        rate: rate,
        channel: 1,
        speech: audioBase64,
        len: Buffer.from(audioBase64, 'base64').length
      })
    });
    
    if (!res.ok) return ExternalAPIService.err('百度ASR请求失败');
    const data = await res.json();
    
    if (data.err_no === 0 && data.result && data.result.length > 0) {
      return ExternalAPIService.ok({ 
        text: data.result.join('\n'),
        confidence: data.result_num || 1
      }, '百度语音识别');
    }
    return ExternalAPIService.err(data.err_msg || '语音识别失败');
  }

  // ============ 高德地图 API ============

  /**
   * 地理编码 - 地址转坐标（多源fallback）
   */
  static async amapGeocode(address, city = '') {
    const key = process.env.AMAP_KEY;
    // 高德（如果配置了有效的 Web 服务 Key）
    if (key && key.length > 10 && !key.includes('xxxxxxxx') && !key.includes('xxxx')) {
      const url = `https://restapi.amap.com/v3/geocode/geo?key=${key}&address=${encodeURIComponent(address)}`;
      try {
        const res = await this.safeFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
            const geo = data.geocodes[0];
            const [lng, lat] = geo.location.split(',');
            return ExternalAPIService.ok({
              longitude: parseFloat(lng),
              latitude: parseFloat(lat),
              formattedAddress: geo.formatted_address || address,
              province: geo.province || '',
              city: geo.city || '',
              district: geo.district || ''
            }, '高德地理编码 ✅');
          }
        }
      } catch (_) {}
    }
    // Fallback 1: BigDataCloud（免费，海外节点，但国内可访问）
    try {
      const q = encodeURIComponent(address + (city ? ' ' + city : ''));
      const res = await this.safeFetch(
        `https://api.bigdatacloud.net/data/geocode-free?text=${q}&language=zh`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          return ExternalAPIService.ok({
            longitude: data.longitude,
            latitude: data.latitude,
            displayName: data.locality || data.city || address,
            country: data.countryName || ''
          }, 'BigDataCloud ✅');
        }
      }
    } catch (_) {}
    // Fallback 2: Google Geocoding（免费，需代理）
    try {
      const q = encodeURIComponent(address);
      const res = await this.safeFetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const r = data.results[0].geometry.location;
          return ExternalAPIService.ok({
            longitude: r.lng,
            latitude: r.lat,
            displayName: data.results[0].formatted_address || address
          }, 'Google Geocoding ✅');
        }
      }
    } catch (_) {}
    return ExternalAPIService.err('地址查询失败，请确认地址格式正确（如：北京市朝阳区望京街道）');
  }

  /**
   * 逆地理编码 - 坐标转地址（多源fallback）
   */
  static async amapRegeocode(longitude, latitude) {
    const key = process.env.AMAP_KEY;
    if (key && key.length > 10 && !key.includes('xxxxxxxx') && !key.includes('xxxx')) {
      const url = `https://restapi.amap.com/v3/geocode/regeo?key=${key}&location=${longitude},${latitude}&extensions=base`;
      try {
        const res = await this.safeFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.status === '1' && data.regeocode) {
            const addr = data.regeocode.addressComponent;
            return ExternalAPIService.ok({
              address: data.regeocode.formatted_address || '',
              province: addr.province || '',
              city: addr.city || '',
              district: addr.district || '',
              township: addr.township || ''
            }, '高德逆地理编码 ✅');
          }
        }
      } catch (_) {}
    }
    // Fallback: BigDataCloud reverse
    try {
      const res = await this.safeFetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-free?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.city) {
          return ExternalAPIService.ok({
            address: [data.locality, data.city, data.countryName].filter(Boolean).join(', '),
            province: data.principalSubdivision || '',
            city: data.city || '',
            district: data.locality || ''
          }, 'BigDataCloud ✅');
        }
      }
    } catch (_) {}
    return ExternalAPIService.err('坐标解析失败，请确认坐标格式正确（经度,纬度）');
  }

  /**
   * POI 搜索 - 搜索周边兴趣点（多源fallback）
   */
  static async amapPOISearch(keywords, location = '', city = '') {
    const key = process.env.AMAP_KEY;
    if (key && key.length > 10 && !key.includes('xxxxxxxx') && !key.includes('xxxx')) {
      let url = `https://restapi.amap.com/v3/place/text?key=${key}&keywords=${encodeURIComponent(keywords)}&offset=10`;
      if (location) url += `&location=${location}`;
      if (city) url += `&city=${encodeURIComponent(city)}`;
      try {
        const res = await this.safeFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.status === '1' && data.pois) {
            const pois = data.pois.map(p => ({
              name: p.name,
              address: p.address || '',
              location: p.location,
              distance: p.distance || '',
              type: p.type || ''
            }));
            return ExternalAPIService.ok({ pois, total: parseInt(data.count) || pois.length }, '高德POI搜索 ✅');
          }
        }
      } catch (_) {}
    }
    // Fallback: Overpass API (OpenStreetMap)
    try {
      // Overpass需要构造OSM查询，这里用简单方式搜索
      const q = encodeURIComponent(keywords + (city ? ' ' + city : ''));
      // 用 Foursquare / Wikidata 备用
      const res = await this.safeFetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=10&accept-language=zh`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const pois = data.slice(0, 8).map(p => ({
            name: p.display_name ? p.display_name.split(',')[0] : '',
            address: p.display_name || '',
            location: (p.lon || '') + ',' + (p.lat || ''),
            type: p.type || ''
          }));
          return ExternalAPIService.ok({ pois, total: pois.length }, 'OpenStreetMap (Nominatim)');
        }
      }
    } catch (_) {}
    // Fallback 2: 使用已有地理编码获取坐标后搜周边
    if (city || keywords) {
      try {
        const geo = await this.amapGeocode(city || keywords, '');
        if (geo.success) {
          // 搜索附近
          const res2 = await this.safeFetch(
            `https://api.bigdatacloud.net/data/locality-search?text=${encodeURIComponent(keywords)}&latitude=${geo.data.latitude}&longitude=${geo.data.longitude}`
          );
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2 && Array.isArray(data2) && data2.length > 0) {
              const pois = data2.slice(0, 8).map(p => ({
                name: p.name || p.locality || '',
                address: p.administrative?.[0] || '',
                location: (p.longitude || '') + ',' + (p.latitude || ''),
                type: p.localityType || ''
              }));
              return ExternalAPIService.ok({ pois, total: pois.length }, 'BigDataCloud POI ✅');
            }
          }
        }
      } catch (_) {}
    }
    return ExternalAPIService.err('未搜索到相关地点，请尝试更通用的关键词');
  }

  /**
   * 路径规划 - 步行/驾车路线
   * @param {string} origin - 起点坐标 "lng,lat"
   * @param {string} destination - 终点坐标 "lng,lat"
   * @param {string} type - 类型：walking/driving/transit
   * @returns {object} - { success, data: { distance, duration, summary, steps }, _info }
   */
  static async amapRoute(origin, destination, type = 'driving') {
    const key = process.env.AMAP_KEY;
    const apiType = type === 'walking' ? 'walking' : 'driving';

    // 优先：高德 Web 服务 API
    if (key) {
      const url = `https://restapi.amap.com/v3/direction/${apiType}?key=${key}&origin=${origin}&destination=${destination}&extensions=base`;
      try {
        const res = await this.safeFetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.status === '1' && data.route && data.route.paths && data.route.paths.length > 0) {
            const path = data.route.paths[0];
            const durationSec = parseInt(path.duration) || 0;
            const distanceM = parseInt(path.distance) || 0;
            const durationMin = Math.round(durationSec / 60);
            const steps = (path.steps || []).slice(0, 5).map(s => ({
              instruction: s.instruction || '',
              road: Array.isArray(s.road) ? s.road[0] : (s.road || ''),
              distance: parseInt(s.distance) || 0
            }));
            return ExternalAPIService.ok({
              distance: distanceM,
              distanceText: distanceM >= 1000 ? (distanceM / 1000).toFixed(1) + ' km' : distanceM + ' m',
              duration: durationSec,
              durationText: durationMin >= 60 ? Math.floor(durationMin / 60) + '小时' + (durationMin % 60) + '分钟' : durationMin + '分钟',
              strategy: path.strategy || '',
              tolls: parseInt(path.tolls) || 0,
              steps: steps
            }, '高德路径规划 ✅');
          }
        }
      } catch (_) {}
    }

    // Fallback: OSRM
    try {
      const osrmType = type === 'walking' ? 'foot' : 'car';
      const res = await this.safeFetch(
        `https://router.project-osrm.org/route/v1/${osrmType}/${origin};${destination}?overview=true&steps=true`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const durationSec = Math.round(route.duration);
          const distanceM = Math.round(route.distance);
          const durationMin = Math.round(durationSec / 60);
          return ExternalAPIService.ok({
            distance: distanceM,
            distanceText: distanceM >= 1000 ? (distanceM / 1000).toFixed(1) + ' km' : distanceM + ' m',
            duration: durationSec,
            durationText: durationMin >= 60 ? Math.floor(durationMin / 60) + '小时' + (durationMin % 60) + '分钟' : durationMin + '分钟'
          }, 'OSRM (Open Source Routing Machine)');
        }
      }
    } catch (_) {}

    return ExternalAPIService.err('路径规划失败，请检查坐标格式（经度,纬度）');
  }

  /**
   * 天气查询 - 高德天气API
   * @param {string} city - 城市名称或adcode
   * @returns {object} - { success, data: { weather, temperature, ... }, _info }
   */
  static async amapWeather(city) {
    const key = process.env.AMAP_KEY;
    if (!key) return ExternalAPIService.err('高德地图未配置');
    
    const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&city=${encodeURIComponent(city)}&extensions=all`;
    
    const res = await this.safeFetch(url);
    if (!res.ok) return ExternalAPIService.err('高德API请求失败');
    const data = await res.json();
    
    if (data.status === '1' && data.forecasts && data.forecasts.length > 0) {
      const forecast = data.forecasts[0];
      const today = forecast.casts && forecast.casts[0];
      return ExternalAPIService.ok({
        city: forecast.city,
        province: forecast.province || '',
        today: today ? {
          date: today.date,
          week: today.week,
          dayWeather: today.dayweather,
          nightWeather: today.nightweather,
          dayTemp: today.daytemp,
          nightTemp: today.nighttemp,
          dayWind: today.daywind,
          nightWind: today.nightwind
        } : null,
        forecasts: (forecast.casts || []).slice(1, 4).map(c => ({
          date: c.date,
          dayWeather: c.dayweather,
          nightWeather: c.nightweather,
          dayTemp: c.daytemp,
          nightTemp: c.nighttemp
        }))
      }, '高德天气预报');
    }
    return ExternalAPIService.err('天气查询失败');
  }

  /**
   * IP定位 - 根据IP获取位置
   * @param {string} ip - IP地址（可选，不传则定位当前IP）
   * @returns {object} - { success, data: { province, city, rectangle }, _info }
   */
  static async amapIPLocation(ip = '') {
    const key = process.env.AMAP_KEY;
    if (!key) return ExternalAPIService.err('高德地图未配置');
    
    let url = `https://restapi.amap.com/v3/ip?key=${key}`;
    if (ip) url += `&ip=${ip}`;
    
    const res = await this.safeFetch(url);
    if (!res.ok) return ExternalAPIService.err('高德API请求失败');
    const data = await res.json();
    
    if (data.status === '1') {
      return ExternalAPIService.ok({
        province: data.province || '',
        city: data.city || '',
        rectangle: data.rectangle || '',
        adcode: data.adcode || ''
      }, '高德IP定位');
    }
    return ExternalAPIService.err('IP定位失败');
  }
  // ============ Prettier 代码美化 ============
  static async codeBeautify(code, language = 'javascript') {
    try {
      const prettier = require('prettier');
      const langMap = {js:'babel',javascript:'babel',ts:'typescript',typescript:'typescript',python:'python',py:'python',html:'html',css:'css',json:'json',markdown:'markdown',md:'markdown',sql:'sql',yaml:'yaml',yml:'yaml',xml:'xml'};
      const parser = langMap[language.toLowerCase()] || 'babel';
      const formatted = await prettier.format(code, {parser, semi:false, singleQuote:true, tabWidth:2, printWidth:100});
      return ExternalAPIService.ok({formatted, language, lineCount: formatted.split('\n').length}, 'Prettier 代码美化');
    } catch (e) {
      return ExternalAPIService.err('代码格式化失败：'+e.message);
    }
  }

  // ============ QR码生成 ============
  static async qrCodeGenerate(text, options = {}) {
    try {
      const QRCode = require('qrcode');
      const {size=300, format='png', dark='000000', light='ffffff'} = options;
      const opts = {width:size, color:{dark,light}, margin:2};
      const dataUrl = await QRCode.toDataURL(text, opts);
      return ExternalAPIService.ok({dataUrl, text, size, format:'png'}, 'QRCode 生成');
    } catch (e) {
      return ExternalAPIService.err('二维码生成失败：'+e.message);
    }
  }

  // ============ PDF 生成 ============
  static async pdfGenerate(options = {}) {
    try {
      const {PDFDocument, StandardFonts} = require('pdf-lib');
      const {title='', content='', author='沐美服务'} = options;
      const doc = await PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const {width, height} = page.getSize();
      let y = height - 72;
      if (title) {
        page.drawText(title, {x:50, y, size:18, font:bold, color:{r:0.1,g:0.1,b:0.4}});
        y -= 30;
      }
      if (content) {
        const lines = wrapText(content, 80);
        for (const line of lines) {
          if (y < 72) { const np = doc.addPage([595.28, 841.89]); y = np.getSize().height - 72; }
          page.drawText(line, {x:50, y, size:11, font});
          y -= 18;
        }
      }
      const pdfBytes = await doc.save();
      return ExternalAPIService.ok({pdfBase64:Buffer.from(pdfBytes).toString('base64'), title, pageCount:doc.getPageCount()}, 'PDF 生成');
    } catch (e) {
      return ExternalAPIService.err('PDF生成失败：'+e.message);
    }
  }

  // ============ PDF 合并 ============
  static async pdfMerge(pdfBases = []) {
    try {
      const {PDFDocument} = require('pdf-lib');
      if (!pdfBases || pdfBases.length < 2) return ExternalAPIService.err('至少需要2个PDF文件');
      const merged = await PDFDocument.create();
      for (const b64 of pdfBases) {
        const pdf = await PDFDocument.load(Buffer.from(b64,'base64'));
        const pages = await merged.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      return ExternalAPIService.ok({pdfBase64:Buffer.from(await merged.save()).toString('base64'), totalPages:merged.getPageCount(), count:pdfBases.length}, 'PDF 合并');
    } catch (e) {
      return ExternalAPIService.err('PDF合并失败：'+e.message);
    }
  }

  // ============ PDF 分割 ============
  static async pdfSplit(pdfBase64, pageRange = '1') {
    try {
      const {PDFDocument} = require('pdf-lib');
      const pdf = await PDFDocument.load(Buffer.from(pdfBase64,'base64'));
      const total = pdf.getPageCount();
      const pages = pageRange.split(',').flatMap(s => {
        if (s.includes('-')) { const [a,b] = s.split('-').map(Number); return Array.from({length:b-a+1},(_,i)=>a+i-1); }
        return [parseInt(s)-1];
      }).filter(i => i >= 0 && i < total);
      const merged = await PDFDocument.create();
      for (const idx of pages) { const [p] = await merged.copyPages(pdf,[idx]); merged.addPage(p); }
      return ExternalAPIService.ok({pdfBase64:Buffer.from(await merged.save()).toString('base64'), extractedPages:pages.length, totalPages:total}, 'PDF 分割');
    } catch (e) {
      return ExternalAPIService.err('PDF分割失败：'+e.message);
    }
  }

  // ============ PDF 加水印 ============
  static async pdfWatermark(pdfBase64, watermarkText = '沐美服务', options = {}) {
    try {
      const {PDFDocument, StandardFonts} = require('pdf-lib');
      const {opacity=0.2, fontSize=48, angle=-45} = options;
      const pdf = await PDFDocument.load(Buffer.from(pdfBase64,'base64'));
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      for (const page of pdf.getPages()) {
        const {width, height} = page.getSize();
        page.drawText(watermarkText, {x:width/4, y:height/2, size:fontSize, font, opacity, angle:(angle*Math.PI)/180, color:{r:0.5,g:0.5,b:0.5}});
      }
      return ExternalAPIService.ok({pdfBase64:Buffer.from(await pdf.save()).toString('base64'), watermarkText, pageCount:pdf.getPageCount()}, 'PDF 水印');
    } catch (e) {
      return ExternalAPIService.err('PDF水印失败：'+e.message);
    }
  }

  // ============ 图片压缩（Sharp）===========
  static async imageCompress(imageUrl, options = {}) {
    try {
      const {quality=80, format='jpeg'} = options;
      const sharpLib = require('sharp');
      let buffer;
      if (imageUrl.startsWith('http')) {
        const res = await this.safeFetch(imageUrl);
        if (!res.ok) return ExternalAPIService.err('图片获取失败');
        buffer = Buffer.from(await res.arrayBuffer());
      } else {
        buffer = Buffer.from(imageUrl,'base64');
      }
      let img = sharpLib(buffer);
      if (format === 'png') img = img.png({compressionLevel:9});
      else img = img.jpeg({quality});
      const output = await img.toBuffer();
      const ratio = ((buffer.length - output.length)/buffer.length*100).toFixed(1);
      return ExternalAPIService.ok({imageBase64:output.toString('base64'), originalSize:buffer.length, newSize:output.length, savedPercent:ratio+'%', format}, 'Sharp 图片压缩');
    } catch (e) {
      return ExternalAPIService.err('图片压缩失败：'+e.message);
    }
  }

  // ============ 图片水印（Sharp）===========
  static async imageWatermark(imageUrl, watermarkText = '沐美服务', options = {}) {
    try {
      const {opacity=0.5, fontSize=24, gravity='southeast'} = options;
      const sharpLib = require('sharp');
      let buffer;
      if (imageUrl.startsWith('http')) {
        const res = await this.safeFetch(imageUrl);
        if (!res.ok) return ExternalAPIService.err('图片获取失败');
        buffer = Buffer.from(await res.arrayBuffer());
      } else {
        buffer = Buffer.from(imageUrl,'base64');
      }
      const meta = await sharpLib(buffer).metadata();
      const w = meta.width || 800;
      const wmW = Math.ceil(w * 0.6);
      const wmH = Math.max(Math.floor(w/20), fontSize+10);
      const wmBuf = await sharpLib({
        create:{width:wmW, height:wmH, channels:4, background:{r:0,g:0,b:0,alpha:0}}
      }).composite([{
        input: Buffer.from(`<svg width="${wmW}" height="${wmH}"><text x="0" y="${fontSize}" font-size="${fontSize}" fill="white" fill-opacity="${opacity}">${watermarkText}</text></svg>`),
        top:0, left:0
      }]).png().toBuffer();
      const result = await sharpLib(buffer).composite([{input:wmBuf, gravity, blend:'over'}]).png().toBuffer();
      return ExternalAPIService.ok({imageBase64:result.toString('base64'), watermarkText, originalSize:buffer.length, newSize:result.length}, '图片水印');
    } catch (e) {
      return ExternalAPIService.err('图片水印失败：'+e.message);
    }
  }

  // ============ QuickChart 图表生成 ============
  static async chartGenerate(options = {}) {
    try {
      const {type='bar', data, labels, title='', colors=['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6']} = options;
      const chartConfig = {type, data:{labels:labels||['A','B','C','D','E'],datasets:[{label:title,data:data||[10,20,30,40,50],backgroundColor:colors}]}, options:{responsive:true,plugins:{legend:{display:true,position:'top'},title:{display:!!title,text:title}}}};
      const encoded = Buffer.from(JSON.stringify(chartConfig)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
      const chartUrl = `https://quickchart.io/chart?c=${encoded}&width=600&height=400&format=png&backgroundColor=white`;
      const res = await this.safeFetch(chartUrl);
      if (!res.ok) return ExternalAPIService.err('图表生成失败');
      const buf = Buffer.from(await res.arrayBuffer());
      return ExternalAPIService.ok({chartImageUrl:chartUrl, chartBase64:buf.toString('base64'), type, title}, 'QuickChart 图表生成');
    } catch (e) {
      return ExternalAPIService.err('图表生成失败：'+e.message);
    }
  }

  // ============ QuickChart 二维码 ============
  static async qrAdvanced(text, options = {}) {
    try {
      const {size=300, dark='000000', light='ffffff'} = options;
      const url = `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=${size}&format=png&darkcolor=%23${dark.replace('#','')}&bgcolor=%23${light.replace('#','')}`;
      const res = await this.safeFetch(url);
      if (!res.ok) return ExternalAPIService.err('二维码生成失败');
      const buf = Buffer.from(await res.arrayBuffer());
      return ExternalAPIService.ok({qrBase64:buf.toString('base64'), text, size}, 'QuickChart 二维码');
    } catch (e) {
      return ExternalAPIService.err('二维码生成失败：'+e.message);
    }
  }

  // ============ 网页截图 ============
  static async webpageScreenshot(url, options = {}) {
    try {
      const {width=1280, height=800} = options;
      const apiUrl = `https://thumbnail.techlife.app/?u=${encodeURIComponent(url)}&w=${width}&h=${height}&f=png`;
      const res = await this.safeFetch(apiUrl);
      if (!res.ok) return ExternalAPIService.err('网页截图失败');
      const buf = Buffer.from(await res.arrayBuffer());
      return ExternalAPIService.ok({screenshotBase64:buf.toString('base64'), url, width, height}, '网页截图');
    } catch (e) {
      return ExternalAPIService.err('网页截图失败：'+e.message);
    }
  }

  // ============ 短链接生成 ============
  static async shortUrl(longUrl) {
    try {
      const res = await this.safeFetch('https://tinyurl.com/api-create.php?url='+encodeURIComponent(longUrl));
      if (!res.ok) return ExternalAPIService.err('短链接生成失败');
      const data = await res.json();
      if (data.short) return ExternalAPIService.ok({shortUrl:data.short, originalUrl:longUrl}, '短链接生成');
      return ExternalAPIService.err('短链接生成失败：'+(data.msg||'未知错误'));
    } catch (e) {
      return ExternalAPIService.err('短链接生成失败：'+e.message);
    }
  }

  // ============ 正则表达式测试 ============
  static async regexTest(pattern, text, flags = 'g') {
    try {
      new RegExp(pattern);
      const regex = new RegExp(pattern, flags);
      const matches = [];
      let m;
      const testText = text.slice(0, 5000);
      if (flags.includes('g')) { while ((m = regex.exec(testText)) !== null) matches.push({match:m[0],index:m.index,groups:m.slice(1)}); }
      else { m = regex.exec(testText); if (m) matches.push({match:m[0],index:m.index,groups:m.slice(1)}); }
      return ExternalAPIService.ok({isValid:true, pattern, flags, matchCount:matches.length, matches:matches.slice(0,50)}, '正则表达式测试');
    } catch (e) {
      return ExternalAPIService.err('正则表达式错误：'+e.message);
    }
  }

  // ============ URL 编解码 ============
  static async urlCodec(text, type = 'encode') {
    try {
      if (type === 'encode') return ExternalAPIService.ok({encoded:encodeURIComponent(text), decoded:text}, 'URL 编码');
      return ExternalAPIService.ok({encoded:text, decoded:decodeURIComponent(text)}, 'URL 解码');
    } catch (e) {
      return ExternalAPIService.err('URL处理失败：'+e.message);
    }
  }

  // ============ Base64 编解码 ============
  static async base64Codec(text, type = 'encode') {
    try {
      if (type === 'encode') return ExternalAPIService.ok({encoded:Buffer.from(text).toString('base64'), original:text}, 'Base64 编码');
      return ExternalAPIService.ok({encoded:text, decoded:Buffer.from(text.replace(/\s/g,''),'base64').toString('utf8')}, 'Base64 解码');
    } catch (e) {
      return ExternalAPIService.err('Base64处理失败：'+e.message);
    }
  }

  // ============ 进制转换 ============
  static async baseConvert(number, fromBase = 10, toBase = 2) {
    try {
      const val = parseInt(String(number), fromBase);
      return ExternalAPIService.ok({
        from:{value:number, base:fromBase},
        to:{value:val.toString(toBase).toUpperCase(), base:toBase},
        binary:val.toString(2), octal:val.toString(8),
        hex:val.toString(16).toUpperCase(), decimal:val
      }, '进制转换');
    } catch (e) {
      return ExternalAPIService.err('进制转换失败：'+e.message);
    }
  }

  // ============ 颜色转换 ============
        static async colorConvert(color, targetFormat) {
    try {
      if (!targetFormat || targetFormat === 'all') targetFormat = 'hex,rgb,hsl';
      let hex = color.trim();
      if (!hex.startsWith('#')) hex = '#' + hex;
      const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return ExternalAPIService.err('无效的颜色格式，请输入如 #FF5733');
      const rv = parseInt(m[1], 16), gv = parseInt(m[2], 16), bv = parseInt(m[3], 16);
      const [h, s, l] = rgbToHsl(rv, gv, bv);
      const rv16 = (x) => (x < 16 ? '0' : '') + x.toString(16);
      const result = {
        hex: '#' + [rv, gv, bv].map(rv16).join(''),
        rgb: 'rgb(' + rv + ', ' + gv + ', ' + bv + ')',
        hsl: 'hsl(' + Math.round(h) + ', ' + Math.round(s) + '%, ' + Math.round(l) + '%)'
      };
      // 返回所有格式
      return ExternalAPIService.ok({ input: color, hex: result.hex, rgb: result.rgb, hsl: result.hsl }, '颜色转换');
    } catch (e) {
      return ExternalAPIService.err('颜色转换失败：' + e.message);
    }
  }
  // ============ HTML 预览=========
  static async htmlPreview(html, options = {}) {
    try {
      const preview = 'data:text/html;base64,'+Buffer.from(html.slice(0,50000)).toString('base64');
      return ExternalAPIService.ok({htmlLength:html.length, preview}, 'HTML 预览');
    } catch (e) {
      return ExternalAPIService.err('HTML预览失败');
    }
  }

  // ============ 辅助函数 ============
}

function wrapText(text, maxChars) {
  const lines = []; let cur = '';
  for (const word of text.split(' ')) {
    if ((cur+word).length > maxChars) { if (cur) lines.push(cur.trim()); cur = word+' '; } else cur += word+' ';
  } if (cur) lines.push(cur.trim());
  return lines;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else { const d = max-min; s = l > 0.5 ? d/(2-max-min) : d/(max+min); switch(max){ case r: h=((g-b)/d+(g<b?6:0))/6; break; case g: h=((b-r)/d+2)/6; break; case b: h=((r-g)/d+4)/6; break; } }
  return [h*360, s*100, l*100];
}

module.exports = ExternalAPIService;

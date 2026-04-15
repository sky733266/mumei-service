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
        return this.ok({ quote: q.content, author: q.author, tags: q.tags || [] }, 'Quotable API');
      }
    } catch (_) {}
    const fb = [
      { quote: '代码是写给人读的，只是偶尔让机器执行。', author: 'Harold Abelson' },
      { quote: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
      { quote: 'Any fool can write code that a computer can understand.', author: 'Martin Fowler' },
      { quote: '程序员的三大谎言：1. 代码马上好 2. 只是小改动 3. 注释以后补', author: '社区智慧' },
    ];
    return this.ok(fb[Math.floor(Math.random() * fb.length)], '内置数据');
  }

  // ============ 随机笑话 ============
  static async randomJoke(type = 'Programming') {
    try {
      const res = await this.safeFetch(`https://v2.jokeapi.dev/joke/${type}`);
      if (res.ok) {
        const j = await res.json();
        if (j.type === 'single') return this.ok({ joke: j.joke }, 'JokeAPI');
        return this.ok({ setup: j.setup, delivery: j.delivery }, 'JokeAPI');
      }
    } catch (_) {}
    const fb = [
      { joke: '为什么程序员分不清万圣节和圣诞节？因为 Oct 31 = Dec 25。' },
      { joke: '程序员的两大谎言：1. 代码马上好 2. 这个 bug 很简单' },
    ];
    return this.ok(fb[Math.floor(Math.random() * fb.length)], '内置数据');
  }

  // ============ 随机用户 ============
  static async randomUser() {
    try {
      const res = await this.safeFetch('https://randomuser.me/api/');
      if (res.ok) {
        const r = (await res.json()).results[0];
        return this.ok({
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
    return this.err('RandomUser API 暂时不可用');
  }

  // ============ 随机猫图 ============
  static async catImage() {
    try {
      const res = await this.safeFetch('https://api.thecatapi.com/v1/images/search');
      if (res.ok) {
        const d = await res.json();
        return this.ok({ url: d[0].url, id: d[0].id }, 'TheCatAPI');
      }
    } catch (_) {}
    try {
      const res = await this.safeFetch('https://cataas.com/cat?json=true');
      if (res.ok) {
        const d = await res.json();
        return this.ok({ url: `https://cataas.com${d.url}`, id: d.id }, 'Cataas API');
      }
    } catch (_) {}
    return this.ok({ url: 'https://placekitten.com/400/300' }, 'PlaceKitten fallback');
  }

  // ============ 单词释义 ============
  static async wordDefinition(word) {
    if (!word) return this.err('请提供要查询的单词');
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
        return this.ok({ word: entry.word, phonetic: entry.phonetic || '', meanings }, 'Free Dictionary API');
      }
      return this.err('未找到该单词');
    } catch (_) {}
    return this.err('词典 API 暂时不可用');
  }

  // ============ 单词同义词 ============
  static async wordSynonym(word, type = 'rel_trg') {
    if (!word) return this.err('请提供要查询的单词');
    try {
      const res = await this.safeFetch(
        `https://api.datamuse.com/words?${type}=${encodeURIComponent(word)}&max=20`
      );
      if (res.ok) {
        const words = await res.json();
        if (!words.length) return this.err('未找到相关词汇');
        return this.ok({
          word, type,
          words: words.map(w => ({ word: w.word, score: w.score, tags: w.tags || [] })),
        }, 'Datamuse API');
      }
    } catch (_) {}
    return this.err('Datamuse API 暂时不可用');
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
    return this.ok({ content: words[Math.floor(Math.random() * words.length)] }, '内置数据');
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
    return this.ok({
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
        if (items.length) return this.ok({ category, items }, 'RSS Feed');
      }
    } catch (_) {}
    return this.err(`新闻 RSS (${category}) 暂时不可用`);
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
        return this.ok({ language, projects: projects.slice(0, 20) }, 'GitHub Trending');
      }
    } catch (_) {}
    return this.err('GitHub Trending 暂时不可用');
  }

  // ============ AI 内容检测（启发式） ============
  static async detectAI(text) {
    if (!text || text.length < 50) return this.err('请提供至少50个字符的文本');
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
    return this.ok({
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
      if (!geoData.results?.length) return this.err('未找到该城市');
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

      return this.ok({
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
      return this.err('天气服务暂时不可用: ' + e.message);
    }
  }

  // ============ 汇率换算 ============
  static async exchangeRate(from = 'CNY', to = 'USD', amount = 1) {
    try {
      const res = await this.safeFetch(`https://open.er-api.com/v6/latest/${from}`);
      if (!res.ok) throw new Error('exchange failed');
      const data = await res.json();
      if (!data.rates || data.rates[to] === undefined) return this.err('不支持该货币');
      const rate = data.rates[to];
      return this.ok({
        from, to, amount,
        rate: rate,
        result: Math.round(amount * rate * 100) / 100,
        updated: data.time_last_update_utc,
      }, 'Open Exchange Rates API');
    } catch (_) {}
    return this.err('汇率 API 暂时不可用');
  }

  // ============ 邮编查询 ============
  static async zipCode(zip) {
    if (!zip) return this.err('请提供邮政编码');
    try {
      const res = await this.safeFetch(`https://api.zippopotam.us/cn/${zip}`);
      if (res.ok) {
        const d = await res.json();
        return this.ok({
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
      return this.err('未找到该邮编');
    } catch (_) {}
    return this.err('邮编 API 暂时不可用');
  }

  // ============ 配色方案 ============
  static async colorScheme(baseColor = null) {
    if (baseColor) {
      const hex = baseColor.replace('#', '');
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return this.err('无效的颜色值，请使用十六进制格式如 #FF5500');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const clamp = (x) => Math.max(0, Math.min(255, x));
      const toHex = (x) => clamp(x).toString(16).padStart(2, '0');
      return this.ok({
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
    return this.ok({
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
    return this.ok({ uuids: count === 1 ? uuids[0] : uuids }, 'UUID v4');
  }

  // ============ 时区转换 ============
  static async timezoneConvert(time, fromTz = 'Asia/Shanghai', toTz = 'America/New_York') {
    try {
      const date = new Date(time);
      const fmt = (tz) => new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, dateStyle: 'full', timeStyle: 'medium',
      }).format(date);
      return this.ok({
        input_time: time,
        from_tz: fromTz,
        to_tz: toTz,
        from_formatted: fmt(fromTz),
        to_formatted: fmt(toTz),
        utc: date.toISOString(),
      }, 'Intl API');
    } catch (_) {}
    return this.err('时区转换失败');
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
    return this.ok({
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
      if (!res.ok) return this.err('不支持该国家代码或年份');
      const holidays = await res.json();
      return this.ok({ country, year, holidays }, 'DateNager API');
    } catch (_) {}
    return this.err('节假日 API 暂时不可用');
  }

  // ============ 国家信息查询 ============
  static async countryInfo(name = '') {
    if (!name) return this.err('请提供国家名称');
    try {
      // 搜索国家
      const res = await this.safeFetch(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,languages,currencies,region,population,flags,maps`
      );
      if (!res.ok) return this.err('未找到该国家');
      const countries = await res.json();
      if (!countries.length) return this.err('未找到该国家');
      const c = countries[0];
      return this.ok({
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
    return this.err('国家信息 API 暂时不可用');
  }

  // ============ Stack Overflow 搜索 ============
  static async stackOverflow(question = '', tags = '', sort = 'votes') {
    if (!question) return this.err('请提供搜索关键词');
    const tagParam = tags ? `,${encodeURIComponent(tags)}` : '';
    try {
      const res = await this.safeFetch(
        `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=${sort}&q=${encodeURIComponent(question + tagParam)}&site=stackoverflow&pagesize=10`
      );
      if (!res.ok) return this.err('搜索失败');
      const data = await res.json();
      if (!data.items?.length) return this.err('未找到相关问题');
      return this.ok({
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
    return this.err('Stack Overflow 搜索暂时不可用');
  }

  // ============ 随机狗图 ============
  static async dogImage() {
    try {
      const res = await this.safeFetch('https://dog.ceo/api/breeds/image/random');
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'success') {
          return this.ok({ url: d.message, breed: d.message.split('/')[4] || 'Unknown' }, 'Dog CEO API');
        }
      }
    } catch (_) {}
    return this.ok({ url: 'https://placedog.net/400/300' }, 'PlaceDog fallback');
  }

  // ============ URL Slug 生成 ============
  static async slugify(text = '') {
    if (!text) return this.err('请提供要转换的文本');
    const slug = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return this.ok({ original: text, slug }, '本地计算');
  }

  // ============ JSON Schema 生成 ============
  static async jsonSchema(jsonText = '') {
    if (!jsonText) return this.err('请提供 JSON 文本');
    try {
      const obj = JSON.parse(jsonText);
      const schema = this.generateSchema(obj, 'Root');
      return this.ok({ original: jsonText, schema: JSON.stringify(schema, null, 2) }, '本地生成');
    } catch (e) {
      return this.err('JSON 解析失败: ' + e.message);
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
    if (!xmlText) return this.err('请提供 XML 文本');
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
      return this.ok({ original: xmlText, formatted: formatted.trim() }, '本地处理');
    } catch (e) {
      return this.err('XML 格式化失败: ' + e.message);
    }
  }

  // ============ Cron 描述 ============
  static async cronDescription(expression = '') {
    if (!expression) return this.err('请提供 Cron 表达式');
    try {
      const cronstrue = require('cronstrue');
      const desc = cronstrue.toString(expression, { locale: 'zh_CN' });
      return this.ok({ expression, description: desc }, 'cronstrue');
    } catch (e) {
      return this.err('Cron 表达式无效: ' + e.message);
    }
  }

  // ============ JSON 对比 ============
  static async jsonDiff(json1 = '', json2 = '') {
    if (!json1 || !json2) return this.err('请提供两个 JSON 文本');
    try {
      const obj1 = JSON.parse(json1);
      const obj2 = JSON.parse(json2);
      const diff = this.deepDiff(obj1, obj2, '', []);
      return this.ok({ diff: diff.length ? diff : [{ path: '(root)', change: '相同' }] }, '本地计算');
    } catch (e) {
      return this.err('JSON 解析失败: ' + e.message);
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
    return this.ok({ language, gitignore: content }, '内置模板');
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
    return this.ok({ language, dockerfile: content }, '内置模板');
  }

  // ============ 图片 Base64 互转 ============
  static async imageBase64(imageUrl = '', direction = 'url-to-base64') {
    if (!imageUrl) return this.err('请提供图片 URL 或 Base64 文本');
    if (direction === 'url-to-base64') {
      try {
        const res = await this.safeFetch(imageUrl);
        if (!res.ok) return this.err('图片下载失败');
        const buf = await res.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        const mimeMatch = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
        const mime = mimeMatch ? `image/${mimeMatch[1] === 'jpg' ? 'jpeg' : mimeMatch[1]}` : 'image/png';
        return this.ok({ base64: `data:${mime};base64,${b64}`, mime, size: buf.byteLength }, '本地计算');
      } catch (e) {
        return this.err('图片下载失败: ' + e.message);
      }
    } else {
      // base64-to-url: 简单解码返回信息
      try {
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return this.err('Base64 格式无效，应为 data:image/xxx;base64,xxxx 格式');
        return this.ok({ mime: match[1], size: Math.round(match[2].length * 0.75) }, '本地计算');
      } catch (e) {
        return this.err('解析失败: ' + e.message);
      }
    }
  }

  // ============ 哈希验证 ============
  static async hashVerify(text = '', algorithm = 'md5') {
    if (!text) return this.err('请提供要验证的文本');
    const crypto = require('crypto');
    const hash = crypto.createHash(algorithm).update(text).digest('hex');
    const algorithms = ['md5', 'sha1', 'sha256', 'sha512'];
    const results = {};
    for (const alg of algorithms) {
      results[alg] = crypto.createHash(alg).update(text).digest('hex');
    }
    return this.ok({ text, algorithms: results }, '本地计算');
  }

  // ============ 时区当前时间 ============
  static async worldTime(tz = 'Asia/Shanghai') {
    try {
      const formatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, dateStyle: 'full', timeStyle: 'full',
      });
      const now = new Date();
      return this.ok({
        timezone: tz,
        local: formatter.format(now),
        utc: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
      }, 'Intl API');
    } catch (_) {}
    return this.err('时区查询失败');
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
    if (!langs) return this.err('不支持该语言，可选: javascript, python, go');
    const code = langs[task] || langs.hello;
    return this.ok({ language, task, code }, '内置示例');
  }

  // ============ 正则表达式生成 ============
  static async regexGenerate(description = '') {
    if (!description) return this.err('请提供正则表达式描述');
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
        return this.ok({ description, regex: r.re, name: r.name, note: '基于关键词匹配，结果仅供参考' }, '规则映射');
      }
    }
    return this.ok({ description, regex: '', note: '暂不支持该描述，请尝试更具体的关键词（手机、邮箱、身份证、IP、URL、车牌）' }, '规则映射');
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
    return this.ok({ ...challenge, code, language }, '内置题库');
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
    if (!s) return this.err(`未知 HTTP 状态码: ${code}`);
    return this.ok({ code, ...s }, '内置数据库');
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
    if (!m) return this.err(`未知 HTTP 方法: ${method}`);
    return this.ok({ method: method.toUpperCase(), ...m }, '内置数据库');
  }

  // ============ JSON Web Token 解码（已存在，此处增强） ============
  static async jwtDecode(token = '') {
    if (!token) return this.err('请提供 JWT Token');
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return this.err('无效的 JWT 格式');
      const decode = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
      const header = decode(parts[0]);
      const payload = decode(parts[1]);
      return this.ok({
        header,
        payload,
        signature: parts[2],
        isExpired: payload.exp ? Date.now() > payload.exp * 1000 : null,
      }, '本地解码');
    } catch (e) {
      return this.err('JWT 解析失败: ' + e.message);
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
        return this.ok({
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
          return this.ok({
            ip: d.query || '',
            city: d.city || '',
            country: d.country || '',
            org: d.org || '',
            timezone: d.timezone || '',
          }, 'IP-API.com');
        }
      }
    } catch (_) {}
    return this.err('IP 查询暂时不可用（可能被网络限制拦截）');
  }
}

module.exports = ExternalAPIService;

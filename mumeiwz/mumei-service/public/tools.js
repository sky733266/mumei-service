
// ============ 免费试用系统 ============
const FREE_TRIAL_LIMIT = 10;
function getFreeTrials() {
  const stored = localStorage.getItem('freeTrialCount');
  if (stored === null) return FREE_TRIAL_LIMIT;
  return parseInt(stored, 10) || 0;
}
function useFreeTrial() {
  let n = getFreeTrials();
  if (n > 0) localStorage.setItem('freeTrialCount', --n);
  return n;
}
function showTrialCount() {
  const el = document.getElementById('trialCount');
  if (el) {
    const n = getFreeTrials();
    el.textContent = n > 0 ? n : 0;
  }
}
function isFreeTrialAvailable() {
  return getFreeTrials() > 0;
}

// 工具箱页面脚本

let currentLang = localStorage.getItem('language') || 'zh';
let authToken = localStorage.getItem('authToken');
let translations = {};

// 初始化语言切换
document.addEventListener('DOMContentLoaded', function() {
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.value = currentLang;
    languageSelect.addEventListener('change', (e) => {
      currentLang = e.target.value;
      localStorage.setItem('language', currentLang);
      document.documentElement.lang = currentLang;
      loadTranslations(currentLang);
    });
    loadTranslations(currentLang);
  }
  // 显示免费试用次数（未登录时）
  if (!authToken) {
    const badge = document.getElementById('trialBadge');
    if (badge) { badge.style.display = 'inline'; showTrialCount(); }
  }
});

// 语言切换（供外部调用，API 与 app-beautiful.js 保持一致）
async function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('language', lang);
  document.documentElement.lang = lang;
  await loadTranslations(currentLang);
}

// 加载翻译
async function loadTranslations(lang) {
  try {
    const response = await fetch(`/api/translations/${lang}`);
    translations = await response.json();
    updatePageText();
  } catch (error) {
    console.error('加载翻译失败:', error);
  }
}

// eslint-disable-next-line no-unused-vars
function updateUI() { updatePageText(); }

// 更新页面文本
function updatePageText() {
  document.documentElement.lang = currentLang;

  // 标题
  const title = document.getElementById('tools');
  if (title) title.textContent = translations.toolbox || translations.tools || '工具箱';

  // 导航链接
  const navLinks = document.querySelectorAll('.navbar-link, nav a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === '/tools' || href === '/#tools') link.textContent = translations.toolbox || '工具箱';
    if (href === '/panel') link.textContent = translations.userPanel || '用户面板';
    if (href === '/pricing' || href === '/#pricing') link.textContent = translations.pricing || '定价';
    if (href === '/docs') link.textContent = translations.docs || '文档';
  });

  // 开始使用按钮
  const startBtn = document.querySelector('a[href="/panel"].btn');
  if (startBtn) startBtn.textContent = translations.getStarted || '开始使用';

  // 工具分类标签
  document.querySelectorAll('[data-category]').forEach(el => {
    const cat = el.getAttribute('data-category');
    const keyMap = {
      'ai': 'aiTools', 'file': 'fileTools', 'data': 'dataTools',
      'network': 'networkTools', 'security': 'securityTools', 'dev': 'devTools'
    };
    if (keyMap[cat] && translations[keyMap[cat]]) el.textContent = translations[keyMap[cat]];
  });

  // data-i18n 批量翻译
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[key]) el.textContent = translations[key];
  });
}

// 工具配置
const toolForms = {
  // AI工具表单
  'ai/text-generate': {
    title: 'AI文本生成',
    fields: [
      { name: 'prompt', label: '提示词', type: 'textarea', placeholder: '请输入您想要生成的内容...', required: true },
      { name: 'model', label: '模型', type: 'select', options: [
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        { value: 'gpt-4', label: 'GPT-4' }
      ]},
      { name: 'maxTokens', label: '最大Token数', type: 'number', value: 1000 },
      { name: 'temperature', label: '创意度 (0-1)', type: 'range', min: 0, max: 1, step: 0.1, value: 0.7 }
    ],
    endpoint: '/api/tools/ai/text-generate',
    method: 'POST'
  },
  
  'ai/image-generate': {
    title: 'AI图像生成',
    fields: [
      { name: 'prompt', label: '图像描述', type: 'textarea', placeholder: '描述您想要生成的图像...', required: true },
      { name: 'size', label: '尺寸', type: 'select', options: [
        { value: '1024x1024', label: '1024x1024' },
        { value: '1024x1792', label: '1024x1792 (竖版)' },
        { value: '1792x1024', label: '1792x1024 (横版)' }
      ]},
      { name: 'n', label: '生成数量', type: 'number', value: 1, min: 1, max: 4 }
    ],
    endpoint: '/api/tools/ai/image-generate',
    method: 'POST',
    resultType: 'image'
  },
  
  'ai/tts': {
    title: '语音合成',
    fields: [
      { name: 'text', label: '文本内容', type: 'textarea', placeholder: '请输入要转换为语音的文本...', required: true },
      { name: 'voice', label: '音色', type: 'select', options: [
        { value: 'alloy', label: 'Alloy' },
        { value: 'echo', label: 'Echo' },
        { value: 'fable', label: 'Fable' },
        { value: 'onyx', label: 'Onyx' },
        { value: 'nova', label: 'Nova' },
        { value: 'shimmer', label: 'Shimmer' }
      ]},
      { name: 'speed', label: '语速 (0.25-4)', type: 'range', min: 0.25, max: 4, step: 0.25, value: 1 }
    ],
    endpoint: '/api/tools/ai/tts',
    method: 'POST',
    resultType: 'audio'
  },
  
  'ai/translate': {
    title: 'AI翻译',
    fields: [
      { name: 'text', label: '原文', type: 'textarea', placeholder: '请输入要翻译的文本...', required: true },
      { name: 'sourceLang', label: '源语言', type: 'select', options: [
        { value: 'auto', label: '自动检测' },
        { value: 'zh', label: '中文' },
        { value: 'en', label: '英语' },
        { value: 'ja', label: '日语' },
        { value: 'ko', label: '韩语' },
        { value: 'fr', label: '法语' },
        { value: 'es', label: '西班牙语' }
      ]},
      { name: 'targetLang', label: '目标语言', type: 'select', options: [
        { value: 'en', label: '英语' },
        { value: 'zh', label: '中文' },
        { value: 'ja', label: '日语' },
        { value: 'ko', label: '韩语' },
        { value: 'fr', label: '法语' },
        { value: 'es', label: '西班牙语' }
      ]}
    ],
    endpoint: '/api/tools/ai/translate',
    method: 'POST'
  },
  
  'ai/stt': {
    title: '语音识别',
    fields: [
      { name: 'file', label: '音频文件', type: 'file', accept: 'audio/*', required: true },
      { name: 'language', label: '音频语言', type: 'select', options: [
        { value: 'auto', label: '自动检测' },
        { value: 'zh', label: '中文' },
        { value: 'en', label: '英语' },
        { value: 'ja', label: '日语' },
        { value: 'ko', label: '韩语' }
      ]}
    ],
    endpoint: '/api/tools/ai/stt',
    method: 'POST',
    resultType: 'text'
  },

  // 数据处理工具表单
  'data/json-format': {
    title: 'JSON格式化',
    fields: [
      { name: 'json', label: 'JSON内容', type: 'textarea', placeholder: '{"key": "value"}', required: true, rows: 10 },
      { name: 'compact', label: '压缩模式', type: 'checkbox' },
      { name: 'schema', label: '验证Schema', type: 'textarea', placeholder: '可选：输入JSON Schema进行验证', rows: 5 }
    ],
    endpoint: '/api/tools/data/json-format',
    method: 'POST'
  },
  
  'data/csv-convert': {
    title: 'CSV转换',
    fields: [
      { name: 'data', label: '数据', type: 'textarea', placeholder: '输入JSON数组或CSV内容', required: true, rows: 10 },
      { name: 'direction', label: '转换方向', type: 'select', options: [
        { value: 'json-to-csv', label: 'JSON → CSV' },
        { value: 'csv-to-json', label: 'CSV → JSON' }
      ]}
    ],
    endpoint: '/api/tools/data/json-to-csv',
    method: 'POST'
  },
  
  'data/sql-format': {
    title: 'SQL格式化',
    fields: [
      { name: 'sql', label: 'SQL语句', type: 'textarea', placeholder: 'SELECT * FROM table', required: true, rows: 10 },
      { name: 'dialect', label: '数据库类型', type: 'select', options: [
        { value: 'sql', label: '标准SQL' },
        { value: 'mysql', label: 'MySQL' },
        { value: 'postgresql', label: 'PostgreSQL' },
        { value: 'sqlite', label: 'SQLite' }
      ]}
    ],
    endpoint: '/api/tools/data/sql-format',
    method: 'POST'
  },
  
  'data/regex-test': {
    title: '正则测试',
    fields: [
      { name: 'pattern', label: '正则表达式', type: 'text', placeholder: '^[a-zA-Z0-9]+$', required: true },
      { name: 'flags', label: '标志', type: 'text', placeholder: 'g, i, m' },
      { name: 'testStrings', label: '测试字符串（每行一个）', type: 'textarea', placeholder: '输入要测试的字符串，每行一个', rows: 6 }
    ],
    endpoint: '/api/tools/data/regex-test',
    method: 'POST'
  },
  
  'data/base64': {
    title: 'Base64编解码',
    fields: [
      { name: 'data', label: '内容', type: 'textarea', placeholder: '输入要编码或解码的内容', required: true },
      { name: 'operation', label: '操作', type: 'select', options: [
        { value: 'encode', label: '编码' },
        { value: 'decode', label: '解码' }
      ]},
      { name: 'urlSafe', label: 'URL安全模式', type: 'checkbox' }
    ],
    endpoint: '/api/tools/data/base64-encode',
    method: 'POST'
  },
  
  'data/jwt': {
    title: 'JWT工具',
    fields: [
      { name: 'token', label: 'JWT Token', type: 'textarea', placeholder: 'eyJhbGciOiJIUzI1NiIs...', required: true },
      { name: 'secret', label: '密钥（用于验证签名）', type: 'text', placeholder: '可选' }
    ],
    endpoint: '/api/tools/data/jwt-decode',
    method: 'POST'
  },
  
  'data/text-stats': {
    title: '字数统计',
    fields: [
      { name: 'text', label: '文本内容', type: 'textarea', placeholder: '请输入要统计的文字...', rows: 8, required: true }
    ],
    endpoint: '/api/tools/data/text-stats',
    method: 'POST'
  },
  
  'data/case-convert': {
    title: '大小写转换',
    fields: [
      { name: 'text', label: '文本内容', type: 'textarea', placeholder: '请输入要转换的文字...', rows: 6, required: true },
      { name: 'mode', label: '转换模式', type: 'select', options: [
        { value: 'upper', label: '全部大写 UPPERCASE' },
        { value: 'lower', label: '全部小写 lowercase' },
        { value: 'title', label: '首字母大写 Title Case' },
        { value: 'sentence', label: '句首大写 Sentence case' },
        { value: 'toggle', label: '大小写互换 tOGGLE cASE' }
      ]}
    ],
    endpoint: '/api/tools/data/case-convert',
    method: 'POST'
  },
  
  'data/lorem-ipsum': {
    title: 'Lorem Ipsum 生成',
    fields: [
      { name: 'sentences', label: '数量', type: 'number', value: 5, placeholder: '生成数量' },
      { name: 'type', label: '类型', type: 'select', options: [
        { value: 'sentence', label: '句子' },
        { value: 'word', label: '单词' },
        { value: 'paragraph', label: '段落' }
      ]}
    ],
    endpoint: '/api/tools/data/lorem-ipsum',
    method: 'POST'
  },
  
  'data/number-to-chinese': {
    title: '数字转中文',
    fields: [
      { name: 'number', label: '数字', type: 'text', placeholder: '请输入数字，如 1234.56', required: true },
      { name: 'type', label: '类型', type: 'select', options: [
        { value: 'money', label: '金额大写（财务用）' },
        { value: 'number', label: '纯数字中文' }
      ]}
    ],
    endpoint: '/api/tools/data/number-to-chinese',
    method: 'POST'
  },
  
  'data/date-calculator': {
    title: '日期计算器',
    fields: [
      { name: 'startDate', label: '开始日期', type: 'date', required: true },
      { name: 'endDate', label: '结束日期', type: 'date', required: true },
      { name: 'mode', label: '模式', type: 'select', options: [
        { value: 'diff', label: '计算日期间隔' }
      ]}
    ],
    endpoint: '/api/tools/data/date-calculator',
    method: 'POST'
  },
  
  // 网络工具表单
  'network/dns': {
    title: 'DNS查询',
    fields: [
      { name: 'domain', label: '域名', type: 'text', placeholder: 'example.com', required: true },
      { name: 'type', label: '记录类型', type: 'select', options: [
        { value: 'A', label: 'A' },
        { value: 'AAAA', label: 'AAAA' },
        { value: 'MX', label: 'MX' },
        { value: 'TXT', label: 'TXT' },
        { value: 'NS', label: 'NS' },
        { value: 'CNAME', label: 'CNAME' },
        { value: 'ANY', label: 'ANY (全部)' }
      ]}
    ],
    endpoint: '/api/tools/network/dns',
    method: 'GET'
  },
  
  'network/ip-lookup': {
    title: 'IP查询',
    fields: [
      { name: 'ip', label: 'IP地址', type: 'text', placeholder: '8.8.8.8', required: true }
    ],
    endpoint: '/api/tools/network/ip-lookup',
    method: 'GET'
  },
  
  'network/whois': {
    title: 'Whois查询',
    fields: [
      { name: 'domain', label: '域名', type: 'text', placeholder: 'example.com', required: true }
    ],
    endpoint: '/api/tools/network/whois',
    method: 'GET'
  },
  
  'network/ssl-check': {
    title: 'SSL检查',
    fields: [
      { name: 'hostname', label: '主机名', type: 'text', placeholder: 'example.com', required: true },
      { name: 'port', label: '端口', type: 'number', value: 443 }
    ],
    endpoint: '/api/tools/network/ssl-check',
    method: 'GET'
  },
  
  'network/speed-test': {
    title: '网站测速',
    fields: [
      { name: 'url', label: '网址', type: 'text', placeholder: 'https://example.com', required: true }
    ],
    endpoint: '/api/tools/network/speed-test',
    method: 'GET'
  },
  
  'network/http-request': {
    title: 'HTTP请求测试',
    fields: [
      { name: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data', required: true },
      { name: 'method', label: '方法', type: 'select', options: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'DELETE', label: 'DELETE' },
        { value: 'PATCH', label: 'PATCH' }
      ]},
      { name: 'headers', label: '请求头 (JSON)', type: 'textarea', placeholder: '{"Content-Type": "application/json"}', rows: 4 },
      { name: 'body', label: '请求体', type: 'textarea', placeholder: '{"key": "value"}', rows: 4 }
    ],
    endpoint: '/api/tools/network/http-request',
    method: 'POST'
  },
  
  // 安全工具表单
  'security/password-generate': {
    title: '密码生成',
    fields: [
      { name: 'length', label: '长度', type: 'range', min: 8, max: 64, value: 16 },
      { name: 'uppercase', label: '大写字母', type: 'checkbox', checked: true },
      { name: 'lowercase', label: '小写字母', type: 'checkbox', checked: true },
      { name: 'numbers', label: '数字', type: 'checkbox', checked: true },
      { name: 'symbols', label: '特殊符号', type: 'checkbox', checked: true },
      { name: 'excludeSimilar', label: '排除相似字符', type: 'checkbox' }
    ],
    endpoint: '/api/tools/security/password-generate',
    method: 'POST'
  },
  
  'security/password-check': {
    title: '密码泄露检查',
    fields: [
      { name: 'password', label: '密码', type: 'password', placeholder: '输入要检查的密码', required: true }
    ],
    endpoint: '/api/tools/security/password-check',
    method: 'POST'
  },
  
  'security/hash': {
    title: '哈希计算',
    fields: [
      { name: 'data', label: '内容', type: 'textarea', placeholder: '输入要计算哈希的内容', required: true },
      { name: 'algorithm', label: '算法', type: 'select', options: [
        { value: 'md5', label: 'MD5' },
        { value: 'sha1', label: 'SHA1' },
        { value: 'sha256', label: 'SHA256' },
        { value: 'sha512', label: 'SHA512' }
      ]}
    ],
    endpoint: '/api/tools/security/hash',
    method: 'POST'
  },
  
  'security/url-encode': {
    title: 'URL编解码',
    fields: [
      { name: 'text', label: '内容', type: 'textarea', placeholder: '输入URL或文本', required: true },
      { name: 'operation', label: '操作', type: 'select', options: [
        { value: 'encode', label: '编码' },
        { value: 'decode', label: '解码' }
      ]},
      { name: 'component', label: '组件模式', type: 'checkbox' }
    ],
    endpoint: '/api/tools/security/url-encode',
    method: 'POST'
  },
  
  'security/html-escape': {
    title: 'HTML转义',
    fields: [
      { name: 'html', label: 'HTML内容', type: 'textarea', placeholder: '<div>Hello</div>', required: true },
      { name: 'operation', label: '操作', type: 'select', options: [
        { value: 'escape', label: '转义' },
        { value: 'unescape', label: '反转义' }
      ]}
    ],
    endpoint: '/api/tools/security/html-escape',
    method: 'POST'
  },
  
  'security/uuid': {
    title: 'UUID生成',
    fields: [
      { name: 'version', label: '版本', type: 'select', options: [
        { value: 4, label: 'Version 4 (随机)' }
      ]},
      { name: 'uppercase', label: '大写', type: 'checkbox' },
      { name: 'noDashes', label: '无横线', type: 'checkbox' }
    ],
    endpoint: '/api/tools/security/uuid-generate',
    method: 'POST'
  },
  
  'security/barcode': {
    title: '条形码生成',
    requiredPlan: 'pro',
    fields: [
      { name: 'text', label: '内容', type: 'text', placeholder: '请输入条形码内容', required: true },
      { name: 'format', label: '格式', type: 'select', options: [
        { value: 'CODE128', label: 'CODE128 (常用)' },
        { value: 'EAN13', label: 'EAN-13' },
        { value: 'EAN8', label: 'EAN-8' },
        { value: 'UPC', label: 'UPC-A' }
      ]}
    ],
    endpoint: '/api/tools/security/barcode-generate',
    method: 'POST'
  },
  
  'security/meta-generator': {
    title: 'SEO Meta标签',
    requiredPlan: 'pro',
    fields: [
      { name: 'title', label: '页面标题', type: 'text', placeholder: '网页标题', required: true },
      { name: 'description', label: '页面描述', type: 'textarea', placeholder: '网页描述（150字以内）', rows: 3 },
      { name: 'url', label: '页面URL', type: 'text', placeholder: 'https://example.com/page' },
      { name: 'image', label: '图片URL', type: 'text', placeholder: 'https://example.com/image.jpg' },
      { name: 'siteName', label: '网站名称', type: 'text', placeholder: '网站名称' },
      { name: 'twitterCard', label: 'Twitter卡片', type: 'select', options: [
        { value: 'summary', label: 'Summary' },
        { value: 'summary_large_image', label: 'Summary Large Image' }
      ]}
    ],
    endpoint: '/api/tools/security/meta-generator',
    method: 'POST'
  },
  
  // 开发工具表单
  'dev/code-format': {
    title: '代码格式化',
    fields: [
      { name: 'code', label: '代码', type: 'textarea', placeholder: '粘贴要格式化的代码', required: true, rows: 15 },
      { name: 'language', label: '语言', type: 'select', options: [
        { value: 'javascript', label: 'JavaScript' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'json', label: 'JSON' },
        { value: 'html', label: 'HTML' },
        { value: 'css', label: 'CSS' },
        { value: 'markdown', label: 'Markdown' }
      ]}
    ],
    endpoint: '/api/tools/dev/code-format',
    method: 'POST'
  },
  
  'dev/code-minify': {
    title: '代码压缩',
    fields: [
      { name: 'code', label: '代码', type: 'textarea', placeholder: '粘贴要压缩的代码', required: true, rows: 15 },
      { name: 'language', label: '语言', type: 'select', options: [
        { value: 'javascript', label: 'JavaScript' },
        { value: 'css', label: 'CSS' },
        { value: 'html', label: 'HTML' },
        { value: 'json', label: 'JSON' }
      ]}
    ],
    endpoint: '/api/tools/dev/code-minify',
    method: 'POST'
  },
  
  'dev/code-diff': {
    title: '代码对比',
    fields: [
      { name: 'oldCode', label: '旧代码', type: 'textarea', placeholder: '粘贴旧版本代码', required: true, rows: 8 },
      { name: 'newCode', label: '新代码', type: 'textarea', placeholder: '粘贴新版本代码', required: true, rows: 8 }
    ],
    endpoint: '/api/tools/dev/code-diff',
    method: 'POST'
  },
  
  'dev/cron-parse': {
    title: 'Cron解析',
    fields: [
      { name: 'expression', label: 'Cron表达式', type: 'text', placeholder: '0 0 * * *', required: true }
    ],
    endpoint: '/api/tools/dev/cron-parse',
    method: 'POST'
  },
  
  'dev/timestamp': {
    title: '时间戳转换',
    fields: [
      { name: 'timestamp', label: '时间戳', type: 'text', placeholder: '1712345678', required: true }
    ],
    endpoint: '/api/tools/dev/timestamp-convert',
    method: 'POST'
  },
  
  'dev/color-convert': {
    title: '颜色转换',
    fields: [
      { name: 'color', label: '颜色', type: 'text', placeholder: '#6366f1', required: true },
      { name: 'targetFormat', label: '目标格式', type: 'select', options: [
        { value: 'hex', label: 'HEX' },
        { value: 'rgb', label: 'RGB' },
        { value: 'rgba', label: 'RGBA' },
        { value: 'hsl', label: 'HSL' },
        { value: 'hsla', label: 'HSLA' },
        { value: 'cmyk', label: 'CMYK' }
      ]}
    ],
    endpoint: '/api/tools/dev/color-convert',
    method: 'POST'
  },

  // Markdown 实时预览
  'dev/markdown-preview': {
    title: 'Markdown 实时预览',
    fields: [
      { name: 'markdown', label: 'Markdown 内容', type: 'textarea', placeholder: '# 标题\n\n输入 Markdown 文本...', required: true },
      { name: 'gfm', label: 'GitHub 风格', type: 'checkbox', checked: true },
      { name: 'breaks', label: '换行转 <br>', type: 'checkbox', checked: true }
    ],
    endpoint: '/api/tools/dev/markdown-preview',
    method: 'POST'
  },

  // 二维码解码
  'dev/qr-decode': {
    title: '二维码解码',
    description: '上传二维码图片自动识别内容',
    openInNew: true,
    endpoint: '/api/tools/dev/qr-decode',
    method: 'GET'
  },

  // Cron 生成器
  'dev/cron-generate': {
    title: 'Cron 生成器',
    fields: [
      { name: 'second', label: '秒 (0-59, * )', type: 'text', placeholder: '0', value: '0' },
      { name: 'minute', label: '分钟 (0-59, * )', type: 'text', placeholder: '*', value: '*' },
      { name: 'hour', label: '小时 (0-23, * )', type: 'text', placeholder: '*', value: '*' },
      { name: 'day', label: '日期 (1-31, * )', type: 'text', placeholder: '*', value: '*' },
      { name: 'month', label: '月份 (1-12, * )', type: 'text', placeholder: '*', value: '*' },
      { name: 'week', label: '星期 (0-6, * )', type: 'text', placeholder: '*', value: '*' }
    ],
    endpoint: '/api/tools/dev/cron-generate',
    method: 'POST'
  },

  // 随机数生成
  'data/random-number': {
    title: '随机数生成',
    fields: [
      { name: 'min', label: '最小值', type: 'number', value: 1 },
      { name: 'max', label: '最大值', type: 'number', value: 100 },
      { name: 'count', label: '生成数量', type: 'number', value: 1, min: 1, max: 100 },
      { name: 'type', label: '类型', type: 'select', options: [
        { value: 'integer', label: '整数' },
        { value: 'decimal', label: '小数' }
      ]},
      { name: 'decimal', label: '小数位数', type: 'number', value: 2, min: 0, max: 10 }
    ],
    endpoint: '/api/tools/data/random-number',
    method: 'POST'
  },

  // 在线计算器
  'data/calculator': {
    title: '在线计算器',
    fields: [
      { name: 'expression', label: '表达式', type: 'textarea', placeholder: '例如: 2+3*4 或 sqrt(16)+pow(2,3)', required: true }
    ],
    endpoint: '/api/tools/data/calculator',
    method: 'POST'
  },

  // JSON 路径查询
  'data/json-path': {
    title: 'JSON 路径查询',
    fields: [
      { name: 'json', label: 'JSON 数据', type: 'textarea', placeholder: '{"name":"Tom","age":25}', required: true },
      { name: 'path', label: '查询路径', type: 'text', placeholder: '$.name 或 $.items[0]', required: true }
    ],
    endpoint: '/api/tools/data/json-path',
    method: 'POST'
  },

  // YAML 转换
  'data/yaml-convert': {
    title: 'YAML 转换',
    fields: [
      { name: 'data', label: '输入内容', type: 'textarea', placeholder: '输入 JSON 或 YAML', required: true },
      { name: 'direction', label: '转换方向', type: 'select', options: [
        { value: 'json-to-yaml', label: 'JSON → YAML' },
        { value: 'yaml-to-json', label: 'YAML → JSON' }
      ]}
    ],
    endpoint: '/api/tools/data/yaml-convert',
    method: 'POST'
  },

  // URL 批量解析
  'network/url-parser': {
    title: 'URL 批量解析',
    fields: [
      { name: 'urls', label: 'URL 列表（每行一个）', type: 'textarea', placeholder: 'https://example.com?id=1&name=test\nhttps://example.com?key=abc', required: true }
    ],
    endpoint: '/api/tools/network/url-parser',
    method: 'POST',
    transform: { urls: 'split' }
  },

  // 哈希计算器
  'security/hash-calc': {
    title: '哈希计算器',
    fields: [
      { name: 'text', label: '输入文本', type: 'textarea', placeholder: '输入要计算哈希的文本', required: true },
      { name: 'algorithm', label: '主算法', type: 'select', options: [
        { value: 'md5', label: 'MD5' },
        { value: 'sha256', label: 'SHA-256' },
        { value: 'sha512', label: 'SHA-512' }
      ]}
    ],
    endpoint: '/api/tools/security/hash-calc',
    method: 'POST'
  },
  // ===== 趣味与生活工具（免费API 2025新增）=====
  'fun/random-quote':{title:'随机名言',fields:[{name:'category',label:'类型',type:'select',options:[{value:'inspirational',label:'励志'},{value:'success',label:'成功'},{value:'wisdom',label:'智慧'},{value:'life',label:'生活'}],required:false}],endpoint:'/api/tools/fun/random-quote',method:'POST'},
  'fun/random-joke':{title:'随机笑话',fields:[{name:'type',label:'类型',type:'select',options:[{value:'Programming',label:'程序员笑话'},{value:'Any',label:'任意'},{value:'Misc',label:'杂项'}],required:false}],endpoint:'/api/tools/fun/random-joke',method:'POST'},
  'fun/encouraging':{title:'彩虹屁',fields:[],endpoint:'/api/tools/fun/encouraging',method:'POST'},
  'fun/cat-image':{title:'随机猫图',fields:[],endpoint:'/api/tools/fun/cat-image',method:'POST'},
  'fun/dog-image':{title:'随机狗图',fields:[],endpoint:'/api/tools/fun/dog-image',method:'POST'},
  'fun/random-user':{title:'随机用户',fields:[],endpoint:'/api/tools/fun/random-user',method:'POST'},
  'fun/word-define':{title:'单词释义',fields:[{name:'word',label:'英文单词',type:'text',placeholder:'hello',required:true}],endpoint:'/api/tools/fun/word-define',method:'POST'},
  'fun/word-synonym':{title:'单词同义词',fields:[{name:'word',label:'英文单词',type:'text',placeholder:'run',required:true},{name:'type',label:'类型',type:'select',options:[{value:'rel_trg',label:'同义词'},{value:'rel_jjb',label:'形容词'},{value:'ml',label:'押韵词'}],required:false}],endpoint:'/api/tools/fun/word-synonym',method:'POST'},
  'fun/weather':{title:'天气预报',fields:[{name:'city',label:'城市名',type:'text',placeholder:'北京',required:true}],endpoint:'/api/tools/fun/weather',method:'POST'},
  'fun/exchange-rate':{title:'汇率换算',fields:[{name:'from',label:'源货币',type:'text',placeholder:'CNY'},{name:'to',label:'目标货币',type:'text',placeholder:'USD'},{name:'amount',label:'金额',type:'number',value:100}],endpoint:'/api/tools/fun/exchange-rate',method:'POST'},
  'fun/ip-info':{title:'IP信息查询',fields:[{name:'ip',label:'IP地址',type:'text',placeholder:'8.8.8.8'}],endpoint:'/api/tools/fun/ip-info',method:'POST'},
  'fun/timezone':{title:'时区转换',fields:[{name:'time',label:'日期时间',type:'text',placeholder:'2026-04-15T10:00:00',required:true},{name:'fromTz',label:'源时区',type:'select',options:[{value:'Asia/Shanghai',label:'中国 UTC+8'},{value:'America/New_York',label:'美国 UTC-5'},{value:'Europe/London',label:'英国 UTC+0'},{value:'Asia/Tokyo',label:'日本 UTC+9'}]},{name:'toTz',label:'目标时区',type:'select',options:[{value:'America/New_York',label:'美国 UTC-5'},{value:'Europe/London',label:'英国 UTC+0'},{value:'Asia/Shanghai',label:'中国 UTC+8'},{value:'Asia/Tokyo',label:'日本 UTC+9'}]}],endpoint:'/api/tools/fun/timezone',method:'POST'},
  'fun/zip-code':{title:'邮编查询',fields:[{name:'zip',label:'邮政编码',type:'text',placeholder:'100000',required:true}],endpoint:'/api/tools/fun/zip-code',method:'POST'},
  'fun/holidays':{title:'节假日查询',fields:[{name:'country',label:'国家代码',type:'text',placeholder:'CN'},{name:'year',label:'年份',type:'number',value:2026}],endpoint:'/api/tools/fun/holidays',method:'POST'},
  'fun/country-info':{title:'国家信息查询',fields:[{name:'name',label:'国家名称',type:'text',placeholder:'China',required:true}],endpoint:'/api/tools/fun/country-info',method:'POST'},
  'fun/world-time':{title:'世界时钟',fields:[{name:'tz',label:'时区',type:'select',options:[{value:'Asia/Shanghai',label:'中国'},{value:'America/New_York',label:'美国'},{value:'Europe/London',label:'英国'},{value:'Asia/Tokyo',label:'日本'}]}],endpoint:'/api/tools/fun/world-time',method:'POST'},
  'fun/uuid':{title:'UUID生成',fields:[{name:'quantity',label:'数量',type:'number',value:5}],endpoint:'/api/tools/fun/uuid',method:'POST'},
  'fun/password':{title:'随机密码',fields:[{name:'length',label:'密码长度',type:'number',value:16},{name:'uppercase',label:'大写字母',type:'checkbox',value:true},{name:'lowercase',label:'小写字母',type:'checkbox',value:true},{name:'numbers',label:'数字',type:'checkbox',value:true},{name:'symbols',label:'特殊符号',type:'checkbox',value:true}],endpoint:'/api/tools/fun/password',method:'POST'},
  'fun/color-scheme':{title:'配色方案',fields:[{name:'baseColor',label:'基准颜色',type:'text',placeholder:'#6366f1'}],endpoint:'/api/tools/fun/color-scheme',method:'POST'},
  'fun/slugify':{title:'文本转Slug',fields:[{name:'text',label:'文本内容',type:'textarea',placeholder:'Hello World Test',required:true}],endpoint:'/api/tools/fun/slugify',method:'POST'},
  'fun/json-schema':{title:'JSON Schema生成',fields:[{name:'jsonText',label:'JSON文本',type:'textarea',placeholder:'{"name":"test"}',required:true}],endpoint:'/api/tools/fun/json-schema',method:'POST'},
  'fun/json-diff':{title:'JSON对比',fields:[{name:'json1',label:'JSON 1',type:'textarea',placeholder:'{"name":"a"}',required:true},{name:'json2',label:'JSON 2',type:'textarea',placeholder:'{"name":"b"}',required:true}],endpoint:'/api/tools/fun/json-diff',method:'POST'},
  'fun/xml-format':{title:'XML格式化',fields:[{name:'xmlText',label:'XML文本',type:'textarea',placeholder:'<root><item>x</item></root>',required:true}],endpoint:'/api/tools/fun/xml-format',method:'POST'},
  'fun/cron-desc':{title:'Cron解释',fields:[{name:'expression',label:'Cron表达式',type:'text',placeholder:'0 9 * * *',required:true}],endpoint:'/api/tools/fun/cron-desc',method:'POST'},
  'fun/gitignore':{title:'.gitignore生成',fields:[{name:'language',label:'语言',type:'select',options:[{value:'node',label:'Node.js'},{value:'python',label:'Python'},{value:'java',label:'Java'},{value:'go',label:'Go'},{value:'rust',label:'Rust'}],required:false}],endpoint:'/api/tools/fun/gitignore',method:'POST'},
  'fun/dockerfile':{title:'Dockerfile生成',fields:[{name:'language',label:'语言',type:'select',options:[{value:'node',label:'Node.js'},{value:'python',label:'Python'},{value:'go',label:'Go'},{value:'java',label:'Java'}],required:false}],endpoint:'/api/tools/fun/dockerfile',method:'POST'},
  'fun/code-example':{title:'代码示例',fields:[{name:'language',label:'编程语言',type:'select',options:[{value:'javascript',label:'JavaScript'},{value:'python',label:'Python'},{value:'go',label:'Go'}]},{name:'task',label:'任务',type:'select',options:[{value:'hello',label:'Hello World'},{value:'fetch',label:'HTTP请求'},{value:'async',label:'异步编程'}]}],endpoint:'/api/tools/fun/code-example',method:'POST'},
  'fun/regex-gen':{title:'正则生成器',fields:[{name:'description',label:'描述关键词',type:'text',placeholder:'中国手机号',required:true}],endpoint:'/api/tools/fun/regex-gen',method:'POST'},
  'fun/coding-challenge':{title:'编程挑战',fields:[{name:'language',label:'语言',type:'select',options:[{value:'javascript',label:'JavaScript'},{value:'python',label:'Python'}],required:false}],endpoint:'/api/tools/fun/coding-challenge',method:'POST'},
  'fun/http-status':{title:'HTTP状态码',fields:[{name:'code',label:'状态码',type:'number',value:404,required:true}],endpoint:'/api/tools/fun/http-status',method:'POST'},
  'fun/http-methods':{title:'HTTP方法',fields:[{name:'method',label:'HTTP方法',type:'select',options:[{value:'GET',label:'GET'},{value:'POST',label:'POST'},{value:'PUT',label:'PUT'},{value:'PATCH',label:'PATCH'},{value:'DELETE',label:'DELETE'}],required:true}],endpoint:'/api/tools/fun/http-methods',method:'POST'},
  'fun/jwt-decode':{title:'JWT解码',fields:[{name:'token',label:'JWT Token',type:'textarea',placeholder:'eyJ...',required:true}],endpoint:'/api/tools/fun/jwt-decode',method:'POST'},
  'fun/detect-ai':{title:'AI内容检测',fields:[{name:'text',label:'待检测文本',type:'textarea',placeholder:'粘贴待检测文本...',required:true}],endpoint:'/api/tools/fun/detect-ai',method:'POST'},
  'fun/hash-verify':{title:'哈希计算',fields:[{name:'text',label:'文本内容',type:'textarea',placeholder:'hello',required:true}],endpoint:'/api/tools/fun/hash-verify',method:'POST'},
  'fun/image-base64':{title:'图片Base64',fields:[{name:'imageUrl',label:'图片URL',type:'text',placeholder:'https://...',required:true}],endpoint:'/api/tools/fun/image-base64',method:'POST'},
  'fun/today-history':{title:'历史上的今天',fields:[],endpoint:'/api/tools/fun/today-history',method:'POST'},
  'fun/news':{title:'科技新闻',fields:[{name:'category',label:'类别',type:'select',options:[{value:'tech',label:'科技 HN'},{value:'general',label:'综合'},{value:'china',label:'国内'}]}],endpoint:'/api/tools/fun/news',method:'POST'},
  'fun/github-trending':{title:'GitHub热榜',fields:[{name:'language',label:'语言',type:'select',options:[{value:'all',label:'全部'},{value:'python',label:'Python'},{value:'javascript',label:'JavaScript'},{value:'typescript',label:'TypeScript'},{value:'rust',label:'Rust'},{value:'go',label:'Go'}]}],endpoint:'/api/tools/fun/github-trending',method:'POST'},
  'fun/stack-overflow':{title:'SO搜索',fields:[{name:'question',label:'搜索问题',type:'text',placeholder:'javascript async',required:true},{name:'tags',label:'标签',type:'text',placeholder:'node'},{name:'sort',label:'排序',type:'select',options:[{value:'votes',label:'票数'},{value:'relevance',label:'相关性'}]}],endpoint:'/api/tools/fun/stack-overflow',method:'POST'},
  // ===== 百度语音工具 =====
  'voice/tts':{title:'语音合成 TTS 🔊',fields:[
    {name:'text',label:'要合成的文字',type:'textarea',placeholder:'你好，欢迎使用沐美服务！',required:true},
    {name:'per',label:'发音人',type:'select',options:[{value:0,label:'女声（度小美）'},{value:1,label:'男声（度小宇）'},{value:3,label:'情感男声（度逍遥）'},{value:4,label:'情感女声（度丫丫）'}]},
    {name:'spd',label:'语速（0-15）',type:'number',value:5},
    {name:'pit',label:'音调（0-15）',type:'number',value:5},
    {name:'vol',label:'音量（0-15）',type:'number',value:5}
  ],endpoint:'/api/tools/voice/tts',method:'POST'},
  'voice/asr':{title:'语音识别 ASR 🎤',fields:[
    {name:'audioBase64',label:'音频Base64',type:'textarea',placeholder:'粘贴音频文件的Base64编码...',required:true},
    {name:'format',label:'音频格式',type:'select',options:[{value:'wav',label:'WAV'},{value:'pcm',label:'PCM'},{value:'amr',label:'AMR'},{value:'m4a',label:'M4A'}]},
    {name:'rate',label:'采样率',type:'select',options:[{value:16000,label:'16000 Hz（推荐）'},{value:8000,label:'8000 Hz'}]}
  ],endpoint:'/api/tools/voice/asr',method:'POST'},
  // ===== 高德地图工具 =====
  'map/geocode':{title:'地址转坐标 📍',fields:[
    {name:'address',label:'地址',type:'text',placeholder:'北京市朝阳区望京街道',required:true},
    {name:'city',label:'城市（可选）',type:'text',placeholder:'北京'}
  ],endpoint:'/api/tools/map/geocode',method:'POST'},
  'map/regeocode':{title:'坐标转地址 🗺️',fields:[
    {name:'longitude',label:'经度',type:'text',placeholder:'116.481488',required:true},
    {name:'latitude',label:'纬度',type:'text',placeholder:'39.990464',required:true}
  ],endpoint:'/api/tools/map/regeocode',method:'POST'},
  'map/poi-search':{title:'POI地点搜索 🔍',fields:[
    {name:'keywords',label:'搜索关键词',type:'text',placeholder:'星巴克',required:true},
    {name:'city',label:'城市',type:'text',placeholder:'北京'},
    {name:'location',label:'中心坐标（可选）',type:'text',placeholder:'116.481488,39.990464'}
  ],endpoint:'/api/tools/map/poi-search',method:'POST'},
  'map/route':{title:'路径规划 🚗',fields:[
    {name:'origin',label:'起点坐标',type:'text',placeholder:'116.481488,39.990464',required:true},
    {name:'destination',label:'终点坐标',type:'text',placeholder:'116.434446,39.90816',required:true},
    {name:'type',label:'出行方式',type:'select',options:[{value:'driving',label:'驾车'},{value:'walking',label:'步行'},{value:'transit',label:'公交'}]}
  ],endpoint:'/api/tools/map/route',method:'POST'},
  'map/weather':{title:'高德天气 🌤️',fields:[
    {name:'city',label:'城市名称',type:'text',placeholder:'北京',required:true}
  ],endpoint:'/api/tools/map/weather',method:'POST'},
  'map/ip-location':{title:'IP城市定位 📡',fields:[
    {name:'ip',label:'IP地址（留空查本机）',type:'text',placeholder:'8.8.8.8'}
  ],endpoint:'/api/tools/map/ip-location',method:'POST'},
  // ===== 文档工具 =====
  'doc/qr-generate':{title:'二维码生成',fields:[{name:'text',label:'二维码内容',type:'text',placeholder:'https://example.com',required:true},{name:'size',label:'尺寸(px)',type:'number',value:300},{name:'dark',label:'前景色',type:'text',value:'000000'},{name:'light',label:'背景色',type:'text',value:'ffffff'}],endpoint:'/api/tools/doc/qr-generate',method:'POST'},
  'doc/qr-advanced':{title:'二维码美化',fields:[{name:'text',label:'内容',type:'text',placeholder:'https://example.com',required:true},{name:'size',label:'尺寸',type:'number',value:300},{name:'dark',label:'前景色',type:'text',value:'000000'},{name:'light',label:'背景色',type:'text',value:'ffffff'}],endpoint:'/api/tools/doc/qr-advanced',method:'POST'},
  'doc/pdf-generate':{title:'PDF生成',fields:[{name:'title',label:'标题',type:'text',placeholder:'文档标题'},{name:'content',label:'内容',type:'textarea',placeholder:'在此输入文档内容...',required:true},{name:'author',label:'作者',type:'text',placeholder:'沐美服务'}],endpoint:'/api/tools/doc/pdf-generate',method:'POST'},
  'doc/pdf-merge':{title:'PDF合并',fields:[{name:'pdfBases',label:'PDF Base64列表(逗号分隔，至少2个)',type:'textarea',placeholder:'base64编码的PDF文件...',required:true}],endpoint:'/api/tools/doc/pdf-merge',method:'POST'},
  'doc/pdf-split':{title:'PDF分割',fields:[{name:'pdfBase64',label:'PDF Base64',type:'textarea',placeholder:'base64编码...',required:true},{name:'pageRange',label:'页码(如 1,3,5-7)',type:'text',value:'1'}],endpoint:'/api/tools/doc/pdf-split',method:'POST'},
  'doc/pdf-watermark':{title:'PDF水印',fields:[{name:'pdfBase64',label:'PDF Base64',type:'textarea',placeholder:'base64编码...',required:true},{name:'watermarkText',label:'水印文字',type:'text',value:'沐美 CONFIDENTIAL'},{name:'opacity',label:'透明度(0-1)',type:'number',value:0.2},{name:'angle',label:'旋转角度',type:'number',value:-45}],endpoint:'/api/tools/doc/pdf-watermark',method:'POST'},
  // ===== 图片工具 =====
  'image/image-compress':{title:'图片压缩',fields:[{name:'imageUrl',label:'图片URL或Base64',type:'text',placeholder:'https://example.com/img.jpg',required:true},{name:'quality',label:'质量(1-100)',type:'number',value:80},{name:'format',label:'格式',type:'select',options:[{value:'jpeg',label:'JPEG'},{value:'png',label:'PNG'}]}],endpoint:'/api/tools/image/image-compress',method:'POST'},
  'image/image-watermark':{title:'图片水印',fields:[{name:'imageUrl',label:'图片URL或Base64',type:'text',placeholder:'https://example.com/img.jpg',required:true},{name:'watermarkText',label:'水印文字',type:'text',value:'沐美服务',required:true},{name:'opacity',label:'透明度',type:'number',value:0.5},{name:'fontSize',label:'字号',type:'number',value:24},{name:'gravity',label:'位置',type:'select',options:[{value:'southeast',label:'右下'},{value:'southwest',label:'左下'},{value:'center',label:'居中'}]}],endpoint:'/api/tools/image/image-watermark',method:'POST'},
  // ===== 数据工具 =====
  'data/chart-generate':{title:'图表生成',fields:[{name:'type',label:'图表类型',type:'select',options:[{value:'bar',label:'柱状图'},{value:'line',label:'折线图'},{value:'pie',label:'饼图'},{value:'doughnut',label:'环形图'},{value:'radar',label:'雷达图'}]},{name:'labels',label:'数据标签(逗号分隔)',type:'text',placeholder:'一月,二月,三月'},{name:'data',label:'数据值(逗号分隔)',type:'text',placeholder:'65,59,80',required:true},{name:'title',label:'标题',type:'text',placeholder:'月销售额'}],endpoint:'/api/tools/data/chart-generate',method:'POST'},
  // ===== 网页工具 =====
  'web/webpage-screenshot':{title:'网页截图',fields:[{name:'url',label:'网页URL',type:'text',placeholder:'https://example.com',required:true},{name:'width',label:'宽度',type:'number',value:1280},{name:'height',label:'高度',type:'number',value:800}],endpoint:'/api/tools/web/webpage-screenshot',method:'POST'},
  'web/short-url':{title:'短链接生成',fields:[{name:'longUrl',label:'原始长链接',type:'text',placeholder:'https://very-long-url.com/...',required:true}],endpoint:'/api/tools/web/short-url',method:'POST'},
  // ===== 开发工具 =====
  'dev/code-beautify':{title:'代码美化',fields:[{name:'code',label:'代码',type:'textarea',placeholder:'粘贴代码...',required:true},{name:'language',label:'语言',type:'select',options:[{value:'javascript',label:'JavaScript'},{value:'typescript',label:'TypeScript'},{value:'python',label:'Python'},{value:'html',label:'HTML'},{value:'css',label:'CSS'},{value:'json',label:'JSON'},{value:'sql',label:'SQL'},{value:'yaml',label:'YAML'}]}],endpoint:'/api/tools/dev/code-beautify',method:'POST'},
  'dev/regex-test':{title:'正则测试',fields:[{name:'pattern',label:'正则表达式',type:'text',placeholder:'(?:https?|ftp)://[^\\s]+',required:true},{name:'text',label:'待匹配文本',type:'textarea',placeholder:'输入文本...',required:true},{name:'flags',label:'标志',type:'select',options:[{value:'g',label:'全局g'},{value:'gi',label:'不区分大小写gi'},{value:'',label:'无'}]}],endpoint:'/api/tools/dev/regex-test',method:'POST'},
  'dev/url-codec':{title:'URL编解码',fields:[{name:'text',label:'内容',type:'textarea',placeholder:'要编码或解码的文本...',required:true},{name:'type',label:'操作',type:'select',options:[{value:'encode',label:'URL编码'},{value:'decode',label:'URL解码'}]}],endpoint:'/api/tools/dev/url-codec',method:'POST'},
  'dev/base64-codec':{title:'Base64编解码',fields:[{name:'text',label:'内容',type:'textarea',placeholder:'要编码或解码的文本...',required:true},{name:'type',label:'操作',type:'select',options:[{value:'encode',label:'Base64编码'},{value:'decode',label:'Base64解码'}]}],endpoint:'/api/tools/dev/base64-codec',method:'POST'},
  'dev/base-convert':{title:'进制转换',fields:[{name:'number',label:'数值',type:'text',placeholder:'255',required:true},{name:'fromBase',label:'源进制',type:'select',options:[{value:2,label:'二进制'},{value:8,label:'八进制'},{value:10,label:'十进制'},{value:16,label:'十六进制'}]},{name:'toBase',label:'目标进制',type:'select',options:[{value:2,label:'二进制'},{value:8,label:'八进制'},{value:10,label:'十进制'},{value:16,label:'十六进制'}]}],endpoint:'/api/tools/dev/base-convert',method:'POST'},
  'dev/color-convert':{title:'颜色转换',fields:[{name:'color',label:'颜色值',type:'text',placeholder:'#6366f1',required:true},{name:'targetFormat',label:'目标格式',type:'select',options:[{value:'all',label:'全部'},{value:'hex',label:'HEX'},{value:'rgb',label:'RGB'},{value:'hsl',label:'HSL'}]}],endpoint:'/api/tools/dev/color-convert',method:'POST'},
  'dev/html-preview':{title:'HTML预览',fields:[{name:'html',label:'HTML代码',type:'textarea',placeholder:'<html>...</html>',required:true}],endpoint:'/api/tools/dev/html-preview',method:'POST'},
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  filterTools('all');
});

// 设置事件监听
function setupEventListeners() {
  // 分类标签
  document.querySelectorAll('.tool-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterTools(tab.dataset.category);
    });
  });

  // 工具卡片点击
  document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const toolId = card.dataset.tool;
      const config = toolForms[toolId];
      // openInNew 的工具直接在新窗口打开
      if (config && config.openInNew) {
        window.open(config.endpoint, '_blank');
        return;
      }
      openToolModal(toolId);
    });
  });

  // 关闭弹窗
  document.getElementById('closeToolModal').addEventListener('click', closeToolModal);
  document.getElementById('toolModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('toolModal')) {
      closeToolModal();
    }
  });
}

// 过滤工具
function filterTools(category) {
  document.querySelectorAll('.tool-card').forEach(card => {
    if (category === 'all' || card.dataset.category === category) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

// 打开工具弹窗
function openToolModal(toolId) {
  const config = toolForms[toolId];
  if (!config) {
    showToast('工具配置不存在');
    return;
  }

  document.getElementById('toolTitle').textContent = config.title;
  document.getElementById('toolBody').innerHTML = generateToolForm(config, toolId);
  document.getElementById('toolModal').classList.remove('hidden');

  // 绑定表单提交
  const form = document.getElementById('toolForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      executeTool(toolId, config);
    });
  }
}

// 生成工具表单
function generateToolForm(config, toolId) {
  let html = `
    <form id="toolForm" class="tool-form">
  `;

  config.fields.forEach(field => {
    html += `<div class="form-group">`;
    html += `<label>${field.label}</label>`;

    switch (field.type) {
      case 'textarea':
        html += `<textarea name="${field.name}" placeholder="${field.placeholder || ''}" rows="${field.rows || 5}" ${field.required ? 'required' : ''}>${field.value || ''}</textarea>`;
        break;
      case 'select':
        html += `<select name="${field.name}">`;
        field.options.forEach(opt => {
          html += `<option value="${opt.value}" ${opt.value === field.value ? 'selected' : ''}>${opt.label}</option>`;
        });
        html += `</select>`;
        break;
      case 'checkbox':
        html += `<div class="checkbox-item">`;
        html += `<input type="checkbox" name="${field.name}" ${field.checked ? 'checked' : ''}>`;
        html += `<span>启用</span>`;
        html += `</div>`;
        break;
      case 'range':
        html += `<input type="range" name="${field.name}" min="${field.min}" max="${field.max}" step="${field.step || 1}" value="${field.value || 0}">`;
        html += `<span class="range-value">${field.value || 0}</span>`;
        break;
      case 'password':
        html += `<input type="password" name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>`;
        break;
      default:
        html += `<input type="${field.type}" name="${field.name}" placeholder="${field.placeholder || ''}" value="${field.value || ''}" ${field.required ? 'required' : ''}>`;
    }

    html += `</div>`;
  });

  html += `
      <button type="submit" class="btn-primary">执行</button>
    </form>
    <div id="toolResult" class="tool-result hidden"></div>
  `;

  return html;
}

// 执行工具
async function executeTool(toolId, config) {
  // 未登录用户检查免费试用
  if (!authToken && !isFreeTrialAvailable()) {
    const resultDiv = document.getElementById('toolResult');
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `
      <div class="tool-error" style="text-align:center;padding:32px;">
        <p style="font-size:16px;margin-bottom:16px;">⚠️ 免费试用次数已用完</p>
        <p style="color:#a1a1aa;margin-bottom:20px;font-size:14px;">注册后获得更多免费额度，或升级专业版享受无限调用</p>
        <a href="/panel" class="btn-primary" style="display:inline-block;text-decoration:none;">立即注册</a>
      </div>
    `;
    return;
  }

  const form = document.getElementById('toolForm');
  const formData = new FormData(form);
  const data = {};

  config.fields.forEach(field => {
    if (field.type === 'checkbox') {
      data[field.name] = formData.get(field.name) === 'on';
    } else if (field.type === 'number' || field.type === 'range') {
      data[field.name] = parseFloat(formData.get(field.name));
    } else {
      let val = formData.get(field.name);
      // 处理 split 转换（textarea 每行转数组）
      if (config.transform && config.transform[field.name] === 'split') {
        val = val ? val.split(/\r?\n/).filter(Boolean) : [];
      }
      data[field.name] = val;
    }
  });

  const resultDiv = document.getElementById('toolResult');
  resultDiv.classList.remove('hidden');
  resultDiv.innerHTML = '<div class="tool-loading"><div class="spinner"></div></div>';

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    let url = config.endpoint;
    let options = { method: config.method, headers };

    if (config.method === 'GET') {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== null))
      );
      url += '?' + params.toString();
    } else {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    // 配额超限检测
    if (response.status === 429 || result.error?.includes('配额') || result.error?.includes('quota') || result.error?.includes('limit')) {
      showUpgradeModal(result.error || '您的 API 调用配额已用完');
      return;
    }

    displayResult(result, config, url, options, data);
    // 未登录时扣减免费试用次数
    if (!authToken) { useFreeTrial(); showTrialCount(); }
  } catch (error) {
    resultDiv.innerHTML = `<div class="tool-error">执行失败: ${error.message}</div>`;
  }
}

// 生成代码示例
function generateCodeExamples(endpoint, method, body, authHeader) {
  const examples = [];

  // JavaScript
  let jsCode = '';
  if (method === 'GET') {
    jsCode = `const res = await fetch('${endpoint}', {\n  headers: { ${authHeader ? `'Authorization': '${authHeader}'` : ''} }\n});\nconst data = await res.json();`;
  } else {
    const hasBody = body && Object.keys(body).length > 0;
    jsCode = `const res = await fetch('${endpoint}', {\n  method: '${method}',\n  headers: {\n    'Content-Type': 'application/json'${authHeader ? `,\n    'Authorization': '${authHeader}'` : ''}\n  }${hasBody ? `,\n  body: JSON.stringify(${JSON.stringify(body, null, 8).replace(/\n/g, '\n  ').replace(/^  "(\w+)": /gm, '$1: ')})` : ''}\n});\nconst data = await res.json();`;
  }
  examples.push({ lang: 'JavaScript', code: jsCode, icon: '🟨' });

  // Python
  let pyCode = '';
  if (method === 'GET') {
    pyCode = `import requests\n\nres = requests.get('${endpoint}'${authHeader ? `,\n    headers={'Authorization': '${authHeader}'}` : ''})\ndata = res.json()`;
  } else {
    pyCode = `import requests\n\nres = requests.${method.toLowerCase()}('${endpoint}',\n    headers={'Content-Type': 'application/json'${authHeader ? `,\n             'Authorization': '${authHeader}'` : ''}}${body && Object.keys(body).length ? `,\n    json=${JSON.stringify(body, null, 8)}` : ''})\ndata = res.json()`;
  }
  examples.push({ lang: 'Python', code: pyCode, icon: '🐍' });

  // cURL
  let curlCode = `curl -X ${method} '${endpoint}'`;
  if (authHeader) curlCode += ` \\\n  -H 'Authorization: ${authHeader}'`;
  if (method !== 'GET' && body && Object.keys(body).length) {
    curlCode += ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(body)}'`;
  }
  examples.push({ lang: 'cURL', code: curlCode, icon: '🟧' });

  return examples;
}

// 显示结果
function displayResult(result, config, endpoint, requestOptions, formData) {
  const resultDiv = document.getElementById('toolResult');
  const resultType = config.resultType || '';

  if (!result.success && !result.text && !result.formatted && !result.decoded) {
    resultDiv.innerHTML = `<div class="tool-error">❌ 错误: ${result.error || '未知错误'}</div>`;
    return;
  }

  const hasAuth = !!(authToken);
  const authHeader = hasAuth ? 'Bearer YOUR_TOKEN' : '';
  const method = config.method || 'POST';
  const cleanEndpoint = endpoint.replace('http://localhost:3000', '');
  const examples = generateCodeExamples(cleanEndpoint, method, formData, authHeader);

  let html = '<div class="result-tabs"><button class="result-tab active" onclick="showResultTab(\'output\')">📤 输出</button><button class="result-tab" onclick="showResultTab(\'code\')">💻 代码</button></div>';

  // 输出区
  html += '<div id="resultOutput">';
  if (resultType === 'image' && result.images) {
    result.images.forEach(img => {
      html += `<img src="${img.url}" style="max-width:100%;border-radius:8px;margin-bottom:12px;">`;
    });
  } else if (resultType === 'audio' && result.audioUrl) {
    html += `<audio controls src="${result.audioUrl}" style="width:100%;"></audio>`;
  } else {
    let content = result.text || result.formatted || result.decoded || result.translated || result.result || JSON.stringify(result, null, 2);
    html += `<pre class="result-pre">${escapeHtml(typeof content === 'string' ? content : JSON.stringify(content, null, 2))}</pre>`;
  }
  html += `<div class="result-actions">`;
  html += `<button class="btn-secondary btn-sm" onclick="copyResult()">📋 复制结果</button>`;
  if (result.cost !== undefined) html += `<span style="color:var(--text-muted);font-size:0.75rem;">💰 消耗: $${result.cost.toFixed(4)}</span>`;
  html += `</div></div>`;

  // 代码示例区
  html += '<div id="resultCode" style="display:none;">';
  examples.forEach(ex => {
    html += `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;color:var(--text-secondary);">${ex.icon} ${ex.lang}</span>
          <button class="btn-secondary btn-sm" onclick="copyCodeExample(this)" data-lang="${ex.lang}">复制</button>
        </div>
        <pre class="code-example">${escapeHtml(ex.code)}</pre>
      </div>`;
  });
  html += '</div>';

  resultDiv.innerHTML = html;
}

// 切换结果标签
function showResultTab(tab) {
  document.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('resultOutput').style.display = tab === 'output' ? 'block' : 'none';
  document.getElementById('resultCode').style.display = tab === 'code' ? 'block' : 'none';
}

// 复制代码示例
function copyCodeExample(btn) {
  const code = btn.closest('div').nextElementSibling.textContent;
  navigator.clipboard.writeText(code).then(() => {
    const orig = btn.textContent;
    btn.textContent = '已复制!';
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

// 复制结果
function copyResult() {
  const pre = document.querySelector('#resultOutput .result-pre');
  if (pre) {
    navigator.clipboard.writeText(pre.textContent).then(() => showToast('✅ 已复制到剪贴板'));
  }
}

// 关闭弹窗
function closeToolModal() {
  document.getElementById('toolModal').classList.add('hidden');
}

// 显示升级引导弹窗
function showUpgradeModal(message) {
  // 移除已存在的弹窗
  const existing = document.getElementById('upgradeModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'upgradeModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:20px;max-width:420px;width:100%;padding:32px;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,0.5);">
      <div style="width:64px;height:64px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:28px;">🚀</div>
      <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:12px;">配额已用完</h3>
      <p style="color:var(--text-muted);margin-bottom:24px;font-size:0.9rem;line-height:1.6;">${message || '您的免费额度已用完，升级专业版享受无限调用'}</p>
      <div style="display:flex;gap:12px;flex-direction:column;">
        <a href="/pricing" style="padding:12px 24px;background:var(--primary);color:white;border-radius:12px;text-decoration:none;font-weight:600;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">查看定价方案</a>
        <button onclick="document.getElementById('upgradeModal').remove()" style="padding:12px 24px;background:transparent;border:1px solid var(--border);border-radius:12px;color:var(--text-muted);cursor:pointer;font-weight:500;">稍后再说</button>
      </div>
      <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border);display:flex;justify-content:center;gap:24px;font-size:0.75rem;color:var(--text-muted);">
        <span>✓ 无限调用</span>
        <span>✓ 优先支持</span>
        <span>✓ 更多功能</span>
      </div>
    </div>
  `;
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示提示
function showToast(message) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
// ============ 搜索 + 收藏功能 ============
(function() {
  const FAV_KEY = 'mumei_favorites';

  function getFavorites() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
  }

  function saveFavorites(favs) { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }

  function isFav(id) { return getFavorites().includes(id); }

  function initFavorites() {
    const cards = document.querySelectorAll('.tool-card');
    cards.forEach(function(card) {
      const id = card.dataset.tool;
      if (!id) return;
      const star = document.createElement('button');
      star.className = 'fav-star';
      star.dataset.tool = id;
      star.innerHTML = isFav(id) ? '&#9733;' : '&#9734;';
      star.title = isFav(id) ? '取消收藏' : '收藏工具';
      star.style.cssText = 'position:absolute;top:12px;right:12px;background:none;border:none;font-size:18px;cursor:pointer;color:' + (isFav(id) ? '#f59e0b' : '#71717a') + ';transition:color 0.2s,transform 0.15s;z-index:2;line-height:1;';
      star.addEventListener('mouseenter', function() { star.style.transform = 'scale(1.2)'; });
      star.addEventListener('mouseleave', function() { star.style.transform = 'scale(1)'; });
      star.addEventListener('click', function(e) { e.stopPropagation(); toggleFav(id, star); });
      card.style.position = 'relative';
      card.appendChild(star);
    });
  }

  var showFavoritesOnly = false;

  function toggleFav(id, star) {
    var favs = getFavorites();
    if (favs.indexOf(id) > -1) {
      favs = favs.filter(function(f) { return f !== id; });
    } else {
      favs.push(id);
    }
    saveFavorites(favs);
    star.innerHTML = favs.indexOf(id) > -1 ? '&#9733;' : '&#9734;';
    star.style.color = favs.indexOf(id) > -1 ? '#f59e0b' : '#71717a';
    if (showFavoritesOnly && favs.indexOf(id) === -1) {
      var el = document.querySelector('.tool-card[data-tool="' + id + '"]');
      if (el) el.style.display = 'none';
    }
    updateNoResults();
  }

  window.toggleFavoriteView = function() {
    showFavoritesOnly = !showFavoritesOnly;
    var btn = document.getElementById('toggleFavorites');
    var label = document.getElementById('favLabel');
    if (showFavoritesOnly) {
      btn.style.borderColor = '#f59e0b';
      btn.style.color = '#f59e0b';
      btn.style.background = 'rgba(245,158,11,0.1)';
      label.textContent = '已收藏';
      document.querySelectorAll('.tool-card').forEach(function(c) {
        c.style.display = isFav(c.dataset.tool) ? '' : 'none';
      });
    } else {
      btn.style.borderColor = '';
      btn.style.color = '';
      btn.style.background = '';
      label.textContent = '收藏';
      applyFilters();
    }
    updateNoResults();
  };

  function updateNoResults() {
    var noResults = document.getElementById('noResults');
    if (!noResults) return;
    var visible = [].filter.call(document.querySelectorAll('.tool-card'), function(c) { return c.style.display !== 'none'; });
    noResults.style.display = visible.length === 0 ? 'block' : 'none';
  }

  function applyFilters() {
    var searchInput = document.getElementById('toolSearch');
    var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var activeTab = document.querySelector('.tool-tab.active');
    var cat = activeTab ? activeTab.dataset.category : 'all';
    var cards = document.querySelectorAll('.tool-card');
    cards.forEach(function(card) {
      var cardCat = card.dataset.category || '';
      var text = (card.textContent || '').toLowerCase();
      var matchesCat = cat === 'all' || cardCat === cat;
      var matchesQ = !q || text.indexOf(q) > -1;
      var matchesFav = !showFavoritesOnly || isFav(card.dataset.tool);
      card.style.display = matchesCat && matchesQ && matchesFav ? '' : 'none';
    });
    updateNoResults();
  }

  var searchTimer;
  document.addEventListener('DOMContentLoaded', function() {
    var searchInput = document.getElementById('toolSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilters, 200);
      });
      // 聚焦时加边框高亮
      searchInput.addEventListener('focus', function() {
        searchInput.style.borderColor = 'var(--primary)';
      });
      searchInput.addEventListener('blur', function() {
        searchInput.style.borderColor = '';
      });
    }

    document.querySelectorAll('.tool-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tool-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        applyFilters();
      });
    });

    initFavorites();
    applyFilters();
  });
})();

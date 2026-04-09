
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
  }
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
      data[field.name] = formData.get(field.name);
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

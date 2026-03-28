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
  // 更新标题
  const title = document.getElementById('tools');
  if (title) title.textContent = translations.toolbox || translations.tools || '工具箱';
  
  // 更新导航
  const navLinks = document.querySelectorAll('.navbar-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === '/tools') link.textContent = translations.toolbox || '工具箱';
    if (href === '/panel') link.textContent = translations.userPanel || '用户面板';
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
  const form = document.getElementById('toolForm');
  const formData = new FormData(form);
  const data = {};

  // 收集表单数据
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
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    let url = config.endpoint;
    let options = {
      method: config.method,
      headers
    };

    if (config.method === 'GET') {
      const params = new URLSearchParams(data);
      url += '?' + params.toString();
    } else {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    displayResult(result, config.resultType);
  } catch (error) {
    resultDiv.innerHTML = `<div class="tool-error">执行失败: ${error.message}</div>`;
  }
}

// 显示结果
function displayResult(result, resultType) {
  const resultDiv = document.getElementById('toolResult');
  
  if (!result.success) {
    resultDiv.innerHTML = `<div class="tool-error">错误: ${result.error || '未知错误'}</div>`;
    return;
  }

  let html = '<h4>执行结果</h4>';

  if (resultType === 'image' && result.images) {
    result.images.forEach(img => {
      html += `<img src="${img.url}" style="max-width: 100%; border-radius: 8px; margin-bottom: 12px;">`;
    });
  } else if (resultType === 'audio' && result.audioUrl) {
    html += `<audio controls src="${result.audioUrl}" style="width: 100%;"></audio>`;
  } else if (result.text || result.formatted || result.decoded || result.translated) {
    const content = result.text || result.formatted || result.decoded || result.translated;
    html += `<pre>${escapeHtml(content)}</pre>`;
  } else {
    html += `<pre>${JSON.stringify(result, null, 2)}</pre>`;
  }

  // 添加操作按钮
  html += `
    <div class="result-actions">
      <button class="btn-secondary" onclick="copyResult()">复制结果</button>
      ${result.cost !== undefined ? `<span style="color: var(--text-muted); font-size: 0.75rem;">消耗: $${result.cost.toFixed(4)}</span>` : ''}
    </div>
  `;

  resultDiv.innerHTML = html;
}

// 复制结果
function copyResult() {
  const pre = document.querySelector('#toolResult pre');
  if (pre) {
    navigator.clipboard.writeText(pre.textContent);
    showToast('已复制到剪贴板');
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

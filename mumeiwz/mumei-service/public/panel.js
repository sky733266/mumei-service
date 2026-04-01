// 当前语言
let currentLang = localStorage.getItem('language') || 'zh';
let translations = {};
let authToken = localStorage.getItem('authToken');
let countdownTimer = null;
let currentLogsPage = 1;
let totalLogsPages = 1;
let currentUser = null;

// DOM元素
let languageSelect, authSection, panelContent, loginTab, registerTab, loginForm, registerForm, sendCodeBtn;

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
  // 获取DOM元素
  languageSelect = document.getElementById('languageSelect');
  authSection = document.getElementById('authSection');
  panelContent = document.getElementById('panelContent');
  loginTab = document.getElementById('loginTab');
  registerTab = document.getElementById('registerTab');
  loginForm = document.getElementById('loginForm');
  registerForm = document.getElementById('registerForm');
  sendCodeBtn = document.getElementById('sendCodeBtn');
  
  if (languageSelect) {
    languageSelect.value = currentLang;
    await loadTranslations(currentLang);
    setupEventListeners();
    
    if (authToken) {
      await checkAuth();
    }
  }
});

// 加载翻译
async function loadTranslations(lang) {
  try {
    const response = await fetch(`/api/translations/${lang}`);
    translations = await response.json();
    updateUI();
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  } catch (error) {
    console.error('加载翻译失败:', error);
  }
}

// 更新UI文本
function updateUI() {
  document.getElementById('userPanel').textContent = translations.userPanel || '用户面板';
  loginTab.textContent = translations.login;
  registerTab.textContent = translations.register;
  document.getElementById('emailLabel').textContent = translations.email;
  document.getElementById('passwordLabel').textContent = translations.password;
  document.getElementById('loginBtn').textContent = translations.login;
  document.getElementById('registerEmailLabel').textContent = translations.email;
  document.getElementById('registerPasswordLabel').textContent = translations.password;
  document.getElementById('confirmPasswordLabel').textContent = translations.confirmPassword;
  document.getElementById('verifyCodeLabel').textContent = translations.verifyCode;
  sendCodeBtn.textContent = translations.sendCode;
  document.getElementById('registerSubmitBtn').textContent = translations.register;
  
  // 统计相关
  document.getElementById('usageStats').textContent = translations.usageStats;
  document.getElementById('dailyUsageLabel').textContent = translations.dailyUsage;
  document.getElementById('monthlyUsageLabel').textContent = translations.monthlyUsage;
  document.getElementById('totalCallsLabel').textContent = translations.totalCalls;
  document.getElementById('successRateLabel').textContent = translations.successRate;
  document.getElementById('avgResponseLabel').textContent = translations.avgResponse;
  document.getElementById('activeTokensLabel').textContent = translations.maxTokens;
  
  // 套餐相关
  document.getElementById('currentPlan').textContent = translations.currentPlan;
  document.getElementById('upgrade').textContent = translations.upgrade;
  document.getElementById('plansTitle').textContent = translations.plans;
  
  // Token相关
  document.getElementById('myTokens').textContent = translations.myTokens;
  document.getElementById('createToken').textContent = translations.createToken;
  document.getElementById('createTokenTitle').textContent = translations.createToken;
  document.getElementById('tokenNameLabel').textContent = translations.tokenName;
  
  // 日志相关
  document.getElementById('apiLogs').textContent = translations.apiLogs;
  document.getElementById('endpoint').textContent = translations.endpoint;
  document.getElementById('status').textContent = translations.status;
  document.getElementById('time').textContent = translations.time;
  document.getElementById('duration').textContent = translations.duration;
  
  document.getElementById('logout').textContent = translations.logout;
}

// 设置事件监听
function setupEventListeners() {
  languageSelect.addEventListener('change', (e) => {
    currentLang = e.target.value;
    loadTranslations(currentLang);
  });

  loginTab.addEventListener('click', () => switchTab('login'));
  registerTab.addEventListener('click', () => switchTab('register'));

  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);

  sendCodeBtn.addEventListener('click', sendVerificationCode);

  createTokenBtn.addEventListener('click', () => {
    createTokenModal.classList.remove('hidden');
  });

  document.getElementById('cancelCreateToken').addEventListener('click', () => {
    createTokenModal.classList.add('hidden');
    document.getElementById('tokenName').value = '';
  });

  document.getElementById('confirmCreateToken').addEventListener('click', createToken);

  document.getElementById('closeTokenModal').addEventListener('click', () => {
    showTokenModal.classList.add('hidden');
  });

  document.getElementById('copyNewToken').addEventListener('click', () => {
    const token = document.getElementById('newToken').textContent;
    navigator.clipboard.writeText(token);
    showToast('Token已复制');
  });

  // 套餐相关
  document.getElementById('viewPlansBtn').addEventListener('click', loadPlans);
  document.getElementById('closePlansModal').addEventListener('click', () => {
    plansModal.classList.add('hidden');
  });

  // 日志分页
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentLogsPage > 1) {
      currentLogsPage--;
      loadLogs();
    }
  });

  document.getElementById('nextPage').addEventListener('click', () => {
    if (currentLogsPage < totalLogsPages) {
      currentLogsPage++;
      loadLogs();
    }
  });

  document.getElementById('logFilter').addEventListener('change', () => {
    currentLogsPage = 1;
    loadLogs();
  });

  logoutBtn.addEventListener('click', logout);
}

// 切换标签
function switchTab(tab) {
  if (tab === 'login') {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  }
}

// 发送验证码
async function sendVerificationCode() {
  const email = document.getElementById('registerEmail').value;
  
  if (!email || !email.includes('@')) {
    showToast('请输入有效的邮箱地址');
    return;
  }

  sendCodeBtn.disabled = true;
  
  try {
    const response = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang: currentLang })
    });

    const data = await response.json();
    
    if (data.success) {
      showToast('验证码已发送');
      startCountdown();
    } else {
      showToast(data.error || '发送失败');
      sendCodeBtn.disabled = false;
    }
  } catch (error) {
    console.error('发送验证码失败:', error);
    showToast('发送失败，请重试');
    sendCodeBtn.disabled = false;
  }
}

// 倒计时
function startCountdown() {
  let seconds = 60;
  sendCodeBtn.textContent = `${seconds}s`;
  
  countdownTimer = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      sendCodeBtn.textContent = `${seconds}s`;
    } else {
      clearInterval(countdownTimer);
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = translations.sendCode;
    }
  }, 1000);
}

// 登录
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (data.success) {
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      currentUser = data.user;
      showPanel(data.user);
      showToast('登录成功');
    } else {
      showToast(data.error || '登录失败');
    }
  } catch (error) {
    console.error('登录失败:', error);
    showToast('登录失败，请重试');
  }
}

// 注册
async function handleRegister(e) {
  e.preventDefault();
  
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const codeEl = document.getElementById('verifyCode');
  const code = codeEl ? codeEl.value : '';
  // 读取 URL 中的邀请码
  const ref = new URLSearchParams(location.search).get('ref') || '';

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email, 
        password, 
        confirmPassword, 
        code,
        ref,
        lang: currentLang 
      })
    });

    const data = await response.json();
    
    if (data.success) {
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      currentUser = data.user;
      showPanel(data.user);
      showToast('注册成功');
    } else {
      showToast(data.error || '注册失败');
    }
  } catch (error) {
    console.error('注册失败:', error);
    showToast('注册失败，请重试');
  }
}

// 检查认证状态
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      showPanel(data.user);
    } else {
      logout();
    }
  } catch (error) {
    console.error('检查认证失败:', error);
    logout();
  }
}

// 显示面板
function showPanel(user) {
  document.getElementById('userEmail').textContent = user.email;
  authSection.classList.add('hidden');
  panelContent.classList.remove('hidden');
  
  loadStats();
  loadCurrentPlan();
  loadTokens();
  loadLogs();
  loadOrders();
  loadRecentUsage();
  loadReferrals();
}

// 加载统计数据
async function loadStats() {
  try {
    const response = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    if (!data.success) return;

    const s = data.stats;
    document.getElementById('dailyUsage').textContent = s.dailyUsage ?? 0;
    document.getElementById('monthlyUsage').textContent = s.monthlyUsage ?? 0;
    document.getElementById('totalCalls').textContent = s.totalCalls ?? 0;
    document.getElementById('successRate').textContent = (s.successRate ?? 100) + '%';
    document.getElementById('avgResponse').textContent = (s.avgResponse ?? 0) + 'ms';
    document.getElementById('activeTokens').textContent = s.activeTokens ?? 0;

    // 进度条（需要套餐限额）
    const planRes = await fetch('/api/plans/current', { headers: { 'Authorization': `Bearer ${authToken}` } });
    const planData = await planRes.json();
    if (planData.plan) {
      const dailyLimit = planData.plan.features.dailyRequests;
      const monthlyLimit = planData.plan.features.monthlyRequests;
      document.getElementById('dailyProgress').style.width = Math.min((s.dailyUsage / dailyLimit) * 100, 100) + '%';
      document.getElementById('monthlyProgress').style.width = Math.min((s.monthlyUsage / monthlyLimit) * 100, 100) + '%';
    }
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

// 加载当前套餐
async function loadCurrentPlan() {
  try {
    const response = await fetch('/api/plans/current', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    if (data.plan) {
      const planNameMap = {
        'free': translations.free,
        'pro': translations.pro,
        'enterprise': translations.enterprise
      };
      
      document.getElementById('planBadge').textContent = planNameMap[data.plan.id] || data.plan.name;
      document.getElementById('dailyLimit').textContent = 
        `${translations.dailyLimit}: ${data.plan.features.dailyRequests.toLocaleString()}`;
      document.getElementById('monthlyLimit').textContent = 
        `${translations.monthlyLimit}: ${data.plan.features.monthlyRequests.toLocaleString()}`;
      document.getElementById('maxTokens').textContent = 
        `${translations.maxTokens}: ${data.plan.features.maxTokens}`;
      document.getElementById('maxFileSize').textContent = 
        `${translations.maxFileSize}: ${data.plan.features.pdfSize}MB`;
    }
  } catch (error) {
    console.error('加载套餐失败:', error);
  }
}

// 加载套餐列表
async function loadPlans() {
  try {
    const response = await fetch('/api/plans');
    const data = await response.json();
    
    const plansList = document.getElementById('plansList');
    const planNameMap = {
      'free': translations.free,
      'pro': translations.pro,
      'enterprise': translations.enterprise
    };
    
    plansList.innerHTML = data.plans.map(plan => {
      const isCurrent = currentUser && currentUser.plan === plan.id;
      const isRecommended = plan.id === 'pro';
      
      return `
        <div class="plan-card-item ${isCurrent ? 'current' : ''} ${isRecommended ? 'recommended' : ''}">
          <h3>${planNameMap[plan.id] || plan.name}</h3>
          <div class="plan-price">
            ${plan.price === 0 ? translations.free : `$${plan.price}`}
            ${plan.price > 0 ? `<span>${translations.perMonth}</span>` : ''}
          </div>
          <p class="plan-description">${currentLang === 'zh' ? plan.description : plan.descriptionEn}</p>
          <ul class="plan-features-list">
            <li>${translations.dailyLimit}: ${plan.features.dailyRequests.toLocaleString()}</li>
            <li>${translations.monthlyLimit}: ${plan.features.monthlyRequests.toLocaleString()}</li>
            <li>${translations.maxTokens}: ${plan.features.maxTokens}</li>
            <li>${translations.maxFileSize}: ${plan.features.pdfSize}MB</li>
          </ul>
          <button class="btn-primary" ${isCurrent ? 'disabled' : ''} onclick="subscribePlan('${plan.id}')">
            ${isCurrent ? '当前套餐' : (plan.price === 0 ? '选择' : translations.upgrade)}
          </button>
        </div>
      `;
    }).join('');
    
    plansModal.classList.remove('hidden');
  } catch (error) {
    console.error('加载套餐失败:', error);
  }
}

// 订阅套餐
async function subscribePlan(planId) {
  if (planId === currentUser?.plan) return;
  
  try {
    const response = await fetch('/api/plans/subscribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ planId })
    });

    const data = await response.json();
    
    if (data.success) {
      showToast('订阅成功');
      plansModal.classList.add('hidden');
      currentUser.plan = planId;
      loadCurrentPlan();
    } else {
      showToast(data.error || '订阅失败');
    }
  } catch (error) {
    console.error('订阅失败:', error);
    showToast('订阅失败，请重试');
  }
}

// 加载Token列表
async function loadTokens() {
  try {
    const response = await fetch('/api/tokens', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    renderTokenList(data.tokens);
  } catch (error) {
    console.error('加载Token失败:', error);
  }
}

// 渲染Token列表
function renderTokenList(tokens) {
  const tokenList = document.getElementById('tokenList');

  if (!tokens || tokens.length === 0) {
    tokenList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1M8 7H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1"/>
          <rect x="8" y="7" width="8" height="10" rx="1"/>
        </svg>
        <p>暂无Token，点击上方按钮创建</p>
      </div>
    `;
    return;
  }

  tokenList.innerHTML = tokens.map(token => {
    // 数据库字段：revoked=0 表示启用，revoked=1 表示禁用
    const isActive = !token.revoked;
    const createdAt = token.created_at || token.createdAt || '';
    const lastUsed = token.last_used ? new Date(token.last_used).toLocaleDateString('zh-CN') : '从未使用';

    return `
      <div class="token-item ${isActive ? '' : 'inactive'}">
        <div class="token-info">
          <div class="token-name">${token.name || 'API Token'}</div>
          <div class="token-meta">
            创建于 ${createdAt ? new Date(createdAt).toLocaleDateString('zh-CN') : '-'} |
            最后使用: ${lastUsed} |
            <span style="color:${isActive ? '#22c55e' : '#ef4444'}">${isActive ? '启用中' : '已禁用'}</span>
          </div>
        </div>
        <div class="token-actions">
          <button class="btn-secondary" onclick="toggleToken('${token.id}')">
            ${isActive ? '禁用' : '启用'}
          </button>
          <button class="btn-secondary" onclick="deleteToken('${token.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

// 创建Token
async function createToken() {
  const name = document.getElementById('tokenName').value || 'API Token';
  
  try {
    const response = await fetch('/api/tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });

    const data = await response.json();
    
    if (data.success) {
      createTokenModal.classList.add('hidden');
      document.getElementById('tokenName').value = '';
      
      document.getElementById('newToken').textContent = data.token.token;
      showTokenModal.classList.remove('hidden');
      
      loadTokens();
      loadStats();
    } else {
      if (data.upgrade) {
        showToast('Token数量已达上限，请升级套餐');
        loadPlans();
      } else {
        showToast(data.error || '创建失败');
      }
    }
  } catch (error) {
    console.error('创建Token失败:', error);
    showToast('创建失败，请重试');
  }
}

// 切换Token状态
async function toggleToken(tokenId) {
  try {
    const response = await fetch(`/api/tokens/${tokenId}/toggle`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    if (data.success) {
      loadTokens();
      showToast(data.active ? 'Token已启用' : 'Token已禁用');
    }
  } catch (error) {
    console.error('切换Token状态失败:', error);
  }
}

// 删除Token
async function deleteToken(tokenId) {
  if (!confirm('确定要删除此Token吗？')) return;
  
  try {
    const response = await fetch(`/api/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    if (data.success) {
      loadTokens();
      showToast('Token已删除');
    }
  } catch (error) {
    console.error('删除Token失败:', error);
  }
}

// 加载API日志
async function loadLogs() {
  try {
    const filter = document.getElementById('logFilter').value;
    const url = new URL('/api/logs', window.location.origin);
    url.searchParams.append('page', currentLogsPage);
    url.searchParams.append('limit', 20);
    if (filter) url.searchParams.append('endpoint', filter);
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    renderLogs(data.logs);
    currentLogsPage = data.page;
    totalLogsPages = data.totalPages;
    
    document.getElementById('pageInfo').textContent = `${data.page} / ${data.totalPages}`;
    document.getElementById('prevPage').disabled = data.page <= 1;
    document.getElementById('nextPage').disabled = data.page >= data.totalPages;
  } catch (error) {
    console.error('加载日志失败:', error);
  }
}

// 渲染日志
function renderLogs(logs) {
  const tbody = document.getElementById('logsTableBody');
  
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">暂无日志</td></tr>';
    return;
  }
  
  tbody.innerHTML = logs.map(log => {
    const statusCode = log.status_code || log.status || 200;
    const duration = log.response_time || log.duration || 0;
    const isSuccess = statusCode >= 200 && statusCode < 300;
    return `
      <tr>
        <td>${log.endpoint || '-'}</td>
        <td>
          <span class="status-badge ${isSuccess ? 'status-success' : 'status-error'}">
            ${statusCode}
          </span>
        </td>
        <td>${log.timestamp ? new Date(log.timestamp).toLocaleString('zh-CN') : '-'}</td>
        <td>${duration}ms</td>
      </tr>
    `;
  }).join('');
}

// 退出登录
function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  authSection.classList.remove('hidden');
  panelContent.classList.add('hidden');
  document.getElementById('userEmail').textContent = '';
  showToast('已退出登录');
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

// 启动
document.addEventListener('DOMContentLoaded', init);

// ============ 忘记密码 ============
function showForgotPassword() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('forgotForm').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('forgotForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
}

async function submitForgotPassword() {
  const email = document.getElementById('forgotEmail').value;
  const msgEl = document.getElementById('forgotMsg');
  if (!email) { msgEl.textContent = '请输入邮箱'; msgEl.style.color = '#ef4444'; return; }

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    msgEl.textContent = data.message || '重置链接已发送，请查收邮件';
    msgEl.style.color = '#22c55e';
  } catch (e) {
    msgEl.textContent = '发送失败，请稍后重试';
    msgEl.style.color = '#ef4444';
  }
}

// ============ 订单历史 ============
async function loadOrders() {
  const container = document.getElementById('orderList');
  if (!container) return;

  try {
    const res = await fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();

    if (!data.success || !data.orders || data.orders.length === 0) {
      container.innerHTML = '<p style="color:#71717a;font-size:14px;padding:8px 0;">暂无订单记录</p>';
      return;
    }

    const planNames = { free: '免费版', pro: '专业版', enterprise: '企业版' };
    const methodNames = { paypal: 'PayPal', stripe_card: '信用卡', epay_alipay: '支付宝', epay_wechat: '微信支付' };
    const statusMap = { pending: '⏳ 待支付', completed: '✅ 已完成', failed: '❌ 失败', cancelled: '🚫 已取消' };

    container.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="color:#71717a;border-bottom:1px solid #2a2a3a;">
            <th style="text-align:left;padding:8px 4px;">套餐</th>
            <th style="text-align:left;padding:8px 4px;">金额</th>
            <th style="text-align:left;padding:8px 4px;">方式</th>
            <th style="text-align:left;padding:8px 4px;">状态</th>
            <th style="text-align:left;padding:8px 4px;">时间</th>
          </tr>
        </thead>
        <tbody>
          ${data.orders.map(o => `
            <tr style="border-bottom:1px solid #1a1a24;">
              <td style="padding:10px 4px;">${planNames[o.planId] || o.planId}</td>
              <td style="padding:10px 4px;">$${parseFloat(o.amount || 0).toFixed(2)}</td>
              <td style="padding:10px 4px;">${methodNames[o.method] || o.method}</td>
              <td style="padding:10px 4px;">${statusMap[o.status] || o.status}</td>
              <td style="padding:10px 4px;color:#71717a;">${o.createdAt ? new Date(o.createdAt).toLocaleDateString('zh-CN') : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    container.innerHTML = '<p style="color:#71717a;font-size:14px;">加载失败</p>';
  }
}

// ============ 最近使用记录 ============
async function loadRecentUsage() {
  const container = document.getElementById('recentUsage');
  if (!container) return;

  try {
    const res = await fetch('/api/logs?limit=5&page=1', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();

    if (!data.success || !data.logs || data.logs.length === 0) {
      container.innerHTML = '<p style="color:#71717a;">暂无使用记录，开始使用工具吧！</p>';
      return;
    }

    // 工具名映射
    const toolNameMap = {
      '/api/tools/data/json-format': '📋 JSON格式化',
      '/api/tools/data/base64-encode': '🔢 Base64编码',
      '/api/tools/data/base64-decode': '🔢 Base64解码',
      '/api/tools/security/password-generate': '🔑 密码生成',
      '/api/tools/security/hash': '#️⃣ 哈希计算',
      '/api/tools/security/url-encode': '🔗 URL编码',
      '/api/tools/security/uuid-generate': '🆔 UUID生成',
      '/api/tools/dev/code-format': '✨ 代码格式化',
      '/api/tools/dev/cron-parse': '⏰ Cron解析',
      '/api/tools/dev/timestamp-convert': '🕐 时间戳转换',
      '/api/tools/ai/text-generate': '🤖 AI文本生成',
      '/api/tools/ai/translate': '🌐 AI翻译'
    };

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${data.logs.map(log => {
          const name = toolNameMap[log.endpoint] || log.endpoint || '未知工具';
          const time = log.timestamp ? new Date(log.timestamp).toLocaleString('zh-CN') : '';
          const status = (log.status_code || log.status || 200) >= 200 && (log.status_code || log.status || 200) < 300
            ? '✅'
            : '❌';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#12121a;border-radius:8px;border:1px solid #2a2a3a;">
              <span style="display:flex;align-items:center;gap:8px;">
                <span>${status}</span>
                <span style="color:#e4e4e7;font-size:13px;">${name}</span>
              </span>
              <span style="color:#71717a;font-size:12px;">${time}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<p style="color:#71717a;">加载失败</p>';
  }
}

// ============ 邀请奖励 ============
async function loadReferrals() {
  try {
    const res = await fetch('/api/referrals', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const linkEl = document.getElementById('inviteLink');
    if (linkEl) linkEl.value = data.inviteLink || '';

    const s = data.stats || {};
    const totalEl = document.getElementById('refTotal');
    const regEl   = document.getElementById('refRegistered');
    const rewEl   = document.getElementById('refReward');
    if (totalEl) totalEl.textContent = s.total || 0;
    if (regEl)   regEl.textContent   = s.registered || 0;
    if (rewEl)   rewEl.textContent   = s.totalReward || 0;
  } catch (e) {
    console.error('加载邀请数据失败:', e);
  }
}

function copyInviteLink() {
  const linkEl = document.getElementById('inviteLink');
  if (!linkEl || !linkEl.value) return;
  navigator.clipboard.writeText(linkEl.value).then(() => showToast('✅ 邀请链接已复制'));
}

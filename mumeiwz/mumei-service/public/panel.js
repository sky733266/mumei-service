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

// 更新UI文本（安全版，元素不存在时跳过）
function updateUI() {
  // 辅助函数：安全设置文本
  function t(id, key, fallback) {
    const el = document.getElementById(id);
    if (el && translations[key]) el.textContent = translations[key];
    else if (el && fallback) el.textContent = fallback;
  }

  document.documentElement.lang = currentLang;

  // 导航
  t('userPanel', 'userPanel', '用户面板');
  t('logout', 'logout', '退出登录');
  if (loginTab) loginTab.textContent = translations.login || '登录';
  if (registerTab) registerTab.textContent = translations.register || '注册';

  // 登录表单
  t('emailLabel', 'email', '邮箱');
  t('passwordLabel', 'password', '密码');
  t('loginBtn', 'login', '登录');
  t('registerEmailLabel', 'email', '邮箱');
  t('registerPasswordLabel', 'password', '密码');
  t('confirmPasswordLabel', 'confirmPassword', '确认密码');
  t('verifyCodeLabel', 'verifyCode', '验证码');
  if (sendCodeBtn) sendCodeBtn.textContent = translations.sendCode || '发送验证码';
  t('registerSubmitBtn', 'register', '注册');

  // 统计
  t('usageStats', 'usageStats', '使用统计');
  t('dailyUsageLabel', 'dailyUsage', '今日调用');
  t('monthlyUsageLabel', 'monthlyUsage', '本月调用');
  t('totalCallsLabel', 'totalCalls', '总调用次数');
  t('successRateLabel', 'successRate', '成功率');
  t('avgResponseLabel', 'avgResponse', '平均响应');
  t('activeTokensLabel', 'activeTokens', '活跃Token');

  // 套餐
  t('currentPlan', 'currentPlan', '当前套餐');
  t('upgrade', 'upgrade', '升级套餐');
  t('plansTitle', 'plans', '套餐列表');

  // Token
  t('myTokens', 'myTokens', '我的Token');
  t('createToken', 'createToken', '创建Token');
  t('createTokenTitle', 'createToken', '创建Token');
  t('tokenNameLabel', 'tokenName', 'Token名称');

  // 日志
  t('apiLogs', 'apiLogs', 'API日志');
  t('endpoint', 'endpoint', '接口');
  t('status', 'status', '状态');
  t('time', 'time', '时间');
  t('duration', 'duration', '耗时');

  // 订单
  t('orderHistoryTitle', 'orderHistory', '订单历史');

  // 邀请
  t('referralTitle', 'referral', '邀请奖励');
  t('copyLinkBtn', 'copyLink', '复制链接');

  // 最近使用
  t('recentUsageTitle', 'recentUsage', '最近使用');

  // data-i18n 批量翻译
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[key]) el.textContent = translations[key];
  });
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
  renderUsageChart();
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
    
    // 检查是否超过30天未使用
    let unusedWarning = '';
    if (isActive && token.last_used) {
      const daysSince = (Date.now() - new Date(token.last_used).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 30) {
        unusedWarning = `<span style="background:#fbbf24;color:#000;font-size:11px;padding:2px 6px;border-radius:4px;margin-left:8px;">⚠️ ${Math.floor(daysSince)}天未使用</span>`;
      }
    }

    return `
      <div class="token-item ${isActive ? '' : 'inactive'}">
        <div class="token-info">
          <div class="token-name">${token.name || 'API Token'}${unusedWarning}</div>
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

// ============ 使用趋势图表 ============
async function renderUsageChart() {
  const canvas = document.getElementById('usageChart');
  if (!canvas || typeof Chart === 'undefined') return;
  try {
    const res = await fetch('/api/logs?page=1&limit=500', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '') }
    });
    if (!res.ok) return;
    const data = await res.json();
    const logs = data.logs || [];
    const days = [];
    const counts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push((d.getMonth()+1) + '/' + d.getDate());
      counts.push(logs.filter(l => (l.timestamp||'').startsWith(key)).length);
    }
    if (window.usageChartInstance) window.usageChartInstance.destroy();
    window.usageChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'API Calls',
          data: counts,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#6366f1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#71717a', font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#71717a', font: { size: 11 }, stepSize: 1 } }
        }
      }
    });
  } catch (e) {}
}

// 导出日志为CSV
function exportLogs() {
  window.open('/api/logs/export', '_blank');
}

// 导出日志为Excel
async function exportLogsExcel() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    alert('请先登录');
    return;
  }
  
  try {
    // 获取所有日志数据
    const res = await fetch('/api/logs?page=1&limit=10000', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (!res.ok) {
      throw new Error('获取日志失败');
    }
    
    const data = await res.json();
    const logs = data.logs || [];
    
    if (logs.length === 0) {
      alert('暂无日志数据');
      return;
    }
    
    // 构建 Excel XML 内容
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>';
    const workbookStart = '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    const worksheetStart = '<Worksheet ss:Name="API日志"><Table>';
    
    // 表头
    const headerRow = `<Row>
      <Cell><Data ss:Type="String">时间</Data></Cell>
      <Cell><Data ss:Type="String">接口</Data></Cell>
      <Cell><Data ss:Type="String">状态</Data></Cell>
      <Cell><Data ss:Type="String">IP地址</Data></Cell>
      <Cell><Data ss:Type="String">响应时间</Data></Cell>
      <Cell><Data ss:Type="String">Token</Data></Cell>
    </Row>`;
    
    // 数据行
    const dataRows = logs.map(log => `<Row>
      <Cell><Data ss:Type="String">${(log.timestamp || '').replace('T', ' ').slice(0, 19)}</Data></Cell>
      <Cell><Data ss:Type="String">${log.endpoint || ''}</Data></Cell>
      <Cell><Data ss:Type="String">${log.status || ''}</Data></Cell>
      <Cell><Data ss:Type="String">${log.ip || ''}</Data></Cell>
      <Cell><Data ss:Type="Number">${log.response_time || 0}</Data></Cell>
      <Cell><Data ss:Type="String">${(log.token || '').slice(0, 20)}...</Data></Cell>
    </Row>`).join('');
    
    const worksheetEnd = '</Table></Worksheet>';
    const workbookEnd = '</Workbook>';
    
    const fullXml = xmlHeader + workbookStart + worksheetStart + headerRow + dataRows + worksheetEnd + workbookEnd;
    
    // 创建下载
    const blob = new Blob([fullXml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `API日志_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
  } catch (err) {
    console.error('导出Excel失败:', err);
    alert('导出失败: ' + err.message);
  }
}

// ============ 活动日历 ============
function renderActivityCalendar(logs) {
  const container = document.getElementById('activityCalendar');
  if (!container) return;
  
  // 统计每天调用次数
  const dayCounts = {};
  logs.forEach(l => {
    if (l.timestamp) {
      const day = l.timestamp.slice(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
  });
  
  // 生成最近8周的格子
  const today = new Date();
  let html = '';
  for (let w = 7; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - w * 7 - (6 - d));
      const key = date.toISOString().slice(0, 10);
      const count = dayCounts[key] || 0;
      const level = count === 0 ? 0 : count < 5 ? 1 : count < 20 ? 2 : count < 50 ? 3 : 4;
      const colors = ['#1a1a2e', '#312e81', '#4338ca', '#6366f1', '#818cf8'];
      html += `<div style="width:10px;height:10px;background:${colors[level]};border-radius:2px;" title="${key}: ${count}次"></div>`;
    }
  }
  container.innerHTML = html;
}

// 在 renderUsageChart 结尾调用
const origRender = window.renderUsageChart;
window.renderUsageChart = async function() {
  await origRender?.();
  try {
    const res = await fetch('/api/logs?page=1&limit=1000', {
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('authToken') || '') }
    });
    if (res.ok) {
      const data = await res.json();
      renderActivityCalendar(data.logs || []);
    }
  } catch(e) {}
};

// ============ 批量操作功能 ============
let batchMode = false;
let selectedTokens = new Set();

function toggleBatchMode() {
  batchMode = !batchMode;
  selectedTokens.clear();
  updateBatchUI();
  renderTokens(window.currentTokens || []);
}

function updateBatchUI() {
  const selectBtn = document.getElementById('batchSelectBtn');
  const deleteBtn = document.getElementById('batchDeleteBtn');
  const selectText = document.getElementById('batchSelectText');
  const deleteText = document.getElementById('batchDeleteText');
  
  if (batchMode) {
    selectBtn?.classList.add('active');
    deleteBtn?.style.setProperty('display', 'inline-flex');
    selectText && (selectText.textContent = '取消');
  } else {
    selectBtn?.classList.remove('active');
    deleteBtn?.style.setProperty('display', 'none');
    selectText && (selectText.textContent = '批量选择');
  }
  
  if (deleteText) {
    deleteText.textContent = `删除选中 (${selectedTokens.size})`;
  }
  if (deleteBtn) {
    deleteBtn.disabled = selectedTokens.size === 0;
    deleteBtn.style.opacity = selectedTokens.size === 0 ? '0.5' : '1';
  }
}

function toggleTokenSelection(tokenId) {
  if (selectedTokens.has(tokenId)) {
    selectedTokens.delete(tokenId);
  } else {
    selectedTokens.add(tokenId);
  }
  updateBatchUI();
  renderTokens(window.currentTokens || []);
}

async function batchDeleteTokens() {
  if (selectedTokens.size === 0) return;
  
  if (!confirm(`确定要删除选中的 ${selectedTokens.size} 个 Token 吗？此操作不可恢复。`)) {
    return;
  }
  
  const token = localStorage.getItem('authToken');
  let successCount = 0;
  let failCount = 0;
  
  for (const tokenId of selectedTokens) {
    try {
      const res = await fetch(`/api/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (e) {
      failCount++;
    }
  }
  
  alert(`删除完成：成功 ${successCount} 个，失败 ${failCount} 个`);
  
  // 重置批量模式
  batchMode = false;
  selectedTokens.clear();
  updateBatchUI();
  
  // 刷新列表
  await loadTokens();
}

// 修改 renderTokens 函数支持批量选择
const originalRenderTokens = window.renderTokens;
window.renderTokens = function(tokens) {
  window.currentTokens = tokens;
  const container = document.getElementById('tokenList');
  if (!container) return;
  
  if (tokens.length === 0) {
    container.innerHTML = '<p style="color:#71717a;text-align:center;padding:20px;">暂无Token</p>';
    return;
  }
  
  container.innerHTML = tokens.map(t => {
    const isSelected = selectedTokens.has(t.id);
    const checkbox = batchMode ? `
      <div style="margin-right:12px;" onclick="event.stopPropagation();toggleTokenSelection('${t.id}')">
        <div style="width:20px;height:20px;border:2px solid ${isSelected ? '#6366f1' : '#4b5563'};border-radius:4px;background:${isSelected ? '#6366f1' : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;">
          ${isSelected ? '<span style="color:#fff;font-size:12px;">✓</span>' : ''}
        </div>
      </div>
    ` : '';
    
    return `
    <div class="token-item" style="display:flex;align-items:center;padding:16px;background:#12121a;border:1px solid ${isSelected ? '#6366f1' : '#2a2a3a'};border-radius:12px;margin-bottom:12px;transition:all 0.2s;${isSelected ? 'background:rgba(99,102,241,0.1);' : ''}">
      ${checkbox}
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <code style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#e4e4e7;background:#1a1a2e;padding:4px 8px;border-radius:4px;">${t.token?.slice(0, 12)}...</code>
          <span class="token-tag ${t.status === 'active' ? 'token-active' : 'token-revoked'}">${t.status === 'active' ? '● 正常' : '○ 已撤销'}</span>
        </div>
        <div style="font-size:12px;color:#71717a;">
          创建于 ${new Date(t.created_at).toLocaleDateString('zh-CN')}
          ${t.last_used ? ' · 最后使用 ' + new Date(t.last_used).toLocaleDateString('zh-CN') : ''}
          ${t.usage_count !== undefined ? ' · 调用 ' + t.usage_count + ' 次' : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-left:12px;">
        <button onclick="copyToken('${t.token}')" class="btn-secondary" style="padding:6px 12px;font-size:12px;" ${batchMode ? 'disabled style="opacity:0.5;"' : ''}>复制</button>
        <button onclick="revokeToken('${t.id}')" class="btn-danger" style="padding:6px 12px;font-size:12px;" ${batchMode ? 'disabled style="opacity:0.5;"' : ''}>撤销</button>
      </div>
    </div>
    `;
  }).join('');
};

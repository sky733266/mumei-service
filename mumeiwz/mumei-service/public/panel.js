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
  const code = document.getElementById('verifyCode').value;

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email, 
        password, 
        confirmPassword, 
        code,
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
}

// 加载统计数据
async function loadStats() {
  try {
    const response = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    // 更新统计卡片
    document.getElementById('dailyUsage').textContent = data.stats.today;
    document.getElementById('monthlyUsage').textContent = data.stats.thisMonth;
    document.getElementById('totalCalls').textContent = data.stats.total;
    document.getElementById('successRate').textContent = 
      data.stats.total > 0 ? Math.round((data.stats.success / data.stats.total) * 100) + '%' : '0%';
    document.getElementById('avgResponse').textContent = data.stats.avgDuration + 'ms';
    document.getElementById('activeTokens').textContent = data.tokenStats.active;
    
    // 更新进度条
    if (data.limits) {
      const dailyPercent = (data.limits.daily.used / data.limits.daily.limit) * 100;
      const monthlyPercent = (data.limits.monthly.used / data.limits.monthly.limit) * 100;
      
      document.getElementById('dailyProgress').style.width = Math.min(dailyPercent, 100) + '%';
      document.getElementById('monthlyProgress').style.width = Math.min(monthlyPercent, 100) + '%';
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
  
  if (tokens.length === 0) {
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

  tokenList.innerHTML = tokens.map(token => `
    <div class="token-item ${token.active ? '' : 'inactive'}">
      <div class="token-info">
        <div class="token-name">${token.name}</div>
        <div class="token-meta">
          创建于 ${new Date(token.createdAt).toLocaleDateString()} | 
          ${token.usageCount} 次调用 |
          ${token.active ? '启用中' : '已禁用'}
        </div>
      </div>
      <div class="token-actions">
        <button class="btn-secondary" onclick="toggleToken('${token.id}')">
          ${token.active ? '禁用' : '启用'}
        </button>
        <button class="btn-secondary" onclick="deleteToken('${token.id}')">删除</button>
      </div>
    </div>
  `).join('');
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
  
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">暂无日志</td></tr>';
    return;
  }
  
  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${log.endpoint}</td>
      <td>
        <span class="status-badge ${log.status >= 200 && log.status < 300 ? 'status-success' : 'status-error'}">
          ${log.status}
        </span>
      </td>
      <td>${new Date(log.timestamp).toLocaleString()}</td>
      <td>${log.duration}ms</td>
    </tr>
  `).join('');
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

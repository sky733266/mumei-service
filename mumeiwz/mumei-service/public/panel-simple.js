// 用户面板脚本 - 修复版

let currentLang = localStorage.getItem('language') || 'zh';
let translations = {};
let authToken = localStorage.getItem('authToken');
let countdownTimer = null;

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  console.log('Panel.js loaded');
  
  // 获取DOM元素
  const languageSelect = document.getElementById('languageSelect');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  
  console.log('Login form:', loginForm);
  console.log('Register form:', registerForm);
  
  // 初始化语言
  if (languageSelect) {
    languageSelect.value = currentLang;
    loadTranslations(currentLang);
    
    languageSelect.addEventListener('change', (e) => {
      currentLang = e.target.value;
      localStorage.setItem('language', currentLang);
      loadTranslations(currentLang);
    });
  }
  
  // 标签切换
  if (loginTab && registerTab) {
    loginTab.addEventListener('click', () => switchTab('login'));
    registerTab.addEventListener('click', () => switchTab('register'));
  }
  
  // 表单提交 - 使用onsubmit确保捕获
  if (loginForm) {
    loginForm.onsubmit = function(e) {
      e.preventDefault();
      console.log('Login form submitted');
      handleLogin();
      return false;
    };
  }
  
  if (registerForm) {
    registerForm.onsubmit = function(e) {
      e.preventDefault();
      console.log('Register form submitted');
      handleRegister();
      return false;
    };
  }
  
  // 发送验证码
  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', sendVerificationCode);
  }
  
  // 检查登录状态
  if (authToken) {
    checkAuth();
  }
});

// 切换标签
function switchTab(tab) {
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
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

// 加载翻译
async function loadTranslations(lang) {
  try {
    const response = await fetch(`/api/translations/${lang}`);
    translations = await response.json();
    updateUI();
  } catch (error) {
    console.error('加载翻译失败:', error);
  }
}

// 更新UI
function updateUI() {
  const userPanel = document.getElementById('userPanel');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const emailLabel = document.getElementById('emailLabel');
  const passwordLabel = document.getElementById('passwordLabel');
  const loginBtn = document.getElementById('loginBtn');
  
  if (userPanel) userPanel.textContent = translations.userPanel || '用户面板';
  if (loginTab) loginTab.textContent = translations.login || '登录';
  if (registerTab) registerTab.textContent = translations.register || '注册';
  if (emailLabel) emailLabel.textContent = translations.email || '邮箱';
  if (passwordLabel) passwordLabel.textContent = translations.password || '密码';
  if (loginBtn) loginBtn.textContent = translations.login || '登录';
}

// 发送验证码
async function sendVerificationCode() {
  const emailInput = document.getElementById('registerEmail');
  const email = emailInput ? emailInput.value : '';
  
  if (!email || !email.includes('@')) {
    alert('请输入有效的邮箱地址');
    return;
  }
  
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  sendCodeBtn.disabled = true;
  
  try {
    const response = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang: currentLang })
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert('验证码已发送: ' + data.code);
      startCountdown();
    } else {
      alert(data.error || '发送失败');
      sendCodeBtn.disabled = false;
    }
  } catch (error) {
    console.error('发送验证码失败:', error);
    alert('发送失败，请重试');
    sendCodeBtn.disabled = false;
  }
}

// 倒计时
function startCountdown() {
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  let seconds = 60;
  sendCodeBtn.textContent = `${seconds}s`;
  
  countdownTimer = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      sendCodeBtn.textContent = `${seconds}s`;
    } else {
      clearInterval(countdownTimer);
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = '发送验证码';
    }
  }, 1000);
}

// 处理登录
async function handleLogin() {
  console.log('handleLogin called');
  
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  
  const email = emailInput ? emailInput.value : '';
  const password = passwordInput ? passwordInput.value : '';
  
  console.log('Email:', email);
  console.log('Password:', password ? '***' : 'empty');
  
  if (!email || !password) {
    alert('请填写邮箱和密码');
    return;
  }
  
  try {
    console.log('Sending login request...');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (data.success) {
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      alert('登录成功！');
      showPanel(data.user);
    } else {
      alert(data.error || '登录失败');
    }
  } catch (error) {
    console.error('登录失败:', error);
    alert('登录失败: ' + error.message);
  }
}

// 处理注册 (简化版 - 无需验证码)
async function handleRegister() {
  console.log('handleRegister called - 简化注册');
  
  const emailInput = document.getElementById('registerEmail');
  const passwordInput = document.getElementById('registerPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
  
  // 基础验证
  if (!email || !password) {
    alert('请填写邮箱和密码');
    return;
  }
  
  // 邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('请输入有效的邮箱地址');
    return;
  }
  
  // 密码验证
  if (password.length < 6) {
    alert('密码至少6位');
    return;
  }
  
  if (password !== confirmPassword) {
    alert('两次输入的密码不一致');
    return;
  }
  
  try {
    // 使用简化注册 API
    const response = await fetch('/api/auth/quick-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      
      // 显示欢迎消息
      let welcomeMsg = '🎉 注册成功！\n\n';
      if (data.welcomeBonus) {
        welcomeMsg += `✨ 欢迎礼包：${data.welcomeBonus.count}次免费调用\n`;
        welcomeMsg += `⏰ 有效期7天\n\n`;
      }
      welcomeMsg += '现在可以开始使用工具了！';
      
      alert(welcomeMsg);
      showPanel(data.user);
    } else {
      alert(data.error || '注册失败');
    }
  } catch (error) {
    console.error('注册失败:', error);
    alert('注册失败: ' + error.message);
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
  console.log('Showing panel for user:', user);
  
  const authSection = document.getElementById('authSection');
  const panelContent = document.getElementById('panelContent');
  const userEmail = document.getElementById('userEmail');
  
  console.log('authSection:', authSection);
  console.log('panelContent:', panelContent);
  
  if (userEmail) {
    userEmail.textContent = user.email;
    userEmail.style.display = 'block';
  }
  
  if (authSection) {
    authSection.style.display = 'none';
    authSection.classList.add('hidden');
  }
  
  if (panelContent) {
    panelContent.style.display = 'block';
    panelContent.classList.remove('hidden');
    panelContent.style.visibility = 'visible';
    panelContent.style.opacity = '1';
  }
  
  // 显示用户面板内容
  alert('登录成功！欢迎 ' + user.email);

  // 加载用户统计数据
  loadUserStats();
}

// 加载用户统计数据
async function loadUserStats() {
  try {
    const res = await fetch('/api/stats', authHeader());
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    const s = data.stats;
    // 更新统计卡片
    const dailyEl = document.getElementById('dailyUsage');
    const monthlyEl = document.getElementById('monthlyUsage');
    const totalEl = document.getElementById('totalCalls');
    const successEl = document.getElementById('successRate');
    const avgEl = document.getElementById('avgResponse');
    const tokensEl = document.getElementById('activeTokens');

    if (dailyEl) dailyEl.textContent = s.dailyUsage || 0;
    if (monthlyEl) monthlyEl.textContent = s.monthlyUsage || 0;
    if (totalEl) totalEl.textContent = s.totalCalls || 0;
    if (successEl) successEl.textContent = (s.successRate || 0) + '%';
    if (avgEl) avgEl.textContent = (s.avgResponse || 0) + 'ms';
    if (tokensEl) tokensEl.textContent = s.activeTokens || 0;

    // 更新进度条
    const dailyProgress = document.getElementById('dailyProgress');
    const monthlyProgress = document.getElementById('monthlyProgress');
    if (dailyProgress) {
      const dailyLimit = 100; // 假设每日限额100
      dailyProgress.style.width = Math.min((s.dailyUsage / dailyLimit) * 100, 100) + '%';
    }
    if (monthlyProgress) {
      const monthlyLimit = 3000; // 假设每月限额3000
      monthlyProgress.style.width = Math.min((s.monthlyUsage / monthlyLimit) * 100, 100) + '%';
    }

    // 检查配额警告（超过80%显示警告）
    checkQuotaWarning(s.dailyUsage, 100);

    // 渲染图表
    if (s.dailyChart && window.Chart) {
      renderUsageChart(s.dailyChart.labels, s.dailyChart.data);
    }
  } catch (e) {
    console.error('加载统计失败:', e);
  }
}

// 渲染使用量图表
function renderUsageChart(labels, data) {
  const ctx = document.getElementById('usageChart');
  if (!ctx) return;

  // 销毁旧图表
  if (window.usageChartInstance) {
    window.usageChartInstance.destroy();
  }

  window.usageChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'API调用次数',
        data: data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#6366f1'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#a1a1aa', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: '#a1a1aa', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

// 检查配额警告
function checkQuotaWarning(used, limit) {
  const warningEl = document.getElementById('quotaWarning');
  const usedEl = document.getElementById('quotaUsed');
  if (!warningEl) return;

  const percentage = Math.round((used / limit) * 100);
  if (percentage >= 80) {
    warningEl.style.display = 'block';
    if (usedEl) usedEl.textContent = percentage;
  } else {
    warningEl.style.display = 'none';
  }
}

// 退出登录
function logout() {
  authToken = null;
  localStorage.removeItem('authToken');
  const authSection = document.getElementById('authSection');
  const panelContent = document.getElementById('panelContent');
  
  if (authSection) authSection.classList.remove('hidden');
  if (panelContent) panelContent.classList.add('hidden');
}

// ============ Webhook 管理 ============

let editingWebhookId = null;

async function loadWebhooks() {
  const section = document.getElementById('webhookSection');
  if (!section) return;
  try {
    const res = await fetch('/api/webhooks', authHeader());
    if (!res.ok) { section.style.display = 'none'; return; }
    const data = await res.json();
    if (data.webhooks && data.webhooks.length > 0) {
      section.style.display = 'block';
      renderWebhookList(data.webhooks);
    } else {
      // 专业版用户才显示空白区
      const user = await (await fetch('/api/auth/me', authHeader())).json();
      if (user.user && user.user.plan !== 'free') {
        section.style.display = 'block';
        document.getElementById('webhookList').innerHTML =
          '<p style="color:#71717a;font-size:14px;">暂无 Webhook，添加一个接收 API 调用通知</p>';
      } else {
        section.style.display = 'none';
      }
    }
  } catch (e) {
    section.style.display = 'none';
  }
}

function renderWebhookList(webhooks) {
  const container = document.getElementById('webhookList');
  container.innerHTML = webhooks.map(w => `
    <div style="background:#27272a;border-radius:10px;padding:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;color:#a1a1aa;word-break:break-all;">${w.url}</div>
        ${w.description ? `<div style="font-size:12px;color:#52525b;margin-top:4px;">${w.description}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
          ${(w.events || []).map(e => `<span style="background:#3f3f46;font-size:11px;color:#a1a1aa;padding:2px 8px;border-radius:4px;">${e}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:12px;">
        <button onclick="testWebhook('${w.id}')" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-size:12px;" title="测试">测试</button>
        <button onclick="deleteWebhook('${w.id}')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:12px;" title="删除">删除</button>
      </div>
    </div>
  `).join('');
}

function openWebhookModal(webhook = null) {
  editingWebhookId = webhook ? webhook.id : null;
  document.getElementById('webhookModalTitle').textContent = webhook ? '编辑 Webhook' : '添加 Webhook';
  document.getElementById('webhookUrl').value = webhook ? webhook.url : '';
  document.getElementById('webhookDesc').value = webhook ? webhook.description || '' : '';
  document.getElementById('webhookError').style.display = 'none';
  document.getElementById('webhookTestResult').style.display = 'none';
  if (webhook) {
    document.querySelectorAll('#webhookEvents input').forEach(cb => {
      cb.checked = (webhook.events || []).includes(cb.value);
    });
  }
  document.getElementById('webhookModal').classList.remove('hidden');
}

async function saveWebhook() {
  const url = document.getElementById('webhookUrl').value.trim();
  const description = document.getElementById('webhookDesc').value.trim();
  const events = Array.from(document.querySelectorAll('#webhookEvents input:checked')).map(cb => cb.value);
  const errorEl = document.getElementById('webhookError');

  if (!url || !url.startsWith('http')) {
    errorEl.textContent = '请输入有效的 URL（必须以 http:// 或 https:// 开头）';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const method = editingWebhookId ? 'PUT' : 'POST';
    const endpoint = editingWebhookId ? `/api/webhooks/${editingWebhookId}` : '/api/webhooks';
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader().headers },
      body: JSON.stringify({ url, description, events })
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.upgrade) {
        errorEl.textContent = 'Webhook 功能仅限专业版用户使用';
      } else {
        errorEl.textContent = data.error || '保存失败';
      }
      errorEl.style.display = 'block';
      return;
    }
    document.getElementById('webhookModal').classList.add('hidden');
    loadWebhooks();
  } catch (e) {
    errorEl.textContent = '网络错误，请重试';
    errorEl.style.display = 'block';
  }
}

async function testWebhook(id) {
  const resultEl = document.getElementById('webhookTestResult');
  resultEl.textContent = '正在发送测试...';
  resultEl.style.display = 'block';
  resultEl.style.color = '#a1a1aa';
  try {
    const res = await fetch(`/api/webhooks/${id}/test`, authHeader());
    const data = await res.json();
    if (data.success && data.result && data.result.success) {
      resultEl.textContent = '✅ 测试成功！目标服务器返回 ' + data.result.status;
      resultEl.style.color = '#4ade80';
    } else {
      resultEl.textContent = '❌ 测试失败：' + (data.result ? data.result.error : data.error || '未知错误');
      resultEl.style.color = '#f87171';
    }
  } catch (e) {
    resultEl.textContent = '❌ 网络错误';
    resultEl.style.color = '#f87171';
  }
}

async function deleteWebhook(id) {
  if (!confirm('确定删除这个 Webhook？')) return;
  try {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE', ...authHeader() });
    loadWebhooks();
  } catch (e) {}
}

// 模态框关闭
document.getElementById('closeWebhookModal')?.addEventListener('click', () => {
  document.getElementById('webhookModal').classList.add('hidden');
});
document.getElementById('saveWebhookBtn')?.addEventListener('click', saveWebhook);

// 初始化时加载 Webhooks
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(loadWebhooks, 500));
} else {
  setTimeout(loadWebhooks, 500);
}

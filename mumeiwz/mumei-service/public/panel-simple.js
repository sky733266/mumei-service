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

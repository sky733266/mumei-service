// 当前语言
let currentLang = localStorage.getItem('language') || 'zh';

// 翻译数据缓存
let translations = {};

// DOM元素
let languageSelect, pdfInput, uploadArea, convertBtn, resultArea, resultText, copyBtn, downloadBtn;

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
  // 获取DOM元素
  languageSelect = document.getElementById('languageSelect');
  pdfInput = document.getElementById('pdfInput');
  uploadArea = document.getElementById('uploadArea');
  convertBtn = document.getElementById('convertBtn');
  resultArea = document.getElementById('resultArea');
  resultText = document.getElementById('resultText');
  copyBtn = document.getElementById('copyBtn');
  downloadBtn = document.getElementById('downloadBtn');
  
  if (languageSelect) {
    languageSelect.value = currentLang;
    await loadTranslations(currentLang);
    setupEventListeners();
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
  document.getElementById('title').textContent = translations.title;
  document.getElementById('subtitle').textContent = translations.subtitle;
  document.getElementById('pdfConverter').textContent = translations.pdfConverter;
  document.getElementById('uploadPDF').textContent = translations.uploadPDF;
  document.getElementById('convert').textContent = translations.convert;
  document.getElementById('result').textContent = translations.result;
  document.getElementById('apiDocs').textContent = translations.apiDocs;
  document.getElementById('contact').textContent = translations.contact;
}

// 设置事件监听
function setupEventListeners() {
  // 语言切换
  languageSelect.addEventListener('change', (e) => {
    currentLang = e.target.value;
    loadTranslations(currentLang);
  });

  // 文件上传区域点击
  uploadArea.addEventListener('click', () => {
    pdfInput.click();
  });

  // 拖拽上传
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      pdfInput.files = files;
      handleFileSelect();
    } else {
      showToast('请上传PDF文件');
    }
  });

  // 文件选择
  pdfInput.addEventListener('change', handleFileSelect);

  // 转换按钮
  convertBtn.addEventListener('click', convertPDF);

  // 复制按钮
  copyBtn.addEventListener('click', copyResult);

  // 下载按钮
  downloadBtn.addEventListener('click', downloadResult);
}

// 处理文件选择
function handleFileSelect() {
  if (pdfInput.files.length > 0) {
    const file = pdfInput.files[0];
    document.querySelector('.upload-content p').textContent = file.name;
    document.querySelector('.upload-hint').textContent = 
      `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    convertBtn.disabled = false;
    resultArea.classList.add('hidden');
  }
}

// 转换PDF
async function convertPDF() {
  if (!pdfInput.files.length) return;

  const file = pdfInput.files[0];
  const formData = new FormData();
  formData.append('pdf', file);

  // 显示加载状态
  convertBtn.disabled = true;
  const originalText = document.getElementById('convert').textContent;
  document.getElementById('convert').innerHTML = '<span class="loading"></span>';

  try {
    const response = await fetch('/api/pdf-to-text', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      resultText.value = data.text;
      resultArea.classList.remove('hidden');
      showToast('转换成功！');
      
      // 滚动到结果区域
      resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      showToast(data.error || '转换失败');
    }
  } catch (error) {
    console.error('转换错误:', error);
    showToast('转换失败，请重试');
  } finally {
    convertBtn.disabled = false;
    document.getElementById('convert').textContent = originalText;
  }
}

// 复制结果
function copyResult() {
  resultText.select();
  document.execCommand('copy');
  showToast('已复制到剪贴板');
}

// 下载结果
function downloadResult() {
  const text = resultText.value;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted-text.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('文件已下载');
}

// 显示提示
function showToast(message) {
  // 移除已有的toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // 触发动画
  setTimeout(() => toast.classList.add('show'), 10);

  // 自动隐藏
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);

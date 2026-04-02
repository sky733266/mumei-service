// ============ 公告横幅 ============
async function loadAnnouncementBanner() {
  try {
    const res = await fetch("/api/announcement");
    const data = await res.json();
    if (!data.enabled) return;
    const banner = document.getElementById("announcementBanner");
    if (!banner) return;
    if (localStorage.getItem("announcementClosed") === "true") return;
    banner.style.background = data.bg || banner.style.background;
    document.getElementById("announcementText").textContent = data.text;
    const link = document.getElementById("announcementLink");
    link.href = data.link || "/tools";
    link.textContent = data.linkText || "立即体验 →";
    banner.style.display = "flex";
    const navbar = document.querySelector(".navbar");
    if (navbar) navbar.style.top = "40px";
  } catch (e) {}
}

function closeAnnouncement() {
  const banner = document.getElementById("announcementBanner");
  if (banner) banner.style.display = "none";
  localStorage.setItem("announcementClosed", "true");
  const navbar = document.querySelector(".navbar");
  if (navbar) navbar.style.top = "0";
}

// 带图片背景的完整美化版首页
// 使用 Unsplash 免费图片作为背景

// 图片配置
const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80', // 地球科技
  features: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80', // AI
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80', // 文件
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80', // 数据
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80', // 网络
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80', // 安全
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80', // 开发
  ]
};

// 预加载图片
function preloadImages() {
  const images = [IMAGES.hero, ...IMAGES.features];
  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

// 当前语言
let currentLang = localStorage.getItem('language') || 'zh';
let translations = {};

// 等待DOM加载
document.addEventListener('DOMContentLoaded', function() {
  preloadImages();
  loadAnnouncementBanner();

  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.value = currentLang;
    loadTranslations(currentLang);

    languageSelect.addEventListener('change', (e) => {
      currentLang = e.target.value;
      localStorage.setItem('language', currentLang);
      document.documentElement.lang = currentLang;
      loadTranslations(currentLang);
    });
  }

  // 添加滚动动画
  addScrollAnimations();
});

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
document.documentElement.lang = currentLang;

const set = (id, key) => {
  const el = document.getElementById(id);
  if (el && translations[key]) el.textContent = translations[key];
};

set('title', 'title');
set('subtitle', 'subtitle');
set('pdfConverter', 'pdfConverter');
set('uploadPDF', 'uploadPDF');
set('convert', 'convert');
set('result', 'result');
set('apiDocs', 'apiDocs');
set('contact', 'contact');

// 导航链接
document.querySelectorAll('nav a, .navbar-link').forEach(link => {
  const href = link.getAttribute('href') || '';
  if (href === '/tools' || href === '/#tools') link.textContent = translations.toolbox || '工具箱';
  if (href === '/panel') link.textContent = translations.userPanel || '用户面板';
  if (href === '/pricing' || href === '/#pricing') link.textContent = translations.pricing || '定价';
  if (href === '/docs') link.textContent = translations.docs || '文档';
});

// data-i18n 批量翻译
document.querySelectorAll('[data-i18n]').forEach(el => {
  const key = el.getAttribute('data-i18n');
  if (translations[key]) el.textContent = translations[key];
});

// 滚动动画
function addScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card, .pricing-card').forEach(el => {
    observer.observe(el);
  });
}

// 添加CSS动画样式
const style = document.createElement('style');
style.textContent = `
  .feature-card, .pricing-card {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .feature-card.animate-in, .pricing-card.animate-in {
    opacity: 1;
    transform: translateY(0);
  }
`;
document.head.appendChild(style);

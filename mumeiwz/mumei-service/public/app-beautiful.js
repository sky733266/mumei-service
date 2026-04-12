// ============ 全站统一 i18n 引擎 (app-beautiful.js) ============

let currentLang = localStorage.getItem('language') || 'zh';
let translations = {};

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

// ============ i18n 核心 ============
// 加载翻译（返回 Promise，确保 await 完成后才操作 DOM）
async function loadTranslations(lang) {
  try {
    const response = await fetch(`/api/translations/${lang}`);
    translations = await response.json();
    updatePageText();
  } catch (error) {
    console.error('加载翻译失败:', error);
  }
}

// 全页面翻译更新（统一入口，首页/工具页/文档页通用）
function updatePageText() {
  // 1. data-i18n 批量属性翻译
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translations[key];
      } else {
        el.textContent = translations[key];
      }
    }
  });

  // 2. data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[key]) el.placeholder = translations[key];
  });

  // 3. data-i18n-title（hover 提示）
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (translations[key]) el.title = translations[key];
  });

  // 4. 导航链接翻译
  document.querySelectorAll('nav a, .navbar-link, .footer-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === '/' || href === '/index') {
      link.textContent = translations.nav_home || translations.home || '首页';
    }
    if (href === '/tools' || href === '/#tools' || href === '#tools') {
      link.textContent = translations.nav_tools || translations.toolbox || '工具箱';
    }
    if (href === '/panel' || href === '/user') {
      link.textContent = translations.nav_panel || translations.userPanel || '用户面板';
    }
    if (href === '/pricing' || href === '/#pricing' || href === '#pricing') {
      link.textContent = translations.nav_pricing || translations.pricing || '定价';
    }
    if (href === '/docs' || href === '/api-docs') {
      link.textContent = translations.nav_docs || translations.docs || '文档';
    }
    if (href === '/feedback') {
      link.textContent = translations.feedback || '反馈';
    }
  });

  // 5. 页面标题和副标题
  const set = (id, key) => {
    const el = document.getElementById(id);
    if (el && translations[key]) el.textContent = translations[key];
  };
  set('heroTitle', 'heroTitle');
  set('heroSubtitle', 'heroSubtitle');
  set('heroCta', 'heroCta');
  set('heroCta2', 'heroCta2');
  set('statTools', 'statTools');
  set('statUsers', 'statUsers');
  set('statCalls', 'statCalls');

  // 6. 首页特性卡片（多语言 key 在 translations 里对应）
  //    格式：feature_title_0, feature_desc_0, ...
  for (let i = 0; i < 20; i++) {
    const titleEl = document.getElementById(`feature_title_${i}`);
    const descEl = document.getElementById(`feature_desc_${i}`);
    if (titleEl && translations[`feature_title_${i}`]) {
      titleEl.textContent = translations[`feature_title_${i}`];
    }
    if (descEl && translations[`feature_desc_${i}`]) {
      descEl.textContent = translations[`feature_desc_${i}`];
    }
  }

  // 7. 页脚
  const footerLinks = document.querySelectorAll('.footer-links a');
  if (footerLinks.length >= 4) {
    if (translations.footer_tools) footerLinks[0].textContent = translations.footer_tools;
    if (translations.footer_docs) footerLinks[1].textContent = translations.footer_docs;
    if (translations.footer_pricing) footerLinks[2].textContent = translations.footer_pricing;
    if (translations.footer_contact) footerLinks[3].textContent = translations.footer_contact;
  }

  // 8. 语言选择器值同步
  const langSelect = document.getElementById('languageSelect');
  if (langSelect) langSelect.value = currentLang;

  // 9. 公告已关闭状态（翻译关闭按钮）
  const closeBtn = document.querySelector('.announcement-close');
  if (closeBtn && translations.announcement_close) {
    closeBtn.textContent = translations.announcement_close;
  }
}

// 语言切换（供外部 HTML onclick 或语言选择器调用）
async function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('language', lang);
  document.documentElement.lang = lang;
  await loadTranslations(lang);
}

// ============ 旧版 updateUI（向后兼容） ============
// eslint-disable-next-line no-unused-vars
function updateUI() {
  updatePageText();
}

// ============ 预加载图片（首页用） ============
const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
  features: [
    'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&q=80',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&q=80',
  ]
};

function preloadImages() {
  [IMAGES.hero, ...IMAGES.features].forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

// ============ 滚动动画 ============
function addScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('animate-in');
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.feature-card, .pricing-card').forEach(el => observer.observe(el));
}

// ============ 主题切换 ============
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ============ 页面加载进度条 ============
function initPageLoader() {
  const loader = document.getElementById('pageLoader');
  if (!loader) return;
  loader.classList.add('loading');
  window.addEventListener('load', () => {
    loader.classList.remove('loading');
    loader.classList.add('loaded');
    setTimeout(() => { loader.style.display = 'none'; }, 600);
  });
  setTimeout(() => {
    if (loader.classList.contains('loading')) {
      loader.classList.remove('loading');
      loader.classList.add('loaded');
      setTimeout(() => { loader.style.display = 'none'; }, 600);
    }
  }, 5000);
}

// ============ 移动端汉堡菜单 ============
function toggleMobileMenu() {
  const nav = document.querySelector('.navbar-nav');
  const toggle = document.querySelector('.mobile-menu-toggle');
  const overlay = document.querySelector('.mobile-nav-overlay');
  if (nav) nav.classList.toggle('active');
  if (toggle) toggle.classList.toggle('active');
  if (overlay) overlay.classList.toggle('active');
  document.body.style.overflow = nav?.classList.contains('active') ? 'hidden' : '';
}

// ============ DOM 加载完成后的初始化 ============
document.addEventListener('DOMContentLoaded', async function() {
  // 初始化主题
  initTheme();

  // 初始化加载进度条
  initPageLoader();

  // 预加载图片
  preloadImages();

  // 加载公告
  loadAnnouncementBanner();

  // 初始化语言：先设置 HTML lang 属性，再加载翻译
  document.documentElement.lang = currentLang;

  // 语言选择器绑定
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.value = currentLang;
    languageSelect.addEventListener('change', (e) => {
      switchLang(e.target.value);
    });
  }

  // 加载翻译并更新页面
  await loadTranslations(currentLang);

  // 滚动动画
  addScrollAnimations();

  // 关闭菜单事件
  document.querySelectorAll('.navbar-link').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.navbar-nav, .mobile-menu-toggle, .mobile-nav-overlay').forEach(el => {
        if (el) el.classList.remove('active');
      });
      document.body.style.overflow = '';
    });
  });

  // ESC 关闭菜单
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.navbar-nav, .mobile-menu-toggle, .mobile-nav-overlay').forEach(el => {
        if (el) el.classList.remove('active');
      });
      document.body.style.overflow = '';
    }
  });
});

// ============ 添加滚动动画 CSS ============
const i18nStyle = document.createElement('style');
i18nStyle.textContent = `
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
document.head.appendChild(i18nStyle);

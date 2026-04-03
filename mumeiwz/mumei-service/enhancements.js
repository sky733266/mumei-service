/**
 * 沐美服务 - 安全和功能增强补丁
 * 将此文件 require 到 server.js 开头即可应用
 */

// ============ 安全检查 ============
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && NODE_ENV === 'production') {
  console.error('\x1b[31m%s\x1b[0m', '❌ FATAL: JWT_SECRET must be set in production!');
  console.error('   Run: node scripts/generate-secrets.js');
  process.exit(1);
}

// ============ CORS 安全配置 ============
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080').split(',');

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // 允许 Postman/curl
    if (ALLOWED_ORIGINS.some(allowed => allowed.trim() === origin)) {
      return callback(null, true);
    }
    if (NODE_ENV === 'production') {
      console.warn(`⚠️ Blocked CORS request from: ${origin}`);
      return callback(new Error('CORS not allowed'));
    }
    callback(null, true);
  },
  credentials: true
};

// ============ 安全响应头中间件 ============
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

// ============ 增强限流配置 ============
const authLimiterConfig = {
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10,
  message: { error: '登录尝试次数过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}-${req.body?.email || 'anonymous'}`
};

const verifyLimiterConfig = {
  windowMs: 60 * 60 * 1000, // 1小时
  max: 5,
  message: { error: '验证码发送过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
};

// ============ 文件上传安全配置 ============
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/css',
  'application/json', 'application/xml',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/x-zip-compressed',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
  'video/mp4', 'video/webm', 'video/ogg'
];

const DANGEROUS_EXTENSIONS = ['.exe', '.sh', '.bat', '.cmd', '.pif', '.scr', '.vbs', '.jsp', '.php', '.cgi', '.htaccess'];

function safeFileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    console.warn(`⚠️ Blocked file upload: ${file.originalname} (MIME: ${file.mimetype})`);
    return cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
  
  const ext = path.extname(file.originalname).toLowerCase();
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    console.warn(`⚠️ Blocked dangerous file: ${file.originalname}`);
    return cb(new Error(`禁止上传可执行文件: ${ext}`), false);
  }
  
  cb(null, true);
}

// ============ 安全文件名生成 ============
function generateSafeFilename(originalName) {
  const crypto = require('crypto');
  const ext = path.extname(originalName).toLowerCase();
  return crypto.randomUUID() + ext;
}

// ============ 完整多语言配置 ============
const translations = {
  zh: {
    title: '沐美服务',
    subtitle: '一人公司API服务平台',
    tools: '工具箱',
    toolbox: '工具箱',
    aiTools: 'AI工具',
    fileTools: '文件工具',
    dataTools: '数据工具',
    networkTools: '网络工具',
    securityTools: '安全工具',
    devTools: '开发工具',
    userPanel: '用户面板',
    login: '登录',
    register: '注册',
    email: '邮箱',
    password: '密码',
    logout: '退出登录',
    upgrade: '升级',
    myTokens: '我的Token',
    createToken: '创建Token',
    apiLogs: 'API日志',
    currentPlan: '当前套餐',
    usageStats: '使用统计',
    sendCode: '发送验证码'
  },
  en: {
    title: 'Mumei Service',
    subtitle: 'One-Person Company API Platform',
    tools: 'Toolbox',
    toolbox: 'Toolbox',
    aiTools: 'AI Tools',
    fileTools: 'File Tools',
    dataTools: 'Data Tools',
    networkTools: 'Network Tools',
    securityTools: 'Security Tools',
    devTools: 'Dev Tools',
    userPanel: 'Dashboard',
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    logout: 'Logout',
    upgrade: 'Upgrade',
    myTokens: 'My Tokens',
    createToken: 'Create Token',
    apiLogs: 'API Logs',
    currentPlan: 'Current Plan',
    usageStats: 'Usage Stats',
    sendCode: 'Send Code'
  },
  ko: {
    title: '무메이 서비스',
    subtitle: '1인 기업 API 플랫폼',
    tools: '도구함',
    toolbox: '도구함',
    aiTools: 'AI 도구',
    fileTools: '파일 도구',
    dataTools: '데이터 도구',
    networkTools: '네트워크 도구',
    securityTools: '보안 도구',
    devTools: '개발 도구',
    userPanel: '대시보드',
    login: '로그인',
    register: '회원가입',
    email: '이메일',
    password: '비밀번호',
    logout: '로그아웃',
    upgrade: '업그레이드',
    myTokens: '내 토큰',
    createToken: '토큰 생성',
    apiLogs: 'API 로그',
    currentPlan: '현재 플랜',
    usageStats: '사용 통계',
    sendCode: '인증번호 발송'
  },
  ja: {
    title: 'ムメイサービス',
    subtitle: 'APIプラットフォーム',
    tools: 'ツールボックス',
    toolbox: 'ツールボックス',
    aiTools: 'AIツール',
    fileTools: 'ファイルツール',
    dataTools: 'データツール',
    networkTools: 'ネットワークツール',
    securityTools: 'セキュリティツール',
    devTools: '開発ツール',
    userPanel: 'ダッシュボード',
    login: 'ログイン',
    register: '新規登録',
    email: 'メール',
    password: 'パスワード',
    logout: 'ログアウト',
    upgrade: 'アップグレード',
    myTokens: 'マイToken',
    createToken: 'Token作成',
    apiLogs: 'APIログ',
    currentPlan: '現在のプラン',
    usageStats: '利用統計',
    sendCode: 'コード送信'
  },
  fr: {
    title: 'Service Mumei',
    subtitle: 'Plateforme API',
    tools: 'Boîte à outils',
    toolbox: 'Boîte à outils',
    aiTools: 'Outils IA',
    fileTools: 'Outils Fichier',
    dataTools: 'Outils Données',
    networkTools: 'Outils Réseau',
    securityTools: 'Outils Sécurité',
    devTools: 'Outils Dev',
    userPanel: 'Tableau de bord',
    login: 'Connexion',
    register: 'Inscription',
    email: 'E-mail',
    password: 'Mot de passe',
    logout: 'Déconnexion',
    upgrade: 'Améliorer',
    myTokens: 'Mes Tokens',
    createToken: 'Créer Token',
    apiLogs: 'Logs API',
    currentPlan: 'Plan actuel',
    usageStats: 'Statistiques',
    sendCode: 'Envoyer le code'
  },
  es: {
    title: 'Servicio Mumei',
    subtitle: 'Plataforma API',
    tools: 'Herramientas',
    toolbox: 'Herramientas',
    aiTools: 'Herramientas IA',
    fileTools: 'Herramientas Archivo',
    dataTools: 'Herramientas Datos',
    networkTools: 'Herramientas Red',
    securityTools: 'Herramientas Seguridad',
    devTools: 'Herramientas Dev',
    userPanel: 'Panel',
    login: 'Iniciar sesión',
    register: 'Registrarse',
    email: 'Correo',
    password: 'Contraseña',
    logout: 'Cerrar sesión',
    upgrade: 'Mejorar',
    myTokens: 'Mis Tokens',
    createToken: 'Crear Token',
    apiLogs: 'Logs API',
    currentPlan: 'Plan actual',
    usageStats: 'Estadísticas',
    sendCode: 'Enviar código'
  }
};

// ============ 路由处理函数 ============

// 发送验证码
async function handleSendVerification(req, res, next) {
  const { VerificationDB } = require('./db-sqljs');
  const { sendVerificationEmail } = require('./email');
  
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱地址' });
    
    // 创建验证码
    const code = VerificationDB.createCode(email);
    
    try {
      await sendVerificationEmail(email, code);
      res.json({ success: true, message: '验证码已发送', code: NODE_ENV === 'development' ? code : undefined });
    } catch (emailError) {
      console.error('邮件发送失败:', emailError.message);
      if (NODE_ENV !== 'production') {
        res.json({ success: true, message: '验证码已发送（开发模式）', code });
      } else {
        res.status(500).json({ error: '验证码发送失败，请稍后再试' });
      }
    }
  } catch (error) {
    next(error);
  }
}

// 注册
async function handleRegister(req, res, next) {
  const { UserDB } = require('./db-sqljs');
  const { generateToken } = require('./auth');
  
  try {
    const { email, password, code } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    const user = await UserDB.createUser(email, password);

    // 处理邀请奖励
    const refFrom = req.body?.ref;
    if (refFrom) {
      const { ReferralDB } = require('./db-sqljs');
      ReferralDB.createReferral(refFrom, user.id);
      ReferralDB.rewardReferrer(refFrom, user.id);
      console.log(`🎁 邀请奖励: ${refFrom} 邀请 ${email} 注册成功`);
    }

    const token = generateToken({ id: user.id, email: user.email, verified: true, plan: user.plan });
    
    res.json({ 
      success: true, 
      token,
      user: { id: user.id, email: user.email, verified: true, plan: user.plan }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// 登录
// ============ 登录失败追踪 ============
const loginFailures = new Map(); // { key: { count, until } }
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15分钟

function getLoginKey(req, email) {
  return `${req.ip}-${email}`;
}

function checkLoginBlocked(req, email) {
  const key = getLoginKey(req, email);
  const record = loginFailures.get(key);
  if (!record) return null;
  if (Date.now() < record.until) return record;
  loginFailures.delete(key);
  return null;
}

function recordLoginFailure(req, email) {
  const key = getLoginKey(req, email);
  const record = loginFailures.get(key) || { count: 0, until: 0 };
  record.count++;
  record.until = Date.now() + LOGIN_LOCKOUT_MS;
  loginFailures.set(key, record);
}

function clearLoginFailure(req, email) {
  const key = getLoginKey(req, email);
  loginFailures.delete(key);
}

async function handleLogin(req, res, next) {
  const { UserDB } = require('./db-sqljs');
  const { generateToken } = require('./auth');
  
  const email = req.body?.email || '';
  const password = req.body?.password || '';
  
  try {
    if (!email || !password) {
      return res.status(400).json({ error: '请输入邮箱和密码' });
    }

    // 检查是否被锁定
    const blocked = checkLoginBlocked(req, email);
    if (blocked) {
      const remaining = Math.ceil((blocked.until - Date.now()) / 60000);
      return res.status(429).json({ 
        error: `登录失败次数过多，账户已锁定，请在 ${remaining} 分钟后重试` 
      });
    }

    const user = await UserDB.validateUser(email, password);
    clearLoginFailure(req, email); // 成功登录清除失败记录
    
    res.json({ 
      success: true, 
      token: generateToken(user),
      user: { id: user.id, email: user.email, verified: user.verified, plan: user.plan }
    });
  } catch (error) {
    // 记录失败
    recordLoginFailure(req, email);
    const blocked = checkLoginBlocked(req, email);
    const remaining = blocked ? Math.ceil((blocked.until - Date.now()) / 60000) : 0;
    if (blocked) {
      return res.status(429).json({ 
        error: `登录失败次数过多，账户已锁定，请在 ${remaining} 分钟后重试` 
      });
    }
    res.status(401).json({ error: error.message });
  }
}

// ============ 导出 ============
module.exports = {
  NODE_ENV,
  corsOptions,
  securityHeaders,
  authLimiterConfig,
  verifyLimiterConfig,
  safeFileFilter,
  generateSafeFilename,
  translations,
  handleSendVerification,
  handleRegister,
  handleLogin,
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS
};

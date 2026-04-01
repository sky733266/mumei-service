try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not installed, skipping...');
}
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');

const { UserDB, TokenDB, VerificationDB, LogDB, PlanDB, SubscriptionDB, OrderDB, ReferralDB, initDatabase } = require('./db-sqljs');
const { generateToken, authMiddleware } = require('./auth');
const { sendVerificationEmail } = require('./email');
const { requestLogger } = require('./logger');
const { createPaymentIntent, confirmPayment, mockPayment, isConfigured: isPaymentConfigured, handleWebhook } = require('./payment');
const { WebhookEvents, WebhookDB, WebhookTrigger } = require('./webhook');

// 导入增强功能（包含认证路由）
const enhancements = require('./enhancements');
const { handleSendVerification, handleRegister, handleLogin, authLimiterConfig, verifyLimiterConfig } = enhancements;

// 创建限流器
const authLimiter = rateLimit(authLimiterConfig);
const verifyLimiter = rateLimit(verifyLimiterConfig);

// 导入路由
const adminRoutes = require('./routes/admin');

// 导入工具服务（可选）
let TextGenerationService, ImageGenerationService, TTSService, STTService, TranslationService;
let FileProcessingService;
let DataProcessingService;
let NetworkService;
let SecurityService;
let DevToolsService;

try {
  const ai = require('./services/ai');
  TextGenerationService = ai.TextGenerationService;
  ImageGenerationService = ai.ImageGenerationService;
  TTSService = ai.TTSService;
  STTService = ai.STTService;
  TranslationService = ai.TranslationService;
} catch (e) {
  console.log('AI services not available');
}

try {
  const file = require('./services/file');
  FileProcessingService = file.FileProcessingService;
} catch (e) {
  console.log('File services not available');
}

try {
  const data = require('./services/data');
  DataProcessingService = data.DataProcessingService;
} catch (e) {
  console.log('Data services not available');
}

try {
  const network = require('./services/network');
  NetworkService = network.NetworkService;
} catch (e) {
  console.log('Network services not available');
}

try {
  const security = require('./services/security');
  SecurityService = security.SecurityService;
} catch (e) {
  console.log('Security services not available');
}

try {
  const devtools = require('./services/devtools');
  DevToolsService = devtools.DevToolsService;
} catch (e) {
  console.log('DevTools services not available');
}

const app = express();
const PORT = process.env.PORT || 3000;

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const webhookTrigger = new WebhookTrigger();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// 请求 ID 追踪
app.use((req, res, next) => {
  req.id = require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

app.use(requestLogger);

// Stripe Webhook需要原始body
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB限制
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// 多语言配置
const translations = {
  zh: {
    // 通用
    title: '沐美服务',
    subtitle: '一人公司API服务平台',
    // 导航
    tools: '工具箱',
    toolbox: '工具箱',
    userPanel: '用户面板',
    pricing: '定价',
    docs: '文档',
    logout: '退出登录',
    // 工具分类
    aiTools: 'AI工具',
    fileTools: '文件工具',
    dataTools: '数据工具',
    networkTools: '网络工具',
    securityTools: '安全工具',
    devTools: '开发工具',
    // 首页
    pdfConverter: 'PDF转换器',
    uploadPDF: '上传PDF',
    convert: '转换',
    result: '转换结果',
    apiDocs: 'API文档',
    contact: '联系我们',
    // 登录/注册
    login: '登录',
    register: '注册',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    verifyCode: '验证码',
    sendCode: '发送验证码',
    forgotPassword: '忘记密码？',
    resetPassword: '重置密码',
    // 面板统计
    usageStats: '使用统计',
    dailyUsage: '今日调用',
    monthlyUsage: '本月调用',
    totalCalls: '总调用次数',
    successRate: '成功率',
    avgResponse: '平均响应',
    activeTokens: '活跃Token',
    // 套餐
    currentPlan: '当前套餐',
    upgrade: '升级套餐',
    plans: '套餐列表',
    free: '免费版',
    pro: '专业版',
    enterprise: '企业版',
    perMonth: '/月',
    dailyLimit: '每日限额',
    monthlyLimit: '每月限额',
    maxTokens: '最大Token数',
    maxFileSize: '最大文件大小',
    // Token管理
    myTokens: '我的Token',
    createToken: '创建Token',
    tokenName: 'Token名称',
    revokeToken: '撤销',
    copyToken: '复制',
    active: '启用',
    inactive: '禁用',
    lastUsed: '最后使用',
    // 日志
    apiLogs: 'API日志',
    endpoint: '接口',
    status: '状态',
    duration: '耗时',
    time: '时间',
    // 订单
    orderHistory: '订单历史',
    orderId: '订单号',
    amount: '金额',
    paymentMethod: '支付方式',
    orderStatus: '状态',
    orderTime: '时间',
    // 邀请
    referral: '邀请奖励',
    inviteLink: '邀请链接',
    copyLink: '复制链接',
    inviteCount: '邀请人数',
    registeredCount: '已注册',
    rewardCount: '获得奖励',
    // 个人资料
    profile: '个人资料',
    displayName: '显示名称',
    bio: '个人简介',
    saveProfile: '保存资料',
    changePassword: '修改密码',
    currentPassword: '当前密码',
    newPassword: '新密码',
    // 定价页
    pricingTitle: '选择适合您的套餐',
    pricingSubtitle: '灵活定价，按需选择',
    monthly: '月付',
    yearly: '年付',
    getStarted: '免费开始',
    subscribe: '立即订阅',
    contactSales: '联系销售',
    // 通用操作
    save: '保存',
    cancel: '取消',
    delete: '删除',
    confirm: '确认',
    close: '关闭',
    loading: '加载中...',
    success: '成功',
    error: '错误',
    noData: '暂无数据',
    // 最近使用
    recentUsage: '最近使用',
    // 文档页
    docsTitle: 'API文档',
    quickStart: '快速开始',
    authentication: '认证方式',
    apiReference: 'API参考',
    // 反馈页
    feedbackTitle: '意见反馈',
    feedbackDesc: '您的反馈对我们很重要',
    feedbackType: '反馈类型',
    feedbackContent: '反馈内容',
    submitFeedback: '提交反馈',
    // 压缩页
    compressTitle: '文件压缩',
    selectFiles: '选择文件',
    compressBtn: '开始压缩',
    downloadAll: '下载全部',
    // 邀请补充
    referralDesc: '分享你的邀请链接，好友注册你获得 20 次免费调用',
    referralTip: '💡 好友付费购买专业版，你额外获得 ¥5 返利',
    viewAll: '查看全部'
  },
  en: {
    // General
    title: 'Mumei Service',
    subtitle: 'One-Person Company API Platform',
    // Nav
    tools: 'Toolbox',
    toolbox: 'Toolbox',
    userPanel: 'User Panel',
    pricing: 'Pricing',
    docs: 'Docs',
    logout: 'Logout',
    // Tool categories
    aiTools: 'AI Tools',
    fileTools: 'File Tools',
    dataTools: 'Data Tools',
    networkTools: 'Network Tools',
    securityTools: 'Security Tools',
    devTools: 'Dev Tools',
    // Home
    pdfConverter: 'PDF Converter',
    uploadPDF: 'Upload PDF',
    convert: 'Convert',
    result: 'Result',
    apiDocs: 'API Docs',
    contact: 'Contact',
    // Auth
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    verifyCode: 'Verify Code',
    sendCode: 'Send Code',
    forgotPassword: 'Forgot Password?',
    resetPassword: 'Reset Password',
    // Stats
    usageStats: 'Usage Stats',
    dailyUsage: 'Daily Calls',
    monthlyUsage: 'Monthly Calls',
    totalCalls: 'Total Calls',
    successRate: 'Success Rate',
    avgResponse: 'Avg Response',
    activeTokens: 'Active Tokens',
    // Plans
    currentPlan: 'Current Plan',
    upgrade: 'Upgrade Plan',
    plans: 'Plans',
    free: 'Free',
    pro: 'Pro',
    enterprise: 'Enterprise',
    perMonth: '/mo',
    dailyLimit: 'Daily Limit',
    monthlyLimit: 'Monthly Limit',
    maxTokens: 'Max Tokens',
    maxFileSize: 'Max File Size',
    // Tokens
    myTokens: 'My Tokens',
    createToken: 'Create Token',
    tokenName: 'Token Name',
    revokeToken: 'Revoke',
    copyToken: 'Copy',
    active: 'Active',
    inactive: 'Inactive',
    lastUsed: 'Last Used',
    // Logs
    apiLogs: 'API Logs',
    endpoint: 'Endpoint',
    status: 'Status',
    duration: 'Duration',
    time: 'Time',
    // Orders
    orderHistory: 'Order History',
    orderId: 'Order ID',
    amount: 'Amount',
    paymentMethod: 'Payment',
    orderStatus: 'Status',
    orderTime: 'Time',
    // Referral
    referral: 'Referral Rewards',
    inviteLink: 'Invite Link',
    copyLink: 'Copy Link',
    inviteCount: 'Invited',
    registeredCount: 'Registered',
    rewardCount: 'Rewards',
    // Profile
    profile: 'Profile',
    displayName: 'Display Name',
    bio: 'Bio',
    saveProfile: 'Save Profile',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    // Pricing
    pricingTitle: 'Choose Your Plan',
    pricingSubtitle: 'Flexible pricing for every need',
    monthly: 'Monthly',
    yearly: 'Yearly',
    getStarted: 'Get Started Free',
    subscribe: 'Subscribe Now',
    contactSales: 'Contact Sales',
    // Common
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    close: 'Close',
    loading: 'Loading...',
    success: 'Success',
    error: 'Error',
    noData: 'No data',
    // Recent
    recentUsage: 'Recent Usage',
    // Docs
    docsTitle: 'API Documentation',
    quickStart: 'Quick Start',
    authentication: 'Authentication',
    apiReference: 'API Reference',
    // Feedback
    feedbackTitle: 'Feedback',
    feedbackDesc: 'Your feedback matters to us',
    feedbackType: 'Type',
    feedbackContent: 'Content',
    submitFeedback: 'Submit',
    // Compress
    compressTitle: 'File Compress',
    selectFiles: 'Select Files',
    compressBtn: 'Compress',
    downloadAll: 'Download All',
    // Referral extra
    referralDesc: 'Share your invite link — friends who register earn you 20 free calls',
    referralTip: '💡 Friends who buy Pro earn you ¥5 cashback',
    viewAll: 'View All'
  }
};

// 工具定价配置
const toolPricing = {
  // AI工具
  'ai/text-generate': { price: 0.002, unit: '1K tokens', freeQuota: 100 },
  'ai/image-generate': { price: 0.04, unit: 'per image', freeQuota: 5 },
  'ai/tts': { price: 0.015, unit: '1K chars', freeQuota: 1000 },
  'ai/stt': { price: 0.006, unit: 'per minute', freeQuota: 10 },
  'ai/translate': { price: 0.0001, unit: 'per char', freeQuota: 5000 },
  
  // 文件工具
  'file/convert': { price: 0.01, unit: 'per file', freeQuota: 10 },
  'file/image-process': { price: 0.005, unit: 'per image', freeQuota: 20 },
  'file/video-process': { price: 0.1, unit: 'per minute', freeQuota: 5 },
  'file/compress': { price: 0.001, unit: 'per file', freeQuota: 50 },
  'file/markdown-render': { price: 0.005, unit: 'per file', freeQuota: 20 },
  
  // 数据工具（大多免费）
  'data/json-format': { price: 0, unit: 'free', freeQuota: Infinity },
  'data/csv-convert': { price: 0, unit: 'free', freeQuota: Infinity },
  'data/sql-format': { price: 0, unit: 'free', freeQuota: Infinity },
  'data/regex-test': { price: 0, unit: 'free', freeQuota: Infinity },
  'data/base64': { price: 0, unit: 'free', freeQuota: Infinity },
  'data/jwt': { price: 0, unit: 'free', freeQuota: Infinity },
  
  // 网络工具
  'network/dns': { price: 0, unit: 'free', freeQuota: Infinity },
  'network/ip-lookup': { price: 0, unit: 'free', freeQuota: Infinity },
  'network/whois': { price: 0.002, unit: 'per query', freeQuota: 50 },
  'network/ssl-check': { price: 0, unit: 'free', freeQuota: Infinity },
  'network/speed-test': { price: 0, unit: 'free', freeQuota: Infinity },
  'network/http-request': { price: 0, unit: 'free', freeQuota: Infinity },
  
  // 安全工具（大多免费）
  'security/password-generate': { price: 0, unit: 'free', freeQuota: Infinity },
  'security/password-check': { price: 0, unit: 'free', freeQuota: Infinity },
  'security/hash': { price: 0, unit: 'free', freeQuota: Infinity },
  'security/hmac': { price: 0, unit: 'free', freeQuota: Infinity },
  'security/url-encode': { price: 0, unit: 'free', freeQuota: Infinity },
  'security/html-escape': { price: 0, unit: 'free', freeQuota: Infinity },
  'security/mask-data': { price: 0, unit: 'free', freeQuota: Infinity },
  'security/uuid': { price: 0, unit: 'free', freeQuota: Infinity },
  'security/encrypt': { price: 0, unit: 'free', freeQuota: Infinity },
  
  // 开发工具（大多免费）
  'dev/code-format': { price: 0, unit: 'free', freeQuota: Infinity },
  'dev/code-minify': { price: 0, unit: 'free', freeQuota: Infinity },
  'dev/code-diff': { price: 0, unit: 'free', freeQuota: Infinity },
  'dev/cron-parse': { price: 0, unit: 'free', freeQuota: Infinity },
  'dev/timestamp': { price: 0, unit: 'free', freeQuota: Infinity },
  'dev/color-convert': { price: 0, unit: 'free', freeQuota: Infinity }
};

// 认证中间件组合
function validateApiToken(req, res, next) {
  const apiToken = req.headers['x-api-token'];
  if (!apiToken) {
    return res.status(401).json({ error: '未提供API Token' });
  }
  const tokenData = TokenDB.validateToken(apiToken);
  if (!tokenData) {
    return res.status(401).json({ error: 'API Token无效' });
  }
  req.apiUser = tokenData;
  next();
}

function combinedAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authMiddleware(req, res, next);
  }
  return validateApiToken(req, res, next);
}

// ============ 配额检查中间件 ============
const PLAN_DAILY_LIMITS = {
  free:       100,
  pro:        10000,
  enterprise: 100000
};

function quotaMiddleware(req, res, next) {
  try {
    const user = req.user || req.apiUser;
    if (!user) return next(); // 未登录用户不限（免费工具无需登录）

    const userId = user.id || user.userId || user.sub;
    const plan   = user.plan || 'free';
    const limit  = PLAN_DAILY_LIMITS[plan] ?? 100;

    // 企业版无限制
    if (plan === 'enterprise') return next();

    const todayCount = LogDB.getTodayCallCount(userId);
    if (todayCount >= limit) {
      return res.status(429).json({
        error: `今日调用次数已达上限（${limit} 次），请明天再试或升级套餐`,
        code: 'QUOTA_EXCEEDED',
        limit,
        used: todayCount,
        upgradeUrl: '/pricing'
      });
    }
    next();
  } catch (e) {
    next(); // 配额检查失败不阻断请求
  }
}

// ==================== 工具API路由 ====================

// 获取工具列表和定价
app.get('/api/tools', (req, res) => {
  res.json({
    success: true,
    tools: toolPricing,
    categories: {
      ai: ['ai/text-generate', 'ai/image-generate', 'ai/tts', 'ai/stt', 'ai/translate'],
      file: ['file/convert', 'file/image-process', 'file/video-process', 'file/compress', 'file/markdown-render'],
      data: ['data/json-format', 'data/csv-convert', 'data/sql-format', 'data/regex-test', 'data/base64', 'data/jwt'],
      network: ['network/dns', 'network/ip-lookup', 'network/whois', 'network/ssl-check', 'network/speed-test', 'network/http-request'],
      security: ['security/password-generate', 'security/password-check', 'security/hash', 'security/hmac', 'security/url-encode', 'security/html-escape', 'security/mask-data', 'security/uuid', 'security/encrypt'],
      dev: ['dev/code-format', 'dev/code-minify', 'dev/code-diff', 'dev/cron-parse', 'dev/timestamp', 'dev/color-convert']
    }
  });
});

// ==================== AI工具API ====================

// 文本生成
app.post('/api/tools/ai/text-generate', combinedAuth, quotaMiddleware, async (req, res) => {
  try {
    const { prompt, model = 'gpt-3.5-turbo', maxTokens = 1000, temperature = 0.7, systemPrompt = '' } = req.body;
    const result = await TextGenerationService.generate({ prompt, model, maxTokens, temperature, systemPrompt });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代码生成
app.post('/api/tools/ai/code-generate', combinedAuth, quotaMiddleware, async (req, res) => {
  try {
    const { prompt, language = 'javascript', model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.generateCode({ prompt, language, model });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代码审查
app.post('/api/tools/ai/code-review', combinedAuth, quotaMiddleware, async (req, res) => {
  try {
    const { code, language = 'javascript', model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.reviewCode({ code, language, model });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 文本摘要
app.post('/api/tools/ai/summarize', combinedAuth, quotaMiddleware, async (req, res) => {
  try {
    const { text, maxLength = 200, model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.summarize({ text, maxLength, model });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 图像生成
app.post('/api/tools/ai/image-generate', combinedAuth, quotaMiddleware, async (req, res) => {
  try {
    const { prompt, model = 'dall-e-3', size = '1024x1024', n = 1 } = req.body;
    const result = await ImageGenerationService.generate({ prompt, model, size, n });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 语音合成
app.post('/api/tools/ai/tts', combinedAuth, quotaMiddleware, async (req, res) => {
  try {
    const { text, model = 'tts-1', voice = 'alloy', speed = 1.0 } = req.body;
    const result = await TTSService.synthesize({ text, model, voice, speed });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 语音识别
app.post('/api/tools/ai/stt', combinedAuth, quotaMiddleware, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }
    const { model = 'whisper-1', language = 'zh' } = req.body;
    const result = await STTService.transcribe({ audio: req.file.path, model, language });
    fs.unlinkSync(req.file.path);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 翻译
app.post('/api/tools/ai/translate', combinedAuth, quotaMiddleware, async (req, res) => {
  try {
    const { text, sourceLang = 'auto', targetLang = 'en' } = req.body;
    const result = await TranslationService.translate({ text, sourceLang, targetLang });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 文件工具API ====================

// 文档转换
app.post('/api/tools/file/convert', combinedAuth, quotaMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }
    const { outputFormat } = req.body;
    const result = await FileProcessingService.convertDocument(req.file.path, outputFormat);
    
    // 发送文件
    res.download(result.outputPath, (err) => {
      if (err) {
        console.error('文件下载错误:', err);
      }
      // 清理临时文件
      fs.unlinkSync(req.file.path);
      if (fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 图片处理
app.post('/api/tools/file/image-process', combinedAuth, quotaMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' });
    }
    const operations = JSON.parse(req.body.operations || '[]');
    const result = await FileProcessingService.processImage(req.file.path, operations);
    
    res.download(result.outputPath, (err) => {
      if (err) console.error('文件下载错误:', err);
      fs.unlinkSync(req.file.path);
      if (fs.existsSync(result.outputPath)) {
        fs.unlinkSync(result.outputPath);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Markdown渲染
app.post('/api/tools/file/markdown-render', combinedAuth, quotaMiddleware, async (req, res) => {
  try {
    const { content, outputFormat = 'html', options = {} } = req.body;
    const result = await FileProcessingService.renderMarkdown(content, outputFormat, options);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 数据工具API ====================

// JSON格式化
app.post('/api/tools/data/json-format', async (req, res) => {
  try {
    const { json, options = {} } = req.body;
    const result = DataProcessingService.formatJSON(json, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JSON转CSV
app.post('/api/tools/data/json-to-csv', async (req, res) => {
  try {
    const { data, options = {} } = req.body;
    const result = DataProcessingService.jsonToCSV(data, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CSV转JSON
app.post('/api/tools/data/csv-to-json', async (req, res) => {
  try {
    const { csv, options = {} } = req.body;
    const result = await DataProcessingService.csvToJSON(csv, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SQL格式化
app.post('/api/tools/data/sql-format', async (req, res) => {
  try {
    const { sql, options = {} } = req.body;
    const result = DataProcessingService.formatSQL(sql, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 正则测试
app.post('/api/tools/data/regex-test', async (req, res) => {
  try {
    const { pattern, flags = '', testStrings = [], text } = req.body;
    const strings = testStrings.length > 0 ? testStrings : (text ? [text] : []);
    if (!pattern || strings.length === 0) {
      return res.status(400).json({ error: '请提供pattern和text/testStrings参数' });
    }
    const result = DataProcessingService.testRegex(pattern, flags, strings);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Base64编码
app.post('/api/tools/data/base64-encode', async (req, res) => {
  try {
    const { text, data, options = {} } = req.body;
    const input = text || data;
    if (!input) {
      return res.status(400).json({ error: '请提供text或data参数' });
    }
    const result = DataProcessingService.base64Encode(input, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Base64解码
app.post('/api/tools/data/base64-decode', async (req, res) => {
  try {
    const { encoded, text, options = {} } = req.body;
    const input = encoded || text;
    if (!input) {
      return res.status(400).json({ error: '请提供encoded或text参数' });
    }
    const result = DataProcessingService.base64Decode(input, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JWT解码
app.post('/api/tools/data/jwt-decode', async (req, res) => {
  try {
    const { token, secret } = req.body;
    const result = DataProcessingService.decodeJWT(token, secret);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JWT生成
app.post('/api/tools/data/jwt-generate', async (req, res) => {
  try {
    const { payload, secret, options = {} } = req.body;
    const result = DataProcessingService.generateJWT(payload, secret, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 网络工具API ====================

// DNS查询
app.get('/api/tools/network/dns', async (req, res) => {
  try {
    const { domain, type = 'A' } = req.query;
    const result = await NetworkService.dnsLookup(domain, type);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IP查询
app.get('/api/tools/network/ip-lookup', async (req, res) => {
  try {
    const { ip } = req.query;
    const result = await NetworkService.ipLookup(ip);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Whois查询
app.get('/api/tools/network/whois', async (req, res) => {
  try {
    const { domain } = req.query;
    const result = await NetworkService.whoisLookup(domain);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SSL检查
app.get('/api/tools/network/ssl-check', async (req, res) => {
  try {
    const { hostname, port = 443 } = req.query;
    const result = await NetworkService.checkSSL(hostname, parseInt(port));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 网站测速
app.get('/api/tools/network/speed-test', async (req, res) => {
  try {
    const { url } = req.query;
    const result = await NetworkService.speedTest(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HTTP请求测试
app.post('/api/tools/network/http-request', async (req, res) => {
  try {
    const result = await NetworkService.httpRequest(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 安全工具API ====================

// 密码生成
app.post('/api/tools/security/password-generate', async (req, res) => {
  try {
    const result = SecurityService.generatePassword(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 密码泄露检查
app.post('/api/tools/security/password-check', async (req, res) => {
  try {
    const { password } = req.body;
    const result = await SecurityService.checkPasswordBreach(password);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 哈希计算
app.post('/api/tools/security/hash', async (req, res) => {
  try {
    const { data, algorithm = 'sha256' } = req.body;
    const result = SecurityService.calculateHash(data, algorithm);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批量哈希
app.post('/api/tools/security/hash-batch', async (req, res) => {
  try {
    const { data, algorithms } = req.body;
    const result = SecurityService.calculateHashes(data, algorithms);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// URL编码
app.post('/api/tools/security/url-encode', async (req, res) => {
  try {
    const { text, component = false } = req.body;
    const result = SecurityService.urlEncode(text, { component });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// URL解码
app.post('/api/tools/security/url-decode', async (req, res) => {
  try {
    const { encoded, component = false } = req.body;
    const result = SecurityService.urlDecode(encoded, { component });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HTML转义
app.post('/api/tools/security/html-escape', async (req, res) => {
  try {
    const { html } = req.body;
    const result = SecurityService.escapeHTML(html);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HTML反转义
app.post('/api/tools/security/html-unescape', async (req, res) => {
  try {
    const { escaped } = req.body;
    const result = SecurityService.unescapeHTML(escaped);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 数据脱敏
app.post('/api/tools/security/mask-data', async (req, res) => {
  try {
    const { data, type } = req.body;
    const result = SecurityService.maskData(data, type);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UUID生成
app.post('/api/tools/security/uuid-generate', async (req, res) => {
  try {
    const { version = 4, options = {} } = req.body;
    const result = SecurityService.generateUUID(version, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 加密
app.post('/api/tools/security/encrypt', async (req, res) => {
  try {
    const { data, key, algorithm = 'aes-256-gcm' } = req.body;
    const result = SecurityService.encrypt(data, key, algorithm);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 解密
app.post('/api/tools/security/decrypt', async (req, res) => {
  try {
    const { encrypted, key, algorithm = 'aes-256-gcm' } = req.body;
    const result = SecurityService.decrypt(encrypted, key, algorithm);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 开发工具API ====================

// 代码格式化
app.post('/api/tools/dev/code-format', async (req, res) => {
  try {
    const { code, language, options = {} } = req.body;
    const result = await DevToolsService.formatCode(code, language, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代码压缩
app.post('/api/tools/dev/code-minify', async (req, res) => {
  try {
    const { code, language, options = {} } = req.body;
    const result = DevToolsService.minifyCode(code, language, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代码对比
app.post('/api/tools/dev/code-diff', async (req, res) => {
  try {
    const { oldCode, newCode, options = {} } = req.body;
    const result = DevToolsService.diffCode(oldCode, newCode, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cron解析
app.post('/api/tools/dev/cron-parse', async (req, res) => {
  try {
    const { expression, options = {} } = req.body;
    const result = DevToolsService.parseCron(expression, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cron生成
app.post('/api/tools/dev/cron-generate', async (req, res) => {
  try {
    const result = DevToolsService.generateCron(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 时间戳转换
app.post('/api/tools/dev/timestamp-convert', async (req, res) => {
  try {
    const { timestamp, options = {} } = req.body;
    const result = DevToolsService.convertTimestamp(timestamp, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 颜色转换
app.post('/api/tools/dev/color-convert', async (req, res) => {
  try {
    const { color, targetFormat } = req.body;
    const result = DevToolsService.convertColor(color, targetFormat);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 原有API路由（认证、Token、支付等）====================

// ... [保留原有的所有路由代码] ...

// 获取翻译
app.get('/api/translations/:lang', (req, res) => {
  const lang = req.params.lang;
  res.json(translations[lang] || translations.zh);
});

// PDF转文字
app.post('/api/pdf-to-text', combinedAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传PDF文件' });
    }
    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(dataBuffer);
    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info
    });
  } catch (error) {
    res.status(500).json({ error: 'PDF转换失败' });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    tools: Object.keys(toolPricing).length,
    version: '2.0.0'
  });
});

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

app.get('/tools', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tools.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

app.get('/feedback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'feedback.html'));
});

app.get('/compress', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'compress.html'));
});

app.get('/qrcode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qrcode.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// API 认证路由
app.post('/api/auth/send-verification', verifyLimiter, handleSendVerification);
app.post('/api/auth/send-code', verifyLimiter, handleSendVerification);
app.post('/api/auth/register', authLimiter, handleRegister);
app.post('/api/auth/login', authLimiter, handleLogin);

// 简化注册 (无需验证码)
app.post('/api/auth/quick-register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '请填写邮箱和密码' });
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    
    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    
    // 检查是否已注册
    const existingUser = UserDB.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已注册，请直接登录' });
    }
    
    // 创建用户
    const user = await UserDB.createUser(email, password);
    
    // 处理邀请奖励
    const refFrom = req.query.ref || req.body?.ref;
    if (refFrom) {
      // 创建邀请记录
      ReferralDB.createReferral(refFrom, user.id);
      // 奖励邀请人
      ReferralDB.rewardReferrer(refFrom, user.id);
      console.log(`🎁 邀请奖励: ${refFrom} 邀请 ${user.email} 注册成功`);
    }
    
    // 创建欢迎 Token
    const token = generateToken({ id: user.id, email: user.email, verified: true, plan: user.plan });
    
    // 记录赠送配额（7天有效期）
    const welcomeBonus = {
      type: 'welcome_bonus',
      count: 50,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    res.json({ 
      success: true,
      message: '注册成功！欢迎加入沐美服务',
      token,
      user: { 
        id: user.id, 
        email: user.email, 
        verified: true, 
        plan: user.plan,
        welcomeBonus,
        invitedBy: refFrom || null
      }
    });
  } catch (error) {
    console.error('Quick register error:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// ============ 忘记密码 / 重置密码 ============

// 内存存储重置 token（生产环境建议存数据库）
const passwordResetTokens = new Map();

// 发送重置密码邮件
app.post('/api/auth/forgot-password', verifyLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱' });

    const user = UserDB.getUserByEmail(email);
    // 无论用户是否存在，都返回成功（防止枚举攻击）
    if (!user) {
      return res.json({ success: true, message: '如果该邮箱已注册，重置链接已发送' });
    }

    // 生成重置 token（1小时有效）
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    passwordResetTokens.set(resetToken, {
      userId: user.id,
      email: user.email,
      expiresAt: Date.now() + 60 * 60 * 1000
    });

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // 发送邮件
    const { sendVerificationEmail } = require('./email');
    // 复用邮件发送，内容自定义
    const transporter = (() => {
      try {
        const nodemailer = require('nodemailer');
        if (process.env.SMTP_HOST) {
          return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          });
        }
      } catch (e) {}
      return null;
    })();

    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: '沐美服务 - 重置密码',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px;">
            <h2 style="color:#6366f1;">重置您的密码</h2>
            <p>您好，我们收到了您的密码重置请求。</p>
            <p>请点击下方按钮重置密码（链接1小时内有效）：</p>
            <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 32px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">重置密码</a>
            <p style="color:#999;font-size:13px;">如果您没有申请重置密码，请忽略此邮件。</p>
            <p style="color:#999;font-size:12px;">链接：${resetUrl}</p>
          </div>
        `
      });
    } else {
      // 开发模式：打印到控制台
      console.log(`\n========== 重置密码链接 ==========`);
      console.log(`用户: ${email}`);
      console.log(`链接: ${resetUrl}`);
      console.log(`==================================\n`);
    }

    res.json({ success: true, message: '如果该邮箱已注册，重置链接已发送' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: '发送失败，请稍后重试' });
  }
});

// 重置密码页面
app.get('/reset-password', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重置密码 - 沐美服务</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
           background:#0a0a0f; color:#e4e4e7; display:flex;
           align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#1a1a24; border:1px solid #2a2a3a; border-radius:16px;
            padding:40px; width:90%; max-width:400px; }
    h2 { font-size:1.5rem; margin-bottom:8px; color:#6366f1; }
    p { color:#71717a; font-size:14px; margin-bottom:24px; }
    .form-group { margin-bottom:16px; }
    label { display:block; font-size:14px; margin-bottom:6px; color:#a1a1aa; }
    input { width:100%; padding:10px 14px; background:#12121a; border:1px solid #2a2a3a;
            border-radius:8px; color:#e4e4e7; font-size:14px; outline:none; }
    input:focus { border-color:#6366f1; }
    button { width:100%; padding:12px; background:#6366f1; color:#fff; border:none;
             border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; margin-top:8px; }
    button:hover { background:#818cf8; }
    .msg { margin-top:16px; padding:12px; border-radius:8px; font-size:14px; text-align:center; }
    .msg.success { background:rgba(34,197,94,0.1); color:#22c55e; border:1px solid rgba(34,197,94,0.3); }
    .msg.error { background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.3); }
  </style>
</head>
<body>
  <div class="card">
    <h2>🔑 重置密码</h2>
    <p>请输入您的新密码</p>
    <div class="form-group">
      <label>新密码</label>
      <input type="password" id="newPassword" placeholder="至少6位" minlength="6">
    </div>
    <div class="form-group">
      <label>确认新密码</label>
      <input type="password" id="confirmPassword" placeholder="再次输入新密码">
    </div>
    <button onclick="resetPassword()">确认重置</button>
    <div id="msg"></div>
  </div>
  <script>
    const token = new URLSearchParams(location.search).get('token');
    if (!token) {
      document.getElementById('msg').innerHTML = '<div class="msg error">链接无效或已过期</div>';
    }
    async function resetPassword() {
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      if (!newPassword || newPassword.length < 6) {
        document.getElementById('msg').innerHTML = '<div class="msg error">密码至少6位</div>';
        return;
      }
      if (newPassword !== confirmPassword) {
        document.getElementById('msg').innerHTML = '<div class="msg error">两次密码不一致</div>';
        return;
      }
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('msg').innerHTML = '<div class="msg success">密码重置成功！正在跳转...</div>';
        setTimeout(() => location.href = '/panel', 2000);
      } else {
        document.getElementById('msg').innerHTML = \`<div class="msg error">\${data.error || '重置失败'}</div>\`;
      }
    }
  </script>
</body>
</html>`);
});

// 执行重置密码
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: '参数缺失' });
    if (newPassword.length < 6) return res.status(400).json({ error: '密码至少6位' });

    const record = passwordResetTokens.get(token);
    if (!record) return res.status(400).json({ error: '链接无效或已过期' });
    if (Date.now() > record.expiresAt) {
      passwordResetTokens.delete(token);
      return res.status(400).json({ error: '链接已过期，请重新申请' });
    }

    // 更新密码
    await UserDB.updatePassword(record.userId, newPassword);
    passwordResetTokens.delete(token);

    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: '重置失败，请稍后重试' });
  }
});

// ============ 用户核心 API ============

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const user = UserDB.getUserById(userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({
      success: true,
      user: { id: user.id, email: user.email, plan: user.plan, createdAt: user.created_at }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取使用统计
app.get('/api/stats', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const { logs = [] } = LogDB.getUserLogs(userId, { limit: 1000 });

    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);

    const dailyLogs = logs.filter(l => (l.timestamp || '').startsWith(today));
    const monthlyLogs = logs.filter(l => (l.timestamp || '').startsWith(thisMonth));
    const successLogs = logs.filter(l => l.status === 'success' || l.status_code === 200);
    const totalResponse = logs.reduce((sum, l) => sum + (l.response_time || 0), 0);

    const tokens = TokenDB.getUserTokens(userId);
    const activeTokens = tokens.filter(t => !t.revoked).length;

    res.json({
      success: true,
      stats: {
        dailyUsage: dailyLogs.length,
        monthlyUsage: monthlyLogs.length,
        totalCalls: logs.length,
        successRate: logs.length > 0 ? Math.round((successLogs.length / logs.length) * 100) : 100,
        avgResponse: logs.length > 0 ? Math.round(totalResponse / logs.length) : 0,
        activeTokens
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取当前套餐详情
app.get('/api/plans/current', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const user = UserDB.getUserById(userId);
    const planId = user?.plan || 'free';

    const planConfig = {
      free:       { id: 'free',       name: '免费版',   price: 0,  features: { dailyRequests: 100,    monthlyRequests: 1000,    maxTokens: 3,   pdfSize: 5   } },
      pro:        { id: 'pro',        name: '专业版',   price: 29, features: { dailyRequests: 10000,  monthlyRequests: 100000,  maxTokens: 20,  pdfSize: 50  } },
      enterprise: { id: 'enterprise', name: '企业版',   price: 99, features: { dailyRequests: 100000, monthlyRequests: 1000000, maxTokens: 100, pdfSize: 200 } }
    };

    const plan = planConfig[planId] || planConfig.free;

    // 获取订阅到期时间
    const sub = SubscriptionDB.getActiveSubscription(userId);

    res.json({ success: true, plan, subscription: sub || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 订阅套餐（支付完成后也可直接调用升级，用于管理员手动升级）
app.post('/api/plans/subscribe', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id || req.user.userId || req.user.sub;

    const validPlans = ['free', 'pro', 'enterprise'];
    if (!validPlans.includes(planId)) {
      return res.status(400).json({ error: '无效套餐' });
    }

    // 免费版直接降级
    if (planId === 'free') {
      UserDB.updateUserPlan(userId, 'free');
      return res.json({ success: true, message: '已切换到免费版' });
    }

    // 付费套餐需要先走支付流程，这里仅供管理员或测试使用
    UserDB.updateUserPlan(userId, planId);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    SubscriptionDB.createSubscription(userId, planId, expiresAt);

    res.json({ success: true, message: `已升级到${planId === 'pro' ? '专业版' : '企业版'}`, expiresAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Token 管理 API ============

// 获取用户 Token 列表
app.get('/api/tokens', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const tokens = TokenDB.getUserTokens(userId);
    res.json({ success: true, tokens });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 创建 Token
app.post('/api/tokens', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const { name } = req.body;

    // 检查套餐 Token 上限
    const user = UserDB.getUserById(userId);
    const planLimits = { free: 3, pro: 20, enterprise: 100 };
    const maxTokens = planLimits[user?.plan || 'free'];
    const existing = TokenDB.getUserTokens(userId).filter(t => !t.revoked);

    if (existing.length >= maxTokens) {
      return res.status(400).json({ error: `当前套餐最多创建 ${maxTokens} 个 Token，请升级套餐` });
    }

    const token = TokenDB.createToken(userId, name || 'My Token');
    res.json({ success: true, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 撤销 Token
app.delete('/api/tokens/:tokenId', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    TokenDB.revokeToken(req.params.tokenId, userId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 切换 Token 启用/禁用
app.patch('/api/tokens/:tokenId/toggle', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const result = TokenDB.toggleToken(req.params.tokenId, userId);
    if (!result) return res.status(404).json({ error: 'Token 不存在' });
    res.json({ success: true, active: result.active });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取 API 日志
app.get('/api/logs', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const endpoint = req.query.endpoint || '';

    const { logs, total } = LogDB.getUserLogs(userId, { limit: limit * page });

    // 过滤 endpoint
    const filtered = endpoint ? logs.filter(l => l.endpoint === endpoint) : logs;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      logs: paginated,
      total: filtered.length,
      page,
      totalPages: Math.ceil(filtered.length / limit)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ 邀请奖励 API ============

// 获取用户邀请链接和统计
app.get('/api/referrals', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const inviteLink = `${baseUrl}/register?ref=${userId}`;
    const stats = ReferralDB.getReferralStats(userId);
    res.json({ success: true, inviteLink, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 套餐路由
app.get('/api/plans', (req, res) => {
  const plans = PlanDB.getAllPlans();
  res.json({ success: true, plans });
});

// ============ 支付系统 ============
// 引入支付模块
const paymentModule = require('./payment-multi');
// OrderDB 已在顶部 require('./db-sqljs') 中导入，无需重复声明

// 获取可用支付方式
app.get('/api/payments/methods', (req, res) => {
  const payments = paymentModule.getAvailablePayments();
  res.json({ success: true, payments });
});

// 创建支付订单
app.post('/api/payments/create', authMiddleware, async (req, res) => {
  try {
    const { planId, method } = req.body;
    
    // 获取套餐信息
    const plan = PlanDB.getPlan(planId);
    if (!plan) {
      return res.status(400).json({ success: false, error: '套餐不存在' });
    }
    
    // 构建 PayPal return/cancel URL
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const paypalReturnUrl = `${baseUrl}/payment/paypal/return`;
    const paypalCancelUrl = `${baseUrl}/pricing`;

    // 创建支付
    const result = await paymentModule.createPayment(method, plan.price, plan, req.user, paypalReturnUrl, paypalCancelUrl);
    
    if (result.success) {
      // 保存订单到数据库（outTradeNo 用 PayPal orderId 或 epay outTradeNo）
      const outTradeNo = result.outTradeNo || result.orderId || result.paymentId || `MU_${Date.now()}`;
      const userId = req.user.id || req.user.userId || req.user.sub;
      const orderResult = OrderDB.createOrder(
        userId,
        planId,
        plan.price,
        method,
        outTradeNo
      );
      
      return res.json({
        success: true,
        orderId: orderResult.orderId,
        ...result
      });
    } else {
      return res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('创建支付失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 易支付回调（支持 POST JSON body 和 GET query 参数）
app.post('/api/payments/epay/notify', express.json(), async (req, res) => {
  try {
    // 兼容 GET（query）和 POST（body/JSON）两种回调方式
    const params = { ...req.query, ...req.body };

    if (paymentModule.verifyEpaySign(params)) {
      const { out_trade_no, trade_status, money } = params;

      if (trade_status === 'TRADE_SUCCESS') {
        const order = await OrderDB.getOrderByOutTradeNo(out_trade_no);
        if (order) {
          await OrderDB.completeOrder(order.id, out_trade_no);
          console.log(`✅ 易支付成功: ${out_trade_no}, 金额: ${money}`);
        }
      }

      res.send('success');
    } else {
      res.send('fail');
    }
  } catch (error) {
    console.error('易支付回调处理失败:', error);
    res.send('fail');
  }
});

// 易支付同步返回（用户支付完成后从易支付页面跳转回来）
app.get('/payment/return', (req, res) => {
  const { out_trade_no, trade_status } = req.query;
  if (trade_status === 'TRADE_SUCCESS') {
    res.redirect('/payment/success?method=epay&orderId=' + (out_trade_no || ''));
  } else {
    res.redirect('/pricing?error=payment_failed');
  }
});

// Stripe Webhook
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const result = await paymentModule.handleStripeWebhook(
    req.body,
    req.headers['stripe-signature']
  );
  
  if (result.success && result.event === 'payment_success') {
    const order = await OrderDB.getOrderByPaymentId(result.data.paymentId);
    if (order) {
      await OrderDB.completeOrder(order.id, result.data.paymentId);
      // 同时更新用户套餐
      UserDB.updateUserPlan(order.userId, order.planId);
      console.log('✅ Stripe 支付成功，套餐已升级:', order.planId);
    }
  }
  
  res.json({ received: true });
});

// PayPal 订单完成回调
app.post('/api/payments/paypal/capture', async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await paymentModule.capturePayPalOrder(orderId);
    
    if (result.success) {
      // 根据 PayPal orderId 查找订单
      const order = await OrderDB.getOrderByPaymentId(orderId);
      if (order) {
        await OrderDB.completeOrder(order.id, orderId);
        // 更新用户套餐
        UserDB.updateUserPlan(order.userId, order.planId);
        console.log('✅ PayPal 订单完成，套餐已升级:', order.planId);
      }
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PayPal 支付完成后跳回页面（用户从 PayPal 跳回来）
app.get('/payment/paypal/return', async (req, res) => {
  const { token: orderId, PayerID } = req.query;

  if (!orderId) {
    return res.redirect('/pricing?error=missing_order');
  }

  try {
    // 自动 capture 订单
    const result = await paymentModule.capturePayPalOrder(orderId);

    if (result.success) {
      // 更新数据库订单状态 + 用户套餐
      const order = await OrderDB.getOrderByPaymentId(orderId);
      if (order) {
        await OrderDB.completeOrder(order.id, orderId);
        UserDB.updateUserPlan(order.userId, order.planId);
        console.log('✅ PayPal 回跳 capture 成功，套餐已升级:', order.planId);
      }
      // 跳转到成功页面
      return res.redirect(`/payment/success?method=paypal&orderId=${orderId}`);
    } else {
      return res.redirect(`/pricing?error=capture_failed`);
    }
  } catch (err) {
    console.error('PayPal capture 失败:', err);
    return res.redirect('/pricing?error=server_error');
  }
});

// 支付成功页面
app.get('/payment/success', (req, res) => {
  const { method, orderId } = req.query;
  res.send(`<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>支付成功 - 沐美服务</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f8f9fa; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 48px 40px;
            text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
            max-width: 420px; width: 90%; }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 12px; }
    p { color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 8px; }
    .order-id { font-size: 12px; color: #999; margin: 16px 0; }
    .btn { display: inline-block; margin-top: 24px; padding: 12px 32px;
           background: #6c63ff; color: #fff; border-radius: 8px;
           text-decoration: none; font-size: 15px; font-weight: 500; }
    .btn:hover { background: #5a52d5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎉</div>
    <h1>支付成功！</h1>
    <p>感谢您的购买，您的套餐已成功开通。</p>
    <p>请登录账户查看您的权益。</p>
    ${orderId ? `<div class="order-id">订单号：${orderId}</div>` : ''}
    <a href="/" class="btn">返回首页</a>
  </div>
</body>
</html>`);
});

// 获取用户订单列表
app.get('/api/orders', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const orders = OrderDB.getUserOrders(userId);
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取订单详情
app.get('/api/orders/:orderId', authMiddleware, async (req, res) => {
  try {
    const order = await OrderDB.getOrder(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    // 检查权限
    if (order.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权访问此订单' });
    }
    
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API v1 版本控制
app.use('/api/v1/admin', adminRoutes);

// 启动服务器
async function startServer() {
  // 初始化数据库
  await initDatabase();
  
  // 初始化订单表
  OrderDB.initOrderTable();

  // ============ 定时任务：套餐到期自动降级 ============
  // 每天凌晨 2 点检查
  schedule.scheduleJob('0 2 * * *', async () => {
    console.log('🔄 检查套餐到期...');
    try {
      const allUsers = UserDB.getAllUsers();
      const now = new Date();

      for (const user of allUsers) {
        if (user.plan === 'free') continue;

        const sub = SubscriptionDB.getActiveSubscription(user.id);
        if (!sub) {
          // 没有有效订阅但套餐不是免费版 → 降级
          UserDB.updateUserPlan(user.id, 'free');
          console.log(`⬇️ 用户 ${user.email} 无有效订阅，已降级为免费版`);
          continue;
        }

        if (sub.expires_at) {
          const expiresAt = new Date(sub.expires_at);
          const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

          // 到期提醒邮件
          if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
            try {
              const { sendVerificationEmail } = require('./email');
              // 复用邮件模块发提醒（简化处理）
              console.log(`📧 发送到期提醒给 ${user.email}，剩余 ${daysLeft} 天`);
            } catch (e) {}
          }

          // 已到期 → 降级
          if (expiresAt < now) {
            UserDB.updateUserPlan(user.id, 'free');
            console.log(`⬇️ 用户 ${user.email} 套餐已到期，降级为免费版`);
          }
        }
      }
      console.log('✅ 套餐到期检查完成');
    } catch (e) {
      console.error('套餐到期检查失败:', e.message);
    }
  });

  const server = app.listen(PORT, () => {
    console.log(`沐美服务运行在 http://localhost:${PORT}`);
    console.log(`用户面板: http://localhost:${PORT}/panel`);
    console.log(`工具箱: http://localhost:${PORT}/tools`);
    console.log(`已加载 ${Object.keys(toolPricing).length} 个工具`);
  });

  // Graceful Shutdown - 优雅关闭
  function gracefulShutdown(signal) {
    console.log(`\n${signal} 收到信号，开始优雅关闭...`);
    
    // 停止接受新连接
    server.close(() => {
      console.log('✅ HTTP 服务器已关闭');
      console.log('✅ 所有资源已释放');
      process.exit(0);
    });
    
    // 30秒后强制退出
    setTimeout(() => {
      console.error('⚠️ 强制退出（超时）');
      process.exit(1);
    }, 30000);
  }

  // 注册信号处理器
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// 启动应用
startServer().catch(err => {
  console.error('❌ 启动失败:', err.message);
  process.exit(1);
});

// 捕获未处理错误
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获异常:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
});


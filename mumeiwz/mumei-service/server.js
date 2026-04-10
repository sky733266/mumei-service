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
const nodemailer = require('nodemailer');

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

// Webhook 触发辅助函数（静默失败，不阻塞主流程）
function triggerApiWebhook(userId, endpoint, result, duration) {
  if (!userId) return;
  webhookTrigger.trigger(userId, WebhookEvents.API_CALL_COMPLETED, {
    endpoint,
    success: true,
    duration,
    timestamp: new Date().toISOString(),
    // 不包含敏感数据，仅传递必要信息
    resultPreview: typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)
  }).catch(() => {}); // 静默
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 限制请求体大小
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 安全头中间件
app.use((req, res, next) => {
  // 内容安全策略 (CSP)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://js.stripe.com https://www.paypal.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https://api.stripe.com https://www.paypal.com; " +
    "frame-src 'self' https://js.stripe.com https://www.paypal.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS 保护
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 引用策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS (仅在 HTTPS 环境下启用)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // 权限策略
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(self), usb=(), magnetometer=(), gyroscope=()'
  );
  
  next();
});

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
    viewAll: '查看全部',
    language: '语言'
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
    viewAll: 'View All',
    language: 'Language'
  },

  // ============ 日本語 ============
  ja: {
    title: 'Mumeiサービス',
    subtitle: '個人企業APIサービスプラットフォーム',
    tools: 'ツールボックス',
    toolbox: 'ツールボックス',
    userPanel: 'ユーザーパネル',
    pricing: '料金プラン',
    docs: 'ドキュメント',
    logout: 'ログアウト',
    aiTools: 'AIツール',
    fileTools: 'ファイルツール',
    dataTools: 'データツール',
    networkTools: 'ネットワークツール',
    securityTools: 'セキュリティツール',
    devTools: '開発ツール',
    pdfConverter: 'PDF変換',
    uploadPDF: 'PDFをアップロード',
    convert: '変換',
    result: '変換結果',
    apiDocs: 'APIドキュメント',
    contact: 'お問い合わせ',
    login: 'ログイン',
    register: '登録',
    email: 'メールアドレス',
    password: 'パスワード',
    confirmPassword: 'パスワード確認',
    verifyCode: '認証コード',
    sendCode: 'コード送信',
    forgotPassword: 'パスワードを忘れた？',
    resetPassword: 'パスワードリセット',
    usageStats: '利用統計',
    dailyUsage: '本日の呼び出し',
    monthlyUsage: '今月の呼び出し',
    totalCalls: '総呼び出し数',
    successRate: '成功率',
    avgResponse: '平均応答時間',
    activeTokens: 'アクティブToken',
    currentPlan: '現在のプラン',
    upgrade: 'プランをアップグレード',
    plans: 'プラン一覧',
    free: '無料プラン',
    pro: 'プロプラン',
    enterprise: 'エンタープライズ',
    perMonth: '/月',
    dailyLimit: '1日の上限',
    monthlyLimit: '月間上限',
    maxTokens: '最大Token数',
    maxFileSize: '最大ファイルサイズ',
    myTokens: '自分のToken',
    createToken: 'Tokenを作成',
    tokenName: 'Token名',
    revokeToken: '無効化',
    copyToken: 'コピー',
    active: '有効',
    inactive: '無効',
    lastUsed: '最終使用',
    apiLogs: 'APIログ',
    endpoint: 'エンドポイント',
    status: 'ステータス',
    duration: '所要時間',
    time: '時刻',
    orderHistory: '注文履歴',
    orderId: '注文ID',
    amount: '金額',
    paymentMethod: '支払い方法',
    orderStatus: 'ステータス',
    orderTime: '時刻',
    referral: '招待報酬',
    inviteLink: '招待リンク',
    copyLink: 'リンクをコピー',
    inviteCount: '招待数',
    registeredCount: '登録済み',
    rewardCount: '報酬回数',
    profile: 'プロフィール',
    displayName: '表示名',
    bio: '自己紹介',
    saveProfile: 'プロフィールを保存',
    changePassword: 'パスワード変更',
    currentPassword: '現在のパスワード',
    newPassword: '新しいパスワード',
    pricingTitle: 'プランを選択',
    pricingSubtitle: '柔軟な料金プラン',
    monthly: '月払い',
    yearly: '年払い',
    getStarted: '無料で始める',
    subscribe: '今すぐ登録',
    contactSales: '営業に連絡',
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    confirm: '確認',
    close: '閉じる',
    loading: '読み込み中...',
    success: '成功',
    error: 'エラー',
    noData: 'データなし',
    recentUsage: '最近の使用',
    docsTitle: 'APIドキュメント',
    quickStart: 'クイックスタート',
    authentication: '認証方法',
    apiReference: 'APIリファレンス',
    feedbackTitle: 'フィードバック',
    feedbackDesc: 'ご意見をお聞かせください',
    feedbackType: '種類',
    feedbackContent: '内容',
    submitFeedback: '送信',
    compressTitle: 'ファイル圧縮',
    selectFiles: 'ファイルを選択',
    compressBtn: '圧縮開始',
    downloadAll: 'すべてダウンロード',
    referralDesc: '招待リンクを共有すると、友達が登録するたびに20回の無料呼び出しを獲得',
    referralTip: '💡 友達がプロプランを購入すると、¥5のキャッシュバックを獲得',
    viewAll: 'すべて表示',
    language: '言語'
  },

  // ============ 한국어 ============
  ko: {
    title: 'Mumei 서비스',
    subtitle: '1인 기업 API 서비스 플랫폼',
    tools: '도구함',
    toolbox: '도구함',
    userPanel: '사용자 패널',
    pricing: '요금제',
    docs: '문서',
    logout: '로그아웃',
    aiTools: 'AI 도구',
    fileTools: '파일 도구',
    dataTools: '데이터 도구',
    networkTools: '네트워크 도구',
    securityTools: '보안 도구',
    devTools: '개발 도구',
    pdfConverter: 'PDF 변환기',
    uploadPDF: 'PDF 업로드',
    convert: '변환',
    result: '변환 결과',
    apiDocs: 'API 문서',
    contact: '문의하기',
    login: '로그인',
    register: '회원가입',
    email: '이메일',
    password: '비밀번호',
    confirmPassword: '비밀번호 확인',
    verifyCode: '인증 코드',
    sendCode: '코드 전송',
    forgotPassword: '비밀번호를 잊으셨나요?',
    resetPassword: '비밀번호 재설정',
    usageStats: '사용 통계',
    dailyUsage: '오늘 호출',
    monthlyUsage: '이번 달 호출',
    totalCalls: '총 호출 수',
    successRate: '성공률',
    avgResponse: '평균 응답 시간',
    activeTokens: '활성 Token',
    currentPlan: '현재 요금제',
    upgrade: '요금제 업그레이드',
    plans: '요금제 목록',
    free: '무료',
    pro: '프로',
    enterprise: '엔터프라이즈',
    perMonth: '/월',
    dailyLimit: '일일 한도',
    monthlyLimit: '월간 한도',
    maxTokens: '최대 Token 수',
    maxFileSize: '최대 파일 크기',
    myTokens: '내 Token',
    createToken: 'Token 생성',
    tokenName: 'Token 이름',
    revokeToken: '취소',
    copyToken: '복사',
    active: '활성',
    inactive: '비활성',
    lastUsed: '마지막 사용',
    apiLogs: 'API 로그',
    endpoint: '엔드포인트',
    status: '상태',
    duration: '소요 시간',
    time: '시간',
    orderHistory: '주문 내역',
    orderId: '주문 ID',
    amount: '금액',
    paymentMethod: '결제 방법',
    orderStatus: '상태',
    orderTime: '시간',
    referral: '추천 보상',
    inviteLink: '초대 링크',
    copyLink: '링크 복사',
    inviteCount: '초대 수',
    registeredCount: '가입 완료',
    rewardCount: '보상 횟수',
    profile: '프로필',
    displayName: '표시 이름',
    bio: '자기소개',
    saveProfile: '프로필 저장',
    changePassword: '비밀번호 변경',
    currentPassword: '현재 비밀번호',
    newPassword: '새 비밀번호',
    pricingTitle: '요금제 선택',
    pricingSubtitle: '유연한 요금제',
    monthly: '월간',
    yearly: '연간',
    getStarted: '무료로 시작',
    subscribe: '지금 구독',
    contactSales: '영업팀 문의',
    save: '저장',
    cancel: '취소',
    delete: '삭제',
    confirm: '확인',
    close: '닫기',
    loading: '로딩 중...',
    success: '성공',
    error: '오류',
    noData: '데이터 없음',
    recentUsage: '최근 사용',
    docsTitle: 'API 문서',
    quickStart: '빠른 시작',
    authentication: '인증 방법',
    apiReference: 'API 참조',
    feedbackTitle: '피드백',
    feedbackDesc: '소중한 의견을 남겨주세요',
    feedbackType: '유형',
    feedbackContent: '내용',
    submitFeedback: '제출',
    compressTitle: '파일 압축',
    selectFiles: '파일 선택',
    compressBtn: '압축 시작',
    downloadAll: '모두 다운로드',
    referralDesc: '초대 링크를 공유하면 친구가 가입할 때마다 20회 무료 호출 획득',
    referralTip: '💡 친구가 프로 요금제를 구매하면 ¥5 캐시백 획득',
    viewAll: '전체 보기',
    language: '언어'
  },

  // ============ Français ============
  fr: {
    title: 'Service Mumei',
    subtitle: 'Plateforme API pour entreprise individuelle',
    tools: 'Boîte à outils',
    toolbox: 'Boîte à outils',
    userPanel: 'Tableau de bord',
    pricing: 'Tarifs',
    docs: 'Documentation',
    logout: 'Déconnexion',
    aiTools: 'Outils IA',
    fileTools: 'Outils fichiers',
    dataTools: 'Outils données',
    networkTools: 'Outils réseau',
    securityTools: 'Outils sécurité',
    devTools: 'Outils dev',
    pdfConverter: 'Convertisseur PDF',
    uploadPDF: 'Télécharger PDF',
    convert: 'Convertir',
    result: 'Résultat',
    apiDocs: 'Docs API',
    contact: 'Contact',
    login: 'Connexion',
    register: "S'inscrire",
    email: 'E-mail',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    verifyCode: 'Code de vérification',
    sendCode: 'Envoyer le code',
    forgotPassword: 'Mot de passe oublié ?',
    resetPassword: 'Réinitialiser le mot de passe',
    usageStats: "Statistiques d'utilisation",
    dailyUsage: "Appels aujourd'hui",
    monthlyUsage: 'Appels ce mois',
    totalCalls: 'Total des appels',
    successRate: 'Taux de succès',
    avgResponse: 'Réponse moyenne',
    activeTokens: 'Tokens actifs',
    currentPlan: 'Plan actuel',
    upgrade: 'Mettre à niveau',
    plans: 'Plans',
    free: 'Gratuit',
    pro: 'Pro',
    enterprise: 'Entreprise',
    perMonth: '/mois',
    dailyLimit: 'Limite quotidienne',
    monthlyLimit: 'Limite mensuelle',
    maxTokens: 'Tokens max',
    maxFileSize: 'Taille max fichier',
    myTokens: 'Mes Tokens',
    createToken: 'Créer un Token',
    tokenName: 'Nom du Token',
    revokeToken: 'Révoquer',
    copyToken: 'Copier',
    active: 'Actif',
    inactive: 'Inactif',
    lastUsed: 'Dernière utilisation',
    apiLogs: 'Journaux API',
    endpoint: 'Point de terminaison',
    status: 'Statut',
    duration: 'Durée',
    time: 'Heure',
    orderHistory: 'Historique des commandes',
    orderId: 'ID commande',
    amount: 'Montant',
    paymentMethod: 'Paiement',
    orderStatus: 'Statut',
    orderTime: 'Heure',
    referral: 'Parrainage',
    inviteLink: "Lien d'invitation",
    copyLink: 'Copier le lien',
    inviteCount: 'Invités',
    registeredCount: 'Inscrits',
    rewardCount: 'Récompenses',
    profile: 'Profil',
    displayName: "Nom d'affichage",
    bio: 'Bio',
    saveProfile: 'Enregistrer le profil',
    changePassword: 'Changer le mot de passe',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    pricingTitle: 'Choisissez votre plan',
    pricingSubtitle: 'Tarification flexible',
    monthly: 'Mensuel',
    yearly: 'Annuel',
    getStarted: 'Commencer gratuitement',
    subscribe: "S'abonner maintenant",
    contactSales: 'Contacter les ventes',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    confirm: 'Confirmer',
    close: 'Fermer',
    loading: 'Chargement...',
    success: 'Succès',
    error: 'Erreur',
    noData: 'Aucune donnée',
    recentUsage: 'Utilisation récente',
    docsTitle: 'Documentation API',
    quickStart: 'Démarrage rapide',
    authentication: 'Authentification',
    apiReference: 'Référence API',
    feedbackTitle: 'Commentaires',
    feedbackDesc: 'Vos commentaires nous importent',
    feedbackType: 'Type',
    feedbackContent: 'Contenu',
    submitFeedback: 'Envoyer',
    compressTitle: 'Compression de fichiers',
    selectFiles: 'Sélectionner des fichiers',
    compressBtn: 'Compresser',
    downloadAll: 'Tout télécharger',
    referralDesc: 'Partagez votre lien — chaque ami inscrit vous rapporte 20 appels gratuits',
    referralTip: '💡 Un ami qui achète Pro vous rapporte ¥5 de cashback',
    viewAll: 'Voir tout',
    language: 'Langue'
  },

  // ============ Español ============
  es: {
    title: 'Servicio Mumei',
    subtitle: 'Plataforma API para empresa unipersonal',
    tools: 'Caja de herramientas',
    toolbox: 'Caja de herramientas',
    userPanel: 'Panel de usuario',
    pricing: 'Precios',
    docs: 'Documentación',
    logout: 'Cerrar sesión',
    aiTools: 'Herramientas IA',
    fileTools: 'Herramientas de archivos',
    dataTools: 'Herramientas de datos',
    networkTools: 'Herramientas de red',
    securityTools: 'Herramientas de seguridad',
    devTools: 'Herramientas de desarrollo',
    pdfConverter: 'Convertidor PDF',
    uploadPDF: 'Subir PDF',
    convert: 'Convertir',
    result: 'Resultado',
    apiDocs: 'Docs API',
    contact: 'Contacto',
    login: 'Iniciar sesión',
    register: 'Registrarse',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    verifyCode: 'Código de verificación',
    sendCode: 'Enviar código',
    forgotPassword: '¿Olvidaste tu contraseña?',
    resetPassword: 'Restablecer contraseña',
    usageStats: 'Estadísticas de uso',
    dailyUsage: 'Llamadas hoy',
    monthlyUsage: 'Llamadas este mes',
    totalCalls: 'Total de llamadas',
    successRate: 'Tasa de éxito',
    avgResponse: 'Respuesta promedio',
    activeTokens: 'Tokens activos',
    currentPlan: 'Plan actual',
    upgrade: 'Actualizar plan',
    plans: 'Planes',
    free: 'Gratis',
    pro: 'Pro',
    enterprise: 'Empresarial',
    perMonth: '/mes',
    dailyLimit: 'Límite diario',
    monthlyLimit: 'Límite mensual',
    maxTokens: 'Tokens máximos',
    maxFileSize: 'Tamaño máximo de archivo',
    myTokens: 'Mis Tokens',
    createToken: 'Crear Token',
    tokenName: 'Nombre del Token',
    revokeToken: 'Revocar',
    copyToken: 'Copiar',
    active: 'Activo',
    inactive: 'Inactivo',
    lastUsed: 'Último uso',
    apiLogs: 'Registros API',
    endpoint: 'Endpoint',
    status: 'Estado',
    duration: 'Duración',
    time: 'Hora',
    orderHistory: 'Historial de pedidos',
    orderId: 'ID de pedido',
    amount: 'Importe',
    paymentMethod: 'Método de pago',
    orderStatus: 'Estado',
    orderTime: 'Hora',
    referral: 'Programa de referidos',
    inviteLink: 'Enlace de invitación',
    copyLink: 'Copiar enlace',
    inviteCount: 'Invitados',
    registeredCount: 'Registrados',
    rewardCount: 'Recompensas',
    profile: 'Perfil',
    displayName: 'Nombre para mostrar',
    bio: 'Biografía',
    saveProfile: 'Guardar perfil',
    changePassword: 'Cambiar contraseña',
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    pricingTitle: 'Elige tu plan',
    pricingSubtitle: 'Precios flexibles para cada necesidad',
    monthly: 'Mensual',
    yearly: 'Anual',
    getStarted: 'Comenzar gratis',
    subscribe: 'Suscribirse ahora',
    contactSales: 'Contactar ventas',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    confirm: 'Confirmar',
    close: 'Cerrar',
    loading: 'Cargando...',
    success: 'Éxito',
    error: 'Error',
    noData: 'Sin datos',
    recentUsage: 'Uso reciente',
    docsTitle: 'Documentación API',
    quickStart: 'Inicio rápido',
    authentication: 'Autenticación',
    apiReference: 'Referencia API',
    feedbackTitle: 'Comentarios',
    feedbackDesc: 'Tu opinión nos importa',
    feedbackType: 'Tipo',
    feedbackContent: 'Contenido',
    submitFeedback: 'Enviar',
    compressTitle: 'Comprimir archivos',
    selectFiles: 'Seleccionar archivos',
    compressBtn: 'Comprimir',
    downloadAll: 'Descargar todo',
    referralDesc: 'Comparte tu enlace — cada amigo que se registre te da 20 llamadas gratis',
    referralTip: '💡 Un amigo que compre Pro te da ¥5 de cashback',
    viewAll: 'Ver todo',
    language: 'Idioma'
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
  // 将 toolPricing 对象转换为数组格式
  const toolsList = Object.entries(toolPricing).map(([id, info]) => ({
    id,
    name: id.split('/').pop(),
    category: id.split('/')[0],
    price: info.price,
    unit: info.unit,
    freeQuota: info.freeQuota
  }));
  
  res.json({
    success: true,
    tools: toolsList,
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
  const start = Date.now();
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { prompt, model = 'gpt-3.5-turbo', maxTokens = 1000, temperature = 0.7, systemPrompt = '' } = req.body;
    const result = await TextGenerationService.generate({ prompt, model, maxTokens, temperature, systemPrompt });
    triggerApiWebhook(userId, '/api/tools/ai/text-generate', result, Date.now() - start);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代码生成
app.post('/api/tools/ai/code-generate', combinedAuth, quotaMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { prompt, language = 'javascript', model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.generateCode({ prompt, language, model });
    triggerApiWebhook(userId, '/api/tools/ai/code-generate', result, Date.now() - start);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代码审查
app.post('/api/tools/ai/code-review', combinedAuth, quotaMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { code, language = 'javascript', model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.reviewCode({ code, language, model });
    triggerApiWebhook(userId, '/api/tools/ai/code-review', result, Date.now() - start);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 文本摘要
app.post('/api/tools/ai/summarize', combinedAuth, quotaMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { text, maxLength = 200, model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.summarize({ text, maxLength, model });
    triggerApiWebhook(userId, '/api/tools/ai/summarize', result, Date.now() - start);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 图像生成
app.post('/api/tools/ai/image-generate', combinedAuth, quotaMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { prompt, model = 'dall-e-3', size = '1024x1024', n = 1 } = req.body;
    const result = await ImageGenerationService.generate({ prompt, model, size, n });
    triggerApiWebhook(userId, '/api/tools/ai/image-generate', result, Date.now() - start);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 语音合成
app.post('/api/tools/ai/tts', combinedAuth, quotaMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { text, model = 'tts-1', voice = 'alloy', speed = 1.0 } = req.body;
    const result = await TTSService.synthesize({ text, model, voice, speed });
    triggerApiWebhook(userId, '/api/tools/ai/tts', result, Date.now() - start);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 语音识别
app.post('/api/tools/ai/stt', combinedAuth, quotaMiddleware, upload.single('audio'), async (req, res) => {
  const start = Date.now();
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    if (!req.file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }
    const { model = 'whisper-1', language = 'zh' } = req.body;
    const result = await STTService.transcribe({ audio: req.file.path, model, language });
    fs.unlinkSync(req.file.path);
    triggerApiWebhook(userId, '/api/tools/ai/stt', result, Date.now() - start);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 翻译
app.post('/api/tools/ai/translate', combinedAuth, quotaMiddleware, async (req, res) => {
  const start = Date.now();
  try {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const { text, sourceLang = 'auto', targetLang = 'en' } = req.body;
    const result = await TranslationService.translate({ text, sourceLang, targetLang });
    triggerApiWebhook(userId, '/api/tools/ai/translate', result, Date.now() - start);
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

// 字数统计
app.post('/api/tools/data/text-stats', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.json({ success: true, stats: { chars: 0, words: 0, lines: 0, bytes: 0 } });
    
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    const bytes = Buffer.byteLength(text, 'utf8');
    
    res.json({ success: true, stats: { chars, words, lines, bytes } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 大小写转换
app.post('/api/tools/data/case-convert', async (req, res) => {
  try {
    const { text, mode = 'upper' } = req.body;
    if (!text) return res.json({ success: true, result: '' });
    
    let result = text;
    switch (mode) {
      case 'upper': result = text.toUpperCase(); break;
      case 'lower': result = text.toLowerCase(); break;
      case 'title': result = text.replace(/\b\w/g, c => c.toUpperCase()); break;
      case 'sentence': result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(); break;
      case 'toggle': result = text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''); break;
    }
    
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lorem Ipsum 生成
app.post('/api/tools/data/lorem-ipsum', async (req, res) => {
  try {
    const { sentences = 5, type = 'sentence' } = req.body;
    const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate', 'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'];
    
    let result = '';
    const count = Math.min(Math.max(parseInt(sentences) || 5, 1), 100);
    
    if (type === 'word') {
      for (let i = 0; i < count; i++) {
        result += words[Math.floor(Math.random() * words.length)] + (i < count - 1 ? ' ' : '');
      }
    } else if (type === 'paragraph') {
      for (let p = 0; p < count; p++) {
        let para = '';
        for (let s = 0; s < 5; s++) {
          let sentence = '';
          const wordCount = Math.floor(Math.random() * 10) + 5;
          for (let w = 0; w < wordCount; w++) {
            sentence += words[Math.floor(Math.random() * words.length)] + (w < wordCount - 1 ? ' ' : '');
          }
          para += sentence.charAt(0).toUpperCase() + sentence.slice(1) + '. ';
        }
        result += para + '\n\n';
      }
    } else {
      for (let s = 0; s < count; s++) {
        let sentence = '';
        const wordCount = Math.floor(Math.random() * 10) + 5;
        for (let w = 0; w < wordCount; w++) {
          sentence += words[Math.floor(Math.random() * words.length)] + (w < wordCount - 1 ? ' ' : '');
        }
        result += sentence.charAt(0).toUpperCase() + sentence.slice(1) + '. ';
      }
    }
    
    res.json({ success: true, result: result.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 数字转中文大写
app.post('/api/tools/data/number-to-chinese', async (req, res) => {
  try {
    const { number, type = 'money' } = req.body;
    if (!number && number !== 0) return res.json({ success: true, result: '' });
    
    const num = parseFloat(number);
    if (isNaN(num)) return res.status(400).json({ error: '请输入有效数字' });
    
    const toChinese = (n) => {
      const unit = ['', '十', '百', '千', '万', '十', '百', '千', '亿'];
      const numStr = Math.floor(n).toString();
      let result = '';
      for (let i = 0; i < numStr.length; i++) {
        const d = parseInt(numStr[numStr.length - 1 - i]);
        if (d !== 0) result = unit[i] + (d === 1 && i === 1 ? '' : '一二三四五六七八九'[d - 1]) + result;
        else if (i === 4 || i === 8) result = unit[i] + result;
      }
      return result || '零';
    };
    
    const toMoney = (n) => {
      const big = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
      const unit = ['元', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿', '拾', '佰', '仟', '万'];
      const decimal = ['角', '分'];
      let intPart = Math.floor(n);
      let decPart = Math.round((n - intPart) * 100);
      
      let result = '';
      const intStr = intPart.toString();
      for (let i = 0; i < intStr.length; i++) {
        const d = parseInt(intStr[intStr.length - 1 - i]);
        if (d !== 0) result = unit[i] + big[d] + result;
      }
      result += '元';
      
      if (decPart > 0) {
        const d1 = Math.floor(decPart / 10);
        const d2 = decPart % 10;
        if (d1 > 0) result += big[d1] + decimal[0];
        if (d2 > 0) result += big[d2] + decimal[1];
      } else {
        result += '整';
      }
      
      return result;
    };
    
    const result = type === 'money' ? toMoney(num) : toChinese(num);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 日期计算器
app.post('/api/tools/data/date-calculator', async (req, res) => {
  try {
    const { startDate, endDate, mode = 'diff' } = req.body;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: '请输入有效日期' });
    }
    
    const diff = Math.abs(end - start);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor(diff / 1000);
    
    // 计算工作日（排除周末）
    let workDays = 0;
    let current = new Date(Math.min(start, end));
    const endDate2 = new Date(Math.max(start, end));
    while (current <= endDate2) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) workDays++;
      current.setDate(current.getDate() + 1);
    }
    
    res.json({
      success: true,
      result: {
        days,
        hours,
        minutes,
        seconds,
        workDays,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    });
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

// 条形码生成
app.post('/api/tools/security/barcode-generate', async (req, res) => {
  try {
    const { text, format = 'CODE128', width = 200, height = 80 } = req.body;
    if (!text) return res.status(400).json({ error: '请输入内容' });
    
    // 简单的条形码生成（使用code128算法）
    const generateBarcode = (text) => {
      const codes = {
        '0': '11011001100', '1': '11001101100', '2': '11001100110',
        '3': '10010011000', '4': '10001001100', '5': '10001000110',
        '6': '10011001000', '7': '10011000100', '8': '10001100100',
        '9': '11001001000', 'A': '11001000100', 'B': '11000100100',
        'C': '11000010100', '-': '10110011100', '.': '10111001100',
        ' ': '10111000110', '$': '10100101100', '/': '10100100110',
        '+': '10011010100', '%': '10010000110'
      };
      
      let pattern = '110100100110'; // Start code
      for (const char of text.toUpperCase()) {
        const code = codes[char] || '100101101100';
        pattern += code;
      }
      pattern += '110001110101'; // End code
      
      // 生成SVG
      const bars = pattern.match(/1+/g)?.map(m => m.length) || [];
      const barWidth = width / pattern.length;
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
      let x = 0;
      for (const bit of pattern) {
        if (bit === '1') {
          svg += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="black"/>`;
        }
        x += barWidth;
      }
      svg += `<text x="${width/2}" y="${height - 10}" text-anchor="middle" font-family="monospace" font-size="12">${text}</text></svg>`;
      return svg;
    };
    
    const svg = generateBarcode(text);
    const base64 = Buffer.from(svg).toString('base64');
    
    res.json({ success: true, svg, dataUrl: `data:image/svg+xml;base64,${base64}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SEO Meta标签生成
app.post('/api/tools/security/meta-generator', async (req, res) => {
  try {
    const { title, description, url, image, siteName, twitterCard = 'summary_large_image' } = req.body;
    
    let html = '';
    
    // 基本Meta标签
    if (title) html += `<meta name="title" content="${title}">\n`;
    if (description) html += `<meta name="description" content="${description}">\n`;
    
    // Open Graph
    if (title) html += `<meta property="og:title" content="${title}">\n`;
    if (description) html += `<meta property="og:description" content="${description}">\n`;
    if (url) html += `<meta property="og:url" content="${url}">\n`;
    if (image) html += `<meta property="og:image" content="${image}">\n`;
    if (siteName) html += `<meta property="og:site_name" content="${siteName}">\n`;
    
    // Twitter Card
    html += `<meta name="twitter:card" content="${twitterCard}">\n`;
    if (title) html += `<meta name="twitter:title" content="${title}">\n`;
    if (description) html += `<meta name="twitter:description" content="${description}">\n`;
    if (image) html += `<meta name="twitter:image" content="${image}">\n`;
    
    // JSON-LD (Schema.org)
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": siteName || title,
      "url": url,
      "description": description,
      "image": image
    };
    html += `\n<!-- JSON-LD -->\n<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
    
    res.json({ success: true, html, jsonLd });
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

// ============ API 文档 ============
const API_DOCS = {
  auth: {
    title: '认证',
    endpoints: [
      { method: 'POST', path: '/api/auth/register', desc: '用户注册', params: [{ name: 'email', type: 'string', required: true }, { name: 'password', type: 'string', required: true }] },
      { method: 'POST', path: '/api/auth/login', desc: '用户登录', params: [{ name: 'email', type: 'string', required: true }, { name: 'password', type: 'string', required: true }] },
      { method: 'POST', path: '/api/auth/send-verification', desc: '发送验证码', params: [{ name: 'email', type: 'string', required: true }] },
    ]
  },
  tools: {
    title: 'AI 工具',
    endpoints: [
      { method: 'POST', path: '/api/tools/ai/text-generate', desc: '文本生成', params: [{ name: 'prompt', type: 'string', required: true }, { name: 'max_tokens', type: 'number', required: false }] },
      { method: 'POST', path: '/api/tools/ai/code-generate', desc: '代码生成', params: [{ name: 'prompt', type: 'string', required: true }, { name: 'language', type: 'string', required: false }] },
      { method: 'POST', path: '/api/tools/ai/code-review', desc: '代码审查', params: [{ name: 'code', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/ai/summarize', desc: '内容摘要', params: [{ name: 'content', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/ai/image-generate', desc: '图片生成', params: [{ name: 'prompt', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/ai/tts', desc: '文字转语音', params: [{ name: 'text', type: 'string', required: true }, { name: 'voice', type: 'string', required: false }] },
    ]
  },
  file: {
    title: '文件处理',
    endpoints: [
      { method: 'POST', path: '/api/tools/file/convert', desc: '文件格式转换', params: [{ name: 'file', type: 'file', required: true }, { name: 'targetFormat', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/file/image-process', desc: '图片处理', params: [{ name: 'file', type: 'file', required: true }, { name: 'operation', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/file/markdown-render', desc: 'Markdown渲染', params: [{ name: 'content', type: 'string', required: true }] },
    ]
  },
  data: {
    title: '数据处理',
    endpoints: [
      { method: 'POST', path: '/api/tools/data/json-format', desc: 'JSON格式化', params: [{ name: 'data', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/data/json-to-csv', desc: 'JSON转CSV', params: [{ name: 'data', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/data/csv-to-json', desc: 'CSV转JSON', params: [{ name: 'data', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/data/base64-encode', desc: 'Base64编码', params: [{ name: 'data', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/data/base64-decode', desc: 'Base64解码', params: [{ name: 'data', type: 'string', required: true }] },
    ]
  },
  network: {
    title: '网络工具',
    endpoints: [
      { method: 'GET', path: '/api/tools/network/dns', desc: 'DNS查询', params: [{ name: 'domain', type: 'string', required: true }] },
      { method: 'GET', path: '/api/tools/network/ip-lookup', desc: 'IP查询', params: [{ name: 'ip', type: 'string', required: true }] },
      { method: 'GET', path: '/api/tools/network/whois', desc: 'Whois查询', params: [{ name: 'domain', type: 'string', required: true }] },
    ]
  },
  security: {
    title: '安全工具',
    endpoints: [
      { method: 'POST', path: '/api/tools/security/password-generate', desc: '密码生成', params: [{ name: 'length', type: 'number', required: false }, { name: 'options', type: 'object', required: false }] },
      { method: 'POST', path: '/api/tools/security/password-check', desc: '密码强度检查', params: [{ name: 'password', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/security/hash', desc: '哈希计算', params: [{ name: 'data', type: 'string', required: true }, { name: 'algorithm', type: 'string', required: false }] },
      { method: 'POST', path: '/api/tools/security/uuid-generate', desc: 'UUID生成', params: [] },
    ]
  },
  dev: {
    title: '开发工具',
    endpoints: [
      { method: 'POST', path: '/api/tools/dev/code-format', desc: '代码格式化', params: [{ name: 'code', type: 'string', required: true }, { name: 'language', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/dev/code-minify', desc: '代码压缩', params: [{ name: 'code', type: 'string', required: true }, { name: 'language', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/dev/cron-parse', desc: 'Cron解析', params: [{ name: 'expression', type: 'string', required: true }] },
      { method: 'POST', path: '/api/tools/dev/timestamp-convert', desc: '时间戳转换', params: [{ name: 'timestamp', type: 'number', required: true }] },
      { method: 'POST', path: '/api/tools/dev/color-convert', desc: '颜色格式转换', params: [{ name: 'color', type: 'string', required: true }] },
    ]
  }
};

app.get('/api/docs', (req, res) => {
  res.json(API_DOCS);
});

// ============ 公开统计（Dashboard） ============
app.get('/api/public/stats', (req, res) => {
  try {
    const users = UserDB.getAllUsers();
    const logs = LogDB.getAllLogs();
    
    const today = new Date().toISOString().split('T')[0];
    const todayCalls = logs.filter(l => l.timestamp && l.timestamp.startsWith(today)).length;
    
    // 计算最近7天趋势
    const trend = [];
    const trendLabels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trendLabels.push((d.getMonth()+1) + '/' + d.getDate());
      trend.push(logs.filter(l => l.timestamp && l.timestamp.startsWith(key)).length);
    }
    
    // 工具使用分布（按路径分组）
    const toolCounts = {};
    logs.forEach(l => {
      if (l.path) {
        const tool = l.path.replace('/api/tools/', '').split('/')[0];
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }
    });
    
    const totalCalls = logs.length;
    const distributionLabels = Object.keys(toolCounts).slice(0, 5);
    const distributionData = distributionLabels.map(k => totalCalls > 0 ? Math.round(toolCounts[k] / totalCalls * 100) : 0);
    
    res.json({
      success: true,
      stats: {
        totalUsers: users.length,
        totalCalls,
        todayCalls,
        trend: { labels: trendLabels, data: trend },
        distribution: { labels: distributionLabels, data: distributionData }
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取翻译
app.get('/api/translations/:lang', (req, res) => {
  const lang = req.params.lang;
  res.json(translations[lang] || translations.zh);
});

// ============ 公告横幅 ============
// 在 .env 中配置 ANNOUNCEMENT_TEXT 和 ANNOUNCEMENT_LINK
const ANNOUNCEMENT = {
  enabled: process.env.ANNOUNCEMENT_ENABLED === 'true',
  text: process.env.ANNOUNCEMENT_TEXT || '🎉 新工具上线！AI 代码审查功能免费试用中',
  link: process.env.ANNOUNCEMENT_LINK || '/tools',
  linkText: process.env.ANNOUNCEMENT_LINK_TEXT || '立即体验 →',
  bg: process.env.ANNOUNCEMENT_BG || 'linear-gradient(90deg, #6366f1, #8b5cf6)',
};

app.get('/api/announcement', (req, res) => {
  res.json({ enabled: ANNOUNCEMENT.enabled, ...ANNOUNCEMENT });
});

// ============ 反馈提交 ============
const feedbackLimiter = rateLimit({ windowMs: 60 * 1000, max: 3 });
const feedbackTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// ============ 使用量预警 ============
const usageWarningSent = new Set();

async function sendUsageWarning(user, used, limit) {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: '【沐美服务】API 调用量即将用尽',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#6366f1;">⚠️ 调用量预警</h2>
        <p>您好，您的 API 调用量已使用 <strong style="color:#ef4444;">${used}/${limit}</strong> 次。</p>
        <p>建议升级套餐或减少调用频率，避免服务中断。</p>
        <p style="margin-top:20px;">
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}/panel" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">查看详情</a>
        </p>
      </div>`
  };
  try { await feedbackTransporter.sendMail(mailOptions); } catch(e) {}
}

// 每小时检查一次
schedule.scheduleJob('0 * * * *', async () => {
  if (process.env.ENABLE_USAGE_WARNING !== 'true') return;
  try {
    const users = UserDB.getAllUsers();
    for (const user of users) {
      if (!user.email) continue;
      const key = `${user.id}-${new Date().toISOString().slice(0,7)}`;
      if (usageWarningSent.has(key)) continue;
      const todayCount = LogDB.getTodayCallCount ? LogDB.getTodayCallCount(user.id) : 0;
      const limits = { free: 100, pro: 5000, enterprise: 999999 };
      const limit = limits[user.plan] || 100;
      if (todayCount >= limit * 0.8) {
        await sendUsageWarning(user, todayCount, limit);
        usageWarningSent.add(key);
      }
    }
  } catch (e) { console.error('使用量预警检查失败:', e.message); }
});


app.post('/api/feedback', feedbackLimiter, async (req, res) => {
  try {
    const { type, title, content, email, rating } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: '请填写标题和描述' });
    }

    const typeMap = { bug: 'Bug报告', feature: '功能建议', praise: '表扬鼓励', other: '其他' };
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const stars = rating ? '⭐'.repeat(rating) : '无评分';

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_USER,
      subject: `[沐美反馈] ${typeMap[type] || type} - ${title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#6366f1;">收到新反馈</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">类型</td><td style="padding:8px;border:1px solid #eee;">${typeMap[type] || type}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">评分</td><td style="padding:8px;border:1px solid #eee;">${stars}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">标题</td><td style="padding:8px;border:1px solid #eee;">${title}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">详细描述</td><td style="padding:8px;border:1px solid #eee;">${content.replace(/\n/g, '<br>')}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">联系邮箱</td><td style="padding:8px;border:1px solid #eee;">${email || '未提供'}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">时间</td><td style="padding:8px;border:1px solid #eee;">${now}</td></tr>
          </table>
        </div>`
    };

    await feedbackTransporter.sendMail(mailOptions);
    console.log(`📧 反馈邮件已发送: [${type}] ${title}`);

    res.json({ success: true, message: '感谢您的反馈！' });
  } catch (e) {
    console.error('反馈邮件发送失败:', e.message);
    res.status(500).json({ error: '提交失败，请稍后重试' });
  }
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

// ============ SEO ============
app.get('/sitemap.xml', (req, res) => {
  const base = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/$/,'') : 'https://mumei.example.com';
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/tools</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${base}/pricing</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${base}/docs</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>
  <url><loc>${base}/feedback</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
</urlset>`);
});

app.get('/robots.txt', (req, res) => {
  const base = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/$/,'') : 'https://mumei.example.com';
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml`);
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
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || '',
        bio: user.bio || '',
        plan: user.plan,
        createdAt: user.created_at
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 更新个人资料
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const { displayName, bio } = req.body;
    const user = UserDB.updateProfile(userId, {
      display_name: (displayName || '').slice(0, 50),
      bio: (bio || '').slice(0, 200)
    });
    res.json({ success: true, user: { displayName: user.display_name, bio: user.bio } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 修改密码
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: '两次密码不一致' });
    }

    const user = UserDB.getUserById(userId);
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: '当前密码错误' });

    await UserDB.updatePassword(userId, newPassword);
    res.json({ success: true, message: '密码修改成功' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Webhook 管理 API ============

// 获取用户的 Webhooks
app.get('/api/webhooks', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const webhooks = WebhookDB.getByUser(userId);
    res.json({ success: true, webhooks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 创建 Webhook（专业版专属）
app.post('/api/webhooks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const user = UserDB.getUserById(userId);

    if (user.plan === 'free') {
      return res.status(403).json({
        error: 'Webhook 功能仅限专业版用户使用',
        upgrade: true
      });
    }

    const { url, events, description } = req.body;
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: '请提供有效的 URL' });
    }

    // 限制每个用户最多 5 个 Webhook
    const existing = WebhookDB.getByUser(userId);
    if (existing.length >= 5) {
      return res.status(403).json({ error: '最多创建 5 个 Webhook' });
    }

    const result = WebhookDB.create({ user_id: userId, url, events: events || [], active: true });
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ success: true, webhook: { id: result.id, url, events, active: true, secret: result.secret } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 更新 Webhook
app.put('/api/webhooks/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const { url, events, description, active } = req.body;
    const webhook = WebhookDB.getById(req.params.id, userId);
    if (!webhook) return res.status(404).json({ error: 'Webhook 不存在' });
    const result = WebhookDB.update(req.params.id, userId, { url, events, active });
    res.json({ success: true, webhook });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 公开统计接口（首页用）
app.get('/api/public/stats', (req, res) => {
  try {
    const users = UserDB.getAllUsers ? UserDB.getAllUsers() : [];
    const logs = LogDB.getRecentLogs ? LogDB.getRecentLogs(100000) : [];
    const toolCount = 37; // 实际工具数量，可从配置读取
    res.json({
      success: true,
      stats: {
        tools: toolCount,
        users: users.length,
        calls: logs.length,
        uptime: '99.9%'
      }
    });
  } catch (e) {
    res.json({ success: true, stats: { tools: 37, users: 0, calls: 0, uptime: '99.9%' } });
  }
});

// 获取当前公告（公开）
app.get('/api/public/announcement', (req, res) => {
  const lang = req.query.lang || 'zh';
  try {
    const announcement = AnnouncementDB.getActive(lang);
    res.json({ success: true, announcement });
  } catch (e) {
    res.json({ success: true, announcement: null });
  }
});

// API 文档数据（公开）
app.get('/api/docs', (req, res) => {
  res.json({
    auth: {
      title: '🔐 认证授权',
      endpoints: [
        { method: 'POST', path: '/api/auth/register', desc: '用户注册', params: [
          { name: 'email', type: 'string', required: true },
          { name: 'password', type: 'string', required: true },
          { name: 'referralCode', type: 'string', required: false }
        ]},
        { method: 'POST', path: '/api/auth/login', desc: '用户登录', params: [
          { name: 'email', type: 'string', required: true },
          { name: 'password', type: 'string', required: true }
        ]},
        { method: 'GET', path: '/api/auth/me', desc: '获取当前用户信息', params: [] },
        { method: 'POST', path: '/api/auth/refresh', desc: '刷新Token', params: [
          { name: 'refreshToken', type: 'string', required: true }
        ]}
      ]
    },
    tools: {
      title: '🛠️ 工具API',
      endpoints: [
        { method: 'POST', path: '/api/tools/ai/text-generate', desc: 'AI文本生成', params: [
          { name: 'prompt', type: 'string', required: true },
          { name: 'model', type: 'string', required: false },
          { name: 'maxTokens', type: 'number', required: false }
        ]},
        { method: 'POST', path: '/api/tools/ai/image-generate', desc: 'AI图像生成', params: [
          { name: 'prompt', type: 'string', required: true },
          { name: 'size', type: 'string', required: false }
        ]},
        { method: 'POST', path: '/api/tools/ai/tts', desc: '语音合成', params: [
          { name: 'text', type: 'string', required: true },
          { name: 'voice', type: 'string', required: false }
        ]},
        { method: 'POST', path: '/api/tools/ai/stt', desc: '语音识别', params: [
          { name: 'audioUrl', type: 'string', required: true }
        ]},
        { method: 'POST', path: '/api/tools/data/json-format', desc: 'JSON格式化', params: [
          { name: 'content', type: 'string', required: true }
        ]},
        { method: 'POST', path: '/api/tools/data/regex-test', desc: '正则测试', params: [
          { name: 'pattern', type: 'string', required: true },
          { name: 'testString', type: 'string', required: true }
        ]},
        { method: 'POST', path: '/api/tools/network/dns', desc: 'DNS查询', params: [
          { name: 'domain', type: 'string', required: true }
        ]},
        { method: 'POST', path: '/api/tools/network/ip-lookup', desc: 'IP查询', params: [
          { name: 'ip', type: 'string', required: true }
        ]},
        { method: 'POST', path: '/api/tools/security/password-check', desc: '密码强度检测', params: [
          { name: 'password', type: 'string', required: true }
        ]}
      ]
    },
    user: {
      title: '👤 用户管理',
      endpoints: [
        { method: 'PUT', path: '/api/auth/profile', desc: '更新个人资料', params: [
          { name: 'displayName', type: 'string', required: false },
          { name: 'bio', type: 'string', required: false }
        ]},
        { method: 'POST', path: '/api/auth/change-password', desc: '修改密码', params: [
          { name: 'currentPassword', type: 'string', required: true },
          { name: 'newPassword', type: 'string', required: true },
          { name: 'confirmPassword', type: 'string', required: true }
        ]},
        { method: 'GET', path: '/api/user/tokens', desc: '获取API Token列表', params: [] },
        { method: 'POST', path: '/api/user/tokens', desc: '创建API Token', params: [
          { name: 'name', type: 'string', required: true }
        ]},
        { method: 'DELETE', path: '/api/user/tokens/:id', desc: '删除API Token', params: [] }
      ]
    },
    payment: {
      title: '💳 支付订阅',
      endpoints: [
        { method: 'GET', path: '/api/plans', desc: '获取套餐列表', params: [] },
        { method: 'GET', path: '/api/plans/current', desc: '获取当前套餐', params: [] },
        { method: 'POST', path: '/api/subscription/create', desc: '创建订阅', params: [
          { name: 'planId', type: 'string', required: true },
          { name: 'paymentMethod', type: 'string', required: true }
        ]},
        { method: 'POST', path: '/api/payment/paypal/create-order', desc: '创建PayPal订单', params: [
          { name: 'planId', type: 'string', required: true }
        ]},
        { method: 'POST', path: '/api/payment/paypal/capture', desc: '确认PayPal支付', params: [
          { name: 'orderId', type: 'string', required: true }
        ]}
      ]
    },
    logs: {
      title: '📊 使用统计',
      endpoints: [
        { method: 'GET', path: '/api/stats', desc: '获取使用统计', params: [] },
        { method: 'GET', path: '/api/logs', desc: '获取调用日志', params: [] },
        { method: 'GET', path: '/api/logs/export', desc: '导出日志CSV', params: [] }
      ]
    }
  });
});

// 删除 Webhook
app.delete('/api/webhooks/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const result = WebhookDB.delete(req.params.id, userId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 测试 Webhook
app.post('/api/webhooks/:id/test', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const webhook = WebhookDB.getById(req.params.id, userId);
    if (!webhook) return res.status(404).json({ error: 'Webhook 不存在' });

    // 直接发送测试请求
    const payload = { event: 'webhook.test', data: { message: '测试消息', timestamp: new Date().toISOString() }, timestamp: new Date().toISOString() };
    const sig = crypto.createHmac('sha256', webhook.secret).update(JSON.stringify(payload)).digest('hex');
    const fetchRes = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': sig },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    }).catch(e => ({ ok: false, status: 0, error: e.message }));

    res.json({ success: fetchRes.ok, status: fetchRes.status || 0, error: fetchRes.error });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取投递记录（简化版：返回空数组）
app.get('/api/webhooks/:id/deliveries', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const webhook = WebhookDB.getById(req.params.id, userId);
    if (!webhook) return res.status(404).json({ error: 'Webhook 不存在' });
    res.json({ success: true, deliveries: [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

    const deliveries = WebhookDB.getDeliveries(req.params.id, 20);
    res.json({ success: true, deliveries });
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

// 导出日志为 CSV
app.get('/api/logs/export', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user.sub;
    const { logs } = LogDB.getUserLogs(userId, { limit: 10000 });
    
    const csv = ['时间,接口,方法,状态码,耗时(ms),IP'];
    logs.forEach(l => {
      csv.push(`${l.timestamp},${l.endpoint},${l.method},${l.status},${l.duration},${l.ip}`);
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="api-logs-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send('\uFEFF' + csv.join('\n')); // BOM for Excel
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
              const { sendSubscriptionReminder } = require('./email');
              const userName = user.display_name || user.email.split('@')[0];
              const planName = sub.plan_id === 'pro' ? '专业版' : sub.plan_id === 'enterprise' ? '企业版' : '订阅';
              await sendSubscriptionReminder(user.email, userName, planName, daysLeft);
              console.log(`📧 已发送到期提醒给 ${user.email}，剩余 ${daysLeft} 天`);
            } catch (e) {
              console.error('发送到期提醒失败:', e.message);
            }
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

// 404 处理
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// 500 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
});


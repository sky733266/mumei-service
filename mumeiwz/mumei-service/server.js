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

const { UserDB, TokenDB, VerificationDB, LogDB, PlanDB, SubscriptionDB, initDatabase } = require('./db-sqljs');
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
    title: '沐美服务',
    subtitle: '一人公司API服务平台',
    tools: '工具箱',
    aiTools: 'AI工具',
    fileTools: '文件工具',
    dataTools: '数据工具',
    networkTools: '网络工具',
    securityTools: '安全工具',
    devTools: '开发工具'
  },
  en: {
    title: 'Mumei Service',
    subtitle: 'One-Person Company API Platform',
    tools: 'Toolbox',
    aiTools: 'AI Tools',
    fileTools: 'File Tools',
    dataTools: 'Data Tools',
    networkTools: 'Network Tools',
    securityTools: 'Security Tools',
    devTools: 'Dev Tools'
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
app.post('/api/tools/ai/text-generate', combinedAuth, async (req, res) => {
  try {
    const { prompt, model = 'gpt-3.5-turbo', maxTokens = 1000, temperature = 0.7, systemPrompt = '' } = req.body;
    const result = await TextGenerationService.generate({ prompt, model, maxTokens, temperature, systemPrompt });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代码生成
app.post('/api/tools/ai/code-generate', combinedAuth, async (req, res) => {
  try {
    const { prompt, language = 'javascript', model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.generateCode({ prompt, language, model });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 代码审查
app.post('/api/tools/ai/code-review', combinedAuth, async (req, res) => {
  try {
    const { code, language = 'javascript', model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.reviewCode({ code, language, model });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 文本摘要
app.post('/api/tools/ai/summarize', combinedAuth, async (req, res) => {
  try {
    const { text, maxLength = 200, model = 'gpt-3.5-turbo' } = req.body;
    const result = await TextGenerationService.summarize({ text, maxLength, model });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 图像生成
app.post('/api/tools/ai/image-generate', combinedAuth, async (req, res) => {
  try {
    const { prompt, model = 'dall-e-3', size = '1024x1024', n = 1 } = req.body;
    const result = await ImageGenerationService.generate({ prompt, model, size, n });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 语音合成
app.post('/api/tools/ai/tts', combinedAuth, async (req, res) => {
  try {
    const { text, model = 'tts-1', voice = 'alloy', speed = 1.0 } = req.body;
    const result = await TTSService.synthesize({ text, model, voice, speed });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 语音识别
app.post('/api/tools/ai/stt', combinedAuth, upload.single('audio'), async (req, res) => {
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
app.post('/api/tools/ai/translate', combinedAuth, async (req, res) => {
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
app.post('/api/tools/file/convert', combinedAuth, upload.single('file'), async (req, res) => {
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
app.post('/api/tools/file/image-process', combinedAuth, upload.single('image'), async (req, res) => {
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
app.post('/api/tools/file/markdown-render', combinedAuth, async (req, res) => {
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
        welcomeBonus
      }
    });
  } catch (error) {
    console.error('Quick register error:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
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
const { OrderDB } = require('./db-sqljs');

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
    
    // 创建支付
    const result = await paymentModule.createPayment(method, plan.price, plan, req.user);
    
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

// 易支付回调
app.post('/api/payments/epay/notify', async (req, res) => {
  try {
    const params = req.query;
    
    if (paymentModule.verifyEpaySign(params)) {
      // 支付成功
      const { out_trade_no, trade_status, money } = params;
      
      if (trade_status === 'TRADE_SUCCESS') {
        // 根据订单号查找订单
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

// Stripe Webhook
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const result = await paymentModule.handleStripeWebhook(
    req.body,
    req.headers['stripe-signature']
  );
  
  if (result.success && result.event === 'payment_success') {
    // 支付成功，更新用户套餐
    const order = await OrderDB.getOrderByPaymentId(result.data.paymentId);
    if (order) {
      await OrderDB.completeOrder(order.id, result.data.paymentId);
      console.log('✅ Stripe 支付成功:', result.data);
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
        console.log('✅ PayPal 订单完成:', result);
      }
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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

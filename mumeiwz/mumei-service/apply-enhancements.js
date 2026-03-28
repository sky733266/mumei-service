/**
 * 应用增强补丁到 server.js
 * 用法: node apply-enhancements.js
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. 在文件开头引入增强模块
const enhanceImport = `// === 安全和功能增强 ===
const enhancements = require('./enhancements');
const { corsOptions, securityHeaders, authLimiterConfig, verifyLimiterConfig, 
        safeFileFilter, generateSafeFilename, translations, 
        handleSendVerification, handleRegister, handleLogin } = enhancements;

`;

if (!content.includes('require(\'./enhancements\')')) {
  content = enhanceImport + content;
}

// 2. 替换 CORS 配置
content = content.replace(
  /app\.use\(cors\(\)\);/,
  `app.use(cors(corsOptions));`
);

// 3. 在静态文件服务后添加安全头
content = content.replace(
  /app\.use\(express\.static\('public'\)\);/,
  `app.use(express.static('public'));\napp.use(securityHeaders);`
);

// 4. 替换 authLimiter 定义
content = content.replace(
  /const authLimiter = rateLimit\(\{[^}]+\}\);/s,
  `const authLimiter = rateLimit(authLimiterConfig);\nconst verifyLimiter = rateLimit(verifyLimiterConfig);`
);

// 5. 替换文件上传配置
content = content.replace(
  /const upload = multer\(\{[\s\S]*?fileFilter: \(req, file, cb\) => \{[\s\S]*?cb\(null, true\);[\s\S]*?\}\s*\}\);/,
  `const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = './uploads';
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => cb(null, generateSafeFilename(file.originalname))
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: safeFileFilter
});`
);

// 6. 替换多语言配置
const translationsStart = content.indexOf('// 多语言配置');
const translationsEnd = content.indexOf('};', content.indexOf('devTools: \'Dev Tools\'')) + 2;
if (translationsStart > 0 && translationsEnd > translationsStart) {
  const oldTranslations = content.substring(translationsStart, translationsEnd);
  const newTranslations = `// 多语言配置（来自 enhancements.js）
const translations = enhancements.translations;`;
  content = content.replace(oldTranslations, newTranslations);
}

// 7. 在 listen 之前添加缺失的路由
const routesToAdd = `

// ==================== 补充路由 ====================

// 发送验证码（兼容两种路径）
app.post('/api/auth/send-verification', verifyLimiter, handleSendVerification);
app.post('/api/auth/send-code', verifyLimiter, handleSendVerification);

// 注册
app.post('/api/auth/register', authLimiter, handleRegister);

// 登录
app.post('/api/auth/login', authLimiter, handleLogin);

// Token管理
app.get('/api/tokens', authMiddleware, (req, res) => {
  const tokens = TokenDB.getUserTokens(req.user.userId);
  res.json({ success: true, tokens });
});

app.post('/api/tokens', authMiddleware, (req, res) => {
  const { name } = req.body;
  const token = TokenDB.createToken(req.user.userId, name);
  res.json({ success: true, token: { id: token.id, name: token.name, token: token.token } });
});

app.delete('/api/tokens/:tokenId', authMiddleware, (req, res) => {
  TokenDB.deleteToken(req.params.tokenId, req.user.userId);
  res.json({ success: true });
});

// 用户统计
app.get('/api/user/stats', authMiddleware, (req, res) => {
  const stats = LogDB.getUserStats(req.user.userId);
  res.json({ success: true, stats });
});

// 日志查询
app.get('/api/user/logs', authMiddleware, (req, res) => {
  const logs = LogDB.getUserLogs(req.user.userId, { page: 1, limit: 50 });
  res.json({ success: true, ...logs });
});

// 套餐列表
app.get('/api/plans', (req, res) => {
  const plans = PlanDB.getAllPlans();
  res.json({ success: true, plans });
});

`;

// 在 app.listen 之前插入
if (!content.includes('/api/tokens')) {
  content = content.replace(
    /\/\/ 启动服务器/,
    routesToAdd + '\n// 启动服务器'
  );
}

// 8. 改进 listen 错误处理
content = content.replace(
  /app\.listen\(PORT, \(\) => \{[\s\S]*?\}\);/,
  `const server = app.listen(PORT, () => {
  console.log(\`沐美服务运行在 http://localhost:\${PORT}\`);
  console.log(\`用户面板: http://localhost:\${PORT}/panel\`);
  console.log(\`工具箱: http://localhost:\${PORT}/tools\`);
  console.log(\`运行环境: \${process.env.NODE_ENV || 'development'}\`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(\`端口 \${PORT} 已被占用\`);
  } else {
    console.error('服务器启动失败:', error.message);
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('正在关闭服务器...');
  server.close(() => process.exit(0));
});`
);

// 写回文件
fs.writeFileSync(serverPath, content, 'utf8');
console.log('✅ 增强补丁已应用到 server.js');
console.log('   - CORS 安全配置');
console.log('   - 安全响应头');
console.log('   - 增强限流');
console.log('   - 文件上传安全');
console.log('   - 完整多语言');
console.log('   - Token管理API');
console.log('   - 用户统计API');

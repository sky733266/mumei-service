// 简化的服务器 - 支持用户注册登录
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'mumei-service-secret-key-2026';

// 数据文件路径
const DATA_DIR = './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
function initDataFile(filePath, defaultData = {}) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

initDataFile(USERS_FILE, { users: [] });
initDataFile(CODES_FILE, { codes: [] });

// 读取数据
function readData(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { users: [], codes: [] };
  }
}

// 写入数据
function writeData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 验证码存储（内存 + 文件）
const verificationCodes = new Map();

// ==================== 认证路由 ====================

// 发送验证码
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { email, lang = 'zh' } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: '请提供有效的邮箱地址' });
    }

    // 生成6位验证码
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // 存储验证码
    verificationCodes.set(email, {
      code,
      timestamp: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000 // 30分钟过期
    });

    // 同时存储到文件
    const data = readData(CODES_FILE);
    data.codes = data.codes.filter(c => c.email !== email);
    data.codes.push({
      email,
      code,
      timestamp: new Date().toISOString()
    });
    writeData(CODES_FILE, data);

    // 开发环境：直接返回验证码
    console.log(`\n========== 验证码 ==========`);
    console.log(`邮箱: ${email}`);
    console.log(`验证码: ${code}`);
    console.log(`===========================\n`);

    res.json({
      success: true,
      message: '验证码已发送（请查看控制台）',
      mock: true,
      code: code // 开发环境直接返回
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, confirmPassword, code, lang = 'zh' } = req.body;

    // 验证输入
    if (!email || !password || !code) {
      return res.status(400).json({ error: '请填写所有必填项' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: '两次输入的密码不一致' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少为6位' });
    }

    // 验证验证码
    const storedCode = verificationCodes.get(email);
    if (!storedCode || storedCode.code !== code.toUpperCase()) {
      // 也检查文件存储
      const data = readData(CODES_FILE);
      const fileCode = data.codes.find(c => c.email === email);
      if (!fileCode || fileCode.code !== code.toUpperCase()) {
        return res.status(400).json({ error: '验证码无效或已过期' });
      }
    }

    // 检查邮箱是否已存在
    const userData = readData(USERS_FILE);
    if (userData.users.find(u => u.email === email)) {
      return res.status(400).json({ error: '邮箱已被注册' });
    }

    // 创建用户
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      verified: true,
      plan: 'free',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    userData.users.push(user);
    writeData(USERS_FILE, userData);

    // 清除验证码
    verificationCodes.delete(email);

    // 生成JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, verified: user.verified },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        verified: user.verified,
        plan: user.plan
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请提供邮箱和密码' });
    }

    // 查找用户
    const userData = readData(USERS_FILE);
    const user = userData.users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 更新最后登录时间
    user.lastLogin = new Date().toISOString();
    writeData(USERS_FILE, userData);

    // 生成JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, verified: user.verified },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        verified: user.verified,
        plan: user.plan
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证Token' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userData = readData(USERS_FILE);
    const user = userData.users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        verified: user.verified,
        plan: user.plan
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Token无效或已过期' });
  }
});

// ==================== 翻译路由 ====================

const translations = {
  zh: {
    title: '沐美服务',
    subtitle: '一人公司API服务平台',
    login: '登录',
    register: '注册',
    logout: '退出',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    verifyCode: '验证码',
    sendCode: '发送验证码',
    userPanel: '用户面板',
    pdfConverter: 'PDF转文字',
    uploadPDF: '上传PDF文件',
    convert: '转换',
    result: '转换结果',
    apiDocs: 'API文档',
    contact: '联系我们',
    language: '语言'
  },
  en: {
    title: 'Mumei Service',
    subtitle: 'One-Person Company API Platform',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    verifyCode: 'Verification Code',
    sendCode: 'Send Code',
    userPanel: 'User Panel',
    pdfConverter: 'PDF to Text',
    uploadPDF: 'Upload PDF File',
    convert: 'Convert',
    result: 'Result',
    apiDocs: 'API Documentation',
    contact: 'Contact Us',
    language: 'Language'
  },
  ko: {
    title: '무메이 서비스',
    subtitle: '1인 기업 API 플랫폼',
    login: '로그인',
    register: '회원가입',
    logout: '로그아웃',
    email: '이메일',
    password: '비밀번호',
    confirmPassword: '비밀번호 확인',
    verifyCode: '인증 코드',
    sendCode: '코드 전송',
    userPanel: '사용자 패널',
    pdfConverter: 'PDF를 텍스트로',
    uploadPDF: 'PDF 파일 업로드',
    convert: '변환',
    result: '결과',
    apiDocs: 'API 문서',
    contact: '문의하기',
    language: '언어'
  },
  fr: {
    title: 'Service Mumei',
    subtitle: 'Plateforme API pour Entreprise Individuelle',
    login: 'Connexion',
    register: 'Inscription',
    logout: 'Déconnexion',
    email: 'Email',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    verifyCode: 'Code de vérification',
    sendCode: 'Envoyer le code',
    userPanel: 'Panneau Utilisateur',
    pdfConverter: 'PDF vers Texte',
    uploadPDF: 'Télécharger PDF',
    convert: 'Convertir',
    result: 'Résultat',
    apiDocs: 'Documentation API',
    contact: 'Contactez-nous',
    language: 'Langue'
  },
  es: {
    title: 'Servicio Mumei',
    subtitle: 'Plataforma API para Empresa Unipersonal',
    login: 'Iniciar sesión',
    register: 'Registrarse',
    logout: 'Cerrar sesión',
    email: 'Email',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    verifyCode: 'Código de verificación',
    sendCode: 'Enviar código',
    userPanel: 'Panel de Usuario',
    pdfConverter: 'PDF a Texto',
    uploadPDF: 'Subir PDF',
    convert: 'Convertir',
    result: 'Resultado',
    apiDocs: 'Documentación API',
    contact: 'Contáctenos',
    language: 'Idioma'
  },
  ja: {
    title: 'ムメイサービス',
    subtitle: '一人会社APIプラットフォーム',
    login: 'ログイン',
    register: '登録',
    logout: 'ログアウト',
    email: 'メール',
    password: 'パスワード',
    confirmPassword: 'パスワード確認',
    verifyCode: '認証コード',
    sendCode: 'コード送信',
    userPanel: 'ユーザーパネル',
    pdfConverter: 'PDFをテキストに',
    uploadPDF: 'PDFファイルをアップロード',
    convert: '変換',
    result: '結果',
    apiDocs: 'APIドキュメント',
    contact: 'お問い合わせ',
    language: '言語'
  }
};

app.get('/api/translations/:lang', (req, res) => {
  const lang = req.params.lang;
  const translation = translations[lang] || translations.zh;
  res.json(translation);
});

// ==================== 页面路由 ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

app.get('/tools', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tools.html'));
});

app.get('/qrcode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qrcode.html'));
});

app.get('/compress', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'compress.html'));
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/feedback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'feedback.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// 沙盒测试API
app.post('/api/sandbox/pdf-to-text', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传PDF文件' });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(dataBuffer);
    
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      text: data.text.substring(0, 1000) + (data.text.length > 1000 ? '...' : ''),
      pages: data.numpages,
      info: data.info,
      note: '沙盒模式：内容已截断，完整功能请使用API Token'
    });
  } catch (error) {
    res.status(500).json({ error: 'PDF转换失败: ' + error.message });
  }
});

app.post('/api/sandbox/json-format', (req, res) => {
  try {
    const { json } = req.body;
    if (!json) {
      return res.status(400).json({ error: '请提供JSON内容' });
    }
    
    const parsed = JSON.parse(json);
    res.json({
      success: true,
      formatted: JSON.stringify(parsed, null, 2),
      compact: JSON.stringify(parsed),
      valid: true
    });
  } catch (error) {
    res.json({
      success: false,
      valid: false,
      error: error.message
    });
  }
});

app.post('/api/sandbox/base64', (req, res) => {
  try {
    const { text, action = 'encode' } = req.body;
    if (!text) {
      return res.status(400).json({ error: '请提供内容' });
    }
    
    let result;
    if (action === 'encode') {
      result = Buffer.from(text).toString('base64');
    } else {
      result = Buffer.from(text, 'base64').toString('utf8');
    }
    
    res.json({
      success: true,
      action,
      result,
      originalLength: text.length,
      resultLength: result.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 沐美服务已启动`);
  console.log(`📍 首页: http://localhost:${PORT}/`);
  console.log(`👤 用户面板: http://localhost:${PORT}/panel`);
  console.log(`🛠️ 工具箱: http://localhost:${PORT}/tools`);
  console.log(`\n💡 注册流程：输入邮箱 -> 点击"发送验证码" -> 查看控制台验证码 -> 填写注册信息\n`);
});

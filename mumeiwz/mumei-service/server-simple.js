const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只接受PDF文件'));
    }
  }
});

// 多语言配置
const translations = {
  zh: {
    title: '沐美服务',
    subtitle: '一人公司API服务平台',
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
    pdfConverter: 'PDFをテキストに',
    uploadPDF: 'PDFファイルをアップロード',
    convert: '変換',
    result: '結果',
    apiDocs: 'APIドキュメント',
    contact: 'お問い合わせ',
    language: '言語'
  }
};

// API路由

// 获取翻译
app.get('/api/translations/:lang', (req, res) => {
  const lang = req.params.lang;
  res.json(translations[lang] || translations.zh);
});

// PDF转文字API
app.post('/api/pdf-to-text', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传PDF文件' });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(dataBuffer);
    
    // 删除临时文件
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info
    });
  } catch (error) {
    console.error('PDF转换错误:', error);
    res.status(500).json({ error: 'PDF转换失败' });
  }
});

// 工具列表
app.get('/api/tools', (req, res) => {
  res.json({
    success: true,
    tools: {
      'data/json-format': { name: 'JSON格式化', category: 'data', free: true },
      'data/csv-convert': { name: 'CSV转换', category: 'data', free: true },
      'network/dns': { name: 'DNS查询', category: 'network', free: true },
      'security/password': { name: '密码生成', category: 'security', free: true },
      'dev/code-format': { name: '代码格式化', category: 'dev', free: true }
    }
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/tools', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tools.html'));
});

app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`沐美服务运行在 http://localhost:${PORT}`);
  console.log(`首页: http://localhost:${PORT}/`);
  console.log(`工具箱: http://localhost:${PORT}/tools`);
  console.log(`用户面板: http://localhost:${PORT}/panel`);
});

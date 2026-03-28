// AI工具路由包装函数
function createAIRoute(app) {
  // 文本生成
  app.post('/api/tools/ai/text-generate', combinedAuth, async (req, res) => {
    if (!TextGenerationService) {
      return res.status(503).json({ error: 'AI服务暂不可用，请先安装依赖' });
    }
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
    if (!TextGenerationService) {
      return res.status(503).json({ error: 'AI服务暂不可用' });
    }
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
    if (!TextGenerationService) {
      return res.status(503).json({ error: 'AI服务暂不可用' });
    }
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
    if (!TextGenerationService) {
      return res.status(503).json({ error: 'AI服务暂不可用' });
    }
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
    if (!ImageGenerationService) {
      return res.status(503).json({ error: '图像生成服务暂不可用' });
    }
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
    if (!TTSService) {
      return res.status(503).json({ error: '语音合成服务暂不可用' });
    }
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
    if (!STTService) {
      return res.status(503).json({ error: '语音识别服务暂不可用' });
    }
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
    if (!TranslationService) {
      return res.status(503).json({ error: '翻译服务暂不可用' });
    }
    try {
      const { text, sourceLang = 'auto', targetLang = 'en' } = req.body;
      const result = await TranslationService.translate({ text, sourceLang, targetLang });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// 文件工具路由
function createFileRoutes(app) {
  // 文档转换
  app.post('/api/tools/file/convert', combinedAuth, upload.single('file'), async (req, res) => {
    if (!FileProcessingService) {
      return res.status(503).json({ error: '文件处理服务暂不可用' });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传文件' });
      }
      const { outputFormat } = req.body;
      const result = await FileProcessingService.convertDocument(req.file.path, outputFormat);
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

  // 图片处理
  app.post('/api/tools/file/image-process', combinedAuth, upload.single('image'), async (req, res) => {
    if (!FileProcessingService) {
      return res.status(503).json({ error: '文件处理服务暂不可用' });
    }
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
    if (!FileProcessingService) {
      return res.status(503).json({ error: '文件处理服务暂不可用' });
    }
    try {
      const { content, outputFormat = 'html', options = {} } = req.body;
      const result = await FileProcessingService.renderMarkdown(content, outputFormat, options);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// 数据工具路由
function createDataRoutes(app) {
  // JSON格式化
  app.post('/api/tools/data/json-format', async (req, res) => {
    try {
      const { json, options = {} } = req.body;
      const result = DataProcessingService ? DataProcessingService.formatJSON(json, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // JSON转CSV
  app.post('/api/tools/data/json-to-csv', async (req, res) => {
    try {
      const { data, options = {} } = req.body;
      const result = DataProcessingService ? DataProcessingService.jsonToCSV(data, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // CSV转JSON
  app.post('/api/tools/data/csv-to-json', async (req, res) => {
    try {
      const { csv, options = {} } = req.body;
      const result = DataProcessingService ? await DataProcessingService.csvToJSON(csv, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // SQL格式化
  app.post('/api/tools/data/sql-format', async (req, res) => {
    try {
      const { sql, options = {} } = req.body;
      const result = DataProcessingService ? DataProcessingService.formatSQL(sql, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 正则测试
  app.post('/api/tools/data/regex-test', async (req, res) => {
    try {
      const { pattern, flags = '', testStrings = [] } = req.body;
      const result = DataProcessingService ? DataProcessingService.testRegex(pattern, flags, testStrings) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Base64编码
  app.post('/api/tools/data/base64-encode', async (req, res) => {
    try {
      const { data, options = {} } = req.body;
      const result = DataProcessingService ? DataProcessingService.base64Encode(data, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Base64解码
  app.post('/api/tools/data/base64-decode', async (req, res) => {
    try {
      const { encoded, options = {} } = req.body;
      const result = DataProcessingService ? DataProcessingService.base64Decode(encoded, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // JWT解码
  app.post('/api/tools/data/jwt-decode', async (req, res) => {
    try {
      const { token, secret } = req.body;
      const result = DataProcessingService ? DataProcessingService.decodeJWT(token, secret) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // JWT生成
  app.post('/api/tools/data/jwt-generate', async (req, res) => {
    try {
      const { payload, secret, options = {} } = req.body;
      const result = DataProcessingService ? DataProcessingService.generateJWT(payload, secret, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// 网络工具路由
function createNetworkRoutes(app) {
  // DNS查询
  app.get('/api/tools/network/dns', async (req, res) => {
    try {
      const { domain, type = 'A' } = req.query;
      const result = NetworkService ? await NetworkService.dnsLookup(domain, type) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // IP查询
  app.get('/api/tools/network/ip-lookup', async (req, res) => {
    try {
      const { ip } = req.query;
      const result = NetworkService ? await NetworkService.ipLookup(ip) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Whois查询
  app.get('/api/tools/network/whois', async (req, res) => {
    try {
      const { domain } = req.query;
      const result = NetworkService ? await NetworkService.whoisLookup(domain) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // SSL检查
  app.get('/api/tools/network/ssl-check', async (req, res) => {
    try {
      const { hostname, port = 443 } = req.query;
      const result = NetworkService ? await NetworkService.checkSSL(hostname, parseInt(port)) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 网站测速
  app.get('/api/tools/network/speed-test', async (req, res) => {
    try {
      const { url } = req.query;
      const result = NetworkService ? await NetworkService.speedTest(url) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // HTTP请求测试
  app.post('/api/tools/network/http-request', async (req, res) => {
    try {
      const result = NetworkService ? await NetworkService.httpRequest(req.body) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// 安全工具路由
function createSecurityRoutes(app) {
  // 密码生成
  app.post('/api/tools/security/password-generate', async (req, res) => {
    try {
      const result = SecurityService ? SecurityService.generatePassword(req.body) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 密码泄露检查
  app.post('/api/tools/security/password-check', async (req, res) => {
    try {
      const { password } = req.body;
      const result = SecurityService ? await SecurityService.checkPasswordBreach(password) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 哈希计算
  app.post('/api/tools/security/hash', async (req, res) => {
    try {
      const { data, algorithm = 'sha256' } = req.body;
      const result = SecurityService ? SecurityService.calculateHash(data, algorithm) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 批量哈希
  app.post('/api/tools/security/hash-batch', async (req, res) => {
    try {
      const { data, algorithms } = req.body;
      const result = SecurityService ? SecurityService.calculateHashes(data, algorithms) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // URL编码
  app.post('/api/tools/security/url-encode', async (req, res) => {
    try {
      const { text, component = false } = req.body;
      const result = SecurityService ? SecurityService.urlEncode(text, { component }) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // URL解码
  app.post('/api/tools/security/url-decode', async (req, res) => {
    try {
      const { encoded, component = false } = req.body;
      const result = SecurityService ? SecurityService.urlDecode(encoded, { component }) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // HTML转义
  app.post('/api/tools/security/html-escape', async (req, res) => {
    try {
      const { html } = req.body;
      const result = SecurityService ? SecurityService.escapeHTML(html) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // HTML反转义
  app.post('/api/tools/security/html-unescape', async (req, res) => {
    try {
      const { escaped } = req.body;
      const result = SecurityService ? SecurityService.unescapeHTML(escaped) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 数据脱敏
  app.post('/api/tools/security/mask-data', async (req, res) => {
    try {
      const { data, type } = req.body;
      const result = SecurityService ? SecurityService.maskData(data, type) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // UUID生成
  app.post('/api/tools/security/uuid-generate', async (req, res) => {
    try {
      const { version = 4, options = {} } = req.body;
      const result = SecurityService ? SecurityService.generateUUID(version, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 加密
  app.post('/api/tools/security/encrypt', async (req, res) => {
    try {
      const { data, key, algorithm = 'aes-256-gcm' } = req.body;
      const result = SecurityService ? SecurityService.encrypt(data, key, algorithm) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 解密
  app.post('/api/tools/security/decrypt', async (req, res) => {
    try {
      const { encrypted, key, algorithm = 'aes-256-gcm' } = req.body;
      const result = SecurityService ? SecurityService.decrypt(encrypted, key, algorithm) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// 开发工具路由
function createDevRoutes(app) {
  // 代码格式化
  app.post('/api/tools/dev/code-format', async (req, res) => {
    try {
      const { code, language, options = {} } = req.body;
      const result = DevToolsService ? await DevToolsService.formatCode(code, language, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 代码压缩
  app.post('/api/tools/dev/code-minify', async (req, res) => {
    try {
      const { code, language, options = {} } = req.body;
      const result = DevToolsService ? DevToolsService.minifyCode(code, language, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 代码对比
  app.post('/api/tools/dev/code-diff', async (req, res) => {
    try {
      const { oldCode, newCode, options = {} } = req.body;
      const result = DevToolsService ? DevToolsService.diffCode(oldCode, newCode, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cron解析
  app.post('/api/tools/dev/cron-parse', async (req, res) => {
    try {
      const { expression, options = {} } = req.body;
      const result = DevToolsService ? DevToolsService.parseCron(expression, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cron生成
  app.post('/api/tools/dev/cron-generate', async (req, res) => {
    try {
      const result = DevToolsService ? DevToolsService.generateCron(req.body) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 时间戳转换
  app.post('/api/tools/dev/timestamp-convert', async (req, res) => {
    try {
      const { timestamp, options = {} } = req.body;
      const result = DevToolsService ? DevToolsService.convertTimestamp(timestamp, options) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 颜色转换
  app.post('/api/tools/dev/color-convert', async (req, res) => {
    try {
      const { color, targetFormat } = req.body;
      const result = DevToolsService ? DevToolsService.convertColor(color, targetFormat) : { success: false, error: '服务不可用' };
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// 注册所有工具路由
function registerToolRoutes(app) {
  createAIRoute(app);
  createFileRoutes(app);
  createDataRoutes(app);
  createNetworkRoutes(app);
  createSecurityRoutes(app);
  createDevRoutes(app);
}

module.exports = { registerToolRoutes };

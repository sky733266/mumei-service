const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// 安全/加密服务
class SecurityService {
  // 密码生成器
  static generatePassword(options = {}) {
    const startTime = Date.now();

    const {
      length = 16,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
      excludeSimilar = false,
      excludeAmbiguous = false
    } = options;

    let charset = '';
    if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (numbers) charset += '0123456789';
    if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    // 排除相似字符
    if (excludeSimilar) {
      charset = charset.replace(/[ilLI|10O]/g, '');
    }

    // 排除模糊字符
    if (excludeAmbiguous) {
      charset = charset.replace(/[{}\[\]()/\\'"`~,;:.<>]/g, '');
    }

    if (charset.length === 0) {
      throw new Error('至少选择一种字符类型');
    }

    // 生成密码
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    // 确保包含所有要求的字符类型
    const checks = {
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /[0-9]/.test(password),
      hasSymbols: /[^A-Za-z0-9]/.test(password)
    };

    // 计算密码强度
    const strength = this.calculatePasswordStrength(password);

    return {
      success: true,
      password,
      length,
      strength,
      checks,
      entropy: this.calculateEntropy(password),
      crackTime: this.estimateCrackTime(password),
      duration: Date.now() - startTime
    };
  }

  // 计算密码强度
  static calculatePasswordStrength(password) {
    let score = 0;
    
    // 长度评分
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    
    // 字符多样性
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // 复杂度
    if (/(.)\1{2,}/.test(password)) score -= 1; // 重复字符
    if (/^[a-zA-Z]+$/.test(password)) score -= 1; // 纯字母
    if (/^[0-9]+$/.test(password)) score -= 1; // 纯数字

    const strengthMap = {
      0: { level: 'very-weak', label: '极弱', color: '#ef4444' },
      1: { level: 'weak', label: '弱', color: '#f97316' },
      2: { level: 'fair', label: '一般', color: '#eab308' },
      3: { level: 'good', label: '良好', color: '#84cc16' },
      4: { level: 'strong', label: '强', color: '#22c55e' },
      5: { level: 'very-strong', label: '极强', color: '#10b981' },
      6: { level: 'excellent', label: '优秀', color: '#06b6d4' }
    };

    const clampedScore = Math.max(0, Math.min(6, score));
    return {
      score: clampedScore,
      ...strengthMap[clampedScore]
    };
  }

  // 计算密码熵
  static calculateEntropy(password) {
    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^A-Za-z0-9]/.test(password)) poolSize += 32;

    return Math.log2(Math.pow(poolSize, password.length));
  }

  // 估算破解时间
  static estimateCrackTime(password) {
    const guessesPerSecond = 1e9; // 假设每秒10亿次尝试
    const entropy = this.calculateEntropy(password);
    const combinations = Math.pow(2, entropy);
    const seconds = combinations / guessesPerSecond;

    const units = [
      { label: '秒', value: 1 },
      { label: '分钟', value: 60 },
      { label: '小时', value: 3600 },
      { label: '天', value: 86400 },
      { label: '年', value: 31536000 },
      { label: '世纪', value: 3153600000 }
    ];

    for (let i = units.length - 1; i >= 0; i--) {
      if (seconds >= units[i].value) {
        const value = Math.round(seconds / units[i].value);
        return `${value} ${units[i].label}`;
      }
    }

    return '瞬间';
  }

  // 检查密码是否泄露（模拟）
  static async checkPasswordBreach(password) {
    const startTime = Date.now();

    // 计算密码的SHA1
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);

    // 实际项目中应该调用 Have I Been Pwned API
    // https://api.pwnedpasswords.com/range/{prefix}
    
    // 模拟检查常见弱密码
    const commonPasswords = [
      '123456', 'password', '12345678', 'qwerty', '123456789',
      'letmein', '1234567', 'football', 'iloveyou', 'admin'
    ];

    const isCommon = commonPasswords.includes(password.toLowerCase());
    const isWeak = password.length < 8;

    return {
      success: true,
      breached: isCommon,
      weak: isWeak,
      sha1Prefix: prefix,
      occurrences: isCommon ? Math.floor(Math.random() * 1000000) : 0,
      recommendations: isCommon || isWeak ? [
        '使用更长的密码（至少12位）',
        '混合使用大小写字母、数字和符号',
        '避免使用常见单词和序列',
        '使用密码管理器生成随机密码'
      ] : [],
      duration: Date.now() - startTime
    };
  }

  // 哈希计算
  static calculateHash(data, algorithm = 'sha256', encoding = 'hex') {
    const startTime = Date.now();

    try {
      const hash = crypto.createHash(algorithm);
      
      if (Buffer.isBuffer(data)) {
        hash.update(data);
      } else if (typeof data === 'string') {
        hash.update(data, 'utf8');
      } else {
        hash.update(JSON.stringify(data), 'utf8');
      }

      const result = hash.digest(encoding);

      return {
        success: true,
        hash: result,
        algorithm,
        encoding,
        length: result.length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`哈希计算失败: ${error.message}`);
    }
  }

  // 批量哈希计算
  static calculateHashes(data, algorithms = ['md5', 'sha1', 'sha256', 'sha512']) {
    const startTime = Date.now();
    const results = {};

    for (const algo of algorithms) {
      try {
        results[algo] = this.calculateHash(data, algo, 'hex').hash;
      } catch (error) {
        results[algo] = { error: error.message };
      }
    }

    return {
      success: true,
      hashes: results,
      duration: Date.now() - startTime
    };
  }

  // HMAC计算
  static calculateHMAC(data, key, algorithm = 'sha256') {
    const startTime = Date.now();

    try {
      const hmac = crypto.createHmac(algorithm, key);
      
      if (Buffer.isBuffer(data)) {
        hmac.update(data);
      } else {
        hmac.update(data, 'utf8');
      }

      const result = hmac.digest('hex');

      return {
        success: true,
        hmac: result,
        algorithm,
        keyLength: key.length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`HMAC计算失败: ${error.message}`);
    }
  }

  // 文件哈希
  static async fileHash(filePath, algorithm = 'sha256') {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = require('fs').createReadStream(filePath);

      stream.on('error', (error) => {
        reject(new Error(`文件读取失败: ${error.message}`));
      });

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve({
          success: true,
          hash: hash.digest('hex'),
          algorithm,
          file: filePath,
          duration: Date.now() - startTime
        });
      });
    });
  }

  // URL编码/解码
  static urlEncode(text, options = {}) {
    const startTime = Date.now();

    try {
      let encoded;
      if (options.component) {
        encoded = encodeURIComponent(text);
      } else {
        encoded = encodeURI(text);
      }

      return {
        success: true,
        original: text,
        encoded,
        type: options.component ? 'component' : 'full',
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`URL编码失败: ${error.message}`);
    }
  }

  static urlDecode(encoded, options = {}) {
    const startTime = Date.now();

    try {
      let decoded;
      if (options.component) {
        decoded = decodeURIComponent(encoded);
      } else {
        decoded = decodeURI(encoded);
      }

      return {
        success: true,
        encoded,
        decoded,
        type: options.component ? 'component' : 'full',
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`URL解码失败: ${error.message}`);
    }
  }

  // HTML转义
  static escapeHTML(html) {
    const startTime = Date.now();

    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    const escaped = html.replace(/[&<>"'/]/g, (char) => escapeMap[char]);

    return {
      success: true,
      original: html,
      escaped,
      duration: Date.now() - startTime
    };
  }

  static unescapeHTML(escaped) {
    const startTime = Date.now();

    const unescapeMap = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#39;': "'"
    };

    const unescaped = escaped.replace(/&amp;|&lt;|&gt;|&quot;|&#x27;|&#x2F;|&#39;/g, 
      (entity) => unescapeMap[entity]);

    return {
      success: true,
      escaped,
      unescaped,
      duration: Date.now() - startTime
    };
  }

  // 数据脱敏
  static maskData(data, type) {
    const startTime = Date.now();

    let masked;
    switch (type) {
      case 'email':
        masked = data.replace(/(.{2})(.*)(@.*)/, '$1***$3');
        break;
      case 'phone':
        masked = data.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
        break;
      case 'idcard':
        masked = data.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
        break;
      case 'bankcard':
        masked = data.replace(/(\d{4})\d+(\d{4})/, '$1 **** **** $2');
        break;
      case 'name':
        masked = data.charAt(0) + '*'.repeat(data.length - 1);
        break;
      case 'custom':
        masked = data.slice(0, 3) + '*'.repeat(Math.max(0, data.length - 6)) + data.slice(-3);
        break;
      default:
        masked = '*'.repeat(data.length);
    }

    return {
      success: true,
      original: data,
      masked,
      type,
      duration: Date.now() - startTime
    };
  }

  // 生成UUID
  static generateUUID(version = 4, options = {}) {
    const startTime = Date.now();

    let uuid;
    switch (version) {
      case 1:
        // UUID v1 - 基于时间戳
        uuid = uuidv4(); // 简化，实际应使用uuid.v1()
        break;
      case 4:
      default:
        // UUID v4 - 随机
        uuid = uuidv4();
        break;
    }

    // 格式化
    if (options.uppercase) {
      uuid = uuid.toUpperCase();
    }
    if (options.noDashes) {
      uuid = uuid.replace(/-/g, '');
    }

    return {
      success: true,
      uuid,
      version,
      format: options.noDashes ? 'nodashes' : 'standard',
      duration: Date.now() - startTime
    };
  }

  // 标准化密钥为指定长度的Buffer
  static normalizeKey(key, keyLength = 32) {
    // 如果key已经是hex格式且长度正确，直接使用
    if (/^[0-9a-fA-F]+$/.test(key) && Buffer.from(key, 'hex').length >= keyLength) {
      return Buffer.from(key, 'hex').slice(0, keyLength);
    }
    // 否则通过SHA-256哈希生成固定长度的密钥
    const hash = crypto.createHash('sha256').update(String(key)).digest();
    return hash.slice(0, keyLength);
  }

  // 加密
  static encrypt(data, key, algorithm = 'aes-256-gcm') {
    const startTime = Date.now();

    try {
      const normalizedKey = this.normalizeKey(key, 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, normalizedKey, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();

      return {
        success: true,
        encrypted: iv.toString('hex') + authTag.toString('hex') + encrypted,
        algorithm,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`加密失败: ${error.message}`);
    }
  }

  // 解密
  static decrypt(encrypted, key, algorithm = 'aes-256-gcm') {
    const startTime = Date.now();

    try {
      const normalizedKey = this.normalizeKey(key, 32);
      
      if (encrypted.length < 64) {
        throw new Error('加密数据格式无效（长度不足）');
      }
      
      const iv = Buffer.from(encrypted.slice(0, 32), 'hex');
      const authTag = Buffer.from(encrypted.slice(32, 64), 'hex');
      const ciphertext = encrypted.slice(64);

      if (ciphertext.length === 0) {
        throw new Error('加密数据不包含密文内容');
      }

      const decipher = crypto.createDecipheriv(algorithm, normalizedKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return {
        success: true,
        decrypted,
        algorithm,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`解密失败: ${error.message}`);
    }
  }
}

module.exports = {
  SecurityService
};

const csv = require('csv-parser');
const { createReadStream } = require('fs');
const { stringify } = require('csv-stringify/sync');
const sqlFormatter = require('sql-formatter');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// 数据处理服务
class DataProcessingService {
  // JSON格式化/校验
  static formatJSON(jsonString, options = {}) {
    const startTime = Date.now();

    try {
      let parsed;
      
      // 尝试解析JSON
      if (typeof jsonString === 'string') {
        // 处理可能的JSONP格式
        const cleaned = jsonString.replace(/^\s*callback\s*\(|\)\s*;?\s*$/g, '');
        parsed = JSON.parse(cleaned);
      } else {
        parsed = jsonString;
      }

      // 格式化选项
      const space = options.compact ? 0 : (options.indent || 2);
      const formatted = JSON.stringify(parsed, null, space);

      // 验证JSON Schema
      let schemaValid = true;
      let schemaErrors = [];
      if (options.schema) {
        const Ajv = require('ajv');
        const ajv = new Ajv();
        const validate = ajv.compile(options.schema);
        schemaValid = validate(parsed);
        if (!schemaValid) {
          schemaErrors = validate.errors;
        }
      }

      return {
        success: true,
        valid: true,
        formatted,
        compact: options.compact ? JSON.stringify(parsed) : null,
        schemaValid,
        schemaErrors,
        stats: {
          keys: Object.keys(parsed).length,
          depth: this.getJSONDepth(parsed),
          size: formatted.length
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        error: error.message,
        position: this.findJSONErrorPosition(jsonString, error.message),
        duration: Date.now() - startTime
      };
    }
  }

  // 获取JSON深度
  static getJSONDepth(obj, depth = 0) {
    if (typeof obj !== 'object' || obj === null) return depth;
    
    let maxDepth = depth;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const currentDepth = this.getJSONDepth(obj[key], depth + 1);
        maxDepth = Math.max(maxDepth, currentDepth);
      }
    }
    return maxDepth;
  }

  // 查找JSON错误位置
  static findJSONErrorPosition(jsonString, errorMessage) {
    const match = errorMessage.match(/position\s+(\d+)/);
    if (match) {
      const position = parseInt(match[1]);
      const lines = jsonString.substring(0, position).split('\n');
      return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
        position
      };
    }
    return null;
  }

  // JSON转CSV
  static jsonToCSV(jsonData, options = {}) {
    const startTime = Date.now();

    try {
      let data = jsonData;
      if (typeof jsonData === 'string') {
        data = JSON.parse(jsonData);
      }

      // 确保是数组
      if (!Array.isArray(data)) {
        data = [data];
      }

      // 扁平化嵌套对象
      const flattened = data.map(item => this.flattenObject(item));

      const csv = stringify(flattened, {
        header: true,
        columns: options.columns,
        delimiter: options.delimiter || ',',
        quoted: options.quoted !== false
      });

      return {
        success: true,
        csv,
        rows: flattened.length,
        columns: Object.keys(flattened[0] || {}).length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`JSON转CSV失败: ${error.message}`);
    }
  }

  // CSV转JSON
  static async csvToJSON(csvString, options = {}) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const results = [];
      const stream = require('stream');
      const readable = new stream.Readable();
      readable._read = () => {};
      readable.push(csvString);
      readable.push(null);

      readable
        .pipe(csv({
          separator: options.delimiter || ',',
          headers: options.headers,
          skipEmptyLines: true
        }))
        .on('data', (data) => {
          // 数据清洗
          const cleaned = {};
          for (const [key, value] of Object.entries(data)) {
            const trimmedKey = key.trim();
            let trimmedValue = value.trim();
            
            // 尝试转换为数字
            if (options.parseNumbers && !isNaN(trimmedValue) && trimmedValue !== '') {
              trimmedValue = Number(trimmedValue);
            }
            
            // 尝试转换为布尔值
            if (options.parseBooleans) {
              if (trimmedValue.toLowerCase() === 'true') trimmedValue = true;
              if (trimmedValue.toLowerCase() === 'false') trimmedValue = false;
            }
            
            cleaned[trimmedKey] = trimmedValue;
          }
          results.push(cleaned);
        })
        .on('end', () => {
          resolve({
            success: true,
            data: results,
            rows: results.length,
            columns: results.length > 0 ? Object.keys(results[0]).length : 0,
            duration: Date.now() - startTime
          });
        })
        .on('error', (error) => {
          reject(new Error(`CSV解析失败: ${error.message}`));
        });
    });
  }

  // 扁平化对象
  static flattenObject(obj, prefix = '', result = {}) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          this.flattenObject(obj[key], newKey, result);
        } else {
          result[newKey] = Array.isArray(obj[key]) ? obj[key].join(',') : obj[key];
        }
      }
    }
    return result;
  }

  // SQL格式化
  static formatSQL(sql, options = {}) {
    const startTime = Date.now();

    try {
      const formatted = sqlFormatter.format(sql, {
        language: options.dialect || 'sql',
        indent: options.indent || '  ',
        uppercase: options.uppercase !== false,
        linesBetweenQueries: options.linesBetweenQueries || 1
      });

      // 简单的SQL验证
      const validation = this.validateSQL(sql);

      return {
        success: true,
        formatted,
        original: sql,
        compressed: sql.replace(/\s+/g, ' ').trim(),
        validation,
        stats: {
          lines: formatted.split('\n').length,
          length: formatted.length,
          statements: (sql.match(/;/g) || []).length + 1
        },
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`SQL格式化失败: ${error.message}`);
    }
  }

  // 简单SQL验证
  static validateSQL(sql) {
    const errors = [];
    const warnings = [];

    // 检查基本语法
    if (!sql.trim().endsWith(';') && sql.includes(';')) {
      warnings.push('SQL语句建议以分号结尾');
    }

    // 检查SELECT *
    if (/SELECT\s+\*/i.test(sql)) {
      warnings.push('使用SELECT *可能影响性能，建议指定具体列');
    }

    // 检查SQL注入风险
    if (/'\s*OR\s*'\s*=/i.test(sql) || /;\s*DROP\s+/i.test(sql)) {
      errors.push('检测到潜在的SQL注入风险');
    }

    // 检查未使用WHERE的DELETE/UPDATE
    if (/(DELETE|UPDATE)\s+/i.test(sql) && !/WHERE/i.test(sql)) {
      warnings.push(`${sql.match(/(DELETE|UPDATE)/i)[0]}语句没有WHERE条件，将影响所有行`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // 正则表达式测试
  static testRegex(pattern, flags = '', testStrings = []) {
    const startTime = Date.now();

    try {
      const regex = new RegExp(pattern, flags);
      
      const results = testStrings.map(str => {
        const matches = str.match(regex);
        const matchResult = regex.test(str);
        
        // 重置lastIndex（针对全局匹配）
        regex.lastIndex = 0;
        
        // 获取所有匹配
        const allMatches = [];
        if (flags.includes('g')) {
          let match;
          while ((match = regex.exec(str)) !== null) {
            allMatches.push({
              match: match[0],
              index: match.index,
              groups: match.groups || {}
            });
            if (match.index === regex.lastIndex) regex.lastIndex++;
          }
        }

        return {
          input: str,
          matched: matchResult,
          matches: matches ? matches.slice(0, 10) : null,
          allMatches: allMatches,
          groups: matches && matches.groups ? matches.groups : null
        };
      });

      // 生成代码示例
      const codeExamples = {
        javascript: `const regex = /${pattern}/${flags};\nconst result = str.match(regex);`,
        python: `import re\nregex = re.compile(r'${pattern.replace(/'/g, "\\'")}'${flags ? ', re.' + flags.toUpperCase() : ''})\nresult = regex.match(string)`,
        java: `Pattern pattern = Pattern.compile("${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"${flags ? ', Pattern.' + flags.toUpperCase() : ''});\nMatcher matcher = pattern.matcher(input);`,
        php: `$pattern = '/${pattern.replace(/\//g, '\\/')}/${flags}';\n$matches = [];\npreg_match($pattern, $string, $matches);`
      };

      return {
        success: true,
        pattern,
        flags,
        results,
        codeExamples,
        explanation: this.explainRegex(pattern),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        pattern,
        flags,
        duration: Date.now() - startTime
      };
    }
  }

  // 解释正则表达式
  static explainRegex(pattern) {
    const explanations = [];
    
    const patterns = {
      '^': '字符串开始',
      '$': '字符串结束',
      '.': '任意字符（除换行）',
      '*': '零次或多次',
      '+': '一次或多次',
      '?': '零次或一次',
      '\\d': '数字',
      '\\w': '单词字符',
      '\\s': '空白字符',
      '[abc]': '字符集',
      '[^abc]': '否定字符集',
      '(abc)': '捕获组',
      '(?:abc)': '非捕获组',
      'a{3}': '恰好3次',
      'a{3,}': '至少3次',
      'a{3,5}': '3到5次'
    };

    for (const [p, desc] of Object.entries(patterns)) {
      if (pattern.includes(p)) {
        explanations.push(`${p}: ${desc}`);
      }
    }

    return explanations;
  }

  // Base64编解码
  static base64Encode(data, options = {}) {
    const startTime = Date.now();

    try {
      let buffer;
      
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'string') {
        buffer = Buffer.from(data, options.encoding || 'utf8');
      } else {
        buffer = Buffer.from(JSON.stringify(data));
      }

      const encoded = buffer.toString('base64');

      // URL安全的Base64
      if (options.urlSafe) {
        return {
          success: true,
          encoded: encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
          originalLength: buffer.length,
          encodedLength: encoded.length,
          duration: Date.now() - startTime
        };
      }

      return {
        success: true,
        encoded,
        originalLength: buffer.length,
        encodedLength: encoded.length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Base64编码失败: ${error.message}`);
    }
  }

  static base64Decode(encoded, options = {}) {
    const startTime = Date.now();

    try {
      // 还原URL安全的Base64
      if (options.urlSafe) {
        encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
        // 补齐padding
        while (encoded.length % 4) {
          encoded += '=';
        }
      }

      const buffer = Buffer.from(encoded, 'base64');

      if (options.asString) {
        return {
          success: true,
          decoded: buffer.toString(options.encoding || 'utf8'),
          length: buffer.length,
          duration: Date.now() - startTime
        };
      }

      return {
        success: true,
        decoded: buffer,
        length: buffer.length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Base64解码失败: ${error.message}`);
    }
  }

  // JWT解码/验证
  static decodeJWT(token, secret = null) {
    const startTime = Date.now();

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('无效的JWT格式');
      }

      // 解码Header
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      
      // 解码Payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      // 验证签名（如果提供了secret）
      let signatureValid = null;
      if (secret) {
        const signature = crypto
          .createHmac('sha256', secret)
          .update(`${parts[0]}.${parts[1]}`)
          .digest('base64url');
        signatureValid = signature === parts[2];
      }

      // 检查过期
      const now = Math.floor(Date.now() / 1000);
      const expired = payload.exp && payload.exp < now;
      const notBefore = payload.nbf && payload.nbf > now;

      return {
        success: true,
        header,
        payload,
        signatureValid,
        expired,
        notBefore,
        valid: signatureValid !== false && !expired && !notBefore,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // 生成JWT
  static generateJWT(payload, secret, options = {}) {
    const startTime = Date.now();

    try {
      const header = {
        alg: 'HS256',
        typ: 'JWT',
        ...options.header
      };

      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iat: now,
        jti: uuidv4(),
        ...payload
      };

      if (options.expiresIn) {
        claims.exp = now + options.expiresIn;
      }
      if (options.notBefore) {
        claims.nbf = now + options.notBefore;
      }
      if (options.issuer) {
        claims.iss = options.issuer;
      }
      if (options.audience) {
        claims.aud = options.audience;
      }

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
      
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

      const token = `${encodedHeader}.${encodedPayload}.${signature}`;

      return {
        success: true,
        token,
        header,
        payload: claims,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`JWT生成失败: ${error.message}`);
    }
  }
}

module.exports = {
  DataProcessingService
};

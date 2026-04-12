const API_DOCS_DATA = {
  "auth": {
    "title": "认证",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/auth/register",
        "desc": "用户注册",
        "params": [
          {
            "name": "email",
            "type": "string",
            "required": true
          },
          {
            "name": "password",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/auth/login",
        "desc": "用户登录",
        "params": [
          {
            "name": "email",
            "type": "string",
            "required": true
          },
          {
            "name": "password",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/auth/send-verification",
        "desc": "发送验证码",
        "params": [
          {
            "name": "email",
            "type": "string",
            "required": true
          }
        ]
      }
    ]
  },
  "tools": {
    "title": "AI 工具",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/tools/ai/text-generate",
        "desc": "文本生成",
        "params": [
          {
            "name": "prompt",
            "type": "string",
            "required": true
          },
          {
            "name": "max_tokens",
            "type": "number",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/ai/code-generate",
        "desc": "代码生成",
        "params": [
          {
            "name": "prompt",
            "type": "string",
            "required": true
          },
          {
            "name": "language",
            "type": "string",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/ai/code-review",
        "desc": "代码审查",
        "params": [
          {
            "name": "code",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/ai/summarize",
        "desc": "内容摘要",
        "params": [
          {
            "name": "content",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/ai/image-generate",
        "desc": "图片生成",
        "params": [
          {
            "name": "prompt",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/ai/tts",
        "desc": "文字转语音",
        "params": [
          {
            "name": "text",
            "type": "string",
            "required": true
          },
          {
            "name": "voice",
            "type": "string",
            "required": false
          }
        ]
      }
    ]
  },
  "file": {
    "title": "文件处理",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/tools/file/convert",
        "desc": "文件格式转换",
        "params": [
          {
            "name": "file",
            "type": "file",
            "required": true
          },
          {
            "name": "targetFormat",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/file/image-process",
        "desc": "图片处理",
        "params": [
          {
            "name": "file",
            "type": "file",
            "required": true
          },
          {
            "name": "operation",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/file/markdown-render",
        "desc": "Markdown渲染",
        "params": [
          {
            "name": "content",
            "type": "string",
            "required": true
          }
        ]
      }
    ]
  },
  "data": {
    "title": "数据处理",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/tools/data/json-format",
        "desc": "JSON格式化",
        "params": [
          {
            "name": "data",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/json-to-csv",
        "desc": "JSON转CSV",
        "params": [
          {
            "name": "data",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/csv-to-json",
        "desc": "CSV转JSON",
        "params": [
          {
            "name": "data",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/base64-encode",
        "desc": "Base64编码",
        "params": [
          {
            "name": "data",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/base64-decode",
        "desc": "Base64解码",
        "params": [
          {
            "name": "data",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/text-stats",
        "desc": "字数统计",
        "params": [
          {
            "name": "text",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/case-convert",
        "desc": "大小写转换",
        "params": [
          {
            "name": "text",
            "type": "string",
            "required": true
          },
          {
            "name": "mode",
            "type": "string",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/lorem-ipsum",
        "desc": "Lorem Ipsum生成",
        "params": [
          {
            "name": "sentences",
            "type": "number",
            "required": false
          },
          {
            "name": "type",
            "type": "string",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/number-to-chinese",
        "desc": "数字转中文",
        "params": [
          {
            "name": "number",
            "type": "string",
            "required": true
          },
          {
            "name": "type",
            "type": "string",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/date-calculator",
        "desc": "日期计算器",
        "params": [
          {
            "name": "startDate",
            "type": "string",
            "required": true
          },
          {
            "name": "endDate",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/random-number",
        "desc": "随机数生成",
        "params": [
          {
            "name": "min",
            "type": "number",
            "required": false
          },
          {
            "name": "max",
            "type": "number",
            "required": false
          },
          {
            "name": "count",
            "type": "number",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/calculator",
        "desc": "在线计算器",
        "params": [
          {
            "name": "expression",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/json-path",
        "desc": "JSON路径查询",
        "params": [
          {
            "name": "json",
            "type": "string",
            "required": true
          },
          {
            "name": "path",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/data/yaml-convert",
        "desc": "YAML转换",
        "params": [
          {
            "name": "data",
            "type": "string",
            "required": true
          },
          {
            "name": "direction",
            "type": "string",
            "required": false
          }
        ]
      }
    ]
  },
  "network": {
    "title": "网络工具",
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/tools/network/dns",
        "desc": "DNS查询",
        "params": [
          {
            "name": "domain",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "GET",
        "path": "/api/tools/network/ip-lookup",
        "desc": "IP查询",
        "params": [
          {
            "name": "ip",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "GET",
        "path": "/api/tools/network/whois",
        "desc": "Whois查询",
        "params": [
          {
            "name": "domain",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/network/url-parser",
        "desc": "URL批量解析",
        "params": [
          {
            "name": "urls",
            "type": "array",
            "required": true
          }
        ]
      }
    ]
  },
  "security": {
    "title": "安全工具",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/tools/security/password-generate",
        "desc": "密码生成",
        "params": [
          {
            "name": "length",
            "type": "number",
            "required": false
          },
          {
            "name": "options",
            "type": "object",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/security/password-check",
        "desc": "密码强度检查",
        "params": [
          {
            "name": "password",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/security/hash",
        "desc": "哈希计算",
        "params": [
          {
            "name": "data",
            "type": "string",
            "required": true
          },
          {
            "name": "algorithm",
            "type": "string",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/security/uuid-generate",
        "desc": "UUID生成",
        "params": []
      },
      {
        "method": "POST",
        "path": "/api/tools/security/barcode-generate",
        "desc": "条形码生成（专业版）",
        "params": [
          {
            "name": "text",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/security/meta-generator",
        "desc": "SEO Meta标签生成（专业版）",
        "params": [
          {
            "name": "title",
            "type": "string",
            "required": true
          },
          {
            "name": "description",
            "type": "string",
            "required": false
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/security/hash-calc",
        "desc": "哈希计算器",
        "params": [
          {
            "name": "text",
            "type": "string",
            "required": true
          }
        ]
      }
    ]
  },
  "dev": {
    "title": "开发工具",
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/tools/dev/code-format",
        "desc": "代码格式化",
        "params": [
          {
            "name": "code",
            "type": "string",
            "required": true
          },
          {
            "name": "language",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/dev/code-minify",
        "desc": "代码压缩",
        "params": [
          {
            "name": "code",
            "type": "string",
            "required": true
          },
          {
            "name": "language",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/dev/cron-parse",
        "desc": "Cron解析",
        "params": [
          {
            "name": "expression",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/dev/timestamp-convert",
        "desc": "时间戳转换",
        "params": [
          {
            "name": "timestamp",
            "type": "number",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/dev/color-convert",
        "desc": "颜色格式转换",
        "params": [
          {
            "name": "color",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "POST",
        "path": "/api/tools/dev/markdown-preview",
        "desc": "Markdown预览",
        "params": [
          {
            "name": "markdown",
            "type": "string",
            "required": true
          }
        ]
      },
      {
        "method": "GET",
        "path": "/api/tools/dev/qr-decode",
        "desc": "二维码解码（独立页面）",
        "params": []
      },
      {
        "method": "POST",
        "path": "/api/tools/dev/cron-generate",
        "desc": "Cron生成器",
        "params": [
          {
            "name": "second",
            "type": "string",
            "required": false
          },
          {
            "name": "minute",
            "type": "string",
            "required": false
          },
          {
            "name": "hour",
            "type": "string",
            "required": false
          },
          {
            "name": "day",
            "type": "string",
            "required": false
          },
          {
            "name": "month",
            "type": "string",
            "required": false
          },
          {
            "name": "week",
            "type": "string",
            "required": false
          }
        ]
      }
    ]
  }
};
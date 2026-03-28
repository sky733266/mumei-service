const prettier = require('prettier');
const UglifyJS = require('uglify-js');
const CleanCSS = require('clean-css');
const diff = require('diff');
const cronstrue = require('cronstrue');
const parser = require('cron-parser');

// 开发者工具服务
class DevToolsService {
  // 代码格式化
  static async formatCode(code, language, options = {}) {
    const startTime = Date.now();

    try {
      let formatted;
      let parser;

      switch (language) {
        case 'javascript':
        case 'js':
          parser = 'babel';
          break;
        case 'typescript':
        case 'ts':
          parser = 'typescript';
          break;
        case 'json':
          parser = 'json';
          break;
        case 'html':
          parser = 'html';
          break;
        case 'css':
          parser = 'css';
          break;
        case 'scss':
        case 'sass':
          parser = 'scss';
          break;
        case 'less':
          parser = 'less';
          break;
        case 'markdown':
        case 'md':
          parser = 'markdown';
          break;
        case 'yaml':
        case 'yml':
          parser = 'yaml';
          break;
        case 'graphql':
          parser = 'graphql';
          break;
        default:
          parser = 'babel';
      }

      formatted = await prettier.format(code, {
        parser,
        printWidth: options.printWidth || 80,
        tabWidth: options.tabWidth || 2,
        useTabs: options.useTabs || false,
        semi: options.semi !== false,
        singleQuote: options.singleQuote !== false,
        trailingComma: options.trailingComma || 'es5',
        bracketSpacing: options.bracketSpacing !== false,
        arrowParens: options.arrowParens || 'avoid',
        endOfLine: options.endOfLine || 'lf'
      });

      return {
        success: true,
        original: code,
        formatted,
        language,
        changes: formatted !== code,
        originalLength: code.length,
        formattedLength: formatted.length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        language,
        duration: Date.now() - startTime
      };
    }
  }

  // 代码压缩
  static minifyCode(code, language, options = {}) {
    const startTime = Date.now();

    try {
      let result;

      switch (language) {
        case 'javascript':
        case 'js':
          result = UglifyJS.minify(code, {
            compress: {
              drop_console: options.dropConsole || false,
              drop_debugger: options.dropDebugger !== false,
              dead_code: true,
              unused: true
            },
            mangle: options.mangle !== false,
            output: {
              comments: options.preserveComments ? /^!/ : false
            }
          });
          
          if (result.error) {
            throw new Error(result.error.message);
          }
          
          return {
            success: true,
            original: code,
            minified: result.code,
            language,
            originalLength: code.length,
            minifiedLength: result.code.length,
            compressionRatio: ((1 - result.code.length / code.length) * 100).toFixed(2),
            duration: Date.now() - startTime
          };

        case 'css':
          const cleanCSS = new CleanCSS({
            level: 2,
            format: false
          });
          result = cleanCSS.minify(code);
          
          return {
            success: true,
            original: code,
            minified: result.styles,
            language,
            originalLength: code.length,
            minifiedLength: result.styles.length,
            compressionRatio: ((1 - result.styles.length / code.length) * 100).toFixed(2),
            warnings: result.warnings,
            duration: Date.now() - startTime
          };

        case 'html':
          // 简单的HTML压缩
          const minifiedHTML = code
            .replace(/>\s+</g, '><')
            .replace(/\s+/g, ' ')
            .replace(/<!--[\s\S]*?-->/g, '')
            .trim();
          
          return {
            success: true,
            original: code,
            minified: minifiedHTML,
            language,
            originalLength: code.length,
            minifiedLength: minifiedHTML.length,
            compressionRatio: ((1 - minifiedHTML.length / code.length) * 100).toFixed(2),
            duration: Date.now() - startTime
          };

        case 'json':
          const parsed = JSON.parse(code);
          const minifiedJSON = JSON.stringify(parsed);
          
          return {
            success: true,
            original: code,
            minified: minifiedJSON,
            language,
            originalLength: code.length,
            minifiedLength: minifiedJSON.length,
            compressionRatio: ((1 - minifiedJSON.length / code.length) * 100).toFixed(2),
            duration: Date.now() - startTime
          };

        default:
          throw new Error(`不支持的压缩语言: ${language}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        language,
        duration: Date.now() - startTime
      };
    }
  }

  // 代码对比（Diff）
  static diffCode(oldCode, newCode, options = {}) {
    const startTime = Date.now();

    try {
      const differences = diff[options.algorithm || 'diffLines'](oldCode, newCode, {
        ignoreCase: options.ignoreCase || false,
        ignoreWhitespace: options.ignoreWhitespace || false
      });

      const changes = {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 0
      };

      const hunks = [];
      let currentHunk = null;

      differences.forEach((part, index) => {
        if (part.added) {
          changes.added++;
          if (!currentHunk || currentHunk.type !== 'add') {
            currentHunk = { type: 'add', lines: [], index };
            hunks.push(currentHunk);
          }
          currentHunk.lines.push({ type: '+', content: part.value });
        } else if (part.removed) {
          changes.removed++;
          if (!currentHunk || currentHunk.type !== 'remove') {
            currentHunk = { type: 'remove', lines: [], index };
            hunks.push(currentHunk);
          }
          currentHunk.lines.push({ type: '-', content: part.value });
        } else {
          changes.unchanged++;
          if (currentHunk) {
            currentHunk = null;
          }
        }
      });

      // 生成统一diff格式
      const unifiedDiff = this.generateUnifiedDiff(oldCode, newCode, differences, options);

      return {
        success: true,
        changes,
        hunks: hunks.slice(0, 50), // 限制显示数量
        unifiedDiff,
        similarity: this.calculateSimilarity(oldCode, newCode),
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

  // 生成统一diff格式
  static generateUnifiedDiff(oldCode, newCode, differences, options = {}) {
    const contextLines = options.context || 3;
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    
    let diffOutput = `--- a/${options.oldFileName || 'old'}\n`;
    diffOutput += `+++ b/${options.newFileName || 'new'}\n`;
    
    let oldLine = 1;
    let newLine = 1;
    
    differences.forEach(part => {
      const lines = part.value.split('\n');
      // 移除最后一个空行（如果存在）
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }
      
      lines.forEach(line => {
        if (part.added) {
          diffOutput += `+${line}\n`;
          newLine++;
        } else if (part.removed) {
          diffOutput += `-${line}\n`;
          oldLine++;
        } else {
          diffOutput += ` ${line}\n`;
          oldLine++;
          newLine++;
        }
      });
    });
    
    return diffOutput;
  }

  // 计算相似度
  static calculateSimilarity(oldCode, newCode) {
    const distance = diff.levenshtein(oldCode, newCode);
    const maxLength = Math.max(oldCode.length, newCode.length);
    return ((1 - distance / maxLength) * 100).toFixed(2);
  }

  // Cron表达式解析
  static parseCron(expression, options = {}) {
    const startTime = Date.now();

    try {
      // 解析为自然语言
      const description = cronstrue.toString(expression, {
        verbose: options.verbose || false,
        dayOfWeekStartIndexZero: options.dayOfWeekStartIndexZero !== false,
        use24HourTimeFormat: options.use24HourTimeFormat || false
      });

      // 获取下一次执行时间
      const interval = parser.parseExpression(expression, {
        currentDate: options.currentDate || new Date(),
        tz: options.timezone || 'UTC'
      });

      const nextRuns = [];
      for (let i = 0; i < (options.nextRuns || 5); i++) {
        nextRuns.push(interval.next().toDate());
      }

      // 验证表达式
      const parts = expression.split(' ');
      const isValid = parts.length >= 5 && parts.length <= 6;

      // 生成代码示例
      const codeExamples = {
        javascript: `// 使用 node-cron\nconst cron = require('node-cron');\n\ncron.schedule('${expression}', () => {\n  console.log('任务执行');\n});`,
        python: `# 使用 schedule\nimport schedule\nimport time\n\n# 需要手动映射cron表达式\n# ${expression}\n\ndef job():\n    print("任务执行")\n\n# 示例: 每分钟执行\nschedule.every(1).minutes.do(job)\n\nwhile True:\n    schedule.run_pending()\n    time.sleep(1)`,
        linux: `# Crontab\n${expression} /path/to/command`,
        go: `// 使用 robfig/cron\nimport "github.com/robfig/cron/v3"\n\nc := cron.New()\nc.AddFunc("${expression}", func() {\n    fmt.Println("任务执行")\n})\nc.Start()`
      };

      return {
        success: true,
        expression,
        description,
        nextRuns,
        isValid,
        parts: {
          minute: parts[0],
          hour: parts[1],
          dayOfMonth: parts[2],
          month: parts[3],
          dayOfWeek: parts[4],
          year: parts[5] || '*'
        },
        codeExamples,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        expression,
        error: error.message,
        isValid: false,
        duration: Date.now() - startTime
      };
    }
  }

  // 生成Cron表达式
  static generateCron(options = {}) {
    const startTime = Date.now();

    const {
      minute = '*',
      hour = '*',
      dayOfMonth = '*',
      month = '*',
      dayOfWeek = '*'
    } = options;

    const expression = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
    
    return {
      success: true,
      expression,
      ...this.parseCron(expression)
    };
  }

  // 时间戳转换
  static convertTimestamp(timestamp, options = {}) {
    const startTime = Date.now();

    try {
      let date;
      let originalFormat;

      // 自动检测时间戳格式
      if (typeof timestamp === 'number' || /^\d+$/.test(timestamp)) {
        const ts = parseInt(timestamp);
        // 判断是秒还是毫秒
        if (ts > 10000000000) {
          date = new Date(ts);
          originalFormat = 'milliseconds';
        } else {
          date = new Date(ts * 1000);
          originalFormat = 'seconds';
        }
      } else if (typeof timestamp === 'string') {
        // 尝试解析ISO字符串
        date = new Date(timestamp);
        originalFormat = 'iso';
      } else {
        throw new Error('无效的时间戳格式');
      }

      if (isNaN(date.getTime())) {
        throw new Error('无效的时间戳');
      }

      const timezone = options.timezone || 'UTC';

      return {
        success: true,
        original: timestamp,
        originalFormat,
        date: {
          iso: date.toISOString(),
          local: date.toLocaleString(),
          utc: date.toUTCString(),
          timestamp: Math.floor(date.getTime() / 1000),
          milliseconds: date.getTime()
        },
        components: {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hour: date.getHours(),
          minute: date.getMinutes(),
          second: date.getSeconds(),
          millisecond: date.getMilliseconds(),
          dayOfWeek: date.getDay(),
          dayOfYear: this.getDayOfYear(date)
        },
        relative: this.getRelativeTime(date),
        timezone,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        timestamp,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // 获取一年中的第几天
  static getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  // 获取相对时间
  static getRelativeTime(date) {
    const now = new Date();
    const diff = date - now;
    const absDiff = Math.abs(diff);
    
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    let text;
    if (years > 0) text = `${years}年`;
    else if (months > 0) text = `${months}个月`;
    else if (days > 0) text = `${days}天`;
    else if (hours > 0) text = `${hours}小时`;
    else if (minutes > 0) text = `${minutes}分钟`;
    else text = `${seconds}秒`;

    return {
      text: diff > 0 ? `${text}后` : `${text}前`,
      isFuture: diff > 0,
      seconds,
      minutes,
      hours,
      days,
      months,
      years
    };
  }

  // 颜色转换
  static convertColor(color, targetFormat) {
    const startTime = Date.now();

    try {
      let r, g, b, a = 1;

      // 解析输入颜色
      if (color.startsWith('#')) {
        // HEX
        const hex = color.replace('#', '');
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16);
          g = parseInt(hex[1] + hex[1], 16);
          b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
          r = parseInt(hex.slice(0, 2), 16);
          g = parseInt(hex.slice(2, 4), 16);
          b = parseInt(hex.slice(4, 6), 16);
        } else if (hex.length === 8) {
          r = parseInt(hex.slice(0, 2), 16);
          g = parseInt(hex.slice(2, 4), 16);
          b = parseInt(hex.slice(4, 6), 16);
          a = parseInt(hex.slice(6, 8), 16) / 255;
        }
      } else if (color.startsWith('rgb')) {
        // RGB/RGBA
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
          r = parseInt(match[1]);
          g = parseInt(match[2]);
          b = parseInt(match[3]);
          a = match[4] ? parseFloat(match[4]) : 1;
        }
      } else if (color.startsWith('hsl')) {
        // HSL/HSLA
        const match = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/);
        if (match) {
          const h = parseInt(match[1]);
          const s = parseInt(match[2]) / 100;
          const l = parseInt(match[3]) / 100;
          a = match[4] ? parseFloat(match[4]) : 1;
          [r, g, b] = this.hslToRgb(h, s, l);
        }
      }

      // 转换为目标格式
      let result;
      switch (targetFormat) {
        case 'hex':
          result = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
          break;
        case 'hexa':
          result = '#' + [r, g, b, Math.round(a * 255)].map(x => x.toString(16).padStart(2, '0')).join('');
          break;
        case 'rgb':
          result = `rgb(${r}, ${g}, ${b})`;
          break;
        case 'rgba':
          result = `rgba(${r}, ${g}, ${b}, ${a})`;
          break;
        case 'hsl':
          const [h, s, l] = this.rgbToHsl(r, g, b);
          result = `hsl(${h}, ${s}%, ${l}%)`;
          break;
        case 'hsla':
          const [h2, s2, l2] = this.rgbToHsl(r, g, b);
          result = `hsla(${h2}, ${s2}%, ${l2}%, ${a})`;
          break;
        case 'cmyk':
          const [c, m, y, k] = this.rgbToCmyk(r, g, b);
          result = `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`;
          break;
        default:
          throw new Error(`不支持的目标格式: ${targetFormat}`);
      }

      return {
        success: true,
        original: color,
        converted: result,
        format: targetFormat,
        values: { r, g, b, a },
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        color,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // HSL转RGB
  static hslToRgb(h, s, l) {
    h /= 360;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // RGB转HSL
  static rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  // RGB转CMYK
  static rgbToCmyk(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const k = 1 - Math.max(r, g, b);
    const c = (1 - r - k) / (1 - k) || 0;
    const m = (1 - g - k) / (1 - k) || 0;
    const y = (1 - b - k) / (1 - k) || 0;

    return [
      Math.round(c * 100),
      Math.round(m * 100),
      Math.round(y * 100),
      Math.round(k * 100)
    ];
  }
}

module.exports = {
  DevToolsService
};

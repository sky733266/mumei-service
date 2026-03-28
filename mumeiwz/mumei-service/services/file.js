const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const archiver = require('archiver');
const extract = require('extract-zip');
const markdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

// 文件处理服务
class FileProcessingService {
  // 文档转换
  static async convertDocument(inputPath, outputFormat, options = {}) {
    const startTime = Date.now();
    const inputExt = path.extname(inputPath).toLowerCase();
    const outputPath = inputPath.replace(path.extname(inputPath), `.${outputFormat}`);

    try {
      // 使用LibreOffice进行转换
      if (['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp'].includes(outputFormat)) {
        await execPromise(`soffice --headless --convert-to ${outputFormat} --outdir "${path.dirname(inputPath)}" "${inputPath}"`);
        
        const stats = fs.statSync(outputPath);
        return {
          success: true,
          outputPath,
          format: outputFormat,
          size: stats.size,
          duration: Date.now() - startTime
        };
      }

      // Markdown转其他格式
      if (inputExt === '.md' && ['html', 'pdf'].includes(outputFormat)) {
        const md = new markdownIt();
        const content = fs.readFileSync(inputPath, 'utf8');
        const html = md.render(content);

        if (outputFormat === 'html') {
          fs.writeFileSync(outputPath, html);
        } else if (outputFormat === 'pdf') {
          // 使用Puppeteer生成PDF
          const browser = await puppeteer.launch();
          const page = await browser.newPage();
          await page.setContent(html);
          await page.pdf({ path: outputPath, format: 'A4' });
          await browser.close();
        }

        const stats = fs.statSync(outputPath);
        return {
          success: true,
          outputPath,
          format: outputFormat,
          size: stats.size,
          duration: Date.now() - startTime
        };
      }

      throw new Error(`不支持的转换格式: ${inputExt} -> ${outputFormat}`);
    } catch (error) {
      throw new Error(`文档转换失败: ${error.message}`);
    }
  }

  // 图片处理
  static async processImage(inputPath, operations = []) {
    const startTime = Date.now();
    let pipeline = sharp(inputPath);
    const metadata = await pipeline.metadata();

    for (const op of operations) {
      switch (op.type) {
        case 'resize':
          pipeline = pipeline.resize(op.width, op.height, {
            fit: op.fit || 'cover',
            position: op.position || 'center'
          });
          break;
        case 'crop':
          pipeline = pipeline.extract({
            left: op.left,
            top: op.top,
            width: op.width,
            height: op.height
          });
          break;
        case 'rotate':
          pipeline = pipeline.rotate(op.angle);
          break;
        case 'flip':
          pipeline = pipeline.flip(op.flip);
          break;
        case 'flop':
          pipeline = pipeline.flop(op.flop);
          break;
        case 'blur':
          pipeline = pipeline.blur(op.sigma);
          break;
        case 'sharpen':
          pipeline = pipeline.sharpen(op.sigma);
          break;
        case 'grayscale':
          pipeline = pipeline.grayscale();
          break;
        case 'tint':
          pipeline = pipeline.tint(op.color);
          break;
        case 'format':
          pipeline = pipeline.toFormat(op.format, { quality: op.quality || 80 });
          break;
        case 'compress':
          pipeline = pipeline.jpeg({ quality: op.quality || 80, progressive: true })
            .png({ quality: op.quality || 80, progressive: true });
          break;
        case 'watermark':
          const watermark = await sharp(op.watermarkPath).resize(op.width, op.height).toBuffer();
          pipeline = pipeline.composite([{
            input: watermark,
            gravity: op.position || 'southeast',
            blend: 'over'
          }]);
          break;
      }
    }

    const outputPath = inputPath.replace(path.extname(inputPath), `_processed${path.extname(inputPath)}`);
    await pipeline.toFile(outputPath);

    const stats = fs.statSync(outputPath);
    return {
      success: true,
      outputPath,
      originalSize: fs.statSync(inputPath).size,
      processedSize: stats.size,
      compressionRatio: ((1 - stats.size / fs.statSync(inputPath).size) * 100).toFixed(2),
      duration: Date.now() - startTime
    };
  }

  // 视频处理
  static async processVideo(inputPath, operations = []) {
    const startTime = Date.now();
    const outputPath = inputPath.replace(path.extname(inputPath), `_processed${path.extname(inputPath)}`);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      for (const op of operations) {
        switch (op.type) {
          case 'resize':
            command = command.size(`${op.width}x${op.height}`);
            break;
          case 'trim':
            command = command.setStartTime(op.start).setDuration(op.duration);
            break;
          case 'format':
            command = command.toFormat(op.format);
            break;
          case 'compress':
            command = command.videoCodec('libx264')
              .audioCodec('aac')
              .videoBitrate(op.videoBitrate || '1000k')
              .audioBitrate(op.audioBitrate || '128k');
            break;
          case 'extractAudio':
            command = command.noVideo().audioCodec('mp3');
            break;
          case 'extractFrame':
            command = command.seekInput(op.time).frames(1);
            break;
          case 'speed':
            command = command.videoFilters(`setpts=${1/op.speed}*PTS`)
              .audioFilters(`atempo=${op.speed}`);
            break;
        }
      }

      command.on('end', () => {
        const stats = fs.statSync(outputPath);
        resolve({
          success: true,
          outputPath,
          originalSize: fs.statSync(inputPath).size,
          processedSize: stats.size,
          duration: Date.now() - startTime
        });
      });

      command.on('error', (err) => {
        reject(new Error(`视频处理失败: ${err.message}`));
      });

      command.save(outputPath);
    });
  }

  // 压缩文件
  static async compress(files, outputPath, format = 'zip') {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver(format, {
        zlib: { level: 9 }
      });

      output.on('close', () => {
        const stats = fs.statSync(outputPath);
        resolve({
          success: true,
          outputPath,
          size: stats.size,
          files: files.length,
          duration: Date.now() - startTime
        });
      });

      archive.on('error', (err) => {
        reject(new Error(`压缩失败: ${err.message}`));
      });

      archive.pipe(output);

      for (const file of files) {
        if (fs.statSync(file).isDirectory()) {
          archive.directory(file, path.basename(file));
        } else {
          archive.file(file, { name: path.basename(file) });
        }
      }

      archive.finalize();
    });
  }

  // 解压文件
  static async extract(inputPath, outputDir) {
    const startTime = Date.now();

    try {
      await extract(inputPath, { dir: outputDir });
      
      // 统计解压后的文件
      const files = fs.readdirSync(outputDir);
      
      return {
        success: true,
        outputDir,
        files: files.length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`解压失败: ${error.message}`);
    }
  }

  // Markdown渲染
  static async renderMarkdown(content, outputFormat = 'html', options = {}) {
    const startTime = Date.now();
    const md = new markdownIt({
      html: true,
      linkify: true,
      typographer: true,
      ...options.markdownIt
    });

    // 添加代码高亮插件
    if (options.highlight) {
      const hljs = require('highlight.js');
      md.set({
        highlight: function (str, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(str, { language: lang }).value;
            } catch (__) {}
          }
          return md.utils.escapeHtml(str);
        }
      });
    }

    const html = md.render(content);

    if (outputFormat === 'html') {
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${options.title || 'Document'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      line-height: 1.6;
    }
    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    code {
      font-family: 'Fira Code', monospace;
      font-size: 0.9em;
    }
    img {
      max-width: 100%;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
    }
    th {
      background: #f5f5f5;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
      return {
        success: true,
        content: fullHtml,
        format: 'html',
        duration: Date.now() - startTime
      };
    }

    if (outputFormat === 'pdf') {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      const pdf = await page.pdf({ 
        format: 'A4',
        margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' }
      });
      await browser.close();

      return {
        success: true,
        content: pdf.toString('base64'),
        format: 'pdf',
        duration: Date.now() - startTime
      };
    }

    throw new Error(`不支持的输出格式: ${outputFormat}`);
  }
}

module.exports = {
  FileProcessingService
};

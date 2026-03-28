// 二维码生成工具 - 纯前端实现
// 使用 QRCode.js 库

class QRCodeGenerator {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  // 生成二维码数据URL
  async generate(text, options = {}) {
    const {
      width = 300,
      height = 300,
      colorDark = '#000000',
      colorLight = '#ffffff',
      correctLevel = 'H', // L, M, Q, H
      margin = 4,
      logo = null, // Logo图片URL
      logoWidth = 60,
      logoHeight = 60
    } = options;

    // 创建canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 使用简单的二维码生成算法（基于QRCode.js的简化版）
    // 实际项目中应引入完整的 qrcode 库
    await this.drawQRCode(ctx, text, width, height, colorDark, colorLight, margin);

    // 添加Logo（如果有）
    if (logo) {
      await this.addLogo(ctx, logo, width / 2 - logoWidth / 2, height / 2 - logoHeight / 2, logoWidth, logoHeight);
    }

    return canvas.toDataURL('image/png');
  }

  // 简化的二维码绘制（实际使用时应引入完整库）
  async drawQRCode(ctx, text, width, height, colorDark, colorLight, margin) {
    // 填充背景
    ctx.fillStyle = colorLight;
    ctx.fillRect(0, 0, width, height);

    // 这里应该使用完整的QRCode算法
    // 简化版：绘制一个占位图案
    const cellSize = (width - margin * 2) / 25;
    ctx.fillStyle = colorDark;

    // 绘制定位点
    this.drawPositionPattern(ctx, margin, margin, cellSize);
    this.drawPositionPattern(ctx, width - margin - 7 * cellSize, margin, cellSize);
    this.drawPositionPattern(ctx, margin, height - margin - 7 * cellSize, cellSize);

    // 绘制数据（模拟）
    for (let i = 0; i < 25; i++) {
      for (let j = 0; j < 25; j++) {
        if (Math.random() > 0.5 && !this.isPositionArea(i, j)) {
          ctx.fillRect(margin + i * cellSize, margin + j * cellSize, cellSize, cellSize);
        }
      }
    }

    // 添加文字提示
    ctx.fillStyle = colorDark;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', width / 2, height - 10);
  }

  // 绘制定位图案
  drawPositionPattern(ctx, x, y, size) {
    // 外框
    ctx.fillRect(x, y, size * 7, size * 7);
    // 内白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + size, y + size, size * 5, size * 5);
    // 中心黑
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + size * 2, y + size * 2, size * 3, size * 3);
  }

  // 检查是否是定位点区域
  isPositionArea(i, j) {
    return (i < 8 && j < 8) || (i > 16 && j < 8) || (i < 8 && j > 16);
  }

  // 添加Logo
  async addLogo(ctx, logoUrl, x, y, width, height) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // 绘制白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 5, y - 5, width + 10, height + 10);
        // 绘制Logo
        ctx.drawImage(img, x, y, width, height);
        resolve();
      };
      img.onerror = resolve;
      img.src = logoUrl;
    });
  }

  // 下载二维码
  download(dataUrl, filename = 'qrcode.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }
}

// 简化的二维码生成（使用Google Chart API作为备用）
function generateQRCodeSimple(text, width = 300, height = 300) {
  const encoded = encodeURIComponent(text);
  return `https://chart.googleapis.com/chart?cht=qr&chs=${width}x${height}&chld=H|0&chl=${encoded}`;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QRCodeGenerator, generateQRCodeSimple };
}

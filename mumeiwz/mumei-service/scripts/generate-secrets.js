/**
 * 安全密钥生成脚本
 * 运行: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('🔐 沐美服务 - 安全密钥生成工具\n');
console.log('='.repeat(50));

// 生成 JWT Secret
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('\n✅ JWT Secret (复制到 .env 文件):\n');
console.log(`JWT_SECRET=${jwtSecret}`);

// 生成安全的随机字符串
function generateSecureString(length = 32) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

console.log('\n' + '='.repeat(50));
console.log('\n📝 使用说明:\n');
console.log('1. 将上面的 JWT_SECRET 复制到 .env 文件');
console.log('2. 生产环境务必设置 NODE_ENV=production');
console.log('3. 确保 .env 文件不要提交到 Git\n');

console.log('⚠️  警告: 泄露密钥将导致账户安全风险！\n');

/**
 * 沐美服务 - 启动脚本
 * 支持开发/生产环境，自动检查依赖
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const envFile = path.join(ROOT_DIR, '.env');
const envExample = path.join(ROOT_DIR, '.env.example');
const envProductionExample = path.join(ROOT_DIR, '.env.production.example');

// 检查 Node.js 版本
function checkNodeVersion() {
  const version = process.version.slice(1).split('.').map(Number);
  const [major] = version;
  
  if (major < 16) {
    console.error('❌ Node.js 版本过低');
    console.error(`   当前版本: ${process.version}`);
    console.error('   要求版本: >= 16.0.0');
    process.exit(1);
  }
  
  console.log(`✅ Node.js 版本检查通过 (${process.version})`);
}

// 检查环境变量文件
function checkEnvFile() {
  if (!fs.existsSync(envFile)) {
    console.warn('⚠️  .env 文件不存在');
    
    // 尝试复制示例文件
    const exampleSource = fs.existsSync(envProductionExample) ? envProductionExample : envExample;
    
    if (fs.existsSync(exampleSource)) {
      console.log('   正在复制示例配置...');
      fs.copyFileSync(exampleSource, envFile);
      console.log('✅ 已创建 .env 文件');
      console.log('   请编辑 .env 文件配置必要的参数');
    }
  } else {
    console.log('✅ .env 文件存在');
  }
}

// 检查依赖
function checkDependencies() {
  const nodeModules = path.join(ROOT_DIR, 'node_modules');
  
  if (!fs.existsSync(nodeModules)) {
    console.log('📦 正在安装依赖...');
    return false; // 需要安装
  }
  
  console.log('✅ 依赖已安装');
  return true;
}

// 创建必要目录
function createDirectories() {
  const dirs = ['data', 'uploads', 'logs'];
  
  dirs.forEach(dir => {
    const dirPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 已创建目录: ${dir}/`);
    }
  });
}

// 获取启动模式
function getMode() {
  const args = process.argv.slice(2);
  
  if (args.includes('--production') || args.includes('-p')) {
    return 'production';
  }
  
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  
  // 检查 NODE_ENV
  const envContent = fs.existsSync(envFile) 
    ? fs.readFileSync(envFile, 'utf8') 
    : '';
  
  if (envContent.includes('NODE_ENV=production')) {
    return 'production';
  }
  
  return 'development';
}

// 打印帮助
function printHelp() {
  console.log(`
沐美服务启动脚本

用法:
  node scripts/start.js [选项]

选项:
  --production, -p   以生产模式启动
  --help, -h         显示帮助信息

示例:
  node scripts/start.js              # 开发模式
  node scripts/start.js -p           # 生产模式
  `);
}

// 启动服务
function startServer(mode) {
  console.log('\n🚀 正在启动服务...\n');
  
  const env = { ...process.env, NODE_ENV: mode };
  
  const child = spawn('node', ['server.js'], {
    cwd: ROOT_DIR,
    env,
    stdio: 'inherit'
  });
  
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`\n❌ 服务异常退出 (code: ${code})`);
      process.exit(code);
    }
  });
  
  child.on('error', (err) => {
    console.error('❌ 启动失败:', err.message);
  });
}

// 主流程
function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║      沐美服务 - Mumei Service          ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  checkNodeVersion();
  checkEnvFile();
  createDirectories();
  
  const mode = getMode();
  console.log(`📋 启动模式: ${mode}`);
  
  // 检查 package.json
  const packageJson = require(path.join(ROOT_DIR, 'package.json'));
  console.log(`📦 ${packageJson.name} v${packageJson.version}\n`);
  
  // 检查依赖
  if (!checkDependencies()) {
    console.log('请先运行: npm install');
    process.exit(1);
  }
  
  startServer(mode);
}

main();

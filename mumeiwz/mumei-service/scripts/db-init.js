/**
 * 数据库初始化脚本
 * 确保必要的数据文件存在
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('✅ 数据目录已创建');
}

// 默认套餐配置
const DEFAULT_PLANS = [
  {
    id: 'free',
    name: '免费版',
    nameEn: 'Free',
    price: 0,
    period: 'unlimited',
    quotas: {
      dailyLimit: 100,
      monthlyLimit: 1000,
      maxTokens: 3,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxWebhooks: 1
    },
    features: [
      '基础API调用',
      '3个API Token',
      '社区支持'
    ]
  },
  {
    id: 'pro',
    name: '专业版',
    nameEn: 'Pro',
    price: 29,
    period: 'monthly',
    quotas: {
      dailyLimit: 10000,
      monthlyLimit: 100000,
      maxTokens: 20,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxWebhooks: 10
    },
    features: [
      '全部基础功能',
      '20个API Token',
      '优先邮件支持',
      '高级分析报表'
    ]
  },
  {
    id: 'enterprise',
    name: '企业版',
    nameEn: 'Enterprise',
    price: 99,
    period: 'monthly',
    quotas: {
      dailyLimit: 100000,
      monthlyLimit: 1000000,
      maxTokens: 100,
      maxFileSize: 200 * 1024 * 1024, // 200MB
      maxWebhooks: -1 // 无限
    },
    features: [
      '全部专业版功能',
      '100个API Token',
      '专属客户经理',
      'SLA保障',
      '自定义集成'
    ]
  }
];

// 初始化数据文件
const dataFiles = [
  {
    name: 'plans.json',
    defaultData: DEFAULT_PLANS
  },
  {
    name: 'users.json',
    defaultData: []
  },
  {
    name: 'tokens.json',
    defaultData: []
  },
  {
    name: 'logs.json',
    defaultData: []
  },
  {
    name: 'subscriptions.json',
    defaultData: []
  },
  {
    name: 'webhooks.json',
    defaultData: []
  },
  {
    name: 'blacklist.json',
    defaultData: { ips: [], reasons: {} }
  }
];

console.log('📦 初始化数据库...\n');

dataFiles.forEach(({ name, defaultData }) => {
  const filePath = path.join(DATA_DIR, name);
  
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    console.log(`✅ 已创建: ${name}`);
  } else {
    // 检查并迁移数据
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // 确保数组类型
      if (Array.isArray(defaultData) && !Array.isArray(data)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
        console.log(`🔄 已修复: ${name} (格式错误)`);
      } else {
        console.log(`✅ 已存在: ${name}`);
      }
    } catch (e) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      console.log(`🔄 已修复: ${name} (JSON解析错误)`);
    }
  }
});

console.log('\n✅ 数据库初始化完成');
console.log(`📁 数据目录: ${DATA_DIR}\n`);

// 打印使用提示
console.log('💡 使用提示:');
console.log('   开发环境: npm run launch');
console.log('   生产环境: npm run launch:prod');

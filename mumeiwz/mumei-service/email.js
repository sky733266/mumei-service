const nodemailer = require('nodemailer');

// 模拟邮件发送（开发环境）
let mockMode = true;
let mockEmailStore = new Map();

// 创建邮件传输器
const createTransporter = () => {
  // 生产环境使用真实SMTP配置
  if (process.env.SMTP_HOST) {
    mockMode = false;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // 开发环境使用Ethereal测试账户
  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
    mockMode = false;
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS
      }
    });
  }

  // 模拟模式 - 不实际发送邮件
  mockMode = true;
  return null;
};

// 发送验证邮件
async function sendVerificationEmail(email, code, lang = 'zh') {
  const transporter = createTransporter();

  // 模拟模式：直接存储验证码
  if (mockMode) {
    mockEmailStore.set(email, { code, timestamp: Date.now() });
    console.log(`\n========== 模拟邮件发送 ==========`);
    console.log(`收件人: ${email}`);
    console.log(`验证码: ${code}`);
    console.log(`==================================\n`);
    return { 
      success: true, 
      mock: true, 
      message: '模拟邮件已发送（请查看控制台）',
      code: code // 开发环境直接返回验证码
    };
  }

  const subjects = {
    zh: '沐美服务 - 邮箱验证码',
    en: 'Mumei Service - Email Verification Code',
    ko: '무메이 서비스 - 이메일 인증 코드',
    fr: 'Service Mumei - Code de vérification',
    es: 'Servicio Mumei - Código de verificación',
    ja: 'ムメイサービス - メール認証コード'
  };

  const templates = {
    zh: {
      title: '欢迎注册沐美服务',
      greeting: '您好！',
      message: '感谢您注册沐美服务。请使用以下验证码完成邮箱验证：',
      codeLabel: '验证码',
      expire: '此验证码将在30分钟后过期。',
      ignore: '如果您没有注册，请忽略此邮件。'
    },
    en: {
      title: 'Welcome to Mumei Service',
      greeting: 'Hello!',
      message: 'Thank you for registering with Mumei Service. Please use the following code to verify your email:',
      codeLabel: 'Verification Code',
      expire: 'This code will expire in 30 minutes.',
      ignore: 'If you did not register, please ignore this email.'
    },
    ko: {
      title: '무메이 서비스에 오신 것을 환영합니다',
      greeting: '안녕하세요!',
      message: '무메이 서비스에 등록해 주셔서 감사합니다. 이메일 인증을 위해 다음 코드를 사용하세요:',
      codeLabel: '인증 코드',
      expire: '이 코드는 30분 후에 만료됩니다.',
      ignore: '등록하지 않으셨다면 이 이메일을 무시하세요.'
    },
    fr: {
      title: 'Bienvenue sur Service Mumei',
      greeting: 'Bonjour!',
      message: 'Merci de vous être inscrit sur Service Mumei. Veuillez utiliser le code suivant pour vérifier votre email:',
      codeLabel: 'Code de vérification',
      expire: 'Ce code expirera dans 30 minutes.',
      ignore: 'Si vous ne vous êtes pas inscrit, veuillez ignorer cet email.'
    },
    es: {
      title: 'Bienvenido a Servicio Mumei',
      greeting: '¡Hola!',
      message: 'Gracias por registrarte en Servicio Mumei. Usa el siguiente código para verificar tu email:',
      codeLabel: 'Código de verificación',
      expire: 'Este código expirará en 30 minutos.',
      ignore: 'Si no te registraste, ignora este email.'
    },
    ja: {
      title: 'ムメイサービスへようこそ',
      greeting: 'こんにちは！',
      message: 'ムメイサービスにご登録いただきありがとうございます。メール認証のために以下のコードをご使用ください：',
      codeLabel: '認証コード',
      expire: 'このコードは30分後に失効します。',
      ignore: '登録されていない場合は、このメールを無視してください。'
    }
  };

  const t = templates[lang] || templates.zh;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 40px;
    }
    .code-box {
      background: #f8f9fa;
      border: 2px dashed #6366f1;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      color: #6366f1;
      letter-spacing: 8px;
      font-family: monospace;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 40px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${t.title}</h1>
    </div>
    <div class="content">
      <p>${t.greeting}</p>
      <p>${t.message}</p>
      <div class="code-box">
        <div style="color: #666; margin-bottom: 12px;">${t.codeLabel}</div>
        <div class="code">${code}</div>
      </div>
      <p style="color: #666; font-size: 14px;">${t.expire}</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">${t.ignore}</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 沐美服务 Mumei Service</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"沐美服务" <noreply@mumei.dev>',
    to: email,
    subject: subjects[lang] || subjects.zh,
    html: html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('邮件已发送:', info.messageId);
    
    // 开发环境显示预览URL
    if (info.ethereal) {
      console.log('预览URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('邮件发送失败:', error);
    throw new Error('邮件发送失败');
  }
}

// 获取模拟验证码（开发环境使用）
function getMockCode(email) {
  const record = mockEmailStore.get(email);
  if (record && Date.now() - record.timestamp < 30 * 60 * 1000) {
    return record.code;
  }
  return null;
}

// 发送订阅到期提醒邮件
async function sendSubscriptionReminder(email, userName, planName, daysLeft, lang = 'zh') {
  const transporter = createTransporter();

  const subjects = {
    zh: `沐美服务 - 您的${planName}将在${daysLeft}天后到期`,
    en: `Mumei Service - Your ${planName} will expire in ${daysLeft} days`,
    ko: `무메이 서비스 - ${planName}이(가) ${daysLeft}일 후 만료됩니다`,
    fr: `Service Mumei - Votre ${planName} expirera dans ${daysLeft} jours`,
    es: `Servicio Mumei - Su ${planName} vencerá en ${daysLeft} días`,
    ja: `ムメイサービス - ${planName}は${daysLeft}日後に期限切れになります`
  };

  const content = {
    zh: { title: '订阅到期提醒', message: `尊敬的 ${userName}，您的 ${planName} 将在 ${daysLeft} 天后到期。请及时续费以继续享受高级功能。`, cta: '立即续费' },
    en: { title: 'Subscription Expiry Reminder', message: `Dear ${userName}, your ${planName} will expire in ${daysLeft} days. Please renew to continue enjoying premium features.`, cta: 'Renew Now' },
    ko: { title: '구독 만료 알림', message: `존경하는 ${userName}님,您的 ${planName}은(는) ${daysLeft}일 후 만료됩니다. 프리미엄 기능을 계속 이용하려면续订해 주세요.`, cta: '지금续訂' },
    fr: { title: 'Expiration de l\'abonnement', message: `Cher/Chère ${userName}, votre ${planName} expirera dans ${daysLeft} jours. Veuillez renouvelez pour continuer à profiter des fonctionnalités premium.`, cta: 'Renouveler' },
    es: { title: 'Recordatorio de vencimiento', message: `Estimado/a ${userName}, su ${planName} vencerá en ${daysLeft} días. Renueve para seguir disfrutando de las funciones premium.`, cta: 'Renovar ahora' },
    ja: { title: 'サブスクリプション有効期限のリマインダー', message: `${userName}様，您的 ${planName}は${daysLeft}日後に期限切れになります。プレミアム機能を 계속 이용하려면更新してください。`, cta: '今すぐ更新' }
  };

  const c = content[lang] || content.zh;

  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',sans-serif;color:#333;">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">${c.title}</h1>
      </div>
      <div style="padding:30px;background:#f9f9f9;">
        <p style="font-size:16px;line-height:1.6;">${c.message}</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}/pricing" style="display:inline-block;padding:14px 32px;background:#667eea;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${c.cta}</a>
        </div>
        <p style="color:#888;font-size:13px;text-align:center;">如有问题，请联系 support@mumei.service</p>
      </div>
    </div>
  `;

  if (mockMode) {
    console.log(`\n========== 模拟订阅提醒邮件 ==========`);
    console.log(`收件人: ${email}`);
    console.log(`套餐: ${planName}, 剩余: ${daysLeft}天`);
    console.log(`==================================\n`);
    return { success: true, mock: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"沐美服务" <${process.env.SMTP_USER || 'noreply@mumei.service'}>`,
      to: email,
      subject: subjects[lang] || subjects.zh,
      html
    });
    return { success: true, messageId: info.messageId };
  } catch (e) {
    console.error('发送订阅提醒失败:', e.message);
    return { success: false, error: e.message };
  }
}

// 获取Ethereal测试账户（开发环境使用）
async function getEtherealAccount() {
  const testAccount = await nodemailer.createTestAccount();
  console.log('Ethereal测试账户:');
  console.log('User:', testAccount.user);
  console.log('Pass:', testAccount.pass);
  return testAccount;
}

module.exports = { sendVerificationEmail, sendSubscriptionReminder, getMockCode, getEtherealAccount };

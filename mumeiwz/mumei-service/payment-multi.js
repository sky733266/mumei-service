/**
 * 沐美服务 - 多元化支付系统
 * 支持: Stripe, PayPal, 易支付(微信/支付宝)
 */

const https = require('https');
const crypto = require('crypto');

// ============ Stripe 配置 ============
let stripe = null;
try {
  const Stripe = require('stripe');
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    console.log('✅ Stripe 已配置');
  }
} catch (e) {
  console.log('⚠️ Stripe 未安装，跳过');
}

// ============ PayPal 配置 ============
const PAYPAL_CONFIG = {
  clientId: process.env.PAYPAL_CLIENT_ID || '',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  mode: process.env.PAYPAL_MODE || 'sandbox' // sandbox 或 live
};

const PAYPAL_BASE_URL = PAYPAL_CONFIG.mode === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// ============ 易支付配置 (微信/支付宝) ============
const EPAY_CONFIG = {
  url: process.env.EPAY_URL || '',      // 易支付接口地址
  pid: process.env.EPAY_PID || '',      // 商户ID
  key: process.env.EPAY_KEY || '',       // 商户密钥
  return_url: process.env.EPAY_RETURN || '',  // 返回地址
  notify_url: process.env.EPAY_NOTIFY || ''  // 通知地址
};

// ============ 支付方式枚举 ============
const PaymentMethod = {
  STRIPE_CARD: 'stripe_card',
  STRIPE_ALIPAY: 'stripe_alipay',
  STRIPE_WECHAT: 'stripe_wechat',
  PAYPAL: 'paypal',
  EPAY_WECHAT: 'epay_wechat',
  EPAY_ALIPAY: 'epay_alipay'
};

// ============ 获取支付方式列表 ============
function getAvailablePayments() {
  const payments = [];
  
  if (stripe) {
    payments.push(
      { id: PaymentMethod.STRIPE_CARD, name: '💳 信用卡', fee: '2.9%+$0.3', recommended: true },
      { id: PaymentMethod.STRIPE_ALIPAT, name: 'Alipay', fee: '2.9%+$0.3' },
      { id: PaymentMethod.STRIPE_WECHAT, name: 'WeChat Pay', fee: '2.9%+$0.3' }
    );
  }
  
  if (PAYPAL_CONFIG.clientId && PAYPAL_CONFIG.clientSecret) {
    payments.push(
      { id: PaymentMethod.PAYPAL, name: 'PayPal', fee: '3.4%+$0.3', global: true }
    );
  }
  
  if (EPAY_CONFIG.url && EPAY_CONFIG.pid && EPAY_CONFIG.key) {
    payments.push(
      { id: PaymentMethod.EPAY_ALIPAY, name: '支付宝', fee: '0.6%-1%', cn: true },
      { id: PaymentMethod.EPAY_WECHAT, name: '微信支付', fee: '0.6%-1%', cn: true }
    );
  }
  
  return payments;
}

// ============ Stripe 支付 ============
async function createStripePayment(amount, currency, metadata) {
  if (!stripe) {
    throw new Error('Stripe 未配置');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // 转换为分
      currency: currency || 'usd',
      metadata,
      automatic_payment_methods: { enabled: true }
    });

    return {
      success: true,
      type: 'stripe',
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id
    };
  } catch (error) {
    console.error('Stripe 支付创建失败:', error);
    return { success: false, error: error.message };
  }
}

// ============ PayPal 支付 ============
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CONFIG.clientId}:${PAYPAL_CONFIG.clientSecret}`).toString('base64');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PAYPAL_BASE_URL.replace('https://', ''),
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write('grant_type=client_credentials');
    req.end();
  });
}

async function createPayPalPayment(amount, currency, description) {
  if (!PAYPAL_CONFIG.clientId || !PAYPAL_CONFIG.clientSecret) {
    throw new Error('PayPal 未配置');
  }

  // 确保 amount 是数字
  const numAmount = parseFloat(amount);

  try {
    const accessToken = await getPayPalAccessToken();
    
    const orderData = JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency || 'USD',
          value: numAmount.toFixed(2)
        },
        description
      }]
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: PAYPAL_BASE_URL.replace('https://', ''),
        path: '/v2/checkout/orders',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({
              success: true,
              type: 'paypal',
              orderId: result.id,
              approveUrl: result.links.find(l => l.rel === 'approve')?.href
            });
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(orderData);
      req.end();
    });
  } catch (error) {
    console.error('PayPal 支付创建失败:', error);
    return { success: false, error: error.message };
  }
}

// ============ 易支付 (微信/支付宝) ============
function createEpayPayment(type, outTradeNo, amount, subject) {
  if (!EPAY_CONFIG.url || !EPAY_CONFIG.pid || !EPAY_CONFIG.key) {
    throw new Error('易支付未配置');
  }

  // type: 1=支付宝, 2=微信, 3=QQ钱包
  const typeMap = {
    [PaymentMethod.EPAY_ALIPAY]: 1,
    [PaymentMethod.EPAY_WECHAT]: 2
  };

  const params = {
    pid: EPAY_CONFIG.pid,
    type: typeMap[type] || 1,
    out_trade_no: outTradeNo,
    notify_url: EPAY_CONFIG.notify_url,
    return_url: EPAY_CONFIG.return_url,
    name: subject,
    money: amount.toFixed(2),
    sign_type: 'MD5'
  };

  // 生成签名
  const signStr = Object.keys(params)
    .filter(k => k !== 'sign_type')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&') + EPAY_CONFIG.key;
  
  params.sign = crypto.createHash('md5').update(signStr).digest('hex');

  // 构建支付 URL
  const queryString = Object.keys(params)
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');

  return {
    success: true,
    type: 'epay',
    payUrl: `${EPAY_CONFIG.url}?${queryString}`,
    qrCodeUrl: `${EPAY_CONFIG.url}/qrcode?${queryString}`,
    outTradeNo
  };
}

// ============ 创建订单 ============
async function createPayment(method, amount, plan, user) {
  const outTradeNo = `MU_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const subject = `沐美服务 - ${plan.name}套餐`;
  const currency = plan.currency || 'cny';

  switch (method) {
    case PaymentMethod.STRIPE_CARD:
    case PaymentMethod.STRIPE_ALIPAY:
    case PaymentMethod.STRIPE_WECHAT:
      return await createStripePayment(amount, currency === 'cny' ? 'cny' : 'usd', {
        userId: user.id,
        planId: plan.id,
        outTradeNo
      });

    case PaymentMethod.PAYPAL:
      return await createPayPalPayment(
        currency === 'cny' ? parseFloat((amount * 0.14).toFixed(2)) : parseFloat(amount), // 汇率转换，保持数字类型
        currency === 'cny' ? 'USD' : currency,
        subject
      );

    case PaymentMethod.EPAY_ALIPAY:
    case PaymentMethod.EPAY_WECHAT:
      return createEpayPayment(method, outTradeNo, amount, subject);

    default:
      return { success: false, error: '不支持的支付方式' };
  }
}

// ============ 验证支付回调 ============
function verifyEpaySign(params) {
  const { sign, sign_type, ...rest } = params;
  
  const signStr = Object.keys(rest)
    .filter(k => rest[k])
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&') + EPAY_CONFIG.key;
  
  const expectedSign = crypto.createHash('md5').update(signStr).digest('hex');
  
  return sign === expectedSign;
}

// ============ Stripe Webhook 处理 ============
async function handleStripeWebhook(payload, signature) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { success: false, error: 'Stripe 未配置' };
  }

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      return {
        success: true,
        type: 'stripe',
        event: 'payment_success',
        data: {
          paymentId: paymentIntent.id,
          userId: paymentIntent.metadata.userId,
          planId: paymentIntent.metadata.planId,
          amount: paymentIntent.amount / 100
        }
      };
    }

    return { success: true, type: 'stripe', event: event.type };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ PayPal 订单完成 ============
async function capturePayPalOrder(orderId) {
  try {
    const accessToken = await getPayPalAccessToken();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: PAYPAL_BASE_URL.replace('https://', ''),
        path: `/v2/checkout/orders/${orderId}/capture`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.status === 'COMPLETED') {
              resolve({
                success: true,
                type: 'paypal',
                orderId,
                amount: result.purchase_units[0].payments.captures[0].amount.value
              });
            } else {
              resolve({ success: false, error: `订单状态: ${result.status}` });
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ 导出 ============
module.exports = {
  PaymentMethod,
  getAvailablePayments,
  createPayment,
  createStripePayment,
  createPayPalPayment,
  createEpayPayment,
  verifyEpaySign,
  handleStripeWebhook,
  capturePayPalOrder
};

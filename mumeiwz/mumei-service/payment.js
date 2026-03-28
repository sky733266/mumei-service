const Stripe = require('stripe');

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

// 创建支付Intent
async function createPaymentIntent(amount, currency = 'usd', metadata = {}) {
  if (!stripe) {
    throw new Error('Stripe未配置');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe使用最小货币单位（分）
      currency,
      metadata,
      automatic_payment_methods: { enabled: true }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  } catch (error) {
    console.error('创建支付Intent失败:', error);
    throw error;
  }
}

// 确认支付
async function confirmPayment(paymentIntentId) {
  if (!stripe) {
    throw new Error('Stripe未配置');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata
    };
  } catch (error) {
    console.error('确认支付失败:', error);
    throw error;
  }
}

// 创建订阅
async function createSubscription(customerId, priceId) {
  if (!stripe) {
    throw new Error('Stripe未配置');
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });

    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret
    };
  } catch (error) {
    console.error('创建订阅失败:', error);
    throw error;
  }
}

// 取消订阅
async function cancelSubscription(subscriptionId) {
  if (!stripe) {
    throw new Error('Stripe未配置');
  }

  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return { status: subscription.status };
  } catch (error) {
    console.error('取消订阅失败:', error);
    throw error;
  }
}

// 创建客户
async function createCustomer(email, name) {
  if (!stripe) {
    throw new Error('Stripe未配置');
  }

  try {
    const customer = await stripe.customers.create({
      email,
      name
    });
    return { customerId: customer.id };
  } catch (error) {
    console.error('创建客户失败:', error);
    throw error;
  }
}

// Webhook处理
async function handleWebhook(payload, signature) {
  if (!stripe) {
    throw new Error('Stripe未配置');
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    return event;
  } catch (error) {
    console.error('Webhook验证失败:', error);
    throw error;
  }
}

// 模拟支付（开发环境使用）
async function mockPayment(amount, currency = 'usd') {
  return {
    status: 'succeeded',
    amount,
    currency,
    paymentIntentId: 'mock_' + Date.now(),
    mock: true
  };
}

module.exports = {
  createPaymentIntent,
  confirmPayment,
  createSubscription,
  cancelSubscription,
  createCustomer,
  handleWebhook,
  mockPayment,
  isConfigured: () => !!stripe
};

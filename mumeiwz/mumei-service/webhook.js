const crypto = require('crypto');
const axios = require('axios');
const { LogDB } = require('./db');

// Webhook管理器
class WebhookManager {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5秒
  }

  // 生成Webhook签名密钥
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  // 生成Webhook签名
  signPayload(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    
    return { signature, timestamp };
  }

  // 验证Webhook签名
  verifySignature(payload, signature, timestamp, secret) {
    try {
      const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');
      
      // 时间戳验证（5分钟内有效）
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp)) > 300) {
        return false;
      }
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  }

  // 发送Webhook
  async sendWebhook(webhookConfig, event, data) {
    const payload = {
      id: crypto.randomUUID(),
      event,
      data,
      timestamp: new Date().toISOString()
    };

    const { signature, timestamp } = this.signPayload(payload, webhookConfig.secret);

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': timestamp.toString(),
      'X-Webhook-Event': event,
      'User-Agent': 'Mumei-Service-Webhook/1.0'
    };

    // 尝试发送
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(webhookConfig.url, payload, {
          headers,
          timeout: 30000,
          validateStatus: (status) => status < 500
        });

        // 记录成功日志
        LogDB.createLog({
          userId: webhookConfig.userId,
          endpoint: `webhook:${event}`,
          method: 'POST',
          status: response.status,
          duration: 0,
          ip: null,
          userAgent: null,
          error: null
        });

        return {
          success: true,
          status: response.status,
          attempt
        };
      } catch (error) {
        console.error(`Webhook发送失败 (尝试 ${attempt}/${this.retryAttempts}):`, error.message);
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        } else {
          // 记录失败日志
          LogDB.createLog({
            userId: webhookConfig.userId,
            endpoint: `webhook:${event}`,
            method: 'POST',
            status: 0,
            duration: 0,
            ip: null,
            userAgent: null,
            error: error.message
          });

          return {
            success: false,
            error: error.message,
            attempts: this.retryAttempts
          };
        }
      }
    }
  }

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Webhook事件类型
const WebhookEvents = {
  // 用户相关
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_PLAN_CHANGED: 'user.plan_changed',
  
  // Token相关
  TOKEN_CREATED: 'token.created',
  TOKEN_DELETED: 'token.deleted',
  TOKEN_ROTATED: 'token.rotated',
  
  // 使用配额相关
  QUOTA_THRESHOLD_REACHED: 'quota.threshold_reached',
  QUOTA_EXHAUSTED: 'quota.exhausted',
  
  // 订阅相关
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  
  // API调用相关
  API_CALL_COMPLETED: 'api.call_completed',
  API_ERROR: 'api.error',
  API_RATE_LIMITED: 'api.rate_limited'
};

// Webhook数据库操作
const WebhookDB = {
  // 存储Webhook配置（使用内存存储，生产环境应使用数据库）
  webhooks: new Map(),
  deliveries: [],

  // 创建Webhook
  createWebhook(userId, config) {
    const webhook = {
      id: crypto.randomUUID(),
      userId,
      url: config.url,
      secret: config.secret || new WebhookManager().generateSecret(),
      events: config.events || Object.values(WebhookEvents),
      active: true,
      createdAt: new Date().toISOString(),
      description: config.description || ''
    };
    
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  },

  // 获取用户的Webhooks
  getUserWebhooks(userId) {
    return Array.from(this.webhooks.values())
      .filter(w => w.userId === userId)
      .map(w => ({
        id: w.id,
        url: w.url,
        events: w.events,
        active: w.active,
        createdAt: w.createdAt,
        description: w.description
      }));
  },

  // 获取单个Webhook
  getWebhook(webhookId, userId) {
    const webhook = this.webhooks.get(webhookId);
    if (webhook && webhook.userId === userId) {
      return webhook;
    }
    return null;
  },

  // 更新Webhook
  updateWebhook(webhookId, userId, updates) {
    const webhook = this.webhooks.get(webhookId);
    if (webhook && webhook.userId === userId) {
      Object.assign(webhook, updates);
      return webhook;
    }
    return null;
  },

  // 删除Webhook
  deleteWebhook(webhookId, userId) {
    const webhook = this.webhooks.get(webhookId);
    if (webhook && webhook.userId === userId) {
      this.webhooks.delete(webhookId);
      return true;
    }
    return false;
  },

  // 记录Webhook投递
  logDelivery(webhookId, event, payload, response) {
    this.deliveries.push({
      id: crypto.randomUUID(),
      webhookId,
      event,
      payload,
      response,
      timestamp: new Date().toISOString()
    });
    
    // 只保留最近1000条记录
    if (this.deliveries.length > 1000) {
      this.deliveries = this.deliveries.slice(-1000);
    }
  },

  // 获取投递记录
  getDeliveries(webhookId, limit = 50) {
    return this.deliveries
      .filter(d => d.webhookId === webhookId)
      .slice(-limit)
      .reverse();
  }
};

// Webhook触发器
class WebhookTrigger {
  constructor() {
    this.manager = new WebhookManager();
  }

  // 触发Webhooks
  async trigger(userId, event, data) {
    const webhooks = WebhookDB.getUserWebhooks(userId)
      .filter(w => w.active && w.events.includes(event));

    const results = [];
    
    for (const webhook of webhooks) {
      const fullConfig = WebhookDB.getWebhook(webhook.id, userId);
      if (fullConfig) {
        const result = await this.manager.sendWebhook(fullConfig, event, data);
        WebhookDB.logDelivery(webhook.id, event, data, result);
        results.push({ webhookId: webhook.id, ...result });
      }
    }

    return results;
  }

  // 批量触发（用于系统级事件）
  async triggerAll(event, data, filter = null) {
    const allWebhooks = Array.from(WebhookDB.webhooks.values())
      .filter(w => w.active && w.events.includes(event));

    const results = [];
    
    for (const webhook of allWebhooks) {
      if (filter && !filter(webhook)) continue;
      
      const result = await this.manager.sendWebhook(webhook, event, data);
      WebhookDB.logDelivery(webhook.id, event, data, result);
      results.push({ webhookId: webhook.id, ...result });
    }

    return results;
  }
}

module.exports = {
  WebhookManager,
  WebhookEvents,
  WebhookDB,
  WebhookTrigger
};

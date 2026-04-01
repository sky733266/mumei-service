/**
 * 订单管理模块
 * 记录所有支付订单，用于追踪和升级用户套餐
 */

const db = require('./db-sqljs');

class OrderDB {
  /**
   * 初始化订单表
   */
  static async init() {
    const sql = `
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        planId TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'CNY',
        method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        paymentId TEXT,
        outTradeNo TEXT UNIQUE,
        createdAt TEXT,
        completedAt TEXT,
        metadata TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_paymentId ON orders(paymentId);
    `;
    
    try {
      await db.exec(sql);
      console.log('✅ 订单表已初始化');
    } catch (error) {
      console.error('❌ 订单表初始化失败:', error);
    }
  }

  /**
   * 创建订单
   */
  static async createOrder(userId, planId, amount, method, outTradeNo) {
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const sql = `
      INSERT INTO orders (id, userId, planId, amount, method, outTradeNo, createdAt, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `;
    
    try {
      await db.run(sql, [
        orderId,
        userId,
        planId,
        amount,
        method,
        outTradeNo,
        new Date().toISOString()
      ]);
      
      return { success: true, orderId };
    } catch (error) {
      console.error('创建订单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取订单
   */
  static async getOrder(orderId) {
    const sql = 'SELECT * FROM orders WHERE id = ?';
    
    try {
      const result = await db.get(sql, [orderId]);
      return result;
    } catch (error) {
      console.error('获取订单失败:', error);
      return null;
    }
  }

  /**
   * 根据外部交易号获取订单
   */
  static async getOrderByOutTradeNo(outTradeNo) {
    const sql = 'SELECT * FROM orders WHERE outTradeNo = ?';
    
    try {
      const result = await db.get(sql, [outTradeNo]);
      return result;
    } catch (error) {
      console.error('获取订单失败:', error);
      return null;
    }
  }

  /**
   * 根据支付ID获取订单
   */
  static async getOrderByPaymentId(paymentId) {
    const sql = 'SELECT * FROM orders WHERE paymentId = ?';
    
    try {
      const result = await db.get(sql, [paymentId]);
      return result;
    } catch (error) {
      console.error('获取订单失败:', error);
      return null;
    }
  }

  /**
   * 完成订单（支付成功）
   */
  static async completeOrder(orderId, paymentId) {
    const sql = `
      UPDATE orders 
      SET status = 'completed', paymentId = ?, completedAt = ?
      WHERE id = ?
    `;
    
    try {
      await db.run(sql, [paymentId, new Date().toISOString(), orderId]);
      
      // 获取订单信息
      const order = await this.getOrder(orderId);
      
      // 升级用户套餐
      if (order) {
        const UserDB = require('./db-sqljs').UserDB;
        await UserDB.updateUserPlan(order.userId, order.planId);
        console.log(`✅ 用户 ${order.userId} 套餐已升级为 ${order.planId}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('完成订单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取消订单
   */
  static async cancelOrder(orderId, reason) {
    const sql = `
      UPDATE orders 
      SET status = 'cancelled', metadata = ?
      WHERE id = ?
    `;
    
    try {
      await db.run(sql, [JSON.stringify({ reason }), orderId]);
      return { success: true };
    } catch (error) {
      console.error('取消订单失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户订单列表
   */
  static async getUserOrders(userId, limit = 10) {
    const sql = `
      SELECT * FROM orders 
      WHERE userId = ? 
      ORDER BY createdAt DESC 
      LIMIT ?
    `;
    
    try {
      const results = await db.all(sql, [userId, limit]);
      return results || [];
    } catch (error) {
      console.error('获取用户订单失败:', error);
      return [];
    }
  }

  /**
   * 获取订单统计
   */
  static async getOrderStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as totalRevenue
      FROM orders
    `;
    
    try {
      const result = await db.get(sql, []);
      return result || { total: 0, completed: 0, pending: 0, totalRevenue: 0 };
    } catch (error) {
      console.error('获取订单统计失败:', error);
      return { total: 0, completed: 0, pending: 0, totalRevenue: 0 };
    }
  }
}

module.exports = OrderDB;

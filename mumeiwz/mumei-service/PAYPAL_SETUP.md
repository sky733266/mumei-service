# PayPal 支付集成指南

## ✅ 配置完成

你的 PayPal 已成功配置到沐美服务！

### 配置信息

```
Client ID: AfWMmGTM2NxIIiOKITans_eonOAzYrwGTZnDlUeGfZSClebrPL3AL_UUTpPbwQCGOpq1_k-T6vcU-8aq
Secret Key: EFvgXPg5ibHFSoRFa-eEh4o8Ro1Yb3A7Amk1DpFI8_qQsnQpRMvClAvDXbZPu9PYI2gQuJmMOiU6q9iQ
模式: Sandbox (测试环境)
```

---

## 🧪 测试支付流程

### 第 1 步：访问定价页面

```
http://localhost:3000/pricing
```

### 第 2 步：选择套餐

- 点击 **"选择专业版"** 或 **"选择企业版"**

### 第 3 步：选择支付方式

- 在弹窗中选择 **"PayPal"**
- 点击 **"确认支付"**

### 第 4 步：完成 PayPal 支付

- 会跳转到 PayPal 沙箱环境
- 用沙箱账户登录：
  - **Email**: sb-bxpy750286873@business.example.com
  - **Password**: 5+TkauN)
- 确认支付

### 第 5 步：支付完成

- 支付成功后会返回到你的网站
- 用户套餐会自动升级

---

## 📊 支付方式对比

| 方式 | 状态 | 费率 | 适用 |
|------|------|------|------|
| **Stripe 信用卡** | ✅ 已配置 | 2.9%+$0.3 | 国际用户 |
| **PayPal** | ✅ 已配置 | 3.4%+$0.3 | 全球用户 |
| **易支付(微信/支付宝)** | ⏳ 待配置 | 0.6%-1% | 国内用户 |

---

## 🚀 从测试到正式

### 当你准备上线时：

1. **在 PayPal 后台获取正式 Client ID**
   - 登录 https://developer.paypal.com
   - 切换到 **Live** 标签页
   - 复制正式的 Client ID 和 Secret

2. **更新 .env 文件**
   ```bash
   PAYPAL_CLIENT_ID=你的正式Client_ID
   PAYPAL_CLIENT_SECRET=你的正式Secret
   PAYPAL_MODE=live
   ```

3. **重启服务**
   ```bash
   npm run launch
   ```

4. **测试真实支付**
   - 用真实 PayPal 账户测试
   - 确保收款正常

---

## 💡 常见问题

### Q: 支付后用户套餐没有升级？

A: 需要在 `server.js` 中完成以下逻辑：
- 监听 PayPal 支付完成事件
- 根据订单号查找用户
- 更新用户的 `plan` 字段

### Q: 如何查看支付历史？

A: 需要创建 `orders` 表来记录所有订单：
```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  userId TEXT,
  planId TEXT,
  amount REAL,
  method TEXT,
  status TEXT,
  paymentId TEXT,
  createdAt TEXT
);
```

### Q: 支付失败怎么办？

A: 检查以下几点：
1. Client ID 和 Secret 是否正确
2. 网络连接是否正常
3. PayPal 账户是否有问题
4. 查看服务器日志

---

## 📝 下一步

1. **测试支付流程** - 确保一切正常
2. **完成订单记录** - 保存支付信息到数据库
3. **配置易支付** - 支持国内微信/支付宝
4. **上线前检查** - 切换到正式环境

---

## 🔗 相关链接

- PayPal 开发者平台: https://developer.paypal.com
- PayPal 沙箱: https://sandbox.paypal.com
- 支付 API 文档: `/api/payments/*`


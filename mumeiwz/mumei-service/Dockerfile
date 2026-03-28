# 沐美服务 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./

# 先安装可选依赖（用于构建原生模块）
RUN npm install --optional

# 再安装生产依赖
RUN npm install --omit=dev

# 复制源代码
COPY . .

# 创建必要目录
RUN mkdir -p data uploads logs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 启动命令
CMD ["node", "server.js"]

FROM node:18-alpine

WORKDIR /app

# 安装系统依赖（用于 bcrypt 等原生模块编译）
RUN apk add --no-cache python3 make g++

# 先复制依赖文件，利用 Docker 缓存层
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源码
COPY src/ ./src/

# 创建上传目录并设置权限
RUN mkdir -p uploads && chmod 755 uploads

# 创建非 root 用户运行应用
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置目录权限
RUN chown -R nodejs:nodejs /app
USER nodejs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["node", "src/app.js"]

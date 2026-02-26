FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制源码
COPY src/ ./src/
COPY .env.example ./.env

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["node", "src/app.js"]

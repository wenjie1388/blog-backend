# Blog Backend - 个人博客后端 API 服务

基于 Node.js + Express + MySQL + Redis 的个人博客后端服务。

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web 框架
- **MySQL** - 数据库
- **Redis** - 缓存
- **JWT** - 身份认证
- **bcryptjs** - 密码加密

## 功能特性

- 用户认证与授权（JWT）
- 文章管理（CRUD）
- 分类与标签管理
- 菜单管理
- 主题配置
- 页面管理
- 文件上传
- 数据统计
- 字典管理

## 环境要求

- Node.js >= 16.0.0
- MySQL >= 5.7
- Redis >= 5.0

## 项目结构

```
blog-backend/
├── src/
│   ├── config/          # 配置文件
│   │   ├── database.js  # MySQL 配置
│   │   └── redis.js     # Redis 配置
│   ├── middleware/      # 中间件
│   │   ├── auth.js      # 认证中间件
│   │   └── validator.js # 参数校验
│   ├── routes/          # 路由
│   │   ├── article/     # 文章相关
│   │   ├── auth/        # 认证相关
│   │   ├── system/      # 系统管理
│   │   ├── upload/      # 文件上传
│   │   └── user/        # 用户管理
│   ├── scripts/         # 脚本
│   │   └── init-db.js   # 数据库初始化
│   ├── utils/           # 工具函数
│   │   ├── jwt.js       # JWT 工具
│   │   └── response.js  # 响应封装
│   └── app.js           # 应用入口
├── .env.example         # 环境变量示例
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
# 或使用 pnpm
pnpm install
```

### 2. 配置环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库和 Redis 连接信息：

```env
# 服务器配置
PORT=3001
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=personal_blog

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# 上传配置
UPLOAD_PATH=uploads
MAX_FILE_SIZE=5242880
```

### 3. 初始化数据库

确保 MySQL 服务已启动，然后执行：

```bash
npm run init-db
```

此命令会：
- 创建数据库（如果不存在）
- 创建所有数据表
- 插入默认管理员账号和示例数据

**默认管理员账号：**
- 用户名：`admin`
- 密码：`admin123`

### 4. 启动服务

开发模式（热重载）：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

服务启动后，访问 http://localhost:3001/api/health 检查运行状态。

## 部署指南

### 方式一：手动部署

#### 1. 服务器环境准备

安装 Node.js 16+、MySQL 5.7+、Redis 5.0+。

#### 2. 上传代码

将项目代码上传到服务器，例如 `/opt/blog-backend`。

#### 3. 安装依赖

```bash
cd /opt/blog-backend
npm install --production
```

#### 4. 配置环境变量

创建 `.env` 文件，配置生产环境参数：

```env
PORT=3001
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=blog_user
DB_PASSWORD=your_strong_password
DB_NAME=personal_blog

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT配置（生产环境务必修改）
JWT_SECRET=your-production-jwt-secret-key
JWT_EXPIRES_IN=7d

# 上传配置
UPLOAD_PATH=uploads
MAX_FILE_SIZE=5242880
```

#### 5. 初始化数据库

```bash
npm run init-db
```

#### 6. 启动服务（三种方式可选）

##### 方式 A：使用 systemd（推荐，无需额外安装）

创建服务文件：

```bash
sudo nano /etc/systemd/system/blog-backend.service
```

写入以下内容：

```ini
[Unit]
Description=Blog Backend API Service
After=network.target mysql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/blog-backend
ExecStart=/usr/bin/node src/app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DB_HOST=localhost
Environment=DB_PORT=3306
Environment=DB_USER=blog_user
Environment=DB_PASSWORD=your_password
Environment=DB_NAME=personal_blog
Environment=REDIS_HOST=localhost
Environment=REDIS_PORT=6379
Environment=JWT_SECRET=your-jwt-secret

[Install]
WantedBy=multi-user.target
```

启动并启用服务：

```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start blog-backend

# 设置开机自启
sudo systemctl enable blog-backend

# 查看状态
sudo systemctl status blog-backend

# 查看日志
sudo journalctl -u blog-backend -f
```

常用命令：

```bash
sudo systemctl start blog-backend    # 启动
sudo systemctl stop blog-backend     # 停止
sudo systemctl restart blog-backend  # 重启
sudo systemctl status blog-backend   # 查看状态
```

##### 方式 B：使用 PM2

安装 PM2：

```bash
npm install -g pm2
```

创建 PM2 配置文件 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'blog-backend',
    script: './src/app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

启动服务：

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

##### 方式 C：直接启动（仅测试使用）

```bash
NODE_ENV=production node src/app.js
```

> ⚠️ 此方式关闭终端后服务会停止，仅用于临时测试。

#### 7. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /opt/blog-backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 方式二：Docker 部署

#### 1. 创建 Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制项目代码
COPY . .

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["node", "src/app.js"]
```

#### 2. 创建 docker-compose.yml

在项目根目录创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  # Node.js 应用服务
  app:
    build: .
    container_name: blog-backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=blog
      - DB_PASSWORD=blog_password
      - DB_NAME=personal_blog
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=
      - JWT_SECRET=your-super-secret-jwt-key
      - JWT_EXPIRES_IN=7d
      - UPLOAD_PATH=uploads
      - MAX_FILE_SIZE=5242880
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    restart: always
    networks:
      - blog-network

  # MySQL 数据库服务
  mysql:
    image: mysql:8.0
    container_name: blog-mysql
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=personal_blog
      - MYSQL_USER=blog
      - MYSQL_PASSWORD=blog_password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/my.cnf:/etc/mysql/conf.d/my.cnf
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10
    restart: always
    networks:
      - blog-network

  # Redis 缓存服务
  redis:
    image: redis:7-alpine
    container_name: blog-redis
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: always
    networks:
      - blog-network

# 数据卷
volumes:
  mysql_data:
  redis_data:

# 网络
networks:
  blog-network:
    driver: bridge
```

#### 3. 创建 MySQL 配置文件

创建 `mysql/my.cnf`：

```ini
[mysqld]
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
default-authentication-plugin=mysql_native_password

# 性能优化
innodb_buffer_pool_size=256M
max_connections=200

# 日志配置
slow_query_log=1
slow_query_log_file=/var/lib/mysql/slow.log
long_query_time=2
```

#### 4. 启动服务
      - "6379:6379"
    restart: always

volumes:
  mysql_data:
  redis_data:
```

#### 4. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app
```

#### 5. 初始化数据库

等待 MySQL 完全启动后，执行：

```bash
docker-compose exec app npm run init-db
```

#### 6. Docker 常用命令

```bash
# 停止服务
docker-compose down

# 停止并删除数据卷（谨慎使用）
docker-compose down -v

# 重启服务
docker-compose restart

# 查看容器日志
docker-compose logs -f [service_name]

# 进入容器
docker-compose exec app sh

# 更新部署
docker-compose pull
docker-compose up -d
```

#### 7. 生产环境优化

##### 使用 .env 文件管理环境变量

创建 `.env` 文件：

```env
# 数据库
MYSQL_ROOT_PASSWORD=your_strong_root_password
MYSQL_DATABASE=personal_blog
MYSQL_USER=blog
MYSQL_PASSWORD=your_strong_password

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this

# 其他配置
NODE_ENV=production
```

修改 `docker-compose.yml` 使用环境变量：

```yaml
services:
  app:
    environment:
      - JWT_SECRET=${JWT_SECRET}
      # ... 其他配置
  
  mysql:
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${MYSQL_DATABASE}
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
```

##### 配置 Nginx 反向代理

当使用 Docker 部署时，Nginx 配置：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        proxy_pass http://127.0.0.1:3001/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

##### 配置自动备份

创建备份脚本 `backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份 MySQL
docker-compose exec -T mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} personal_blog > ${BACKUP_DIR}/blog_${DATE}.sql

# 备份上传文件
tar -czf ${BACKUP_DIR}/uploads_${DATE}.tar.gz ./uploads

# 保留最近 7 天的备份
find ${BACKUP_DIR} -name "*.sql" -mtime +7 -delete
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +7 -delete
```

添加定时任务：

```bash
crontab -e
# 每天凌晨 2 点备份
0 2 * * * /opt/blog-backend/backup.sh
```

## API 接口

### 认证相关

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/profile` - 获取用户信息
- `PUT /api/auth/profile` - 更新用户信息

### 文章相关

- `GET /api/articles` - 获取文章列表
- `GET /api/articles/:id` - 获取文章详情
- `POST /api/articles` - 创建文章（需认证）
- `PUT /api/articles/:id` - 更新文章（需认证）
- `DELETE /api/articles/:id` - 删除文章（需认证）

### 分类相关

- `GET /api/categories` - 获取分类列表
- `POST /api/categories` - 创建分类（需认证）
- `PUT /api/categories/:id` - 更新分类（需认证）
- `DELETE /api/categories/:id` - 删除分类（需认证）

### 标签相关

- `GET /api/tags` - 获取标签列表
- `POST /api/tags` - 创建标签（需认证）
- `PUT /api/tags/:id` - 更新标签（需认证）
- `DELETE /api/tags/:id` - 删除标签（需认证）

### 系统管理

- `GET /api/menus` - 获取菜单列表
- `GET /api/themes` - 获取主题配置
- `GET /api/pages` - 获取页面列表
- `GET /api/dict` - 获取字典数据
- `GET /api/stats` - 获取统计数据

### 文件上传

- `POST /api/upload` - 上传文件

## 部署方式对比

| 特性 | systemd | PM2 | Docker |
|------|---------|-----|--------|
| 安装难度 | ⭐ 简单 | ⭐⭐ 中等 | ⭐⭐ 中等 |
| 自动重启 | ✅ | ✅ | ✅ |
| 开机自启 | ✅ | ✅ | ✅ |
| 日志管理 | 系统日志 | 自带日志 | 容器日志 |
| 资源占用 | 低 | 中 | 较高 |
| 环境隔离 | ❌ | ❌ | ✅ |
| 一键部署 | ❌ | ❌ | ✅ |
| 适合场景 | 单服务器 | 单服务器 | 多环境/集群 |

**选择建议：**
- **新手/单服务器**：使用 **systemd**（无需额外安装，Linux 自带）
- **需要监控面板**：使用 **PM2**
- **需要环境隔离/快速迁移**：使用 **Docker**

## 常用命令

### 开发环境

```bash
# 开发模式启动（热重载）
npm run dev

# 生产模式启动
npm start

# 初始化数据库
npm run init-db
```

### systemd 管理

```bash
# 启动服务
sudo systemctl start blog-backend

# 停止服务
sudo systemctl stop blog-backend

# 重启服务
sudo systemctl restart blog-backend

# 查看状态
sudo systemctl status blog-backend

# 查看日志
sudo journalctl -u blog-backend -f

# 开机自启
sudo systemctl enable blog-backend
```

### PM2 管理

```bash
# 查看 PM2 状态
pm2 status

# 查看日志
pm2 logs blog-backend

# 重启服务
pm2 restart blog-backend

# 停止服务
pm2 stop blog-backend

# 保存配置
pm2 save

# 开机自启
pm2 startup
```

### Docker 管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f app

# 重启服务
docker-compose restart

# 进入容器
docker-compose exec app sh
```

## 注意事项

1. **生产环境安全**
   - 务必修改 JWT_SECRET
   - 使用强密码
   - 配置防火墙，只开放必要端口
   - 启用 HTTPS

2. **数据库备份**
   - 定期备份 MySQL 数据
   - 可以使用 `mysqldump` 命令备份

3. **文件上传**
   - 上传的文件保存在 `uploads` 目录
   - 生产环境建议配置 CDN 或对象存储

4. **日志管理**
   - 日志文件保存在 `logs` 目录
   - 建议配置日志轮转，防止磁盘占满

## 许可证

[Apache-2.0](LICENSE)

Copyright (c) 2026 wenjie1388

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

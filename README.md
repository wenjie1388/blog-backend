# 博客后端 API 服务

基于 Node.js + Express + MySQL + Redis 构建的 RESTful API 服务。

## 技术栈

- **运行环境**: Node.js
- **Web 框架**: Express
- **数据库**: MySQL 8.0 (使用 mysql2 驱动)
- **缓存**: Redis
- **认证**: JWT (jsonwebtoken)
- **密码加密**: bcryptjs
- **文件上传**: Multer
- **参数验证**: express-validator
- **安全**: Helmet
- **日志**: Morgan

## 功能模块

### 认证授权
- 🔐 JWT Token 认证
- 🔑 用户登录/注册
- 🛡️ 密码加密存储

### 内容管理
- 📝 文章 CRUD
- 📁 分类管理
- 📄 独立页面管理

### 系统管理
- 👤 用户管理
- 🎨 主题配置
- 📋 菜单管理
- 📚 字典管理
- ⚙️ 系统设置

### 文件服务
- 📤 文件上传
- 🖼️ 图片处理

## 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

复制 `.env.example` 为 `.env` 并配置：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=blog

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
```

### 初始化数据库

```bash
npm run init-db
```

### 开发环境运行

```bash
npm run dev
```

### 生产环境运行

```bash
npm start
```

## 项目结构

```
src/
├── app.js              # 应用入口
├── config/             # 配置文件
│   └── database.js     # 数据库连接
├── controllers/        # 控制器层
│   ├── article.js
│   ├── auth.js
│   ├── category.js
│   ├── dict.js
│   ├── menu.js
│   ├── page.js
│   ├── setting.js
│   ├── theme.js
│   └── user.js
├── middleware/         # 中间件
│   ├── auth.js         # 认证中间件
│   ├── error.js        # 错误处理
│   └── upload.js       # 文件上传
├── routes/             # 路由层
│   ├── index.js        # 路由聚合
│   └── modules/        # 模块路由
├── services/           # 服务层（业务逻辑）
│   └── *.js
├── utils/              # 工具函数
│   └── response.js     # 统一响应格式
└── scripts/            # 脚本工具
    └── init-db.js      # 数据库初始化
```

## API 响应格式

统一响应结构：

```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "code": 200
}
```

## 主要接口

### 认证
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/change-password` - 修改密码

### 文章
- `GET /api/articles` - 文章列表
- `GET /api/articles/:id` - 文章详情
- `POST /api/articles` - 创建文章
- `PUT /api/articles/:id` - 更新文章
- `DELETE /api/articles/:id` - 删除文章

### 分类
- `GET /api/categories` - 分类列表
- `POST /api/categories` - 创建分类
- `PUT /api/categories/:id` - 更新分类
- `DELETE /api/categories/:id` - 删除分类

### 系统
- `GET /api/settings` - 获取设置
- `PUT /api/settings` - 更新设置
- `GET /api/menus` - 菜单列表
- `GET /api/dict-types` - 字典类型
- `GET /api/dict-data` - 字典数据

## Docker 部署

```bash
docker build -t blog-backend .
docker run -p 3000:3000 --env-file .env blog-backend
```

## 数据库初始化

项目使用 MySQL 数据库，运行以下命令初始化表结构：

```bash
npm run init-db
```

该脚本会自动创建：
- 用户表 (users)
- 文章表 (articles)
- 分类表 (categories)
- 页面表 (pages)
- 菜单表 (menus)
- 字典类型表 (dict_types)
- 字典数据表 (dict_data)
- 主题表 (themes)
- 设置表 (settings)

# Homework AI - 快速启动指南

## 一、前置条件检查

### 1.1 必需软件

| 软件 | 版本要求 | 检查命令 |
|------|---------|---------|
| Node.js | 18+ | `node -v` |
| pnpm | 8+ | `pnpm -v` |
| Docker Desktop | 最新版 | `docker -v` |
| Git | - | `git --version` |

### 1.2 启动前检查清单

```bash
# 1. 确保 Docker Desktop 正在运行
docker version

# 2. 检查端口是否被占用（3000, 3001, 3306, 6379, 9000, 9001）
netstat -ano | findstr ":3000"
netstat -ano | findstr ":3001"

# 3. 确保已安装依赖
pnpm install
```

---

## 二、快速启动（推荐方式）

### 方式一：使用批处理脚本（最简单）

```bash
# Windows: 双击运行或在项目根目录执行
start-services.bat

# 如果 Docker 已在外部运行，跳过 Docker 启动
start-services.bat --skip-docker
```

### 方式二：使用 PowerShell（功能更强）

```bash
# 项目根目录执行
pnpm restart
# 或
powershell -ExecutionPolicy Bypass -File ./restart-services.ps1
```

### 方式三：手动启动（适合调试）

```bash
# 1. 启动 Docker 基础服务（新终端窗口）
cd deploy
docker-compose up -d

# 2. 生成 Prisma 客户端
cd ../apps/backend
pnpm prisma:generate

# 3. 启动后端 API（新终端窗口）
pnpm start:dev

# 4. 启动 Worker（新终端窗口）
pnpm start:worker:dev

# 5. 启动前端（新终端窗口）
cd ../frontend
pnpm dev
```

---

## 三、首次启动配置

### 3.1 复制环境变量文件

```bash
# 复制示例配置
cp apps/backend/.env.example apps/backend/.env
```

### 3.2 配置必填的 API 密钥

编辑 `apps/backend/.env`，填写以下必填项：

```env
# 百度 OCR（必需）
BAIDU_OCR_API_KEY=你的百度OCR_API_KEY
BAIDU_OCR_SECRET_KEY=你的百度OCR_SECRET_KEY

# DeepSeek LLM（必需）
LLM_API_KEY=你的DeepSeek_API_KEY

# 重要配置建议
LLM_MAX_TOKENS=2000    # 建议设为 2000 或更高，防止 JSON 响应被截断
```

**获取 API 密钥：**
- 百度 OCR: https://cloud.baidu.com/product/ocr/general
- DeepSeek: https://platform.deepseek.com

---

## 四、服务访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端页面 | http://localhost:3001/ | 开发环境直接访问 |
| 后端 API | http://localhost:3000/api/ | API 接口 |
| MinIO 控制台 | http://localhost:9001 | 文件管理界面 |

**默认测试账号（密码: Test1234）：**
- 管理员: `admin`
- 教师: `teacher01`
- 学生: `student01`

---

## 五、常见问题及解决方案

### 5.1 提交一直处于 QUEUED 状态

**原因：** Worker 进程未运行

**解决：**
```bash
# 检查 Worker 是否启动
# 在启动 Worker 的终端窗口确认有输出

# 或手动启动
cd apps/backend
pnpm start:worker:dev
```

### 5.2 页面无限刷新 / 502 错误

**原因：** 后端服务未启动或端口配置不匹配

**解决：**
```bash
# 1. 检查后端是否启动
netstat -ano | findstr ":3000"

# 2. 检查前端是否启动
netstat -ano | findstr ":3001"

# 3. 运行端口同步脚本
scripts/check-ports.bat
```

### 5.3 LLM_MAX_TOKENS 错误 / MAX_RETRIES_EXCEEDED

**原因：** Token 限制太小，导致 JSON 响应被截断

**解决：**
```bash
# 编辑 apps/backend/.env
LLM_MAX_TOKENS=2000    # 改为 2000 或更高
```

### 5.4 端口被占用

**错误信息：** `Error: listen EADDRINUSE: address already in use :::3000`

**解决：**
```bash
# Windows: 查找并终止占用端口的进程
netstat -ano | findstr ":3000"
taskkill /F /PID <进程ID>

# 或使用脚本自动清理（启动脚本会自动执行）
```

### 5.5 Docker 服务启动失败

**原因：** Docker Desktop 未运行

**解决：**
```bash
# 1. 启动 Docker Desktop
# 2. 等待 Docker 完全启动
# 3. 重新运行启动脚本

# 或跳过 Docker 启动（如 Docker 已在外部运行）
start-services.bat --skip-docker
```

### 5.6 Prisma 客户端生成失败

**错误信息：** `Error: P3018` 或相关 Prisma 错误

**解决：**
```bash
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate dev  # 如需要，运行迁移
```

### 5.7 百度 OCR / DeepSeek API 调用失败

**原因：** API 密钥未配置或无效

**解决：**
1. 检查 `apps/backend/.env` 中密钥是否正确填写
2. 确认 API 密钥有效且有余额
3. 查看后端日志中的详细错误信息

### 5.8 数据库连接失败

**错误信息：** `Can't reach database server`

**解决：**
```bash
# 检查 Docker MySQL 容器是否运行
docker ps | findstr mysql

# 重启 Docker 服务
cd deploy
docker-compose restart mysql
```

---

## 六、启动流程说明

```
启动顺序：
1. Docker 服务 → 2. 生成 Prisma → 3. 后端 API → 4. Worker → 5. 前端

检查清单：
□ Docker Desktop 运行中
□ .env 文件已配置 API 密钥
□ 依赖已安装 (pnpm install)
□ 端口 3000, 3001 未被占用
```

---

## 七、开发命令速查

```bash
# 根目录命令
pnpm dev:frontend    # 启动前端
pnpm dev:backend     # 启动后端 API
pnpm dev:worker      # 启动 Worker
pnpm build           # 构建所有应用
pnpm lint            # 代码检查
pnpm test            # 运行测试

# 单独启动某个服务
cd apps/backend
pnpm start:dev       # 后端 API
pnpm start:worker:dev  # Worker

cd apps/frontend
pnpm dev             # 前端
```

---

## 八、停止服务

```bash
# 停止 Node.js 服务（关闭对应的终端窗口）

# 停止 Docker 服务
cd deploy
docker-compose down

# 完全清理（包括数据卷）
docker-compose down -v
```

---

## 九、故障排查流程

1. **确认服务状态**
   ```bash
   netstat -ano | findstr "3000 3001"
   docker ps
   ```

2. **查看日志**
   - 后端: 查看后端终端窗口输出
   - Worker: 查看 Worker 终端窗口输出
   - Docker: `docker logs <container_name>`

3. **重启服务**
   ```bash
   # 关闭所有服务窗口
   # 重新运行启动脚本
   start-services.bat
   ```

---

## 十、文件结构

```
work/
├── start-services.bat      # Windows 快速启动脚本
├── restart-services.ps1    # PowerShell 启动脚本
├── scripts/
│   └── check-ports.bat     # 端口配置同步脚本
├── deploy/
│   ├── docker-compose.yml  # Docker 服务编排
│   └── nginx/
│       └── nginx.conf      # Nginx 配置
├── apps/
│   ├── backend/
│   │   ├── .env.example    # 环境变量示例
│   │   └── .env            # 实际环境变量（需创建）
│   └── frontend/
```

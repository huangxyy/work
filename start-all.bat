@echo off
REM Homework AI - 一键启动所有服务

setlocal EnableDelayedExpansion

echo ========================================
echo   Homework AI - 启动所有服务
echo ========================================
echo.

REM 1. 启动 Docker 服务
echo [1/5] 启动 Docker 服务 (MySQL, Redis, MinIO, Nginx)...
cd /d "%~dp0deploy"
docker-compose up -d
if %errorlevel% neq 0 (
    echo 错误: Docker 服务启动失败
    pause
    exit /b 1
)
echo Docker 服务已启动
echo.

REM 2. 生成 Prisma 客户端
echo [2/5] 生成 Prisma 客户端...
cd /d "%~dp0apps\backend"
call pnpm prisma:generate
if %errorlevel% neq 0 (
    echo 错误: Prisma 客户端生成失败
    pause
    exit /b 1
)
echo Prisma 客户端已生成
echo.

REM 3. 启动后端 API 服务器
echo [3/5] 启动后端 API 服务器...
start "Homework AI - API Server" cmd /k "cd /d "%~dp0apps\backend" && pnpm start:dev"
echo API 服务器正在后台启动...
echo.

REM 4. 启动 Worker 进程
echo [4/5] 启动 Worker 进程...
start "Homework AI - Worker" cmd /k "cd /d "%~dp0apps\backend" && pnpm start:worker:dev"
echo Worker 正在后台启动...
echo.

REM 5. 启动前端
echo [5/5] 启动前端开发服务器...
start "Homework AI - Frontend" cmd /k "cd /d "%~dp0apps\frontend" && pnpm dev"
echo 前端正在后台启动...
echo.

REM 等待服务启动
echo 等待服务启动...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   所有服务已启动！
echo ========================================
echo.
echo   前端: http://localhost/
echo   API:  http://localhost/api/
echo   MinIO: http://localhost:9001
echo.
echo   默认测试账号:
echo   - 管理员: admin / Test1234
echo   - 教师:   teacher01 / Test1234
echo   - 学生:   student01 / Test1234
echo.
echo 按任意键关闭此窗口...
pause >nul

@echo off
REM ====================================================================
REM Homework AI - 服务启动脚本 (Windows)
REM 解决问题:
REM 1. 页面无限刷新 - 修复 HMR 配置
REM 2. 端口占用 - 自动清理
REM 3. Nginx 问题 - 提供跳过选项
REM ====================================================================

setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

echo.
echo ========================================
echo   Homework AI - 服务启动脚本
echo ========================================
echo.

REM 配置
set "BACKEND_PORT=3000"
set "FRONTEND_PORT=3001"
set "SKIP_DOCKER=false"

REM 解析参数
if "%~1"=="--no-docker" set "SKIP_DOCKER=true"
if "%~1"=="--skip-docker" set "SKIP_DOCKER=true"

REM ====================================================================
REM 函数定义
REM ====================================================================

:KillProcessByPort
set "PORT=%~1"
set "NAME=%~2"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTENING" 2^>nul') do (
    set "PID=%%a"
    if not "!PID!"=="" (
        echo   [停止] !NAME! (PID: !PID!)
        taskkill /F /PID !PID! >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)
exit /b 0

:WaitForPort
set "PORT=%~1"
set "NAME=%~2"
set /a "COUNT=0"
set /a "MAX_WAIT=30"

:WaitLoop
timeout /t 1 /nobreak >nul
set /a "COUNT+=1"

netstat -ano | findstr ":%PORT%.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [就绪] !NAME! 端口 %PORT% 已启动
    exit /b 0
)

if !COUNT! geq %MAX_WAIT% (
    echo   [警告] !NAME! 启动超时
    exit /b 1
)

goto WaitLoop

REM ====================================================================
REM 主流程
REM ====================================================================

REM 步骤 1: 清理端口
echo [1/6] 清理已占用的端口...
call :KillProcessByPort %BACKEND_PORT% "后端服务"
call :KillProcessByPort %FRONTEND_PORT% "前端服务"
echo   [完成] 端口清理完成
echo.

REM 步骤 2: 启动 Docker 服务
if "%SKIP_DOCKER%"=="false" (
    echo [2/6] 启动 Docker 服务 (MySQL, Redis, MinIO)...
    cd /d "%~dp0deploy"

    REM 检查 docker 是否运行
    docker version >nul 2>&1
    if %errorlevel% neq 0 (
        echo   [警告] Docker 未运行，跳过 Docker 服务启动
        echo   [提示] 请手动启动 Docker Desktop，或使用 --skip-docker 参数
    ) else (
        docker-compose up -d
        if %errorlevel% neq 0 (
            echo   [错误] Docker 服务启动失败
        ) else (
            echo   [成功] Docker 服务已启动
        )
    )
) else (
    echo [2/6] 跳过 Docker 服务启动 (--skip-docker)
)
echo.

REM 步骤 3: 生成 Prisma 客户端
echo [3/6] 生成 Prisma 客户端...
cd /d "%~dp0apps\backend"
call pnpm prisma:generate
if %errorlevel% neq 0 (
    echo   [错误] Prisma 客户端生成失败
) else (
    echo   [成功] Prisma 客户端已生成
)
echo.

REM 步骤 4: 启动后端 API
echo [4/6] 启动后端 API 服务...
start "Homework AI - Backend API" cmd /k "title Homework AI - Backend API && cd /d "%~dp0apps\backend" && echo 正在启动后端 API... && pnpm start:dev"
echo   [启动中] 后端 API 端口 %BACKEND_PORT%
call :WaitForPort %BACKEND_PORT% "后端 API"
echo.

REM 步骤 5: 启动 Worker
echo [5/6] 启动 Worker 进程...
start "Homework AI - Worker" cmd /k "title Homework AI - Worker && cd /d "%~dp0apps\backend" && echo 正在启动 Worker... && pnpm start:worker:dev"
echo   [启动中] Worker 进程
timeout /t 3 /nobreak >nul
echo   [成功] Worker 已启动
echo.

REM 步骤 6: 启动前端
echo [6/7] 启动前端开发服务...
start "Homework AI - Frontend" cmd /k "title Homework AI - Frontend && cd /d "%~dp0apps\frontend" && echo 正在启动前端服务... && pnpm dev"
echo   [启动中] 前端服务 端口 %FRONTEND_PORT%
call :WaitForPort %FRONTEND_PORT% "前端服务"
echo.

REM ====================================================================
REM 步骤 7: 同步 nginx 端口配置
REM ====================================================================
echo [7/7] 检测并同步 nginx 端口配置...
call "%~dp0scripts\check-ports.bat"
echo.

REM ====================================================================
REM 完成信息
REM ====================================================================
echo.
echo ========================================
echo   所有服务已启动完成！
echo ========================================
echo.
echo   服务地址:
echo   ┌─────────────────────────────────────────┐
echo   │  前端:    http://localhost:%FRONTEND_PORT%/        │
echo   │  API:     http://localhost:%BACKEND_PORT%/api/    │
echo   │  MinIO:   http://localhost:9001            │
echo   └─────────────────────────────────────────┘
echo.
echo   默认测试账号:
echo   ┌─────────────────────────────────────────┐
echo   │  管理员: admin     / Test1234            │
echo   │  教师:   teacher01 / Test1234            │
echo   │  学生:   student01 / Test1234            │
echo   └─────────────────────────────────────────┘
echo.
echo   提示:
echo   - 服务窗口已在后台运行
echo   - 关闭窗口即可停止对应服务
echo   - 如遇页面刷新问题，请检查 HMR 配置
echo.
echo ========================================
pause

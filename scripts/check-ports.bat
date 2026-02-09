@echo off
REM 检测并修复 Nginx 代理端口与 Vite 开发服务器端口不匹配的问题
REM 增强版：检测 Vite 实际运行的端口，而不是仅读取配置文件

setlocal EnableDelayedExpansion
set "WORK_DIR=%~dp0.."
set "NGINX_CONF=%WORK_DIR%\deploy\nginx\nginx.conf"

echo ========================================
echo   Nginx 端口自动检测与同步工具
echo ========================================
echo.

REM 步骤 1: 从 nginx 配置中获取当前代理端口
echo [1/4] 检测 nginx 配置的代理端口...
for /f "tokens=2 delims=:" %%a in ('findstr /C:"server host.docker.internal:" "%NGINX_CONF%" 2^>nul') do (
    set "LINE=%%a"
    set "LINE=!LINE: =!"
    for /f "tokens=1" %%b in ("!LINE!") do set "NGINX_PORT=%%b"
)
echo   Nginx 配置端口: %NGINX_PORT%
echo.

REM 步骤 2: 检查 Vite 配置文件的期望端口
echo [2/4] 检测 Vite 配置文件...
set "VITE_CONFIG=%WORK_DIR%\apps\frontend\vite.config.ts"
set "CONFIG_PORT=3001"

if exist "%VITE_CONFIG%" (
    for /f "tokens=2 delims=: " %%a in ('findstr /C:"port:" "%VITE_CONFIG%" 2^>nul ^| findstr /C:"server"') do (
        set "TEMP=%%a"
        set "TEMP=!TEMP:,=!"
        set "TEMP=!TEMP: =!"
        if "!TEMP!" neq "" set "CONFIG_PORT=!TEMP!"
    )
)
echo   Vite 配置端口: %CONFIG_PORT%
echo.

REM 步骤 3: 检测 Vite 实际运行的端口
echo [3/4] 检测 Vite 实际运行端口...
set "ACTUAL_PORT="

REM 首先检查配置端口是否在运行
netstat -ano | findstr ":%CONFIG_PORT%.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    set "ACTUAL_PORT=%CONFIG_PORT%"
    echo   检测到 Vite 运行在配置端口: %ACTUAL_PORT%
) else (
    REM 配置端口未运行，扫描可能的 Vite 端口 (3001-3010)
    echo   配置端口 %CONFIG_PORT% 未运行，扫描中...
    for /l %%i in (3001,1,3010) do (
        netstat -ano | findstr ":%%i .*LISTENING" >nul 2>&1
        if !errorlevel! equ 0 (
            REM 检查该端口是否是 node.exe 进程（Vite）
            for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%%i .*LISTENING" 2^>nul') do (
                tasklist /FI "PID eq %%p" /FI "IMAGENAME eq node.exe" 2>nul | findstr "node.exe" >nul
                if !errorlevel! equ 0 (
                    set "ACTUAL_PORT=%%i"
                    echo   检测到 Vite 运行在端口: !ACTUAL_PORT!
                    goto :port_found
                )
            )
        )
    )
    :port_found
)

if "%ACTUAL_PORT%"=="" (
    echo   [警告] 未检测到运行中的 Vite 服务
    echo   [提示] 请先启动前端服务: pnpm dev:frontend
    echo.
    pause
    exit /b 1
)
echo.

REM 步骤 4: 比较并更新 nginx 配置
echo [4/4] 同步 nginx 配置...
if not "%ACTUAL_PORT%" == "%NGINX_PORT%" (
    echo   检测到端口不匹配！
    echo   nginx 配置: %NGINX_PORT% -^> 实际运行: %ACTUAL_PORT%
    echo.
    echo   正在更新 nginx 配置...
    powershell -Command "$content = Get-Content '%NGINX_CONF%'; $content = $content -replace 'server host\.docker\.internal:%NGINX_PORT%', 'server host.docker.internal:%ACTUAL_PORT%'; Set-Content '%NGINX_CONF%' $content"
    echo   正在重启 nginx...
    cd "%WORK_DIR%\deploy"
    docker-compose restart nginx >nul 2>&1
    echo.
    echo   ========================================
    echo   [完成] nginx 配置已同步！
    echo   ========================================
    echo.
    echo   前端地址: http://localhost
    echo   实际端口: %ACTUAL_PORT%
    echo.
) else (
    echo   端口配置已同步，无需修改。
    echo   前端地址: http://localhost (端口 %ACTUAL_PORT%)
)

echo ========================================
pause

@echo off
REM 检测并修复 Nginx 代理端口与 Vite 开发服务器端口不匹配的问题

setlocal EnableDelayedExpansion
set "WORK_DIR=%~dp0.."
set "NGINX_CONF=%WORK_DIR%\deploy\nginx\nginx.conf"

echo 检查端口配置...

REM 从 nginx 配置中获取当前代理端口
for /f "tokens=2 delims=:" %%a in ('findstr /C:"proxy_pass http://host.docker.internal:" "%NGINX_CONF%"') do (
    set "LINE=%%a"
    set "NGINX_PORT=!LINE:~0,4!"
)

echo Nginx 代理端口: %NGINX_PORT%

REM 检查 Vite 配置文件
set "VITE_CONFIG=%WORK_DIR%\apps\frontend\vite.config.ts"
set "ACTUAL_PORT=3001"

if exist "%VITE_CONFIG%" (
    findstr /C:"server: { port:" "%VITE_CONFIG%" >nul && (
        for /f "tokens=2 delims=: " %%a in ('findstr /C:"server: { port:" "%VITE_CONFIG%"') do (
            set "ACTUAL_PORT=%%a"
            set "ACTUAL_PORT=!ACTUAL_PORT:,=!"
        )
    )
)

echo Vite 配置端口: %ACTUAL_PORT%

if not "%ACTUAL_PORT%" == "%NGINX_PORT%" (
    echo 检测到端口不匹配！正在修复...
    powershell -Command "(Get-Content '%NGINX_CONF%') -replace 'proxy_pass http://host.docker.internal:%NGINX_PORT%', 'proxy_pass http://host.docker.internal:%ACTUAL_PORT%' | Set-Content '%NGINX_CONF%'"
    echo 已更新 nginx 配置，正在重启 nginx...
    cd "%WORK_DIR%\deploy"
    docker-compose restart nginx
    echo 修复完成！
) else (
    echo 端口配置正确，无需修改。
)

pause

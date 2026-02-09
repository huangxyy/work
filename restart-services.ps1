# ====================================================================
# Homework AI - 服务重启脚本 (PowerShell)
# 解决问题:
# 1. 页面无限刷新 - HMR 配置已修复
# 2. 端口占用 - 自动清理
# 3. Nginx 问题 - 提供跳过选项
# ====================================================================

# 设置输出编码为 UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 端口配置
$BACKEND_PORT = 3000
$FRONTEND_PORT = 3001

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [ConsoleColor]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Step {
    param([string]$Msg)
    Write-ColorOutput "`n=== $Msg ===" "Cyan"
}

function Write-Success {
    param([string]$Msg)
    Write-ColorOutput "[OK] $Msg" "Green"
}

function Write-Warn {
    param([string]$Msg)
    Write-ColorOutput "[WARN] $Msg" "Yellow"
}

function Write-Error {
    param([string]$Msg)
    Write-ColorOutput "[ERROR] $Msg" "Red"
}

# 检查并杀掉占用指定端口的进程
function Clear-Port {
    param(
        [int]$Port,
        [string]$Description
    )

    Write-Step "检查 $Description 端口 $Port"

    $listening = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
                  Where-Object { $_.State -eq "Listen" }

    if ($listening) {
        foreach ($conn in $listening) {
            $pid = $conn.OwningProcess
            try {
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Warn "发现端口占用: $Description ($Port) 被 PID $pid ($($process.ProcessName)) 占用"
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    Write-Success "已终止进程 PID $pid"
                    Start-Sleep -Milliseconds 500
                }
            } catch {
                Write-Warn "无法终止进程 PID $pid"
            }
        }
    } else {
        Write-Success "$Description 端口 $Port 可用"
    }
}

# 检查 nginx 进程
function Check-Nginx {
    Write-Step "检查 Nginx 进程"

    $nginxProcesses = Get-Process -Name nginx -ErrorAction SilentlyContinue
    if ($nginxProcesses) {
        Write-Warn "发现 Nginx 进程正在运行"
        $nginxProcesses | ForEach-Object {
            Write-Output "  - PID $($_.Id)"
        }

        $response = Read-Host "是否停止 Nginx 进程? (y/N)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            $nginxProcesses | Stop-Process -Force
            Write-Success "已停止 Nginx 进程"
        } else {
            Write-Warn "保留 Nginx 进程运行"
            Write-Warn "注意: 如果通过 Nginx 访问，确保 HMR 配置正确"
        }
    } else {
        Write-Success "未发现 Nginx 进程"
    }
}

# 获取前端实际运行的端口
function Get-FrontendPort {
    param(
        [int]$StartPort = 3001,
        [int]$EndPort = 3100
    )

    # Vite 默认从 3001 开始尝试，向上递增
    for ($port = $StartPort; $port -le $EndPort; $port++) {
        $listening = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
                      Where-Object { $_.State -eq "Listen" }
        if ($listening) {
            # 检查是否是 Node.js 进程（Vite）
            foreach ($conn in $listening) {
                $pid = $conn.OwningProcess
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($process -and $process.ProcessName -eq "node") {
                    return $port
                }
            }
        }
    }
    return $null
}

# 获取 nginx 配置中的前端端口
function Get-NginxFrontendPort {
    $nginxConf = "deploy\nginx\nginx.conf"
    if (-not (Test-Path $nginxConf)) {
        return $null
    }

    $content = Get-Content $nginxConf -Raw -Encoding UTF8
    if ($content -match 'upstream frontend\s*\{[^}]*server\s+host\.docker\.internal:(\d+)') {
        return [int]$matches[1]
    }
    return $null
}

# 更新 nginx 配置中的前端端口
function Update-NginxFrontendPort {
    param([int]$Port)

    $nginxConf = "deploy\nginx\nginx.conf"
    if (-not (Test-Path $nginxConf)) {
        Write-Warn "nginx 配置文件不存在: $nginxConf"
        return $false
    }

    # 读取配置文件
    $content = Get-Content $nginxConf -Raw -Encoding UTF8

    # 查找并替换 upstream frontend 端口
    $pattern = '(upstream frontend\s*\{[^}]*server\s+host\.docker\.internal:)\d+'
    $replacement = "`${1}$Port"

    $newContent = $content -replace $pattern, $replacement

    # 备份原配置
    $backupPath = "$nginxConf.bak"
    Copy-Item $nginxConf $backupPath -Force

    # 写入新配置
    $newContent | Set-Content $nginxConf -Encoding UTF8 -NoNewline
    Write-Success "nginx 配置已更新: frontend 端口 -> $Port"
    Write-Success "备份已保存: $backupPath"

    return $true
}

# 重启 nginx (Docker 容器)
function Restart-Nginx {
    Write-Step "重启 nginx 容器"

    try {
        # 检查容器是否存在
        $containerExists = docker ps -a --filter "name=homework-ai-nginx" --format "{{.Names}}" 2>$null
        if ($containerExists -eq "homework-ai-nginx") {
            # 检查容器是否运行中
            $containerRunning = docker ps --filter "name=homework-ai-nginx" --format "{{.Names}}" 2>$null

            if ($containerRunning -eq "homework-ai-nginx") {
                # 尝试重载配置
                docker exec homework-ai-nginx nginx -t 2>$null
                if ($LASTEXITCODE -eq 0) {
                    docker exec homework-ai-nginx nginx -s reload 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        Write-Success "nginx 已重载配置"
                        return $true
                    }
                }
            }

            # 如果重载失败或容器未运行，尝试重启容器
            docker restart homework-ai-nginx 2>$null
            Write-Success "nginx 容器已重启"
            return $true
        } else {
            Write-Warn "未找到 homework-ai-nginx 容器"
            return $false
        }
    } catch {
        Write-Warn "nginx 重启失败: $_"
        return $false
    }
}

# 自动修复 nginx 端口配置
function Sync-NginxFrontendPort {
    Write-Step "检查 nginx 前端端口配置"

    $actualPort = Get-FrontendPort
    if (-not $actualPort) {
        Write-Warn "无法检测到前端端口"
        return
    }

    Write-Success "前端运行在端口 $actualPort"

    $nginxPort = Get-NginxFrontendPort
    if (-not $nginxPort) {
        Write-Warn "无法读取 nginx 配置中的前端端口"
        return
    }

    if ($nginxPort -ne $actualPort) {
        Write-Warn "nginx 配置端口 ($nginxPort) 与实际端口 ($actualPort) 不匹配"

        # 自动更新 nginx 配置
        if (Update-NginxFrontendPort $actualPort) {
            Restart-Nginx
            Write-Success "已自动修复端口配置"
        }
    } else {
        Write-Success "nginx 配置与实际端口匹配"
    }
}

# 启动服务
function Start-ServiceProcess {
    param(
        [string]$Name,
        [string]$Script
    )

    Write-Step "启动 $Name"

    $job = Start-Job -ScriptBlock {
        param($workDir, $script)
        Set-Location $workDir
        Invoke-Expression $script
    } -ArgumentList (Get-Location).Path, $Script

    Start-Sleep -Seconds 3

    if ($job.State -eq 'Running') {
        Write-Success "$Name 启动成功"
        return $job
    } else {
        $output = Receive-Job $job
        Write-Error "$Name 启动失败"
        if ($output) {
            $output | ForEach-Object { Write-Output "  $_" }
        }
        return $null
    }
}

# ====================================================================
# 主流程
# ====================================================================

Clear-Host
Write-ColorOutput "=========================================" "Magenta"
Write-ColorOutput "   Homework AI - 服务重启脚本" "Magenta"
Write-ColorOutput "=========================================" "Magenta"

# 检查参数
$SkipNginxCheck = $args -contains '--skip-nginx'

# 1. 检查 nginx
if (-not $SkipNginxCheck) {
    Check-Nginx
}

# 2. 清理端口
Clear-Port $BACKEND_PORT "后端 API"
Clear-Port $FRONTEND_PORT "前端服务"

# 3. 检查 Docker
Write-Step "检查 Docker 服务"
try {
    docker version | Out-Null
    Write-Success "Docker 正在运行"
} catch {
    Write-Warn "Docker 未运行，部分功能可能不可用"
}

# 4. 启动服务
Write-Step "启动所有服务"

$workDir = (Get-Location).Path

# 生成 Prisma 客户端
Write-Output "生成 Prisma 客户端..."
Set-Location "$workDir\apps\backend"
pnpm prisma:generate
Set-Location $workDir

# 启动后端
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    pnpm dev:backend
} -ArgumentList $workDir

# 启动 worker
$workerJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    pnpm dev:worker
} -ArgumentList $workDir

# 启动前端
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    pnpm dev:frontend
} -ArgumentList $workDir

# 等待服务启动
Start-Sleep -Seconds 5

# 自动修复 nginx 端口配置
Sync-NginxFrontendPort

# 显示状态
Write-Step "服务状态"

$jobs = @(
    @{Name = "Backend"; Job = $backendJob; Port = $BACKEND_PORT},
    @{Name = "Worker"; Job = $workerJob; Port = $null},
    @{Name = "Frontend"; Job = $frontendJob; Port = $FRONTEND_PORT}
)

foreach ($svc in $jobs) {
    $state = $svc.Job.State
    if ($state -eq 'Running') {
        $portInfo = if ($svc.Port) { " (端口: $($svc.Port))" } else { "" }
        Write-Success "$($svc.Name) 运行中$portInfo"
    } else {
        Write-Error "$($svc.Name) 启动失败 (状态: $state)"
        $output = Receive-Job $svc.Job -ErrorAction SilentlyContinue
        if ($output) {
            Write-Output "输出:"
            $output | ForEach-Object { Write-Output "  $_" }
        }
    }
}

Write-Step "完成"
Write-ColorOutput "`n=========================================" "Magenta"
Write-ColorOutput "   服务访问地址" "Magenta"
Write-ColorOutput "=========================================" "Magenta"
Write-Output "`n  前端:    http://localhost:$FRONTEND_PORT/"
Write-Output "  API:     http://localhost:$BACKEND_PORT/api/"
Write-Output "  MinIO:   http://localhost:9001"
Write-Output "`n  默认测试账号:"
Write-Output "  - 管理员: admin     / Test1234"
Write-Output "  - 教师:   teacher01 / Test1234"
Write-Output "  - 学生:   student01 / Test1234"
Write-Output "`n=========================================`n"

Write-Output "后台任务已启动。使用 Get-Job 查看状态，Receive-Job <Id> 查看输出"
Write-Output "使用 Remove-Job <Id> 或 Stop-Job <Id> 来停止服务"

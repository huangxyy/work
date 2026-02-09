$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { 'http://localhost:3000/api' }
$adminAccount = if ($env:ADMIN_ACCOUNT) { $env:ADMIN_ACCOUNT } else { 'admin' }
$adminPassword = if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { 'Test1234' }
$adminName = if ($env:ADMIN_NAME) { $env:ADMIN_NAME } else { 'Admin' }
$adminToken = $env:ADMIN_TOKEN
$days = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 7 }
$batchSize = if ($env:RETENTION_BATCH_SIZE) { [int]$env:RETENTION_BATCH_SIZE } else { 200 }

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [string]$Token
  )

  $headers = @{}
  if ($Token) {
    $headers['Authorization'] = "Bearer $Token"
  }

  $params = @{
    Method      = $Method
    Uri         = $Url
    Headers     = $headers
    ContentType = 'application/json'
  }

  if ($null -ne $Body) {
    $params['Body'] = ($Body | ConvertTo-Json -Depth 6)
  }

  return Invoke-RestMethod @params
}

function Get-AdminToken {
  if ($adminToken) {
    return $adminToken
  }

  try {
    $login = Invoke-Api -Method 'POST' -Url "$baseUrl/auth/login" -Body @{
      account  = $adminAccount
      password = $adminPassword
    }
    return $login.token
  } catch {
    Write-Host "Login failed, trying to register admin user..." -ForegroundColor Yellow
  }

  $register = Invoke-Api -Method 'POST' -Url "$baseUrl/auth/register" -Body @{
    account  = $adminAccount
    password = $adminPassword
    name     = $adminName
    role     = 'ADMIN'
  }

  return $register.token
}

$token = Get-AdminToken
if (-not $token) {
  Write-Error "Failed to obtain admin token."
  exit 1
}

Write-Host "Using API base URL: $baseUrl"

$dryRunPayload = @{
  dryRun    = $true
  days      = $days
  batchSize = $batchSize
}

$runPayload = @{
  dryRun    = $false
  days      = $days
  batchSize = $batchSize
}

Write-Host "Running dry-run..."
$first = Invoke-Api -Method 'POST' -Url "$baseUrl/admin/retention/run" -Body $dryRunPayload -Token $token
Write-Host ("Dry-run: scanned={0} deleted={1} minioFailed={2} dbFailed={3}" -f $first.scanned, $first.deleted, $first.minioFailed, $first.dbFailed)

Write-Host "Running retention cleanup..."
$second = Invoke-Api -Method 'POST' -Url "$baseUrl/admin/retention/run" -Body $runPayload -Token $token
Write-Host ("Cleanup: scanned={0} deleted={1} minioFailed={2} dbFailed={3}" -f $second.scanned, $second.deleted, $second.minioFailed, $second.dbFailed)

Write-Host "Running post-clean dry-run..."
$third = Invoke-Api -Method 'POST' -Url "$baseUrl/admin/retention/run" -Body $dryRunPayload -Token $token
Write-Host ("Post dry-run: scanned={0} deleted={1} minioFailed={2} dbFailed={3}" -f $third.scanned, $third.deleted, $third.minioFailed, $third.dbFailed)

if ($third.scanned -gt 0 -or $third.minioFailed -gt 0 -or $third.dbFailed -gt 0) {
  Write-Error "Retention verify failed: remaining expired submissions or delete failures."
  exit 1
}

Write-Host "Retention verify succeeded."

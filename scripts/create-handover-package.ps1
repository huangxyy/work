param(
  [string]$OutputDir = "release",
  [string]$PackageName = "homework-ai-handover",
  [switch]$IncludeDatabaseDump,
  [string]$DatabaseDumpPath = "backup/homework_ai.sql",
  [switch]$IncludeStorageBackup,
  [string]$StorageBackupPath = "backup/storage",
  [switch]$IncludeAccountFile,
  [string]$AccountFilePath = "deploy/account-only.env"
)

$ErrorActionPreference = "Stop"

function Resolve-InputPath {
  param(
    [string]$BasePath,
    [string]$InputPath
  )

  if ([System.IO.Path]::IsPathRooted($InputPath)) {
    return $InputPath
  }
  return Join-Path $BasePath $InputPath
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $commit = (git rev-parse --short HEAD).Trim()
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()

  $outputRoot = Join-Path $repoRoot $OutputDir
  New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

  $stagingDir = Join-Path $outputRoot ("_staging_" + $timestamp)
  New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

  $sourceArchivePath = Join-Path $stagingDir "source-code.zip"
  $sourceSnapshotDir = Join-Path $stagingDir "source-code"
  New-Item -ItemType Directory -Path $sourceSnapshotDir -Force | Out-Null

  $sourceFileList = git ls-files --cached --others --exclude-standard
  foreach ($relativePath in $sourceFileList) {
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      continue
    }

    $sourcePath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path $sourcePath -PathType Leaf)) {
      continue
    }

    $targetPath = Join-Path $sourceSnapshotDir $relativePath
    $targetDir = Split-Path -Path $targetPath -Parent
    if (-not (Test-Path $targetDir)) {
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    Copy-Item -Path $sourcePath -Destination $targetPath -Force
  }

  Compress-Archive -Path (Join-Path $sourceSnapshotDir "*") -DestinationPath $sourceArchivePath -Force
  Remove-Item -Path $sourceSnapshotDir -Recurse -Force

  $includedItems = @("source-code.zip")

  if ($IncludeDatabaseDump) {
    $dbSourcePath = Resolve-InputPath -BasePath $repoRoot -InputPath $DatabaseDumpPath
    if (-not (Test-Path $dbSourcePath)) {
      throw "Database dump path not found: $dbSourcePath"
    }

    if ((Get-Item $dbSourcePath).PSIsContainer) {
      $dbCandidate = Get-ChildItem -Path $dbSourcePath -File -Include *.sql,*.sql.gz | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if (-not $dbCandidate) {
        throw "No SQL dump file found in directory: $dbSourcePath"
      }
      $dbSourcePath = $dbCandidate.FullName
    }

    $dbTargetDir = Join-Path $stagingDir "data/database"
    New-Item -ItemType Directory -Path $dbTargetDir -Force | Out-Null
    Copy-Item -Path $dbSourcePath -Destination (Join-Path $dbTargetDir (Split-Path $dbSourcePath -Leaf)) -Force
    $includedItems += "data/database/$(Split-Path $dbSourcePath -Leaf)"
  }

  if ($IncludeStorageBackup) {
    $storageSourcePath = Resolve-InputPath -BasePath $repoRoot -InputPath $StorageBackupPath
    if (-not (Test-Path $storageSourcePath)) {
      throw "Storage backup path not found: $storageSourcePath"
    }

    $storageItem = Get-Item $storageSourcePath
    if ($storageItem.PSIsContainer) {
      $archiveCandidate = Get-ChildItem -Path $storageSourcePath -File -Filter *.tar.gz | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($archiveCandidate) {
        $storageSourcePath = $archiveCandidate.FullName
      }
    }

    $storageTargetDir = Join-Path $stagingDir "data/storage"
    New-Item -ItemType Directory -Path $storageTargetDir -Force | Out-Null
    Copy-Item -Path $storageSourcePath -Destination $storageTargetDir -Recurse -Force
    $includedItems += "data/storage/$(Split-Path $storageSourcePath -Leaf)"
  }

  if ($IncludeAccountFile) {
    $accountSourcePath = Resolve-InputPath -BasePath $repoRoot -InputPath $AccountFilePath
    if (-not (Test-Path $accountSourcePath)) {
      throw "Account file not found: $accountSourcePath"
    }
    if ((Get-Item $accountSourcePath).PSIsContainer) {
      throw "Account file path must be a file: $accountSourcePath"
    }

    $secretDir = Join-Path $stagingDir "secrets"
    New-Item -ItemType Directory -Path $secretDir -Force | Out-Null
    Copy-Item -Path $accountSourcePath -Destination (Join-Path $secretDir "account-only.env") -Force
    $includedItems += "secrets/account-only.env"
  }

  $workingTreeDirty = [bool]((git status --porcelain).Length -gt 0)

  $manifest = [ordered]@{
    generatedAt   = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss K")
    repository    = "homework-ai"
    branch        = $branch
    commit        = $commit
    sourceType    = "working-tree"
    workingTreeDirty = $workingTreeDirty
    includeData   = [bool]($IncludeDatabaseDump -or $IncludeStorageBackup)
    includedItems = $includedItems
    notes         = @(
      "Read docs/HANDOVER.md first.",
      "Deployment guide: docs/DEPLOY.md",
      "Do not send plaintext secrets in this package."
    )
  }

  $manifestPath = Join-Path $stagingDir "MANIFEST.json"
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding utf8

  $bundleReadmePath = Join-Path $stagingDir "README-HANDOVER.txt"
  $bundleReadmeTemplatePath = Join-Path $PSScriptRoot "templates/README-HANDOVER.zh-CN.txt"
  if (Test-Path $bundleReadmeTemplatePath) {
    $bundleReadmeContent = Get-Content -Path $bundleReadmeTemplatePath -Raw -Encoding UTF8
    $bundleReadmeContent = $bundleReadmeContent.Replace("{{COMMIT}}", $commit)
    Set-Content -Path $bundleReadmePath -Value $bundleReadmeContent -Encoding utf8
  }
  else {
    @(
      "Homework AI handover bundle",
      "",
      "1) source-code.zip: project source at commit $commit",
      "2) MANIFEST.json: bundle metadata",
      "3) docs/HANDOVER.md and docs/DEPLOY.md are inside source-code.zip",
      "",
      "Security reminder:",
      "- Do not package deploy/host.env or apps/backend/.env",
      "- If you included secrets/account-only.env, send package in trusted channel only",
      "- Share API keys and passwords via a secure channel"
    ) | Set-Content -Path $bundleReadmePath -Encoding utf8
  }

  $finalPackagePath = Join-Path $outputRoot ("$PackageName-$timestamp-$commit.zip")
  if (Test-Path $finalPackagePath) {
    Remove-Item $finalPackagePath -Force
  }

  Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $finalPackagePath -Force
  Remove-Item -Path $stagingDir -Recurse -Force

  Write-Host "Handover package created: $finalPackagePath"
}
finally {
  Pop-Location
}

# build.ps1
# Maintainer map:
# - Update source assembly and generated output paths in section 2 below.
# - Pay data is built from data\BasePay.csv and the newest data\raw CSVs.
# - Update $grades below if the source pay tables add supported grades.
# - Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build.ps1 -SrcDir .\source -DistDir .\distribution
param(
  [Parameter(Mandatory = $true)][string]$SrcDir,
  [Parameter(Mandatory = $true)][string]$DistDir
)

$ErrorActionPreference = "Stop"

$rootDir       = $PSScriptRoot
$dataDir       = Join-Path $rootDir "data"
$rawDir        = Join-Path $dataDir "raw"
$payDataJsPath = Join-Path $SrcDir "07-pay-data.js"

function Get-LatestYearFile([string]$folder, [string]$prefix) {
  if (-not (Test-Path -LiteralPath $folder)) { return $null }
  $candidates = Get-ChildItem -LiteralPath $folder -File -Filter "$prefix*.csv" |
    Where-Object { $_.BaseName -match "^$prefix(\d{4})$" } |
    Sort-Object { [int]($_.BaseName -replace "^$prefix", "") } -Descending
  if (-not $candidates -or $candidates.Count -eq 0) { return $null }
  return $candidates[0]
}

function To-RoundedDouble([string]$rawVal) {
  $clean = ($rawVal -replace '[\$,\s]', '')
  if ([string]::IsNullOrWhiteSpace($clean)) { return 0.0 }
  try { return [double]$clean } catch { return 0.0 }
}

function Get-RowProp($row, [string[]]$names) {
  foreach ($n in $names) {
    if ($row.PSObject.Properties.Name -contains $n) {
      return $row.$n
    }
  }
  return $null
}

function Read-RequiredFile([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing required source file: $path"
  }
  return Get-Content -LiteralPath $path -Raw -Encoding UTF8
}

function Read-OptionalFile([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path)) {
    return ""
  }
  return Get-Content -LiteralPath $path -Raw -Encoding UTF8
}

$grades = @(
  "E-1","E-2","E-3","E-4","E-5","E-6","E-7","E-8","E-9",
  "W-1","W-2","W-3","W-4","W-5",
  "O-1E","O-2E","O-3E",
  "O-1","O-2","O-3","O-4","O-5","O-6","O-7","O-8","O-9","O-10"
)

# ------------------------------------------------------------------
# 1. AUTO-DETECT LATEST PAY & BAH CSVs
# ------------------------------------------------------------------
$baseCsvFile = Get-LatestYearFile -folder $rawDir -prefix "base-pay-"
if (-not $baseCsvFile) { $baseCsvFile = Get-LatestYearFile -folder $dataDir -prefix "base-pay-" }
$baseCsvPath = if ($baseCsvFile) {
  $baseCsvFile.FullName
} elseif (Test-Path -LiteralPath (Join-Path $dataDir "BasePay.csv")) {
  Join-Path $dataDir "BasePay.csv"
} else {
  $null
}

$bahRawFile = Get-LatestYearFile -folder $rawDir -prefix "bah-rates-"
$zipRawFile = Get-LatestYearFile -folder $rawDir -prefix "zip-to-mha-"

if ($baseCsvPath -and $bahRawFile -and $zipRawFile) {
  Write-Host "[*] Base Pay : $(Split-Path $baseCsvPath -Leaf)" -ForegroundColor Cyan
  Write-Host "[*] BAH Rates: $($bahRawFile.Name)" -ForegroundColor Cyan
  Write-Host "[*] ZIP->MHA : $($zipRawFile.Name)" -ForegroundColor Cyan

  # A. Parse BasePay CSV
  $baseMap = @{}
  $baseRows = Import-Csv -LiteralPath $baseCsvPath
  if (-not $baseRows -or $baseRows.Count -eq 0) {
    throw "Base pay CSV contains no data rows: $baseCsvPath"
  }
  if ($baseRows.Count -gt 0) {
    $yosCols = $baseRows[0].PSObject.Properties.Name | Where-Object { $_ -ne "Grade" -and $_ -ne "grade" }
    foreach ($row in $baseRows) {
      $g = ([string](Get-RowProp $row @("Grade", "grade"))).Trim()
      if ([string]::IsNullOrWhiteSpace($g)) { continue }
      $yosObj = @{}
      foreach ($col in $yosCols) {
        $yosObj[$col] = To-RoundedDouble ([string]$row.$col)
      }
      $baseMap[$g] = $yosObj
    }
  }

  # B. Parse bah-rates-YYYY.csv directly into indexed MHA tables
  $mhaList = @()
  $mhaCodeToIdx = @{}
  $mhaBahByIdx = @{}
  $bahByMha = @{}

  foreach ($row in (Import-Csv -LiteralPath $bahRawFile.FullName)) {
    $mhaCode = ([string](Get-RowProp $row @("mha"))).Trim()
    $mhaName = ([string](Get-RowProp $row @("mha_name_dtmo", "mha_name"))).Trim()
    $depType = ([string](Get-RowProp $row @("dependents", "dependent"))).Trim().ToLower()

    if ([string]::IsNullOrWhiteSpace($mhaCode)) { continue }
    if ($depType -ne "with" -and $depType -ne "without") { continue }

    if (-not $mhaCodeToIdx.ContainsKey($mhaCode)) {
      $label = if ($mhaName) { "$mhaCode - $mhaName" } else { $mhaCode }
      $mhaCodeToIdx[$mhaCode] = $mhaList.Count
      $mhaList += $label
      $bahByMha[$mhaCode] = @{}
    }

    $bahByMha[$mhaCode][$depType] = $row
  }

  foreach ($mhaCode in $mhaCodeToIdx.Keys) {
    $idxKey   = [string]$mhaCodeToIdx[$mhaCode]
    $wRow     = $bahByMha[$mhaCode]["with"]
    $woRow    = $bahByMha[$mhaCode]["without"]
    $gradeMap = @{}

    foreach ($g in $grades) {
      $wVal  = if ($wRow)  { To-RoundedDouble ([string]$wRow.$g) }  else { 0.0 }
      $woVal = if ($woRow) { To-RoundedDouble ([string]$woRow.$g) } else { 0.0 }
      $gradeMap[$g] = @($wVal, $woVal)
    }

    $mhaBahByIdx[$idxKey] = $gradeMap
  }

  # C. Parse zip-to-mha-YYYY.csv -> compact zipToMhaIdx
  $zipToMhaIdx = @{}
  foreach ($row in (Import-Csv -LiteralPath $zipRawFile.FullName)) {
    $z = ([string](Get-RowProp $row @("zip"))).Trim().PadLeft(5, '0')
    $mhaCode = ([string](Get-RowProp $row @("mha"))).Trim()
    if ($z -match '^\d{5}$' -and $mhaCodeToIdx.ContainsKey($mhaCode)) {
      $zipToMhaIdx[$z] = $mhaCodeToIdx[$mhaCode]
    }
  }

  $basePayYear = $null
  if ($baseCsvFile -and $baseCsvFile.BaseName -match "^base-pay-(\d{4})$") {
    $basePayYear = [int]$Matches[1]
  }
  $bahRateYear = [int]($bahRawFile.BaseName -replace "^bah-rates-", "")
  $zipMhaYear = [int]($zipRawFile.BaseName -replace "^zip-to-mha-", "")

  $dbObj = @{
    rateData          = @{
      basePayYear = $basePayYear
      bahRateYear = $bahRateYear
      zipMhaYear  = $zipMhaYear
    }
    baseByGradeAndYos = $baseMap
    mhaNames          = $mhaList
    zipToMhaIdx       = $zipToMhaIdx
    mhaBahByIdx       = $mhaBahByIdx
  }

  $json = $dbObj | ConvertTo-Json -Depth 6 -Compress
  Set-Content -LiteralPath $payDataJsPath -Value "// Generated from data CSV files by build.ps1; edit the CSV inputs instead.`r`nconst PAY_RATE_DB = $json;" -Encoding UTF8
  Write-Host "[OK] Compiled $($zipToMhaIdx.Count) ZIPs across $($mhaList.Count) MHAs." -ForegroundColor Green
} else {
  throw "Cannot compile pay database; missing BasePay.csv or data\raw\bah-rates-YYYY.csv / zip-to-mha-YYYY.csv."
}

# ------------------------------------------------------------------
# 2. ASSEMBLE STANDALONE HTML + INDEX.HTML + PWA FILES
# ------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $DistDir)) {
  New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

$requiredSources = @(
  "01-theme-and-layout.css",
  "02-planner-ui.html",
  "03-calendar-holidays-storage.js",
  "04-schedule-wizard-grid.js",
  "05-policy-leave-engine.js",
  "06-sad-pay-calculator.js",
  "07-coc-report-export.js",
  "08-app-startup.js"
)
$leaveFormSource = Join-Path $SrcDir "assets\DOCCS_SAD_Leave_Request_Form.pdf"
if (-not (Test-Path -LiteralPath $leaveFormSource)) {
  throw "Missing required source file: $leaveFormSource"
}
foreach ($requiredSource in $requiredSources) {
  $requiredPath = Join-Path $SrcDir $requiredSource
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Missing required source file: $requiredPath"
  }

  if ((Get-Item -LiteralPath $requiredPath).Length -eq 0) {
    throw "Required source file is empty: $requiredPath"
  }
}

$outFile      = Join-Path $DistDir "NY_SAD_Duty_Leave_Pay_Planner.html"
$distIndex    = Join-Path $DistDir "index.html"
$rootIndex    = Join-Path $rootDir "index.html"
$tempFile     = Join-Path $env:TEMP "NY_SAD_Duty_Leave_Pay_Planner.tmp.html"
$legacyOutFile = Join-Path $DistDir "JTF_Sentinel_Planner_v1.html"

$css     = Read-RequiredFile (Join-Path $SrcDir "01-theme-and-layout.css")
$html    = Read-RequiredFile (Join-Path $SrcDir "02-planner-ui.html")
$js3     = Read-RequiredFile (Join-Path $SrcDir "03-calendar-holidays-storage.js")
$js4     = Read-RequiredFile (Join-Path $SrcDir "04-schedule-wizard-grid.js")
$js5     = Read-RequiredFile (Join-Path $SrcDir "05-policy-leave-engine.js")
$js6Pay  = Read-RequiredFile (Join-Path $SrcDir "06-sad-pay-calculator.js")
$js7Exp  = Read-RequiredFile (Join-Path $SrcDir "07-coc-report-export.js")
$js8Init = Read-RequiredFile (Join-Path $SrcDir "08-app-startup.js")

$payData = Read-OptionalFile $payDataJsPath

$html = $html -replace '(?is)</body>\s*</html>\s*$', ''

$manifestSrc = Join-Path $SrcDir "manifest.json"
$swSrc       = Join-Path $SrcDir "sw.js"
$hasManifest = Test-Path -LiteralPath $manifestSrc
$hasSw       = Test-Path -LiteralPath $swSrc

$pwaHeadTags = ""
if ($hasManifest) {
  $pwaHeadTags = "  <link rel=""manifest"" href=""./manifest.json"">" + [Environment]::NewLine +
                 "  <meta name=""theme-color"" content=""#1a73e8"">" + [Environment]::NewLine +
                 "  <link rel=""icon"" type=""image/png"" href=""./icons/icon-192.png"">" + [Environment]::NewLine +
                 "  <link rel=""apple-touch-icon"" href=""./icons/apple-touch-icon.png"">" + [Environment]::NewLine +
                 "  <meta name=""apple-mobile-web-app-capable"" content=""yes"">" + [Environment]::NewLine +
                 "  <meta name=""apple-mobile-web-app-title"" content=""NY SAD Planner"">" + [Environment]::NewLine
}

$nl = [Environment]::NewLine
$doc = "<!DOCTYPE html>" + $nl +
  "<html lang=""en"">" + $nl +
  "<head>" + $nl +
  "  <meta charset=""UTF-8"">" + $nl +
  "  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"">" + $nl +
  $pwaHeadTags +
  "  <title>NY SAD Duty, Leave &amp; Pay Planner</title>" + $nl +
  "  <style>" + $nl + $css + $nl + "  </style>" + $nl +
  "</head>" + $nl +
  "<body>" + $nl + $html + $nl +
  "<script>" + $nl + $js3 + $nl + $js4 + $nl + $js5 + $nl + $payData + $nl + $js6Pay + $nl + $js7Exp + $nl + $js8Init + $nl + "</script>" + $nl +
  "</body>" + $nl +
  "</html>"

Set-Content -LiteralPath $tempFile -Value $doc -Encoding UTF8
Move-Item -LiteralPath $tempFile -Destination $outFile -Force
if (Test-Path -LiteralPath $legacyOutFile) {
  Remove-Item -LiteralPath $legacyOutFile -Force
}

$externalDoc = "<!DOCTYPE html>" + $nl +
  "<html lang=""en"">" + $nl +
  "<head>" + $nl +
  "  <meta charset=""UTF-8"">" + $nl +
  "  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"">" + $nl +
  $pwaHeadTags +
  "  <title>NY SAD Duty, Leave &amp; Pay Planner</title>" + $nl +
  "  <style>" + $nl + $css + $nl + "  </style>" + $nl +
  "</head>" + $nl +
  "<body>" + $nl + $html + $nl +
  "<script>" + $nl + $js3 + $nl + $js4 + $nl + $js5 + $nl + "</script>" + $nl +
  "<script src=""./pay-data.js""></script>" + $nl +
  "<script>" + $nl + $js6Pay + $nl + $js7Exp + $nl + $js8Init + $nl + "</script>" + $nl +
  "</body>" + $nl +
  "</html>"

Set-Content -LiteralPath $distIndex -Value $externalDoc -Encoding UTF8
Set-Content -LiteralPath $rootIndex -Value $externalDoc -Encoding UTF8

if (-not [string]::IsNullOrWhiteSpace($payData)) {
  $distPayData = Join-Path $DistDir "pay-data.js"
  $rootPayData = Join-Path $rootDir "pay-data.js"
  Set-Content -LiteralPath $distPayData -Value $payData -Encoding UTF8
  Set-Content -LiteralPath $rootPayData -Value $payData -Encoding UTF8
}
Write-Host "[OK] Built HTML -> $outFile, $distIndex, and $rootIndex" -ForegroundColor Green

if ($hasManifest) {
  Copy-Item -LiteralPath $manifestSrc -Destination (Join-Path $DistDir "manifest.json") -Force
  Copy-Item -LiteralPath $manifestSrc -Destination (Join-Path $rootDir "manifest.json") -Force
  Write-Host "[OK] Copied manifest.json -> $DistDir and $rootDir" -ForegroundColor Green
}

if ($hasSw) {
  $buildStamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
  $swContent  = (Get-Content -LiteralPath $swSrc -Raw -Encoding UTF8) -replace 'const CACHE_NAME\s*=\s*"[^"]+";', "const CACHE_NAME = `"ny-sad-planner-v1-$buildStamp`";"
  $swContent  = $swContent.TrimEnd([char[]]"`r`n")
  Set-Content -LiteralPath (Join-Path $DistDir "sw.js") -Value $swContent -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $rootDir "sw.js") -Value $swContent -Encoding UTF8
  Write-Host "[OK] Copied sw.js (cache: ny-sad-planner-v1-$buildStamp) -> $DistDir and $rootDir" -ForegroundColor Green
}

$iconSrcDir = Join-Path $SrcDir "icons"
if (Test-Path -LiteralPath $iconSrcDir) {
  foreach ($iconRoot in @($rootDir, $DistDir)) {
    $iconDest = Join-Path $iconRoot "icons"
    if (-not (Test-Path -LiteralPath $iconDest)) { New-Item -ItemType Directory -Path $iconDest -Force | Out-Null }
    Copy-Item -Path (Join-Path $iconSrcDir "*") -Destination $iconDest -Force
  }
  Write-Host "[OK] Copied icons -> $rootDir and $DistDir" -ForegroundColor Green
}

foreach ($assetRoot in @($rootDir, $DistDir)) {
  $assetDir = Join-Path $assetRoot "assets"
  if (-not (Test-Path -LiteralPath $assetDir)) {
    New-Item -ItemType Directory -Path $assetDir -Force | Out-Null
  }
  Copy-Item -LiteralPath $leaveFormSource -Destination (Join-Path $assetDir "DOCCS_SAD_Leave_Request_Form.pdf") -Force
}
Write-Host "[OK] Copied leave form -> $rootDir and $DistDir" -ForegroundColor Green

$notFoundSrc = Join-Path $SrcDir "404.html"
if (Test-Path -LiteralPath $notFoundSrc) {
  foreach ($pageRoot in @($rootDir, $DistDir)) {
    Copy-Item -LiteralPath $notFoundSrc -Destination (Join-Path $pageRoot "404.html") -Force
    New-Item -ItemType File -Path (Join-Path $pageRoot ".nojekyll") -Force | Out-Null
  }
  Write-Host "[OK] Copied 404.html and .nojekyll -> $rootDir and $DistDir" -ForegroundColor Green
}

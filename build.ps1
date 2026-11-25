# build.ps1
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

  $dbObj = @{
    baseByGradeAndYos = $baseMap
    mhaNames          = $mhaList
    zipToMhaIdx       = $zipToMhaIdx
    mhaBahByIdx       = $mhaBahByIdx
  }

  $json = $dbObj | ConvertTo-Json -Depth 6 -Compress
  Set-Content -LiteralPath $payDataJsPath -Value "const PAY_RATE_DB = $json;" -Encoding UTF8
  Write-Host "[OK] Compiled $($zipToMhaIdx.Count) ZIPs across $($mhaList.Count) MHAs." -ForegroundColor Green
} else {
  Write-Host "[!] Skipping pay DB compile (missing BasePay.csv or data\raw\bah-rates-YYYY.csv / zip-to-mha-YYYY.csv)." -ForegroundColor Yellow
}

# ------------------------------------------------------------------
# 2. ASSEMBLE STANDALONE HTML + PWA FILES
# ------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $DistDir)) {
  New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

$outFile  = Join-Path $DistDir "JTF_Sentinel_Planner_v1.html"
$tempFile = Join-Path $env:TEMP "JTF_Sentinel_Planner_v1.tmp.html"

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
                 "  <meta name=""theme-color"" content=""#1a73e8"">" + [Environment]::NewLine
}

$nl = [Environment]::NewLine
$doc = "<!DOCTYPE html>" + $nl +
  "<html lang=""en"">" + $nl +
  "<head>" + $nl +
  "  <meta charset=""UTF-8"">" + $nl +
  "  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"">" + $nl +
  $pwaHeadTags +
  "  <title>JTF Sentinel SAD DOCCS Duty Status &amp; Leave Planner (v1)</title>" + $nl +
  "  <style>" + $nl + $css + $nl + "  </style>" + $nl +
  "</head>" + $nl +
  "<body>" + $nl + $html + $nl +
  "<script>" + $nl + $js3 + $nl + $js4 + $nl + $js5 + $nl + $payData + $nl + $js6Pay + $nl + $js7Exp + $nl + $js8Init + $nl + "</script>" + $nl +
  "</body>" + $nl +
  "</html>"

Set-Content -LiteralPath $tempFile -Value $doc -Encoding UTF8
Move-Item -LiteralPath $tempFile -Destination $outFile -Force
Write-Host "[OK] Built standalone HTML -> $outFile" -ForegroundColor Green

if ($hasManifest) {
  Copy-Item -LiteralPath $manifestSrc -Destination (Join-Path $DistDir "manifest.json") -Force
  Write-Host "[OK] Copied manifest.json -> $DistDir" -ForegroundColor Green
}

if ($hasSw) {
  $buildStamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
  $swContent  = (Get-Content -LiteralPath $swSrc -Raw -Encoding UTF8) -replace 'const CACHE_NAME\s*=\s*"[^"]+";', "const CACHE_NAME = `"sentinel-planner-v1-$buildStamp`";"
  Set-Content -LiteralPath (Join-Path $DistDir "sw.js") -Value $swContent -Encoding UTF8
  Write-Host "[OK] Copied sw.js (cache: sentinel-planner-v1-$buildStamp) -> $DistDir" -ForegroundColor Green
}
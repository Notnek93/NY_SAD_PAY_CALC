REM Maintainer map: this is a Windows convenience wrapper for build.ps1.
REM Change build inputs or source assembly in build.ps1, not in generated HTML.
@echo off
setlocal

set "NO_PAUSE=0"
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"
if /I "%~1"=="/y" set "NO_PAUSE=1"

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

pushd "%ROOT_DIR%" >nul 2>&1

set "SRC_DIR=%ROOT_DIR%\source"
set "DIST_DIR=%ROOT_DIR%\distribution"
set "PS_SCRIPT=%ROOT_DIR%\build.ps1"

if not exist "%PS_SCRIPT%" (
  echo [ERROR] Build script not found: "%PS_SCRIPT%"
  popd >nul 2>&1
  if "%NO_PAUSE%"=="0" pause
  exit /b 1
)

echo [*] Cleaning existing distribution folder...
if not exist "%DIST_DIR%" (
  mkdir "%DIST_DIR%" >nul 2>&1
) else (
  attrib -r "%DIST_DIR%\*.*" /s /d >nul 2>&1
  del /f /q "%DIST_DIR%\*.*" >nul 2>&1
  for /d %%D in ("%DIST_DIR%\*") do rmdir /s /q "%%D" >nul 2>&1
)

if exist "%DIST_DIR%\JTF_Sentinel_Planner_v1.html" (
  echo [!] Warning: Could not remove locked file "%DIST_DIR%\JTF_Sentinel_Planner_v1.html". Close any open tab/editor using it if the build cannot overwrite it.
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -SrcDir "%SRC_DIR%" -DistDir "%DIST_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Build failed with exit code %EXIT_CODE%.
  popd >nul 2>&1
  if "%NO_PAUSE%"=="0" pause
  exit /b %EXIT_CODE%
)

echo.
echo [DONE] Build completed successfully.
popd >nul 2>&1
if "%NO_PAUSE%"=="0" pause
exit /b 0
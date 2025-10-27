@echo on
setlocal EnableExtensions

set PORT=5500
set ENTRY=sandbox.html

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%"

echo [INFO] 尝试使用系统内置 PowerShell 全路径启动（无需 PATH）。

set "PWSH_SYS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%PWSH_SYS%" (
  echo [INFO] 使用: "%PWSH_SYS%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%StartServer.ps1" -Port %PORT% -Entry "%ENTRY%"
  "%PWSH_SYS%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%StartServer.ps1" -Port %PORT% -Entry "%ENTRY%"
  goto END
)

echo [ERROR] 未找到系统内置 PowerShell: %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe
echo 请在 Windows 功能中启用或安装 PowerShell 后重试。
pause
exit /b 1

:END
popd
pause
endlocal

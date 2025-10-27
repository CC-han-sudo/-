@echo on
setlocal EnableExtensions

REM ===== Config =====
set PORT=5500
set ENTRY=sandbox.html

REM ===== Resolve project root =====
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%"

if not exist "%ENTRY%" (
  echo [ERROR] 未找到入口文件: %ENTRY% （位置：%SCRIPT_DIR%）
  echo 请编辑 StartServer.bat 中的 ENTRY 变量为你的入口 HTML 文件名。
  pause
  exit /b 1
)

echo [INFO] 首选 Python，其次 npx http-server。将在本窗口运行并输出日志。
echo [INFO] 访问地址: http://localhost:%PORT%/%ENTRY%

REM --- Try Python launcher (py) ---
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  echo [INFO] 使用 'py' 启动: py -m http.server %PORT%
  start "OpenBrowser" "http://localhost:%PORT%/%ENTRY%"
  py -m http.server %PORT%
  goto END
)

REM --- Try Python directly ---
where python >nul 2>nul
if %ERRORLEVEL%==0 (
  echo [INFO] 使用 'python' 启动: python -m http.server %PORT%
  start "OpenBrowser" "http://localhost:%PORT%/%ENTRY%"
  python -m http.server %PORT%
  goto END
)

REM --- Try Node http-server via npx ---
where npx >nul 2>nul
if %ERRORLEVEL%==0 (
  echo [INFO] 使用 'npx http-server' 启动: npx http-server -p %PORT%
  start "OpenBrowser" "http://localhost:%PORT%/%ENTRY%"
  npx http-server -p %PORT%
  goto END
)

echo [ERROR] 未检测到 Python 或 Node (npx)。
echo 请安装 Python(https://www.python.org/) 或 Node.js(https://nodejs.org/) 后重试。
pause
exit /b 1

:END
echo [INFO] 服务器已退出（若异常退出请查看上方错误日志）。
popd
pause
endlocal
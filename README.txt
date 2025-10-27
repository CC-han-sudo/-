如何启动本地服务器打开游戏

一、双击启动
1) 解压到任意文件夹（建议不要在压缩包内直接运行）。
2) 双击 StartServer.bat。
3) 等待命令行窗口提示，浏览器将自动打开：http://localhost:8080/sandbox.html
   - 如未自动打开，请手动在浏览器中访问上述链接。

二、常见问题
- 端口被占用/被拦截：
  打开 StartServer.bat，用记事本修改 PORT 变量，例如改为 5500，然后重新运行。
- 找不到 Python/Node：
  安装 Python（https://www.python.org/）或 Node.js（https://nodejs.org/）后再运行；
  脚本会自动优先使用 Python，其次使用 Node 的 http-server（通过 npx）。
- 入口文件不是 sandbox.html：
  打开 StartServer.bat，修改 ENTRY 变量为你的入口文件名，例如 index.html。

三、手动启动（无需使用批处理）
- 方式 A：Python
  在项目根目录打开 PowerShell 或 CMD，执行：
    python -m http.server 8080
  然后访问：
    http://localhost:8080/sandbox.html
- 方式 B：Node（需要安装 Node.js）
  在项目根目录执行：
    npx http-server -p 8080
  然后访问：
    http://localhost:8080/sandbox.html

四、注意
- 请确保资源路径是相对路径，不要写死本地盘符。
- 如果 Windows 提示“来自 Internet 的文件已被阻止”，右键文件→属性→解除封锁。
- 若需要对外网分享，请考虑使用 GitHub Pages/Netlify/Vercel 等静态托管。

param(
  [int]$Port = 5500,
  [string]$Entry = "sandbox.html"
)

$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

# Root folder = script directory
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Simple mime map
$mime = @{
  ".html"="text/html"; ".htm"="text/html";
  ".js"="application/javascript"; ".mjs"="application/javascript";
  ".css"="text/css";
  ".json"="application/json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"; ".svg"="image/svg+xml"; ".ico"="image/x-icon";
  ".wav"="audio/wav"; ".mp3"="audio/mpeg"; ".ogg"="audio/ogg";
  ".wasm"="application/wasm"
}

function Get-ContentBytes($path){
  try {
    return [System.IO.File]::ReadAllBytes($path)
  } catch {
    return $null
  }
}

try {
  $listener.Start()
  Write-Host "[INFO] Serving $root on $prefix" -ForegroundColor Green
  Write-Host "[INFO] Open: http://localhost:$Port/$Entry" -ForegroundColor Green
  Start-Process "http://localhost:$Port/$Entry" | Out-Null
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $localPath = $req.Url.LocalPath
      if ([string]::IsNullOrEmpty($localPath) -or $localPath -eq "/") {
        $file = Join-Path $root $Entry
      } else {
        $file = Join-Path $root ($localPath.TrimStart('/'))
      }
      if (-not (Test-Path $file)) {
        $res.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.Close()
        continue
      }
      $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
      $ctype = $mime[$ext]
      if (-not $ctype) { $ctype = "application/octet-stream" }
      $bytes = Get-ContentBytes $file
      if ($bytes -eq $null) {
        $res.StatusCode = 500
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Read error")
      } else {
        $res.StatusCode = 200
      }
      $res.ContentType = $ctype
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
    } catch {
      try { $res.StatusCode = 500 } catch {}
      try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Server error")
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.Close()
      } catch {}
    }
  }
} finally {
  if ($listener) { $listener.Stop(); $listener.Close() }
}

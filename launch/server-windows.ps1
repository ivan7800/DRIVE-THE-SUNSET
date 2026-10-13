$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$listener = New-Object System.Net.HttpListener
$started = $false
foreach ($port in 8765..8775) {
    $prefix = "http://127.0.0.1:$port/"
    try { $listener.Prefixes.Clear(); $listener.Prefixes.Add($prefix); $listener.Start(); $started = $true; break }
    catch { if ($listener.IsListening) { $listener.Stop() } }
}
if (-not $started) { throw 'No se ha podido iniciar el servidor HTTP local (puertos 8765-8775).' }
$url = $prefix + 'index.html'
Write-Host "CHASE-404: $url"
Write-Host 'Ctrl+C para salir.'
Start-Process $url
$mime = @{'.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.ico'='image/x-icon'}
try {
 while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
   $raw = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
   if (-not $raw) { $raw='index.html' }
   $path = [IO.Path]::GetFullPath((Join-Path $root ($raw.Replace('/', [IO.Path]::DirectorySeparatorChar))))
   if (-not $path.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { $ctx.Response.StatusCode=403 }
   elseif (-not [IO.File]::Exists($path)) { $ctx.Response.StatusCode=404 }
   else {
     $data = [IO.File]::ReadAllBytes($path)
     $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
     if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType=$mime[$ext] } else { $ctx.Response.ContentType='application/octet-stream' }
     $ctx.Response.Headers['Cache-Control']='no-store'
     $ctx.Response.ContentLength64=$data.Length
     $ctx.Response.OutputStream.Write($data,0,$data.Length)
   }
  } catch { Write-Warning $_.Exception.Message; $ctx.Response.StatusCode=500 }
  finally { $ctx.Response.Close() }
 }
} finally { $listener.Close() }

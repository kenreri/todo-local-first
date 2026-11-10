param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://127.0.0.1:5173/'
$logPath = Join-Path $env:TEMP 'ListsTodo-start.log'
$startupLock = New-Object System.Threading.Mutex($false, 'Local\ListsTodoLauncher5173')
$hasLock = $false

function Test-AppReady {
    try {
        $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
        return ($response.StatusCode -eq 200 -and $response.Content.Contains('/src/main.tsx'))
    } catch {
        return $false
    }
}

try {
    $hasLock = $startupLock.WaitOne(30000)
    if (-not $hasLock) { throw '启动正在进行，请稍后重试。' }

    if (-not (Test-AppReady)) {
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\vite\bin\vite.js'))) {
            throw '项目依赖尚未安装，请在项目目录先运行 pnpm install。'
        }
        $pnpmPath = (Get-Command pnpm.cmd -ErrorAction Stop).Source
        # Keep the console hidden and the service independent of the launcher.
        $arguments = '/d /s /c ""{0}" dev > "{1}" 2>&1"' -f $pnpmPath, $logPath
        $server = Start-Process -FilePath $env:ComSpec -ArgumentList $arguments `
            -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

        $ready = $false
        $deadline = (Get-Date).AddSeconds(30)
        do {
            if (Test-AppReady) { $ready = $true; break }
            if ($server.HasExited) { break }
            Start-Sleep -Milliseconds 400
        } while ((Get-Date) -lt $deadline)
        if (-not $ready) {
            throw "启动失败，可能是 5173 端口已被占用。启动日志：$logPath"
        }
    }
    if (-not $NoBrowser) { Start-Process $appUrl }
} catch {
    if ($NoBrowser) { throw }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, '清单启动失败', 'OK', 'Error') | Out-Null
    exit 1
} finally {
    if ($hasLock) { $startupLock.ReleaseMutex() }
    $startupLock.Dispose()
}

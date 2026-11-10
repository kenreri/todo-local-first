Add-Type -AssemblyName System.Drawing
$outDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'assets\desktop'
$bitmap = [System.Drawing.Bitmap]::new(256,256)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)
$path = [System.Drawing.Drawing2D.GraphicsPath]::new()
$path.AddArc(12,12,100,100,180,90)
$path.AddArc(144,12,100,100,270,90)
$path.AddArc(144,144,100,100,0,90)
$path.AddArc(12,144,100,100,90,90)
$path.CloseFigure()
$gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Point]::new(16,16),[System.Drawing.Point]::new(240,240),[System.Drawing.ColorTranslator]::FromHtml('#FF8AB5'),[System.Drawing.ColorTranslator]::FromHtml('#D95488'))
$g.FillPath($gradient,$path)
$checkPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White,12)
$checkPen.StartCap='Round'; $checkPen.EndCap='Round'; $checkPen.LineJoin='Round'
$linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(235,255,255,255),12)
$linePen.StartCap='Round'; $linePen.EndCap='Round'
foreach ($y in @(76,128)) {
    $g.DrawLines($checkPen,[System.Drawing.Point[]]@([System.Drawing.Point]::new(56,$y),[System.Drawing.Point]::new(67,($y+11)),[System.Drawing.Point]::new(87,($y-12))))
    $g.DrawLine($linePen,112,$y,193,$y)
}
$dotBrush=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(150,255,255,255))
$g.FillEllipse($dotBrush,60,172,15,15)
$g.DrawLine($linePen,112,180,167,180)
$bitmap.Save((Join-Path $outDir 'todo-sakura.png'),[System.Drawing.Imaging.ImageFormat]::Png)
# PNG-compressed ICO frames supported by Windows; include small and high-DPI sizes.
$frames=@()
foreach ($size in @(16,24,32,48,64,128,256)) {
    $frame=[System.Drawing.Bitmap]::new($size,$size)
    $fg=[System.Drawing.Graphics]::FromImage($frame)
    $fg.InterpolationMode='HighQualityBicubic'
    $fg.DrawImage($bitmap,0,0,$size,$size)
    $ms=[System.IO.MemoryStream]::new()
    $frame.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png)
    $frames+=,@{Size=$size;Bytes=$ms.ToArray()}
    $ms.Dispose();$fg.Dispose();$frame.Dispose()
}
$stream=[System.IO.File]::Create((Join-Path $outDir 'todo-sakura.ico'))
$writer=[System.IO.BinaryWriter]::new($stream)
$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$frames.Count)
$offset=6+16*$frames.Count
foreach($f in $frames) {
    $dimension=if($f.Size -eq 256){0}else{$f.Size}
    $writer.Write([byte]$dimension);$writer.Write([byte]$dimension)
    $writer.Write([byte]0);$writer.Write([byte]0)
    $writer.Write([uint16]1);$writer.Write([uint16]32)
    $writer.Write([uint32]$f.Bytes.Length);$writer.Write([uint32]$offset)
    $offset+=$f.Bytes.Length
}
foreach($f in $frames){$writer.Write([byte[]]$f.Bytes)}
$writer.Dispose();$g.Dispose();$bitmap.Dispose();$path.Dispose();$gradient.Dispose();$checkPen.Dispose();$linePen.Dispose();$dotBrush.Dispose()

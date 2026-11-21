Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "..\public\ms-logo.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source icon not found at $sourcePath"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))
$resRoot = Join-Path $PSScriptRoot "..\android\app\src\main\res"

$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($entry in $sizes.GetEnumerator()) {
    $folder = Join-Path $resRoot $entry.Key
    $sz = $entry.Value

    $destBmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $g.DrawImage($srcImg, 0, 0, $sz, $sz)
    $g.Dispose()

    # Save ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
    $destBmp.Save((Join-Path $folder "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Save((Join-Path $folder "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Save((Join-Path $folder "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()

    Write-Host "Generated $($entry.Key) icons ($sz x $sz)"
}

$srcImg.Dispose()
Write-Host "All Android icons successfully replaced with M&S logo!"


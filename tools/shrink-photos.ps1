# Shrinks private/raw/*.png to JPEG (long side $Size px, default 600) in private/photos, and makes numbered
# contact sheets (4 x 3) in private/sheets for tagging. Windows PowerShell 5.1, no installs.
param([string]$Root = (Split-Path -Parent $PSScriptRoot), [int]$Size = 600)
Add-Type -AssemblyName System.Drawing
$raw = Join-Path $Root 'private\raw'
$out = Join-Path $Root 'private\photos'
$sheets = Join-Path $Root 'private\sheets'
New-Item -ItemType Directory -Force $out, $sheets | Out-Null
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]80)

$files = Get-ChildItem $raw -Filter *.png | Sort-Object Name
foreach ($f in $files) {
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $k = [Math]::Min(1.0, [double]$Size / [Math]::Max($img.Width, $img.Height))
  $w = [int]($img.Width * $k); $h = [int]($img.Height * $k)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, 0, 0, $w, $h)
  $bmp.Save((Join-Path $out ($f.BaseName + '.jpg')), $jpeg, $params)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}

$jpgs = Get-ChildItem $out -Filter *.jpg | Sort-Object Name
$cols = 4; $rows = 3; $cw = 240; $ch = 320; $per = $cols * $rows
$font = New-Object System.Drawing.Font 'Arial', 18, ([System.Drawing.FontStyle]::Bold)
for ($s = 0; $s * $per -lt $jpgs.Count; $s++) {
  $sheet = New-Object System.Drawing.Bitmap ($cols * $cw), ($rows * $ch)
  $g = [System.Drawing.Graphics]::FromImage($sheet)
  $g.Clear([System.Drawing.Color]::White)
  for ($i = 0; $i -lt $per; $i++) {
    $idx = $s * $per + $i
    if ($idx -ge $jpgs.Count) { break }
    $img = [System.Drawing.Image]::FromFile($jpgs[$idx].FullName)
    $k = [Math]::Min(($cw - 8) / $img.Width, ($ch - 8) / $img.Height)
    $x = ($i % $cols) * $cw + 4; $y = [Math]::Floor($i / $cols) * $ch + 4
    $g.DrawImage($img, $x, $y, [int]($img.Width * $k), [int]($img.Height * $k))
    $g.FillRectangle([System.Drawing.Brushes]::Black, $x, $y, 52, 28)
    $g.DrawString($jpgs[$idx].BaseName.Replace('photo-', ''), $font, [System.Drawing.Brushes]::Yellow, $x + 2, $y + 1)
    $img.Dispose()
  }
  $sheet.Save((Join-Path $sheets ("sheet-{0:D2}.jpg" -f ($s + 1))), $jpeg, $params)
  $g.Dispose(); $sheet.Dispose()
}
"photos: $($jpgs.Count), sheets: $([Math]::Ceiling($jpgs.Count / $per))"

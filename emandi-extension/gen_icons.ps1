Add-Type -AssemblyName System.Drawing

function CreateMandiIcon {
  param(
    [string]$outputPath,
    [string]$dotColor
  )

  $size = 128
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # Dark rounded background
  $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
  $g.FillEllipse($bgBrush, 4, 4, 120, 120)

  # Orange database cylinders
  $orange = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 249, 115, 22))
  $g.FillEllipse($orange, 24, 18, 60, 14)
  $g.FillRectangle($orange, 24, 25, 60, 12)
  $g.FillEllipse($orange, 24, 33, 60, 14)
  $g.FillEllipse($orange, 24, 50, 60, 14)
  $g.FillRectangle($orange, 24, 57, 60, 12)
  $g.FillEllipse($orange, 24, 65, 60, 14)
  $g.FillEllipse($orange, 24, 78, 60, 14)
  $g.FillRectangle($orange, 24, 85, 60, 10)

  # Green leaf arc
  $greenPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), 6)
  $greenPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $greenPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($greenPen, 18, 28, 72, 72, 20, 290)

  # Status dot white border + color fill
  if ($dotColor -eq 'green') {
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
  } else {
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 239, 68, 68))
  }
  $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillEllipse($whiteBrush, 88, 88, 34, 34)
  $g.FillEllipse($dotBrush, 92, 92, 26, 26)

  $g.Dispose()
  $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Saved: $outputPath"
}

CreateMandiIcon -outputPath "c:\RAMAN DUGGAL\JRMD SOFTWARE\studio\emandi-extension\icon_connected.png" -dotColor "green"
CreateMandiIcon -outputPath "c:\RAMAN DUGGAL\JRMD SOFTWARE\studio\emandi-extension\icon_disconnected.png" -dotColor "red"
CreateMandiIcon -outputPath "c:\RAMAN DUGGAL\JRMD SOFTWARE\studio\emandi-extension\icon.png" -dotColor "green"
Write-Host "All icons generated."

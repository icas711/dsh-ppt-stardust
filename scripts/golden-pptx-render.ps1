param(
  [Parameter(Mandatory=$true)][string]$SourcePath,
  [Parameter(Mandatory=$true)][string]$ActualPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [Parameter(Mandatory=$true)][ValidateSet('source','actual')][string]$Only
)
$ErrorActionPreference = 'Stop'
$goldenExistingPids = @(Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$goldenApp = New-Object -ComObject PowerPoint.Application
$goldenOwnsApp = $goldenApp.Presentations.Count -eq 0
$goldenNewPids = @(Get-Process POWERPNT -ErrorAction SilentlyContinue | Where-Object { $_.Id -notin $goldenExistingPids } | Select-Object -ExpandProperty Id)
$goldenRecords = @()
try {
  foreach ($goldenInput in @(@{ key='source'; path=$SourcePath }, @{ key='actual'; path=$ActualPath })) {
    if ($goldenInput.key -ne $Only) { continue }
    # Each input is an isolated test copy. Open read-only, without a window.
    $goldenDeck = $goldenApp.Presentations.Open($goldenInput.path, -1, 0, 0)
    try {
      $goldenWidth = 1440
      $goldenHeight = [int][Math]::Round($goldenWidth * $goldenDeck.PageSetup.SlideHeight / $goldenDeck.PageSetup.SlideWidth)
      for ($goldenIndex=1; $goldenIndex -le $goldenDeck.Slides.Count; $goldenIndex++) {
        $goldenDeck.Slides.Item($goldenIndex).Export((Join-Path $OutputDirectory "$($goldenInput.key)-$goldenIndex.png"), 'PNG', $goldenWidth, $goldenHeight)
        foreach ($goldenShape in $goldenDeck.Slides.Item($goldenIndex).Shapes) {
          if ($goldenShape.HasTextFrame -and $goldenShape.TextFrame.HasText) {
            $goldenText = $goldenShape.TextFrame.TextRange
            $goldenRecords += @{
              deck=$goldenInput.key; slide=$goldenIndex; text=$goldenText.Text.Trim(); name=$goldenShape.Name;
              excludedField=($goldenShape.Type -eq 14 -and $goldenShape.PlaceholderFormat.Type -in @(13,14,15,16));
              sizePt=$goldenText.Font.Size; bold=$goldenText.Font.Bold; colorRgb=$goldenText.Font.Color.RGB;
              alignment=$goldenText.ParagraphFormat.Alignment;
              marginLeftPt=$goldenShape.TextFrame.MarginLeft; marginTopPt=$goldenShape.TextFrame.MarginTop;
              widthPt=$goldenDeck.PageSetup.SlideWidth; heightPt=$goldenDeck.PageSetup.SlideHeight
            }
          }
        }
      }
    } finally { $goldenDeck.Close() }
  }
} finally {
  if ($goldenOwnsApp) { $goldenApp.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($goldenApp) | Out-Null
  $goldenText = $null; $goldenShape = $null; $goldenDeck = $null; $goldenApp = $null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  if ($goldenOwnsApp) { foreach ($goldenPid in $goldenNewPids) { Wait-Process -Id $goldenPid -Timeout 10 -ErrorAction SilentlyContinue } }
}
ConvertTo-Json -InputObject @($goldenRecords) -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDirectory "$Only-properties.json") -Encoding utf8

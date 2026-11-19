param(
  [string]$Directory = (Join-Path (Get-Location) '.test-output/chart-capabilities')
)
$ErrorActionPreference = 'Stop'
$probeInput = [System.IO.Path]::GetFullPath((Join-Path $Directory 'updated.pptx'))
$probeExistingPids = @(Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$probeApp = New-Object -ComObject PowerPoint.Application
$probeOwnsApp = $probeExistingPids.Count -eq 0 -and $probeApp.Presentations.Count -eq 0
$probeDeck = $null
$probeRecords = @()
try {
  $probeDeck = $probeApp.Presentations.Open($probeInput, -1, 0, 0)
  if ($probeDeck.Slides.Count -ne 2) { throw 'Expected two probe slides' }
  foreach ($probeSlide in $probeDeck.Slides) {
    foreach ($probeShape in $probeSlide.Shapes) {
      if ($probeShape.HasChart -eq -1) {
        $probeValues = @($probeShape.Chart.SeriesCollection(1).Values)
        $probeRecords += @{ slide=$probeSlide.SlideIndex; name=$probeShape.Name; chartType=$probeShape.Chart.ChartType; values=$probeValues }
      }
    }
  }
  if ($probeRecords.Count -ne 8) { throw 'Expected eight native PowerPoint charts' }
  if ($probeRecords[0].values.Count -ne 2 -or $probeRecords[0].values[0] -ne 18 -or $probeRecords[0].values[1] -ne 4) { throw 'Native chart values must be 18 and 4' }
} finally {
  if ($null -ne $probeDeck) { $probeDeck.Close() }
  if ($probeOwnsApp) { $probeApp.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($probeApp) | Out-Null
  $probeSlide=$null; $probeShape=$null; $probeDeck=$null; $probeApp=$null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
ConvertTo-Json -InputObject @($probeRecords) -Depth 5 | Set-Content -LiteralPath (Join-Path $Directory 'native-report.json') -Encoding utf8
Write-Output 'Verified eight native PowerPoint charts; updated values are 18 and 4.'

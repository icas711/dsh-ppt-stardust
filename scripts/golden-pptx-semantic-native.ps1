param(
 [string]$SourceRoot='.test-output/pptx-synthetic-render/scenes',
 [string]$OutputDirectory='.test-output/generation-semantic-native'
)
# Optional Windows companion to the mandatory portable golden. Public fixtures only.
$ErrorActionPreference='Stop'
$semanticRoot=(Resolve-Path -LiteralPath $SourceRoot).Path
$semanticOutput=[IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $semanticOutput -Force|Out-Null
$semanticRun=Get-Content -LiteralPath (Join-Path $semanticRoot 'run.json') -Raw|ConvertFrom-Json
$semanticApp=New-Object -ComObject PowerPoint.Application
$semanticOwnsApp=$semanticApp.Presentations.Count -eq 0
$semanticCases=@()
try {
 foreach($semanticCase in $semanticRun.cases|Where-Object {$_.id -like 'semantic-*'}) {
  $semanticDir=Join-Path $semanticOutput $semanticCase.id
  New-Item -ItemType Directory -Path $semanticDir -Force|Out-Null
  foreach($semanticSide in @('source','actual')) {
   $semanticDeck=$semanticApp.Presentations.Open((Join-Path (Join-Path $semanticRoot $semanticCase.id) ($semanticSide+'.pptx')),-1,0,0)
   try {
    if($semanticDeck.Slides.Count -ne 1){throw 'Expected one-slide public fixture'}
    $semanticHeight=[int][Math]::Round(1440*$semanticDeck.PageSetup.SlideHeight/$semanticDeck.PageSetup.SlideWidth)
    $semanticDeck.Slides.Item(1).Export((Join-Path $semanticDir ($semanticSide+'.png')),'PNG',1440,$semanticHeight)
   } finally {$semanticDeck.Close()}
  }
  $semanticCases+=@{id=$semanticCase.id;pageSize=$semanticCase.pageSize;regions=$semanticCase.regions}
 }
 if($semanticCases.Count -ne 7){throw 'Expected all seven semantic public fixtures; run npm run test:pptx-render first'}
 @{renderer=@{backend='Microsoft PowerPoint';version=$semanticApp.Version};fontVerification='Requested font families match; OS substitutions are not independently verified';cases=$semanticCases}|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $semanticOutput 'run.json') -Encoding utf8NoBOM
} finally {
 if($semanticOwnsApp -and $semanticApp.Presentations.Count -eq 0){$semanticApp.Quit()}
 [System.Runtime.InteropServices.Marshal]::ReleaseComObject($semanticApp)|Out-Null
 [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
& python (Join-Path $PSScriptRoot 'golden-pptx-scenes-metrics.py') $semanticOutput
if($LASTEXITCODE -ne 0){throw 'Native semantic fidelity failed'}

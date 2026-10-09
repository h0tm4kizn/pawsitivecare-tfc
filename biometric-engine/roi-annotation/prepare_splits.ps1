param(
    [string]$WorkRoot = (Join-Path $PSScriptRoot 'work')
)

$ErrorActionPreference = 'Stop'

function Prepare-Species {
    param(
        [string]$Species,
        [string]$ClassName
    )

    $sourceImages = Join-Path $WorkRoot "$Species\images"
    $sourceLabels = Join-Path $WorkRoot "$Species\labels"
    $outputRoot = Join-Path $WorkRoot "$Species-yolo"

    $images = @(Get-ChildItem -LiteralPath $sourceImages -File | Where-Object {
        $_.Extension.ToLowerInvariant() -in @('.jpg', '.jpeg', '.png')
    } | Sort-Object Name)

    if ($images.Count -ne 50) {
        throw "$Species requires exactly 50 source images; found $($images.Count)."
    }

    foreach ($split in @('train', 'val', 'test')) {
        New-Item -ItemType Directory -Force -Path (Join-Path $outputRoot "$split\images") | Out-Null
        New-Item -ItemType Directory -Force -Path (Join-Path $outputRoot "$split\labels") | Out-Null
    }

    for ($index = 0; $index -lt $images.Count; $index++) {
        $split = if ($index -lt 35) { 'train' } elseif ($index -lt 42) { 'val' } else { 'test' }
        $image = $images[$index]
        $label = Join-Path $sourceLabels ($image.BaseName + '.txt')
        if (-not (Test-Path -LiteralPath $label)) {
            throw "Missing label for $($image.Name)."
        }

        Copy-Item -LiteralPath $image.FullName -Destination (Join-Path $outputRoot "$split\images\$($image.Name)") -Force
        Copy-Item -LiteralPath $label -Destination (Join-Path $outputRoot "$split\labels\$($image.BaseName).txt") -Force
    }

    $yaml = @(
        "path: $($outputRoot.Replace('\', '/'))",
        'train: train/images',
        'val: val/images',
        'test: test/images',
        'names:',
        "  0: $ClassName"
    ) -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $outputRoot 'data.yaml') -Value $yaml -Encoding utf8

    Write-Output "$Species split: train=35, val=7, test=8"
}

Prepare-Species -Species 'dog' -ClassName 'dog_nose'
Prepare-Species -Species 'cat' -ClassName 'cat_face'

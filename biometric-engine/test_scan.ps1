param(
    [string]$ImagePath = "dog-noseprint/dataset/dog1/test/image1.5 (dark zoom).jpg"
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  PAWSITIVECARE BIOMETRIC SCAN TEST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Scanning image: $ImagePath`n" -ForegroundColor Yellow

$response = curl.exe -X POST "http://127.0.0.1:8000/scanning" -F "file=@$ImagePath" | ConvertFrom-Json

Write-Host "BEST MATCH:" -ForegroundColor Green
Write-Host "  Image ID    : $($response.best_match.image_id)"
Write-Host "  Image Path  : $($response.best_match.image_path)"
Write-Host "  Score       : $($response.best_match.similarity_score)"

Write-Host "`nALL HIGH MATCHES (Threshold: $($response.threshold)):" -ForegroundColor Green
Write-Host "  Total Found : $($response.total_matches_above_threshold)`n"

foreach ($match in $response.all_high_matches) {
    $scorePercent = [math]::Round($match.similarity_score * 100, 2)
    Write-Host "  [$($match.image_id)] $($match.image_path)" -ForegroundColor White
    Write-Host "      Score: $scorePercent%" -ForegroundColor $(if ($match.similarity_score -ge 0.95) { "Green" } elseif ($match.similarity_score -ge 0.85) { "Yellow" } else { "Red" })
    Write-Host ""
}

Write-Host "========================================`n" -ForegroundColor Cyan

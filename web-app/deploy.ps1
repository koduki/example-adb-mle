$PROJECT_ID = "YOUR_PROJECT_ID"
$REGION = "asia-northeast1"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/sneaker-api"

Write-Host "Setting gcloud project to $PROJECT_ID..."
cmd /c "gcloud config set project $PROJECT_ID"

Write-Host "Building Container Image in project $PROJECT_ID..."
cmd /c "gcloud builds submit --tag $IMAGE_NAME --project $PROJECT_ID ."

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed."
    exit $LASTEXITCODE
}

Write-Host "Updating service.yaml..."
(Get-Content service.yaml) -replace 'IMAGE_PLACEHOLDER', $IMAGE_NAME | Set-Content service.yaml

Write-Host "Deploying to Cloud Run in project $PROJECT_ID..."
cmd /c "gcloud run services replace service.yaml --region $REGION --project $PROJECT_ID"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed."
    exit $LASTEXITCODE
}

Write-Host "Deployment Successful!"

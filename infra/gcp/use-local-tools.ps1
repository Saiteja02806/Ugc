$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ToolsDir = Join-Path $RepoRoot ".tools"
$TerraformDir = Join-Path $ToolsDir "terraform"
$GcloudSdkDir = Join-Path $ToolsDir "google-cloud-sdk"
$GcloudConfigDir = Join-Path $ToolsDir "gcloud-config"
$ApplicationDefaultCredentials = Join-Path $GcloudConfigDir "application_default_credentials.json"

$env:Path = "$TerraformDir;$($GcloudSdkDir)\bin;$env:Path"
$env:CLOUDSDK_CONFIG = $GcloudConfigDir

if (Test-Path -LiteralPath $ApplicationDefaultCredentials) {
  $env:GOOGLE_APPLICATION_CREDENTIALS = $ApplicationDefaultCredentials
}

function global:terraform {
  & (Join-Path $TerraformDir "terraform.exe") @args
}

function global:gcloud {
  & (Join-Path $GcloudSdkDir "bin\gcloud.cmd") @args
}

Write-Host "Terraform:" (Join-Path $TerraformDir "terraform.exe")
Write-Host "gcloud:" (Join-Path $GcloudSdkDir "bin\gcloud.cmd")
Write-Host "CLOUDSDK_CONFIG:" $env:CLOUDSDK_CONFIG
if ($env:GOOGLE_APPLICATION_CREDENTIALS) {
  Write-Host "GOOGLE_APPLICATION_CREDENTIALS:" $env:GOOGLE_APPLICATION_CREDENTIALS
}

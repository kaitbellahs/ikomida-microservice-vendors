Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['*:ErrorAction']='Stop'
function ThrowOnNativeFailure {
    if (-not $?)
    {
        throw 'Native Failure'
    }
}
$projectid="ikomida-dev"
if($args.count -gt 0){
    $projectid=$args[0]
}
$nocache=""
if($args.count -gt 1){
    $nocache=$args[1]
}
$env:GOOGLE_SERVICE_ACCOUNT="REMOVED_GCP_SERVICE_ACCOUNT_KEY"

$GCLOUD_LOCATION="us-central1"
$NAME="vendors"
$TYPE="microservice"
$PACKAGE_VERSION="latest"
docker buildx build -o type=registry --cache-to=type=registry --cache-from=type=registry --build-arg BUILDKIT_INLINE_CACHE=1 -t $GCLOUD_LOCATION-docker.pkg.dev/$projectid/docker/$NAME-$TYPE-image:$PACKAGE_VERSION . --build-arg GOOGLE_SERVICE_ACCOUNT="$env:GOOGLE_SERVICE_ACCOUNT"  --build-arg NODEENV=devlopment --build-arg PROJECT_ID=$projectid $nocache
# docker build -t us-central1-docker.pkg.dev/$projectid/docker/gateway-microservice-image:latest . --build-arg GOOGLE_SERVICE_ACCOUNT="$env:GOOGLE_SERVICE_ACCOUNT"  --build-arg NODEENV=devlopment --build-arg PROJECT_ID=$projectid $nocache
ThrowOnNativeFailure

Get-ChildItem ".\k8s\" -Filter *.yaml | 
Foreach-Object {
    $content = Get-Content $_.FullName
    $content.replace('$PROJECT_ID', $projectid).replace('$GCLOUD_LOCATION', $GCLOUD_LOCATION).replace('$NAME', $NAME).replace('$TYPE', $TYPE).replace('$PACKAGE_VERSION', $PACKAGE_VERSION) | kubectl apply -f -
}
param(
    [string]$GeoServerUrl = "http://127.0.0.1:8080/geoserver",
    [string]$AdminUser = "admin",
    [string]$AdminPassword = "geoserver"
)

$ErrorActionPreference = "Stop"

$authPair = "${AdminUser}:${AdminPassword}"
$authToken = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($authPair))
$headers = @{
    Authorization = "Basic $authToken"
}

function Invoke-GeoServerRequest {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$ContentType = "text/xml"
    )

    $uri = "$GeoServerUrl$Path"

    if ($null -eq $Body) {
        return Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -UseBasicParsing
    }

    return Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -Body $Body -ContentType $ContentType -UseBasicParsing
}

function Test-GeoServerPath {
    param([string]$Path)

    try {
        Invoke-GeoServerRequest -Method "GET" -Path $Path | Out-Null
        return $true
    } catch {
        return $false
    }
}

Write-Host "A aguardar pelo GeoServer em $GeoServerUrl ..."

$ready = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
    if (Test-GeoServerPath -Path "/rest/about/version.xml") {
        $ready = $true
        break
    }

    Start-Sleep -Seconds 2
}

if (-not $ready) {
    throw "GeoServer nao ficou disponivel em $GeoServerUrl."
}

if (-not (Test-GeoServerPath -Path "/rest/workspaces/geoportal.xml")) {
    Write-Host "A criar workspace geoportal ..."
    $workspaceXml = @"
<workspace>
    <name>geoportal</name>
</workspace>
"@
    Invoke-GeoServerRequest -Method "POST" -Path "/rest/workspaces" -Body $workspaceXml | Out-Null
} else {
    Write-Host "Workspace geoportal ja existe."
}

if (-not (Test-GeoServerPath -Path "/rest/workspaces/geoportal/datastores/postgis_geoportal.xml")) {
    Write-Host "A criar datastore PostGIS postgis_geoportal ..."
    $datastoreXml = @"
<dataStore>
    <name>postgis_geoportal</name>
    <enabled>true</enabled>
    <connectionParameters>
        <entry key="dbtype">postgis</entry>
        <entry key="host">dbgis_igv</entry>
        <entry key="port">5432</entry>
        <entry key="database">geoportal_db</entry>
        <entry key="schema">public</entry>
        <entry key="user">postgres</entry>
        <entry key="passwd">postgres</entry>
        <entry key="Expose primary keys">true</entry>
    </connectionParameters>
</dataStore>
"@
    Invoke-GeoServerRequest -Method "POST" -Path "/rest/workspaces/geoportal/datastores" -Body $datastoreXml | Out-Null
} else {
    Write-Host "Datastore postgis_geoportal ja existe."
}

if (-not (Test-GeoServerPath -Path "/rest/layers/geoportal:features.xml")) {
    Write-Host "A publicar tabela public.features como camada WMS geoportal:features ..."
    $featureTypeXml = @"
<featureType>
    <name>features</name>
    <nativeName>features</nativeName>
    <title>GeoPortal Features</title>
    <srs>EPSG:4326</srs>
    <enabled>true</enabled>
</featureType>
"@
    Invoke-GeoServerRequest -Method "POST" -Path "/rest/workspaces/geoportal/datastores/postgis_geoportal/featuretypes?recalculate=nativebbox,latlonbbox" -Body $featureTypeXml | Out-Null
} else {
    Write-Host "Camada geoportal:features ja existe."
}

Write-Host "GeoServer configurado."
Write-Host "WMS: $GeoServerUrl/geoportal/wms"
Write-Host "Camada: geoportal:features"

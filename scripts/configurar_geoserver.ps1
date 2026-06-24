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

function Publish-PostGISLayer {
    param(
        [string]$Name,
        [string]$Title
    )

    if (-not (Test-GeoServerPath -Path "/rest/layers/geoportal:$Name.xml")) {
        Write-Host "A publicar tabela public.$Name como camada WMS geoportal:$Name ..."
        $featureTypeXml = @"
<featureType>
    <name>$Name</name>
    <nativeName>$Name</nativeName>
    <title>$Title</title>
    <srs>EPSG:4326</srs>
    <enabled>true</enabled>
</featureType>
"@
        Invoke-GeoServerRequest -Method "POST" -Path "/rest/workspaces/geoportal/datastores/postgis_geoportal/featuretypes?recalculate=nativebbox,latlonbbox" -Body $featureTypeXml | Out-Null
    } else {
        Write-Host "Camada geoportal:$Name ja existe."
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

Publish-PostGISLayer -Name "features" -Title "GeoPortal Features"
Publish-PostGISLayer -Name "areas_estudo" -Title "Area de Estudo"

$areaStyleSld = @"
<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd">
    <NamedLayer>
        <Name>area_estudo_style</Name>
        <UserStyle>
            <Title>Area de Estudo</Title>
            <FeatureTypeStyle>
                <Rule>
                    <PolygonSymbolizer>
                        <Fill>
                            <CssParameter name="fill">#2563eb</CssParameter>
                            <CssParameter name="fill-opacity">0.10</CssParameter>
                        </Fill>
                        <Stroke>
                            <CssParameter name="stroke">#1d4ed8</CssParameter>
                            <CssParameter name="stroke-width">3</CssParameter>
                        </Stroke>
                    </PolygonSymbolizer>
                </Rule>
            </FeatureTypeStyle>
        </UserStyle>
    </NamedLayer>
</StyledLayerDescriptor>
"@

if (-not (Test-GeoServerPath -Path "/rest/workspaces/geoportal/styles/area_estudo_style.xml")) {
    Write-Host "A criar estilo area_estudo_style ..."
    $styleXml = @"
<style>
    <name>area_estudo_style</name>
    <filename>area_estudo_style.sld</filename>
</style>
"@
    Invoke-GeoServerRequest -Method "POST" -Path "/rest/workspaces/geoportal/styles" -Body $styleXml | Out-Null
} else {
    Write-Host "Estilo area_estudo_style ja existe."
}

Invoke-GeoServerRequest -Method "PUT" -Path "/rest/workspaces/geoportal/styles/area_estudo_style" -Body $areaStyleSld -ContentType "application/vnd.ogc.sld+xml" | Out-Null

$layerStyleXml = @"
<layer>
    <defaultStyle>
        <name>area_estudo_style</name>
    </defaultStyle>
</layer>
"@
Invoke-GeoServerRequest -Method "PUT" -Path "/rest/layers/geoportal:areas_estudo" -Body $layerStyleXml | Out-Null

Write-Host "GeoServer configurado."
Write-Host "WMS: $GeoServerUrl/geoportal/wms"
Write-Host "Camada: geoportal:features"
Write-Host "Camada geral: geoportal:areas_estudo"

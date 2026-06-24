# GeoPortal

Aplicacao Web para gerir e visualizar dados geograficos com PostGIS,
GeoServer, Flask e Leaflet.

## Tecnologias

- PostgreSQL + PostGIS
- GeoServer
- Flask
- Leaflet
- pgAdmin
- Docker Compose

## Arranque

Subir PostGIS, pgAdmin e GeoServer:

```powershell
docker compose -f docker-compose-bd202526.yaml up -d
```

Configurar o GeoServer para publicar as tabelas `features` e `areas_estudo` como WMS:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\configurar_geoserver.ps1
```

Arrancar o backend Flask:

```powershell
cd backend
.\venv\Scripts\python.exe app.py
```

Arrancar o frontend:

```powershell
cd frontend
python -m http.server 8000
```

Abrir no browser:

```text
http://127.0.0.1:8000
```

## Servicos

- Frontend: `http://127.0.0.1:8000`
- Backend: `http://127.0.0.1:5000`
- pgAdmin: `http://127.0.0.1:5050`
- GeoServer: `http://127.0.0.1:8080/geoserver`
- WMS: `http://127.0.0.1:8080/geoserver/geoportal/wms`
- Camadas WMS: `geoportal:features`, `geoportal:areas_estudo`

Credenciais locais:

- PostgreSQL: `postgres` / `postgres`
- pgAdmin: `admin@pgadmin.org` / `admin`
- GeoServer: `admin` / `geoserver`

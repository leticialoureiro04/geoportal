CREATE TABLE IF NOT EXISTS areas_estudo (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    geom geometry(Polygon, 4326) NOT NULL
);

INSERT INTO areas_estudo (name, description, geom)
SELECT
    'Area de estudo - Viana do Castelo',
    'Poligono simples usado como camada geral publicada pelo GeoServer.',
    ST_GeomFromText(
        'POLYGON((-8.91 41.64, -8.73 41.64, -8.73 41.76, -8.91 41.76, -8.91 41.64))',
        4326
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM areas_estudo
    WHERE name = 'Area de estudo - Viana do Castelo'
);

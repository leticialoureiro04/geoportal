CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS themes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    geometry_type VARCHAR(20) NOT NULL,
    color VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS features (
    id SERIAL PRIMARY KEY,
    theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
    name VARCHAR(100),
    description TEXT,
    geom geometry(Point, 4326)
);

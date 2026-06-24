ALTER TABLE features
ALTER COLUMN geom TYPE geometry(Geometry, 4326)
USING geom;

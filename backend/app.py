from flask import Flask, jsonify, request
from flask_cors import CORS
from db import get_connection

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return "GeoPortal API"


@app.route("/themes", methods=["GET"])
def get_themes():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, name, geometry_type, color
        FROM themes
        ORDER BY id
    """)

    rows = cur.fetchall()

    themes = []

    for row in rows:
        themes.append({
            "id": row[0],
            "name": row[1],
            "geometry_type": row[2],
            "color": row[3]
        })

    cur.close()
    conn.close()

    return jsonify(themes)


@app.route("/themes", methods=["POST"])
def create_theme():
    data = request.get_json()

    name = data["name"]
    geometry_type = data["geometry_type"]
    color = data["color"]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO themes (name, geometry_type, color)
        VALUES (%s, %s, %s)
    """, (name, geometry_type, color))

    conn.commit()

    cur.close()
    conn.close()

    return {
        "message": "Tema criado com sucesso"
    }, 201


@app.route("/features", methods=["GET"])
def get_features():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            id,
            theme_id,
            name,
            description,
            ST_X(geom),
            ST_Y(geom)
        FROM features
        ORDER BY id
    """)

    rows = cur.fetchall()

    features = []

    for row in rows:
        features.append({
            "id": row[0],
            "theme_id": row[1],
            "name": row[2],
            "description": row[3],
            "lng": row[4],
            "lat": row[5]
        })

    cur.close()
    conn.close()

    return jsonify(features)


@app.route("/features/nearby", methods=["GET"])
def get_nearby_features():
    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)
    radius = request.args.get("radius", default=500, type=float)

    if lat is None or lng is None:
        return {
            "error": "Os parametros lat e lng sao obrigatorios."
        }, 400

    if radius <= 0:
        return {
            "error": "O raio deve ser superior a zero."
        }, 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            f.id,
            f.theme_id,
            t.name,
            f.name,
            f.description,
            ST_X(f.geom),
            ST_Y(f.geom),
            ST_Distance(
                f.geom::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            ) AS distance_m
        FROM features f
        JOIN themes t ON t.id = f.theme_id
        WHERE ST_DWithin(
            f.geom::geography,
            ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
            %s
        )
        ORDER BY distance_m
    """, (
        lng,
        lat,
        lng,
        lat,
        radius
    ))

    rows = cur.fetchall()

    nearby_features = []

    for row in rows:
        nearby_features.append({
            "id": row[0],
            "theme_id": row[1],
            "theme_name": row[2],
            "name": row[3],
            "description": row[4],
            "lng": row[5],
            "lat": row[6],
            "distance_m": round(row[7], 2)
        })

    cur.close()
    conn.close()

    return jsonify({
        "lat": lat,
        "lng": lng,
        "radius": radius,
        "count": len(nearby_features),
        "features": nearby_features
    })


@app.route("/features", methods=["POST"])
def create_feature():
    data = request.get_json()

    theme_id = data["theme_id"]
    name = data["name"]
    description = data["description"]
    lat = data["lat"]
    lng = data["lng"]

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO features (theme_id, name, description, geom)
        VALUES (
            %s,
            %s,
            %s,
            ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        )
    """, (
        theme_id,
        name,
        description,
        lng,
        lat
    ))

    conn.commit()

    cur.close()
    conn.close()

    return {
        "message": "Elemento criado com sucesso"
    }, 201


if __name__ == "__main__":
    app.run(debug=True)

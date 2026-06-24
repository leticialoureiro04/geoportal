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
import io
import base64
import uuid
import json
import hashlib

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# "Base de datos" en memoria — simula almacenamiento off-chain de metadatos
# ---------------------------------------------------------------------------

POI_DATABASE = {
    "1": {
        "name": "Plaza Mayor",
        "description": "Corazon historico de la ciudad, fundada en 1550.",
        "image": "https://images.unsplash.com/photo-1474181487882-5ce6c4b29737?w=400",
        "latitude": 4.5981,
        "longitude": -74.0761,
        "city": "Bogota",
        "country": "Colombia",
    },
    "2": {
        "name": "Museo del Oro",
        "description": "Coleccion de mas de 34.000 piezas de oro prehispanico.",
        "image": "https://images.unsplash.com/photo-1564507592333-c46058f61fb6?w=400",
        "latitude": 4.6012,
        "longitude": -74.0710,
        "city": "Bogota",
        "country": "Colombia",
    },
    "3": {
        "name": "Monserrate",
        "description": "Cerro iconico a 3.152m de altura con vista panoramica.",
        "image": "https://images.unsplash.com/photo-1589909202802-8f4aadce06d4?w=400",
        "latitude": 4.6015,
        "longitude": -74.0644,
        "city": "Bogota",
        "country": "Colombia",
    },
    "4": {
        "name": "La Candelaria",
        "description": "Barrio colonial con arte callejero y cultura bohemica.",
        "image": "https://images.unsplash.com/photo-1520110168868-37c2c5e95d76?w=400",
        "latitude": 4.5950,
        "longitude": -74.0710,
        "city": "Bogota",
        "country": "Colombia",
    },
}

BUSINESS_DATABASE = {
    "b1": {
        "name": "Cafe San Alberto",
        "description": "Cafe de especialidad Tiquetio. Promocion: Cafe americano + postre.",
        "image": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400",
        "latitude": 4.5985,
        "longitude": -74.0755,
        "price_lamports": 100_000_000,
        "wallet": "9xQeWvG816bUx9EPa7XW2oQp4ms9tY3bF5nD7sK2mNvR",
    },
    "b2": {
        "name": "Artesania La Giralda",
        "description": "Shop de artesanias locales. Promocion: Mochila Wayuu original.",
        "image": "https://images.unsplash.com/photo-1528459804568-33145c0e9c49?w=400",
        "latitude": 4.5970,
        "longitude": -74.0740,
        "price_lamports": 250_000_000,
        "wallet": "7xQeWvG816bUx9EPa7XW2oQp4ms9tY3bF5nD7sK2mNvR",
    },
    "b3": {
        "name": "Restaurante La Puerta Falsa",
        "description": "Comida tradicional bogotana. Promocion: Ajiaco santafereo.",
        "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400",
        "latitude": 4.5980,
        "longitude": -74.0760,
        "price_lamports": 500_000_000,
        "wallet": "5xQeWvG816bUx9EPa7XW2oQp4ms9tY3bF5nD7sK2mNvR",
    },
}

METADATA_STORE = {}

# ---------------------------------------------------------------------------
# Endpoints — Token URI (Metadatos NFT / POAP)
# ---------------------------------------------------------------------------

@app.route("/api/metadata/poi/<poi_id>", methods=["GET"])
def get_poi_metadata(poi_id):
    poi = POI_DATABASE.get(poi_id)
    if not poi:
        return jsonify({"error": "POI no encontrado"}), 404

    metadata = {
        "name": f"Huellazo - {poi['name']}",
        "symbol": "HUELLAZO",
        "description": poi["description"],
        "image": poi["image"],
        "external_url": f"https://huellazo.app/poi/{poi_id}",
        "attributes": [
            {"trait_type": "Tipo", "value": "Lugar Turistico"},
            {"trait_type": "Ciudad", "value": poi["city"]},
            {"trait_type": "Pais", "value": poi["country"]},
            {"trait_type": "Latitud", "value": poi["latitude"]},
            {"trait_type": "Longitud", "value": poi["longitude"]},
        ],
    }
    return jsonify(metadata)


@app.route("/api/metadata/business/<business_id>", methods=["GET"])
def get_business_metadata(business_id):
    biz = BUSINESS_DATABASE.get(business_id)
    if not biz:
        return jsonify({"error": "Negocio no encontrado"}), 404

    metadata = {
        "name": f"Huellazo - {biz['name']}",
        "symbol": "HUELLAZO",
        "description": biz["description"],
        "image": biz["image"],
        "external_url": f"https://huellazo.app/business/{business_id}",
        "attributes": [
            {"trait_type": "Tipo", "value": "Insignia de Negocio"},
            {"trait_type": "Negocio", "value": biz["name"]},
            {"trait_type": "Latitud", "value": biz["latitude"]},
            {"trait_type": "Longitud", "value": biz["longitude"]},
        ],
    }
    return jsonify(metadata)


@app.route("/api/metadata/custom", methods=["POST"])
def create_custom_metadata():
    data = request.json
    metadata_id = str(uuid.uuid4())
    metadata = {
        "name": data.get("name", "Huellazo POAP"),
        "symbol": "HUELLAZO",
        "description": data.get("description", ""),
        "image": data.get("image", ""),
        "attributes": data.get("attributes", []),
    }
    METADATA_STORE[metadata_id] = metadata
    return jsonify({"id": metadata_id, "uri": f"/api/metadata/{metadata_id}", "metadata": metadata})


@app.route("/api/metadata/<metadata_id>", methods=["GET"])
def get_custom_metadata(metadata_id):
    metadata = METADATA_STORE.get(metadata_id)
    if not metadata:
        return jsonify({"error": "Metadata no encontrada"}), 404
    return jsonify(metadata)


# ---------------------------------------------------------------------------
# Endpoints — POIs y validacion GPS
# ---------------------------------------------------------------------------

@app.route("/api/pois", methods=["GET"])
def list_pois():
    return jsonify([
        {"id": k, **v} for k, v in POI_DATABASE.items()
    ])


@app.route("/api/poi/<poi_id>", methods=["GET"])
def get_poi(poi_id):
    poi = POI_DATABASE.get(poi_id)
    if not poi:
        return jsonify({"error": "POI no encontrado"}), 404
    return jsonify({"id": poi_id, **poi})


@app.route("/api/validate-gps", methods=["POST"])
def validate_gps():
    data = request.json
    user_lat = data.get("latitude")
    user_lon = data.get("longitude")
    poi_id = data.get("poi_id")

    poi = POI_DATABASE.get(poi_id)
    if not poi:
        return jsonify({"error": "POI no encontrado"}), 404

    if user_lat is None or user_lon is None:
        return jsonify({"error": "Coordenadas requeridas"}), 400

    import math

    lat1, lon1 = math.radians(user_lat), math.radians(user_lon)
    lat2, lon2 = math.radians(poi["latitude"]), math.radians(poi["longitude"])

    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371000  # Radio de la Tierra en metros

    distance = c * r

    return jsonify({
        "poi_id": poi_id,
        "poi_name": poi["name"],
        "distance_meters": round(distance, 2),
        "max_distance": 150.0,
        "is_nearby": distance <= 150.0,
    })


# ---------------------------------------------------------------------------
# Endpoints — Codigo QR de pago para negocios
# ---------------------------------------------------------------------------

@app.route("/api/businesses", methods=["GET"])
def list_businesses():
    return jsonify([
        {"id": k, **v} for k, v in BUSINESS_DATABASE.items()
    ])


@app.route("/api/business/<business_id>", methods=["GET"])
def get_business(business_id):
    biz = BUSINESS_DATABASE.get(business_id)
    if not biz:
        return jsonify({"error": "Negocio no encontrado"}), 404
    return jsonify({"id": business_id, **biz})


@app.route("/api/business/<business_id>/qr", methods=["GET"])
def generate_qr(business_id):
    biz = BUSINESS_DATABASE.get(business_id)
    if not biz:
        return jsonify({"error": "Negocio no encontrado"}), 404

    payment_data = {
        "type": "HUELLAZO_PAYMENT",
        "business_id": business_id,
        "business_name": biz["name"],
        "business_wallet": biz["wallet"],
        "amount_lamports": biz["price_lamports"],
        "latitude": biz["latitude"],
        "longitude": biz["longitude"],
        "metadata_uri": f"http://localhost:5000/api/metadata/business/{business_id}",
        "timestamp": str(uuid.uuid4()),
    }

    qr_payload = json.dumps(payment_data)

    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(qr_payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return send_file(buf, mimetype="image/png")
    except ImportError:
        return jsonify({"qr_data": qr_payload, "error": "qrcode no instalado, devuelve data raw"})


@app.route("/api/business/<business_id>/qr-data", methods=["GET"])
def get_qr_data(business_id):
    biz = BUSINESS_DATABASE.get(business_id)
    if not biz:
        return jsonify({"error": "Negocio no encontrado"}), 404

    payment_data = {
        "type": "HUELLAZO_PAYMENT",
        "business_id": business_id,
        "business_name": biz["name"],
        "business_wallet": biz["wallet"],
        "amount_lamports": biz["price_lamports"],
        "latitude": biz["latitude"],
        "longitude": biz["longitude"],
        "metadata_uri": f"http://localhost:5000/api/metadata/business/{business_id}",
        "timestamp": str(uuid.uuid4()),
    }
    return jsonify(payment_data)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Huellazo Backend", "version": "0.1.0"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
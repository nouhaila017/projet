from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow React frontend to call this API

@app.route('/scan', methods=['POST'])
def scan():
    data = request.get_json()
    url = data.get('url', '')

    if not url:
        return jsonify({'error': 'URL manquante'}), 400

    # TODO: Intégrez votre vrai scanner ici
    # Pour l'instant on retourne des données de test
    result = {
        "url": url,
        "score": 34,
        "scannedAt": "26/04/2026 14:30",
        "stats": {
            "critical": 3,
            "high": 7,
            "medium": 12,
            "low": 5,
            "info": 2
        },
        "vulnerabilities": [
            {
                "id": 1,
                "type": "SQL Injection",
                "severity": "Critical",
                "endpoint": "/api/login",
                "description": "L'entrée utilisateur n'est pas filtrée.",
                "fix": "cursor.execute('SELECT * FROM users WHERE username = %s', (username,))"
            }
        ]
    }
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
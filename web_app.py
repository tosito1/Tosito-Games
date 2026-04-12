from flask import Flask, request, jsonify
from flask_cors import CORS
from engine.board import Board
from engine.ai import AI
import logging

# Log requests to a file to verify connection
logging.basicConfig(filename='backend_access.log', level=logging.INFO, format='%(asctime)s %(message)s')

app = Flask(__name__)
CORS(app)

@app.before_request
def log_info():
    logging.info(f"REQ: {request.remote_addr} -> {request.method} {request.path}")

@app.route('/ping', methods=['GET', 'POST'])
def ping():
    return jsonify({'status': 'ok', 'message': 'Tosito Games Backend is running'})

# Cache AI instances by difficulty to avoid reloading the model every request
ai_cache = {}

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        fen = data.get('fen')
        diff = data.get('difficulty', 'neural_max')
        
        if diff not in ai_cache:
            logging.info(f"[*] Inicializando IA para dificultad: {diff}")
            ai_cache[diff] = AI(color='black', difficulty=diff)
        
        board = Board(fen)
        move = ai_cache[diff].get_best_move(board)
        
        return jsonify({'move': move})
    except Exception as e:
        logging.error(f"Error en predict: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5001)

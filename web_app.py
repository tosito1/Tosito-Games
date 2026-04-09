from flask import Flask, request, jsonify
from flask_cors import CORS
from engine.board import Board
from engine.ai import AI

app = Flask(__name__)
CORS(app)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        fen = data.get('fen')
        diff = data.get('difficulty', 'neural_max')
        
        # Elite-Gen board representation is handled inside AI/board_to_tensor
        board = Board(fen)
        ai = AI(color='black', difficulty=diff)
        move = ai.get_best_move(board)
        
        return jsonify({'move': move})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)

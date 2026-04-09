import os
import torch
import chess
import time
import math
from engine.ai import AI
from engine.board import Board

# Glicko Config (Chess.com / Lichess style)
STOCKFISH_ELO = 2400  # Stockfish API Depth 12 Estimate
STOCKFISH_RD = 30     # Low deviation for a stable engine
GAMES_TO_PLAY = 10    # Default number of games

class GlickoRating:
    def __init__(self, r=1500, rd=350):
        self.r = r
        self.rd = rd
        self.q = math.log(10) / 400

    def g(self, rd):
        return 1 / math.sqrt(1 + 3 * (self.q**2) * (rd**2) / (math.pi**2))

    def e(self, r, ri, rd_i):
        return 1 / (1 + 10**(self.g(rd_i) * (r - ri) / -400))

    def update(self, ri, rd_i, score):
        # score: 1.0 (win), 0.5 (draw), 0.0 (loss)
        g_rd_i = self.g(rd_i)
        e_val = self.e(self.r, ri, rd_i)
        
        d2 = 1 / ( (self.q**2) * (g_rd_i**2) * e_val * (1 - e_val) )
        
        r_new = self.r + (self.q / (1/self.rd**2 + 1/d2)) * g_rd_i * (score - e_val)
        rd_new = math.sqrt(1 / (1/self.rd**2 + 1/d2))
        
        self.r = r_new
        self.rd = rd_new
        return self.r, self.rd

def play_match(games=GAMES_TO_PLAY):
    print(f"\n{'='*40}")
    print(f"   BENCHMARK GLICKO: ELITE-GEN vs STOCKFISH")
    print(f"{'='*40}")
    print(f"[*] Opponent: Stockfish 16 (API Depth 12) ~{STOCKFISH_ELO} Elo (RD {STOCKFISH_RD})")
    print(f"[*] Games: {games}")
    print(f"[*] Loading IA: chess_net_ultra.pth...")
    
    # Init Glicko
    rating_ia = GlickoRating(r=1500, rd=350)
    
    # Load AI
    try:
        ia = AI(color='white', difficulty='neural_max')
    except Exception as e:
        print(f"[-] Error loading AI: {e}")
        return

    stockfish = AI(color='black', difficulty='level_8')
    
    results = {"win": 0, "draw": 0, "loss": 0}
    
    for i in range(games):
        board = chess.Board()
        ia_color = chess.WHITE if i % 2 == 0 else chess.BLACK
        print(f"\n[Game {i+1}/{games}] IA Color: {'White' if ia_color == chess.WHITE else 'Black'}")
        
        move_count = 0
        while not board.is_game_over():
            if board.turn == ia_color:
                # IA move
                move, _ = ia.get_best_move(board)
            else:
                # Stockfish move
                move_str, _ = stockfish.get_lichess_move(board)
                move = chess.Move.from_uci(move_str)
            
            if move and move in board.legal_moves:
                board.push(move)
                time.sleep(1.2) # Respetar API
            else:
                print(f"  [!] Move error. Game stopped.")
                break
                
            move_count += 1
            if move_count > 250: break
            
        # Result analysis
        res = board.result()
        score = 0.5
        if res == "1-0":
            if ia_color == chess.WHITE: 
                score = 1.0
                results["win"] += 1
                print("  [WIN] RESULT: AI WINS (1-0)")
            else:
                score = 0.0
                results["loss"] += 1
                print("  [LOSS] RESULT: STOCKFISH WINS (1-0)")
        elif res == "0-1":
            if ia_color == chess.BLACK:
                score = 1.0
                results["win"] += 1
                print("  [WIN] RESULT: AI WINS (1-0)")
            else:
                score = 0.0
                results["loss"] += 1
                print("  [LOSS] RESULT: STOCKFISH WINS (1-0)")
        else:
            score = 0.5
            results["draw"] += 1
            print("  [DRAW] RESULT: DRAW (1/2-1/2)")
            
        r, rd = rating_ia.update(STOCKFISH_ELO, STOCKFISH_RD, score)
        print(f"  [Stats] New Rating: {r:.1f} | RD: {rd:.1f}")

    print(f"\n{'='*40}")
    print(f"   FINAL GLICKO REPORT")
    print(f"{'='*40}")
    print(f"Wins: {results['win']} | Draws: {results['draw']} | Losses: {results['loss']}")
    print(f"FINAL RATING: {rating_ia.r:.1f} ± {2*rating_ia.rd:.1f} (95% Confidence)")
    print(f"{'='*40}\n")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--games", type=int, default=GAMES_TO_PLAY)
    args = parser.parse_args()
    
    play_match(args.games)

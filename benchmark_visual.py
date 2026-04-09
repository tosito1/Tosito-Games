import os
import torch
import pygame
import chess
import time
from engine.board import Board
from engine.ai import AI

# CONFIG
MODEL_MASTER = 'chess_net_ultra.pth'
MODEL_MEGA = 'chess_net_mega_v2.pth'
NODES = 1000 # Fast benchmark nodes

class VisualBenchmark:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((930, 650))
        pygame.display.set_caption("AI BENCHMARK: Master-Gen vs Mega-Gen 2.0")
        
        print("[*] Loading Master-Gen...")
        self.ai_master = AI(color='white', difficulty='neural_max', model_file=MODEL_MASTER)
        print("[*] Loading Mega-Gen...")
        self.ai_mega = AI(color='black', difficulty='neural_max', model_file=MODEL_MEGA)
        
        self.board = Board()
        self.scores = {"Master-Gen": 0.0, "Mega-Gen": 0.0, "Draws": 0}
        self.game_count = 1
        self.master_is_white = True
        
        self.sq_size = 80
        self.pieces = {}
        self.load_assets()
        self.font = pygame.font.SysFont("Segoe UI", 24, bold=True)
        self.small_font = pygame.font.SysFont("Segoe UI", 18)

    def load_assets(self):
        p_names = {'p': 'pawn', 'n': 'knight', 'b': 'bishop', 'r': 'rook', 'q': 'queen', 'k': 'king'}
        for color in ['white', 'black']:
            for char, p_name in p_names.items():
                path = f"assets/pieces/ic_{color}_{p_name}_v.png"
                if os.path.exists(path):
                    img = pygame.image.load(path)
                    self.pieces[f"{color}_{char}"] = pygame.transform.smoothscale(img, (self.sq_size, self.sq_size))
                else:
                    # Fallback if specific version not found
                    path = f"assets/pieces/ic_{color}_{p_name}.png"
                    if os.path.exists(path):
                        img = pygame.image.load(path)
                        self.pieces[f"{color}_{char}"] = pygame.transform.smoothscale(img, (self.sq_size, self.sq_size))

    def draw(self):
        self.screen.fill((25, 25, 30))
        
        # Draw Board
        for r in range(8):
            for c in range(8):
                color = (235, 235, 211) if (r + c) % 2 == 0 else (119, 149, 87)
                pygame.draw.rect(self.screen, color, (c * self.sq_size, r * self.sq_size, self.sq_size, self.sq_size))
        
        # Highlight Last Move
        if self.board.chess_board.move_stack:
            last_move = self.board.chess_board.peek()
            for sq in [last_move.from_square, last_move.to_square]:
                r, c = 7 - (sq // 8), sq % 8
                s = pygame.Surface((self.sq_size, self.sq_size))
                s.set_alpha(100)
                s.fill((255, 255, 0))
                self.screen.blit(s, (c * self.sq_size, r * self.sq_size))

        # Pieces
        b = self.board.chess_board
        for sq in chess.SQUARES:
            piece = b.piece_at(sq)
            if piece:
                color = "white" if piece.color == chess.WHITE else "black"
                p_type = chess.piece_name(piece.piece_type)[0] if piece.piece_type != chess.KNIGHT else 'n'
                key = f"{color}_{p_type}"
                if key in self.pieces:
                    r, c = 7 - (sq // 8), sq % 8
                    self.screen.blit(self.pieces[key], (c * self.sq_size, r * self.sq_size))

        # Sidebar
        panel_x = 650
        pygame.draw.rect(self.screen, (40, 40, 50), (panel_x, 0, 280, 650))
        
        self.screen.blit(self.font.render("BENCHMARK DUEL", True, (0, 255, 200)), (panel_x + 20, 30))
        self.screen.blit(self.small_font.render(f"Partida: {self.game_count}", True, (200, 200, 200)), (panel_x + 20, 70))
        
        # Master Info
        m_color = "Blancas" if self.master_is_white else "Negras"
        self.screen.blit(self.font.render("MASTER-GEN:", True, (255, 255, 255)), (panel_x + 20, 120))
        self.screen.blit(self.small_font.render(f"Puntos: {self.scores['Master-Gen']}", True, (0, 200, 255)), (panel_x + 20, 150))
        self.screen.blit(self.small_font.render(f"Lado: {m_color}", True, (150, 150, 150)), (panel_x + 20, 175))
        
        # Mega Info
        mega_color = "Negras" if self.master_is_white else "Blancas"
        self.screen.blit(self.font.render("MEGA-GEN 2.0:", True, (255, 255, 255)), (panel_x + 20, 230))
        self.screen.blit(self.small_font.render(f"Puntos: {self.scores['Mega-Gen']}", True, (0, 255, 100)), (panel_x + 20, 260))
        self.screen.blit(self.small_font.render(f"Lado: {mega_color}", True, (150, 150, 150)), (panel_x + 20, 285))
        
        # Game Stats
        self.screen.blit(self.small_font.render(f"Tablas: {self.scores['Draws']}", True, (255, 255, 0)), (panel_x + 20, 340))
        self.screen.blit(self.small_font.render(f"Nodos: {NODES}", True, (200, 200, 200)), (panel_x + 20, 370))
        
        if b.is_game_over():
            res = b.result()
            self.screen.blit(self.font.render("FIN DE PARTIDA", True, (255, 100, 100)), (panel_x + 20, 450))
            self.screen.blit(self.small_font.render(f"Resultado: {res}", True, (255, 255, 0)), (panel_x + 20, 490))
            self.screen.blit(self.small_font.render("Reiniciando en 3s...", True, (150, 150, 150)), (panel_x + 20, 520))

    def update_score(self):
        res = self.board.chess_board.result()
        if res == "1-0":
            if self.master_is_white: self.scores["Master-Gen"] += 1
            else: self.scores["Mega-Gen"] += 1
        elif res == "0-1":
            if self.master_is_white: self.scores["Mega-Gen"] += 1
            else: self.scores["Master-Gen"] += 1
        else:
            self.scores["Draws"] += 1
            self.scores["Master-Gen"] += 0.5
            self.scores["Mega-Gen"] += 0.5
        
        self.game_count += 1
        self.master_is_white = not self.master_is_white # SWAP SIDES
        time.sleep(3)
        self.board = Board()

    def run(self):
        clock = pygame.time.Clock()
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT: return

            if not self.board.chess_board.is_game_over():
                # Determine whose turn it is
                turn = self.board.chess_board.turn
                is_master_turn = (turn == chess.WHITE and self.master_is_white) or (turn == chess.BLACK and not self.master_is_white)
                
                active_ai = self.ai_master if is_master_turn else self.ai_mega
                move, eval = active_ai.get_best_move(self.board, simulations=NODES)
                
                if move:
                    self.board.chess_board.push(move)
            else:
                self.draw()
                pygame.display.flip()
                self.update_score()

            self.draw()
            pygame.display.flip()
            clock.tick(30)

if __name__ == "__main__":
    VisualBenchmark().run()

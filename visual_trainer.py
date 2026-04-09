import os
import torch
import torch.optim as optim
import torch.nn as nn
from torch.amp import autocast, GradScaler
import pygame
import argparse
import chess
from engine.board import Board
from engine.ai import AI
from engine.model import board_to_tensor, ChessNet

# --- ELITE CONFIG ---
MODEL_PATH = 'chess_net_ultra.pth'
LR = 0.0001
BATCH_SIZE = 64
WEIGHT_DECAY = 1e-5

parser = argparse.ArgumentParser()
parser.add_argument("--level", type=str, default="level_7")
parser.add_argument("--watch", action="store_true")
args = parser.parse_args()

class VisualTrainer:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((930, 650))
        pygame.display.set_caption("MASTER-GEN Visual Dashboard (40x256)")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        self.student = AI(color='white', difficulty='neural_max')
        self.student.net = ChessNet(40, 256).to(self.device)
        if os.path.exists(MODEL_PATH):
            try: self.student.net.load_state_dict(torch.load(MODEL_PATH, map_location=self.device))
            except: pass
            
        self.optimizer = optim.AdamW(self.student.net.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
        self.scaler = GradScaler('cuda') if self.device.type == 'cuda' else GradScaler('cpu')
        self.criterion = nn.CrossEntropyLoss()
        
        teacher_diff = args.level if args.level != "self" else "neural_max"
        self.teacher = AI(color='black', difficulty=teacher_diff)
        self.board = Board()
        self.batch_states, self.batch_targets = [], []
        
        # UI Assets (from main.py)
        self.sq_size = 80
        self.pieces = {}
        self.load_assets()

    def load_assets(self):
        p_names = {'p': 'pawn', 'n': 'knight', 'b': 'bishop', 'r': 'rook', 'q': 'queen', 'k': 'king'}
        for color in ['white', 'black']:
            for char, p_name in p_names.items():
                path = f"assets/pieces/ic_{color}_{p_name}_v.png"
                if os.path.exists(path):
                    img = pygame.image.load(path)
                    self.pieces[f"{color}_{char}"] = pygame.transform.smoothscale(img, (self.sq_size, self.sq_size))

    def draw(self):
        self.screen.fill((30, 30, 35))
        # Draw Board
        for r in range(8):
            for c in range(8):
                color = (238, 238, 210) if (r + c) % 2 == 0 else (118, 150, 86)
                pygame.draw.rect(self.screen, color, (c * self.sq_size, r * self.sq_size, self.sq_size, self.sq_size))
        
        # Draw Pieces
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
        
        # Info Panel
        font = pygame.font.SysFont("Segoe UI", 24, bold=True)
        self.screen.blit(font.render("ULTRA-GEN SIMULATOR", True, (0, 210, 255)), (660, 30))
        self.screen.blit(font.render(f"Nivel: {args.level}", True, (255, 255, 255)), (660, 80))
        status = "VIENDO" if args.watch else "ENTRENANDO"
        self.screen.blit(font.render(f"Modo: {status}", True, (200, 200, 200)), (660, 120))
        
        if self.board.chess_board.is_game_over():
            self.screen.blit(font.render("FIN DE PARTIDA", True, (255, 100, 100)), (660, 200))
            self.screen.blit(font.render(self.board.chess_board.result(), True, (255, 255, 0)), (660, 240))

    def step(self):
        it = board_to_tensor(self.board)
        api_res = self.teacher.get_lichess_move(self.board)
        if isinstance(api_res, tuple) and api_res[0]:
            move_uci = api_res[0]
            m_obj = self.board.chess_board.parse_uci(move_uci)
            
            if not args.watch:
                # Perspective-Invariant Index
                f_abs, t_abs = m_obj.from_square, m_obj.to_square
                if self.board.chess_board.turn == chess.BLACK:
                    f_abs = (7 - (f_abs // 8)) * 8 + (f_abs % 8)
                    t_abs = (7 - (t_abs // 8)) * 8 + (t_abs % 8)
                
                self.batch_states.append(it)
                self.batch_targets.append(f_abs * 64 + t_abs)
            
            self.board.chess_board.push(m_obj)
            
            if not args.watch and len(self.batch_states) >= BATCH_SIZE:
                s_b = torch.cat(self.batch_states).to(self.device)
                t_b = torch.tensor(self.batch_targets).to(self.device)
                self.optimizer.zero_grad()
                with autocast('cuda' if self.device.type == 'cuda' else 'cpu'):
                    logits, _ = self.student.net(s_b)
                    loss = self.criterion(logits, t_b)
                self.scaler.scale(loss).backward()
                self.scaler.step(self.optimizer)
                self.scaler.update()
                self.batch_states, self.batch_targets = [], []
                print(f"[ELITE-VISUAL] Loss: {loss.item():.4f}")
            
            if self.board.chess_board.is_game_over():
                time.sleep(3)
                self.board = Board() # Restart

    def run(self):
        import time
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT: return
            
            if not self.board.chess_board.is_game_over():
                self.step()
                time.sleep(4) # Increased delay to 4s to be very safe with public API limits
                
            self.draw()
            pygame.display.flip()
            time.sleep(0.1)

if __name__ == "__main__":
    VisualTrainer().run()

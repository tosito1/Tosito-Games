import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.amp import autocast, GradScaler
import pygame
import chess
import numpy as np
import threading
import random
import time
from engine.model import ChessNet, board_to_tensor
from engine.ai import AI

# --- MASTER-GEN VISUAL RL CONFIG ---
MODEL_PATH = 'chess_net_ultra.pth'
NUM_RES_BLOCKS = 40
NUM_FILTERS = 256
SIMULATIONS_PER_MOVE = 400
BATCH_SIZE = 64
REPLAY_BUFFER_SIZE = 50000
LR = 0.0001

class VisualMasterTrainerRL:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((1000, 700))
        pygame.display.set_caption("MASTER-GEN RL DASHBOARD (Phase 3 AlphaZero)")
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = ChessNet(num_res_blocks=NUM_RES_BLOCKS, num_filters=NUM_FILTERS).to(self.device)
        self.optimizer = optim.AdamW(self.model.parameters(), lr=LR, weight_decay=1e-5)
        self.scaler = GradScaler('cuda') if self.device.type == 'cuda' else GradScaler('cpu')
        
        # Load Weights (Master-Gen V2 backbone)
        if os.path.exists(MODEL_PATH):
            try:
                ckpt = torch.load(MODEL_PATH, map_location=self.device)
                sd = ckpt['model_state_dict'] if isinstance(ckpt, dict) else ckpt
                self.model.load_state_dict(sd, strict=False)
                print("[✓] Backbone Loaded into MASTER-GEN architecture.")
            except: pass
        
        self.ai = AI(color='white', difficulty='neural_max')
        self.ai.net = self.model
        
        # Shared State for UI
        self.state = {
            "board": chess.Board(),
            "episode": 0,
            "loss": 0.0,
            "buffer": 0,
            "moves": 0,
            "eval": 0.0,
            "thinking": False,
            "sims": 0
        }
        self.replay_buffer = []
        self.running = True
        
        # UI Assets
        self.sq_size = 80
        self.pieces = {}
        self.load_assets()
        
        # Start Background Training Thread
        self.train_thread = threading.Thread(target=self.training_loop, daemon=True)
        self.train_thread.start()

    def load_assets(self):
        p_names = {'p': 'pawn', 'n': 'knight', 'b': 'bishop', 'r': 'rook', 'q': 'queen', 'k': 'king'}
        for color in ['white', 'black']:
            for char, p_name in p_names.items():
                path = f"assets/pieces/ic_{color}_{p_name}_v.png"
                if os.path.exists(path):
                    img = pygame.image.load(path)
                    self.pieces[f"{color}_{char}"] = pygame.transform.smoothscale(img, (self.sq_size, self.sq_size))

    def training_loop(self):
        while self.running:
            board = chess.Board()
            self.state["board"] = board
            self.state["episode"] += 1
            self.state["moves"] = 0
            temp_mem = []
            
            while not board.is_game_over() and self.running:
                # MCTS Select Move
                self.state["thinking"] = True
                self.state["sims"] = 0
                
                # AlphaZero Noise and Search
                move, value, probs = self.ai.mcts.search(board, SIMULATIONS_PER_MOVE, dirichlet_alpha=0.3)
                
                self.state["eval"] = value
                self.state["thinking"] = False
                
                # Save to mem
                state_tensor = board_to_tensor(board)
                temp_mem.append((state_tensor, probs, board.turn))
                
                # Temperature Scaling
                move_count = self.state["moves"]
                if move_count < 30:
                    legal_moves = list(board.legal_moves)
                    mv_probs = []
                    for m in legal_moves:
                        fs, ts = m.from_square, m.to_square
                        if board.turn == chess.BLACK:
                            fs = (7 - (fs // 8)) * 8 + (fs % 8)
                            ts = (7 - (ts // 8)) * 8 + (ts % 8)
                        mv_probs.append(probs[fs * 64 + ts])
                    
                    mv_probs = np.array(mv_probs)
                    if mv_probs.sum() > 0:
                        mv_probs /= mv_probs.sum()
                        move = np.random.choice(legal_moves, p=mv_probs)
                
                board.push(move)
                self.state["moves"] += 1
                time.sleep(0.1)
                
            # Episode Finish
            res = board.result()
            outcome = 0.0
            if res == "1-0": outcome = 1.0
            elif res == "0-1": outcome = -1.0
            
            for st, pr, turn in temp_mem:
                v_target = outcome if turn == chess.WHITE else -outcome
                self.replay_buffer.append((st, pr, v_target))
            
            if len(self.replay_buffer) > REPLAY_BUFFER_SIZE:
                self.replay_buffer = self.replay_buffer[-REPLAY_BUFFER_SIZE:]
            self.state["buffer"] = len(self.replay_buffer)
            
            # Train steps
            for _ in range(15):
                if len(self.replay_buffer) >= BATCH_SIZE:
                    batch = random.sample(self.replay_buffer, BATCH_SIZE)
                    s_t = torch.cat([x[0] for x in batch]).to(self.device)
                    p_t = torch.tensor(np.array([x[1] for x in batch])).to(self.device)
                    v_t = torch.tensor(np.array([x[2] for x in batch]), dtype=torch.float32).unsqueeze(1).to(self.device)
                    
                    self.optimizer.zero_grad()
                    with autocast('cuda' if self.device.type == 'cuda' else 'cpu'):
                        logits, values = self.model(s_t)
                        loss_p = -torch.mean(torch.sum(p_t * F.log_softmax(logits, dim=1), dim=1))
                        loss_v = F.mse_loss(values, v_t)
                        loss = loss_p + loss_v
                    
                    self.scaler.scale(loss).backward()
                    self.scaler.step(self.optimizer)
                    self.scaler.update()
                    self.state["loss"] = loss.item()

            if self.state["episode"] % 5 == 0:
                torch.save({'model_state_dict': self.model.state_dict()}, MODEL_PATH)

    def draw(self):
        self.screen.fill((20, 20, 25))
        
        # Draw Chess Board
        for r in range(8):
            for c in range(8):
                color = (235, 235, 210) if (r + c) % 2 == 0 else (120, 150, 90)
                pygame.draw.rect(self.screen, color, (50 + c * self.sq_size, 50 + r * self.sq_size, self.sq_size, self.sq_size))
        
        # Draw Pieces
        b = self.state["board"]
        for sq in chess.SQUARES:
            piece = b.piece_at(sq)
            if piece:
                color = "white" if piece.color == chess.WHITE else "black"
                p_type = chess.piece_name(piece.piece_type)[0] if piece.piece_type != chess.KNIGHT else 'n'
                key = f"{color}_{p_type}"
                if key in self.pieces:
                    # Pygame coord: 0 is top. Chess sq 0 is bottom left.
                    r, c = 7 - (sq // 8), sq % 8
                    self.screen.blit(self.pieces[key], (50 + c * self.sq_size, 50 + r * self.sq_size))
        
        # Right Info Panel
        px = 720
        font_t = pygame.font.SysFont("Outfit", 36, bold=True)
        font_s = pygame.font.SysFont("Segoe UI", 20)
        
        self.screen.blit(font_t.render("MASTER-GEN", True, (0, 255, 200)), (px, 50))
        self.screen.blit(font_s.render("AlphaZero Self-Play RL", True, (150, 150, 150)), (px, 90))
        
        # Stats
        sy = 150
        def draw_stat(label, val, color=(255,255,255)):
            nonlocal sy
            self.screen.blit(font_s.render(label, True, (120, 120, 120)), (px, sy))
            self.screen.blit(font_s.render(str(val), True, color), (px + 150, sy))
            sy += 40

        draw_stat("Episodio:", self.state["episode"])
        draw_stat("Movimientos:", self.state["moves"])
        draw_stat("Buffer RL:", f"{self.state['buffer']}/{REPLAY_BUFFER_SIZE}")
        draw_stat("Loss:", f"{self.state['loss']:.4f}", (255, 200, 0))
        
        # MCTS Thinking Indicator
        sy += 20
        if self.state["thinking"]:
            pygame.draw.circle(self.screen, (255, 0, 100), (px + 10, sy + 15), 10)
            self.screen.blit(font_s.render("IA PENSANDO (MCTS)...", True, (255, 50, 150)), (px + 30, sy))
        else:
            self.screen.blit(font_s.render("JUGANDO...", True, (50, 255, 100)), (px, sy))
        
        sy += 60
        # Eval Bar
        ev_val = self.state["eval"]
        bar_y = sy
        pygame.draw.rect(self.screen, (50, 50, 50), (px, bar_y, 200, 20))
        # Center is 0.0. Scale -1.0 to 1.0.
        fill_w = int(100 + (ev_val * 100))
        fill_w = max(0, min(200, fill_w))
        pygame.draw.rect(self.screen, (0, 200, 255), (px, bar_y, fill_w, 20))
        self.screen.blit(font_s.render(f"Eval: {ev_val:+.2f}", True, (255, 255, 255)), (px, bar_y + 25))

    def run(self):
        clock = pygame.time.Clock()
        while self.running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
            
            self.draw()
            pygame.display.flip()
            clock.tick(30)
        pygame.quit()

if __name__ == "__main__":
    VisualMasterTrainerRL().run()

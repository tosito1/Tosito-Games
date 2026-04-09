import os
import torch
import torch.optim as optim
import torch.nn as nn
from torch.amp import autocast, GradScaler
from torch.optim.lr_scheduler import OneCycleLR
import numpy as np
import chess
import json
from engine.board import Board
from engine.ai import AI
from engine.model import board_to_tensor, ChessNet
from pgn_manager import PGNManager

# --- MEGA-GEN 2.0 (STRATEGY INJECTION) ---
MODEL_PATH = 'chess_net_mega_v2.pth'
MODEL_BEST_PATH = 'chess_net_mega_best.pth'
METRICS_PATH = 'metrics_mega.json'
MAX_LR = 0.0004 # Slight increase for dual task
WEIGHT_DECAY = 1e-5 
BATCH_SIZE = 110 # Slightly reduced for dual grad memory safety
SAVE_INTERVAL_GAMES = 25
TOTAL_MOVES_SPRINT = 600000 
TOTAL_STEPS = TOTAL_MOVES_SPRINT // BATCH_SIZE 

class MegaTrainer:
    def __init__(self, pgn_dir='Partidas'):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[*] MEGA-GEN 2.0 (DUAL-HEAD: Policy + Value) on {self.device}")
        
        self.student = AI(color='white', difficulty='neural_max')
        self.student.net = ChessNet(num_res_blocks=60, num_filters=320, num_attention_blocks=8, num_heads=16, use_preact=True).to(self.device)
        
        self.optimizer = optim.AdamW(self.student.net.parameters(), lr=0.00001, weight_decay=WEIGHT_DECAY)
        self.scheduler = OneCycleLR(self.optimizer, max_lr=MAX_LR, total_steps=TOTAL_STEPS, pct_start=0.3)
        self.scaler = GradScaler('cuda') if self.device.type == 'cuda' else GradScaler('cpu')
        self.criterion_p = nn.CrossEntropyLoss()
        self.criterion_v = nn.MSELoss() # Strategy Head Loss
        
        self.pgn_manager = PGNManager(pgn_dir)
        self.total_moves = 0
        self.last_print_moves = 0
        self.game_count = 0
        self.batch_states, self.batch_targets_p, self.batch_targets_v = [], [], []
        self.metrics_history = []
        self.best_acc = 0.0
        
        # Resume
        if os.path.exists(MODEL_PATH):
            try:
                checkpoint = torch.load(MODEL_PATH, map_location=self.device)
                if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                    self.student.net.load_state_dict(checkpoint['model_state_dict'], strict=False)
                    self.game_count = checkpoint.get('game_count', 0)
                    self.total_moves = checkpoint.get('total_moves', 0)
                    self.best_acc = checkpoint.get('best_acc', 0.0)
                    print(f"[✓] Resuming Strategic Training (Game {self.game_count}, Best P-Acc: {self.best_acc:.2f}%)")
            except Exception as e: print(f"[!] Resume failed: {e}")

    def train_step(self):
        if len(self.batch_states) < BATCH_SIZE: return
        states = torch.cat(self.batch_states).to(self.device)
        targets_p = torch.tensor(self.batch_targets_p).to(self.device)
        targets_v = torch.tensor(self.batch_targets_v, dtype=torch.float32).to(self.device)
        
        self.optimizer.zero_grad()
        with autocast('cuda' if self.device.type == 'cuda' else 'cpu'):
            logits_p, val_pred = self.student.net(states)
            loss_p = self.criterion_p(logits_p, targets_p)
            loss_v = self.criterion_v(val_pred.view(-1), targets_v)
            loss = loss_p + (loss_v * 1.5) # Weight Strategy slightly higher to catch up
        
        acc_p = (logits_p.argmax(1) == targets_p).float().mean() * 100
        self.scaler.scale(loss).backward()
        
        self.scaler.unscale_(self.optimizer)
        torch.nn.utils.clip_grad_norm_(self.student.net.parameters(), max_norm=1.0)
        
        if loss.item() > 9.0: # Permissive but safe
            for group in self.optimizer.param_groups: group['lr'] *= 0.1 
            print(f"    [!!!] DUAL BRAKE: Instability ({loss.item():.2f}).")

        self.scaler.step(self.optimizer)
        self.scaler.update()
        self.scheduler.step()
        
        self.batch_states, self.batch_targets_p, self.batch_targets_v = [], [], []
        
        if self.total_moves - self.last_print_moves >= 1000:
            lr_now = self.optimizer.param_groups[0]['lr']
            print(f"    [STRATEGY] Moves: {self.total_moves} | Loss: {loss_p.item():.3f}+{loss_v.item():.3f} | P-Acc: {acc_p.item():.2f}% | LR: {lr_now:.6f}")
            self.last_print_moves = self.total_moves
            self.metrics_history.append({"step": self.total_moves, "loss": round(loss.item(), 4), "acc": round(acc_p.item(), 2), "lr": round(lr_now, 7)})
            with open(METRICS_PATH, 'w') as f: json.dump(self.metrics_history, f)
            
            if acc_p.item() > self.best_acc:
                self.best_acc = acc_p.item()
                torch.save({'model_state_dict': self.student.net.state_dict(), 'best_acc': self.best_acc, 'total_moves': self.total_moves}, MODEL_BEST_PATH)

    def run(self):
        print("[*] MEGA-GEN Dual-Head Strategic Training Started...")
        while True:
            game = self.pgn_manager.get_next_game(auto_loop=True)
            if not game: break
            
            # Result Extraction
            res_str = game.headers.get("Result", "*")
            if res_str == "1-0": result_val = 1.0 # White Wins
            elif res_str == "0-1": result_val = -1.0 # Black Wins
            else: result_val = 0.0 # Draw or *
            
            board = Board()
            self.game_count += 1
            for move in game.mainline_moves():
                # 1. Perspective-Aware Move Target
                input_tensor = board_to_tensor(board)
                f_abs, t_abs = move.from_square, move.to_square
                turn = board.chess_board.turn
                
                # Perspective Check for Value target
                # target_v = 1.0 if current player wins, -1.0 if loses
                target_v = result_val if turn == chess.WHITE else -result_val
                
                if turn == chess.BLACK:
                    f_abs = (7 - (f_abs // 8)) * 8 + (f_abs % 8)
                    t_abs = (7 - (t_abs // 8)) * 8 + (t_abs % 8)
                
                self.batch_states.append(input_tensor)
                self.batch_targets_p.append(f_abs * 64 + t_abs)
                self.batch_targets_v.append(target_v)
                self.total_moves += 1
                
                # 2. Symmetry Augmentation
                mirrored_tensor = torch.flip(input_tensor, [3])
                def mirror_sq(sq): return (sq // 8) * 8 + (7 - (sq % 8))
                f_m, t_m = mirror_sq(f_abs), mirror_sq(t_abs)
                
                self.batch_states.append(mirrored_tensor)
                self.batch_targets_p.append(f_m * 64 + t_m)
                self.batch_targets_v.append(target_v) # Mirrors have SAME value result
                self.total_moves += 1
                
                self.train_step()
                try: board.chess_board.push(move)
                except: break
                
            if self.game_count % SAVE_INTERVAL_GAMES == 0:
                torch.save({'model_state_dict': self.student.net.state_dict(), 'optimizer_state_dict': self.optimizer.state_dict(), 'game_count': self.game_count, 'total_moves': self.total_moves, 'best_acc': self.best_acc}, MODEL_PATH)
                print(f"    [SAVED] {MODEL_PATH}")

if __name__ == "__main__":
    MegaTrainer().run()

import os
import torch
import torch.optim as optim
import torch.nn as nn
from torch.amp import autocast, GradScaler
from torch.optim.lr_scheduler import OneCycleLR
import numpy as np
import random
import chess
from engine.board import Board
from engine.ai import AI
from engine.model import board_to_tensor, ChessNet
from pgn_manager import PGNManager

# --- MASTER-GEN CONFIG ---
MODEL_PATH = 'chess_net_ultra.pth'
MAX_LR = 0.001
WEIGHT_DECAY = 1e-5 
BATCH_SIZE = 256
SAVE_INTERVAL_GAMES = 25
TOTAL_STEPS = 50000 

class EliteTrainer:
    def __init__(self, pgn_dir='Partidas'):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[*] MASTER-GEN SE-ResNet Trainer (40x256) on {self.device}")
        print(f"[*] Training Directory: {pgn_dir}")
        
        slug = pgn_dir.replace('\\', '_').replace('/', '_').replace(':', '').strip('_')
        self.metrics_path = f'metrics_{slug}.json'
        
        self.student = AI(color='white', difficulty='neural_max')
        self.student.net = ChessNet(40, 256).to(self.device)
        
        self.optimizer = optim.AdamW(self.student.net.parameters(), lr=0.0001, weight_decay=WEIGHT_DECAY)
        self.scheduler = OneCycleLR(self.optimizer, max_lr=MAX_LR, total_steps=TOTAL_STEPS)
        
        if os.path.exists(MODEL_PATH):
            try:
                # We load the weights later in __init__ after optimizer/scheduler setup
                pass
            except: pass
        self.scaler = GradScaler('cuda') if self.device.type == 'cuda' else GradScaler('cpu')
        self.criterion = nn.CrossEntropyLoss()
        
        self.pgn_manager = PGNManager(pgn_dir)
        self.teacher_api = AI(color='black', difficulty='level_8')
        
        self.total_moves = 0
        self.last_print_moves = 0
        self.game_count = 0
        self.metrics_history = []
        
        # Elite: Load cumulative progress from unified checkpoint
        if os.path.exists(MODEL_PATH):
            try:
                checkpoint = torch.load(MODEL_PATH, map_location=self.device)
                if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                    self.student.net.load_state_dict(checkpoint['model_state_dict'], strict=False)
                    
                    # Core Fix: If resuming, load optimizer but inject missing metadata for OneCycleLR
                    self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
                    for group in self.optimizer.param_groups:
                        if 'initial_lr' not in group:
                            group['initial_lr'] = MAX_LR # Re-inject for OneCycleLR
                    
                    # Use a fresh scheduler for the expansion phase to avoid state mismatches
                    print("[*] Re-initializing Master Scheduler for 40-block focus...")
                    self.scheduler = OneCycleLR(self.optimizer, max_lr=MAX_LR, total_steps=TOTAL_STEPS)
                    
                    self.game_count = checkpoint.get('game_count', 0)
                    self.total_moves = checkpoint.get('total_moves', 0)
                else:
                    # Legacy load (only state_dict)
                    print("[!] Legacy Model Detected. Starting fresh training cycle.")
                    self.student.net.load_state_dict(checkpoint, strict=False)
            except Exception as e:
                print(f"[!] Warning during checkpoint load: {e}. Starting with fresh optimizer state.")
        
        # Load Metrics History
        if os.path.exists(self.metrics_path):
            try:
                import json
                with open(self.metrics_path, 'r') as f:
                    self.metrics_history = json.load(f)
                print(f"[✓] Metrics History Loaded: {len(self.metrics_history)} data points.")
            except: pass
            
        # Priority Stats Sync: Use PGNManager if checkpoint is fresh/invalid
        if self.total_moves == 0 and os.path.exists(self.pgn_manager.checkpoint_file):
            try:
                import json
                with open(self.pgn_manager.checkpoint_file, 'r') as f:
                    data = json.load(f)
                    self.total_moves = data.get('total_moves', 0)
                    self.game_count = data.get('game_idx', 0)
            except: pass
            
        print(f"[✓] MASTER-GEN Ready: {self.game_count} games, {self.total_moves} moves.")
            
        self.batch_states = []
        self.batch_targets = []

    def train_step(self):
        if len(self.batch_states) < BATCH_SIZE: return
        
        states = torch.cat(self.batch_states).to(self.device)
        targets = torch.tensor(self.batch_targets).to(self.device)
        
        self.optimizer.zero_grad()
        with autocast('cuda' if self.device.type == 'cuda' else 'cpu'):
            logits, _ = self.student.net(states)
            loss = self.criterion(logits, targets)
        
        # Elite: Calculate Accuracy (matching move %)
        acc = (logits.argmax(1) == targets).float().mean() * 100
        
        self.scaler.scale(loss).backward()
        self.scaler.step(self.optimizer)
        self.scaler.update()
        
        # --- SMART LR CONTROL ---
        manual_lr = None
        if os.path.exists('lr_override.txt'):
            try:
                with open('lr_override.txt', 'r') as f:
                    manual_lr = float(f.read().strip())
                    if manual_lr > 0:
                        for group in self.optimizer.param_groups:
                            group['lr'] = manual_lr
            except: pass
            
        if manual_lr is None:
            self.scheduler.step() # Regular OneCycle
        
        self.batch_states = []
        self.batch_targets = []
        
        if self.total_moves - self.last_print_moves >= 1000:
            lr_now = self.optimizer.param_groups[0]['lr']
            loss_val = loss.item()
            acc_val = acc.item()
            print(f"    [MASTER-GEN] Moves: {self.total_moves} | Loss: {loss_val:.4f} | Acc: {acc_val:.2f}% | LR: {lr_now:.6f}")
            if manual_lr:
                print(f"    [!] MANUAL OVERRIDE ACTIVE: {manual_lr:.6f}")
            self.last_print_moves = self.total_moves
            
            # Save to history
            self.metrics_history.append({
                "step": self.total_moves,
                "loss": round(loss_val, 4),
                "acc": round(acc_val, 2),
                "lr": round(lr_now, 7)
            })
            # Immediate save for metrics
            try:
                import json
                with open(self.metrics_path, 'w') as f:
                    json.dump(self.metrics_history, f)
            except: pass

    def run(self):
        print("[*] Starting Elite-Gen Training (Infinity Mode: ON)...")
        while True:
            game = self.pgn_manager.get_next_game(auto_loop=True)
            if not game: break
            
            board = Board()
            self.game_count += 1
            
            for move in game.mainline_moves():
                input_tensor = board_to_tensor(board)
                
                # Perspective-Invariant Indexing
                f_abs, t_abs = move.from_square, move.to_square
                if board.chess_board.turn == chess.BLACK:
                    f_abs = (7 - (f_abs // 8)) * 8 + (f_abs % 8)
                    t_abs = (7 - (t_abs // 8)) * 8 + (t_abs % 8)
                
                # Model Policy Index: FromSquare * 64 + ToSquare
                target_idx = f_abs * 64 + t_abs
                
                self.batch_states.append(input_tensor)
                self.batch_targets.append(target_idx)
                self.total_moves += 1
                self.train_step()
                
                try: board.chess_board.push(move)
                except: break
                
            if self.game_count % SAVE_INTERVAL_GAMES == 0:
                # Elite: Atomic Unified Save
                temp_path = MODEL_PATH + ".tmp"
                try:
                    checkpoint = {
                        'model_state_dict': self.student.net.state_dict(),
                        'optimizer_state_dict': self.optimizer.state_dict(),
                        'scheduler_state_dict': self.scheduler.state_dict(),
                        'game_count': self.game_count,
                        'total_moves': self.total_moves
                    }
                    torch.save(checkpoint, temp_path)
                    
                    success = False
                    if os.path.exists(temp_path):
                        import time
                        for _ in range(5):
                            try:
                                if os.path.exists(MODEL_PATH):
                                    os.remove(MODEL_PATH)
                                os.rename(temp_path, MODEL_PATH)
                                success = True
                                break
                            except Exception:
                                time.sleep(1.0)
                    
                    if success:
                        # Backup JSON for external tools
                        self.pgn_manager.current_game_idx = self.game_count 
                        self.pgn_manager.save_checkpoint(total_moves=self.total_moves)
                        print(f"    [SAVED] Game {self.game_count} | Total Moves: {self.total_moves} | {MODEL_PATH}")
                    else:
                        print(f"    [!] Error saving model. File locked.")
                except Exception as e:
                    print(f"    [!] Save failure: {e}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", type=str, default="Partidas")
    args = parser.parse_args()

    print("\n" + "="*40)
    print("   ELITE-GEN TRAINING CONTROL")
    print("="*40)
    print(f"[*] Modo: {args.dir}")
    print("[1] CONTINUAR (Checkpoint actual)")
    print("[2] REINICIAR PGNs (Mantener inteligencia)")
    print("-" * 40)
    
    try:
        choice = input("Selecciona una opción (1-2): ").strip()
    except EOFError:
        choice = "1"
        
    trainer = EliteTrainer(pgn_dir=args.dir)
    
    if choice == '2':
        trainer.pgn_manager.current_pgn_idx = 0
        trainer.pgn_manager.current_game_idx = 0
        trainer.game_count = 0
        trainer.last_print_moves = trainer.total_moves # Reset log trigger
        trainer.pgn_manager._open_current_pgn()
        trainer.pgn_manager.save_checkpoint(total_moves=trainer.total_moves)
        print("\n[!] ARCHIVOS PGN REINICIADOS. Contadores puestos a 0. Manteniendo IA.")
    
    trainer.run()

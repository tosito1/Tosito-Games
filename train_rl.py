import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.amp import autocast, GradScaler
import chess
import numpy as np
import os
import random
import time
from engine.model import ChessNet, board_to_tensor
from engine.ai import AI

# --- MASTER-GEN RL CONFIG ---
MODEL_PATH = 'chess_net_ultra.pth'
NUM_RES_BLOCKS = 40
NUM_FILTERS = 256
SIMULATIONS_PER_MOVE = 400 # High quality search for targets
BATCH_SIZE = 64
REPLAY_BUFFER_SIZE = 50000
LR = 0.0001
EPISODES = 1000 # Number of games to play

class MasterTrainerRL:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[*] MASTER-GEN RL Trainer (AlphaZero) on {self.device}")
        
        self.model = ChessNet(num_res_blocks=NUM_RES_BLOCKS, num_filters=NUM_FILTERS).to(self.device)
        self.optimizer = optim.AdamW(self.model.parameters(), lr=LR, weight_decay=1e-5)
        self.scaler = GradScaler('cuda') if self.device.type == 'cuda' else GradScaler('cpu')
        
        if os.path.exists(MODEL_PATH):
            try:
                checkpoint = torch.load(MODEL_PATH, map_location=self.device)
                if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                    self.model.load_state_dict(checkpoint['model_state_dict'], strict=False)
                    print(f"[✓] Backbone Loaded into 40-block MASTER-GEN architecture (Strict: False)")
                else:
                    self.model.load_state_dict(checkpoint, strict=False)
                    print(f"[✓] Legacy Backbone Loaded. Upgrading to MASTER-GEN...")
            except Exception as e:
                print(f"[!] Error loading weights: {e}")
        
        self.ai = AI(color='white', difficulty='neural_max')
        # Overwrite internal net with our master model
        self.ai.net = self.model
        print(f"[!] AI Engine synchronized with 40-block MASTER-GEN model.")
        
        self.replay_buffer = [] # (state, mcts_probs, value_target)
        self.temp_memory = [] # (state, mcts_probs, player_turn)

    def select_move(self, board, move_count):
        # AlphaZero: Add Dirichlet Noise at the root for exploration in self-play
        # Using alpha=0.3 for chess
        move, value, probs = self.ai.mcts.search(board, SIMULATIONS_PER_MOVE, dirichlet_alpha=0.3)
        
        # Save state and MCTS distribution
        state = board_to_tensor(board)
        self.temp_memory.append((state, probs, board.turn))
        
        # Temperature Scaling: 
        # First 30 moves: select moves proportionally to visit counts (stochastic)
        # After 30 moves: select the best move (deterministic)
        if move_count < 30:
            legal_moves = list(board.legal_moves)
            move_probs = []
            for m in legal_moves:
                f_sq, t_sq = m.from_square, m.to_square
                if board.turn == chess.BLACK:
                    f_sq = (7 - (f_sq // 8)) * 8 + (f_sq % 8)
                    t_sq = (7 - (t_sq // 8)) * 8 + (t_sq % 8)
                move_probs.append(probs[f_sq * 64 + t_sq])
            
            # Normalize just in case of precision issues
            move_probs = np.array(move_probs)
            if move_probs.sum() > 0:
                move_probs /= move_probs.sum()
                move = np.random.choice(legal_moves, p=move_probs)
        
        return move

    def train_step(self):
        if len(self.replay_buffer) < BATCH_SIZE: return
        
        batch = random.sample(self.replay_buffer, BATCH_SIZE)
        states = torch.cat([x[0] for x in batch]).to(self.device)
        target_probs = torch.tensor(np.array([x[1] for x in batch])).to(self.device)
        target_values = torch.tensor(np.array([x[2] for x in batch]), dtype=torch.float32).unsqueeze(1).to(self.device)
        
        self.optimizer.zero_grad()
        with autocast('cuda' if self.device.type == 'cuda' else 'cpu'):
            logits, values = self.model(states)
            
            # Policy Loss: Cross Entropy with MCTS target distribution
            log_probs = F.log_softmax(logits, dim=1)
            loss_p = -torch.mean(torch.sum(target_probs * log_probs, dim=1))
            
            # Value Loss: MSE with game outcome
            loss_v = F.mse_loss(values, target_values)
            
            total_loss = loss_p + loss_v
            
        self.scaler.scale(total_loss).backward()
        self.scaler.step(self.optimizer)
        self.scaler.update()
        
        return total_loss.item()

    def run_episode(self, episode_idx):
        board = chess.Board()
        self.temp_memory = []
        
        move_cnt = 0
        while not board.is_game_over() and move_cnt < 250:
            move = self.select_move(board, move_cnt)
            board.push(move)
            move_cnt += 1
            
        # Analyze game outcome
        res = board.result()
        outcome = 0.0 # Draw
        if res == "1-0": outcome = 1.0 # White won
        elif res == "0-1": outcome = -1.0 # Black won
        
        # Backfill values to replay buffer
        for state, probs, turn in self.temp_memory:
            # Value is from perspective of current player
            v_target = outcome if turn == chess.WHITE else -outcome
            self.replay_buffer.append((state, probs, v_target))
            
        if len(self.replay_buffer) > REPLAY_BUFFER_SIZE:
            self.replay_buffer = self.replay_buffer[-REPLAY_BUFFER_SIZE:]
            
        print(f"    [EPISODE {episode_idx}] Result: {res} | Moves: {move_cnt} | Buffer: {len(self.replay_buffer)}")
        
        # Train on buffer
        for _ in range(10): # 10 training steps per game
            l = self.train_step()
            if l: print(f"    [LOSS] {l:.4f}", end='\r')

    def save(self, game_count, total_moves=0):
        checkpoint = {
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'game_count': game_count,
            'total_moves': total_moves
        }
        torch.save(checkpoint, MODEL_PATH)
        print(f"\n[✓] MODEL SAVED: {MODEL_PATH}")

if __name__ == "__main__":
    trainer = MasterTrainerRL()
    try:
        for i in range(1, EPISODES + 1):
            trainer.run_episode(i)
            if i % 10 == 0:
                trainer.save(i)
    except KeyboardInterrupt:
        print("\n[*] Training Interrupted.")
        trainer.save(0)

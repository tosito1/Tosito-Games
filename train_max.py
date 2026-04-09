import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import chess
import numpy as np
import os
import random
from engine.model import ChessNet, board_to_tensor
from engine.board import Board

# --- ELITE CONFIG ---
MODEL_PATH = 'chess_net_ultra.pth'
PARALLEL_ENVS = 16 
BATCH_SIZE = 128
LR = 0.0001
WEIGHT_DECAY = 1e-5

def train_self_play():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] ELITE-GEN Self-Play Training (Perspective-Invariant) on {device}")
    
    net = ChessNet(num_res_blocks=20, num_filters=256).to(device)
    if os.path.exists(MODEL_PATH):
        try:
            net.load_state_dict(torch.load(MODEL_PATH, map_location=device))
            print("[✓] Elite Model Resumed.")
        except: print("[!] Error loading model. Starting fresh.")
            
    optimizer = optim.AdamW(net.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    mse_crit = nn.MSELoss()
    ce_crit = nn.CrossEntropyLoss()
    
    boards = [chess.Board() for _ in range(PARALLEL_ENVS)]
    memory = []
    trajectories = [[] for _ in range(PARALLEL_ENVS)]
    
    while True:
        tensors = [board_to_tensor(b) for b in boards]
        t_batch = torch.cat(tensors).to(device)
        
        with torch.no_grad():
            p_logits, v_preds = net(t_batch)
        
        p_probs = F.softmax(p_logits, dim=1).cpu().numpy()
        
        for i in range(PARALLEL_ENVS):
            b = boards[i]
            legal = list(b.legal_moves)
            if not legal or b.is_game_over():
                res = 0.0
                outcome = b.outcome()
                if outcome:
                    if outcome.winner == chess.WHITE: res = 1.0
                    elif outcome.winner == chess.BLACK: res = -1.0
                for st, m_idx, is_w in trajectories[i]:
                    target_v = res if is_w else -res
                    memory.append((st, m_idx, target_v))
                if len(memory) > 50000: memory = memory[-50000:]
                trajectories[i] = []
                b.reset()
                continue
            
            # Select move
            move = random.choice(legal) if random.random() < 0.1 else None
            if not move:
                best_val = -1
                for m in legal:
                    # Perspective-Invariant Index Selection
                    m_fs, m_ts = m.from_square, m.to_square
                    if b.turn == chess.BLACK:
                        m_fs = (7 - (m_fs // 8)) * 8 + (m_fs % 8)
                        m_ts = (7 - (m_ts // 8)) * 8 + (m_ts % 8)
                    
                    idx = m_fs * 64 + m_ts
                    if p_probs[i][idx] > best_val:
                        best_val = p_probs[i][idx]
                        move = m
            
            # Perspective-Invariant Move Target
            f_abs, t_abs = move.from_square, move.to_square
            if b.turn == chess.BLACK:
                f_abs = (7 - (f_abs // 8)) * 8 + (f_abs % 8)
                t_abs = (7 - (t_abs // 8)) * 8 + (t_abs % 8)
            
            move_idx = f_abs * 64 + t_abs
            trajectories[i].append((tensors[i], move_idx, b.turn == chess.WHITE))
            b.push(move)
            
        if len(memory) >= BATCH_SIZE:
            batch = random.sample(memory, BATCH_SIZE)
            b_s = torch.cat([x[0] for x in batch]).to(device)
            b_m = torch.tensor([x[1] for x in batch], dtype=torch.long).to(device)
            b_v = torch.tensor([x[2] for x in batch], dtype=torch.float32).unsqueeze(1).to(device)
            
            optimizer.zero_grad()
            p_out, v_out = net(b_s)
            loss = mse_crit(v_out, b_v) + ce_crit(p_out, b_m)
            loss.backward()
            optimizer.step()
            
            if random.random() < 0.01:
                print(f"    [ELITE SELF-PLAY] Loss: {loss.item():.4f}")
                torch.save(net.state_dict(), MODEL_PATH)

if __name__ == "__main__":
    train_self_play()

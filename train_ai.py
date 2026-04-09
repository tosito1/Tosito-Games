import os
import torch
import torch.optim as optim
import torch.nn as nn
from torch.amp import autocast, GradScaler
import random
import chess
from engine.board import Board
from engine.ai import AI
from engine.model import board_to_tensor, ChessNet

# --- ELITE CONFIG ---
MODEL_PATH = 'chess_net_ultra.pth'
LR = 0.0001
BATCH_SIZE = 128
WEIGHT_DECAY = 1e-5

def train_vs_api():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] MASTER-GEN vs API Training (40x256) on {device}")
    
    student = AI(color='white', difficulty='neural_max')
    student.net = ChessNet(40, 256).to(device)
    if os.path.exists(MODEL_PATH):
        try: student.net.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        except: pass
            
    optimizer = optim.AdamW(student.net.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scaler = GradScaler('cuda') if device.type == 'cuda' else GradScaler('cpu')
    criterion = nn.CrossEntropyLoss()
    teacher = AI(color='black', difficulty='level_8')
    
    batch_states, batch_targets = [], []
    total_moves = 0
    
    while True:
        board = Board()
        while not board.chess_board.is_game_over():
            input_tensor = board_to_tensor(board)
            api_res = teacher.get_lichess_move(board)
            if isinstance(api_res, tuple) and api_res[0]:
                move_uci = api_res[0]
                m_obj = board.chess_board.parse_uci(move_uci)
                
                # Relative Perspective Flipped Index
                f_abs, t_abs = m_obj.from_square, m_obj.to_square
                if board.chess_board.turn == chess.BLACK:
                    f_abs = (7 - (f_abs // 8)) * 8 + (f_abs % 8)
                    t_abs = (7 - (t_abs // 8)) * 8 + (t_abs % 8)
                
                batch_states.append(input_tensor)
                batch_targets.append(f_abs * 64 + t_abs)
                board.chess_board.push(m_obj)
            else: break
            
            total_moves += 1
            if len(batch_states) >= BATCH_SIZE:
                s_batch = torch.cat(batch_states).to(device)
                t_batch = torch.tensor(batch_targets).to(device)
                optimizer.zero_grad()
                with autocast('cuda' if device.type == 'cuda' else 'cpu'):
                    logits, _ = student.net(s_batch)
                    loss = criterion(logits, t_batch)
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
                batch_states, batch_targets = [], []
                if total_moves % 500 == 0:
                    print(f"    [ELITE VS-API] Moves: {total_moves} | Loss: {loss.item():.4f}")
        
        if random.random() < 0.1:
            torch.save(student.net.state_dict(), MODEL_PATH)
            print("[✓] Elite Checkpoint Saved.")

if __name__ == "__main__":
    train_vs_api()

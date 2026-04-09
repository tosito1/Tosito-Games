import os
import torch
import torch.optim as optim
import torch.nn as nn
from torch.amp import autocast, GradScaler
import chess
import chess.pgn
from engine.board import Board
from engine.ai import AI
from engine.model import board_to_tensor, ChessNet
from pgn_manager import PGNManager
import json

# --- ELITE-GEN CONFIG ---
MODEL_PATH = 'chess_net_ultra.pth'
LR = 0.0001
BATCH_SIZE = 128
WEIGHT_DECAY = 1e-5

def train_pgn():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] ELITE-GEN Historical (Perspective-Invariant) on {device}")
    
    student = AI(color='white', difficulty='neural_max')
    student.net = ChessNet(20, 256).to(device)
    if os.path.exists(MODEL_PATH):
        try: student.net.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        except: pass
            
    optimizer = optim.AdamW(student.net.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scaler = GradScaler('cuda') if device.type == 'cuda' else GradScaler('cpu')
    criterion = nn.CrossEntropyLoss()
    pgn_manager = PGNManager('Partidas')
    
    batch_states, batch_targets = [], []
    total_moves = 0
    game_count = 0
    last_print = 0
    
    if os.path.exists('checkpoint_pgn.json'):
        try:
            with open('checkpoint_pgn.json', 'r') as f:
                data = json.load(f)
                total_moves = data.get('total_moves', 0)
                game_count = data.get('game_idx', 0)
                last_print = total_moves
                print(f"[✓] Cumulative Progress: {game_count} games, {total_moves} moves.")
        except: pass
    
    while True:
        game = pgn_manager.get_next_game()
        if not game: break
        game_count += 1
        board = Board()
        for move in game.mainline_moves():
            input_tensor = board_to_tensor(board)
            
            # Perspective-Invariant Target Move
            f_abs, t_abs = move.from_square, move.to_square
            if board.chess_board.turn == chess.BLACK:
                f_abs = (7 - (f_abs // 8)) * 8 + (f_abs % 8)
                t_abs = (7 - (t_abs // 8)) * 8 + (t_abs % 8)
            
            batch_states.append(input_tensor)
            batch_targets.append(f_abs * 64 + t_abs)
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
                if total_moves - last_print >= 1000:
                    print(f"    [ELITE PGN] Moves: {total_moves} | Loss: {loss.item():.4f}")
                    last_print = total_moves
            
            try: board.chess_board.push(move)
            except: break
                
        if os.path.getsize(MODEL_PATH) < 1000 or (random.random() < 0.05 if 'random' in locals() else True):
            temp_path = MODEL_PATH + ".tmp"
            torch.save(student.net.state_dict(), temp_path)
            
            success = False
            if os.path.exists(temp_path):
                import time
                for _ in range(3):
                    try:
                        os.replace(temp_path, MODEL_PATH)
                        success = True
                        break
                    except PermissionError:
                        time.sleep(0.5)
            
            if success:
                pgn_manager.current_game_idx = game_count
                pgn_manager.save_checkpoint(total_moves=total_moves)
                print(f"[✓] Elite Checkpoint Saved. Game: {game_count} | Total Moves: {total_moves}")
            else:
                print("[!] Error: No se pudo guardar el modelo (archivo bloqueado).")

if __name__ == "__main__":
    print("\n" + "="*40)
    print("   ELITE-PGN HISTORICAL CONTROL")
    print("="*40)
    print("[1] CONTINUAR (Checkpoint actual)")
    print("[2] REINICIAR (Volver al PGN 0)")
    print("-" * 40)
    
    try:
        choice = input("Selecciona una opción (1-2): ").strip()
    except EOFError:
        choice = "1"
        
    if choice == '2':
        # Reset checkpoint file
        if os.path.exists('checkpoint_pgn.json'):
            try:
                import json
                with open('checkpoint_pgn.json', 'r') as f:
                    data = json.load(f)
                data['pgn_idx'] = 0
                data['game_idx'] = 0
                with open('checkpoint_pgn.json', 'w') as f:
                    json.dump(data, f)
                print("\n[!] Checkpoint reiniciado. Iniciando desde el primer PGN.")
            except: pass
            
    train_pgn()

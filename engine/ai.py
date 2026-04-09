import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import re
import chess.polyglot
import chess.syzygy
from engine.model import ChessNet, board_to_tensor
from engine.mcts import MCTS

class AI:
    def __init__(self, color, difficulty, model_file=None):
        self.color = color
        self.difficulty = difficulty
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.temperature = 1.0
        self.net = None
        self.last_eval = 0.0
        self.mcts = None
        
        # Books & Tablebases Paths
        self.book_path = 'assets/books/gm2001.bin'
        self.syzygy_path = 'assets/syzygy'
        self.book = None
        self.tablebase = None
        
        # Load Libs
        if os.path.exists(self.book_path):
            try:
                self.book = chess.polyglot.open_reader(self.book_path)
                print(f"[*] Libro de apertura cargado: {self.book_path}")
            except Exception as e: print(f"[!] Error cargando libro: {e}")
            
        if os.path.isdir(self.syzygy_path):
            try:
                self.tablebase = chess.syzygy.open_tablebase(self.syzygy_path)
                print(f"[*] Tabla de finales Syzygy cargada en: {self.syzygy_path}")
            except Exception as e: print(f"[!] Error cargando Syzygy: {e}")
        
        if 'neural' in self.difficulty or model_file:
            if not model_file:
                model_file = 'chess_net_ultra.pth'
            
            if self.difficulty == 'neural_mid': self.temperature = 1.5
            elif self.difficulty == 'neural_max': self.temperature = 0.5
            
            try:
                if os.path.exists(model_file):
                    checkpoint = torch.load(model_file, map_location=self.device)
                    
                    # Unified Checkpoint vs Legacy State Dict
                    if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                        sd = checkpoint['model_state_dict']
                    else:
                        sd = checkpoint
                        
                    # --- AUTO-DETECTION of Architecture ---
                    n_blocks, n_filters, n_channels = 20, 256, 20
                    n_attn, n_heads = 4, 8
                    use_preact = False

                    if 'start_conv.weight' in sd:
                        n_filters = sd['start_conv.weight'].shape[0]
                        n_channels = sd['start_conv.weight'].shape[1]
                        
                        # Blocks
                        res_keys = [k for k in sd.keys() if k.startswith('res_blocks.')]
                        if res_keys:
                            import re
                            indices = [int(re.search(r'res_blocks\.(\d+)\.', k).group(1)) for k in res_keys]
                            n_blocks = max(indices) + 1
                            
                        # Pre-Act Detection (Final BN exists only in Pre-Act)
                        if 'final_bn.weight' in sd:
                            use_preact = True
                            
                        # Attention Blocks
                        attn_keys = [k for k in sd.keys() if k.startswith('attention_blocks.')]
                        if attn_keys:
                            attn_indices = [int(re.search(r'attention_blocks\.(\d+)\.', k).group(1)) for k in attn_keys]
                            n_attn = max(attn_indices) + 1
                            
                            # Heuristic for Heads: if 320 filters, 16 heads is standard for Mega-Gen
                            if n_filters == 320: n_heads = 16
                    
                    print(f"[*] Cargando IA {'Mega-Gen 2.0' if use_preact else 'Elite-Gen'} ({n_blocks}x{n_filters}, {n_attn} Attn)")
                    self.net = ChessNet(num_res_blocks=n_blocks, num_filters=n_filters, 
                                       num_attention_blocks=n_attn, num_heads=n_heads, 
                                       use_preact=use_preact).to(self.device)
                    self.net.load_state_dict(sd, strict=False)
                    self.net.eval()
                    
                    # Initialize MCTS (Turbo: Batch size 32 for higher throughput)
                    self.mcts = MCTS(self.net, self.device, batch_size=32)
                else:
                    print(f"[*] Iniciando modelo Elite-Gen fresco (No existe {model_file}).")
                    self.net = ChessNet().to(self.device)
            except Exception as e:
                print(f"Error loading AI ({model_file}): {e}")
                self.net = ChessNet().to(self.device)
                
    def get_best_move(self, board, simulations=None):
        import chess
        if not self.net: return None
        
        chess_board = board.chess_board if hasattr(board, 'chess_board') else board
        
        # 1. LIBRO DE APERTURAS (Polyglot)
        if self.book:
            try:
                entry = self.book.get(chess_board)
                if entry:
                    print(f"[*] Jugada de LIBRO: {entry.move}")
                    return entry.move, 0.0
            except: pass
            
        # 2. TABLAS DE FINALES (Syzygy)
        # Solo se activan si hay <= 6 piezas (estándar de peso ligero)
        if self.tablebase and len(chess_board.piece_map()) <= 6:
            try:
                # WDL (Win-Draw-Loss) para evaluar el nodo
                wdl = self.tablebase.get_wdl(chess_board)
                if wdl is not None:
                    # DTZ (Distance To Zeroing) para elegir la jugada exacta
                    best_move = None
                    for move in chess_board.legal_moves:
                        chess_board.push(move)
                        m_wdl = -self.tablebase.get_wdl(chess_board)
                        chess_board.pop()
                        
                        if m_wdl == wdl: # Mantiene el mejor resultado
                            best_move = move
                            break # Encontramos una jugada que mantiene la victoria/tablas
                            
                    if best_move:
                        print(f"[*] Jugada de TABLA DE FINALES: {best_move} (WDL: {wdl})")
                        self.last_eval = float(wdl) / 2.0
                        return best_move, self.last_eval
            except: pass

        # 3. MCTS Search (El pensar de la IA)
        if simulations is None:
            if self.difficulty == 'neural_max':
                simulations = 4000 # Ultra-Deep Search
            elif self.difficulty == 'neural_mid':
                simulations = 1000 # High Search
            else:
                simulations = 0
        
        if simulations > 0 and self.mcts:
            best_move, value, _ = self.mcts.search(chess_board, simulations) # Unpack 3rd value (probs)
            self.last_eval = value
            return best_move, self.last_eval

        # 4. Fallback to 1-ply Policy (Tradicional)
        input_tensor = board_to_tensor(board).to(self.device)
        with torch.no_grad():
            logits, value = self.net(input_tensor)
            self.last_eval = value.item()
        
        probs = F.softmax(logits / self.temperature, dim=1).cpu().numpy()[0]
        legal_moves = list(board.chess_board.legal_moves) if hasattr(board, 'chess_board') else list(board.legal_moves)
        
        best_move = None
        best_val = -1
        for m in legal_moves:
            m_fs, m_ts = m.from_square, m.to_square
            
            # Check perspective
            turn = board.chess_board.turn if hasattr(board, 'chess_board') else board.turn
            if turn == chess.BLACK:
                m_fs = (7 - (m_fs // 8)) * 8 + (m_fs % 8)
                m_ts = (7 - (m_ts // 8)) * 8 + (m_ts % 8)
                
            idx = m_fs * 64 + m_ts
            if probs[idx] > best_val:
                best_val = probs[idx]
                best_move = m
            
        return best_move, self.last_eval

    def get_lichess_move(self, board):
        import urllib.request
        import urllib.parse
        import urllib.error
        import json
        try:
            fen = board.chess_board.fen() if hasattr(board, 'chess_board') else board.fen()
            encoded_fen = urllib.parse.quote(fen)
            url = f"https://stockfish.online/api/s/v2.php?fen={encoded_fen}&depth=12"
            req = urllib.request.Request(url, headers={'User-Agent': 'Chess-AI-Elite/1.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = response.read().decode()
                data = json.loads(res_data)
                if data.get('success') and 'bestmove' in data:
                    move_part = data['bestmove'].split(' ')[1] if 'bestmove ' in data['bestmove'] else data['bestmove']
                    return move_part, 1.0
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"[!] Límite de API (429). Esperando 5s y reintentando...")
                import time
                time.sleep(5)
                return self.get_lichess_move(board)
            else:
                print(f"[!] Engine API HTTP Error {e.code}: {e.reason}")
        except Exception as e:
            print(f"[!] Engine API Error: {e}")
        return None, 0.0

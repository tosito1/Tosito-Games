import os
import chess.pgn
import json

class PGNManager:
    def __init__(self, pgn_dir):
        self.pgn_dir = pgn_dir
        # Create a safe filename from the directory path
        slug = pgn_dir.replace('\\', '_').replace('/', '_').replace(':', '').strip('_')
        self.checkpoint_file = f'checkpoint_pgn_{slug}.json'
        self.current_pgn_idx = 0
        self.current_game_idx = 0
        
        # Recursive Discovery of PGN files
        self.pgn_files = []
        for root, _, files in os.walk(pgn_dir):
            for f in files:
                if f.endswith('.pgn'):
                    self.pgn_files.append(os.path.join(root, f))
        
        self.pgn_files.sort()
        print(f"[*] PGN Manager: Encontrados {len(self.pgn_files)} archivos PGN.")
        
        self.load_checkpoint()
        self.current_pgn_stream = None
        self._open_current_pgn()

    def load_checkpoint(self):
        if os.path.exists(self.checkpoint_file):
            try:
                with open(self.checkpoint_file, 'r') as f:
                    data = json.load(f)
                    self.current_pgn_idx = data.get('pgn_idx', 0)
                    self.current_game_idx = data.get('game_idx', 0)
                    print(f"[*] Checkpoint cargado: Archivo {self.current_pgn_idx}, Juego {self.current_game_idx}")
            except: pass

    def save_checkpoint(self, total_moves=0):
        with open(self.checkpoint_file, 'w') as f:
            json.dump({
                'pgn_idx': self.current_pgn_idx,
                'game_idx': self.current_game_idx,
                'total_moves': total_moves
            }, f)

    def _open_current_pgn(self):
        if self.current_pgn_idx < len(self.pgn_files):
            file_path = self.pgn_files[self.current_pgn_idx]
            self.current_pgn_stream = open(file_path, 'r', errors='ignore')
            # Skip games already processed
            for i in range(self.current_game_idx):
                game = chess.pgn.read_game(self.current_pgn_stream)
                if game is None: break

    def get_next_game(self, auto_loop=False):
        while True:
            if self.current_pgn_idx >= len(self.pgn_files):
                if auto_loop:
                    self.current_pgn_idx = 0
                    self.current_game_idx = 0
                    if self.current_pgn_stream:
                        self.current_pgn_stream.close()
                    self.current_pgn_stream = None
                    print("\n[↺] PGN Cycle Complete. Restarting from first file (Infinity Mode)...")
                else:
                    return None
            
            if not self.current_pgn_stream:
                self._open_current_pgn()
            
            if not self.current_pgn_stream: # Still none? Skip file
                self.current_pgn_idx += 1
                continue

            game = chess.pgn.read_game(self.current_pgn_stream)
            if game:
                self.current_game_idx += 1
                return game
            else:
                # End of file
                self.current_pgn_stream.close()
                self.current_pgn_stream = None
                self.current_pgn_idx += 1
                self.current_game_idx = 0

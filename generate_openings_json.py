import os
import json
import chess.pgn
import io

# Config
PGN_SOURCE_DIR = os.path.join("Partidas", "pgnmentor", "aperturas")
OUTPUT_JSON = os.path.join("public", "api", "openings.json")
MAX_MOVES = 12  # Extract first 12 plies (6 full moves)

def process_pgns():
    if not os.path.exists(PGN_SOURCE_DIR):
        print(f"[!] Error: Source directory {PGN_SOURCE_DIR} not found.")
        return

    openings_data = []
    pgn_files = [f for f in os.listdir(PGN_SOURCE_DIR) if f.endswith(".pgn")]
    print(f"[*] Found {len(pgn_files)} PGN files to process.")

    for i, filename in enumerate(pgn_files):
        file_path = os.path.join(PGN_SOURCE_DIR, filename)
        
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                # Read the first game of the file
                game = chess.pgn.read_game(f)
                if not game:
                    print(f"    [!] Skipping {filename}: No games found.")
                    continue

                headers = game.headers
                eco = headers.get("ECO", "???")
                # Use Opening header or filename if not present
                name = headers.get("Opening", filename.replace(".pgn", ""))
                
                # Extract moves
                moves_san = []
                moves_lan = []
                board = game.board()
                
                for j, move in enumerate(game.mainline_moves()):
                    if j >= MAX_MOVES:
                        break
                    moves_san.append(board.san(move))
                    moves_lan.append(move.uci())
                    board.push(move)

                # Create Entry
                op_id = f"{eco}_{filename.replace('.pgn', '')}".replace(" ", "_")
                
                entry = {
                    "id": op_id,
                    "name": name,
                    "eco": eco,
                    "description": f"Apertura analizada desde el archivo {filename}. Contiene líneas teóricas principales.",
                    "moves_lan": moves_lan,
                    "moves_san": moves_san
                }
                
                openings_data.append(entry)
                print(f"    [{i+1}/{len(pgn_files)}] Processed: {name} ({eco})")

        except Exception as e:
            print(f"    [!] Error processing {filename}: {e}")

    # Save to JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as out:
        json.dump(openings_data, out, indent=2, ensure_ascii=False)
    
    print(f"\n[✓] Successfully generated {len(openings_data)} openings in {OUTPUT_JSON}")

if __name__ == "__main__":
    process_pgns()

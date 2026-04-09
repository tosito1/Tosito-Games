import os
import json
import chess.pgn
import io

# Config
PLAYER_DIRS = [
    os.path.join("Partidas", "pgnmentor", "jugadores"),
    os.path.join("Partidas", "Partidas")
]
MASTERS_JSON = os.path.join("public", "api", "historical_masters.json")
GAMES_JSON = os.path.join("public", "api", "historical_games.json")
GAMES_PER_PLAYER = 20

def process_masters():
    masters_list = []
    games_list = []
    processed_ids = set()
    
    for pdir in PLAYER_DIRS:
        if not os.path.exists(pdir):
            print(f"[!] Warning: Directory {pdir} not found. Skipping.")
            continue

        pgn_files = [f for f in os.listdir(pdir) if f.endswith(".pgn")]
        print(f"[*] Found {len(pgn_files)} PGN files in {pdir}.")

        for i, filename in enumerate(pgn_files):
            master_name = filename.replace(".pgn", "").capitalize()
            master_id = master_name.lower().replace(" ", "_").replace(".", "")
            
            if master_id in processed_ids:
                continue
            processed_ids.add(master_id)
            
            file_path = os.path.join(pdir, filename)
            
            # Add to Masters List
            masters_list.append({
                "id": master_id,
                "name": master_name
            })

            # Extract Games
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    games_found = 0
                    while games_found < GAMES_PER_PLAYER:
                        game = chess.pgn.read_game(f)
                        if not game:
                            break
                        
                        headers = game.headers
                        
                        # Basic extraction
                        moves_san = []
                        for move in game.mainline_moves():
                            moves_san.append(str(move)) # UCI/LAN format is needed for engine
                        
                        game_data = {
                            "masterId": master_id,
                            "white": headers.get("White", "Unknown"),
                            "black": headers.get("Black", "Unknown"),
                            "result": headers.get("Result", "*"),
                            "event": headers.get("Event", "?"),
                            "date": headers.get("Date", "????.??.??"),
                            "site": headers.get("Site", "?"),
                            "eco": headers.get("ECO", ""),
                            "moves": " ".join(moves_san) # Joining UCI moves
                        }
                        
                        games_list.append(game_data)
                        games_found += 1
                
                print(f"    [{i+1}/{len(pgn_files)}] {master_name}: {games_found} games extracted.")

            except Exception as e:
                print(f"    [!] Error processing {filename}: {e}")

    # Save Masters
    with open(MASTERS_JSON, "w", encoding="utf-8") as out:
        json.dump(masters_list, out, indent=2, ensure_ascii=False)
    
    # Save Games
    with open(GAMES_JSON, "w", encoding="utf-8") as out:
        json.dump(games_list, out, indent=2, ensure_ascii=False)

    print(f"\n[✓] Extracted {len(masters_list)} masters and {len(games_list)} games.")
    print(f"[*] Files saved to {MASTERS_JSON} and {GAMES_JSON}")

if __name__ == "__main__":
    process_masters()

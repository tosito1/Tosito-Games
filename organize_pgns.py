import os
import urllib.request
import re
import shutil

BASE_URL = "https://www.pgnmentor.com/"
FILES_PAGE = BASE_URL + "files.html"
ROOT_DIR = os.path.join("Partidas", "pgnmentor")
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

CATEGORIES = {
    "players/": "jugadores",
    "openings/": "aperturas",
    "events/": "torneos"
}

def get_mapping():
    print(f"[*] Analizando {FILES_PAGE} para obtener categorías...")
    req = urllib.request.Request(FILES_PAGE, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
    except:
        return {}

    # Match: href="players/Carlsen.zip"
    mapping = {}
    pattern = r'href=["\']((players/|openings/|events/)[^"\']+\.zip)["\']'
    matches = re.findall(pattern, html, re.IGNORECASE)
    
    for full_path, prefix in matches:
        filename = full_path.split('/')[-1].replace('.zip', '.pgn')
        folder = CATEGORIES.get(prefix.lower())
        if folder:
            mapping[filename] = folder
    return mapping

def organize():
    mapping = get_mapping()
    if not mapping:
        print("[!] No se pudo obtener el mapa de categorías.")
        return

    # Create folders
    for folder in CATEGORIES.values():
        path = os.path.join(ROOT_DIR, folder)
        if not os.path.exists(path):
            os.makedirs(path, exist_ok=True)

    print("[*] Organizando archivos PGN...")
    count = 0
    # List current PGNs in ROOT_DIR
    for f in os.listdir(ROOT_DIR):
        if f.endswith('.pgn') and f in mapping:
            src = os.path.join(ROOT_DIR, f)
            dest_dir = os.path.join(ROOT_DIR, mapping[f])
            dest = os.path.join(dest_dir, f)
            
            try:
                shutil.move(src, dest)
                count += 1
            except Exception as e:
                print(f"Error moviendo {f}: {e}")

    print(f"[✓] Se han organizado {count} archivos en sus carpetas correspondientes.")

if __name__ == "__main__":
    organize()

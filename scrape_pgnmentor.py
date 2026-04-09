import os
import urllib.request
import re
import zipfile
import io
import time

# --- CONFIG ---
BASE_URL = "https://www.pgnmentor.com/"
FILES_PAGE = BASE_URL + "files.html"
TARGET_DIR = os.path.join("Partidas", "pgnmentor")
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

def get_html(url):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"[!] Request failed for {url}: {e}")
        return None

def download_file(url):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read()
    except Exception as e:
        print(f"\n[!] Download failed for {url}: {e}")
        return None

def download_and_extract():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR, exist_ok=True)
        print(f"[*] Created directory: {TARGET_DIR}")

    print(f"[*] Fetching page: {FILES_PAGE}")
    html_content = get_html(FILES_PAGE)
    if not html_content:
        return

    # Use Regex to find .zip links (players/, openings/, events/)
    pattern = r'href=["\']((players/|openings/|events/)[^"\']+\.zip)["\']'
    matches = re.findall(pattern, html_content, re.IGNORECASE)
    
    CATEGORIES = {"players/": "jugadores", "openings/": "aperturas", "events/": "torneos"}
    
    zip_tasks = []
    seen = set()
    for full_path, prefix in matches:
        h_low = full_path.lower()
        if h_low not in seen:
            url = BASE_URL + full_path if not full_path.startswith('http') else full_path
            folder = CATEGORIES.get(prefix.lower(), "")
            zip_tasks.append((url, folder))
            seen.add(h_low)

    total = len(zip_tasks)
    print(f"[✓] Found {total} unique ZIP files to process.")
    
    # ... (skipping check for brevity, assuming same logic) ...

    for i, (url, folder) in enumerate(zip_tasks):
        filename = url.split('/')[-1]
        print(f"[{i+1}/{total}] Processing: {folder}/{filename}...", end='\r')
        
        target_subdir = os.path.join(TARGET_DIR, folder)
        os.makedirs(target_subdir, exist_ok=True)
        
        file_data = download_file(url)
        if file_data:
            try:
                with zipfile.ZipFile(io.BytesIO(file_data)) as z:
                    z.extractall(target_subdir)
            except Exception as e:
                print(f"\n[!] Error extracting {filename}: {e}")
        
        # Polite delay
        time.sleep(0.3)

    print(f"\n[✓] Finished downloading and extracting PGNs to '{TARGET_DIR}'.")

if __name__ == "__main__":
    download_and_extract()

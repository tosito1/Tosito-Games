import torch
import torch.nn as nn
import os
import re
from engine.model import ChessNet

def check_model(path):
    print(f"\n[*] Checking: {path}")
    if not os.path.exists(path):
        print("  [!] File not found.")
        return
    
    try:
        sd = torch.load(path, map_location='cpu', weights_only=False)
        n_filters = sd['start_conv.weight'].shape[0] if 'start_conv.weight' in sd else 128
        res_keys = [k for k in sd.keys() if k.startswith('res_blocks.')]
        n_blocks = 0
        if res_keys:
            indices = [int(re.search(r'res_blocks\.(\d+)\.', k).group(1)) for k in res_keys]
            n_blocks = max(indices) + 1
        
        print(f"  [+] Size: {os.path.getsize(path)/1024/1024:.2f} MB")
        print(f"  [+] Architecture: {n_blocks} ResBlocks, {n_filters} Filters")
        
        try:
            net = ChessNet(num_res_blocks=n_blocks, num_filters=n_filters)
            net.load_state_dict(sd)
            print("  [✓] Model is LOADABLE and valid.")
        except Exception as e:
            print(f"  [!] Model Initialization Error: {e}")
            
    except Exception as e:
        print(f"  [!] Load failed: {e}")

if __name__ == "__main__":
    files = [f for f in os.listdir('.') if f.endswith('.pth')]
    for f in sorted(files):
        check_model(f)

import torch
import torch.optim as optim
import torch.nn as nn
import random
import os
import time
import numpy as np
from engine.model import ChessNet, board_to_tensor
from engine.board import Board

# ULTRA-GEN 20x256 Configuration
MODEL_PATH = "chess_net_ultra.pth"
PARALLEL_GAMES = 16 # Safe for 20x256 on 8GB VRAM
LR = 0.0001

class ParallelTrainer:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[*] Parallel ULTRA-GEN Trainer on {self.device}")
        self.net = ChessNet(20, 256).to(self.device)
        if os.path.exists(MODEL_PATH):
            self.net.load_state_dict(torch.load(MODEL_PATH, map_location=self.device))
        self.optimizer = optim.Adam(self.net.parameters(), lr=LR)

if __name__ == "__main__":
    ParallelTrainer()

import torch
from engine.ai import AI
from engine.board import Board

class InteractiveTrainer:
    def __init__(self):
        # Elite-Gen 20-channel model
        self.ai = AI(color='white', difficulty='neural_max')
        print("[*] Interactive Elite-Gen Trainer Active.")
        print(f"[*] Architecture: {self.ai.net.__class__.__name__} (20x256, SE-Enabled)")

if __name__ == "__main__":
    InteractiveTrainer()

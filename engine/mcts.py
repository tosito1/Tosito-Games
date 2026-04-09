import math
import numpy as np
import torch
import torch.nn.functional as F
import chess
from engine.model import board_to_tensor

class MCTSNode:
    def __init__(self, prior, parent=None):
        self.parent = parent
        self.children = {}
        self.visit_count = 0
        self.value_sum = 0
        self.prior = prior
        self.virtual_loss = 0 # Turbo: Virtual Loss for parallelism

    @property
    def value(self):
        # Q + VirtualLoss adjustment
        count = self.visit_count + self.virtual_loss
        if count == 0: return 0
        return self.value_sum / count

    def select_child(self, cpuct):
        best_score = -float('inf')
        best_move = None
        best_child = None

        for move, child in self.children.items():
            # UCB with Virtual Loss
            score = child.value + cpuct * child.prior * math.sqrt(self.visit_count) / (1 + child.visit_count + child.virtual_loss)
            if score > best_score:
                best_score = score
                best_move = move
                best_child = child
        
        return best_move, best_child

    def expand(self, board, action_probs):
        for move in board.legal_moves:
            f_sq, t_sq = move.from_square, move.to_square
            if board.turn == chess.BLACK:
                f_sq = (7 - (f_sq // 8)) * 8 + (f_sq % 8)
                t_sq = (7 - (t_sq // 8)) * 8 + (t_sq % 8)
            
            idx = f_sq * 64 + t_sq
            prob = action_probs[idx]
            
            if move not in self.children:
                self.children[move] = MCTSNode(prior=prob, parent=self)

    def is_expanded(self):
        return len(self.children) > 0

class MCTS:
    def __init__(self, model, device, cpuct=1.5, batch_size=5):
        self.model = model
        self.device = device
        self.cpuct = cpuct
        self.batch_size = batch_size # How many leaves to eval at once

    def search(self, board, num_simulations, dirichlet_alpha=None, noise_weight=0.25):
        root = MCTSNode(prior=0)
        
        # Parallel Batches
        num_batches = num_simulations // self.batch_size
        if num_batches == 0: num_batches = 1
        
        for batch_idx in range(num_batches):
            leaves = []
            search_boards = []
            paths = []

            # 1. SELECT BATCH OF LEAVES
            for _ in range(self.batch_size):
                node = root
                search_board = board.copy()
                path = [node]
                
                while node.is_expanded():
                    move, node = node.select_child(self.cpuct)
                    search_board.push(move)
                    node.virtual_loss += 1 
                    path.append(node)
                
                leaves.append(node)
                search_boards.append(search_board)
                paths.append(path)

            # 2. BATCH EVALUATE
            input_tensors = [board_to_tensor(b) for b in search_boards]
            input_batch = torch.cat(input_tensors).to(self.device)
            
            with torch.no_grad():
                policy_batch, value_batch = self.model(input_batch)
            
            probs_batch = F.softmax(policy_batch, dim=1).cpu().numpy()
            values_batch = value_batch.cpu().numpy().flatten()

            # 3. BACKPROP BATCH
            for i in range(self.batch_size):
                leaf = leaves[i]
                path = paths[i]
                val = values_batch[i]
                
                if search_boards[i].is_game_over():
                    res = search_boards[i].result()
                    if res == "1-0": val = 1.0 if board.turn == chess.WHITE else -1.0
                    elif res == "0-1": val = -1.0 if board.turn == chess.WHITE else 1.0
                    else: val = 0.0
                else:
                    leaf.expand(search_boards[i], probs_batch[i])
                    
                # AlphaZero: Add Dirichlet Noise to Root only after expansion
                if batch_idx == 0 and leaf == root and dirichlet_alpha is not None:
                    moves = list(root.children.keys())
                    noise = np.random.dirichlet([dirichlet_alpha] * len(moves))
                    for j, m in enumerate(moves):
                        root.children[m].prior = (1 - noise_weight) * root.children[m].prior + noise_weight * noise[j]

                # Backup
                curr_v = val
                for node in reversed(path):
                    node.virtual_loss -= 1
                    node.visit_count += 1
                    node.value_sum += curr_v
                    curr_v = -curr_v

        # Return best move and probabilities for RL
        best_move = None
        max_visits = -1
        
        # Map visits to policy indices
        probs = np.zeros(4096, dtype=np.float32)
        total_visits = sum(child.visit_count for child in root.children.values())
        
        for move, child in root.children.items():
            if child.visit_count > max_visits:
                max_visits = child.visit_count
                best_move = move
            
            # Policy index: FromSquare * 64 + ToSquare
            f_sq, t_sq = move.from_square, move.to_square
            if board.turn == chess.BLACK:
                f_sq = (7 - (f_sq // 8)) * 8 + (f_sq % 8)
                t_sq = (7 - (t_sq // 8)) * 8 + (t_sq % 8)
            
            idx = f_sq * 64 + t_sq
            probs[idx] = child.visit_count / total_visits if total_visits > 0 else 0
        
        return best_move, root.value, probs

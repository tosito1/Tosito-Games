import chess
import numpy as np
from engine.piece import Pawn, Knight, Bishop, Rook, Queen, King

class Board:
    def __init__(self, fen=None):
        self.chess_board = chess.Board(fen) if fen else chess.Board()
        self.turn = 'white' if self.chess_board.turn == chess.WHITE else 'black'
        self.grid = self._update_grid()

    def _update_grid(self):
        grid = [[None for _ in range(8)] for _ in range(8)]
        for sq in chess.SQUARES:
            p = self.chess_board.piece_at(sq)
            if p:
                r, c = 7 - (sq // 8), sq % 8
                color = 'white' if p.color == chess.WHITE else 'black'
                pt = p.piece_type
                if pt == chess.PAWN: grid[r][c] = Pawn(color)
                elif pt == chess.KNIGHT: grid[r][c] = Knight(color)
                elif pt == chess.BISHOP: grid[r][c] = Bishop(color)
                elif pt == chess.ROOK: grid[r][c] = Rook(color)
                elif pt == chess.QUEEN: grid[r][c] = Queen(color)
                elif pt == chess.KING: grid[r][c] = King(color)
        return grid

    def move_piece(self, start_pos, end_pos, promotion=None):
        # Convert (r, c) to chess.Square
        from_sq = (7 - start_pos[0]) * 8 + start_pos[1]
        to_sq = (7 - end_pos[0]) * 8 + end_pos[1]
        move = chess.Move(from_sq, to_sq)
        if promotion: move.promotion = promotion
        if move in self.chess_board.legal_moves:
            self.chess_board.push(move)
            self.grid = self._update_grid()
            self.turn = 'white' if self.chess_board.turn == chess.WHITE else 'black'
            return True
        return False

    def is_checkmate(self, color):
        return self.chess_board.is_checkmate()
    
    def get_valid_moves_all(self, color):
        moves = []
        for move in self.chess_board.legal_moves:
            f = move.from_square
            t = move.to_square
            moves.append(((7 - (f // 8), f % 8), (7 - (t // 8), t % 8)))
        return moves

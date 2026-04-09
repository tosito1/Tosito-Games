import os
import pygame
import chess
from engine.board import Board
from engine.ai import AI

# Colors and Theme
COLOR_LIGHT = (235, 235, 208)
COLOR_DARK = (119, 148, 85)
COLOR_BG = (30, 30, 35)
COLOR_HIGHLIGHT = (255, 255, 0, 100) # Semi-transparent yellow

class ChessGUI:
    def __init__(self):
        pygame.init()
        self.size = 600
        self.sq_size = self.size // 8
        self.screen = pygame.display.set_mode((self.size + 200, self.size))
        pygame.display.set_caption("ELITE-GEN Chess Engine")
        
        self.board = Board()
        self.ai = AI(color='black', difficulty='neural_max')
        self.selected_sq = None
        self.last_move = None
        
        # Load Assets
        self.pieces = {}
        self.load_assets()
        
    def load_assets(self):
        # Piece types mapping for Android-style naming: ic_white_pawn_v.png
        p_names = {
            'p': 'pawn', 'n': 'knight', 'b': 'bishop',
            'r': 'rook', 'q': 'queen', 'k': 'king'
        }
        for color in ['white', 'black']:
            for char, p_name in p_names.items():
                path = f"assets/pieces/ic_{color}_{p_name}_v.png"
                if os.path.exists(path):
                    img = pygame.image.load(path)
                    self.pieces[f"{color}_{char}"] = pygame.transform.smoothscale(img, (self.sq_size, self.sq_size))
                else:
                    print(f"[!] Warning: missing asset {path}")

    def draw_board(self):
        # Premium Colors
        COLOR_LIGHT = (238, 238, 210)
        COLOR_DARK = (118, 150, 86)
        COLOR_LAST_MOVE = (246, 246, 105, 120)
        
        for r in range(8):
            for c in range(8):
                color = COLOR_LIGHT if (r + c) % 2 == 0 else COLOR_DARK
                pygame.draw.rect(self.screen, color, (c * self.sq_size, r * self.sq_size, self.sq_size, self.sq_size))
        
        # Highlight Last Move
        if self.last_move:
            for sq in [self.last_move.from_square, self.last_move.to_square]:
                r, c = 7 - (sq // 8), sq % 8
                s = pygame.Surface((self.sq_size, self.sq_size), pygame.SRCALPHA)
                s.fill(COLOR_LAST_MOVE)
                self.screen.blit(s, (c * self.sq_size, r * self.sq_size))

        # Highlight Selected Square
        if self.selected_sq is not None:
            r, c = 7 - (self.selected_sq // 8), self.selected_sq % 8
            s = pygame.Surface((self.sq_size, self.sq_size), pygame.SRCALPHA)
            s.fill((100, 255, 100, 130))
            self.screen.blit(s, (c * self.sq_size, r * self.sq_size))

    def draw_pieces(self):
        b = self.board.chess_board
        for sq in chess.SQUARES:
            piece = b.piece_at(sq)
            if piece:
                color = "white" if piece.color == chess.WHITE else "black"
                p_type = chess.piece_name(piece.piece_type)[0] if piece.piece_type != chess.KNIGHT else 'n'
                key = f"{color}_{p_type}"
                if key in self.pieces:
                    # Added a small offset to center pieces better if necessary
                    r, c = 7 - (sq // 8), sq % 8
                    self.screen.blit(self.pieces[key], (c * self.sq_size, r * self.sq_size))

    def run(self):
        running = True
        while running:
            self.screen.fill(COLOR_BG)
            
            # AI Move
            if self.board.chess_board.turn == chess.BLACK and not self.board.chess_board.is_game_over():
                # --- IA PENSANDO Overlay ---
                self.draw_board()
                self.draw_pieces()
                s = pygame.Surface((self.size, self.size), pygame.SRCALPHA)
                s.fill((0, 0, 0, 80)) # Subtle dark overlay on board
                self.screen.blit(s, (0, 0))
                
                pygame.display.flip()
                
                move, evaluation = self.ai.get_best_move(self.board)
                if move:
                    self.board.chess_board.push(move)
                    self.last_move = move
                    self.ai.last_eval = evaluation # Update for panel
                
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    pos = pygame.mouse.get_pos()
                    if pos[0] < self.size:
                        c, r = pos[0] // self.sq_size, pos[1] // self.sq_size
                        sq = (7 - r) * 8 + c
                        
                        if self.selected_sq is None:
                            if self.board.chess_board.piece_at(sq) and self.board.chess_board.color_at(sq) == chess.WHITE:
                                self.selected_sq = sq
                        else:
                            move = chess.Move(self.selected_sq, sq)
                            # Promotion
                            if self.board.chess_board.piece_at(self.selected_sq) and \
                               self.board.chess_board.piece_at(self.selected_sq).piece_type == chess.PAWN:
                                if (7 - r) == 7 or (7 - r) == 0:
                                    move.promotion = chess.QUEEN
                                    
                            if move in self.board.chess_board.legal_moves:
                                self.board.chess_board.push(move)
                                self.last_move = move
                                self.selected_sq = None
                            else:
                                if self.board.chess_board.piece_at(sq) and self.board.chess_board.color_at(sq) == chess.WHITE:
                                    self.selected_sq = sq
                                else:
                                    self.selected_sq = None
            
            self.draw_board()
            self.draw_pieces()
            
            # --- PREMIUM SIDEBAR ---
            # Modern Sidebar Background
            SIDEBAR_X = self.size
            pygame.draw.rect(self.screen, (25, 25, 30), (SIDEBAR_X, 0, 200, self.size))
            pygame.draw.line(self.screen, (60, 60, 70), (SIDEBAR_X, 0), (SIDEBAR_X, self.size), 2)
            
            # Fonts
            title_font = pygame.font.SysFont("Segoe UI", 28, bold=True)
            label_font = pygame.font.SysFont("Segoe UI", 16)
            value_font = pygame.font.SysFont("Segoe UI", 18, bold=True)
            
            # Header
            self.screen.blit(title_font.render("ELITE-GEN", True, (0, 210, 255)), (SIDEBAR_X + 25, 30))
            pygame.draw.line(self.screen, (0, 210, 255), (SIDEBAR_X + 25, 70), (SIDEBAR_X + 175, 70), 2)
            
            # Status Box
            is_over = self.board.chess_board.is_game_over()
            status_text = "FINALIZADO" if is_over else ("IA PENSANDO..." if self.board.chess_board.turn == chess.BLACK else "TU TURNO")
            status_color = (255, 100, 100) if self.board.chess_board.turn == chess.BLACK else (100, 255, 100)
            if is_over: status_color = (255, 255, 0)
            
            s_box = pygame.Rect(SIDEBAR_X + 15, 90, 170, 45)
            pygame.draw.rect(self.screen, (40, 40, 50), s_box, border_radius=8)
            pygame.draw.rect(self.screen, status_color, s_box, width=2, border_radius=8)
            
            txt_surface = value_font.render(status_text, True, status_color)
            txt_rect = txt_surface.get_rect(center=s_box.center)
            self.screen.blit(txt_surface, txt_rect)
            
            # Info Section
            y_off = 160
            info_items = [
                ("Modelo", "SE-ResNet 20x256"),
                ("Dificultad", "Ultra-Gen (MAX)"),
                ("Lado IA", "Negras"),
            ]
            
            for label, val in info_items:
                self.screen.blit(label_font.render(label, True, (150, 150, 160)), (SIDEBAR_X + 20, y_off))
                self.screen.blit(value_font.render(val, True, (255, 255, 255)), (SIDEBAR_X + 20, y_off + 22))
                y_off += 60
            
            # Evaluation Bar (AI Perspective)
            # Since AI moves for Black, Eval 1.0 (White wins) is poor for AI.
            # We'll show a simple "Confidence" or "Eval" bar if AI is working.
            if hasattr(self.ai, 'last_eval'):
                eval_val = self.ai.last_eval # -1 to 1
                bar_y = 380
                bar_h = 100
                bar_w = 20
                
                self.screen.blit(label_font.render("EVALUACIÓN", True, (150, 150, 160)), (SIDEBAR_X + 20, bar_y - 25))
                pygame.draw.rect(self.screen, (40, 40, 50), (SIDEBAR_X + 90, bar_y, bar_w, bar_h), border_radius=4)
                
                # Normalize -1 (black win) to 1 (white win)
                # Map to [0, 100] pixels
                fill_h = int((eval_val + 1) / 2 * bar_h)
                fill_rect = pygame.Rect(SIDEBAR_X + 90, bar_y + (bar_h - fill_h), bar_w, fill_h)
                pygame.draw.rect(self.screen, (255, 255, 255), fill_rect, border_radius=4) # White side
                
                val_text = f"{eval_val:+.2f}"
                self.screen.blit(value_font.render(val_text, True, (255, 255, 255)), (SIDEBAR_X + 120, bar_y + bar_h//2 - 10))

            if is_over:
                res = self.board.chess_board.result()
                res_box = pygame.Rect(SIDEBAR_X + 15, 520, 170, 50)
                pygame.draw.rect(self.screen, (200, 150, 0), res_box, border_radius=8)
                res_txt = title_font.render(res, True, (0, 0, 0))
                res_rect = res_txt.get_rect(center=res_box.center)
                self.screen.blit(res_txt, res_rect)

            pygame.display.flip()
            
        pygame.quit()

if __name__ == "__main__":
    ChessGUI().run()

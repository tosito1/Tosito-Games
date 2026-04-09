import chess

class Piece:
    def __init__(self, color, name):
        self.color = color
        self.name = name
class Pawn(Piece):
    def __init__(self, color): super().__init__(color, 'Pawn')
class Knight(Piece):
    def __init__(self, color): super().__init__(color, 'Knight')
class Bishop(Piece):
    def __init__(self, color): super().__init__(color, 'Bishop')
class Rook(Piece):
    def __init__(self, color): super().__init__(color, 'Rook')
class Queen(Piece):
    def __init__(self, color): super().__init__(color, 'Queen')
class King(Piece):
    def __init__(self, color): super().__init__(color, 'King')

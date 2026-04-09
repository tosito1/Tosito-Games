try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import numpy as np
except ImportError:
    torch = None
    nn = None
    F = None
    np = None

if nn is not None:
    nn_Module = nn.Module
else:
    class nn_Module:
        pass
import chess

class SEBlock(nn_Module):
    """Squeeze-and-Excitation Block for channel-wise attention."""
    def __init__(self, channels, reduction=16):
        super(SEBlock, self).__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
            nn.Sigmoid()
        )

    def forward(self, x):
        b, c, _, _ = x.size()
        y = self.avg_pool(x).view(b, c)
        y = self.fc(y).view(b, c, 1, 1)
        return x * y.expand_as(x)

class AttentionBlock(nn_Module):
    """Multi-Head Self-Attention for the 8x8 Chess Grid."""
    def __init__(self, channels, heads=8):
        super(AttentionBlock, self).__init__()
        self.heads = heads
        self.scale = (channels // heads) ** -0.5
        
        self.qkv = nn.Conv2d(channels, channels * 3, kernel_size=1, bias=False)
        self.proj = nn.Conv2d(channels, channels, kernel_size=1)
        self.norm = nn.LayerNorm(channels)
        
    def forward(self, x):
        b, c, h, w = x.shape
        # [B, C, H, W] -> [B, H*W, C]
        res = x
        x_flat = x.permute(0, 2, 3, 1).view(b, h*w, c)
        x_norm = self.norm(x_flat)
        
        # QKV
        # [B, H*W, C] -> [B, C, H, W] -> [B, 3*C, H, W]
        x_img = x_norm.view(b, h, w, c).permute(0, 3, 1, 2)
        qkv = self.qkv(x_img).view(b, 3, self.heads, c // self.heads, h*w).permute(1, 0, 2, 4, 3)
        q, k, v = qkv[0], qkv[1], qkv[2]
        
        # Attention
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        
        # Context
        x = (attn @ v).transpose(1, 2).reshape(b, h*w, c)
        x = x.view(b, h, w, c).permute(0, 3, 1, 2)
        x = self.proj(x)
        
        return x + res

class PreActResBlock(nn_Module):
    def __init__(self, num_filters):
        super(PreActResBlock, self).__init__()
        self.bn1 = nn.BatchNorm2d(num_filters)
        self.conv1 = nn.Conv2d(num_filters, num_filters, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(num_filters)
        self.conv2 = nn.Conv2d(num_filters, num_filters, kernel_size=3, padding=1, bias=False)
        self.se = SEBlock(num_filters)
        self.activation = nn.GELU()

    def forward(self, x):
        residual = x
        out = self.activation(self.bn1(x))
        out = self.conv1(out)
        out = self.activation(self.bn2(out))
        out = self.conv2(out)
        out = self.se(out)
        return out + residual

class ResBlock(nn_Module):
    def __init__(self, num_filters):
        if nn is None: return
        super(ResBlock, self).__init__()
        self.conv1 = nn.Conv2d(num_filters, num_filters, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(num_filters)
        self.conv2 = nn.Conv2d(num_filters, num_filters, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(num_filters)
        self.se = SEBlock(num_filters) # Elite: Attention layer

    def forward(self, x):
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.se(out) # Apply SE Attention
        out += residual
        out = F.relu(out)
        return out

class ChessNet(nn_Module):
    def __init__(self, num_res_blocks=40, num_filters=256, num_attention_blocks=4, num_heads=8, use_preact=False):
        if nn is None: return
        super(ChessNet, self).__init__()
        self.use_preact = use_preact
        self.activation = nn.GELU() if use_preact else nn.ReLU()
        
        # Elite Input: 20 Channels (Pieces + Turn + Castling + EP + MoveCount)
        self.start_conv = nn.Conv2d(20, num_filters, kernel_size=3, padding=1, bias=False)
        self.start_bn = nn.BatchNorm2d(num_filters)
        
        if use_preact:
            self.res_blocks = nn.ModuleList([PreActResBlock(num_filters) for _ in range(num_res_blocks)])
            self.final_bn = nn.BatchNorm2d(num_filters)
        else:
            self.res_blocks = nn.ModuleList([ResBlock(num_filters) for _ in range(num_res_blocks)])
            self.final_bn = None
            
        # Elite V2: Global Attention Blocks
        self.attention_blocks = nn.ModuleList([AttentionBlock(num_filters, heads=num_heads) for _ in range(num_attention_blocks)])
        
        # --- POLICY HEAD (Deeper for V2) ---
        if use_preact:
            self.p_conv = nn.Sequential(
                nn.Conv2d(num_filters, 64, kernel_size=1, bias=False),
                nn.BatchNorm2d(64),
                nn.GELU(),
                nn.Conv2d(64, 32, kernel_size=1, bias=False),
                nn.BatchNorm2d(32),
                nn.GELU()
            )
        else:
            self.p_conv = nn.Sequential(
                nn.Conv2d(num_filters, 32, kernel_size=1),
                nn.BatchNorm2d(32),
                nn.ReLU()
            )
        self.p_fc = nn.Linear(32 * 8 * 8, 4096)
        
        # --- VALUE HEAD (Deeper for V2) ---
        if use_preact:
            self.v_conv = nn.Sequential(
                nn.Conv2d(num_filters, 32, kernel_size=1, bias=False),
                nn.BatchNorm2d(32),
                nn.GELU()
            )
            self.v_fc = nn.Sequential(
                nn.Linear(32 * 8 * 8, 512),
                nn.GELU(),
                nn.Linear(512, 256),
                nn.GELU(),
                nn.Linear(256, 1)
            )
        else:
            self.v_conv = nn.Sequential(
                nn.Conv2d(num_filters, 32, kernel_size=1),
                nn.BatchNorm2d(32),
                nn.ReLU()
            )
            self.v_fc = nn.Sequential(
                nn.Linear(32 * 8 * 8, 256),
                nn.ReLU(),
                nn.Linear(256, 1)
            )

    def forward(self, x):
        x = self.start_conv(x)
        if not self.use_preact:
            x = F.relu(self.start_bn(x))
        else:
            x = self.start_bn(x)
            
        for block in self.res_blocks:
            x = block(x)
        
        if self.use_preact:
            x = self.activation(self.final_bn(x))
            
        # Elite V2: Apply Attention
        for attn in self.attention_blocks:
            x = attn(x)
            
        # Policy
        p = self.p_conv(x)
        p = p.reshape(-1, 32 * 8 * 8)
        p = self.p_fc(p)
        
        # Value
        v = self.v_conv(x)
        v = v.reshape(-1, 32 * 8 * 8)
        v = self.v_fc(v)
        v = torch.tanh(v)
        
        return p, v

def board_to_tensor(board):
    if torch is None or np is None: return None
    # 20 Channels (Perspective-Invariant):
    # 0-5: ACTIVE player pieces (P, N, B, R, Q, K)
    # 6-11: OPPONENT pieces
    # 12: Turn (Always 1.0 in this perspective, but kept for arch consistency)
    # 13: Castling ACTIVE-K
    # 14: Castling ACTIVE-Q
    # 15: Castling OPPONENT-K
    # 16: Castling OPPONENT-Q
    # 17: En Passant available (binary)
    # 18: Halfmove clock (normalized)
    # 19: Fullmove number (normalized)
    
    t = np.zeros((20, 8, 8), dtype=np.float32)
    b = board.chess_board if hasattr(board, 'chess_board') else board
    
    is_white_turn = (b.turn == chess.WHITE)
    
    # Piece Planes (Perspective-Aware)
    for sq in chess.SQUARES:
        piece = b.piece_at(sq)
        if piece:
            # Perspective Flip: If Black, flip rank
            r = sq // 8
            c = sq % 8
            if not is_white_turn: r = 7 - r # Flip vertically
            
            grid_r = 7 - r # To standard grid (0 is top)
            
            # Channel Swap: 0-5 for Active, 6-11 for Opponent
            ch = piece.piece_type - 1
            if piece.color != b.turn: ch += 6
            t[ch, grid_r, c] = 1.0
            
    # Metadata (Perspective-Aware)
    t[12, :, :] = 1.0 # Active turn is always "current"
    
    # Castling (Perspective-Aware)
    # Channels 13-14: Active side, 15-16: Opponent side
    if b.has_kingside_castling_rights(b.turn): t[13, :, :] = 1.0
    if b.has_queenside_castling_rights(b.turn): t[14, :, :] = 1.0
    
    opp_color = not b.turn
    if b.has_kingside_castling_rights(opp_color): t[15, :, :] = 1.0
    if b.has_queenside_castling_rights(opp_color): t[16, :, :] = 1.0
    
    # En Passant (Perspective-Aware)
    if b.ep_square is not None:
        r_ep, c_ep = b.ep_square // 8, b.ep_square % 8
        if not is_white_turn: r_ep = 7 - r_ep
        t[17, 7 - r_ep, c_ep] = 1.0
        
    t[18, :, :] = b.halfmove_clock / 100.0
    t[19, :, :] = b.fullmove_number / 200.0 if b.fullmove_number < 200 else 1.0
    
    return torch.from_numpy(t).unsqueeze(0)

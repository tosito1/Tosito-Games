import os

path = 'public/palabritas_go.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# --- 1. ESTADO Y EFECTOS ---
# Buscamos el final de la lista de estados para insertar los nuevos
if "const [dragInfo" not in content:
    insertion_marker = "const [showShop, setShowShop] = useState(false);"
    new_states = """
    const [dragInfo, setDragInfo] = useState(null);
    const [gameInvite, setGameInvite] = useState(null);
"""
    content = content.replace(insertion_marker, insertion_marker + new_states)

# --- 2. LÓGICA DE INVITACIONES ---
if "const handleAcceptInvite" not in content:
    insertion_marker = "const handleAbandonRoom = async () => {"
    invite_logic = """
    const handleAcceptInvite = () => {
        if (!gameInvite) return;
        setGameInvite(null);
        window.location.href = `?room=${gameInvite.roomCode}`;
    };

    const handleRejectInvite = () => {
        if (!gameInvite) return;
        setDoc(doc(db, "users", user.uid), { gameRequest: null }, { merge: true });
        setGameInvite(null);
    };

"""
    content = content.replace(insertion_marker, invite_logic + insertion_marker)

# --- 3. LÓGICA DE DRAG & DROP ---
if "const handleRackPointerDown" not in content:
    insertion_marker = "const handleRackClick = (idx) => {"
    drag_logic = """
    const handleRackPointerDown = (e, idx) => {
        if (!isMyTurn || !localRack[idx]) return;
        const tile = localRack[idx];
        setDragInfo({ x: e.clientX, y: e.clientY, tile, rackIdx: idx });
    };

    const handleGlobalPointerMove = (e) => {
        if (!dragInfo) return;
        setDragInfo(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
    };

    const handleGlobalPointerUp = (e) => {
        if (!dragInfo) return;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const cell = target ? target.closest('.board-cell-target') : null;
        
        if (cell) {
            const classes = Array.from(cell.classList);
            const cellClass = classes.find(c => c.startsWith('cell-'));
            if (cellClass) {
                const [r, c] = cellClass.replace('cell-', '').split('-').map(Number);
                if (displayBoard[r][c].tile) {
                    // Si ya hay ficha, no hacemos nada o devolvemos al rack
                } else {
                    executePlacement(r, c, dragInfo.rackIdx, dragInfo.tile);
                }
            }
        }
        setDragInfo(null);
    };

"""
    content = content.replace(insertion_marker, drag_logic + insertion_marker)

# --- 4. EVENT LISTENERS PARA EL DRAG ---
if "window.addEventListener('pointermove', handleGlobalPointerMove)" not in content:
    insertion_marker = "return () => wrapper.removeEventListener('wheel', handleWheel);"
    drag_effect = """
    useEffect(() => {
        window.addEventListener('pointermove', handleGlobalPointerMove);
        window.addEventListener('pointerup', handleGlobalPointerUp);
        return () => {
            window.removeEventListener('pointermove', handleGlobalPointerMove);
            window.removeEventListener('pointerup', handleGlobalPointerUp);
        };
    }, [dragInfo, localRack, isMyTurn]);

"""
    content = content.replace(insertion_marker, insertion_marker + "\n" + drag_effect)

# --- 5. JSX: SCOREBOARD / HUD (Lineas 2051 a 2124 en el archivo estable tras el restore) ---
# Lo haremos por reemplazo de texto para mayor seguridad
old_hud_block = """                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1.5 sm:gap-2">
                                            <div className="flex gap-2 pointer-events-auto">
                                                <button onClick={() => setShowProfile(true)} className="top-hud-element flex items-center gap-1.5 bg-white/10 backdrop-blur-md shadow-lg rounded-full pr-3 pl-1 py-1 border border-white/20 hover:bg-white/20 transition-all cursor-pointer group">
                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                                                        <Icon name="User" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                                                    </div>
                                                    <div className="flex flex-col items-start pr-2">
                                                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none">SALA: {roomCode}</span>
                                                        <span className="font-black text-white text-[10px] sm:text-xs">Jugadores</span>
                                                    </div>
                                                </button>
                                                 {/* BOTÓN TIENDA */}
                                                <button onClick={() => setShowShop(true)} className="top-hud-element w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] rounded-full flex items-center justify-center border border-amber-200 hover:scale-110 transition-transform">
                                                    <Icon name="Palette" className="w-4 h-4 sm:w-5 sm:h-5 text-orange-950" />
                                                </button>
                                                {/* BOTÓN SALIR */}
                                                <button onClick={() => setShowExitModal(true)} className="top-hud-element w-9 h-9 sm:w-10 sm:h-10 bg-rose-500/20 hover:bg-rose-600 shadow-lg rounded-full flex items-center justify-center border border-rose-500/50 transition-all pointer-events-auto group">
                                                    <Icon name="LogOut" className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 group-hover:text-white" />
                                                </button>
                                            </div>

                                            <div className="flex gap-2">
                                                <div className="top-hud-element pointer-events-auto flex items-center gap-1.5 bg-white/10 backdrop-blur-md shadow-sm rounded-full px-3 py-1 border border-white/20 w-max text-white">
                                                    <span className="font-black text-[10px] sm:text-xs">Bolsa: <AnimatedNumber value={roomState.bag.length} /></span>
                                                </div>
                                                {!dictLoaded && (
                                                    <div className="top-hud-element pointer-events-auto flex items-center gap-1.5 bg-rose-500/80 backdrop-blur-md shadow-sm rounded-full px-3 py-1 border border-rose-400 w-max text-white animate-pulse">
                                                        <Icon name="BrainCircuit" className="w-3 h-3 animate-spin" />
                                                        <span className="font-black text-[9px] uppercase tracking-widest">Cargando RAE...</span>
                                                    </div>
                                                )}
                                                <div className="relative pointer-events-auto">
                                                    <button onClick={() => setShowEmotes(!showEmotes)} className="top-hud-element w-7 h-7 sm:w-8 sm:h-8 bg-white/10 backdrop-blur-md shadow-sm rounded-full flex items-center justify-center border border-white/20 hover:bg-white/20 transition-colors">
                                                        <Icon name="Smile" className="w-4 h-4 text-amber-400" />
                                                    </button>
                                                    {showEmotes && (
                                                        <div className="absolute top-10 left-0 bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-xl rounded-2xl p-2 grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 w-max">
                                                            {EMOTES.map(e => (
                                                                <button key={e} onClick={() => sendEmote(e)} className="w-8 h-8 flex items-center justify-center text-xl hover:scale-125 transition-transform hover:bg-slate-800 rounded-lg">{e}</button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 items-end">
                                            {roomState.playerIds.map(uid => {
                                                const p = roomState.players[uid];
                                                if (!p) return null;
                                                const isMe = uid === user.uid;
                                                const isCurrentTurn = uid === roomState.playerIds[roomState.turnIndex];
                                                
                                                return (
                                                    <div key={uid} className={`top-hud-element pointer-events-auto shadow-lg rounded-2xl px-3 py-1 sm:px-4 sm:py-1.5 flex items-center gap-2 sm:gap-3 border transition-all duration-300 ${isMe ? 'bg-emerald-500/20 border-emerald-500/50 scale-105' : 'bg-slate-900/40 backdrop-blur-md border-white/10 opacity-90'}`}>
                                                        <div className="flex flex-col items-end min-w-[50px]">
                                                            <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest leading-none mb-0.5 ${isMe ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                                {isMe ? 'Tú' : p.name.substring(0, 8)}
                                                            </span>
                                                            <div className="text-lg sm:text-2xl font-black text-white leading-none flex items-center gap-1">
                                                                <AnimatedNumber value={p.score} />
                                                                {isMe && preview.valid && pendingPlacements.length > 0 && (
                                                                    <span className="text-[10px] sm:text-xs text-emerald-400 animate-pulse">+{preview.score}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-[10px] sm:text-xs border transition-all ${isCurrentTurn ? 'bg-amber-400 border-amber-300 text-amber-950 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                                            {p.name.substring(0, 2)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>"""

new_hud_block = """                                    <div className="flex justify-between items-center w-full">
                                        {/* LADO IZQUIERDO: PERFIL Y SALA */}
                                        <div className="flex items-center gap-2 pointer-events-auto">
                                            <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-white/10 p-1.5 pr-3 rounded-full shadow-lg hover:bg-slate-800 transition-all">
                                                <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center"><Icon name="User" size={14} className="text-white" /></div>
                                                <div className="hidden sm:flex flex-col items-start"><span className="text-[8px] font-black text-indigo-400 uppercase leading-none">SALA</span><span className="text-[10px] font-black text-white uppercase">{roomCode}</span></div>
                                            </button>
                                            <button onClick={() => setShowShop(true)} className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border border-amber-300 hover:scale-110 transition-transform"><Icon name="Palette" size={20} className="text-amber-950" /></button>
                                        </div>

                                        {/* CENTRO: MARCADOR REALTIME */}
                                        <div className="flex-1 flex justify-center px-2">
                                            <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-1.5 shadow-2xl flex items-center gap-4 sm:gap-6 pointer-events-auto">
                                                {roomState.playerIds.map((pid, idx) => {
                                                    const p = roomState.players[pid] || { name: '...', score: 0 };
                                                    const isTurn = roomState.playerIds[roomState.turnIndex % roomState.playerIds.length] === pid;
                                                    return (
                                                        <React.Fragment key={pid}>
                                                            <div className={`flex flex-col items-center min-w-[50px] ${isTurn ? 'scale-110' : 'opacity-60'}`}>
                                                                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${isTurn ? 'text-emerald-400' : 'text-slate-400'}`}>{p.name.split(' ')[0]}</span>
                                                                <span className={`text-lg sm:text-xl font-black ${isTurn ? 'text-white' : 'text-slate-500'}`}>{p.score}</span>
                                                            </div>
                                                            {idx === 0 && roomState.playerIds.length > 1 && <div className="w-[1px] h-8 bg-white/10"></div>}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {roomState.playerIds.length === 1 && <div className="flex items-center gap-2 animate-pulse"><div className="w-[1px] h-8 bg-white/10"></div><span className="text-[8px] font-black text-slate-500 uppercase">Esperando...</span></div>}
                                            </div>
                                        </div>

                                        {/* LADO DERECHO: DIAMANTES Y SALIR */}
                                        <div className="flex items-center gap-2 pointer-events-auto">
                                            <div className="flex flex-col items-end">
                                                <div className="bg-slate-900/80 backdrop-blur-md border border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg mb-1">
                                                    <Icon name="Diamond" size={12} className="text-amber-400 fill-amber-400/20" /><span className="text-xs font-black text-white">{diamonds}</span>
                                                </div>
                                                <button onClick={() => setShowExitModal(true)} className="w-8 h-8 sm:w-10 sm:h-10 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-full flex items-center justify-center border border-rose-500/30 transition-all"><Icon name="LogOut" size={16} /></button>
                                            </div>
                                        </div>
                                    </div>"""

if old_hud_block in content:
    content = content.replace(old_hud_block, new_hud_block)

# --- 6. JSX: RACK TILES (Add PointerDown) ---
if "onPointerDown={(e) => handleRackPointerDown(e, idx)}" not in content:
    old_rack_tile = """                                            <div
                                                key={idx}
                                                onClick={() => handleRackClick(idx)}"""
    new_rack_tile = """                                            <div
                                                key={idx}
                                                onPointerDown={(e) => handleRackPointerDown(e, idx)}
                                                onClick={() => handleRackClick(idx)}"""
    content = content.replace(old_rack_tile, new_rack_tile)

# --- 7. JSX: BOARD CELLS (Add board-cell-target class) ---
if "board-cell-target" not in content:
    old_board_cell = 'className={`cell-${r}-${c} relative flex items-center justify-center'
    new_board_cell = 'className={`cell-${r}-${c} board-cell-target relative flex items-center justify-center'
    content = content.replace(old_board_cell, new_board_cell)

# --- 8. JSX: MODALS & PREVIEWS (Structural safe injection) ---
# MODAL INVITACIÓN
if "{/* MODAL INVITACIN DE JUEGO */}" not in content:
    insertion_point = content.rfind("                </div>\n            )}\n\n            {/* --- MODALES GLOBALES")
    if insertion_point != -1:
        modal_code = """
                            {/* MODAL INVITACIÓN DE JUEGO */}
                            {gameInvite && (
                                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 pointer-events-auto">
                                    <div className="bg-slate-900 w-full sm:max-w-xs rounded-[40px] shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col items-center p-8 animate-in zoom-in-95 duration-500 overflow-hidden relative text-center">
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-600 to-emerald-500 animate-pulse"></div>
                                        <div className="w-20 h-20 bg-indigo-600/20 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/50 shadow-inner group">
                                            <Icon name="Gamepad2" size={40} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                                        </div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">¡NUEVO DESAFÍO!</h3>
                                        <p className="text-slate-400 font-bold text-sm mb-8 leading-tight"><span className="text-white">{gameInvite.senderName}</span> te ha invitado a una partida.</p>
                                        <div className="w-full flex flex-col gap-3">
                                            <button onClick={handleAcceptInvite} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl shadow-[0_10px_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2"><Icon name="Check" size={18} /> Aceptar</button>
                                            <button onClick={handleRejectInvite} className="w-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs">Rechazar</button>
                                        </div>
                                    </div>
                                </div>
                            )}
"""
        content = content[:insertion_point] + modal_code + content[insertion_point:]

# PREVIEW DRAG
if "{/* PREVIEW DE ARRASTRE" not in content:
    final_div_point = content.rfind("        </div>\n    );\n}")
    if final_div_point != -1:
        drag_preview = """
            {/* PREVIEW DE ARRASTRE (TILE FLOTANTE) */}
            {dragInfo && (
                <div 
                    className={`fixed z-[1000] pointer-events-none ${currentTheme.tileBg} ${currentTheme.tileBorder} ${currentTheme.tileShadow} border-b-[3px] rounded-md flex items-center justify-center w-[13vw] sm:w-[8vw] max-w-[55px] aspect-[1/1.1] shadow-2xl`}
                    style={{ left: dragInfo.x, top: dragInfo.y, transform: 'translate(-50%, -80%) rotate(-5deg)', transition: 'none' }}
                >
                    <span className={`font-black ${dragInfo.tile.isBlank ? 'text-rose-500' : currentTheme.tileText} text-[clamp(14px,4.5vmin,36px)] leading-none`}>{dragInfo.tile.isBlank ? '?' : dragInfo.tile.letter}</span>
                    <span className={`absolute bottom-[1px] right-[2px] text-[clamp(6px,1.5vmin,12px)] font-bold opacity-60 ${currentTheme.tileText}`}>{dragInfo.tile.isBlank ? 0 : dragInfo.tile.value}</span>
                </div>
            )}
"""
        content = content[:final_div_point] + drag_preview + content[final_div_point:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Master Fix applied successfully")

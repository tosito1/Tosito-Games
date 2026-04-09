import json
import os
import glob
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.gridspec import GridSpec

SAVE_PLOT_PATH = 'training_plot.png'

def smooth(scalars, weight=0.9):
    """Exponential moving average for smoothing."""
    if len(scalars) == 0: return []
    last = scalars[0]
    smoothed = []
    for point in scalars:
        smoothed_val = last * weight + (1 - weight) * point
        smoothed.append(smoothed_val)
        last = smoothed_val
    return smoothed

def format_steps(x, pos):
    if x >= 1e6:
        return f'{x/1e6:.1f}M'
    if x >= 1e3:
        return f'{x/1e3:.0f}K'
    return str(int(x))

def get_category_name(filename):
    # metrics_Partidas_pgnmentor_jugadores.json -> jugadores
    name = filename.replace('metrics_', '').replace('.json', '')
    parts = name.split('_')
    # Filter out path parts like 'Partidas' or 'pgnmentor'
    clean_parts = [p for p in parts if p.lower() not in ['partidas', 'pgnmentor']]
    return " ".join(clean_parts).upper() if clean_parts else "GLOBAL"

def plot_metrics():
    # Find all metrics files
    metrics_files = glob.glob('metrics_*.json')
    if not metrics_files:
        if os.path.exists('metrics.json'):
            metrics_files = ['metrics.json']
        else:
            print("[!] No se encontraron archivos de métricas.")
            return

    # Estética Moderna / Profesional
    plt.style.use('dark_background')
    fig = plt.figure(figsize=(16, 10), dpi=110)
    fig.patch.set_facecolor('#0E1117') # Color estilo Streamlit/Github Dark
    
    gs = GridSpec(2, 2, width_ratios=[4, 1.2], height_ratios=[1, 1], hspace=0.35, wspace=0.15)
    
    ax_acc = fig.add_subplot(gs[0, 0])
    ax_loss = fig.add_subplot(gs[1, 0])
    
    # Palette Vibrant / Neon
    colors = ['#00E5FF', '#FF2E63', '#08D9D6', '#EAEAEA', '#FFD700', '#BF77FF']
    
    print(f"[*] Renderizando Dashboard con {len(metrics_files)} archivos de métricas...")

    best_acc = 0
    best_cat = "N/A"
    total_moves = 0
    
    all_all_steps = []

    MIN_STEP = 8000000

    for i, m_file in enumerate(sorted(metrics_files)):
        try:
            with open(m_file, 'r') as f:
                history = json.load(f)
        except: continue
        
        if len(history) < 2: continue
        
        cat_name = get_category_name(m_file)
        color = colors[i % len(colors)]
        
        # Filter history to start from 8M moves
        filtered_history = [d for d in history if d['step'] >= MIN_STEP]
        if not filtered_history: continue

        steps = np.array([d['step'] for d in filtered_history])
        losses = np.array([d['loss'] for d in filtered_history])
        accuracies = np.array([d['acc'] for d in filtered_history])
        
        all_all_steps.extend(steps)
        total_moves = max(total_moves, steps[-1])
        
        # Smoothed lines
        s_losses = smooth(losses, weight=0.8)
        s_accuracies = smooth(accuracies, weight=0.8)
        
        # Plot Accuracy (Main focus)
        ax_acc.plot(steps, accuracies, color=color, alpha=0.15, linewidth=1) # Raw noise
        ax_acc.plot(steps, s_accuracies, color=color, linewidth=2.5, label=cat_name)
        
        # Plot Loss
        ax_loss.plot(steps, losses, color=color, alpha=0.15, linewidth=1) # Raw noise
        ax_loss.plot(steps, s_losses, color=color, linewidth=2, alpha=0.8)
        
        curr_acc = accuracies[-1]
        if curr_acc > best_acc:
            best_acc = curr_acc
            best_cat = cat_name

    # Check if we need log scale (if step difference is massive)
    if len(all_all_steps) > 0:
        min_step = min(all_all_steps)
        max_step = max(all_all_steps)
        if max_step > 100000 and min_step < 5000:
            print("[INFO] Detectada disparidad masiva de pasos. Usando escala logarítmica para visibilidad.")
            ax_acc.set_xscale('log')
            ax_loss.set_xscale('log')

    # Formatting Axes
    from matplotlib.ticker import FuncFormatter
    formatter = FuncFormatter(format_steps)
    
    for ax in [ax_acc, ax_loss]:
        ax.set_facecolor('#161B22')
        ax.xaxis.set_major_formatter(formatter)
        ax.grid(True, which='both', color='#30363D', linestyle='-', alpha=0.4)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#30363D')
        ax.spines['bottom'].set_color('#30363D')

    ax_acc.set_title('ACCURACY % OVER TIME', loc='left', fontsize=12, fontweight='bold', color='white', pad=15)
    ax_acc.set_ylim(0, 100)
    ax_acc.legend(loc='lower right', frameon=True, facecolor='#0D1117', edgecolor='#30363D', fontsize=8)
    
    ax_loss.set_title('LOSS (MINIMIZE)', loc='left', fontsize=12, fontweight='bold', color='#888888', pad=15)
    ax_loss.set_xlabel('TOTAL MOVES / STEPS', fontsize=10, color='#888888', labelpad=10)

    # Info Panels (Right)
    ax_hero = fig.add_subplot(gs[:, 1])
    ax_hero.set_axis_off()
    ax_hero.set_facecolor('#0D1117')
    
    # Hero Title
    ax_hero.text(0.5, 0.95, "ELITE-GEN", color='white', fontsize=24, fontweight='black', ha='center')
    ax_hero.text(0.5, 0.90, "AI TRAINER PRO", color='#00E5FF', fontsize=12, fontweight='bold', ha='center', alpha=0.7)
    
    # Best Metric
    ax_hero.text(0.5, 0.70, f"{best_acc:.1f}%", color='#00E5FF', fontsize=40, fontweight='black', ha='center')
    ax_hero.text(0.5, 0.63, "HIGHEST ACCURACY", color='#888888', fontsize=9, fontweight='bold', ha='center')
    ax_hero.text(0.5, 0.59, best_cat, color='#FF2E63', fontsize=11, fontweight='black', ha='center')

    # Global Stats
    ax_hero.text(0.1, 0.40, "ESTADÍSTICAS GLOBALES", color='white', fontsize=10, fontweight='bold')
    ax_hero.axhline(0.38, 0.1, 0.9, color='#30363D', linewidth=1)
    
    stat_y = 0.33
    l_size = 9
    ax_hero.text(0.1, stat_y, "Categorías:", color='#888888', fontsize=l_size); ax_hero.text(0.9, stat_y, str(len(metrics_files)), color='white', ha='right', fontsize=l_size)
    stat_y -= 0.05
    ax_hero.text(0.1, stat_y, "Movimientos Totales:", color='#888888', fontsize=l_size); ax_hero.text(0.9, stat_y, format_steps(total_moves, 0), color='white', ha='right', fontsize=l_size)
    stat_y -= 0.05
    ax_hero.text(0.1, stat_y, "Status:", color='#888888', fontsize=l_size); ax_hero.text(0.9, stat_y, "ENTRENANDO", color='#08D9D6', ha='right', fontsize=l_size, fontweight='bold')

    # Footer
    fig.text(0.05, 0.02, f"Elite-Gen Chess Core | Workspace: {os.path.basename(os.getcwd())} | Last Update: {np.datetime64('now')}", 
             color='#444444', fontsize=8)

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.savefig(SAVE_PLOT_PATH, dpi=120, facecolor='#0E1117')
    print(f"[✓] Dashboard rediseñado guardado: {os.path.abspath(SAVE_PLOT_PATH)}")
    plt.close(fig)

if __name__ == "__main__":
    plot_metrics()

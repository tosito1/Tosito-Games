import json
import matplotlib.pyplot as plt
import time
import os
import numpy as np

METRICS_PATH = 'metrics_mega.json'
PLOT_PATH = 'mega_training_plot.png'

def smooth(data, weight=0.92):
    if not data: return []
    last = data[0]
    smoothed = []
    for point in data:
        smoothed_val = last * weight + (1 - weight) * point
        smoothed.append(smoothed_val)
        last = smoothed_val
    return smoothed

def plot_metrics():
    if not os.path.exists(METRICS_PATH): return

    try:
        with open(METRICS_PATH, 'r') as f:
            data = json.load(f)
    except: return

    if len(data) < 5: return

    steps = [d['step'] for d in data]
    loss = [d['loss'] for d in data]
    acc = [d['acc'] for d in data]
    lr = [d['lr'] for d in data]
    
    # Smoothing
    s_loss = smooth(loss, 0.95)
    s_acc = smooth(acc, 0.95)

    # Style
    plt.style.use('dark_background')
    fig, (ax1, ax3) = plt.subplots(2, 1, figsize=(13, 9), gridspec_kw={'height_ratios': [3, 1]})
    fig.patch.set_facecolor('#121212')
    ax1.set_facecolor('#1a1a1a')
    ax3.set_facecolor('#1a1a1a')

    # --- TOP PLOT: Accuracy & Loss ---
    # Accuracy (Neon Blue)
    color_acc = '#00d2ff'
    ax1.set_ylabel('PRECISION (%)', color=color_acc, fontweight='bold', fontsize=10)
    ax1.plot(steps, acc, color=color_acc, alpha=0.15, linewidth=1)
    ax1.plot(steps, s_acc, color=color_acc, linewidth=2.5, label='Precisión (Suavizada)')
    ax1.tick_params(axis='y', labelcolor=color_acc)
    ax1.grid(True, alpha=0.1)

    # Loss (Crimson Red) - Twin Axis
    ax2 = ax1.twinx()
    color_loss = '#ff3366'
    ax2.set_ylabel('PERDIDA (Loss)', color=color_loss, fontweight='bold', fontsize=10)
    ax2.plot(steps, loss, color=color_loss, alpha=0.15, linewidth=1)
    ax2.plot(steps, s_loss, color=color_loss, linewidth=2, linestyle='--', label='Pérdida (Suavizada)')
    ax2.tick_params(axis='y', labelcolor=color_loss)

    # --- BOTTOM PLOT: Learning Rate ---
    color_lr = '#ffcc00'
    ax3.set_xlabel('MOVIMIENTOS (Steps)', fontweight='bold', color='#aaaaaa')
    ax3.set_ylabel('LR', color=color_lr, fontweight='bold')
    ax3.fill_between(steps, lr, color=color_lr, alpha=0.2)
    ax3.plot(steps, lr, color=color_lr, linewidth=1.5)
    ax3.tick_params(axis='y', labelcolor=color_lr)
    ax3.grid(True, alpha=0.05)

    # Stats Box
    best_acc = max(acc)
    curr_steps = steps[-1]
    curr_lr = lr[-1]
    
    info_text = (f"STATUS: Entrenando Mega-Gen 2.0\n"
                 f"PASOS TOTALES: {curr_steps:,}\n"
                 f"MEJOR PRECISION: {best_acc:.2f}%\n"
                 f"LR ACTUAL: {curr_lr:.6f}")
    
    plt.figtext(0.15, 0.75, info_text, color='white', fontsize=10, 
                bbox=dict(facecolor='#333333', alpha=0.8, edgecolor='#00d2ff', boxstyle='round,pad=1'))

    plt.suptitle('MEGA-GEN 2.0 PREMIUM TRAINING DASHBOARD', color='#00d2ff', fontsize=16, fontweight='bold', y=0.96)
    
    fig.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.savefig(PLOT_PATH, dpi=120, facecolor=fig.get_facecolor())
    plt.close()
    print(f"[✓] Dashboard Updated: {PLOT_PATH} (Step {curr_steps})")

if __name__ == "__main__":
    print("[*] PREMIUM DASHBOARD Active. Updating every 60s...")
    while True:
        plot_metrics()
        time.sleep(60)

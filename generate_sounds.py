import wave
import math
import struct
import os

def generate_wav(filename, duration_sec, freq_func):
    sample_rate = 44100
    num_samples = int(duration_sec * sample_rate)
    
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        
        for i in range(num_samples):
            t = i / float(sample_rate)
            # freq_func(t) returns the frequency at time t
            freq = freq_func(t)
            # Simple sine wave with amplitude envelope
            envelope = (1.0 - (i / num_samples)) # Linear decay
            value = int(32767.0 * envelope * math.sin(2.0 * math.pi * freq * t))
            f.writeframesraw(struct.pack('<h', value))

# 1. Capture Sound: Short, percussive clack (high frequency to low)
def capture_freq(t):
    return 1000 * math.exp(-10 * t)

# 2. Check Sound: Two rising warning notes
def check_freq(t):
    if t < 0.15: return 440 # A4
    return 659 # E5

# 3. Notify Sound: Pleasant bell-like tone
def notify_freq(t):
    return 880 # A5

output_dir = r"c:\Users\Tosito\Desktop\Tosito\python\Ajedrez\Android\app\src\main\res\raw"
os.makedirs(output_dir, exist_ok=True)

generate_wav(os.path.join(output_dir, "capture.wav"), 0.1, capture_freq)
generate_wav(os.path.join(output_dir, "check.wav"), 0.3, check_freq)
generate_wav(os.path.join(output_dir, "notify.wav"), 0.5, notify_freq)

print("Procedural sounds generated successfully.")

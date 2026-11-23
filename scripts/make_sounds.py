"""안드로이드 알림용 알람 소리(WAV) 만들기 — 앱 안의 소리(index.html SOUNDS)와 같은 패턴"""
import math, struct, wave, os, sys
SR = 22050
OUT = sys.argv[1] if len(sys.argv) > 1 else 'android-res/raw'

def tone(buf, f, dur, at, kind='square', vol=.4, decay=None):
    s0 = int(at * SR)
    for i in range(int(dur * SR)):
        t = i / SR
        ph = 2 * math.pi * f * t
        if kind == 'square':   v = 1 if math.sin(ph) >= 0 else -1; v *= .55
        elif kind == 'triangle': v = 2 / math.pi * math.asin(math.sin(ph))
        else: v = math.sin(ph)
        env = min(1, t / .01) * min(1, (dur - t) / .03)
        if decay: env *= math.exp(-t / decay)
        k = s0 + i
        if k < len(buf): buf[k] += v * vol * env

def bell(buf, f, at):
    for mult, vv in ((1, .45), (2.76, .18), (5.4, .08)):
        tone(buf, f * mult, 1.8, at, 'sine', vv, decay=.55)

PATTERNS = {
    'beep':  (1.5, lambda b, o: [tone(b, 988, .15, o), tone(b, 988, .15, o+.22), tone(b, 988, .15, o+.44), tone(b, 1319, .32, o+.66, 'triangle', .45)]),
    'bell':  (2.0, lambda b, o: [bell(b, 880, o), bell(b, 659, o+.55)]),
    'xylo':  (1.6, lambda b, o: [tone(b, f, .45, o+i*.14, 'sine', .45, decay=.18) for i, f in enumerate((1047, 1319, 1568, 2093))]),
    'soft':  (2.2, lambda b, o: [tone(b, 660, .7, o, 'sine', .4, decay=.35), tone(b, 880, .9, o+.45, 'sine', .4, decay=.45)]),
}
os.makedirs(OUT, exist_ok=True)
for name, (every, fn) in PATTERNS.items():
    total = 8.0
    buf = [0.0] * int((total + 2) * SR)
    o = 0.0
    while o < total:
        fn(buf, o); o += every
    peak = max(abs(x) for x in buf) or 1
    with wave.open(f'{OUT}/snd_{name}.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(x / peak * 0.9 * 32767)) for x in buf))
print('ok')

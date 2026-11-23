"""우리반 도구함 아이콘 — 4칸 도구함(시계 · QR · 말풍선 · 알람종)
사용: python3 scripts/make_icons.py <프로젝트 폴더>   (예: .)"""
import os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]

DEFS = '''
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff8a5b"/><stop offset=".55" stop-color="#ff4f87"/><stop offset="1" stop-color="#b83cf0"/>
  </linearGradient>
  <radialGradient id="glow" cx=".2" cy=".1" r=".7">
    <stop offset="0" stop-color="#ffe29a" stop-opacity=".85"/><stop offset="1" stop-color="#ffe29a" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glow2" cx=".95" cy=".95" r=".6">
    <stop offset="0" stop-color="#5b8cff" stop-opacity=".6"/><stop offset="1" stop-color="#5b8cff" stop-opacity="0"/>
  </radialGradient>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#3b0764" flood-opacity=".28"/>
  </filter>
</defs>'''

T, G = 300, 40            # 칸 크기, 칸 사이 간격
X0 = (1024 - (2*T + G)) / 2

def tile(cx, cy, inner):
    return (f'<g transform="translate({X0 + cx*(T+G):.1f} {X0 + cy*(T+G):.1f})">'
            f'<rect width="{T}" height="{T}" rx="84" fill="#fff" filter="url(#sh)"/>{inner}</g>')

CLOCK = '''
  <circle cx="150" cy="150" r="98" fill="none" stroke="#ff4f87" stroke-width="28"/>
  <line x1="150" y1="150" x2="150" y2="92" stroke="#ff4f87" stroke-width="26" stroke-linecap="round"/>
  <line x1="150" y1="150" x2="192" y2="174" stroke="#ff4f87" stroke-width="26" stroke-linecap="round"/>
  <circle cx="150" cy="150" r="13" fill="#ff4f87"/>'''

def qr():
    u, o = 25.0, 50.0
    def sq(c, r, w=1, h=1, col="#4f46e5"):
        return f'<rect x="{o+c*u:.1f}" y="{o+r*u:.1f}" width="{w*u:.1f}" height="{h*u:.1f}" fill="{col}"/>'
    p = []
    for c, r in [(0, 0), (5, 0), (0, 5)]:
        p += [sq(c, r, 3, 3), sq(c+.6, r+.6, 1.8, 1.8, "#fff"), sq(c+1, r+1, 1, 1)]
    for c, r in [(4, 4), (6, 4), (5, 5), (7, 5), (4, 6), (6, 6), (7, 7), (3.5, 1), (4, 2.4)]:
        p.append(sq(c, r))
    return ''.join(p)

CHAT = '''
  <path d="M70 60 H230 a40 40 0 0 1 40 40 V176 a40 40 0 0 1 -40 40 H150 L96 258 V216 H70 a40 40 0 0 1 -40 -40 V100 a40 40 0 0 1 40 -40 Z" fill="#14b8a6"/>
  <path d="M150 88 C155 124 166 135 202 140 C166 145 155 156 150 192 C145 156 134 145 98 140 C134 135 145 124 150 88 Z" fill="#fff"/>
  <circle cx="226" cy="98" r="9" fill="#fff"/><circle cx="76" cy="186" r="7" fill="#fff"/>'''

BELL = '''
  <path d="M150 52 C104 52 84 94 84 142 V176 L62 208 H238 L216 176 V142 C216 94 196 52 150 52 Z" fill="#f59e0b"/>
  <circle cx="150" cy="38" r="14" fill="#f59e0b"/>
  <path d="M120 226 a30 30 0 0 0 60 0 Z" fill="#f59e0b"/>
  <path d="M118 96 C104 108 100 124 100 142" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="12" stroke-linecap="round"/>'''

def grid():
    return tile(0, 0, CLOCK) + tile(1, 0, qr()) + tile(0, 1, CHAT) + tile(1, 1, BELL)

def bg(shape):
    clip = {'square': '<rect width="1024" height="1024" rx="230"/>',
            'circle': '<circle cx="512" cy="512" r="512"/>'}.get(shape, '<rect width="1024" height="1024"/>')
    return f'''<clipPath id="c">{clip}</clipPath>
  <g clip-path="url(#c)">
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <rect width="1024" height="1024" fill="url(#glow)"/>
    <rect width="1024" height="1024" fill="url(#glow2)"/>
  </g>'''

def at(scale):
    return f'<g transform="translate(512 512) scale({scale}) translate(-512 -512)">{grid()}</g>'

# 알림 아이콘(상태 표시줄, 흰색 단색): 알람시계
STAT = '''<g fill="none" stroke="#fff" stroke-linecap="round">
  <circle cx="512" cy="560" r="300" stroke-width="90"/>
  <line x1="512" y1="560" x2="512" y2="380" stroke-width="80"/>
  <line x1="512" y1="560" x2="630" y2="632" stroke-width="80"/>
  <line x1="230" y1="250" x2="330" y2="170" stroke-width="90"/>
  <line x1="794" y1="250" x2="694" y2="170" stroke-width="90"/>
</g>'''

def svg(kind):
    if kind == 'stat':
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{STAT}</svg>'
    if kind == 'fg':        # 적응형 아이콘 전경 (안전영역 안)
        body = at(.92)
    elif kind == 'bgonly':
        body = bg('full')
    elif kind == 'full':    # 아이폰/웹: 꽉 찬 사각형
        body = bg('full') + at(1.0)
    elif kind == 'circle':
        body = bg('circle') + at(.9)
    else:                   # square
        body = bg('square') + at(1.0)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{DEFS}{body}</svg>'

def render(page, kind, size, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    s = svg(kind).replace('width="1024" height="1024">', f'width="{size}" height="{size}">', 1)
    tmp = '/tmp/_icon.svg'
    open(tmp, 'w').write(s)
    page.set_viewport_size({'width': size, 'height': size})
    page.goto('file://' + tmp)
    page.screenshot(path=path, omit_background=True)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page()
    render(pg, 'square', 1024, f'{OUT}/build/icon.png')               # exe
    render(pg, 'square', 512, f'{OUT}/www/icon-512.png')
    for s in (180, 192, 512):
        render(pg, 'full', s, f'{OUT}/www/web-icons/icon-{s}.png')
    for d, s in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        base = f'{OUT}/android-res/mipmap-{d}'
        render(pg, 'square', int(48*s), f'{base}/ic_launcher.png')
        render(pg, 'circle', int(48*s), f'{base}/ic_launcher_round.png')
        render(pg, 'fg', int(108*s), f'{base}/ic_launcher_foreground.png')
        render(pg, 'bgonly', int(108*s), f'{base}/ic_launcher_background.png')
        render(pg, 'stat', int(24*s), f'{OUT}/android-res/drawable-{d}/ic_stat_timer.png')
    b.close()

import os, sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]

DEFS = '''
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4f46e5"/><stop offset=".55" stop-color="#6d6cf5"/><stop offset="1" stop-color="#22b8f0"/>
  </linearGradient>
  <radialGradient id="glow" cx=".8" cy=".15" r=".6">
    <stop offset="0" stop-color="#f0abfc" stop-opacity=".75"/><stop offset="1" stop-color="#f0abfc" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glow2" cx=".1" cy=".95" r=".55">
    <stop offset="0" stop-color="#67e8f9" stop-opacity=".55"/><stop offset="1" stop-color="#67e8f9" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/>
  </linearGradient>
  <linearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#fb923c"/>
  </linearGradient>
</defs>'''


# 통합 앱 표시: QR 배지(오른쪽 아래) + AI 반짝이(왼쪽 위)
def extras():
    q = []
    bx, by, bs = 640, 650, 250
    q.append(f'<rect x="{bx}" y="{by}" width="{bs}" height="{bs}" rx="46" fill="#fff"/>')
    u = (bs - 40) / 7.0
    def sq(c, r, w=1, h=1, col="#312e81"):
        return f'<rect x="{bx+20+c*u:.1f}" y="{by+20+r*u:.1f}" width="{w*u:.1f}" height="{h*u:.1f}" fill="{col}"/>'
    for (c, r) in [(0, 0), (4, 0), (0, 4)]:
        q.append(sq(c, r, 3, 3)); q.append(sq(c+.55, r+.55, 1.9, 1.9, "#fff")); q.append(sq(c+1, r+1, 1, 1))
    for (c, r) in [(4, 4), (6, 4), (5, 5), (4, 6), (6, 6), (3.2, 3.2)]:
        q.append(sq(c, r))
    star = ('<path d="M230 150 C238 215 255 232 320 240 C255 248 238 265 230 330 C222 265 205 248 140 240 '
            'C205 232 222 215 230 150 Z" fill="#fff"/>')
    return ''.join(q) + star

# 스톱워치 그림 (1024 좌표계, 중심 512,560)
def watch():
    import math
    cx, cy, r = 512, 568, 300
    # 남은 시간 호: 12시에서 시계방향 270도
    a0, a1 = -90, 180
    x0, y0 = cx + 250*math.cos(math.radians(a0)), cy + 250*math.sin(math.radians(a0))
    x1, y1 = cx + 250*math.cos(math.radians(a1)), cy + 250*math.sin(math.radians(a1))
    ticks = ''.join(
        f'<line x1="{cx+222*math.cos(math.radians(a))}" y1="{cy+222*math.sin(math.radians(a))}" '
        f'x2="{cx+196*math.cos(math.radians(a))}" y2="{cy+196*math.sin(math.radians(a))}" '
        f'stroke="#fff" stroke-opacity=".85" stroke-width="16" stroke-linecap="round"/>'
        for a in range(-90, 270, 90))
    return f'''
  <rect x="452" y="170" width="120" height="70" rx="26" fill="#fff" fill-opacity=".92"/>
  <rect x="490" y="228" width="44" height="60" rx="14" fill="#fff" fill-opacity=".92"/>
  <rect x="742" y="262" width="80" height="48" rx="22" fill="#fff" fill-opacity=".8" transform="rotate(45 782 286)"/>
  <circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#glass)" stroke="#fff" stroke-opacity=".75" stroke-width="14"/>
  <circle cx="{cx}" cy="{cy}" r="250" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="34"/>
  <path d="M{x0:.1f} {y0:.1f} A250 250 0 1 1 {x1:.1f} {y1:.1f}" fill="none" stroke="url(#arc)" stroke-width="34" stroke-linecap="round"/>
  {ticks}
  <line x1="{cx}" y1="{cy}" x2="{cx}" y2="{cy-170}" stroke="#fff" stroke-width="30" stroke-linecap="round"/>
  <line x1="{cx}" y1="{cy}" x2="{cx+110}" y2="{cy+64}" stroke="#fff" stroke-width="30" stroke-linecap="round"/>
  <circle cx="{cx}" cy="{cy}" r="34" fill="#fff"/>
  <circle cx="{cx}" cy="{cy}" r="14" fill="#5b5bf0"/>
  {extras()}'''

def bg(shape):
    if shape == 'square':  clip = '<rect width="1024" height="1024" rx="230"/>'
    elif shape == 'circle': clip = '<circle cx="512" cy="512" r="512"/>'
    else: clip = '<rect width="1024" height="1024"/>'
    return f'''<clipPath id="c">{clip}</clipPath>
  <g clip-path="url(#c)">
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <rect width="1024" height="1024" fill="url(#glow)"/>
    <rect width="1024" height="1024" fill="url(#glow2)"/>
  </g>'''

STAT = '''<g fill="none" stroke="#fff" stroke-linecap="round">
  <circle cx="512" cy="580" r="330" stroke-width="90"/>
  <line x1="512" y1="580" x2="512" y2="390" stroke-width="80"/>
  <line x1="512" y1="580" x2="640" y2="655" stroke-width="80"/>
</g>
<rect x="430" y="90" width="164" height="110" rx="40" fill="#fff"/>'''

def svg(kind):
    if kind == 'stat':    # 상태 표시줄 알림 아이콘 (흰색 단색)
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{STAT}</svg>'
    if kind == 'fg':      # 적응형 아이콘 전경: 안전영역(66%) 안에 들어가게 축소
        body = f'<g transform="translate(512 512) scale(.62) translate(-512 -540)">{watch()}</g>'
    elif kind == 'bgonly':
        body = bg('full')
    elif kind == 'full':  # 아이폰/웹 홈 화면용: 꽉 찬 사각형 (모서리는 기기가 깎음)
        body = bg('full') + f'<g transform="translate(512 512) scale(.8) translate(-512 -540)">{watch()}</g>'
    else:
        body = bg(kind) + f'<g transform="translate(512 512) scale(.92) translate(-512 -540)">{watch()}</g>'
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
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_page()
    open(f'{OUT}/icon.svg', 'w').write(svg('square'))
    render(pg, 'square', 1024, f'{OUT}/build/icon.png')          # electron-builder (exe)
    render(pg, 'square', 512, f'{OUT}/icon-512.png')               # 웹/창 아이콘
    for s in (180, 192, 512):
        render(pg, 'full', s, f'{OUT}/web-icons/icon-{s}.png')
    dens = {'mdpi':1, 'hdpi':1.5, 'xhdpi':2, 'xxhdpi':3, 'xxxhdpi':4}
    for d, s in dens.items():
        base = f'{OUT}/android-res/mipmap-{d}'
        render(pg, 'square', int(48*s), f'{base}/ic_launcher.png')
        render(pg, 'circle', int(48*s), f'{base}/ic_launcher_round.png')
        render(pg, 'fg', int(108*s), f'{base}/ic_launcher_foreground.png')
        render(pg, 'bgonly', int(108*s), f'{base}/ic_launcher_background.png')
        render(pg, 'stat', int(24*s), f'{OUT}/android-res/drawable-{d}/ic_stat_timer.png')
    b.close()

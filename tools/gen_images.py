#!/usr/bin/env python3
"""Genera assets/favicon.png (32×32) y assets/screenshots/og-image.png
(1200×630) sin dependencias: escritor PNG RGBA mínimo con zlib."""

import struct, zlib, os

def chunk(tag, data):
    return (struct.pack('>I', len(data)) + tag + data +
            struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

def write_png(path, w, h, pixels):
    raw = b''.join(b'\x00' + b''.join(bytes(p) for p in row) for row in pixels)
    png = (b'\x89PNG\r\n\x1a\n' +
           chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) +
           chunk(b'IDAT', zlib.compress(raw, 9)) +
           chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)
    print(f'{path}: {len(png)} bytes ({w}x{h})')

# ---------- Favicon 32×32: bandera pixel-art estilo ventana ----------
F = [  # (x, y, color)
    (4, 4, (243, 83, 37)), (18, 4, (129, 188, 6)),
    (4, 18, (5, 166, 240)), (18, 18, (255, 186, 8)),
]
px = [[(0, 0, 0, 0)] * 32 for _ in range(32)]
for bx, by, col in F:
    for y in range(by, by + 11):
        for x in range(bx, bx + 11):
            edge = x in (bx, bx + 10) or y in (by, by + 10)
            px[y][x] = (col[0]//2, col[1]//2, col[2]//2, 255) if edge else (*col, 255)
write_png('assets/favicon.png', 32, 32, px)

# ---------- OG image 1200×630: splash estilizado ----------
W, H = 1200, 630
og = [[(0, 0, 16, 255)] * W for _ in range(H)]

def vgrad(y):
    t = y / H
    return (int(0+16*t), int(16+40*t), int(72-40*t), 255)

for y in range(H):
    c = vgrad(y)
    for x in range(W):
        og[y][x] = c

# Titlebar navy arriba (guiño de chrome Win95)
for y in range(0, 46):
    t = y / 46
    for x in range(W):
        og[y][x] = (int(0+16*t*0), int(0+132*t), int(128+80*t*(x/W)), 255)

# Botones de titlebar (min/max/close sugeridos, gris plata)
for i, bx in enumerate((W-150, W-110, W-70)):
    for y in range(12, 34):
        for x in range(bx, bx+28):
            og[y][x] = ((192,192,192,255))

# Bandera grande central (4 paneles de 96px con borde)
FX, FY, P = W//2 - 102, 170, 96
FLAG = [(243,83,37),(129,188,6),(5,166,240),(255,186,8)]
pos = [(0,0),(1,0),(0,1),(1,1)]
for (cx,cy),col in zip(pos,FLAG):
    bx, by = FX + cx*(P+12), FY + cy*(P+12)
    for y in range(by, by+P):
        for x in range(bx, bx+P):
            if 0<=y<H and 0<=x<W:
                edge = x<bx+6 or x>=bx+P-6 or y<by+6 or y>=by+P-6
                og[y][x] = (col[0]//2,col[1]//2,col[2]//2,255) if edge else (*col,255)

# Franja teal inferior (identidad del escritorio)
for y in range(H-70, H):
    for x in range(W):
        og[y][x] = (0, 128, 128, 255)
# "línea" blanca decorativa dentro de la franja
for x in range(60, W-60):
    og[H-35][x] = (223, 223, 223, 255)

write_png('assets/screenshots/og-image.png', W, H, og)

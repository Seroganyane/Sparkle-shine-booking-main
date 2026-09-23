from collections import deque
from pathlib import Path
from PIL import Image

base = Path('public/products')
for src_name in ['shampoo.jpg', 'detailer.jpg', 'tire-shine.avif']:
    src = base / src_name
    if not src.exists():
        continue

    img = Image.open(src).convert('RGBA')
    w, h = img.size
    data = img.load()
    visited = [[False for _ in range(w)] for _ in range(h)]
    q = deque()

    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = data[x, y]
            if a > 0 and r > 245 and g > 245 and b > 245:
                visited[y][x] = True
                q.append((x, y))

    for y in range(h):
        for x in (0, w - 1):
            r, g, b, a = data[x, y]
            if a > 0 and r > 245 and g > 245 and b > 245:
                visited[y][x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r, g, b, a = data[nx, ny]
                if a > 0 and r > 245 and g > 245 and b > 245:
                    visited[ny][nx] = True
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                r, g, b, a = data[x, y]
                data[x, y] = (r, g, b, 0)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    out = base / f'{src.stem}.png'
    img.save(out)
    print(f'processed {src_name} -> {out.name} ({img.size[0]}x{img.size[1]})')

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function inRoundRect(nx, ny, x, y, w, h, r) {
  const cx = Math.min(Math.max(nx, x + r), x + w - r);
  const cy = Math.min(Math.max(ny, y + r), y + h - r);
  const dx = nx - cx;
  const dy = ny - cy;
  return dx * dx + dy * dy <= r * r && nx >= x && nx <= x + w && ny >= y && ny <= y + h;
}

function paint(x, y, size) {
  const nx = (x + 0.5) / size;
  const ny = (y + 0.5) / size;
  if (inRoundRect(nx, ny, 0.34, 0.22, 0.32, 0.56, 0.045)) {
    const dx = nx - 0.58;
    const dy = ny - 0.52;
    if (dx * dx + dy * dy < 0.0014) return [127, 45, 18, 255];
    return [244, 241, 234, 255];
  }
  return [15, 63, 62, 255];
}

function png(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size);
      const index = y * stride + 1 + x * 4;
      raw[index] = r;
      raw[index + 1] = g;
      raw[index + 2] = b;
      raw[index + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192));
writeFileSync('public/icons/icon-512.png', png(512));
console.log('Wrote public/icons/icon-192.png and icon-512.png');

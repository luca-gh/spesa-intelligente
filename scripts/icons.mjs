import sharp from 'sharp'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/icon.svg')
await Promise.all(
  [192, 512, 180].map((size) =>
    sharp(svg)
      .resize(size, size)
      .png()
      .toFile(`public/${size === 180 ? 'apple-touch-icon' : `icon-${size}`}.png`),
  ),
)
const maskable = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#23634d"/><path d="M156 204h200l-24 155H180zM204 204c0-103 104-103 104 0" fill="none" stroke="#fffce9" stroke-width="23" stroke-linecap="round"/><path d="m213 280 30 30 55-60" fill="none" stroke="#cfdf87" stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)
await sharp(maskable).png().toFile('public/icon-maskable.png')

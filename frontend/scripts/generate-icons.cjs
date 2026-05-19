#!/usr/bin/env node
/**
 * generate-icons.cjs
 * Gera icon.png (256x256) para o electron-builder
 * usando apenas módulos Node nativos (Canvas via sharp se disponível, senão cria PNG placeholder)
 */
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

try {
  const sharp = require('sharp');
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="48" fill="#4F46E5"/>
  <text x="128" y="175" font-family="Arial,sans-serif" font-size="140" font-weight="bold"
        fill="white" text-anchor="middle">C</text>
</svg>`;
  sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(path.join(publicDir, 'icon.png'))
    .then(() => console.log('icon.png gerado com sharp'))
    .catch((error) => console.error('sharp error:', error));
} catch {
  const placeholderPath = path.join(publicDir, 'icon.png');
  if (!fs.existsSync(placeholderPath)) {
    fs.writeFileSync(placeholderPath, '');
    console.log('icon.png placeholder criado (instale sharp para gerar icone real)');
  }
}
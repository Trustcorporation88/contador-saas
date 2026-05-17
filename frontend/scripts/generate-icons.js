#!/usr/bin/env node
/**
 * generate-icons.js
 * Gera icon.png (256x256) para o electron-builder
 * usando apenas módulos Node nativos (Canvas via sharp se disponível, senão cria PNG placeholder)
 */
const fs   = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// Tenta usar sharp para gerar PNG a partir de SVG embutido
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
    .then(() => console.log('✅ icon.png gerado com sharp'))
    .catch((e) => console.error('sharp error:', e));
} catch {
  // Fallback: cria um PNG mínimo válido (1x1 roxo) como placeholder
  // PNG signature + IHDR + IDAT + IEND (mínimo válido)
  const PNG_PLACEHOLDER = Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080200000090' +
    'wc3d980000000c4944415478016360f8cfc00000000200016be3a9400000' +
    '0000049454e44ae426082',
    'hex'
  );
  // Escreve placeholder genérico
  const placeholderPath = path.join(publicDir, 'icon.png');
  if (!fs.existsSync(placeholderPath)) {
    // cria arquivo vazio — electron-builder aceita png externo
    fs.writeFileSync(placeholderPath, '');
    console.log('⚠️  icon.png placeholder criado (instale sharp para gerar ícone real)');
  }
}

#!/usr/bin/env bash
# build-electron.sh — Build completo do Contador SaaS para Windows/macOS/Linux
# Uso: bash scripts/build-electron.sh [--win] [--mac] [--linux] [--all]
# Sem flags: detecta plataforma atual

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Contador SaaS — Electron Build Pipeline    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# 1. TypeScript check
echo "▶ [1/4] TypeScript type check..."
npx tsc --noEmit
echo "   ✅ TypeScript OK"

# 2. Vite build (renderer + Electron main)
echo "▶ [2/4] Vite build (renderer + electron main)..."
npm run build
echo "   ✅ Vite build OK → dist/"

# 3. Electron builder
echo "▶ [3/4] electron-builder..."

PLATFORM="${1:-auto}"

if [[ "$PLATFORM" == "--win" ]]; then
  npx electron-builder --win
elif [[ "$PLATFORM" == "--mac" ]]; then
  npx electron-builder --mac
elif [[ "$PLATFORM" == "--linux" ]]; then
  npx electron-builder --linux
elif [[ "$PLATFORM" == "--all" ]]; then
  npx electron-builder --win --linux
else
  # Auto-detect
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || -n "${WINDIR:-}" ]]; then
    npx electron-builder --win
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    npx electron-builder --mac
  else
    npx electron-builder --linux
  fi
fi

echo "   ✅ Packages criados → dist-electron-build/"

# 4. List output
echo "▶ [4/4] Artefatos gerados:"
ls -lh dist-electron-build/ 2>/dev/null | grep -v "^total" | grep -v "^d" || echo "   (vazio)"

echo ""
echo "✅ Build concluído com sucesso!"
echo ""

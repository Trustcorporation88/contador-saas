#!/bin/bash
# 🚀 Script Rápido de Deploy - Contador Backend no Hostinger
# Execute este script VIA SSH no seu servidor Hostinger

set -e  # Para em caso de erro

echo "🚀 Iniciando deploy do Contador Backend no Hostinger..."

# 1. Instalar Node.js 18 (se não tiver)
echo "📦 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "⚙️  Instalando Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
node -v
npm -v

# 2. Instalar PM2
echo "📦 Instalando PM2..."
sudo npm install -g pm2

# 3. Criar diretório e clonar repo
echo "📂 Clonando repositório..."
mkdir -p ~/apps
cd ~/apps
if [ -d "contador-saas" ]; then
    cd contador-saas
    git pull origin master
else
    git clone https://github.com/Trustcorporation88/contador-saas.git
    cd contador-saas
fi

# 4. Instalar dependências
echo "📦 Instalando dependências..."
cd backend
npm ci --production

# 5. Build
echo "🔨 Building TypeScript..."
npm run build

# 6. Criar diretório de logs
mkdir -p logs

# 7. Parar PM2 antigo (se existir)
pm2 delete contador-backend || true

# 8. Iniciar backend com PM2
echo "🚀 Iniciando backend com PM2..."
pm2 start ecosystem.config.js

# 9. Salvar configuração PM2
pm2 save

# 10. Configurar auto-start
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📊 Status do backend:"
pm2 status

echo ""
echo "📝 Ver logs em tempo real:"
echo "   pm2 logs contador-backend"
echo ""
echo "🔄 Reiniciar backend:"
echo "   pm2 restart contador-backend"
echo ""
echo "🧪 Testar backend:"
echo "   curl http://localhost:3000/health"
echo ""

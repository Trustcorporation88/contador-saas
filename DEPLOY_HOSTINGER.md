# 🚀 Deploy Backend no Hostinger

## 📋 Pré-requisitos
- Acesso SSH ao Hostinger
- Node.js 18+ instalado
- PostgreSQL configurado
- Redis configurado (opcional, para cache)

## 1️⃣ Configurar Subdomínio `api.procontador.com.br`

### No Painel Hostinger:
1. Acesse **Domínios** → `procontador.com.br`
2. Clique em **DNS/Name Servers**
3. Adicione registro **A**:
   - **Nome**: `api`
   - **Tipo**: `A`
   - **Aponta para**: [IP do seu servidor Hostinger]
   - **TTL**: `14400` (4 horas)

4. ✅ Aguarde propagação DNS (5-30 min)

---

## 2️⃣ Configurar Backend via SSH

### Conecte via SSH:
```bash
ssh usuario@seu-ip-hostinger.com
```

### Instale Node.js 18 (se não tiver):
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # deve mostrar v18.x
npm -v
```

### Instale PM2 (gerenciador de processos):
```bash
sudo npm install -g pm2
```

### Crie diretório para o backend:
```bash
mkdir -p ~/apps/contador-backend
cd ~/apps/contador-backend
```

---

## 3️⃣ Clonar Repositório no Hostinger

```bash
cd ~/apps/contador-backend
git clone https://github.com/Trustcorporation88/contador-saas.git .
cd backend
npm ci --production
```

---

## 4️⃣ Configurar Variáveis de Ambiente

Crie arquivo `.env` no servidor:
```bash
nano ~/apps/contador-backend/backend/.env
```

**Cole e ajuste:**
```env
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (PostgreSQL no Hostinger ou externo)
DATABASE_URL=postgresql://usuario:senha@localhost:5432/contador_prod

# Redis (cache - opcional)
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true
CACHE_TTL=300

# JWT Secrets (MUDE ESTES!)
JWT_SECRET=SUA_CHAVE_SECRETA_SUPER_FORTE_AQUI_MIN_32_CHARS
REFRESH_TOKEN_SECRET=OUTRA_CHAVE_SECRETA_DIFERENTE_AQUI

# CORS
CORS_ORIGIN=https://procontador.com.br,https://www.procontador.com.br
CORS_CREDENTIALS=true

# Admin Bootstrap (primeiro admin)
ADMIN_BOOTSTRAP_EMAIL=admin@contador.dev
ADMIN_BOOTSTRAP_PASSWORD=Admin123@Dev

# Features
ENABLE_API_DOCS=true
ENABLE_OBSERVABILITY_DASHBOARD=false
```

**Salve**: `Ctrl+X` → `Y` → `Enter`

---

## 5️⃣ Criar Script PM2 Ecosystem

```bash
nano ~/apps/contador-backend/backend/ecosystem.config.js
```

**Cole:**
```javascript
module.exports = {
  apps: [{
    name: 'contador-backend',
    script: './dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

---

## 6️⃣ Build e Iniciar Backend

```bash
cd ~/apps/contador-backend/backend

# Build TypeScript
npm run build

# Criar diretório de logs
mkdir -p logs

# Iniciar com PM2
pm2 start ecosystem.config.js

# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs contador-backend

# Configurar PM2 para auto-start no boot
pm2 startup
pm2 save
```

---

## 7️⃣ Configurar Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/api.procontador.com.br
```

**Cole:**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.procontador.com.br;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.procontador.com.br;

    # SSL certificates (Hostinger auto-provision with Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.procontador.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.procontador.com.br/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js backend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

**Ative configuração:**
```bash
sudo ln -s /etc/nginx/sites-available/api.procontador.com.br /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8️⃣ Configurar SSL com Certbot (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.procontador.com.br
```

**Siga prompts:**
- Email: seu-email@dominio.com
- Termos: Aceitar
- Redirect HTTP→HTTPS: **Sim**

---

## 9️⃣ Testar Backend

```bash
# Local no servidor
curl http://localhost:3000/health

# Externo
curl https://api.procontador.com.br/health
curl https://api.procontador.com.br/api/v1/status
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-26T23:48:00.000Z",
  "uptime": 42.5
}
```

---

## 🔄 Comandos PM2 Úteis

```bash
pm2 list                          # Ver processos
pm2 logs contador-backend         # Ver logs
pm2 restart contador-backend      # Reiniciar
pm2 stop contador-backend         # Parar
pm2 delete contador-backend       # Remover
pm2 monit                         # Monitor em tempo real
```

---

## 🔁 Atualizar Backend (Deploy contínuo)

```bash
cd ~/apps/contador-backend
git pull origin master
cd backend
npm ci --production
npm run build
pm2 restart contador-backend
```

---

## ✅ Checklist Final

- [ ] Subdomínio `api.procontador.com.br` configurado no DNS
- [ ] Node.js 18+ instalado
- [ ] Repositório clonado
- [ ] `.env` configurado com segredos fortes
- [ ] Backend buildado (`npm run build`)
- [ ] PM2 rodando backend
- [ ] Nginx configurado como reverse proxy
- [ ] SSL configurado com Let's Encrypt
- [ ] Backend responde em `https://api.procontador.com.br/health`
- [ ] Frontend atualizado com `VITE_API_URL=https://api.procontador.com.br`

---

## 🆘 Troubleshooting

### Backend não inicia:
```bash
pm2 logs contador-backend --lines 100
```

### Porta 3000 em uso:
```bash
sudo lsof -i :3000
sudo kill -9 PID
```

### Nginx erro:
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### PostgreSQL connection error:
```bash
# Verifique se PostgreSQL está rodando
sudo systemctl status postgresql

# Teste conexão
psql -h localhost -U usuario -d contador_prod
```

---

**Deploy completo! 🎉**

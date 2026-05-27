# ⚡ DEPLOY RÁPIDO - 5 PASSOS

## 🎯 Objetivo
Colocar backend rodando em `https://api.procontador.com.br` no Hostinger

---

## 📋 PASSO 1: Configurar DNS (Hostinger Painel)

1. Acesse **https://hpanel.hostinger.com**
2. Vá em **Domínios** → `procontador.com.br` → **DNS/Name Servers**
3. Adicione registro **A**:
   ```
   Tipo: A
   Nome: api
   Aponta para: [IP do seu VPS Hostinger]
   TTL: 14400
   ```
4. Clique em **Adicionar Registro**
5. Aguarde 5-30 min para propagação

**Como descobrir IP do VPS:**
- No hPanel, vá em **VPS** → seu servidor → veja o **IP Público**

---

## 📋 PASSO 2: Conectar via SSH

```bash
ssh root@SEU_IP_VPS_HOSTINGER
# OU
ssh usuario@SEU_IP_VPS_HOSTINGER
```

**Senha:** A que você configurou no painel Hostinger

---

## 📋 PASSO 3: Executar Script de Deploy

```bash
# Baixar e executar script automático
curl -fsSL https://raw.githubusercontent.com/Trustcorporation88/contador-saas/master/backend/deploy-hostinger.sh | bash
```

**O script vai automaticamente:**
- ✅ Instalar Node.js 18
- ✅ Instalar PM2
- ✅ Clonar repositório
- ✅ Instalar dependências
- ✅ Buildar TypeScript
- ✅ Iniciar backend com PM2

---

## 📋 PASSO 4: Configurar .env

```bash
cd ~/apps/contador-saas/backend
nano .env
```

**Cole e AJUSTE os valores:**
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# PostgreSQL (ajuste usuario, senha, database)
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/contador_prod

# Redis (se tiver instalado)
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true

# MUDE ESTES SECRETS!
JWT_SECRET=CRIE_UMA_SENHA_FORTE_DE_32_CARACTERES_AQUI
REFRESH_TOKEN_SECRET=OUTRA_SENHA_FORTE_DIFERENTE_DE_32_CHARS

CORS_ORIGIN=https://procontador.com.br,https://www.procontador.com.br
CORS_CREDENTIALS=true

ADMIN_BOOTSTRAP_EMAIL=admin@contador.dev
ADMIN_BOOTSTRAP_PASSWORD=Admin123@Dev

ENABLE_API_DOCS=true
```

**Salve:** `Ctrl+X` → `Y` → `Enter`

**Reinicie backend:**
```bash
pm2 restart contador-backend
```

---

## 📋 PASSO 5: Configurar Nginx + SSL

### 5.1 Criar configuração Nginx:
```bash
sudo nano /etc/nginx/sites-available/api.procontador.com.br
```

**Cole:**
```nginx
server {
    listen 80;
    server_name api.procontador.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.procontador.com.br;

    ssl_certificate /etc/letsencrypt/live/api.procontador.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.procontador.com.br/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 Ativar site:
```bash
sudo ln -s /etc/nginx/sites-available/api.procontador.com.br /etc/nginx/sites-enabled/
sudo nginx -t
```

### 5.3 Instalar SSL (Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.procontador.com.br
```

**Siga prompts:**
- Email: seu-email@dominio.com
- Termos: **A** (Aceitar)
- Redirect: **2** (Sim, redirect HTTP→HTTPS)

### 5.4 Reload Nginx:
```bash
sudo systemctl reload nginx
```

---

## ✅ TESTAR

```bash
# No servidor:
curl http://localhost:3000/health

# Do seu computador:
curl https://api.procontador.com.br/health
curl https://api.procontador.com.br/api/v1/status
```

**Esperado:**
```json
{"status":"ok","timestamp":"...","uptime":...}
```

---

## 🔄 DEPLOY FRONTEND (Vercel)

O frontend já foi atualizado! Só fazer push para triggerar novo deploy:

```bash
# No seu PC
cd C:\jpg\frontend
git pull origin master
git push origin master
```

Vercel vai **automaticamente** deployar com novo `VITE_API_URL=https://api.procontador.com.br`

---

## 🎉 PRONTO!

Acesse: **https://procontador.com.br/login**

Login: `admin@contador.dev`  
Senha: `Admin123@Dev`

**Erro 405 sumiu!** 🚀

---

## 🆘 Problemas?

### Backend não responde:
```bash
pm2 logs contador-backend
pm2 restart contador-backend
```

### Nginx erro:
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### PostgreSQL não conecta:
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "CREATE DATABASE contador_prod;"
```

### SSL não funciona:
```bash
sudo certbot renew --dry-run
sudo certbot certificates
```

---

**Tempo estimado:** 15-30 minutos (incluindo propagação DNS)

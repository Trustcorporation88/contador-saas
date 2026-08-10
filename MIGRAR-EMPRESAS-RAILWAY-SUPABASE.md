# Migrar empresas antigas (Railway Postgres → Supabase)

Contexto: a produção hoje é **frontend Vercel + API Railway + banco Supabase**. As
empresas antigas provavelmente ainda estão no **Postgres do Railway** (projeto
`contador-saas`), que o `contador-api` deixou de usar quando passou para o Supabase.

Estes dois scripts fazem o trabalho por conexão direta ao banco (não mexem em
produção além de inserir as empresas e associá-las ao seu usuário). A produção
continua lendo/escrevendo no Supabase o tempo todo.

> Não é preciso mudar a `DATABASE_URL` do `contador-api` de volta para o Railway.
> Só vamos **ler** do Railway e **escrever** no Supabase.

## Passo 0 — Pegar as URLs

- **Origem (Railway)**: Postgres → *Variables* → `DATABASE_PUBLIC_URL` → *Reveal*
  (valor resolvido, algo como `postgresql://postgres:SENHA@xxx.proxy.rlwy.net:PORTA/railway`,
  **não** o template `${{PGUSER}}...`). Ou aba *Connect* → *Public URL*.
- **Destino (Supabase)**: *Settings* → *Database* → connection string
  (prefira a porta **5432**, session mode, para um backend que fica de pé).

## Passo 1 — Contar o que existe no Railway (só leitura)

```powershell
cd C:\Contador-saas\contador-saas\backend
$env:SOURCE_DATABASE_URL = 'cole-aqui-a-DATABASE_PUBLIC_URL-do-Railway'
node scripts/contar-empresas-railway.mjs
```

Se `companies > 0`, os dados estão lá — siga para o passo 2. Se der erro de
tabela/senha, mande a mensagem (sem colar a senha).

## Passo 2 — Migrar para o Supabase

Primeiro em **simulação** (não grava nada), confira o mapeamento de colunas:

```powershell
$env:SOURCE_DATABASE_URL = 'DATABASE_PUBLIC_URL do Railway'
$env:TARGET_DATABASE_URL = 'URI do Supabase (porta 5432)'
$env:TARGET_USER_EMAIL   = 'voce@empresa.com.br'   # usuário que verá as empresas
node scripts/migrar-empresas-railway-para-supabase.mjs
```

Se o mapeamento estiver certo, grave de verdade:

```powershell
node scripts/migrar-empresas-railway-para-supabase.mjs --aplicar
```

O script:

- lê as colunas de `companies` nos dois bancos e resolve as diferenças de nome
  (`name`/`legal_name`, `zip_code`/`postal_code`, `fiscal_year_start_month`/`fiscal_year_start`);
- faz **upsert** das empresas no Supabase (conflito por CNPJ quando há índice único,
  senão por `id`), então rodar de novo não duplica nada;
- associa cada empresa ao usuário do `TARGET_USER_EMAIL` em `company_users`
  (papel `admin`).

Se aparecer *"Colunas NOT NULL no destino sem correspondente na origem e sem
default"*, edite o `MAPA_COLUNAS` no topo de
`backend/scripts/migrar-empresas-railway-para-supabase.mjs` para mapear essas
colunas antes de aplicar.

## Depois

Valide no app com o seu usuário (não-admin) que a listagem de empresas aparece.
A produção segue no Supabase (RLS ativo); nada muda no fluxo atual.

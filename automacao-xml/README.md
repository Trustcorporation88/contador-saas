# Captura automática de XML fiscal (NF-e + NFS-e)

Automação de **captura de XML** para escritórios de contabilidade: compras (entrada) e vendas (saída) via certificado digital **A1 (.pfx)** com mTLS.

## Estrutura

```
automacao-xml/
├── certs/                    # Certificados A1 por CNPJ (não versionar)
├── xmls/{cnpj}/{ano}/{mes}/  # XMLs capturados (guarda legal: 5 anos)
├── empresas.json             # Config local (copie de empresas.example.json)
├── sync_nfe.py               # NF-e produto — SEFAZ / Distribuição DFe (NSU)
├── sync_nfse.py              # NFS-e serviço — Portal Nacional
├── scheduler.py              # Orquestrador multi-empresa
└── requirements.txt
```

## Instalação

```bash
cd automacao-xml
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### Configuração automática (Windows + Railway)

```powershell
cd automacao-xml
.\setup-local.ps1
```

O script:
- Busca `DATABASE_PUBLIC_URL` no Railway (Postgres público)
- Cria `.env` com `FISCAL_AUTOMATION_DIR`, `FISCAL_XML_ROOT`, etc.
- Gera `empresas.json` com as 3 empresas do procontador.com.br

Depois:
1. Coloque cada `.pfx` em `certs/{cnpj}.pfx`
2. Edite `empresas.json` e troque `COLOQUE_SENHA_DO_CERTIFICADO` pela senha real
3. Execute `.\run-captura.ps1` (ou agende no Task Scheduler)

```powershell
.\run-captura.ps1                    # NF-e + NFS-e
.\run-captura.ps1 -Tipo nfe          # só NF-e
.\run-captura.ps1 -CompanyId 05664820000100
```

### Configuração manual

```bash
copy .env.example .env
copy empresas.example.json empresas.json
```

## Execução manual

```bash
python scheduler.py --tipo all
python scheduler.py --company-id 05664820000100 --tipo nfe
```

## Agendamento (Windows Task Scheduler)

- Programa: `python.exe`
- Argumentos: `C:\caminho\automacao-xml\scheduler.py`
- Frequência recomendada: a cada **4–6 horas**
- Variáveis de ambiente opcionais:
  - `DATABASE_URL` — integra com Postgres do O Contador
  - `FISCAL_XML_ROOT` — pasta de XMLs
  - `FISCAL_HOMOLOGACAO=true` — ambiente de testes SEFAZ

## Integração com O Contador

O backend expõe:

- `POST /api/v1/companies/:companyId/fiscal-capture/certificate` — upload do A1
- `POST /api/v1/companies/:companyId/fiscal-capture/sync` — dispara captura
- `GET /api/v1/companies/:companyId/fiscal-capture/status` — NSU/chave e alertas
- `GET /api/v1/companies/:companyId/fiscal-capture/captures` — XMLs capturados

Defina `PYTHON_BIN` e `FISCAL_AUTOMATION_DIR` no Railway/servidor para o backend invocar este módulo.

## Pontos críticos

| Tema | Detalhe |
|------|---------|
| **Certificado A1** | Validade 1–3 anos; o script alerta 30 dias antes |
| **SEFAZ** | Máx. 50 documentos por chamada; itera pelo NSU |
| **NFS-e municipal** | Municípios fora do Portal Nacional exigem webservice próprio ou API terceira (Nuvem Fiscal, DFE Digital) |
| **NFS-e nacional** | Distribuição via ADN: `GET https://adn.nfse.gov.br/contribuintes/DFe/{NSU}` (até 50 docs, cursor NSU) |
| **Motor Serpro** | Empresas no **Simples Nacional** podem usar o Motor de Cálculo Serpro (custo Serpro) para apuração além da captura de XML — flag `serpro_motor` no cadastro |
| **Segurança** | Prefira executar em servidor local/VPN; não commitar `.pfx` nem senhas |
| **Nuvem** | Certificado A1 em servidor cloud exige política de segurança rigorosa; muitos escritórios rodam o scheduler em máquina local |

## Legislação

XMLs de NF-e/NFS-e devem ser mantidos por **5 anos** — a estrutura `xmls/{cnpj}/{ano}/{mes}/` facilita arquivamento e backup.

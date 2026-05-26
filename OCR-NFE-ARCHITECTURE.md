# 📐 OCR NF-e — Arquitetura e Fluxo de Dados

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Web/Mobile)                      │
│  Upload NF-e (PDF/JPG) → Preview → Confirm → View Journal Entry │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  API Gateway         │
        │ /nfe/ocr/upload      │ (Multer middleware)
        │ /nfe/ocr/:id/preview │ (Auth check)
        │ /nfe/ocr/:id/confirm │
        └──────────────────────┘
                   │
         ┌─────────┼─────────┐
         ▼         ▼         ▼
      ┌────────────────────────────────┐
      │  NfeOcrController              │
      │ ├─ upload()                    │
      │ ├─ getUpload()                 │
      │ ├─ getPreview()                │
      │ ├─ confirm()                   │
      │ └─ validate()                  │
      └────────────────────────────────┘
         │         │         │
         └─────────┼─────────┘
                   ▼
      ┌────────────────────────────────┐
      │  NfeOcrService (645 lines)     │
      │ ├─ processUpload()        ←─┐  │
      │ │  ├─ extractTextFromPdf()   │  │
      │ │  ├─ extractTextFromImage() │  │ OCR
      │ │  ├─ parseNfeFields()       │  │ Logic
      │ │  └─ estimateConfidence()   │  │
      │ │                            │  │
      │ ├─ generateJournalEntryPreview() ←─
      │ │  └─ sugggestAccounts()     │
      │ │                            │
      │ ├─ confirmAndCreateEntry()   │
      │ │  ├─ createJournalEntry()   │
      │ │  ├─ createJournalLines()   │
      │ │  └─ registerNfe()          │
      │ │                            │
      │ └─ validateWithSefaz()       │
      └────────────────────────────────┘
         │         │         │
         └─────────┼─────────┘
                   ▼
      ┌────────────────────────────────┐
      │  External Integrations         │
      │ ├─ Tesseract.js (OCR)         │
      │ ├─ pdf-parse (PDF)            │
      │ ├─ sharp (image processing)   │
      │ └─ SEFAZ API (mock → real)    │
      └────────────────────────────────┘
                   │
                   ▼
      ┌────────────────────────────────┐
      │  PostgreSQL Database           │
      │ ├─ nfe_uploads                 │
      │ │  ├─ id (UUID)                │
      │ │  ├─ ocr_data (JSONB)         │
      │ │  ├─ status                   │
      │ │  └─ extraction_confidence    │
      │ │                              │
      │ ├─ nfe_registry                │
      │ │  ├─ invoice_key (44 digits)  │
      │ │  ├─ journal_entry_id (FK)    │
      │ │  └─ sefaz_status             │
      │ │                              │
      │ ├─ journal_entries             │
      │ └─ journal_lines               │
      └────────────────────────────────┘
```

---

## 🔄 Fluxo de Dados Completo

### Fase 1: Upload & Extração (2-5s)

```
USER ACTION: File Upload
    │
    ▼
┌─────────────────────────────────┐
│ HTTP POST /nfe/ocr/upload       │
│ Body: multipart/form-data       │
│ File: nfe.pdf (50MB max)        │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Multer Middleware               │
│ ✓ Save to /tmp/nfe-uploads/     │
│ ✓ Validate MIME type            │
│ ✓ Check file size               │
└─────────────────────────────────┘
    │ (if valid)
    ▼
┌─────────────────────────────────┐
│ NfeOcrController.upload()       │
│ req.file = { path, size, ... }  │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ NfeOcrService.processUpload()   │
│ 1. Check file type              │
│ 2. Determine PDF vs Image       │
└─────────────────────────────────┘
    │
    ├─ PDF? ────→ extractTextFromPdf()
    │            └─ fs.readFileSync()
    │               └─ pdfParse()
    │                  └─ return text
    │
    └─ Image? ──→ extractTextFromImage()
                 └─ Tesseract.recognize()
                    ├─ Worker: 'tesseract.js'
                    ├─ Lang: 'por+eng'
                    └─ return text
    │
    ▼ (text extracted)
┌─────────────────────────────────┐
│ parseNfeFields(text)            │
│                                 │
│ Extract via regex:              │
│ ├─ nf_number                    │
│ ├─ nf_series                    │
│ ├─ invoice_key (44 digits)      │
│ ├─ issuer_cnpj                  │
│ ├─ issuer_name                  │
│ ├─ total_value                  │
│ ├─ emission_date                │
│ └─ items[]                      │
│                                 │
│ Result: NfeOcrData {}           │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ estimateConfidence()            │
│                                 │
│ Scoring:                        │
│ ├─ nf_number found? +1          │
│ ├─ issuer_cnpj found? +1        │
│ ├─ total_value found? +1        │
│ ├─ emission_date found? +1      │
│ ├─ invoice_key valid? +0.5      │
│ ├─ items found? +0.5            │
│                                 │
│ Confidence = score / 6          │
│ (0.0 to 1.0)                    │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Store NfeUploadRecord in DB     │
│                                 │
│ INSERT INTO nfe_uploads:        │
│ {                               │
│   id: UUID,                     │
│   company_id: UUID,             │
│   file_name: 'nfe.pdf',         │
│   ocr_data: {...},              │
│   status: 'extracted' (>60%),   │
│   extraction_confidence: 0.92   │
│ }                               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Delete temp file                │
│ fs.unlinkSync(tmpPath)          │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ HTTP Response 201               │
│ {                               │
│   id: "uuid",                   │
│   status: "extracted",          │
│   extraction_confidence: 0.92,  │
│   ocr_data: {...}               │
│ }                               │
└─────────────────────────────────┘
```

### Fase 2: Preview (100ms)

```
USER ACTION: View Preview
    │
    ▼
┌─────────────────────────────────┐
│ HTTP GET                        │
│ /nfe/ocr/{uploadId}/preview     │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ NfeOcrController.getPreview()   │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ NfeOcrService                   │
│ .generateJournalEntryPreview()  │
│                                 │
│ 1. Get upload from DB           │
│ 2. Check required fields        │
│    (nf_number, total_value)     │
│ 3. Determine type (entrada/...)│
│ 4. Suggest accounts:            │
│    ├─ Entrada:                  │
│    │  ├─ Debit: 1.1.2.1         │
│    │  └─ Credit: 2.1.1.1        │
│    └─ Saída:                    │
│       ├─ Debit: 1.1.1.2         │
│       └─ Credit: 3.1.1.1        │
│ 5. Return preview object        │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ HTTP Response 200               │
│ {                               │
│   nf_number: "123456",          │
│   type: "entrada",              │
│   suggested_entries: [          │
│     {                           │
│       account_code: "1.1.2.1",  │
│       account_name: "Estoque",  │
│       debit: 1500.00            │
│     },                          │
│     {                           │
│       account_code: "2.1.1.1",  │
│       account_name: "Fornec.",  │
│       credit: 1500.00           │
│     }                           │
│   ]                             │
│ }                               │
└─────────────────────────────────┘
```

### Fase 3: Confirmar & Criar Lançamento (500-1s)

```
USER ACTION: Confirm
    │
    ▼
┌─────────────────────────────────┐
│ HTTP POST                       │
│ /nfe/ocr/{uploadId}/confirm     │
│ Body: {                         │
│   adjustments?: {...},          │
│   labels?: [...]                │
│ }                               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ NfeOcrController.confirm()      │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ NfeOcrService                   │
│ .confirmAndCreateEntry()        │
│                                 │
│ Start DB Transaction:           │
└─────────────────────────────────┘
    │
    ├─ Step 1: Get upload record
    ├─ Step 2: Generate preview
    ├─ Step 3: Apply adjustments (optional)
    │
    ▼
┌─────────────────────────────────┐
│ Step 4: Create journal_entry    │
│                                 │
│ INSERT INTO journal_entries:    │
│ {                               │
│   id: UUID,                     │
│   company_id: UUID,             │
│   description: "NF-e 123456",   │
│   entry_date: "2025-03-10",     │
│   total_amount: 1500.00,        │
│   status: 'posted',             │
│   labels: ['supplier-xyz']      │
│ }                               │
└─────────────────────────────────┘
    │
    ├─ Get debit_account (from adjustments or default)
    ├─ Get credit_account (from adjustments or default)
    │
    ▼
┌─────────────────────────────────┐
│ Step 5: Create debit line       │
│                                 │
│ INSERT INTO journal_lines:      │
│ {                               │
│   id: UUID,                     │
│   journal_entry_id: UUID,       │
│   account_code: '1.1.2.1',      │
│   debit: 1500.00,               │
│   credit: 0,                    │
│   reference: 'OCR - NF-e ...'   │
│ }                               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Step 6: Create credit line      │
│                                 │
│ INSERT INTO journal_lines:      │
│ {                               │
│   id: UUID,                     │
│   journal_entry_id: UUID,       │
│   account_code: '2.1.1.1',      │
│   debit: 0,                     │
│   credit: 1500.00,              │
│   reference: 'OCR - NF-e ...'   │
│ }                               │
│                                 │
│ ✓ Balanced: Σdebit = Σcredit    │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Step 7: Register NF-e           │
│                                 │
│ INSERT INTO nfe_registry:       │
│ {                               │
│   id: UUID,                     │
│   company_id: UUID,             │
│   invoice_key: '352203...',     │
│   nf_number: '123456',          │
│   issuer_cnpj: '10000000...',   │
│   journal_entry_id: UUID,       │
│   sefaz_status: 'pending',      │
│   created_at: NOW               │
│ }                               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Step 8: Update upload status    │
│                                 │
│ UPDATE nfe_uploads              │
│ SET status = 'confirmed'        │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ Commit DB Transaction           │
│ ✓ All or nothing                │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│ HTTP Response 201               │
│ {                               │
│   journal_entry_id: "uuid",     │
│   nfe_status: "processed",      │
│   message: "Lançamento ..."     │
│ }                               │
└─────────────────────────────────┘
```

---

## 📊 Estrutura de Dados

### NfeUploadRecord
```typescript
{
  id: UUID,
  company_id: UUID,
  file_name: string,
  file_path: string,
  file_type: 'pdf' | 'image',
  file_size: number,
  ocr_data: {
    nf_number?: string,
    nf_series?: string,
    invoice_key?: string,
    issuer_cnpj?: string,
    issuer_name?: string,
    total_value?: number,
    emission_date?: string,
    items?: Array<{
      description: string,
      quantity: number,
      unit_price: number,
      total_value: number
    }>,
    confidence?: number,
    raw_text?: string
  },
  status: 'uploaded' | 'extracted' | 'confirmed' | 'error',
  extraction_confidence: number (0-1),
  error_message?: string,
  created_at: timestamp,
  updated_at: timestamp
}
```

### NfeRegistryRecord
```typescript
{
  id: UUID,
  company_id: UUID,
  invoice_key: string (44 digits, unique),
  nf_number: string,
  nf_series: string,
  issuer_cnpj: string (14 digits),
  total_value: decimal,
  emission_date: date,
  journal_entry_id: UUID (FK),
  sefaz_status: 'valid' | 'invalid' | 'pending',
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## 🔐 Integração com Segurança

### Validação em Camadas

```
1. Frontend
   ✓ File type check
   ✓ File size validation
   ✓ User authentication

2. Multer (Express middleware)
   ✓ MIME type validation
   ✓ File size limit (50MB)
   ✓ Temporary storage

3. NfeOcrController
   ✓ Parameter validation
   ✓ Error handling
   ✓ Logging

4. NfeOcrService
   ✓ Database constraints
   ✓ Transaction rollback on error
   ✓ Cascade delete on foreign key

5. Database
   ✓ Type validation
   ✓ Unique constraints
   ✓ Foreign key constraints
   ✓ Check constraints
```

---

## 🚀 Escalabilidade

### Pontos de Gargalo & Soluções

| Gargalo | Solução |
|---------|---------|
| OCR lento (5s+) | Cache de modelos, batch processing |
| Espaço em disco | S3/Cloud storage, auto-cleanup |
| Concorrência | Connection pool, rate limiting |
| DB locks | Indexed queries, async processing |
| Memory | Streaming large PDFs, garbage collection |

### Otimizações Futuras

```
1. Redis Cache
   ├─ Cache extraction results
   ├─ Cache account suggestions
   └─ Rate limiting by user

2. Async Queue
   ├─ Background OCR processing
   ├─ Batch validations
   └─ Webhook callbacks

3. Multi-tenancy
   ├─ Isolated S3 buckets
   ├─ Separate OCR workers
   └─ Per-tenant rate limits

4. ML Model
   ├─ Trained on real NF-e samples
   ├─ Confidence scoring improvements
   └─ Field-specific models
```

---

## 📈 Monitoramento

### Métricas Chave

```
1. OCR Accuracy
   ├─ Fields extracted correctly
   ├─ Confidence score distribution
   └─ Error rate by field type

2. Performance
   ├─ P50, P95, P99 latency
   ├─ Throughput (uploads/min)
   └─ Resource usage (CPU, memory)

3. Quality
   ├─ Journal entry accuracy
   ├─ Manual correction rate
   └─ User satisfaction

4. Reliability
   ├─ Uptime percentage
   ├─ Error rate by endpoint
   └─ Database transaction failures
```

### Logging Strategy

```typescript
Logger.info('NF-e OCR started', {
  uploadId,
  fileName,
  fileSize,
  companyId
});

Logger.debug('OCR confidence calculated', {
  uploadId,
  confidence,
  fieldsFound: ['nf_number', 'cnpj', 'total']
});

Logger.error('OCR processing failed', {
  uploadId,
  error: message,
  stack: trace
});
```

---

## ✅ Próximas Integrações

- [ ] Real SEFAZ API integration
- [ ] GraphQL subscription for real-time updates
- [ ] Webhook notifications
- [ ] Export to accounting software
- [ ] Mobile app support
- [ ] Multi-language OCR

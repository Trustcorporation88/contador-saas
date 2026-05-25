CREATE TABLE IF NOT EXISTS company_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL,
  user_id     UUID NOT NULL,
  role        VARCHAR(50) NOT NULL DEFAULT 'viewer',
  permissions JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, user_id)
);

CREATE TABLE IF NOT EXISTS access_audit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  company_id UUID,
  action     VARCHAR(100) NOT NULL,
  reason     VARCHAR(200),
  details    JSONB,
  ip_address VARCHAR(50),
  timestamp  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Admin tem acesso a todas as empresas
INSERT INTO company_users (company_id, user_id, role, permissions)
SELECT c.id, u.id, 'admin', '["read","write","delete","admin"]'::jsonb
FROM   companies c
CROSS  JOIN users u
WHERE  u.email = 'admin@contador.dev'
ON CONFLICT (company_id, user_id) DO NOTHING;

SELECT 'company_users criado com ' || COUNT(*)::text || ' registros' AS resultado
FROM company_users;

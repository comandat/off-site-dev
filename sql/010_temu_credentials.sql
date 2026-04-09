-- Tabel pentru stocarea credentialelor Temu (access_token, mall_id etc.)
-- Generat automat prin callback OAuth din n8n

CREATE SCHEMA IF NOT EXISTS config;

CREATE TABLE IF NOT EXISTS config.temu_credentials (
    id              SERIAL PRIMARY KEY,
    app_key         TEXT NOT NULL,
    access_token    TEXT NOT NULL,
    mall_id         BIGINT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Upsert pe app_key — un singur rand per aplicatie
CREATE UNIQUE INDEX IF NOT EXISTS uq_temu_credentials_app_key
    ON config.temu_credentials (app_key);

COMMENT ON TABLE config.temu_credentials IS
    'Credentiale Temu OAuth — actualizate automat prin webhook-ul temu-auth-callback';

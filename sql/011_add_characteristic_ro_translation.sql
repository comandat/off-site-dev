-- 011_add_characteristic_ro_translation.sql
-- Adaugă traducerea în română pentru caracteristicile de marketplace (în special Trendyol).
-- Traducerea este folosită EXCLUSIV în off-site-dev pentru afișare bilingvă;
-- denumirile oficiale (characteristic_name) rămân neatinse.
--
-- Idempotent: poate fi rulat de mai multe ori fără efecte adverse.

-- Extensia pentru indexare trigram (căutare substring rapidă pe volume mari)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Adaugă coloanele de traducere
ALTER TABLE catalogs.characteristics
    ADD COLUMN IF NOT EXISTS name_ro TEXT,
    ADD COLUMN IF NOT EXISTS name_ro_source TEXT,          -- 'gemini' / 'manual' / 'fallback'
    ADD COLUMN IF NOT EXISTS name_ro_translated_at TIMESTAMPTZ;

-- Index trigram pe name_ro pentru ILIKE rapid (rar folosit, dar ieftin)
CREATE INDEX IF NOT EXISTS idx_characteristics_name_ro_trgm
    ON catalogs.characteristics
    USING gin (name_ro gin_trgm_ops);

-- Index pentru a filtra rapid rândurile care mai trebuie traduse
-- (folosit de workflow-ul v2-translate-characteristics la Fetch Untranslated)
CREATE INDEX IF NOT EXISTS idx_characteristics_need_translation
    ON catalogs.characteristics (marketplace, characteristic_id)
    WHERE name_ro IS NULL;

COMMENT ON COLUMN catalogs.characteristics.name_ro IS
    'Traducere în română a characteristic_name, generată de Gemini. Folosită pentru afișare bilingvă în off-site-dev. Nu înlocuiește characteristic_name.';
COMMENT ON COLUMN catalogs.characteristics.name_ro_source IS
    'Sursă traducere: gemini / manual / fallback';
COMMENT ON COLUMN catalogs.characteristics.name_ro_translated_at IS
    'Timestamp ultima traducere. Pentru a forța re-traducerea: SET name_ro = NULL WHERE ...';

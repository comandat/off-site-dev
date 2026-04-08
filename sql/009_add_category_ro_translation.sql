-- 009_add_category_ro_translation.sql
-- Adaugă traducerea în română pentru categoriile de marketplace (în special Trendyol)
-- Traducerea este folosită EXCLUSIV în off-site-dev pentru căutare bilingvă;
-- denumirile oficiale (category_name) rămân neatinse.
--
-- Idempotent: poate fi rulat de mai multe ori fără efecte adverse.

-- Extensia pentru indexare trigram (căutare substring rapidă pe volume mari)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Adaugă coloanele de traducere
ALTER TABLE catalogs.categories
    ADD COLUMN IF NOT EXISTS name_ro TEXT,
    ADD COLUMN IF NOT EXISTS name_ro_source TEXT,          -- 'gemini' / 'manual' / 'fallback'
    ADD COLUMN IF NOT EXISTS name_ro_translated_at TIMESTAMPTZ;

-- Index trigram pe name_ro pentru ILIKE rapid (~100ms pe 10k rânduri tipic)
CREATE INDEX IF NOT EXISTS idx_categories_name_ro_trgm
    ON catalogs.categories
    USING gin (name_ro gin_trgm_ops);

-- Index trigram pe category_name (dacă nu există deja) pentru același motiv
CREATE INDEX IF NOT EXISTS idx_categories_category_name_trgm
    ON catalogs.categories
    USING gin (category_name gin_trgm_ops);

-- Index pentru a filtra rapid rândurile care mai trebuie traduse
CREATE INDEX IF NOT EXISTS idx_categories_need_translation
    ON catalogs.categories (marketplace, category_id)
    WHERE name_ro IS NULL;

COMMENT ON COLUMN catalogs.categories.name_ro IS
    'Traducere în română a category_name, generată de Gemini. Folosită pentru căutare bilingvă în off-site-dev. Nu înlocuiește category_name.';
COMMENT ON COLUMN catalogs.categories.name_ro_source IS
    'Sursă traducere: gemini / manual / fallback';
COMMENT ON COLUMN catalogs.categories.name_ro_translated_at IS
    'Timestamp ultima traducere. Re-traducerea se face când last_synced_at > name_ro_translated_at.';

-- ============================================================
-- 007: Funcție pentru sincronizarea unei categorii de pe API
--      în tabelele catalogs.categories / characteristics / values
-- ============================================================
-- Rulează în pgAdmin înainte de a importa workflow-ul n8n.
-- ============================================================

CREATE OR REPLACE FUNCTION catalogs.sync_category_from_api(
    p_marketplace TEXT,
    p_category_id TEXT,
    p_category_name TEXT,
    p_characteristics JSONB
) RETURNS JSONB AS $$
DECLARE
    char_rec JSONB;
    val_rec JSONB;
    char_id INTEGER;
    i INTEGER;
    j INTEGER;
    chars_count INTEGER := 0;
    vals_count INTEGER := 0;
BEGIN
    -- 1. Upsert categorie
    INSERT INTO catalogs.categories (marketplace, category_id, category_name, is_active, last_synced_at)
    VALUES (p_marketplace, p_category_id, p_category_name, true, NOW())
    ON CONFLICT (marketplace, category_id) DO UPDATE SET
        category_name = EXCLUDED.category_name,
        is_active = true,
        last_synced_at = NOW();

    -- 2. Upsert caracteristici + valori
    IF p_characteristics IS NOT NULL AND jsonb_typeof(p_characteristics) = 'array'
       AND jsonb_array_length(p_characteristics) > 0 THEN

        FOR i IN 0..jsonb_array_length(p_characteristics) - 1 LOOP
            char_rec := p_characteristics->i;
            char_id := (char_rec->>'id')::INTEGER;

            INSERT INTO catalogs.characteristics (
                marketplace, category_id, characteristic_id,
                characteristic_name, is_mandatory, allows_custom,
                type_id, is_active, last_synced_at
            ) VALUES (
                p_marketplace, p_category_id, char_id,
                char_rec->>'name',
                COALESCE((char_rec->>'is_mandatory')::BOOLEAN, false),
                COALESCE((char_rec->>'allows_custom')::BOOLEAN, false),
                COALESCE((char_rec->>'type_id')::INTEGER, 1),
                true, NOW()
            ) ON CONFLICT (marketplace, category_id, characteristic_id) DO UPDATE SET
                characteristic_name = EXCLUDED.characteristic_name,
                is_mandatory = EXCLUDED.is_mandatory,
                allows_custom = EXCLUDED.allows_custom,
                type_id = EXCLUDED.type_id,
                is_active = true,
                last_synced_at = NOW();

            chars_count := chars_count + 1;

            -- Valori pentru această caracteristică
            IF char_rec->'values' IS NOT NULL
               AND jsonb_typeof(char_rec->'values') = 'array'
               AND jsonb_array_length(char_rec->'values') > 0 THEN

                FOR j IN 0..jsonb_array_length(char_rec->'values') - 1 LOOP
                    val_rec := (char_rec->'values')->j;

                    INSERT INTO catalogs.characteristic_values (
                        marketplace, characteristic_id, value_id,
                        value_name, is_active, last_synced_at
                    ) VALUES (
                        p_marketplace, char_id,
                        (val_rec->>'id')::INTEGER,
                        val_rec->>'name',
                        true, NOW()
                    ) ON CONFLICT (marketplace, characteristic_id, value_id) DO UPDATE SET
                        value_name = EXCLUDED.value_name,
                        is_active = true,
                        last_synced_at = NOW();

                    vals_count := vals_count + 1;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'status', 'synced',
        'marketplace', p_marketplace,
        'category_id', p_category_id,
        'characteristics_count', chars_count,
        'values_count', vals_count
    );
END;
$$ LANGUAGE plpgsql;

-- Armazena os assets de cada criativo do Meta Ads.
-- Sincronizado pelo endpoint sync-meta (step: creatives).
CREATE TABLE IF NOT EXISTS meta_creatives (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creative_id     TEXT UNIQUE NOT NULL,
  account_id      TEXT NOT NULL,
  title           TEXT,
  body            TEXT,
  image_url       TEXT,
  thumbnail_url   TEXT,
  link_url        TEXT,
  object_story_id TEXT,
  status          TEXT,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creatives_account ON meta_creatives(account_id);
CREATE INDEX IF NOT EXISTS idx_creatives_id       ON meta_creatives(creative_id);

COMMENT ON TABLE  meta_creatives IS 'Assets de cada criativo (imagem, copy, título, thumbnail, URL) sincronizados da Graph API do Meta.';
COMMENT ON COLUMN meta_creatives.thumbnail_url  IS 'Thumbnail 100×100 px do Meta, para exibir na listagem.';
COMMENT ON COLUMN meta_creatives.image_url      IS 'URL da imagem em alta resolução.';
COMMENT ON COLUMN meta_creatives.body            IS 'Texto principal (copy) do criativo.';

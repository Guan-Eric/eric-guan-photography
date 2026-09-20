-- Book-time add-ons snapshot on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS add_ons_json TEXT NOT NULL DEFAULT '[]';

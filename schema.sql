-- ============================================
-- KEDAI MANGLEMAN APP - DATABASE SCHEMA
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. PRODUCTS (Menu)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'ricebowl','mie','dimsum','minuman','snack'
  price INTEGER NOT NULL,
  hpp INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  stock_ready INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  gedung TEXT,
  lantai TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  segment TEXT DEFAULT 'Baru', -- 'VIP','Loyal','Regular','Baru'
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  gedung TEXT NOT NULL,
  lantai TEXT NOT NULL,
  phone TEXT,
  catatan TEXT,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Baru', -- 'Baru','Diproses','Dikemas','Dikirim','Selesai','Batal'
  payment_method TEXT DEFAULT 'Cash',
  payment_status TEXT DEFAULT 'Belum Bayar',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. EXPENSES (Pengeluaran)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'Bahan Baku','Kemasan','Ongkir Supplier','Operasional','Lainnya'
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  supplier TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RAW MATERIALS (Bahan Baku)
CREATE TABLE IF NOT EXISTS raw_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL, -- 'kg','gram','liter','ml','pcs','sachet','bungkus'
  stock_qty DECIMAL(10,3) DEFAULT 0,
  min_stock DECIMAL(10,3) DEFAULT 0,
  last_price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RECIPES
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id UUID REFERENCES raw_materials(id),
  material_name TEXT NOT NULL,
  qty_used DECIMAL(10,3) NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MONTHLY TARGETS
CREATE TABLE IF NOT EXISTS monthly_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  target_revenue INTEGER DEFAULT 0,
  target_orders INTEGER DEFAULT 0,
  target_profit INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
);

-- ============================================
-- SEED DATA: Produk awal Kedai MangLeman
-- ============================================
INSERT INTO products (name, category, price, is_available) VALUES
  ('Ricebowl Lele Goreng', 'ricebowl', 18000, true),
  ('Ricebowl Lele Bakar', 'ricebowl', 18000, true),
  ('Ricebowl Ayam Goreng', 'ricebowl', 18000, true),
  ('Ricebowl Ayam Bakar', 'ricebowl', 18000, true),
  ('Mie Goreng', 'mie', 15000, true),
  ('Mie Rebus', 'mie', 15000, true),
  ('Dimsum (5 pcs)', 'dimsum', 15000, true),
  ('Dimsum (10 pcs)', 'dimsum', 25000, true),
  ('Jus Jeruk', 'minuman', 10000, true),
  ('Jus Alpukat', 'minuman', 12000, true),
  ('Es Teh Manis', 'minuman', 5000, true),
  ('Air Mineral', 'minuman', 4000, true),
  ('Snack Keripik', 'snack', 8000, true),
  ('Snack Kue', 'snack', 10000, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Orders: siapapun bisa insert (untuk form customer)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone can update orders" ON orders FOR UPDATE USING (true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read order_items" ON order_items FOR SELECT USING (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true);
CREATE POLICY "Anyone can modify products" ON products FOR ALL USING (true);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage customers" ON customers FOR ALL USING (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage expenses" ON expenses FOR ALL USING (true);

ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage raw_materials" ON raw_materials FOR ALL USING (true);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage recipes" ON recipes FOR ALL USING (true);

ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage monthly_targets" ON monthly_targets FOR ALL USING (true);

-- ============================================
-- FUNCTION: Auto-generate order number
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(CAST(nextval('order_seq') AS TEXT), 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS order_seq START 1;
CREATE TRIGGER set_order_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();

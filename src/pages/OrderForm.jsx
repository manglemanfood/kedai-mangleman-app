DO $$
DECLARE keep_id UUID; del_id UUID;
BEGIN
  -- Simpan yang total_spent terbesar (VIP)
  SELECT id INTO keep_id FROM customers 
  WHERE name = 'Isnaini' ORDER BY total_spent DESC LIMIT 1;
  
  SELECT id INTO del_id FROM customers 
  WHERE name = 'Isnaini' ORDER BY total_spent DESC OFFSET 1 LIMIT 1;

  -- Pindahkan orders + ambil phone jika ada
  UPDATE orders SET customer_id = keep_id WHERE customer_id = del_id;
  
  UPDATE customers SET
    phone = COALESCE(phone, (SELECT phone FROM customers WHERE id = del_id)),
    total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = keep_id AND status != 'Batal'),
    total_spent = (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE customer_id = keep_id AND status != 'Batal'),
    segment = CASE
      WHEN (SELECT COUNT(*) FROM orders WHERE customer_id = keep_id AND status != 'Batal') >= 20 THEN 'VIP'
      WHEN (SELECT COUNT(*) FROM orders WHERE customer_id = keep_id AND status != 'Batal') >= 10 THEN 'Loyal'
      WHEN (SELECT COUNT(*) FROM orders WHERE customer_id = keep_id AND status != 'Batal') >= 3  THEN 'Regular'
      ELSE 'Baru' END
  WHERE id = keep_id;

  DELETE FROM customers WHERE id = del_id;
  RAISE NOTICE 'Done! Keep: %, Deleted: %', keep_id, del_id;
END $$;

-- Verifikasi
SELECT name, phone, total_orders, total_spent, segment FROM customers WHERE name = 'Isnaini';

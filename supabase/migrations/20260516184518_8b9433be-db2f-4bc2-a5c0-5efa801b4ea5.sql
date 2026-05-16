
-- Drop old pay_later
DROP TABLE IF EXISTS public.pay_later CASCADE;

-- Categories (self-referencing tree)
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_categories_all" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER set_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate items: add category_id + rental_price, seed top-level categories from existing text values
ALTER TABLE public.items ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN rental_price numeric DEFAULT 0;

INSERT INTO public.categories (name)
SELECT DISTINCT category FROM public.items WHERE category IS NOT NULL AND category <> ''
ON CONFLICT DO NOTHING;

UPDATE public.items i
SET category_id = c.id
FROM public.categories c
WHERE i.category = c.name AND c.parent_id IS NULL;

ALTER TABLE public.items DROP COLUMN category;
CREATE INDEX idx_items_category ON public.items(category_id);

-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending')),
  payment_due_date date,
  paid_at date,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_transactions_all" ON public.transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER set_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_taken_at ON public.transactions(taken_at DESC);

-- Transaction lines
CREATE TABLE public.transaction_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'buy' CHECK (kind IN ('buy','rent')),
  rental_return_date date,
  returned_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_transaction_lines_all" ON public.transaction_lines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_lines_transaction ON public.transaction_lines(transaction_id);
CREATE INDEX idx_lines_item ON public.transaction_lines(item_id);

-- Atomic create_transaction
CREATE OR REPLACE FUNCTION public.create_transaction(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tx_id uuid;
  line jsonb;
  total numeric := 0;
  it_qty integer;
BEGIN
  INSERT INTO public.transactions (customer_name, taken_at, status, payment_due_date, paid_at, notes, total_amount)
  VALUES (
    payload->>'customer_name',
    COALESCE((payload->>'taken_at')::date, CURRENT_DATE),
    COALESCE(payload->>'status', 'paid'),
    NULLIF(payload->>'payment_due_date','')::date,
    NULLIF(payload->>'paid_at','')::date,
    NULLIF(payload->>'notes',''),
    0
  ) RETURNING id INTO new_tx_id;

  FOR line IN SELECT * FROM jsonb_array_elements(payload->'lines')
  LOOP
    INSERT INTO public.transaction_lines (
      transaction_id, item_id, item_name, quantity, unit_price, line_total, kind, rental_return_date
    ) VALUES (
      new_tx_id,
      NULLIF(line->>'item_id','')::uuid,
      line->>'item_name',
      COALESCE((line->>'quantity')::int, 1),
      COALESCE((line->>'unit_price')::numeric, 0),
      COALESCE((line->>'quantity')::int, 1) * COALESCE((line->>'unit_price')::numeric, 0),
      COALESCE(line->>'kind','buy'),
      NULLIF(line->>'rental_return_date','')::date
    );

    total := total + COALESCE((line->>'quantity')::int, 1) * COALESCE((line->>'unit_price')::numeric, 0);

    IF (line->>'item_id') IS NOT NULL AND (line->>'item_id') <> '' THEN
      UPDATE public.items
      SET quantity = GREATEST(0, quantity - COALESCE((line->>'quantity')::int, 1))
      WHERE id = (line->>'item_id')::uuid
      RETURNING quantity INTO it_qty;
    END IF;
  END LOOP;

  UPDATE public.transactions SET total_amount = total WHERE id = new_tx_id;
  RETURN new_tx_id;
END;
$$;

-- Toggle rental returned (restores or removes stock accordingly)
CREATE OR REPLACE FUNCTION public.set_line_returned(line_id uuid, returned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_qty integer;
  v_already date;
BEGIN
  SELECT item_id, quantity, returned_at INTO v_item_id, v_qty, v_already
  FROM public.transaction_lines WHERE id = line_id;

  IF returned AND v_already IS NULL THEN
    UPDATE public.transaction_lines SET returned_at = CURRENT_DATE WHERE id = line_id;
    IF v_item_id IS NOT NULL THEN
      UPDATE public.items SET quantity = quantity + v_qty WHERE id = v_item_id;
    END IF;
  ELSIF NOT returned AND v_already IS NOT NULL THEN
    UPDATE public.transaction_lines SET returned_at = NULL WHERE id = line_id;
    IF v_item_id IS NOT NULL THEN
      UPDATE public.items SET quantity = GREATEST(0, quantity - v_qty) WHERE id = v_item_id;
    END IF;
  END IF;
END;
$$;

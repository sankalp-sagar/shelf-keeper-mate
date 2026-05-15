
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  unit_price NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pay_later (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  taken_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_name ON public.items (name);
CREATE INDEX idx_items_category ON public.items (category);
CREATE INDEX idx_pay_later_paid ON public.pay_later (paid);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_set_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_later ENABLE ROW LEVEL SECURITY;

-- App is public (no login). Allow anon + authenticated full access.
CREATE POLICY "public_items_all" ON public.items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_pay_later_all" ON public.pay_later FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

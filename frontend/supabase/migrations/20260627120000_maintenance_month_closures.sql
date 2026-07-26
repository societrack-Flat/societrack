-- Track closed maintenance months so rollover is idempotent (prevents double arrears).
CREATE TABLE IF NOT EXISTS public.maintenance_month_closures (
  apartment_id uuid NOT NULL REFERENCES public.apartments (id) ON DELETE CASCADE,
  close_year int NOT NULL CHECK (close_year >= 2000 AND close_year <= 2200),
  close_month int NOT NULL CHECK (close_month >= 1 AND close_month <= 12),
  closed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (apartment_id, close_year, close_month)
);

COMMENT ON TABLE public.maintenance_month_closures IS
  'One row per apartment/month after maintenance rollover — prevents applying arrears twice.';

CREATE OR REPLACE FUNCTION public.reduce_inventory_qty(inv_id uuid, dec_qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_qty numeric;
BEGIN
  SELECT item_qty INTO current_qty FROM public.inventory_mgmt WHERE id = inv_id FOR UPDATE;
  
  IF current_qty < dec_qty THEN
    RAISE EXCEPTION 'Insufficient stock in batch %: Available %, Required %', inv_id, current_qty, dec_qty;
  END IF;

  UPDATE public.inventory_mgmt
  SET item_qty = item_qty - dec_qty
  WHERE id = inv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_inventory_qty(inv_id uuid, inc_qty numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.inventory_mgmt
  SET item_qty = item_qty + inc_qty
  WHERE id = inv_id;
END;
$$;

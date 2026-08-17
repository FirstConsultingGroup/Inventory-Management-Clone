-- Replace process_inventory_transfer RPC function to fix table name store_master to store_mgmt
CREATE OR REPLACE FUNCTION process_inventory_transfer(
    p_company_id UUID,
    p_item_id UUID,
    p_source_store_id UUID,
    p_destination_store_id UUID,
    p_source_inv_loc UUID,
    p_destination_inv_loc UUID,
    p_quantity NUMERIC,
    p_po_id UUID,
    p_unit_price NUMERIC,
    p_selling_price NUMERIC,
    p_notes TEXT,
    p_action_by UUID
) RETURNS VOID AS $$
DECLARE
    v_source_row RECORD;
    v_dest_row RECORD;
    v_new_source_qty NUMERIC;
    v_new_dest_qty NUMERIC;
    v_source_name TEXT;
    v_dest_name TEXT;
BEGIN
    -- 1. Fetch Source Stock
    SELECT id, item_qty INTO v_source_row 
    FROM inventory_mgmt 
    WHERE item_id = p_item_id 
      AND store_id = p_source_store_id 
      AND (purchase_order_id = p_po_id OR (purchase_order_id IS NULL AND p_po_id IS NULL))
      AND (link_loc IS NOT DISTINCT FROM p_source_inv_loc)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Origin store stock not found. Aborting transfer.';
    END IF;

    v_new_source_qty := COALESCE(v_source_row.item_qty, 0) - p_quantity;
    IF v_new_source_qty < 0 THEN
        RAISE EXCEPTION 'Origin store stock would go negative. Aborting.';
    END IF;

    -- 2. Fetch Destination Stock
    SELECT id, item_qty INTO v_dest_row 
    FROM inventory_mgmt 
    WHERE item_id = p_item_id 
      AND store_id = p_destination_store_id 
      AND (purchase_order_id = p_po_id OR (purchase_order_id IS NULL AND p_po_id IS NULL))
      AND (link_loc IS NOT DISTINCT FROM p_destination_inv_loc)
    FOR UPDATE;

    -- 3. Update Destination
    IF FOUND THEN
        v_new_dest_qty := COALESCE(v_dest_row.item_qty, 0) + p_quantity;
        UPDATE inventory_mgmt SET item_qty = v_new_dest_qty WHERE id = v_dest_row.id;
    ELSE
        -- Insert new
        INSERT INTO inventory_mgmt (
            item_id, store_id, purchase_order_id, item_qty, 
            unit_price, selling_price, stock_date, created_at, company_id, link_loc
        ) VALUES (
            p_item_id, p_destination_store_id, p_po_id, p_quantity,
            p_unit_price, p_selling_price, now(), now(), p_company_id, p_destination_inv_loc
        );
    END IF;

    -- 4. Update Source
    UPDATE inventory_mgmt SET item_qty = v_new_source_qty WHERE id = v_source_row.id;

    -- 5. Insert Transfer Record
    INSERT INTO inventory_transfer (
        orgin_store_id, destination_store_id, item_id, transfer_qty,
        transfer_date, created_by, created_at, notes, company_id,
        origin_inv_loc, destination_inv_loc
    ) VALUES (
        p_source_store_id, p_destination_store_id, p_item_id, p_quantity,
        now(), p_action_by, now(), p_notes, p_company_id,
        p_source_inv_loc, p_destination_inv_loc
    );

    -- 6. Insert System Log
    SELECT name INTO v_source_name FROM store_mgmt WHERE id = p_source_store_id;
    SELECT name INTO v_dest_name FROM store_mgmt WHERE id = p_destination_store_id;

    INSERT INTO system_log (
        company_id, transaction_date, module, scope, key, log, action_by, created_at
    ) VALUES (
        p_company_id, now(), 'Stock Transfer', 'Add', p_item_id::text,
        'Item ' || p_item_id::text || ' transferred from ' || COALESCE(v_source_name, '') || ' to ' || COALESCE(v_dest_name, '') || '.',
        p_action_by, now()
    );

END;
$$ LANGUAGE plpgsql;

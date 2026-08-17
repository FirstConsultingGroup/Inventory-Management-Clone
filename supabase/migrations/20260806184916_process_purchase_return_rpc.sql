CREATE OR REPLACE FUNCTION process_purchase_return(
    p_return_id UUID,
    p_po_id UUID,
    p_items JSONB,
    p_status_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    item RECORD;
    v_item_id UUID;
    v_return_qty NUMERIC;
    v_current_stock NUMERIC;
BEGIN
    -- 1. Loop through items and validate stock
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, return_qty NUMERIC)
    LOOP
        v_item_id := item.item_id;
        v_return_qty := item.return_qty;

        -- Check current stock for this PO and Item
        SELECT item_qty INTO v_current_stock
        FROM inventory_mgmt
        WHERE purchase_order_id = p_po_id AND item_id = v_item_id
        FOR UPDATE; -- lock the row

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Inventory record not found for item %', v_item_id;
        END IF;

        IF v_current_stock < v_return_qty THEN
            RAISE EXCEPTION 'Insufficient stock for item %. Available: %, Required: %', v_item_id, v_current_stock, v_return_qty;
        END IF;
    END LOOP;

    -- 2. If all validations pass, perform updates
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, return_qty NUMERIC)
    LOOP
        v_item_id := item.item_id;
        v_return_qty := item.return_qty;

        -- Decrease inventory
        UPDATE inventory_mgmt
        SET item_qty = item_qty - v_return_qty
        WHERE purchase_order_id = p_po_id AND item_id = v_item_id;

        -- Update purchase order items returned quantity
        UPDATE purchase_order_items
        SET returned_qty = COALESCE(returned_qty, 0) + v_return_qty
        WHERE purchase_order_id = p_po_id AND item_id = v_item_id;
    END LOOP;

    -- 3. Update return status
    UPDATE purchase_return
    SET return_status = p_status_id,
        modified_at = NOW()
    WHERE id = p_return_id;

    RETURN jsonb_build_object('success', true, 'message', 'Purchase return processed successfully.');
END;
$$;

-- Create process_sales_return RPC function to atomically process sales return and inventory increment
CREATE OR REPLACE FUNCTION process_sales_return(
    p_sales_return_id UUID,
    p_action_by UUID,
    p_status_id UUID
) RETURNS VOID AS $$
DECLARE
    v_item RECORD;
    v_invoice_item RECORD;
    v_loc_item jsonb;
    v_remaining_to_restore NUMERIC;
    v_amount_to_restore NUMERIC;
    v_loc_array jsonb;
    v_inv_id UUID;
    v_qty_from_loc NUMERIC;
    v_sales_return_number VARCHAR;
    v_company_id UUID;
BEGIN
    -- 1. Get the sales return details and lock the row
    SELECT sales_return_number, company_id 
    INTO v_sales_return_number, v_company_id
    FROM sales_return 
    WHERE id = p_sales_return_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales Return % not found', p_sales_return_id;
    END IF;

    -- 2. Process each return item
    FOR v_item IN 
        SELECT sri.item_id, sri.returned_qty, sr.linked_invoice_id 
        FROM sales_return_items sri
        JOIN sales_return sr ON sr.id = sri.sales_return_id
        WHERE sri.sales_return_id = p_sales_return_id AND sri.is_active = true
    LOOP
        v_remaining_to_restore := v_item.returned_qty;
        
        IF v_remaining_to_restore <= 0 THEN
            CONTINUE;
        END IF;

        -- Fetch the corresponding invoice item to get loc_id array
        SELECT loc_id 
        INTO v_invoice_item
        FROM sales_invoice_items 
        WHERE sales_invoice_id = v_item.linked_invoice_id 
          AND item_id = v_item.item_id 
        LIMIT 1;

        IF NOT FOUND OR v_invoice_item.loc_id IS NULL THEN
            CONTINUE;
        END IF;

        -- Ensure loc_id is processed as jsonb array
        v_loc_array := v_invoice_item.loc_id::jsonb;
        
        IF jsonb_typeof(v_loc_array) != 'array' THEN
            CONTINUE;
        END IF;

        -- Loop through the locations where the items were sold from
        FOR v_loc_item IN SELECT * FROM jsonb_array_elements(v_loc_array)
        LOOP
            IF v_remaining_to_restore <= 0 THEN
                EXIT;
            END IF;

            v_inv_id := (v_loc_item->>'inv_id')::UUID;
            v_qty_from_loc := COALESCE((v_loc_item->>'qty')::NUMERIC, 0);

            IF v_inv_id IS NULL OR v_qty_from_loc <= 0 THEN
                CONTINUE;
            END IF;

            v_amount_to_restore := LEAST(v_remaining_to_restore, v_qty_from_loc);

            -- Restore inventory atomically
            UPDATE inventory_mgmt
            SET item_qty = item_qty + v_amount_to_restore
            WHERE id = v_inv_id;

            v_remaining_to_restore := v_remaining_to_restore - v_amount_to_restore;
        END LOOP;
        
        IF v_remaining_to_restore > 0 THEN
            RAISE NOTICE 'Could not fully restore % for item %', v_remaining_to_restore, v_item.item_id;
        END IF;
    END LOOP;

    -- 3. Update Sales Return Status
    IF p_status_id IS NOT NULL THEN
        UPDATE sales_return
        SET return_status = p_status_id
        WHERE id = p_sales_return_id;
    END IF;

    -- 4. Insert System Log
    INSERT INTO system_log (
        company_id,
        transaction_date,
        module,
        scope,
        key,
        log,
        action_by,
        created_at
    ) VALUES (
        v_company_id,
        now(),
        'Sales Return',
        'Edit',
        v_sales_return_number,
        'Sales Return ' || v_sales_return_number || ' items returned and inventory updated via workflow.',
        p_action_by,
        now()
    );

END;
$$ LANGUAGE plpgsql;

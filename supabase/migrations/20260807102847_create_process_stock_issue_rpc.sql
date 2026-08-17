-- Create process_stock_issue RPC function to atomically process stock issue with FIFO logic
CREATE OR REPLACE FUNCTION process_stock_issue(
    p_pr_id UUID,
    p_store_id UUID,
    p_company_id UUID,
    p_action_by UUID,
    p_items JSONB
) RETURNS VOID AS $$
DECLARE
    v_item RECORD;
    v_inventory_record RECORD;
    v_issue_qty NUMERIC;
    v_remaining_to_issue NUMERIC;
    v_deducted_qty NUMERIC;
    v_history_entry JSONB;
    v_deducted_locations JSONB;
    v_new_issued_qty NUMERIC;
    v_new_remaining_qty NUMERIC;
    v_new_status VARCHAR;
    v_pr_number VARCHAR;
    v_current_history JSONB;
    v_current_locations JSONB;
    v_pr_detail RECORD;
    v_all_issued BOOLEAN;
    v_closed_status_id UUID;
BEGIN
    -- 1. Get PR number
    SELECT pr_number INTO v_pr_number FROM purchase_req_master WHERE id = p_pr_id;
    
    -- 2. Loop over items to issue
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, issue_qty NUMERIC)
    LOOP
        v_remaining_to_issue := v_item.issue_qty;
        v_deducted_locations := '[]'::jsonb;
        
        -- Loop over inventory (FIFO)
        FOR v_inventory_record IN 
            SELECT id, item_qty, link_loc 
            FROM inventory_mgmt 
            WHERE company_id = p_company_id 
              AND store_id = p_store_id 
              AND item_id = v_item.item_id 
              AND item_qty > 0 
            ORDER BY created_at ASC
            FOR UPDATE
        LOOP
            IF v_remaining_to_issue <= 0 THEN
                EXIT;
            END IF;
            
            v_deducted_qty := LEAST(v_remaining_to_issue, v_inventory_record.item_qty);
            
            -- Deduct from inventory
            UPDATE inventory_mgmt SET item_qty = item_qty - v_deducted_qty WHERE id = v_inventory_record.id;
            
            -- Append to locations array
            v_deducted_locations := v_deducted_locations || jsonb_build_object(
                'id', v_inventory_record.id,
                'qty', v_deducted_qty,
                'inv_id', v_inventory_record.link_loc
            );
            
            v_remaining_to_issue := v_remaining_to_issue - v_deducted_qty;
        END LOOP;
        
        IF v_remaining_to_issue > 0 THEN
            RAISE EXCEPTION 'Insufficient stock in inventory for item %', v_item.item_id;
        END IF;
        
        -- Get current details
        SELECT issued_qty, remaining_qty, quantity, issue_history, source_locations 
        INTO v_pr_detail 
        FROM purchase_req_details 
        WHERE purchase_req_id = p_pr_id AND item_id = v_item.item_id;
        
        v_new_issued_qty := COALESCE(v_pr_detail.issued_qty, 0) + v_item.issue_qty;
        v_new_remaining_qty := COALESCE(v_pr_detail.remaining_qty, v_pr_detail.quantity) - v_item.issue_qty;
        
        IF v_new_remaining_qty <= 0 THEN
            v_new_status := 'Issued';
        ELSE
            v_new_status := 'Partially Issued';
        END IF;
        
        -- Append history
        v_history_entry := jsonb_build_object(
            'issued_qty', v_item.issue_qty,
            'issued_by', p_action_by,
            'issued_at', now()
        );
        
        v_current_history := COALESCE(v_pr_detail.issue_history, '[]'::jsonb);
        IF jsonb_typeof(v_current_history) != 'array' THEN
            v_current_history := '[]'::jsonb;
        END IF;
        
        v_current_locations := COALESCE(v_pr_detail.source_locations, '[]'::jsonb);
        IF jsonb_typeof(v_current_locations) != 'array' THEN
            v_current_locations := '[]'::jsonb;
        END IF;
        
        -- Update PR detail
        UPDATE purchase_req_details 
        SET issued_qty = v_new_issued_qty,
            remaining_qty = v_new_remaining_qty,
            status = v_new_status,
            issue_history = v_current_history || jsonb_build_array(v_history_entry),
            source_locations = v_current_locations || v_deducted_locations
        WHERE purchase_req_id = p_pr_id AND item_id = v_item.item_id;
        
    END LOOP;

    -- 3. Check if all items fully issued
    SELECT bool_and(status = 'Issued') INTO v_all_issued FROM purchase_req_details WHERE purchase_req_id = p_pr_id;
    
    IF COALESCE(v_all_issued, false) THEN
        SELECT id INTO v_closed_status_id FROM system_msg_config WHERE sub_category_id = 'CLOSED' LIMIT 1;
        IF v_closed_status_id IS NOT NULL THEN
            UPDATE purchase_req_master SET status = v_closed_status_id WHERE id = p_pr_id;
        END IF;
    END IF;
    
    -- 4. Log
    INSERT INTO system_log (company_id, transaction_date, module, scope, key, log, action_by, created_at) 
    VALUES (p_company_id, now(), 'Purchase Requisition', 'Stock Issue', v_pr_number, 'Stock issued for PR ' || v_pr_number || ' via workflow.', p_action_by, now());

END;
$$ LANGUAGE plpgsql;

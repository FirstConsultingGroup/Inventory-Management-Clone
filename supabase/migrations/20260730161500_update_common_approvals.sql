-- Make store_id nullable in approval_requests to support general modules
ALTER TABLE public.approval_requests ALTER COLUMN store_id DROP NOT NULL;

-- Update the RPC to handle nullable store_id for general modules
CREATE OR REPLACE FUNCTION get_pending_approvals(p_user_id uuid, p_role_id uuid, p_store_id uuid)
RETURNS TABLE (
  request_id uuid,
  module_id uuid,
  action_id uuid,
  requested_by uuid,
  payload jsonb,
  current_level smallint,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT ar.id, ar.module_id, ar.action_id, ar.requested_by, ar.payload, ar.current_level, ar.created_at
  FROM approval_requests ar
  WHERE ar.status = 'PENDING'
    AND (ar.store_id = p_store_id OR ar.store_id IS NULL)
    AND EXISTS (
      -- Check if the current level's role matches the user's role in the workflow snapshot
      SELECT 1
      FROM jsonb_array_elements(ar.workflow_snapshot) AS step
      WHERE (step->>'level')::smallint = ar.current_level
        AND step->>'role_id' = p_role_id::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

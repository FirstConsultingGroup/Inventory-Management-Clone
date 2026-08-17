-- Add reference_number column to approval_requests
ALTER TABLE public.approval_requests
ADD COLUMN IF NOT EXISTS reference_number varchar(50);

-- Update the RPC to include pagination, filtering, and the new reference_number column
CREATE OR REPLACE FUNCTION public.get_pending_approvals(
  p_user_id uuid,
  p_role_id uuid,
  p_store_id uuid,
  p_module_id uuid DEFAULT NULL,
  p_action_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_is_super_admin boolean DEFAULT false
)
RETURNS TABLE (
  request_id uuid,
  reference_number varchar(50),
  module_name text,
  action_name text,
  requested_by_name text,
  payload jsonb,
  current_level smallint,
  status varchar(50),
  workflow_snapshot jsonb,
  created_at timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_requests AS (
    SELECT 
      ar.id as request_id, 
      ar.reference_number,
      mm.module_name::text, 
      aa.action_name::text, 
      um.first_name || ' ' || um.last_name as requested_by_name, 
      ar.payload, 
      ar.current_level, 
      ar.status,
      ar.workflow_snapshot, 
      ar.created_at
    FROM approval_requests ar
    LEFT JOIN main_modules mm ON ar.module_id = mm.id
    LEFT JOIN available_actions aa ON ar.action_id = aa.id
    LEFT JOIN user_mgmt um ON ar.requested_by = um.id
    WHERE ar.status = 'PENDING'
      AND (p_store_id IS NULL OR ar.store_id = p_store_id OR ar.store_id IS NULL)
      AND (p_module_id IS NULL OR ar.module_id = p_module_id)
      AND (p_action_id IS NULL OR ar.action_id = p_action_id)
      AND (p_search IS NULL OR p_search = '' OR ar.reference_number ILIKE '%' || p_search || '%')
      AND (
        p_is_super_admin OR EXISTS (
          -- Check if the current level's role matches the user's role in the workflow snapshot
          SELECT 1
          FROM jsonb_array_elements(ar.workflow_snapshot) AS step
          WHERE (step->>'level')::smallint = ar.current_level
            AND step->>'role_id' = p_role_id::text
        )
      )
  )
  SELECT 
    f.request_id,
    f.reference_number,
    f.module_name,
    f.action_name,
    f.requested_by_name,
    f.payload,
    f.current_level,
    f.status,
    f.workflow_snapshot,
    f.created_at,
    (SELECT COUNT(*) FROM filtered_requests)::bigint AS total_count
  FROM filtered_requests f
  ORDER BY f.created_at DESC
  OFFSET ((p_page - 1) * p_limit) LIMIT p_limit;
END;
$function$;

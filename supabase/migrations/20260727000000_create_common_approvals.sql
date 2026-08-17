-- Create approval_requests table
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  action_id uuid NOT NULL,
  store_id uuid NOT NULL,
  company_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  payload jsonb NOT NULL,
  current_level smallint NOT NULL DEFAULT 1,
  status varchar(50) NOT NULL DEFAULT 'PENDING',
  workflow_snapshot jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT approval_requests_pkey PRIMARY KEY (id),
  CONSTRAINT fk_approval_module FOREIGN KEY (module_id) REFERENCES main_modules(id),
  CONSTRAINT fk_approval_action FOREIGN KEY (action_id) REFERENCES available_actions(id),
  CONSTRAINT fk_approval_store FOREIGN KEY (store_id) REFERENCES store_mgmt(id),
  CONSTRAINT fk_approval_company FOREIGN KEY (company_id) REFERENCES company_master(id),
  CONSTRAINT fk_approval_user FOREIGN KEY (requested_by) REFERENCES user_mgmt(id)
);

-- Create approval_history table
CREATE TABLE IF NOT EXISTS public.approval_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL,
  level smallint NOT NULL,
  approver_id uuid NOT NULL,
  action varchar(50) NOT NULL,
  comments text,
  action_date timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT approval_history_pkey PRIMARY KEY (id),
  CONSTRAINT fk_approval_history_request FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_history_user FOREIGN KEY (approver_id) REFERENCES user_mgmt(id)
);

-- RPC for fetching pending approvals
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
    AND ar.store_id = p_store_id
    AND EXISTS (
      -- Check if the current level's role matches the user's role in the workflow snapshot
      SELECT 1
      FROM jsonb_array_elements(ar.workflow_snapshot) AS step
      WHERE (step->>'level')::smallint = ar.current_level
        AND step->>'role_id' = p_role_id::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

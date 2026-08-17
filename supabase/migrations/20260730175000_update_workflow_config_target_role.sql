CREATE OR REPLACE FUNCTION public.save_workflow_configuration_transaction(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_company_id uuid;
  v_action_by_user_id uuid;
  v_process_name text;
  v_super_admin_override boolean;
  v_full_reject_enabled boolean;

  v_modules jsonb;
  v_actions jsonb;
  v_store_ids jsonb;
  v_stores jsonb;
  v_targets jsonb;
  v_levels jsonb;

  v_module_id uuid;
  v_action_id text;
  v_store_id uuid;
  v_target_user_id uuid;
  v_level jsonb;

  v_existing_id uuid;
  v_kept_ids uuid[] := ARRAY[]::uuid[];

  v_existing_perm record;
  v_role_perm record;
  v_perm_array jsonb;
  v_action_idx integer;
  v_is_workflow_required boolean;

BEGIN

  /* =========================================================
     1. Extract Payload
     ========================================================= */

  v_company_id :=
    (p_payload->>'company_id')::uuid;

  v_action_by_user_id :=
    (p_payload->>'action_by_user_id')::uuid;

  v_process_name :=
    p_payload->>'process_name';

  v_super_admin_override :=
    COALESCE(
      (p_payload->>'super_admin_override')::boolean,
      false
    );

  v_full_reject_enabled :=
    COALESCE(
      (p_payload->>'full_reject_enabled')::boolean,
      false
    );

  v_modules :=
    COALESCE(
      p_payload->'modules',
      '[]'::jsonb
    );

  v_actions :=
    COALESCE(
      p_payload->'actions',
      '[]'::jsonb
    );

  v_store_ids :=
    COALESCE(
      p_payload->'store_ids',
      '[]'::jsonb
    );

  v_stores :=
    COALESCE(
      p_payload->'stores',
      '[]'::jsonb
    );

  v_targets :=
    COALESCE(
      p_payload->'target_users',
      '[]'::jsonb
    );

  v_levels :=
    COALESCE(
      p_payload->'levels',
      '[]'::jsonb
    );

  v_is_workflow_required :=
    jsonb_array_length(v_levels) > 0;


  /* =========================================================
     2. Insert / Update Workflow Configurations
     ========================================================= */

  FOR v_module_id IN
    SELECT value::uuid
    FROM jsonb_array_elements_text(v_modules)
  LOOP

    FOR v_action_id IN
      SELECT value
      FROM jsonb_array_elements_text(v_actions)
    LOOP


      /* =====================================================
         CASE 1:
         STORE-SPECIFIC WORKFLOW
         ===================================================== */

      IF jsonb_array_length(v_store_ids) > 0 THEN

        FOR v_store_id IN
          SELECT value::uuid
          FROM jsonb_array_elements_text(v_store_ids)
        LOOP

          FOR v_target_user_id IN
            SELECT value::uuid
            FROM jsonb_array_elements_text(v_targets)
          LOOP

            FOR v_level IN
              SELECT value
              FROM jsonb_array_elements(v_levels)
            LOOP

              /* =================================================
                 Find existing store-specific configuration
                 ================================================= */

              SELECT id
              INTO v_existing_id
              FROM workflow_config
              WHERE company_id = v_company_id
                AND module_id = v_module_id
                AND action_id = v_action_id::uuid
                AND store_id = v_store_id
                AND assigned_to = v_target_user_id
                AND level = (v_level->>'id')::smallint
                AND is_active = true
              LIMIT 1;

              /* =================================================
                 UPDATE EXISTING CONFIGURATION
                 ================================================= */

              IF v_existing_id IS NOT NULL THEN

                UPDATE workflow_config
                SET
                  role_id =
                    NULLIF(
                      v_level->>'approverRole',
                      ''
                    )::uuid,

                  target_role_id = NULL,

                  status =
                    COALESCE(
                      (v_level->>'active')::boolean,
                      true
                    ),

                  is_active = true,

                  override_enabled =
                    v_super_admin_override,

                  full_rejection_enabled =
                    v_full_reject_enabled,

                  multiple_approvers_enabled =
                    COALESCE(
                      (v_level->>'multipleApprovers')::boolean,
                      false
                    ),

                  approval_users =
                    COALESCE(
                      v_level->'approvalUsers',
                      '[]'::jsonb
                    ),

                  stores =
                    v_stores,

                  modified_by =
                    v_action_by_user_id,

                  modified_at =
                    now()

                WHERE id = v_existing_id;

                v_kept_ids :=
                  array_append(
                    v_kept_ids,
                    v_existing_id
                  );

              /* =================================================
                 INSERT NEW STORE-SPECIFIC CONFIGURATION
                 ================================================= */

              ELSE

                INSERT INTO workflow_config (
                  company_id,
                  module_id,
                  action_id,
                  store_id,
                  assigned_to,
                  level,
                  role_id,
                  target_role_id,
                  status,
                  is_active,
                  override_enabled,
                  full_rejection_enabled,
                  multiple_approvers_enabled,
                  approval_users,
                  stores,
                  created_by,
                  modified_by,
                  scope_level,
                  created_at,
                  modified_at
                )
                VALUES (
                  v_company_id,
                  v_module_id,
                  v_action_id::uuid,
                  v_store_id,
                  v_target_user_id,
                  (v_level->>'id')::smallint,
                  NULLIF(
                    v_level->>'approverRole',
                    ''
                  )::uuid,
                  NULL,
                  COALESCE(
                    (v_level->>'active')::boolean,
                    true
                  ),
                  true,
                  v_super_admin_override,
                  v_full_reject_enabled,
                  COALESCE(
                    (v_level->>'multipleApprovers')::boolean,
                    false
                  ),
                  COALESCE(
                    v_level->'approvalUsers',
                    '[]'::jsonb
                  ),
                  v_stores,
                  v_action_by_user_id,
                  v_action_by_user_id,
                  'User',
                  now(),
                  now()
                )
                RETURNING id
                INTO v_existing_id;

                v_kept_ids :=
                  array_append(
                    v_kept_ids,
                    v_existing_id
                  );

              END IF;

            END LOOP;

          END LOOP;

        END LOOP;


      /* =========================================================
         CASE 2:
         NON-STORE-SPECIFIC WORKFLOW
         ========================================================= */

      ELSE

        FOR v_target_user_id IN
          SELECT value::uuid
          FROM jsonb_array_elements_text(v_targets)
        LOOP

          FOR v_level IN
            SELECT value
            FROM jsonb_array_elements(v_levels)
          LOOP

            /* =================================================
               Find existing NON-STORE-SPECIFIC configuration
               ================================================= */

            SELECT id
            INTO v_existing_id
            FROM workflow_config
            WHERE company_id = v_company_id
              AND module_id = v_module_id
              AND action_id = v_action_id::uuid
              AND store_id IS NULL
              AND assigned_to = v_target_user_id
              AND level = (v_level->>'id')::smallint
              AND is_active = true
            LIMIT 1;


            /* =================================================
               UPDATE EXISTING NON-STORE CONFIGURATION
               ================================================= */

            IF v_existing_id IS NOT NULL THEN

              UPDATE workflow_config
              SET
                role_id =
                  NULLIF(
                    v_level->>'approverRole',
                    ''
                  )::uuid,

                target_role_id = NULL,

                status =
                  COALESCE(
                    (v_level->>'active')::boolean,
                    true
                  ),

                is_active = true,

                override_enabled =
                  v_super_admin_override,

                full_rejection_enabled =
                  v_full_reject_enabled,

                multiple_approvers_enabled =
                  COALESCE(
                    (v_level->>'multipleApprovers')::boolean,
                    false
                  ),

                approval_users =
                  COALESCE(
                    v_level->'approvalUsers',
                    '[]'::jsonb
                  ),

                stores =
                  v_stores,

                modified_by =
                  v_action_by_user_id,

                modified_at =
                  now()

              WHERE id = v_existing_id;

              v_kept_ids :=
                array_append(
                  v_kept_ids,
                  v_existing_id
                );

            /* =================================================
               INSERT NEW NON-STORE-SPECIFIC CONFIGURATION
               ================================================= */

            ELSE

              INSERT INTO workflow_config (
                company_id,
                module_id,
                action_id,
                store_id,
                assigned_to,
                level,
                role_id,
                target_role_id,
                status,
                is_active,
                override_enabled,
                full_rejection_enabled,
                multiple_approvers_enabled,
                approval_users,
                stores,
                created_by,
                modified_by,
                scope_level,
                created_at,
                modified_at
              )
              VALUES (
                v_company_id,
                v_module_id,
                v_action_id::uuid,
                NULL,
                v_target_user_id,
                (v_level->>'id')::smallint,
                NULLIF(
                  v_level->>'approverRole',
                  ''
                )::uuid,
                NULL,
                COALESCE(
                  (v_level->>'active')::boolean,
                  true
                ),
                true,
                v_super_admin_override,
                v_full_reject_enabled,
                COALESCE(
                  (v_level->>'multipleApprovers')::boolean,
                  false
                ),
                COALESCE(
                  v_level->'approvalUsers',
                  '[]'::jsonb
                ),
                v_stores,
                v_action_by_user_id,
                v_action_by_user_id,
                'User',
                now(),
                now()
              )
              RETURNING id
              INTO v_existing_id;

              v_kept_ids :=
                array_append(
                  v_kept_ids,
                  v_existing_id
                );

            END IF;

          END LOOP;

        END LOOP;

      END IF;

    END LOOP;

  END LOOP;


  /* =========================================================
     3. Soft Delete Old Configurations
     ========================================================= */

  UPDATE workflow_config
  SET
    is_active = false,
    modified_by = v_action_by_user_id,
    modified_at = now()
  WHERE company_id = v_company_id
    AND is_active = true
    AND module_id IN (
      SELECT value::uuid
      FROM jsonb_array_elements_text(v_modules)
    )
    AND action_id::text IN (
      SELECT value
      FROM jsonb_array_elements_text(v_actions)
    )
    AND assigned_to IN (
      SELECT value::uuid
      FROM jsonb_array_elements_text(v_targets)
    )
    AND (
      (
        jsonb_array_length(v_store_ids) > 0
        AND store_id IN (
          SELECT value::uuid
          FROM jsonb_array_elements_text(v_store_ids)
        )
      )
      OR
      (
        jsonb_array_length(v_store_ids) = 0
        AND store_id IS NULL
      )
    )
    AND NOT (
      id = ANY(v_kept_ids)
    );


  /* =========================================================
     4. System Log
     ========================================================= */

  INSERT INTO system_log (
    company_id,
    transaction_date,
    module,
    scope,
    key,
    log,
    action_by,
    created_at
  )
  VALUES (
    v_company_id,
    now(),
    'Workflow Configuration',
    'Edit',
    '',
    'Workflow configuration for ' || v_process_name || ' updated.',
    v_action_by_user_id,
    now()
  );


  /* =========================================================
     5. Update module_permissions
     ========================================================= */

  FOR v_target_user_id IN
    SELECT value::uuid
    FROM jsonb_array_elements_text(v_targets)
  LOOP

    FOR v_module_id IN
      SELECT value::uuid
      FROM jsonb_array_elements_text(v_modules)
    LOOP

      SELECT *
      INTO v_existing_perm
      FROM module_permissions
      WHERE company_id = v_company_id
        AND user_id = v_target_user_id
        AND module_id = v_module_id
      LIMIT 1;

      IF FOUND THEN

        v_perm_array :=
          COALESCE(
            v_existing_perm.permissions,
            '[]'::jsonb
          );

        FOR v_action_id IN
          SELECT value
          FROM jsonb_array_elements_text(v_actions)
        LOOP

          v_action_idx := (
            SELECT idx - 1
            FROM jsonb_array_elements(v_perm_array)
            WITH ORDINALITY arr(elem, idx)
            WHERE elem->>'action_id' = v_action_id
            LIMIT 1
          );

          IF v_action_idx IS NOT NULL THEN

            v_perm_array :=
              jsonb_set(
                v_perm_array,
                ARRAY[
                  v_action_idx::text,
                  'requiredworkflow'
                ],
                to_jsonb(
                  v_is_workflow_required
                )
              );

          ELSE

            v_perm_array :=
              v_perm_array
              ||
              jsonb_build_array(
                jsonb_build_object(
                  'action_id',
                  v_action_id,
                  'isAllowed',
                  true,
                  'requiredworkflow',
                  v_is_workflow_required
                )
              );

          END IF;

        END LOOP;

        UPDATE module_permissions
        SET
          permissions = v_perm_array
        WHERE id = v_existing_perm.id;

      ELSE

        SELECT *
        INTO v_role_perm
        FROM module_permissions
        WHERE company_id = v_company_id
          AND module_id = v_module_id
          AND role_id = (
            SELECT role_id
            FROM user_mgmt
            WHERE id = v_target_user_id
          )
          AND user_id IS NULL
        LIMIT 1;

        v_perm_array :=
          COALESCE(
            v_role_perm.permissions,
            '[]'::jsonb
          );

        FOR v_action_id IN
          SELECT value
          FROM jsonb_array_elements_text(v_actions)
        LOOP

          v_action_idx := (
            SELECT idx - 1
            FROM jsonb_array_elements(v_perm_array)
            WITH ORDINALITY arr(elem, idx)
            WHERE elem->>'action_id' = v_action_id
            LIMIT 1
          );

          IF v_action_idx IS NOT NULL THEN

            v_perm_array :=
              jsonb_set(
                v_perm_array,
                ARRAY[
                  v_action_idx::text,
                  'requiredworkflow'
                ],
                to_jsonb(
                  v_is_workflow_required
                )
              );

          ELSE

            v_perm_array :=
              v_perm_array
              ||
              jsonb_build_array(
                jsonb_build_object(
                  'action_id',
                  v_action_id,
                  'isAllowed',
                  true,
                  'requiredworkflow',
                  v_is_workflow_required
                )
              );

          END IF;

        END LOOP;

        INSERT INTO module_permissions (
          company_id,
          role_id,
          user_id,
          module_id,
          parentmodule_id,
          permissions,
          submodule_permissions
        )
        VALUES (
          v_company_id,
          (
            SELECT role_id
            FROM user_mgmt
            WHERE id = v_target_user_id
          ),
          v_target_user_id,
          v_module_id,
          (
            SELECT parent_id
            FROM main_modules
            WHERE id = v_module_id
          ),
          v_perm_array,
          COALESCE(
            v_role_perm.submodule_permissions,
            '[]'::jsonb
          )
        );

      END IF;

    END LOOP;

  END LOOP;


  /* =========================================================
     6. Success Response
     ========================================================= */

  RETURN jsonb_build_object(
    'success',
    true
  );

EXCEPTION
  WHEN OTHERS THEN

    RETURN jsonb_build_object(
      'success',
      false,
      'error',
      SQLERRM
    );

END;
$function$

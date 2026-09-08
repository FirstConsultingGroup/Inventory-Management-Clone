import { supabase } from '@/Utils/types/supabaseClient';

export const APPROVAL_ROUTES: Record<string, string> = {
    'User Management': '/dashboard/users/view',
    'Users': '/dashboard/users/view',
    'Item Master': '/dashboard/item-master/view',
    'Department Master': '/dashboard/department-master/view',
    'Role Master': '/dashboard/role-master/view',
    'Supplier Management': '/dashboard/supplier/view',
    'Suppliers': '/dashboard/supplier/view',
    'Item Configurator': '/dashboard/itemConfig/view',
    'Store Management': '/dashboard/store/view',
    'Stores': '/dashboard/store/view',
    'Purchase Requisitions': '/dashboard/purchaseRequisition/view',
    'Purchase Orders': '/dashboard/purchaseOrderView',
    'Purchase Order Management': '/dashboard/purchaseOrderView',
    'Purchase Returns': '/dashboard/return-form/view',
    'Returns Management': '/dashboard/return-form/view',
    'Returns Requests': '/dashboard/return-form/view',
    'Sales Returns': '/dashboard/SalesReturnForm/view',
    'Customer Management': '/dashboard/customer-management/view',
    'Customers': '/dashboard/customer-management/view',
    'Category Master': '/dashboard/category-master/view',
    'Location Master': '/dashboard/location-master/view',
    'Sales Invoice': '/dashboard/invoice/view',
    'Sales Invoices': '/dashboard/invoice/view',
    'Manage Modules': '/dashboard/module-management/view',
    'Manage Module': '/dashboard/module-management/view',
    'Quotations': '/dashboard/Quotation/view',
};

/**
 * Helper to get the correct navigation path for viewing an approval document
 */
export const getApprovalViewPath = (moduleName: string, entityId: string, requestId?: string): string | null => {
    const basePath = APPROVAL_ROUTES[moduleName];
    if (!basePath) return null;
    
    // For legacy support: if entityId is not provided, fallback to the old pending route format.
    if (!entityId) {
        return `${basePath}/pending?request_id=${requestId}`;
    }
    
    if (requestId) {
        return `${basePath}/${entityId}?request_id=${requestId}`;
    }
    
    return `${basePath}/${entityId}`;
};

export const APPROVAL_EDIT_ROUTES: Record<string, string> = {
    'User Management': '/dashboard/users/edit',
    'Users': '/dashboard/users/edit',
    'Item Master': '/dashboard/item-master/edit',
    'Department Master': '/dashboard/department-master/edit',
    'Role Master': '/dashboard/role-master/edit',
    'Supplier Management': '/dashboard/supplier/edit',
    'Suppliers': '/dashboard/supplier/edit',
    'Purchase Requisitions': '/dashboard/purchaseRequisitionForm/edit',
    'Purchase Orders': '/dashboard/purchaseOrderForm/edit', 
    'Purchase Order Management': '/dashboard/purchaseOrderForm/edit',
    'Purchase Returns': '/dashboard/return-form/edit',
    'Returns Management': '/dashboard/return-form/edit',
    'Returns Requests': '/dashboard/return-form/edit',
    'Sales Returns': '/dashboard/SalesReturnForm/edit',
    'Customer Management': '/dashboard/customer-management/edit',
    'Customers': '/dashboard/customer-management/edit',
    'Category Master': '/dashboard/category-master/edit',
    'Item Configurator': '/dashboard/itemConfig/edit',
    'Manage Modules': '/dashboard/module-management/edit',
    'Manage Module': '/dashboard/module-management/edit',
    'Store Management': '/dashboard/store/edit',
    'Stores': '/dashboard/store/edit',
    'Location Master': '/dashboard/location-master/edit',
    'Sales Invoice': '/dashboard/invoice/edit',
    'Sales Invoices': '/dashboard/invoice/edit',
    'Quotations': '/dashboard/QuotationForm/edit',
};

/**
 * Helper to get the correct navigation path for editing a rejected draft document
 */
export const getApprovalEditPath = (moduleName: string, entityId: string, requestId?: string): string | null => {
    const basePath = APPROVAL_EDIT_ROUTES[moduleName];
    if (!basePath) return null;

    if (!entityId) {
        return `${basePath}/pending?draft_correction=true&request_id=${requestId}`;
    }

    return `${basePath}/${entityId}?draft_correction=true&request_id=${requestId}`;
};

/**
 * Helper to handle navigation to the edit page for a record.
 * If the record is a DRAFT (e.g. ADD_PENDING or pending approval),
 * it queries approval_requests to find the active request_id and navigates
 * to `${basePath}/${entityId}?draft_correction=true&request_id=${requestId}`.
 * Otherwise, it navigates to the standard edit path `${basePath}/${entityId}`.
 */
export const navigateToEdit = async (
    navigate: (path: string, options?: any) => void,
    moduleName: string,
    entityId: string,
    approvalStatus?: string | null,
    pendingAction?: string | null,
    navigationOptions?: any
) => {
    const basePath = APPROVAL_EDIT_ROUTES[moduleName];
    if (!basePath) return;

    const isDraft = approvalStatus === 'DRAFT' || pendingAction === 'ADD_PENDING' || pendingAction === 'UPDATE_PENDING';

    if (isDraft) {
        try {
            const { data, error } = await supabase
                .from('approval_requests')
                .select('id')
                .eq('entity_id', entityId)
                .not('status', 'in', '("Approved","Cancelled","Closed","APPROVED","CANCELLED","CLOSED")')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data?.id) {
                navigate(`${basePath}/${entityId}?draft_correction=true&request_id=${data.id}`, navigationOptions);
                return;
            }
        } catch (err) {
            console.error('Error finding approval request for draft edit:', err);
        }

        // Fallback with draft_correction=true if request_id query failed
        navigate(`${basePath}/${entityId}?draft_correction=true`, navigationOptions);
        return;
    }

    // Normal active/approved record edit
    navigate(`${basePath}/${entityId}`, navigationOptions);
};
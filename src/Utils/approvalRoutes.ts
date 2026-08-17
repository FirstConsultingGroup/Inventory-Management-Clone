export const APPROVAL_ROUTES: Record<string, string> = {
    'User Management': '/dashboard/users/view/pending',
    'Users': '/dashboard/users/view/pending',
    'Item Master': '/dashboard/item-master/view/pending',
    'Department Master': '/dashboard/department-master/view/pending',
    'Role Master': '/dashboard/role-master/view/pending',
    'Supplier Management': '/dashboard/supplier/view/pending',
    'Suppliers': '/dashboard/supplier/view/pending',
    // 'Item Configurator': '/dashboard/itemConfigurator/view/pending', // No view page available yet
    // 'Store Management': '/dashboard/store/view/pending',
    // 'Stores': '/dashboard/store/view/pending',
    'Purchase Requisitions': '/dashboard/purchaseRequisition/view/pending',
    'Purchase Orders': '/dashboard/purchaseOrderView/pending',
    'Purchase Order Management': '/dashboard/purchaseOrderView/pending',
    'Purchase Returns': '/dashboard/return-form/view/pending',
    'Returns Management': '/dashboard/return-form/view/pending',
    'Returns Requests': '/dashboard/return-form/view/pending',
    'Sales Returns': '/dashboard/SalesReturnForm/view/pending',
    'Customer Management': '/dashboard/customer-management/view/pending',
    'Customers': '/dashboard/customer-management/view/pending',
    'Category Master': '/dashboard/category-master/view/pending',
    'Location Master': '/dashboard/location-master/view/pending',
    'Sales Invoice': '/dashboard/invoice/view/pending',
    'Sales Invoices': '/dashboard/invoice/view/pending',
    // 'Manage Module': '/dashboard/module-management',
    'Quotations': '/dashboard/Quotation/view/pending',
};

/**
 * Helper to get the correct navigation path for viewing an approval document
 */
export const getApprovalViewPath = (moduleName: string, requestId: string): string | null => {
    const basePath = APPROVAL_ROUTES[moduleName];
    if (!basePath) return null;
    return `${basePath}?request_id=${requestId}`;
};

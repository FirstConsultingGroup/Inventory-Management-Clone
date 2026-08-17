import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { ModuleKey } from '@/constants/permissions';
import { Login } from '@/pages/auth/login';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { InventoryDashboard } from '@/pages/dashboard/inventory-dashboard';
import { UsersManagement } from '@/pages/user/list/users';
import { UserForm } from '@/pages/user/config/user-form';
import { Inventory } from '@/pages/inventory/list/inventory';
import { ItemConfigurator } from '@/pages/management/itemManagement/config/item-configurator';
import WarehouseManagement from '@/pages/management/WarehouseManagement';
import Notifications from '@/pages/Notifications/notifications';
import UserProfile from '@/pages/Profile/user-profile';
import SalesInvoiceList from '@/pages/invocie/list/InvoiceManagement';
import InvoiceView from '@/pages/invocie/config/InvoiceView';
import InvoiceEdit from '@/pages/invocie/config/InvoiceEdit';
import Reports from '@/pages/Reports/Reports';
import ItemManagement from '@/pages/management/itemManagement/list/ItemManagement';
import SupplierManagement from '@/pages/management/supplierManagement/list/SupplierManagement';
import ItemConfigForm from '@/pages/management/itemManagement/config/ItemConfigForm';
import AddStoreForm from '@/pages/management/storeManagement/config/AddStoreForm';
import SupplierForm from '@/pages/management/supplierManagement/config/SupplierForm';
import { StoreManagement } from '@/pages/management/storeManagement/list/StoreManagement';
import InventoryForm from '@/pages/inventory/config/inventory-form';
import InventoryManagement from '@/pages/management/inventoryManagement/list/InventoryManagement';
import InventoryItemForm from '@/pages/management/inventoryManagement/config/InventoryItemForm';
import PurchaseOrderView from '@/pages/common/PurchaseOrderView';
import ReturnRequest from '@/pages/ReturnRequest/list/ReturnRequest';
import ReturnEligiblePOs from '@/pages/ReturnRequest/ReturnEligiblePOs';
import PrintPreview from '@/pages/Reports/PrintPreview';
import ReturnForm from '@/pages/ReturnRequest/config/ReturnForm';
import CompanyAdministration from '@/pages/administration/CompanyAdministration';
import NotificationForm from '@/pages/Notifications/config/NotificationForm';
import { CategoryManagement } from '@/pages/category/list/CategoryManagement';
import CategoryForm from '@/pages/category/config/CategoryForm';
import AuditTrial from '@/pages/Audit/auditTrial';
import CustomerForm from '@/pages/customer/config/CustomerForm';
import { CustomerManagement } from '@/pages/customer/list/CustomerManagement';
import CustomerView from '@/pages/customer/config/CustomerView';
import NotFoundPage from '@/pages/alert/NotFoundPage';
import { RoleManagement } from '@/pages/management/roleManagement/RoleManagement';
import AuthRedirectPage from '@/pages/auth/authRedirect';
import PurchaseReturnRequests from '@/pages/purchaseReturnRequest/PurchaseReturnRequests';
import PurchaseReturnView from '@/pages/purchaseReturnRequest/PurchaseReturnView';
import BillingListingPage from '@/pages/billing/list/BillingManagement';
import BillingForm from '@/pages/billing/config/BillingForm';
import PurchaseRequisitions from '@/pages/PurchaseRequisitions/list/PurchaseRequisitions';
import PurchaseRequisitionForm from '@/pages/PurchaseRequisitions/config/PurchaseRequisitionForm';
import PurchaseRequisitionApprovals from '@/pages/PurchaseReqApproval/PurchaseReqApproval';
import PurchaseReqApprovalsView from '@/pages/PurchaseReqApproval/PurchaseReqApprovalView';
import SalesReturnForm from '@/pages/SalesReturn/config/SalesReturnForm';
import SalesReturns from '@/pages/SalesReturn/list/SalesReturns';
import SalesReturnApprovals from '@/pages/SalesReturnApproval/SalesReturnApproval';
import { LocationManagement } from '@/pages/management/locationManagement/list/LocationManagement';
import LocationForm from '@/pages/management/locationManagement/config/LocationForm';
import { DepartmentManagement } from '@/pages/department/list/Department';
import DepartmentForm from '@/pages/department/config/DepartmentForm';
import ProcurementOverview from '@/pages/dashboard/ProcurementOverview';
import SalesReturnApprovalView from '@/pages/SalesReturnApproval/Salesreturnapprovalview';
import SalesOverview from '@/pages/dashboard/SalesOverview';
import { RoleMaster } from '@/pages/role/list/Role';
import RoleForm from '@/pages/role/config/RoleForm';
import { ModulesList } from '@/pages/ModuleManagement/ModulesList';
import { AddModule } from '@/pages/ModuleManagement/AddModule';
import { elements } from 'chart.js';
import ApprovalProcess from '@/pages/ApprovalProcess/ApprovalProcess';
import ApprovalHistory from '@/pages/ApprovalProcess/ApprovalHistory';

// Define routes with their corresponding ModuleKey for permission checks
const protectedRoutes = [
  {
    path: '',
    element: <InventoryDashboard />,
    module: 'Inventory Dashboard' as ModuleKey,
  },
  {
    path: 'sales',
    element: <SalesOverview />,
    module: 'Sales Dashboard' as ModuleKey,
  },
  {
    path: 'users',
    element: <UsersManagement />,
    module: 'Users' as ModuleKey,
  },
  {
    path: 'users/add',
    element: <UserForm />,
    module: 'Users' as ModuleKey,
    action:'Add'
  },
  {
    path: 'users/edit/:id',
    element: <UserForm />,
    module: 'Users' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'users/view/:id',
    element: <UserForm />,
    module: 'Users' as ModuleKey,
    action:'View'
  },
  {
    path: 'role-management',
    element: <RoleManagement />,
    module: 'Users' as ModuleKey,
  },
  {
    path: 'item-master',
    element: <Inventory />,
    module: 'Item Master' as ModuleKey,
  },
  {
    path: 'item-master/add',
    element: <InventoryForm />,
    module: 'Item Master' as ModuleKey,
    action:'Add'
  },
  {
    path: 'item-master/edit/:id',
    element: <InventoryForm />,
    module: 'Item Master' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'item-master/view/:id',
    element: <InventoryForm />,
    module: 'Item Master' as ModuleKey,
    action:'View'
  },
  {
    path: 'department-master',
    element: <DepartmentManagement />,
    module: 'Department Management' as ModuleKey,
  },
  {
    path: 'department-master/add',
    element: <DepartmentForm />,
    module: 'Department Management' as ModuleKey,
    action:'Add'
  },
  {
    path: 'department-master/edit/:id',
    element: <DepartmentForm />,
    module: 'Department Management' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'department-master/view/:id',
    element: <DepartmentForm />,
    module: 'Department Management' as ModuleKey,
    action:'View'
  },
  {
    path: 'role-master',
    element: <RoleMaster />,
    module: 'Role Master' as ModuleKey,
  },
  {
    path: 'role-master/add',
    element: <RoleForm />,
    module: 'Role Master' as ModuleKey,
    action:'Add'
  },
  {
    path: 'role-master/edit/:id',
    element: <RoleForm />,
    module: 'Role Master' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'role-master/view/:id',
    element: <RoleForm />,
    module: 'Role Master' as ModuleKey,
    action:'View'
  },
  {
    path: 'supplierManagement',
    element: <SupplierManagement />,
    module: 'Supplier Management' as ModuleKey,
  },
  {
    path: 'supplier/add',
    element: <SupplierForm />,
    module: 'Supplier Management' as ModuleKey,
    action:'Add'
  },
  {
    path: 'supplier/edit/:id',
    element: <SupplierForm />,
    module: 'Supplier Management' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'supplier/view/:id',
    element: <SupplierForm />,
    module: 'Supplier Management' as ModuleKey,
    action:'View'
  },
  {
    path: 'itemConfigurator',
    element: <ItemConfigurator />,
    module: 'Item Configurator' as ModuleKey,
  },
  {
    path: 'itemConfig/add',
    element: <ItemConfigForm />,
    module: 'Item Configurator' as ModuleKey,
    action:'Add'
  },
  {
    path: 'itemConfig/edit/:id',
    element: <ItemConfigForm />,
    module: 'Item Configurator' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'storeManagement',
    element: <StoreManagement />,
    module: 'Store Management' as ModuleKey,
  },
  {
    path: 'store/add',
    element: <AddStoreForm />,
    module: 'Store Management' as ModuleKey,
    action:'Add'
  },
  {
    path: 'store/edit/:id',
    element: <AddStoreForm />,
    module: 'Store Management' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'warehouseManagement',
    element: <WarehouseManagement />,
    module: 'Inventory Management' as ModuleKey,
  },
  {
    path: 'items',
    element: <ItemManagement />,
    module: 'Item Master' as ModuleKey,
  },
  {
    path: 'invoice',
    element: <SalesInvoiceList />,
    module: 'Sales Invoice' as ModuleKey,
  },
  {
    path: 'invoice/view/:id',
    element: <InvoiceView />,
    module: 'Sales Invoice' as ModuleKey,
    action:'View'
  },
  {
    path: 'invoice/edit/:id',
    element: <InvoiceEdit />,
    module: 'Sales Invoice' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'invoice/add',
    element: <InvoiceEdit />,
    module: 'Sales Invoice' as ModuleKey,
    action:'Add'
  },
  {
    path: 'billing',
    element: <BillingListingPage />,
    module: 'Billing' as ModuleKey,
  },
  {
    path: 'billing/edit/:id',
    element: <BillingForm />,
    module: 'Billing' as ModuleKey,
  },
  {
    path: 'billing/add',
    element: <BillingForm />,
    module: 'Billing' as ModuleKey,
  },
  {
    path: 'reports',
    element: <Reports />,
    module: 'Reports' as ModuleKey,
  },
  {
    path: 'report/preview',
    element: <PrintPreview />,
    module: 'Reports' as ModuleKey,
  },
  {
    path: 'purchaseOrderView/:id',
    element: <PurchaseOrderView />,
    module: 'Purchase Order Management' as ModuleKey,
    action:"View" 
  },

  {
    path: 'inventoryManagement',
    element: <InventoryManagement />,
    module: 'Inventory Management' as ModuleKey,
  },
  {
    path: 'inventory/add',
    element: <InventoryItemForm />,
    module: 'Inventory Management' as ModuleKey,
  },
  {
    path: 'inventory/edit/:id',
    element: <InventoryItemForm />,
    module: 'Inventory Management' as ModuleKey,
  },
  {
    path: 'purchase-order-return-approvals',
    element: <PurchaseReturnRequests />,
    module: 'Purchase Return Requests' as ModuleKey,
  },
  {
    path: "purchase-return-view/:id",
    element: <PurchaseReturnView />,
    module: "Purchase Return Requests" as ModuleKey,
  },
  {
    path: 'return-request',
    element: <ReturnRequest />,
    module: 'Returns Management' as ModuleKey,
  },
  {
    path: 'return-form/add',
    element: <ReturnForm />,
    module: 'Returns Management' as ModuleKey,
    action:'Add'
  },
  {
    path: 'return-form/edit/:id',
    element: <ReturnForm />,
    module: 'Returns Management' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'return-form/view/:id',
    element: <ReturnForm />,
    module: 'Returns Management' as ModuleKey,
    action:'View'
  },
  {
    path: 'return-eligible-purchase-orders',
    element: <ReturnEligiblePOs />,
    module: 'Returns Eligible' as ModuleKey,
  },
   {
    path: 'return-eligible-view/:id',
    element: <PurchaseOrderView />,
    module: 'Returns Eligible' as ModuleKey,
    action:'View'
  },
  {
    path: 'administration',
    element: <CompanyAdministration />,
    module: 'Administration' as ModuleKey,
  },
  {
    path: 'category-master',
    element: <CategoryManagement />,
    module: 'Category Master' as ModuleKey,
  },
  {
    path: 'category-master/add',
    element: <CategoryForm />,
    module: 'Category Master' as ModuleKey,
    action: 'Add',
  },
  {
    path: 'category-master/edit/:id',
    element: <CategoryForm />,
    module: 'Category Master' as ModuleKey,
    action: 'Edit',
  },
  {
    path: 'category-master/view/:id',
    element: <CategoryForm />,
    module: 'Category Master' as ModuleKey,
    action: 'View',
  },
  {
    path: 'audit-trial',
    element: <AuditTrial />,
    module: 'Audit Trail' as ModuleKey,
  },
  {
    path: 'customer-management',
    element: <CustomerManagement />,
    module: 'Customer Master' as ModuleKey,
  },
  {
    path: 'customer-management/add',
    element: <CustomerForm />,
    module: 'Customer Master' as ModuleKey,
    action:'Add'
  },
  {
    path: 'customer-management/edit/:id',
    element: <CustomerForm />,
    module: 'Customer Master' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'customer-management/view/:id',
    element: <CustomerView />,
    module: 'Customer Master' as ModuleKey,
    action:'View'
  },
  {
    path: 'procurement',
    element: <ProcurementOverview />,
    module: 'Procurement Dashboard' as ModuleKey,
  },
  {
    path: 'purchaseRequisitions',
    element: <PurchaseRequisitions />,
    module: 'Purchase Requisitions' as ModuleKey,
  },
  {
    path: 'purchaseRequisitionForm/create',
    element: <PurchaseRequisitionForm />,
    module: 'Purchase Requisitions' as ModuleKey,
    action:'Add'
  },
  {
    path: 'purchaseRequisitionForm/edit/:id',
    element: <PurchaseRequisitionForm />,
    module: 'Purchase Requisitions' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'purchaseRequisition/view/:id',
    element: <PurchaseRequisitionForm />,
    module: 'Purchase Requisitions' as ModuleKey,
    action:'View'
  },
  {
    path: 'purchaseRequisition/view-approvals/:id',
    element: <PurchaseReqApprovalsView />,
    module: 'Purchase Requisitions' as ModuleKey,
    action:'View Approvals'
  },
  {
    path: 'purchaseRequisitionApproval',
    element: <PurchaseRequisitionApprovals />,
    module: 'Purchase Requisition Approvals' as ModuleKey,
  },
  {
    path: 'purchaseReqApprovalView/:id',
    element: <PurchaseReqApprovalsView />,
    module: 'Purchase Requisition Approvals' as ModuleKey,
  },
  {
    path: 'SalesReturnForm/create',
    element: <SalesReturnForm />,
    module: 'Sales Returns' as ModuleKey,
    action:'Add'
  },
  {
    path: 'SalesReturnForm/edit/:id',
    element: <SalesReturnForm />,
    module: 'Sales Returns' as ModuleKey,
    action:'Edit'
  },
  {
    path: 'salesReturnApprovalView/:id',
    element: <SalesReturnApprovalView />,
    module: 'Sales Returns' as ModuleKey,
    action:'View Approvals'
  },
  {
    path: 'SalesReturnForm/view/:id',
    element: <SalesReturnForm />,
    module: 'Sales Returns' as ModuleKey,
    action:'View'
  },
  {
    path: 'SalesReturns',
    element: <SalesReturns />,
    module: 'Sales Returns' as ModuleKey,
  },
  {
    path: 'SalesReturnApprovals',
    element: <SalesReturnApprovals />,
    module: 'Sales Return Approvals' as ModuleKey,
  },
   {
    path: 'SalesReturnApproval/view/:id',
    element: <SalesReturnApprovalView />,
    module: 'Sales Return Approvals' as ModuleKey,
  },
  {
    path: 'location-master',
    element: <LocationManagement />,
    module: 'Location Master' as ModuleKey,
  },
  {
    path: 'location-master/add',
    element: <LocationForm />,
    module: 'Location Master' as ModuleKey,
    action: 'Add',
  },
  {
    path: 'location-master/edit/:id',
    element: <LocationForm />,
    module: 'Location Master' as ModuleKey,
    action: 'Edit',
  },
  {
    path: 'location-master/view/:id',
    element: <LocationForm />,
    module: 'Location Master' as ModuleKey,
    action: 'View',
  },
  {
    path: 'module-management',
    element: <ModulesList />,
    module: 'Manage Modules' as ModuleKey,
  },
    {
    path: 'module-management/add',
    element: <AddModule />,
    module: 'Manage Modules' as ModuleKey,
    action:'Add'
  },
    {
    path: 'module-management/edit/:id',
    element: <AddModule isEditing={true} />,
    module: 'Manage Modules' as ModuleKey,
    action:'Edit'
  },
];

// Unprotected routes (accessible to all authenticated users)
const unprotectedRoutes = [
  {
    path: 'notifications',
    element: <Notifications />,
  },
  {
    path: 'notifications/create',
    element: <NotificationForm />,
  },
  {
    path: 'userProfile',
    element: <UserProfile />,
  },
  {
    path: 'auth-redirect',
    element: <AuthRedirectPage />,
  },
  {
    path: 'approval-process',
    element: <ApprovalProcess/>
  },
  {
    path: 'approval-history/:id',
    element: <ApprovalHistory/>
  }
];

// Create the router
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      ...protectedRoutes.map(route => ({
        path: route.path,
        element: <ProtectedRoute module={route.module} action={(route as any).action} />,
        children: [{ index: true, element: route.element }],
      })),
      ...unprotectedRoutes.map(route => ({
        path: route.path,
        element: route.element,
      })),
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
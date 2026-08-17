// Re-export types from the hook for backward compatibility
import type { ProcurementRequisition, ReorderItem } from '@/hooks/useProcurement';
export type { ProcurementRequisition as Requisition, ReorderItem } from '@/hooks/useProcurement';

// Helper to get date X months ago for mock generation
const getDateAgo = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    // Randomize day
    d.setDate(Math.floor(Math.random() * 28) + 1);
    return d.toISOString();
};

export const MOCK_REQUISITIONS: ProcurementRequisition[] = [
    { id: '1', orderNumber: 'PR-2024-001', date: new Date().toISOString(), totalItems: 5, department: 'Sales', store: 'Main Store', status: 'Approved', statusValue: 'APPROVED', type: 'Main', category: 'Sales', categoryId: '', approverUser: '', createdBy: 'John Doe' },
    { id: '2', orderNumber: 'PR-2024-002', date: getDateAgo(1), totalItems: 12, department: 'Marketing', store: 'Downtown Branch', status: 'Approved', statusValue: 'APPROVED', type: 'Main', category: 'Marketing', categoryId: '', approverUser: '', createdBy: 'Jane Smith' },
    { id: '3', orderNumber: 'PR-2024-003', date: getDateAgo(2), totalItems: 3, department: 'HR', store: 'HQ', status: 'Approved', statusValue: 'APPROVED', type: 'Internal', category: 'HR - Internal', categoryId: '', approverUser: '', createdBy: 'Bob Johnson' },
    { id: '4', orderNumber: 'PR-2024-004', date: getDateAgo(5), totalItems: 8, department: 'Sales', store: 'Main Store', status: 'Completed', statusValue: 'CLOSED', type: 'Main', category: 'Sales', categoryId: '', approverUser: '', createdBy: 'Alice Brown' },
    { id: '5', orderNumber: 'PR-2024-005', date: getDateAgo(13), totalItems: 20, department: 'Operations', store: 'Warehouse A', status: 'Approved', statusValue: 'APPROVED', type: 'Main', category: 'Operations', categoryId: '', approverUser: '', createdBy: 'Charlie Wilson' },
    { id: '6', orderNumber: 'PR-2024-006', date: new Date().toISOString(), totalItems: 2, department: 'IT', store: 'HQ', status: 'Pending', statusValue: 'NEW', type: 'Internal', category: 'IT - Internal', categoryId: '', approverUser: 'Manager', createdBy: 'David Lee' },
    { id: '7', orderNumber: 'PR-2024-007', date: getDateAgo(0.5), totalItems: 15, department: 'Sales', store: 'Main Store', status: 'Approved', statusValue: 'APPROVED', type: 'Main', category: 'Sales', categoryId: '', approverUser: '', createdBy: 'Eva Martinez' },
    { id: '8', orderNumber: 'PR-2024-008', date: getDateAgo(1), totalItems: 7, department: 'Operations', store: 'Warehouse B', status: 'Rejected', statusValue: 'REJECTED', type: 'Main', category: 'Operations', categoryId: '', approverUser: '', createdBy: 'Frank Taylor' },
    { id: '9', orderNumber: 'PR-2024-009', date: getDateAgo(3), totalItems: 4, department: 'Marketing', store: 'Downtown Branch', status: 'Approved', statusValue: 'APPROVED', type: 'Main', category: 'Marketing', categoryId: '', approverUser: '', createdBy: 'Grace Anderson' },
    { id: '10', orderNumber: 'PR-2024-010', date: getDateAgo(0.2), totalItems: 10, department: 'IT', store: 'HQ', status: 'Approved', statusValue: 'APPROVED', type: 'Internal', category: 'IT - Internal', categoryId: '', approverUser: '', createdBy: 'Henry Thomas' },
    { id: '11', orderNumber: 'PR-2024-011', date: getDateAgo(2), totalItems: 6, department: 'Sales', store: 'Main Store', status: 'Completed', statusValue: 'CLOSED', type: 'Main', category: 'Sales', categoryId: '', approverUser: '', createdBy: 'Ivy Jackson' },
    { id: '12', orderNumber: 'PR-2024-012', date: getDateAgo(4), totalItems: 9, department: 'HR', store: 'HQ', status: 'Pending', statusValue: 'NEW', type: 'Internal', category: 'HR - Internal', categoryId: '', approverUser: 'Director', createdBy: 'Jack White' },
];

export const MOCK_REORDER_ITEMS: ReorderItem[] = [
    { id: '101', itemNumber: 'ITM-001', itemName: 'Printer Paper A4', currentStock: 20, reorderLevel: 50, isActive: true },
    { id: '102', itemNumber: 'ITM-005', itemName: 'Ballpoint Pens (Blue)', currentStock: 5, reorderLevel: 20, isActive: true },
    { id: '103', itemNumber: 'ITM-012', itemName: 'Stapler Pins', currentStock: 10, reorderLevel: 30, isActive: true, snoozeDate: getDateAgo(-0.1) }, // Snoozed for future
    { id: '104', itemNumber: 'ITM-022', itemName: 'Sticky Notes', currentStock: 2, reorderLevel: 15, isActive: true },
    { id: '105', itemNumber: 'ITM-030', itemName: 'Whiteboard Markers', currentStock: 8, reorderLevel: 10, isActive: true, snoozeDate: getDateAgo(1) }, // Past snooze
    { id: '106', itemNumber: 'ITM-045', itemName: 'HDMI Cables', currentStock: 3, reorderLevel: 10, isActive: true },
    { id: '107', itemNumber: 'ITM-050', itemName: 'Mouse Batteries (AA)', currentStock: 12, reorderLevel: 40, isActive: true },
    { id: '108', itemNumber: 'ITM-066', itemName: 'Cleaning Wipes', currentStock: 5, reorderLevel: 25, isActive: true },
];


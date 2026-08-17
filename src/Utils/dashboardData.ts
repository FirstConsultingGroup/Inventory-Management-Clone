// @ts-ignore - supabase.js file doesn't have type declarations
import { supabase } from '../lib/supabase';

// Dashboard data interfaces
export interface DashboardMetrics {
  totalItems: number;
  totalValue: number;
  totalPurchaseOrders: number;
  totalPurchaseOrderValue: number;
}

export interface CategoryStockData {
  name: string;
  stock: number;
  fill: string;
}

export interface SalesData {
  // ISO date string (YYYY-MM-DD) for the day
  day: string;
  sales: number;
}

export interface MovingItem {
  name: string;
  avgQuantity: number;
}

export interface InventoryAlert {
  itemName: string;
  currentQty: number;
  reorderLevel: number;
  maxLevel: number;
  alertType: 'low_stock' | 'excess_stock';
  severity: 'high' | 'medium' | 'low';
}

export interface DashboardData {
  metrics: DashboardMetrics;
  categoryData: CategoryStockData[];
  salesData: SalesData[];
  fastMovingItems: MovingItem[];
  slowMovingItems: MovingItem[];
  inventoryAlerts: InventoryAlert[];
}

// Color palette for categories
const categoryColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
];

/**
 * Get user data from localStorage with validation
 */
const getUserData = () => {
  const userData = localStorage.getItem('userData');
  if (!userData) {
    throw new Error('User data not found in localStorage');
  }
  
  const parsedData = JSON.parse(userData);
  
  // Validate required fields
  if (!parsedData.company_id) {
    throw new Error('Company ID not found in user data');
  }
  
  if (!parsedData.id) {
    throw new Error('User ID not found in user data');
  }
  
  return parsedData;
};

/**
 * Fetch total purchase orders count (orders with status APPROVER_COMPLETED, active=true, and matching company_id)
 */
export const fetchPurchaseOrderCount = async (): Promise<number> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get the APPROVER_COMPLETED status ID
    const { data: statusData, error: statusError } = await supabase
      .from('system_message_config')
      .select('id')
      .eq('sub_category_id', 'APPROVER_COMPLETED')
      .eq('company_id', companyId)
      .single();

    if (statusError) {
      console.warn('Could not find APPROVER_COMPLETED status, using alternative query');
      // Alternative: count purchase orders that have issued_by set (meaning they are issued)
      const { count, error } = await supabase
        .from('purchase_order')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true)
        .not('issued_by', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch purchase order count: ${error.message}`);
      }

      return count || 0;
    }

    // Count purchase orders with APPROVER_COMPLETED status
    const { count, error } = await supabase
      .from('purchase_order')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('order_status', statusData.id);

    if (error) {
      throw new Error(`Failed to fetch purchase order count: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error('Error fetching purchase order count:', error);
    throw error;
  }
};

/**
 * Fetch total purchase order value (sum of total_value for orders with status APPROVER_COMPLETED, active=true, and matching company_id)
 */
export const fetchPurchaseOrderTotalValue = async (): Promise<number> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get the APPROVER_COMPLETED status ID
    const { data: statusData, error: statusError } = await supabase
      .from('system_message_config')
      .select('id')
      .eq('sub_category_id', 'APPROVER_COMPLETED')
      .eq('company_id', companyId)
      .single();

    if (statusError) {
      console.warn('Could not find APPROVER_COMPLETED status, using alternative query');
      // Alternative: sum total_value for purchase orders that have issued_by set (meaning they are issued)
      const { data, error } = await supabase
        .from('purchase_order')
        .select('total_value')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .not('issued_by', 'is', null)
        .not('total_value', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch purchase order total value: ${error.message}`);
      }

      // Sum up all total_value fields
      const totalValue = data?.reduce((sum: number, order: any) => sum + (order.total_value || 0), 0) || 0;
      return totalValue;
    }

    // Sum total_value for purchase orders with APPROVER_COMPLETED status
    const { data, error } = await supabase
      .from('purchase_order')
      .select('total_value')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('order_status', statusData.id)
      .not('total_value', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch purchase order total value: ${error.message}`);
    }

    // Sum up all total_value fields
    const totalValue = data?.reduce((sum: number, order: any) => sum + (order.total_value || 0), 0) || 0;
    return totalValue;
  } catch (error) {
    console.error('Error fetching purchase order total value:', error);
    throw error;
  }
};

/**
 * Fetch inventory overview metrics with category type filter
 */
export const fetchInventoryOverviewMetrics = async (
  categoryFilter: 'all' | 'internal' | 'external' = 'all'
): Promise<{
  totalItems: number;
  totalValue: number;
  totalCategories: number;
  lowStockItems: number;
}> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Build the query for items based on category filter
    let itemQuery = supabase
      .from('item_mgmt')
      .select('id, category_type, reorder_level, max_level', { count: 'exact' })
      .eq('company_id', companyId)
      .eq('is_active', true);

    // Apply category type filter if not 'all'
    if (categoryFilter !== 'all') {
      itemQuery = itemQuery.eq('category_type', categoryFilter);
    }

    const { data: itemsData, count: totalItemsCount, error: itemsError } = await itemQuery;

    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    // Get inventory data for these items
    const itemIds = itemsData?.map((item: any) => item.id) || [];
    
    let totalValue = 0;
    let lowStockCount = 0;
    const categorySet = new Set<string>();

    if (itemIds.length > 0) {
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory_mgmt')
        .select(`
          item_qty,
          selling_price,
          item_mgmt!inner(
            id,
            category_id,
            category_type,
            reorder_level,
            is_active,
            company_id
          )
        `)
        .eq('company_id', companyId)
        .in('item_mgmt.id', itemIds)
        .eq('item_mgmt.is_active', true)
        .eq('item_mgmt.company_id', companyId)
        .gt('item_qty', 0);

      if (inventoryError) {
        throw new Error(`Failed to fetch inventory data: ${inventoryError.message}`);
      }

      // Calculate metrics
      const itemStockMap = new Map<string, { totalQty: number; sellingPrice: number; reorderLevel: number; categoryId: string }>();
      
      inventoryData?.forEach((item: any) => {
        if (item.item_mgmt && item.item_mgmt.is_active && item.item_mgmt.company_id === companyId) {
          const itemId = item.item_mgmt.id;
          const current = itemStockMap.get(itemId) || {
            totalQty: 0,
            sellingPrice: item.selling_price || 0,
            reorderLevel: item.item_mgmt.reorder_level || 0,
            categoryId: item.item_mgmt.category_id
          };
          
          current.totalQty += item.item_qty || 0;
          itemStockMap.set(itemId, current);

          // Track categories
          if (item.item_mgmt.category_id) {
            categorySet.add(item.item_mgmt.category_id);
          }
        }
      });

      // Calculate total value and low stock items
      itemStockMap.forEach((item: { totalQty: number; sellingPrice: number; reorderLevel: number; categoryId: string }) => {
        totalValue += item.totalQty * item.sellingPrice;
        
        // Check if item is low stock
        if (item.reorderLevel > 0 && item.totalQty <= item.reorderLevel) {
          lowStockCount++;
        }
      });
    }

    return {
      totalItems: totalItemsCount || 0,
      totalValue: Math.round(totalValue),
      totalCategories: categorySet.size,
      lowStockItems: lowStockCount
    };
  } catch (error) {
    console.error('Error fetching inventory overview metrics:', error);
    throw error;
  }
};

/**
 * Fetch total inventory metrics
 */
export const fetchInventoryMetrics = async (): Promise<DashboardMetrics> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get total active items count for the company
    const { count: totalItemsCount } = await supabase
      .from('item_mgmt')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true);

    // Get inventory with stock data - only active items and positive quantities
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory_mgmt')
      .select(`
        item_qty,
        selling_price,
        item_mgmt!inner(
          id,
          reorder_level,
          max_level,
          is_active,
          company_id
        )
      `)
      .eq('company_id', companyId)
      .eq('item_mgmt.is_active', true)
      .eq('item_mgmt.company_id', companyId)
      .gt('item_qty', 0);

    if (inventoryError) {
      throw new Error(`Failed to fetch inventory data: ${inventoryError.message}`);
    }

    // Calculate metrics
    let totalValue = 0;

    if (inventoryData) {
      // Group by item_id to get total quantities per item
      const itemStockMap = new Map<string, { totalQty: number; sellingPrice: number }>();
      
      inventoryData.forEach((item: any) => {
        // Double-check that item is active and belongs to the company
        if (item.item_mgmt && item.item_mgmt.is_active && item.item_mgmt.company_id === companyId) {
          const itemId = item.item_mgmt.id;
          const current = itemStockMap.get(itemId) || {
            totalQty: 0,
            sellingPrice: item.selling_price || 0
          };
          
          current.totalQty += item.item_qty || 0;
          itemStockMap.set(itemId, current);
        }
      });

      // Calculate total inventory value
      itemStockMap.forEach((item) => {
        totalValue += item.totalQty * item.sellingPrice;
      });
    }

    // Fetch purchase order count and total value
    const [totalPurchaseOrders, totalPurchaseOrderValue] = await Promise.all([
      fetchPurchaseOrderCount(),
      fetchPurchaseOrderTotalValue()
    ]);

    return {
      totalItems: totalItemsCount || 0,
      totalValue: Math.round(totalValue),
      totalPurchaseOrders,
      totalPurchaseOrderValue
    };
  } catch (error) {
    console.error('Error fetching inventory metrics:', error);
    throw error;
  }
};

/**
 * Fetch stock data by category with optional category type filter
 */
export const fetchCategoryStockData = async (categoryFilter: 'all' | 'internal' | 'external' = 'all'): Promise<CategoryStockData[]> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    let query = supabase
      .from('inventory_mgmt')
      .select(`
        item_qty,
        item_mgmt!inner(
          category_id,
          category_type,
          is_active,
          company_id,
          category_master!inner(
            name,
            company_id
          )
        )
      `)
      .eq('company_id', companyId)
      .eq('item_mgmt.is_active', true)
      .eq('item_mgmt.company_id', companyId)
      .eq('item_mgmt.category_master.company_id', companyId)
      .gt('item_qty', 0);

    // Apply category type filter if not 'all'
    if (categoryFilter !== 'all') {
      query = query.eq('item_mgmt.category_type', categoryFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch category data: ${error.message}`);
    }

    // Group by category
    const categoryMap = new Map<string, number>();
    
    data?.forEach((item: any) => {
      // Double-check that item and category belong to the company and are active
      if (item.item_mgmt && 
          item.item_mgmt.is_active && 
          item.item_mgmt.company_id === companyId &&
          item.item_mgmt.category_master &&
          item.item_mgmt.category_master.company_id === companyId) {
        
        const categoryName = item.item_mgmt.category_master.name || 'Uncategorized';
        const currentStock = categoryMap.get(categoryName) || 0;
        categoryMap.set(categoryName, currentStock + (item.item_qty || 0));
      }
    });

    // Convert to array with colors
    return Array.from(categoryMap.entries()).map(([name, stock], index) => ({
      name,
      stock,
      fill: categoryColors[index % categoryColors.length]
    }));
  } catch (error) {
    console.error('Error fetching category stock data:', error);
    throw error;
  }
};

/**
 * Fetch sales turnover data for the last month using a dynamic date range:
 * start = same day in the previous month (clamped to last day if previous month shorter)
 * end = today (inclusive)
 */
export const fetchSalesTurnoverData = async (): Promise<SalesData[]> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

  // Compute dynamic start (same day previous month) and end (today)
  const endDate = new Date();
  const dayOfMonth = endDate.getDate();
  const prevMonth = endDate.getMonth() - 1;
  const prevMonthYear = prevMonth < 0 ? endDate.getFullYear() - 1 : endDate.getFullYear();
  const prevMonthIndex = (prevMonth + 12) % 12;

  // Last day of the previous month
  const lastDayOfPrevMonth = new Date(prevMonthYear, prevMonthIndex + 1, 0).getDate();
  const startDay = Math.min(dayOfMonth, lastDayOfPrevMonth);
  const startDate = new Date(prevMonthYear, prevMonthIndex, startDay);

    const startIso = startDate.toISOString().split('T')[0];
    const endIso = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('sales_invoice')
      .select(`
        invoice_date,
        net_amount,
        company_id
      `)
      .eq('company_id', companyId)
      .gte('invoice_date', startIso)
      .lte('invoice_date', endIso)
      .not('net_amount', 'is', null)
      .order('invoice_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch sales data: ${error.message}`);
    }

    // Group sales by ISO date (YYYY-MM-DD)
    const dailySales = new Map<string, number>();
    data?.forEach((invoice: any) => {
      if (invoice.company_id === companyId && invoice.invoice_date && invoice.net_amount) {
        const iso = new Date(invoice.invoice_date).toISOString().split('T')[0];
        const current = dailySales.get(iso) || 0;
        dailySales.set(iso, current + (invoice.net_amount || 0));
      }
    });

    // Build continuous data for every date in the range (inclusive)
    const salesData: SalesData[] = [];
    const iterDate = new Date(startDate);
    while (iterDate <= endDate) {
      const iso = iterDate.toISOString().split('T')[0];
      salesData.push({
        day: iso,
        sales: Math.round(dailySales.get(iso) || 0)
      });
      iterDate.setDate(iterDate.getDate() + 1);
    }

    return salesData;
  } catch (error) {
    console.error('Error fetching sales turnover data:', error);
    throw error;
  }
};

/**
 * Fetch fast moving items (top 3 by inventory movement - using inventory_mgmt table) with optional category type filter
 */
export const fetchFastMovingItems = async (categoryFilter: 'all' | 'internal' | 'external' = 'all'): Promise<MovingItem[]> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get inventory data for active items
    let query = supabase
      .from('inventory_mgmt')
      .select(`
        item_qty,
        company_id,
        item_mgmt!inner(
          id,
          item_name,
          category_type,
          is_active,
          company_id,
          reorder_level,
          max_level
        )
      `)
      .eq('company_id', companyId)
      .eq('item_mgmt.is_active', true)
      .eq('item_mgmt.company_id', companyId)
      .gt('item_qty', 0);

    // Apply category type filter if not 'all'
    if (categoryFilter !== 'all') {
      query = query.eq('item_mgmt.category_type', categoryFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch fast moving items: ${error.message}`);
    }

    // Group by item and calculate movement score based on inventory levels
    const itemMovementMap = new Map<string, { 
      totalQty: number; 
      reorderLevel: number; 
      maxLevel: number;
      movementScore: number;
    }>();
    
    data?.forEach((item: any) => {
      // Double-check that item is active and belongs to the company
      if (item.item_mgmt && 
          item.item_mgmt.is_active && 
          item.item_mgmt.company_id === companyId &&
          item.company_id === companyId &&
          item.item_qty > 0) {
        
        const itemName = item.item_mgmt.item_name;
        const current = itemMovementMap.get(itemName) || {
          totalQty: 0,
          reorderLevel: item.item_mgmt.reorder_level || 0,
          maxLevel: item.item_mgmt.max_level || 0,
          movementScore: 0
        };
        
        current.totalQty += item.item_qty || 0;
        
        // Calculate movement score based on inventory position relative to reorder and max levels
        if (current.reorderLevel > 0 && current.maxLevel > 0) {
          // Higher score for items that are closer to reorder level (indicating high movement)
          const inventoryRatio = current.totalQty / current.maxLevel;
          const reorderRatio = current.reorderLevel / current.maxLevel;
          
          // Movement score: higher when inventory is closer to reorder level
          current.movementScore = Math.abs(inventoryRatio - reorderRatio);
        } else {
          // Fallback: use total quantity as movement indicator
          current.movementScore = current.totalQty;
        }
        
        itemMovementMap.set(itemName, current);
      }
    });

    // Sort by movement score and get top 3 (highest movement)
    const sortedItems = Array.from(itemMovementMap.entries())
      .map(([name, data]) => ({
        name,
        avgQuantity: Math.round(data.totalQty / 3) // Average over 3 months (simplified)
      }))
      .sort((a, b) => {
        const aScore = itemMovementMap.get(a.name)?.movementScore || 0;
        const bScore = itemMovementMap.get(b.name)?.movementScore || 0;
        return bScore - aScore; // Higher score first
      })
      .slice(0, 3);

    return sortedItems;
  } catch (error) {
    console.error('Error fetching fast moving items:', error);
    throw error;
  }
};

/**
 * Fetch slow moving items (bottom 3 by inventory movement - using inventory_mgmt table) with optional category type filter
 */
export const fetchSlowMovingItems = async (categoryFilter: 'all' | 'internal' | 'external' = 'all'): Promise<MovingItem[]> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get inventory data for active items
    let query = supabase
      .from('inventory_mgmt')
      .select(`
        item_qty,
        company_id,
        item_mgmt!inner(
          id,
          item_name,
          category_type,
          is_active,
          company_id,
          reorder_level,
          max_level
        )
      `)
      .eq('company_id', companyId)
      .eq('item_mgmt.is_active', true)
      .eq('item_mgmt.company_id', companyId)
      .gt('item_qty', 0);

    // Apply category type filter if not 'all'
    if (categoryFilter !== 'all') {
      query = query.eq('item_mgmt.category_type', categoryFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch slow moving items: ${error.message}`);
    }

    // Group by item and calculate movement score based on inventory levels
    const itemMovementMap = new Map<string, { 
      totalQty: number; 
      reorderLevel: number; 
      maxLevel: number;
      movementScore: number;
    }>();
    
    data?.forEach((item: any) => {
      // Double-check that item is active and belongs to the company
      if (item.item_mgmt && 
          item.item_mgmt.is_active && 
          item.item_mgmt.company_id === companyId &&
          item.company_id === companyId &&
          item.item_qty > 0) {
        
        const itemName = item.item_mgmt.item_name;
        const current = itemMovementMap.get(itemName) || {
          totalQty: 0,
          reorderLevel: item.item_mgmt.reorder_level || 0,
          maxLevel: item.item_mgmt.max_level || 0,
          movementScore: 0
        };
        
        current.totalQty += item.item_qty || 0;
        
        // Calculate movement score based on inventory position relative to reorder and max levels
        if (current.reorderLevel > 0 && current.maxLevel > 0) {
          // Lower score for items that are closer to max level (indicating low movement)
          const inventoryRatio = current.totalQty / current.maxLevel;
          const reorderRatio = current.reorderLevel / current.maxLevel;
          
          // Movement score: lower when inventory is closer to max level
          current.movementScore = Math.abs(inventoryRatio - reorderRatio);
        } else {
          // Fallback: use total quantity as movement indicator
          current.movementScore = current.totalQty;
        }
        
        itemMovementMap.set(itemName, current);
      }
    });

    // Sort by movement score and get bottom 3 (lowest movement)
    const sortedItems = Array.from(itemMovementMap.entries())
      .map(([name, data]) => ({
        name,
        avgQuantity: Math.round(data.totalQty / 3) // Average over 3 months (simplified)
      }))
      .sort((a, b) => {
        const aScore = itemMovementMap.get(a.name)?.movementScore || 0;
        const bScore = itemMovementMap.get(b.name)?.movementScore || 0;
        return aScore - bScore; // Lower score first
      })
      .slice(0, 3);

    return sortedItems;
  } catch (error) {
    console.error('Error fetching slow moving items:', error);
    throw error;
  }
};

/**
 * Fetch inventory alerts based on reorder level and max level
 */
export const fetchInventoryAlerts = async (): Promise<InventoryAlert[]> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get inventory data with item management details
    const { data, error } = await supabase
      .from('inventory_mgmt')
      .select(`
        item_qty,
        company_id,
        item_mgmt!inner(
          id,
          item_name,
          is_active,
          company_id,
          reorder_level,
          max_level
        )
      `)
      .eq('company_id', companyId)
      .eq('item_mgmt.is_active', true)
      .eq('item_mgmt.company_id', companyId);

    if (error) {
      throw new Error(`Failed to fetch inventory alerts: ${error.message}`);
    }

    const alerts: InventoryAlert[] = [];
    const itemAlertMap = new Map<string, { totalQty: number; reorderLevel: number; maxLevel: number }>();

    // Group by item to get total quantities
    data?.forEach((item: any) => {
      if (item.item_mgmt && 
          item.item_mgmt.is_active && 
          item.item_mgmt.company_id === companyId &&
          item.company_id === companyId) {
        
        const itemId = item.item_mgmt.id;
        const current = itemAlertMap.get(itemId) || {
          totalQty: 0,
          reorderLevel: item.item_mgmt.reorder_level || 0,
          maxLevel: item.item_mgmt.max_level || 0
        };
        
        current.totalQty += item.item_qty || 0;
        itemAlertMap.set(itemId, current);
      }
    });

    // Check for alerts
    itemAlertMap.forEach((itemData, itemId) => {
      const { totalQty, reorderLevel, maxLevel } = itemData;
      
      // Find item name
      const item = data?.find((inv: any) => inv.item_mgmt?.id === itemId);
      const itemName = item?.item_mgmt?.item_name || 'Unknown Item';

      // Low stock alert
      if (reorderLevel > 0 && totalQty <= reorderLevel) {
        const severity = totalQty === 0 ? 'high' : totalQty <= reorderLevel * 0.5 ? 'medium' : 'low';
        alerts.push({
          itemName,
          currentQty: totalQty,
          reorderLevel,
          maxLevel,
          alertType: 'low_stock',
          severity
        });
      }

      // Excess stock alert
      if (maxLevel > 0 && totalQty >= maxLevel) {
        const severity = totalQty >= maxLevel * 1.5 ? 'high' : totalQty >= maxLevel * 1.2 ? 'medium' : 'low';
        alerts.push({
          itemName,
          currentQty: totalQty,
          reorderLevel,
          maxLevel,
          alertType: 'excess_stock',
          severity
        });
      }
    });

    // Sort alerts by severity (high first) and then by alert type
    alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Low stock alerts first, then excess stock
      return a.alertType === 'low_stock' ? -1 : 1;
    });

    return alerts;
  } catch (error) {
    console.error('Error fetching inventory alerts:', error);
    throw error;
  }
};

/**
 * Fetch sales by category data
 */
export const fetchSalesByCategory = async (): Promise<{ name: string; value: number; fill: string }[]> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get sales invoice items with category information
    const { data, error } = await supabase
      .from('sales_invoice_items')
      .select(`
        quantity,
        unit_price,
        sales_invoice!inner(
          company_id,
          invoice_date
        ),
        item_mgmt!inner(
          category_id,
          is_active,
          company_id,
          category_master!inner(
            name,
            company_id
          )
        )
      `)
      .eq('sales_invoice.company_id', companyId)
      .eq('item_mgmt.is_active', true)
      .eq('item_mgmt.company_id', companyId)
      .eq('item_mgmt.category_master.company_id', companyId);

    if (error) {
      throw new Error(`Failed to fetch sales by category: ${error.message}`);
    }

    // Group by category and calculate total sales
    const categoryMap = new Map<string, number>();
    
    data?.forEach((item: any) => {
      if (item.item_mgmt?.category_master?.name) {
        const categoryName = item.item_mgmt.category_master.name;
        const salesValue = (item.quantity || 0) * (item.unit_price || 0);
        const current = categoryMap.get(categoryName) || 0;
        categoryMap.set(categoryName, current + salesValue);
      }
    });

    // Convert to array with colors
    return Array.from(categoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value: Math.round(value),
        fill: categoryColors[index % categoryColors.length]
      }))
      .sort((a, b) => b.value - a.value);
  } catch (error) {
    console.error('Error fetching sales by category:', error);
    throw error;
  }
};

/**
 * Fetch top selling items
 */
export const fetchTopSellingItems = async (limit: number = 10): Promise<{ name: string; sales: number; quantity: number }[]> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get sales invoice items
    const { data, error } = await supabase
      .from('sales_invoice_items')
      .select(`
        quantity,
        unit_price,
        sales_invoice!inner(
          company_id
        ),
        item_mgmt!inner(
          item_name,
          is_active,
          company_id
        )
      `)
      .eq('sales_invoice.company_id', companyId)
      .eq('item_mgmt.is_active', true)
      .eq('item_mgmt.company_id', companyId);

    if (error) {
      throw new Error(`Failed to fetch top selling items: ${error.message}`);
    }

    // Group by item and calculate totals
    const itemMap = new Map<string, { sales: number; quantity: number }>();
    
    data?.forEach((item: any) => {
      if (item.item_mgmt?.item_name) {
        const itemName = item.item_mgmt.item_name;
        const salesValue = (item.quantity || 0) * (item.unit_price || 0);
        const current = itemMap.get(itemName) || { sales: 0, quantity: 0 };
        current.sales += salesValue;
        current.quantity += item.quantity || 0;
        itemMap.set(itemName, current);
      }
    });

    // Convert to array and sort by sales value
    return Array.from(itemMap.entries())
      .map(([name, data]) => ({
        name,
        sales: Math.round(data.sales),
        quantity: data.quantity
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching top selling items:', error);
    throw error;
  }
};

/**
 * Fetch sales performance metrics
 */
export const fetchSalesMetrics = async (): Promise<{
  totalTransactions: number;
  averageOrderValue: number;
  itemsPerTransaction: number;
  totalRevenue: number;
}> => {
  try {
    const userData = getUserData();
    const companyId = userData.company_id;

    if (!companyId) {
      throw new Error('Company ID not found in user data');
    }

    // Get sales invoices
    const { data: invoices, error: invoiceError } = await supabase
      .from('sales_invoice')
      .select('id, net_amount')
      .eq('company_id', companyId)
      .not('net_amount', 'is', null);

    if (invoiceError) {
      throw new Error(`Failed to fetch sales invoices: ${invoiceError.message}`);
    }

    // Get sales invoice items
    const { data: items, error: itemsError } = await supabase
      .from('sales_invoice_items')
      .select(`
        quantity,
        sales_invoice!inner(
          company_id
        )
      `)
      .eq('sales_invoice.company_id', companyId);

    if (itemsError) {
      throw new Error(`Failed to fetch sales items: ${itemsError.message}`);
    }

    const totalTransactions = invoices?.length || 0;
    const totalRevenue = invoices?.reduce((sum: number, inv: any) => sum + (inv.net_amount || 0), 0) || 0;
    const totalItems = items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
    
    const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const itemsPerTransaction = totalTransactions > 0 ? totalItems / totalTransactions : 0;

    return {
      totalTransactions,
      averageOrderValue: Math.round(averageOrderValue),
      itemsPerTransaction: Math.round(itemsPerTransaction * 10) / 10,
      totalRevenue: Math.round(totalRevenue)
    };
  } catch (error) {
    console.error('Error fetching sales metrics:', error);
    throw error;
  }
};

/**
 * Fetch all dashboard data
 */
export const fetchDashboardData = async (): Promise<DashboardData> => {
  try {
    const [metrics, categoryData, salesData, fastMovingItems, slowMovingItems, inventoryAlerts] = await Promise.all([
      fetchInventoryMetrics(),
      fetchCategoryStockData(),
      fetchSalesTurnoverData(),
      fetchFastMovingItems(),
      fetchSlowMovingItems(),
      fetchInventoryAlerts()
    ]);

    return {
      metrics,
      categoryData,
      salesData,
      fastMovingItems,
      slowMovingItems,
      inventoryAlerts
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};

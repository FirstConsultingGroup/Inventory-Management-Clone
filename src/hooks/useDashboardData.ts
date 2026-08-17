import { useState, useEffect, useCallback } from 'react';
import { 
  fetchDashboardData, 
  DashboardData, 
  DashboardMetrics, 
  CategoryStockData, 
  SalesData, 
  MovingItem 
} from '../Utils/dashboardData';

interface UseDashboardDataReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

export const useDashboardData = (autoRefresh: boolean = true, refreshInterval: number = 300000): UseDashboardDataReturn => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const dashboardData = await fetchDashboardData();
      setData(dashboardData);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      setError(errorMessage);
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    lastUpdated
  };
};

// Individual hooks for specific dashboard sections
export const useInventoryMetrics = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { fetchInventoryMetrics } = await import('../Utils/dashboardData');
      const data = await fetchInventoryMetrics();
      setMetrics(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch inventory metrics';
      setError(errorMessage);
      console.error('Inventory metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
};

export const useCategoryStockData = () => {
  const [categoryData, setCategoryData] = useState<CategoryStockData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategoryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { fetchCategoryStockData } = await import('../Utils/dashboardData');
      const data = await fetchCategoryStockData();
      setCategoryData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch category data';
      setError(errorMessage);
      console.error('Category data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategoryData();
  }, [fetchCategoryData]);

  return { categoryData, loading, error, refetch: fetchCategoryData };
};

export const useSalesData = () => {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSalesData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { fetchSalesTurnoverData } = await import('../Utils/dashboardData');
      const data = await fetchSalesTurnoverData();
      setSalesData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sales data';
      setError(errorMessage);
      console.error('Sales data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  return { salesData, loading, error, refetch: fetchSalesData };
};

export const useMovingItems = () => {
  const [fastMovingItems, setFastMovingItems] = useState<MovingItem[]>([]);
  const [slowMovingItems, setSlowMovingItems] = useState<MovingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMovingItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { fetchFastMovingItems, fetchSlowMovingItems } = await import('../Utils/dashboardData');
      const [fastData, slowData] = await Promise.all([
        fetchFastMovingItems(),
        fetchSlowMovingItems()
      ]);
      
      setFastMovingItems(fastData);
      setSlowMovingItems(slowData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch moving items data';
      setError(errorMessage);
      console.error('Moving items fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovingItems();
  }, [fetchMovingItems]);

  return { 
    fastMovingItems, 
    slowMovingItems, 
    loading, 
    error, 
    refetch: fetchMovingItems 
  };
};

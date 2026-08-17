import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, Save, Building2, Settings, FileText, AlertCircle, ShieldCheck, Info, Loader2, Percent, PlusCircle, Trash2, Tag, User } from 'lucide-react';
import { ICompany, IReportConfig } from '@/Utils/constants';
import { supabase } from '@/Utils/types/supabaseClient';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { selectUser } from '@/redux/features/userSlice';
import type { Database } from '@/Utils/types/database.types';
import { loadModulePermissions } from '@/Utils/commonFun';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type TaxFormEntry = {
  id?: string;
  label: string;
  value: Database['public']['Tables']['tax_master']['Row']['value'];
  company_id: string;
  is_active: boolean;
  created_at?: string;
  _isNew?: boolean;
  _isDeleted?: boolean;
};

const createEmptyTaxEntry = (companyId: string): TaxFormEntry => ({
  id: undefined,
  label: '',
  value: null,
  company_id: companyId,
  is_active: true,
  _isNew: true
});

type DiscountFormEntry = {
  id?: string;
  label: string;
  value: string | null;
  company_id: string;
  is_active: boolean;
  created_at?: string;
  _isNew?: boolean;
  _isDeleted?: boolean;
};

const createEmptyDiscountEntry = (companyId: string): DiscountFormEntry => ({
  id: undefined,
  label: '',
  value: null,
  company_id: companyId,
  is_active: true,
  _isNew: true
});

const CompanyAdministration: React.FC = (): React.JSX.Element => {
  const user = useSelector(selectUser);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['information']));
  const [expandedReportSections, setExpandedReportSections] = useState<Set<string>>(new Set(['purchase_order']));
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [companyInfo, setCompanyInfo] = useState<ICompany>({
    id: '',
    name: '',
    description: '',
    address: '',
    state: '',
    postal_code: '',
    country: '',
    city: '',
    bank_name: '',
    bank_account_number: '',
    ifsc_code: '',
    iban_code: '',
    email: '',
    currency: '$',
    phone: '',
    is_active: true,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    tax_percentage: null,
    employee_id_config: null
  } as ICompany);

  const [reportConfig, setReportConfig] = useState<{
    purchaseOrderReport: IReportConfig;
    salesReport: IReportConfig;
    stockReport: IReportConfig;
  }>({
    purchaseOrderReport: {
      id: '',
      company_id: '',
      report_type: 'purchase_order',
      payment_details: '',
      remarks: '',
      report_footer: '',
      created_at: new Date().toISOString(),
    },
    salesReport: {
      id: '',
      company_id: '',
      report_type: 'sales',
      payment_details: '',
      remarks: '',
      report_footer: '',
      created_at: new Date().toISOString(),
    },
    stockReport: {
      id: '',
      company_id: '',
      report_type: 'stock',
      payment_details: '',
      remarks: '',
      report_footer: '',
      created_at: new Date().toISOString(),
    }
  });

  const [taxEntries, setTaxEntries] = useState<TaxFormEntry[]>([]);
  const [discountEntries, setDiscountEntries] = useState<DiscountFormEntry[]>([]);

  // Employee ID Configuration
  const [employeeIdConfig, setEmployeeIdConfig] = useState<{
    autoGenerate: boolean;
    prefix: string;
    startingSequence: number;
  }>({
    autoGenerate: false,
    prefix: 'EMP',
    startingSequence: 1,
  });
  const [isEmployeeIdConfigLocked, setIsEmployeeIdConfigLocked] = useState(false);

  // Validation states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companyEmail, setCompanyEmail] = useState<string | null>(null);
  const [emailRefreshToken, setEmailRefreshToken] = useState('');
  const [isEmailAuthenticated, setIsEmailAuthenticated] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [ModulePermissions, setModulePermissions] = useState<any[]>([]);
  const appCode = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

  useEffect(() => {
    // Check if user is authenticated before loading data
    if (user) {
      console.log('User authenticated, loading data...', user);
      loadData();
    } else {
      console.log('User not authenticated yet, waiting...');
    }
  }, [user]);

  useEffect(() => {
    if (!companyInfo.id || !companyEmail) return;
    checkIsEmailAuthenticated(companyEmail, companyInfo.id);
  }, [companyEmail, companyInfo.id])

  // Monitor reportConfig state changes
  useEffect(() => {
    console.log('ReportConfig state changed:', reportConfig);
  }, [reportConfig]);

  const getCurrentCompanyId = useCallback(async (): Promise<string> => {
    // First try to get from localStorage userData
    try {
      const userData = localStorage.getItem('userData');
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        if (parsedUserData.company_id) {
          console.log('Using company_id from localStorage:', parsedUserData.company_id);
          return parsedUserData.company_id;
        }
      }
    } catch (error) {
      console.warn('Error reading userData from localStorage:', error);
    }

    // Fallback to user from Redux
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get company ID from user data
    if (!user.company_id) {
      throw new Error('Company ID not found');
    }

    console.log('Using company_id from Redux user:', user.company_id);
    return user.company_id;
  }, [user]);

  const checkAuthentication = useCallback(async (): Promise<boolean> => {
    return !!user;
  }, [user]);

  useEffect(() => {
    // Get currency symbol from user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    const fetchPermissions = async () => {
      if (userData?.user_id) {
        const res = await loadModulePermissions(appCode, 'Administration', userData.user_id);
        console.log("permissions", res);

        if (res && res.permissions) {
          setModulePermissions(res.permissions);
        }
      }
    };
    fetchPermissions();
  }, [appCode]);

  const hasModulePermission = (actionName: string) => {
    const perm = ModulePermissions.find((p: any) => p.action_id?.actionName?.toLowerCase() === actionName.toLowerCase());
    return perm ? perm.isAllowed : false;
  };

  // Helper function to load report configs with company filtering
  const loadReportConfigsByCompany = async (companyId: string) => {
    try {
      console.log('Loading report configs with company filtering for:', companyId);

      // First try to load with company_id filter
      const { data: companyFilteredData, error: companyFilteredError } = await supabase
        .from('report_config')
        .select('*')
        .eq('company_id', companyId)
        .order('report_category', { ascending: true });

      if (companyFilteredError) {
        console.warn('Error loading company-filtered report configs:', companyFilteredError);
        console.log('Falling back to loading all report configs...');

        // Fallback: Load all report configs if company filtering fails
        const { data: allReportData, error: allReportError } = await supabase
          .from('report_config')
          .select('*')
          .order('report_category', { ascending: true });

        if (allReportError) {
          console.error('Error loading all report configs:', allReportError);
          return { data: null, error: allReportError, isCompanyFiltered: false };
        }

        console.log('Successfully loaded all report configs (fallback):', allReportData?.length || 0, 'records');
        return { data: allReportData, error: null, isCompanyFiltered: false };
      }

      // Successfully loaded company-filtered data
      console.log('Successfully loaded company-filtered report configs:', companyFilteredData?.length || 0, 'records');
      return { data: companyFilteredData, error: null, isCompanyFiltered: true };

    } catch (error) {
      console.error('Unexpected error loading report configs:', error);
      return { data: null, error, isCompanyFiltered: false };
    }
  };

  const loadTaxEntries = useCallback(async (companyId: string): Promise<TaxFormEntry[]> => {
    try {
      const { data, error } = await supabase
        .from('tax_master')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('label', { ascending: true });

      if (error) {
        console.error('Error loading tax information:', error);
        toast.error('Failed to load tax information');
        const fallback = [createEmptyTaxEntry(companyId)];
        setTaxEntries(fallback);
        return fallback;
      }

      if (!data || data.length === 0) {
        const fallback = [createEmptyTaxEntry(companyId)];
        setTaxEntries(fallback);
        return fallback;
      }

      const normalizedEntries = data.map<TaxFormEntry>((entry) => ({
        id: entry.id,
        label: entry.label ?? '',
        value: entry.value ?? null,
        company_id: entry.company_id ?? companyId,
        is_active: entry.is_active ?? true,
        created_at: entry.created_at,
        _isNew: false,
        _isDeleted: false
      }));

      setTaxEntries(normalizedEntries);
      return normalizedEntries;
    } catch (error) {
      console.error('Unexpected error loading tax information:', error);
      toast.error('Failed to load tax information');
      const fallback = [createEmptyTaxEntry(companyId)];
      setTaxEntries(fallback);
      return fallback;
    }
  }, []);

  const loadDiscountEntries = useCallback(async (companyId: string): Promise<DiscountFormEntry[]> => {
    try {
      console.log('Loading discount entries for company:', companyId);

      // Debug: Check if table has any data at all
      const { data: tableCheck, error: tableError } = await supabase
        .from('global_discount' as any)
        .select('*')
        .limit(5);

      console.log('Table check - Any records in global_discount table:', tableCheck);
      console.log('Table check error:', tableError);

      // First, try to get all records for this company (without is_active filter) for debugging
      const { data: allData, error: allError } = await supabase
        .from('global_discount' as any)
        .select('*')
        .eq('company_id', companyId);

      console.log('All discount records for company (before is_active filter):', allData);
      console.log('Company ID used in query:', companyId);
      console.log('All records error:', allError);

      // Now get records for the company (try with is_active filter first)
      let query = supabase
        .from('global_discount' as any)
        .select('*')
        .eq('company_id', companyId);

      // Only filter by is_active if we want active records
      // For now, let's get all records to debug
      const { data, error } = await query
        .order('label', { ascending: true });

      console.log('Active discount records:', data);
      console.log('Query error:', error);

      if (error) {
        console.error('Error loading discount information:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        toast.error('Failed to load discount information');
        setDiscountEntries([]);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('No active discount entries found for company:', companyId);
        console.log('Total records for company (including inactive):', allData?.length || 0);

        // If there are inactive records, let's still show them but mark them appropriately
        if (allData && allData.length > 0) {
          console.log('Found inactive records, loading them anyway:', allData);
          const normalizedEntries = allData.map<DiscountFormEntry>((entry: any) => ({
            id: entry.id?.toString(),
            label: entry.label ?? '',
            value: entry.value ?? null,
            company_id: entry.company_id ?? companyId,
            is_active: entry.is_active ?? true,
            created_at: entry.created_at,
            _isNew: false,
            _isDeleted: false
          }));
          setDiscountEntries(normalizedEntries);
          return normalizedEntries;
        }

        setDiscountEntries([]);
        return [];
      }

      console.log('Found discount entries:', data?.length || 0);

      // Filter to only show active entries (is_active is true or null)
      const activeEntries = (data || []).filter((entry: any) => entry.is_active !== false);
      console.log('Active discount entries after filtering:', activeEntries.length);

      const normalizedEntries = activeEntries.map<DiscountFormEntry>((entry: any) => ({
        id: entry.id?.toString(),
        label: entry.label ?? '',
        value: entry.value ?? null,
        company_id: entry.company_id ?? companyId,
        is_active: entry.is_active ?? true,
        created_at: entry.created_at,
        _isNew: false,
        _isDeleted: false
      }));

      console.log('Normalized discount entries:', normalizedEntries);
      setDiscountEntries(normalizedEntries);
      return normalizedEntries;
    } catch (error) {
      console.error('Unexpected error loading discount information:', error);
      toast.error('Failed to load discount information');
      setDiscountEntries([]);
      return [];
    }
  }, []);

  const handleAddTaxEntry = useCallback(async () => {
    try {
      const companyId = companyInfo.id || user?.company_id || (await getCurrentCompanyId());
      setTaxEntries((prev) => [
        ...prev,
        createEmptyTaxEntry(companyId)
      ]);
    } catch (error) {
      console.error('Error resolving company ID while adding tax entry:', error);
      toast.error('Unable to determine company for the new tax entry');
    }
  }, [companyInfo.id, getCurrentCompanyId, user?.company_id]);

  const handleTaxEntryChange = useCallback((index: number, field: 'label' | 'value' | 'is_active', value: string | number | boolean | null) => {
    setTaxEntries((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;

      const nextEntry = { ...target };

      if (field === 'label' && typeof value === 'string') {
        nextEntry.label = value;
      }

      if (field === 'value') {
        if (value === null || value === '') {
          nextEntry.value = null;
        } else if (typeof value === 'number') {
          nextEntry.value = value;
        } else if (typeof value === 'string') {
          const parsed = parseFloat(value);
          nextEntry.value = Number.isNaN(parsed) ? null : parsed;
        }
      }

      if (field === 'is_active' && typeof value === 'boolean') {
        nextEntry.is_active = value;
      }

      nextEntry._isNew = target._isNew;
      updated[index] = nextEntry;
      return updated;
    });

    setErrors((prev) => {
      const updatedErrors = { ...prev };
      if (field === 'label') {
        delete updatedErrors[`tax_label_${index}`];
      }
      if (field === 'value') {
        delete updatedErrors[`tax_value_${index}`];
      }
      return updatedErrors;
    });
  }, []);

  const handleRemoveTaxEntry = useCallback((index: number) => {
    setTaxEntries((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;

      if (target._isNew && !target.id) {
        updated.splice(index, 1);
        return updated.length > 0 ? updated : [createEmptyTaxEntry(companyInfo.id || user?.company_id || '')];
      }

      updated[index] = {
        ...target,
        is_active: false,
        _isDeleted: true
      };

      return updated;
    });

    setErrors((prev) => {
      const updatedErrors = { ...prev };
      delete updatedErrors[`tax_label_${index}`];
      delete updatedErrors[`tax_value_${index}`];
      return updatedErrors;
    });
  }, [companyInfo.id, user?.company_id]);

  const handleAddDiscountEntry = useCallback(async () => {
    try {
      const companyId = companyInfo.id || user?.company_id || (await getCurrentCompanyId());
      setDiscountEntries((prev) => [
        ...prev,
        createEmptyDiscountEntry(companyId)
      ]);
    } catch (error) {
      console.error('Error resolving company ID while adding discount entry:', error);
      toast.error('Unable to determine company for the new discount entry');
    }
  }, [companyInfo.id, getCurrentCompanyId, user?.company_id]);

  const handleDiscountEntryChange = useCallback((index: number, field: 'label' | 'value' | 'is_active', value: string | number | boolean | null) => {
    setDiscountEntries((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;

      const nextEntry = { ...target };

      if (field === 'label' && typeof value === 'string') {
        nextEntry.label = value;
      }

      if (field === 'value') {
        if (value === null || value === '') {
          nextEntry.value = null;
        } else if (typeof value === 'string') {
          nextEntry.value = value;
        } else if (typeof value === 'number') {
          nextEntry.value = value.toString();
        }
      }

      if (field === 'is_active' && typeof value === 'boolean') {
        nextEntry.is_active = value;
      }

      nextEntry._isNew = target._isNew;
      updated[index] = nextEntry;
      return updated;
    });

    setErrors((prev) => {
      const updatedErrors = { ...prev };
      if (field === 'label') {
        delete updatedErrors[`discount_label_${index}`];
      }
      if (field === 'value') {
        delete updatedErrors[`discount_value_${index}`];
      }
      return updatedErrors;
    });
  }, []);

  const handleRemoveDiscountEntry = useCallback((index: number) => {
    setDiscountEntries((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;

      if (target._isNew && !target.id) {
        updated.splice(index, 1);
        return updated.length > 0 ? updated : [createEmptyDiscountEntry(companyInfo.id || user?.company_id || '')];
      }

      updated[index] = {
        ...target,
        is_active: false,
        _isDeleted: true
      };

      return updated;
    });

    setErrors((prev) => {
      const updatedErrors = { ...prev };
      delete updatedErrors[`discount_label_${index}`];
      delete updatedErrors[`discount_value_${index}`];
      return updatedErrors;
    });
  }, [companyInfo.id, user?.company_id]);

  const loadData = useCallback(async () => {
    console.log('loadData called, user:', user);
    setIsLoading(true);
    try {
      // Check authentication first
      const isAuthenticated = await checkAuthentication();
      console.log('Authentication check result:', isAuthenticated);
      if (!isAuthenticated) {
        console.log('User not authenticated, skipping data load');
        setIsLoading(false);
        return;
      }

      const companyId = await getCurrentCompanyId();
      console.log('Company ID:', companyId);

      // Load company information
      const { data: companyData, error: companyError } = await supabase
        .from('company_master')
        .select('*')
        .eq('id', companyId)
        .single();

      console.log('Company data result:', { companyData, companyError });

      if (companyError && companyError.code !== 'PGRST116') {
        throw companyError;
      }

      // Create default company data if none exists
      const company: ICompany = companyData || {
        id: companyId,
        name: '',
        description: '',
        address: '',
        state: '',
        postal_code: '',
        country: '',
        city: '',
        bank_name: '',
        bank_account_number: '',
        ifsc_code: '',
        iban_code: '',
        email: '',
        currency: '$',
        phone: '',
        is_active: true,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        tax_percentage: null,
        employee_id_config: null
      };

      // Load report configurations by company ID using helper function
      console.log('Loading report configurations for company:', companyId);
      let reportData = null;
      const reportConfigResult = await loadReportConfigsByCompany(companyId);

      if (reportConfigResult.error) {
        toast.error('Failed to load report configurations');
        reportData = null;
      } else {
        reportData = reportConfigResult.data;
        if (reportConfigResult.isCompanyFiltered) {
          console.log('Successfully loaded company-filtered report configs:', reportData?.length || 0, 'records');
          console.log('Data filtered by company_id:', companyId);
        } else {
          console.log('Loaded report configs without company filtering (fallback):', reportData?.length || 0, 'records');
          console.log('Note: Showing all configs due to company_id filtering issue');
        }
      }

      console.log('Final report config data:', reportData);

      await loadTaxEntries(companyId);
      await loadDiscountEntries(companyId);

      // Check if any users already have an employee ID for this company.
      // If yes, lock the employee ID configuration so it cannot be modified.
      try {
        const { data: usersWithEmployeeId, error: usersError } = await supabase
          .from('user_mgmt')
          .select('id, employee_id')
          .eq('company_id', companyId)
          .not('employee_id', 'is', null)
          .eq('is_active', true)
          .limit(1);

        if (usersError) {
          console.error('Error checking existing employee IDs for lock:', usersError);
        } else {
          const hasEmployeeIds = Array.isArray(usersWithEmployeeId) && usersWithEmployeeId.length > 0;
          setIsEmployeeIdConfigLocked(hasEmployeeIds);
        }
      } catch (lockCheckError) {
        console.error('Unexpected error while determining employee ID config lock state:', lockCheckError);
      }

      // Process report config data - map to existing records from your table
      let poReport = { id: '', company_id: companyId, report_type: 'purchase_order', payment_details: '', remarks: '', report_footer: '', created_at: new Date().toISOString() };
      let salesReport = { id: '', company_id: companyId, report_type: 'sales', payment_details: '', remarks: '', report_footer: '', created_at: new Date().toISOString() };
      let stockReport = { id: '', company_id: companyId, report_type: 'stock', payment_details: '', remarks: '', report_footer: '', created_at: new Date().toISOString() };

      if (reportData && Array.isArray(reportData) && reportData.length > 0) {
        console.log('Processing report config data...');
        console.log('Available report configs:', reportData.map(config => ({
          id: config.id,
          company_id: config.company_id,
          category: config.report_category,
          key: config.report_config_key,
          value: config.report_config_value
        })));
        // Map the specific records by category and key (more reliable than hardcoded IDs)
        const paymentDetailsConfig = reportData.find(config =>
          config.report_category === 'PURCHASE_ORDER_REPORT' && config.report_config_key === 'PAYMENT_DETAILS'
        );
        const poRemarksConfig = reportData.find(config =>
          config.report_category === 'PURCHASE_ORDER_REPORT' && config.report_config_key === 'REMARKS'
        );
        const poFooterConfig = reportData.find(config =>
          config.report_category === 'PURCHASE_ORDER_REPORT' && config.report_config_key === 'FOOTER'
        );
        const salesRemarksConfig = reportData.find(config =>
          config.report_category === 'SALES_REPORT' && config.report_config_key === 'REMARKS'
        );
        const salesFooterConfig = reportData.find(config =>
          config.report_category === 'SALES_REPORT' && config.report_config_key === 'FOOTER'
        );
        const stockRemarksConfig = reportData.find(config =>
          config.report_category === 'STOCK_REPORT' && config.report_config_key === 'REMARKS'
        );
        const stockFooterConfig = reportData.find(config =>
          config.report_category === 'STOCK_REPORT' && config.report_config_key === 'FOOTER'
        );

        console.log('Found configs by category/key:', {
          paymentDetails: { id: paymentDetailsConfig?.id, company_id: paymentDetailsConfig?.company_id },
          poRemarks: { id: poRemarksConfig?.id, company_id: poRemarksConfig?.company_id },
          poFooter: { id: poFooterConfig?.id, company_id: poFooterConfig?.company_id },
          salesRemarks: { id: salesRemarksConfig?.id, company_id: salesRemarksConfig?.company_id },
          salesFooter: { id: salesFooterConfig?.id, company_id: salesFooterConfig?.company_id },
          stockRemarks: { id: stockRemarksConfig?.id, company_id: stockRemarksConfig?.company_id },
          stockFooter: { id: stockFooterConfig?.id, company_id: stockFooterConfig?.company_id }
        });

        // Build Purchase Order Report
        poReport = {
          id: 'purchase_order_report',
          company_id: companyId,
          report_type: 'purchase_order',
          payment_details: paymentDetailsConfig?.report_config_value || '',
          remarks: poRemarksConfig?.report_config_value || '',
          report_footer: poFooterConfig?.report_config_value || '',
          created_at: new Date().toISOString(),
        };

        // Build Sales Report
        salesReport = {
          id: 'sales_report',
          company_id: companyId,
          report_type: 'sales',
          payment_details: '',
          remarks: salesRemarksConfig?.report_config_value || '',
          report_footer: salesFooterConfig?.report_config_value || '',
          created_at: new Date().toISOString(),
        };

        // Build Stock Report
        stockReport = {
          id: 'stock_report',
          company_id: companyId,
          report_type: 'stock',
          payment_details: '',
          remarks: stockRemarksConfig?.report_config_value || '',
          report_footer: stockFooterConfig?.report_config_value || '',
          created_at: new Date().toISOString(),
        };

        console.log('Loaded report configs:', {
          poReport,
          salesReport,
          stockReport
        });

        console.log('Mapped report values:', {
          poPaymentDetails: paymentDetailsConfig?.report_config_value,
          poRemarks: poRemarksConfig?.report_config_value,
          poFooter: poFooterConfig?.report_config_value,
          salesRemarks: salesRemarksConfig?.report_config_value,
          salesFooter: salesFooterConfig?.report_config_value,
          stockRemarks: stockRemarksConfig?.report_config_value,
          stockFooter: stockFooterConfig?.report_config_value
        });
      }

      // Load employee ID configuration
      let loadedEmployeeIdConfig = {
        autoGenerate: false,
        prefix: 'EMP',
        startingSequence: 1,
      };

      if (companyData?.employee_id_config) {
        try {
          const config = typeof companyData.employee_id_config === 'string'
            ? JSON.parse(companyData.employee_id_config)
            : companyData.employee_id_config;

          if (config && typeof config === 'object') {
            loadedEmployeeIdConfig = {
              autoGenerate: config.autoGenerate ?? false,
              prefix: config.prefix ?? 'EMP',
              startingSequence: config.startingSequence ?? 1,
            };
          }
        } catch (error) {
          console.error('Error parsing employee_id_config:', error);
        }
      }

      setEmployeeIdConfig(loadedEmployeeIdConfig);

      // Update component state with loaded data
      setCompanyInfo({
        ...company,
        description: company.description || '',
        tax_percentage: company.tax_percentage ?? null,
        employee_id_config: company.employee_id_config ?? null
      });

      setCompanyEmail(companyData?.email ?? null);

      setReportConfig({
        purchaseOrderReport: poReport,
        salesReport: salesReport,
        stockReport: stockReport
      });

      console.log('State updated with report config:', {
        purchaseOrderReport: poReport,
        salesReport: salesReport,
        stockReport: stockReport
      });

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load company data');
    } finally {
      setIsLoading(false);
    }
  }, [user, checkAuthentication, getCurrentCompanyId, loadTaxEntries, loadDiscountEntries]);

  const checkIsEmailAuthenticated = async (
    companyEmail: string,
    companyId: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("id, system_config_value")
        .eq("company_email", companyEmail) // use parameter instead of hardcoding
        .eq("company_id", companyId)
        .eq("system_config_key", "EMAIL_REFRESH_TOKEN")
        .maybeSingle();

      if (error) {
        console.error("Supabase error:", error);
        return false;
      }

      if (data?.system_config_value) {
        setEmailRefreshToken(data.system_config_value);
        setIsEmailAuthenticated(true);
        return true;
      } else {
        setEmailRefreshToken("");
        setIsEmailAuthenticated(false);
        return false;
      }
    } catch (err) {
      console.error("Check email auth error:", err);
      return false;
    }
  };

  const toggleSection = (section: string) => {
    if (expandedSections.has(section)) {
      // If the section is already open, close it
      setExpandedSections(new Set());
    } else {
      // If the section is closed, open it and close all others
      setExpandedSections(new Set([section]));
    }
  };

  const toggleReportSection = (section: string) => {
    if (expandedReportSections.has(section)) {
      // If the section is already open, close it
      setExpandedReportSections(prev => {
        const newSet = new Set(prev);
        newSet.delete(section);
        return newSet;
      });
    } else {
      // If the section is closed, open it (can have multiple open)
      setExpandedReportSections(prev => new Set([...prev, section]));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Company Information validation
    if (!companyInfo.name.trim()) newErrors.name = 'Company name is required';
    if (!companyInfo.email?.trim()) newErrors.email = 'Email is required';
    if (companyInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyInfo.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (companyInfo.email && /[A-Z]/.test(companyInfo.email)) {
      newErrors.email = 'Email must be in lowercase';
    }
    if (companyInfo.phone && !/^[+]?[1-9][\d]{0,15}$/.test(companyInfo.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Invalid phone number format';
    }
    if (companyInfo.bank_account_number && !/^\d+$/.test(companyInfo.bank_account_number)) {
      newErrors.bank_account_number = 'Bank account number must contain only numbers';
    }

    // Tax validation: optional but valid if provided
    if (companyInfo.tax_percentage !== null) {
      if (companyInfo.tax_percentage < 0) {
        newErrors.tax_percentage = 'Tax percentage cannot be negative';
      } else if (companyInfo.tax_percentage > 100) {
        newErrors.tax_percentage = 'Tax percentage cannot exceed 100%';
      }
    }

    taxEntries.forEach((entry, index) => {
      if (entry._isDeleted) return;
      if (!entry.label || !entry.label.trim()) {
        newErrors[`tax_label_${index}`] = 'Tax label is required';
      }
      if (entry.value !== null && entry.value < 0) {
        newErrors[`tax_value_${index}`] = 'Tax value cannot be negative';
      }
    });

    // Discount validation
    discountEntries.forEach((entry, index) => {
      if (entry._isDeleted) return;
      if (!entry.label || !entry.label.trim()) {
        newErrors[`discount_label_${index}`] = 'Discount label is required';
      }
      if (entry.value !== null && entry.value.trim() !== '') {
        const parsed = parseFloat(entry.value);
        if (Number.isNaN(parsed)) {
          newErrors[`discount_value_${index}`] = 'Discount value must be a valid number';
        } else if (parsed < 0) {
          newErrors[`discount_value_${index}`] = 'Discount value cannot be negative';
        } else if (parsed > 100) {
          newErrors[`discount_value_${index}`] = 'Discount value cannot exceed 100%';
        }
      }
    });

    // Employee ID configuration validation
    if (employeeIdConfig.autoGenerate) {
      if (!employeeIdConfig.prefix || !employeeIdConfig.prefix.trim()) {
        newErrors.employeeIdPrefix = 'Prefix is required when auto-generate is enabled';
      }
      if (employeeIdConfig.startingSequence < 0) {
        newErrors.employeeIdSequence = 'Starting sequence cannot be negative';
      }
      if (!Number.isInteger(employeeIdConfig.startingSequence)) {
        newErrors.employeeIdSequence = 'Starting sequence must be a whole number';
      }
    }

    // Note: System Settings validation removed since email_url and email_token are not editable in the UI
    // These fields are managed through the email authentication process

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    console.log('handleSave function called!'); // Debug log
    if (!validateForm()) {
      console.log('Form validation failed, errors:', errors); // Debug log
      return;
    }

    console.log('Form validation passed, proceeding with save...'); // Debug log
    setIsLoading(true);

    try {
      const companyId = await getCurrentCompanyId();
      const now = new Date().toISOString();

      // Determine which employee ID configuration to save.
      // If the configuration is locked (because users already exist with employee IDs),
      // we keep the existing value from the database and ignore any UI changes.
      const employeeIdConfigToSave = isEmployeeIdConfigLocked
        ? companyInfo.employee_id_config
        : employeeIdConfig;

      // Only save the company description text and active admin config data
      const companyDataToSave = {
        ...companyInfo,
        description: companyInfo.description || '', // Just the plain text description
        tax_percentage: companyInfo.tax_percentage,
        employee_id_config: employeeIdConfigToSave,
        modified_at: now
      };

      // Save company information
      let companyResult;
      if (companyInfo.id) {
        // Update existing company
        const { data: updatedCompany, error: companyError } = await supabase
          .from('company_master')
          .update(companyDataToSave)
          .eq('id', companyInfo.id)
          .select()
          .single();

        if (companyError) throw companyError;
        companyResult = updatedCompany;
      } else {
        // Create new company
        const { data: newCompany, error: companyError } = await supabase
          .from('company_master')
          .insert([{
            ...companyDataToSave,
            id: companyId,
            created_at: now
          }])
          .select()
          .single();

        if (companyError) throw companyError;
        companyResult = newCompany;
      }

      // Save report configurations with proper company_id handling
      console.log('Saving report configurations for company:', companyId);

      // First, check if there are existing records for this company_id
      const { data: existingCompanyRecords, error: existingCompanyError } = await supabase
        .from('report_config')
        .select('*')
        .eq('company_id', companyId);

      if (existingCompanyError) {
        console.error('Error checking existing company records:', existingCompanyError);
        toast.error('Failed to check existing report configurations');
        return;
      }

      console.log('Existing records for company:', companyId, 'Count:', existingCompanyRecords?.length || 0);

      // Define all required report configurations
      const requiredConfigs = [
        {
          category: 'PURCHASE_ORDER_REPORT',
          key: 'PAYMENT_DETAILS',
          value: reportConfig.purchaseOrderReport.payment_details || '',
          description: 'Payment details'
        },
        {
          category: 'PURCHASE_ORDER_REPORT',
          key: 'REMARKS',
          value: reportConfig.purchaseOrderReport.remarks || '',
          description: 'Remarks'
        },
        {
          category: 'PURCHASE_ORDER_REPORT',
          key: 'FOOTER',
          value: reportConfig.purchaseOrderReport.report_footer || '',
          description: 'Footer'
        },
        {
          category: 'SALES_REPORT',
          key: 'REMARKS',
          value: reportConfig.salesReport.remarks || '',
          description: 'Remarks'
        },
        {
          category: 'SALES_REPORT',
          key: 'FOOTER',
          value: reportConfig.salesReport.report_footer || '',
          description: 'Footer'
        },
        {
          category: 'STOCK_REPORT',
          key: 'REMARKS',
          value: reportConfig.stockReport.remarks || '',
          description: 'Remarks'
        },
        {
          category: 'STOCK_REPORT',
          key: 'FOOTER',
          value: reportConfig.stockReport.report_footer || '',
          description: 'Footer'
        }
      ];

      // Process each required configuration
      for (const config of requiredConfigs) {
        try {
          // Check if this specific config already exists for this company
          const existingRecord = existingCompanyRecords?.find(record =>
            record.report_category === config.category &&
            record.report_config_key === config.key
          );

          if (existingRecord) {
            // Update existing record
            console.log(`Updating existing ${config.category} - ${config.key} for company ${companyId}`);
            const { error: updateError } = await supabase
              .from('report_config')
              .update({
                report_config_value: config.value,
                description: config.description,
                // modified_at: now
              })
              .eq('id', existingRecord.id);

            if (updateError) {
              console.error(`Error updating ${config.category} - ${config.key}:`, updateError);
              toast.error(`Failed to update ${config.category} - ${config.key}`);
            } else {
              console.log(`Successfully updated ${config.category} - ${config.key}`);
            }
          } else {
            // Create new record for this company
            console.log(`Creating new ${config.category} - ${config.key} for company ${companyId}`);
            const { error: insertError } = await supabase
              .from('report_config')
              .insert([{
                company_id: companyId,
                report_category: config.category,
                report_config_key: config.key,
                report_config_value: config.value,
                description: config.description,
                created_at: now
              }]);

            if (insertError) {
              console.error(`Error creating ${config.category} - ${config.key}:`, insertError);
              toast.error(`Failed to create ${config.category} - ${config.key}`);
            } else {
              console.log(`Successfully created ${config.category} - ${config.key} for company ${companyId}`);
            }
          }
        } catch (error) {
          console.error(`Unexpected error processing ${config.category} - ${config.key}:`, error);
          toast.error(`Error processing ${config.category} - ${config.key}`);
        }
      }

      const taxEntriesToSave = taxEntries.filter((entry) => !entry._isDeleted);
      const taxEntriesToDeactivate = taxEntries.filter((entry) => entry._isDeleted && entry.id);

      for (const entry of taxEntriesToSave) {
        const payload = {
          company_id: companyId,
          label: entry.label.trim(),
          value: entry.value,
          is_active: entry.is_active
        };

        try {
          if (entry._isNew || !entry.id) {
            const { error: insertTaxError } = await supabase.from('tax_master').insert([payload]);
            if (insertTaxError) {
              console.error('Error creating tax entry:', insertTaxError);
              toast.error(`Failed to create tax entry "${entry.label}"`);
            }
          } else {
            const { error: updateTaxError } = await supabase
              .from('tax_master')
              .update(payload)
              .eq('id', entry.id);
            if (updateTaxError) {
              console.error('Error updating tax entry:', updateTaxError);
              toast.error(`Failed to update tax entry "${entry.label}"`);
            }
          }
        } catch (error) {
          console.error('Unexpected error saving tax entry:', error);
          toast.error(`Unexpected error saving tax entry "${entry.label}"`);
        }
      }

      for (const entry of taxEntriesToDeactivate) {
        if (!entry.id) {
          continue;
        }
        try {
          const { error: deactivateTaxError } = await supabase
            .from('tax_master')
            .update({ is_active: false })
            .eq('id', entry.id);

          if (deactivateTaxError) {
            console.error('Error deactivating tax entry:', deactivateTaxError);
            toast.error('Failed to deactivate a tax entry');
          }
        } catch (error) {
          console.error('Unexpected error deactivating tax entry:', error);
          toast.error('Unexpected error deactivating a tax entry');
        }
      }

      await loadTaxEntries(companyId);

      // Save discount entries
      const discountEntriesToSave = discountEntries.filter((entry) => !entry._isDeleted);
      const discountEntriesToDeactivate = discountEntries.filter((entry) => entry._isDeleted && entry.id);

      for (const entry of discountEntriesToSave) {
        const payload = {
          company_id: companyId,
          label: entry.label.trim(),
          value: entry.value,
          is_active: entry.is_active
        };

        try {
          if (entry._isNew || !entry.id) {
            const { error: insertDiscountError } = await supabase.from('global_discount' as any).insert([payload]);
            if (insertDiscountError) {
              console.error('Error creating discount entry:', insertDiscountError);
              toast.error(`Failed to create discount entry "${entry.label}"`);
            }
          } else {
            const { error: updateDiscountError } = await supabase
              .from('global_discount' as any)
              .update(payload)
              .eq('id', entry.id);
            if (updateDiscountError) {
              console.error('Error updating discount entry:', updateDiscountError);
              toast.error(`Failed to update discount entry "${entry.label}"`);
            }
          }
        } catch (error) {
          console.error('Unexpected error saving discount entry:', error);
          toast.error(`Unexpected error saving discount entry "${entry.label}"`);
        }
      }

      for (const entry of discountEntriesToDeactivate) {
        if (!entry.id) {
          continue;
        }
        try {
          const { error: deactivateDiscountError } = await supabase
            .from('global_discount' as any)
            .update({ is_active: false })
            .eq('id', entry.id);

          if (deactivateDiscountError) {
            console.error('Error deactivating discount entry:', deactivateDiscountError);
            toast.error('Failed to deactivate a discount entry');
          }
        } catch (error) {
          console.error('Unexpected error deactivating discount entry:', error);
          toast.error('Unexpected error deactivating a discount entry');
        }
      }

      await loadDiscountEntries(companyId);

      // Update local state with the returned data
      setCompanyInfo(companyResult);

      // Update company data in localStorage
      const userDataString = localStorage.getItem('userData');
      if (userDataString) {
        try {
          const userData = JSON.parse(userDataString);
          userData.company_data = companyResult; // Update company_data
          localStorage.setItem('userData', JSON.stringify(userData));
          console.log('LocalStorage user company_data updated');
        } catch (err) {
          console.error('Error updating localStorage user data:', err);
        }
      }

      // Creating system log
      const systemLogs = {
        company_id: companyId,
        transaction_date: new Date().toISOString(),
        module: 'Company Administration',
        scope: 'Edit',
        key: '',
        log: `Company administration data updated.`,
        action_by: user?.id,
        created_at: new Date().toISOString(),
      }

      const { error: systemLogError } = await supabase
        .from('system_log')
        .insert(systemLogs);

      if (systemLogError) throw systemLogError;
      toast.success('All data saved successfully!');
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('Failed to save data');
    } finally {
      setIsLoading(false);
    }
  };

  const renderSaveButton = () => {
    console.log('renderSaveButton called, isLoading:', isLoading); // Debug log
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Button
              onClick={(e) => {
                console.log('Save button clicked!', e); // Debug log
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              }}
              disabled={!hasModulePermission('Save Company details') || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 save-button"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save All Changes
                </>
              )}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {hasModulePermission('Save Company details')
            ? 'Save All Changes'
            : 'You do not have permission to make changes'}
        </TooltipContent>
      </Tooltip>

    );
  };


  // Handle authenticate email
  const authenticateEmail = async (company_id: string, user_id: string) => {
    setIsAuthenticating(true);
    const redirectUrl = window.location.href;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-email?user_id=${user_id}&company_id=${company_id}&redirect_url=${encodeURIComponent(redirectUrl)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const data = await res.json();
      if (data.url) {
        setIsAuthenticating(false);
        // Redirect browser to Google consent screen
        window.location.href = data.url;
      } else {
        console.error("No auth URL returned", data);
        setIsAuthenticating(false);
      }
    } catch (err) {
      console.error("Error fetching auth URL:", err);
      toast.error("Error fetching auth URL");
      setIsAuthenticating(false)
    }
  };

  // Show loading state if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 fade-in">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Authentication...</h2>
              <p className="text-gray-500">Please wait while we verify your credentials</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error if user doesn't have company_id
  if (!user?.company_id) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 fade-in">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Company Access Required</h2>
              <p className="text-gray-500 mb-4">Your account is not associated with a company.</p>
              <p className="text-sm text-gray-400">Please contact your administrator to set up company access.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Administration</h1>
          <p className="text-gray-600">Manage company details, system settings, and report customization</p>
        </div>

        {/* Authentication Status */}
        {/* {!isLoading && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-blue-700">
                Company Administration Dashboard - All changes are automatically saved to your company profile
              </span>
            </div>
        
            <div className="mt-2 p-2 bg-blue-100 rounded text-xs text-blue-800">
              <strong>Debug Info:</strong> User ID: {user.id}, Company ID: {user.company_id}, Email: {user.email}
            </div>
          </div>
        )} */}

        {/* Action Bar */}
        <div className="mb-6 flex justify-between items-center">
          <div className="text-sm text-gray-500">
          </div>
          <div className="flex gap-2">
            <Button
              onClick={loadData}
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Accordion Sections */}
        <div className="space-y-6">
          {/* Information Section */}
          <Card className="shadow-sm border-gray-200 accordion-section">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition-colors duration-200 accordion-header"
              onClick={() => toggleSection('information')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  <CardTitle className="text-xl text-gray-900">Company Information</CardTitle>
                </div>
                {expandedSections.has('information') ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            {expandedSections.has('information') && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h3>

                    <div className="form-field">
                      <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                        Company Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={companyInfo.name}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                        className={`mt-1 ${errors.name ? 'border-red-500' : ''}`}
                        placeholder="Enter company name"
                      />
                      {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    <div className="form-field">
                      <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={companyInfo.description || ''}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, description: e.target.value })}
                        className="mt-1"
                        placeholder="Enter company description"
                        rows={3}
                      />
                    </div>

                    <div className="form-field">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={companyInfo.email || ''}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                        className={`mt-1 ${errors.email ? 'border-red-500' : ''}`}
                        placeholder="Enter company email"
                      />
                      {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-field">
                        <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          value={companyInfo.phone || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                          className={`mt-1 ${errors.phone ? 'border-red-500' : ''}`}
                          placeholder="Enter phone number"
                        />
                        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                      </div>

                      {/* Tax Percentage Field */}
                      {/* <div className="form-field">
                        <Label htmlFor="tax_percentage" className="text-sm font-medium text-gray-700">
                          Tax % <span className="text-gray-400 text-xs">(Optional)</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="tax_percentage"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={companyInfo.tax_percentage ?? ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? null : parseFloat(e.target.value);
                              setCompanyInfo({ ...companyInfo, tax_percentage: value });
                            }}
                            className={`mt-1 pr-10 ${errors.tax_percentage ? 'border-red-500' : ''}`}
                            placeholder="18.00"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                        </div>
                        {errors.tax_percentage && <p className="text-red-500 text-xs mt-1">{errors.tax_percentage}</p>}
                      </div> */}
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Address Information</h3>

                    <div className="form-field">
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                        Address
                      </Label>
                      <Textarea
                        id="address"
                        value={companyInfo.address || ''}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                        className="mt-1"
                        placeholder="Enter company address"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-field">
                        <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                          City
                        </Label>
                        <Input
                          id="city"
                          value={companyInfo.city || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, city: e.target.value })}
                          className="mt-1"
                          placeholder="Enter city"
                        />
                      </div>
                      <div className="form-field">
                        <Label htmlFor="state" className="text-sm font-medium text-gray-700">
                          State
                        </Label>
                        <Input
                          id="state"
                          value={companyInfo.state || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, state: e.target.value })}
                          className="mt-1"
                          placeholder="Enter state"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-field">
                        <Label htmlFor="postal_code" className="text-sm font-medium text-gray-700">
                          Postal Code
                        </Label>
                        <Input
                          id="postal_code"
                          value={companyInfo.postal_code || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, postal_code: e.target.value })}
                          className="mt-1"
                          placeholder="Enter postal code"
                        />
                      </div>
                      <div className="form-field">
                        <Label htmlFor="country" className="text-sm font-medium text-gray-700">
                          Country
                        </Label>
                        <Input
                          id="country"
                          value={companyInfo.country || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, country: e.target.value })}
                          className="mt-1"
                          placeholder="Enter country"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banking Information */}
                  <div className="space-y-4 md:col-span-2">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Banking Information</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="form-field">
                        <Label htmlFor="bank_name" className="text-sm font-medium text-gray-700">
                          Bank Name
                        </Label>
                        <Input
                          id="bank_name"
                          value={companyInfo.bank_name || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, bank_name: e.target.value })}
                          className="mt-1"
                          placeholder="Enter bank name"
                        />
                      </div>

                      <div className="form-field">
                        <Label htmlFor="bank_account_number" className="text-sm font-medium text-gray-700">
                          Bank Account Number
                        </Label>
                        <Input
                          id="bank_account_number"
                          value={companyInfo.bank_account_number || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, bank_account_number: e.target.value })}
                          className={`mt-1 ${errors.bank_account_number ? 'border-red-500' : ''}`}
                          placeholder="Enter account number"
                        />
                        {errors.bank_account_number && <p className="text-red-500 text-xs mt-1">{errors.bank_account_number}</p>}
                      </div>

                      <div className="form-field">
                        <Label htmlFor="ifsc_code" className="text-sm font-medium text-gray-700">
                          IFSC Code
                        </Label>
                        <Input
                          id="ifsc_code"
                          value={companyInfo.ifsc_code || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, ifsc_code: e.target.value })}
                          className="mt-1"
                          placeholder="Enter IFSC code"
                        />
                      </div>

                      <div className="form-field">
                        <Label htmlFor="iban_code" className="text-sm font-medium text-gray-700">
                          IBAN Code
                        </Label>
                        <Input
                          id="iban_code"
                          value={companyInfo.iban_code || ''}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, iban_code: e.target.value })}
                          className="mt-1"
                          placeholder="Enter IBAN code"
                        />
                      </div>
                      <div className="form-field">
                        <Label htmlFor="currency" className="text-sm font-medium text-gray-700">
                          Currency Symbol
                        </Label>
                        <Select
                          value={companyInfo.currency || '$'}
                          onValueChange={(value) => setCompanyInfo({ ...companyInfo, currency: value })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="$">$ (USD)</SelectItem>
                            <SelectItem value="€">€ (EUR)</SelectItem>
                            <SelectItem value="£">£ (GBP)</SelectItem>
                            <SelectItem value="₹">₹ (INR)</SelectItem>
                            <SelectItem value="¥">¥ (JPY)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Tax Information Section */}
          <Card className="shadow-sm border-gray-200 accordion-section">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition-colors duration-200 accordion-header"
              onClick={() => toggleSection('tax')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Percent className="h-6 w-6 text-amber-600" />
                  <CardTitle className="text-xl text-gray-900">Tax Information</CardTitle>
                </div>
                {expandedSections.has('tax') ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            {expandedSections.has('tax') && (
              <CardContent className="pt-0 space-y-6 fade-in">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Manage Company Taxes</h3>
                    <p className="text-sm text-gray-500">
                      Configure reusable tax labels that stay in sync across your inventory workflows.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddTaxEntry();
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 transition-transform duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add Tax Entry
                  </Button>
                </div>

                {(() => {
                  const activeEntries = taxEntries.filter((entry) => !entry._isDeleted);

                  if (activeEntries.length === 0) {
                    return (
                      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center bg-white shadow-sm fade-in">
                        <p className="text-sm text-gray-500">
                          No tax entries yet. Click &ldquo;Add Tax Entry&rdquo; to create your first tax configuration.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {activeEntries.map((entry) => {
                        const entryIndex = taxEntries.findIndex((item) => item === entry);
                        if (entryIndex === -1) {
                          return null;
                        }

                        const labelError = errors[`tax_label_${entryIndex}`];
                        const valueError = errors[`tax_value_${entryIndex}`];

                        return (
                          <div
                            key={entry.id ?? `new-tax-${entryIndex}`}
                            className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
                          >
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="md:col-span-2">
                                  <Label htmlFor={`tax-label-${entryIndex}`} className="text-sm font-medium text-gray-700">
                                    Tax Name<span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id={`tax-label-${entryIndex}`}
                                    value={entry.label}
                                    placeholder="e.g. GST"
                                    className={`mt-1 ${labelError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                    onChange={(e) => handleTaxEntryChange(entryIndex, 'label', e.target.value)}
                                  />
                                  {labelError && <p className="text-xs text-red-500 mt-1">{labelError}</p>}
                                </div>

                                <div className="md:col-span-1">
                                  <Label htmlFor={`tax-value-${entryIndex}`} className="text-sm font-medium text-gray-700">
                                    Rate (%)
                                  </Label>
                                  <div className="relative">
                                    <Input
                                      id={`tax-value-${entryIndex}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="18"
                                      value={entry.value ?? ''}
                                      className={`mt-1 pr-10 ${valueError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                      onChange={(e) => handleTaxEntryChange(entryIndex, 'value', e.target.value)}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                                  </div>
                                  {valueError && <p className="text-xs text-red-500 mt-1">{valueError}</p>}
                                </div>

                                {/* <div className="md:col-span-1 flex flex-col justify-end">
                                  <Label className="text-sm font-medium text-gray-700">Status</Label>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Switch
                                      checked={entry.is_active}
                                      onCheckedChange={(checked) => handleTaxEntryChange(entryIndex, 'is_active', checked)}
                                    />
                                    <span className={`text-sm ${entry.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                                      {entry.is_active ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </div>
                                </div> */}

                                <div className="md:col-span-1 flex items-end justify-start md:justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleRemoveTaxEntry(entryIndex)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </Button>
                                </div>
                              </div>

                              {/* {entry.created_at && !entry._isNew && (
                                <p className="text-xs text-gray-400">
                                  Created on {new Date(entry.created_at).toLocaleString()}
                                </p>
                              )} */}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            )}
          </Card>

          {/* Global Discount Section */}
          <Card className="shadow-sm border-gray-200 accordion-section">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition-colors duration-200 accordion-header"
              onClick={() => toggleSection('discount')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="h-6 w-6 text-blue-600" />
                  <CardTitle className="text-xl text-gray-900">Global Discount</CardTitle>
                </div>
                {expandedSections.has('discount') ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            {expandedSections.has('discount') && (
              <CardContent className="pt-0 space-y-6 fade-in">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Manage Global Discounts</h3>
                    <p className="text-sm text-gray-500">
                      Configure reusable discount labels with percentage values that stay in sync across your inventory workflows.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddDiscountEntry();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-transform duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add Discount Entry
                  </Button>
                </div>

                {(() => {
                  const activeEntries = discountEntries.filter((entry) => !entry._isDeleted);

                  if (activeEntries.length === 0) {
                    return (
                      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center bg-white shadow-sm fade-in">
                        <p className="text-sm text-gray-500">
                          No discount entries yet. Click &ldquo;Add Discount Entry&rdquo; to create your first discount configuration.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {activeEntries.map((entry) => {
                        const entryIndex = discountEntries.findIndex((item) => item === entry);
                        if (entryIndex === -1) {
                          return null;
                        }

                        const labelError = errors[`discount_label_${entryIndex}`];
                        const valueError = errors[`discount_value_${entryIndex}`];

                        return (
                          <div
                            key={entry.id ?? `new-discount-${entryIndex}`}
                            className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1"
                          >
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="md:col-span-2">
                                  <Label htmlFor={`discount-label-${entryIndex}`} className="text-sm font-medium text-gray-700">
                                    Discount Name<span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id={`discount-label-${entryIndex}`}
                                    value={entry.label}
                                    placeholder="e.g. Early Bird Discount"
                                    className={`mt-1 ${labelError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                    onChange={(e) => handleDiscountEntryChange(entryIndex, 'label', e.target.value)}
                                  />
                                  {labelError && <p className="text-xs text-red-500 mt-1">{labelError}</p>}
                                </div>

                                <div className="md:col-span-1">
                                  <Label htmlFor={`discount-value-${entryIndex}`} className="text-sm font-medium text-gray-700">
                                    Percentage (%)
                                  </Label>
                                  <div className="relative">
                                    <Input
                                      id={`discount-value-${entryIndex}`}
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      placeholder="10"
                                      value={entry.value ?? ''}
                                      className={`mt-1 pr-10 ${valueError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                      onChange={(e) => handleDiscountEntryChange(entryIndex, 'value', e.target.value)}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                                  </div>
                                  {valueError && <p className="text-xs text-red-500 mt-1">{valueError}</p>}
                                </div>

                                <div className="md:col-span-1 flex items-end justify-start md:justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleRemoveDiscountEntry(entryIndex)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            )}
          </Card>

          {/* Employee ID Configuration Section */}
          <Card className="shadow-sm border-gray-200 accordion-section">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition-colors duration-200 accordion-header"
              onClick={() => toggleSection('employeeId')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-6 w-6 text-indigo-600" />
                  <CardTitle className="text-xl text-gray-900">Employee ID Configuration</CardTitle>
                </div>
                {expandedSections.has('employeeId') ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            {expandedSections.has('employeeId') && (
              <CardContent className="pt-0 space-y-6 fade-in">
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Configure Employee ID Generation</h3>
                  <p className="text-sm text-gray-500">
                    Set up how employee IDs are generated for new users in your company.
                  </p>
                  {isEmployeeIdConfigLocked && (
                    <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Employee ID configuration is locked because users already exist with employee IDs.
                      You can no longer modify this configuration.
                    </p>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Auto-generate toggle */}
                  <div className="form-field">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="autoGenerateEmployeeId"
                        checked={employeeIdConfig.autoGenerate}
                        onChange={(e) => {
                          if (isEmployeeIdConfigLocked) return;
                          setEmployeeIdConfig({
                            ...employeeIdConfig,
                            autoGenerate: e.target.checked,
                          });
                          setErrors((prev) => {
                            const updated = { ...prev };
                            delete updated.employeeIdPrefix;
                            delete updated.employeeIdSequence;
                            return updated;
                          });
                        }}
                        disabled={isEmployeeIdConfigLocked}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <Label htmlFor="autoGenerateEmployeeId" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Auto-generate Employee ID
                      </Label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-7">
                      When enabled, employee IDs will be automatically generated using the prefix and sequence below.
                    </p>
                  </div>

                  {/* Configuration fields - only show when auto-generate is enabled */}
                  {employeeIdConfig.autoGenerate && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-7 border-l-2 border-blue-200 bg-blue-50/30 p-4 rounded-lg">
                      <div className="form-field">
                        <Label htmlFor="employeeIdPrefix" className="text-sm font-medium text-gray-700">
                          Prefix <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="employeeIdPrefix"
                          value={employeeIdConfig.prefix}
                          onChange={(e) => {
                            if (isEmployeeIdConfigLocked) return;
                            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            setEmployeeIdConfig({
                              ...employeeIdConfig,
                              prefix: value,
                            });
                            setErrors((prev) => {
                              const updated = { ...prev };
                              delete updated.employeeIdPrefix;
                              return updated;
                            });
                          }}
                          className={`mt-1 ${errors.employeeIdPrefix ? 'border-red-500' : ''}`}
                          disabled={isEmployeeIdConfigLocked}
                          placeholder="EMP"
                          maxLength={10}
                        />
                        {errors.employeeIdPrefix && (
                          <p className="text-xs text-red-500 mt-1">{errors.employeeIdPrefix}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Prefix for employee IDs (e.g., EMP, STAFF, USER)
                        </p>
                      </div>

                      <div className="form-field">
                        <Label htmlFor="employeeIdSequence" className="text-sm font-medium text-gray-700">
                          Starting Sequence <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="employeeIdSequence"
                          type="number"
                          min="0"
                          step="1"
                          value={employeeIdConfig.startingSequence}
                          onChange={(e) => {
                            if (isEmployeeIdConfigLocked) return;
                            const value = parseInt(e.target.value, 10) || 0;
                            setEmployeeIdConfig({
                              ...employeeIdConfig,
                              startingSequence: value,
                            });
                            setErrors((prev) => {
                              const updated = { ...prev };
                              delete updated.employeeIdSequence;
                              return updated;
                            });
                          }}
                          className={`mt-1 ${errors.employeeIdSequence ? 'border-red-500' : ''}`}
                          disabled={isEmployeeIdConfigLocked}
                          placeholder="1"
                        />
                        {errors.employeeIdSequence && (
                          <p className="text-xs text-red-500 mt-1">{errors.employeeIdSequence}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Starting number for the sequence (e.g., 1, 100, 1000)
                        </p>
                      </div>

                      {/* Preview */}
                      <div className="md:col-span-2 form-field">
                        <Label className="text-sm font-medium text-gray-700">Preview</Label>
                        <div className="mt-1 p-3 bg-white border border-gray-200 rounded-md">
                          <p className="text-sm text-gray-600">
                            Example IDs: <span className="font-mono font-semibold text-blue-600">
                              {employeeIdConfig.prefix}{String(employeeIdConfig.startingSequence).padStart(4, '0')}
                            </span>
                            , <span className="font-mono font-semibold text-blue-600">
                              {employeeIdConfig.prefix}{String(employeeIdConfig.startingSequence + 1).padStart(4, '0')}
                            </span>
                            , <span className="font-mono font-semibold text-blue-600">
                              {employeeIdConfig.prefix}{String(employeeIdConfig.startingSequence + 2).padStart(4, '0')}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!employeeIdConfig.autoGenerate && (
                    <div className="pl-7 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600">
                        <Info className="h-4 w-4 inline mr-1" />
                        When auto-generate is disabled, users will manually enter their employee ID when creating new users.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Settings Section */}
          <Card className="shadow-sm border-gray-200 accordion-section">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition-colors duration-200 accordion-header"
              onClick={() => toggleSection('settings')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-green-600" />
                  <CardTitle className="text-xl text-gray-900">System Settings</CardTitle>
                </div>
                {expandedSections.has('settings') ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            {expandedSections.has('settings') && (
              <CardContent className="pt-0">
                <div className="space-y-6">
                  <div className="form-field">
                    <Label htmlFor="company_email" className="text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="company_email"
                      value={companyEmail ?? ""}
                      // onChange={(e) => setSystemSettings({ ...systemSettings, email_url: e.target.value })}
                      className={`mt-1 ${errors.email_url ? 'border-red-500' : ''}`}
                      placeholder="Enter email service URL"
                      readOnly
                    />
                    {errors.email_url && <p className="text-red-500 text-xs mt-1">{errors.email_url}</p>}
                  </div>

                  <div>
                    {isEmailAuthenticated && emailRefreshToken ? (
                      <p className="text-green-600 flex text-sm">
                        <ShieldCheck className='h-5 w-5 mr-1' /> Email is verified & authenticated.
                      </p>
                    ) : (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                type="button"
                                onClick={() => authenticateEmail(companyInfo.id, user.id)}
                                disabled={!hasModulePermission('Save Company details') || isAuthenticating}
                                className="text-white bg-blue-600 hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg me-2"
                              >
                                {isAuthenticating ? (
                                  <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Authenticating...
                                  </span>
                                ) : (<span className="flex items-center">
                                  Authenticate Email
                                </span>
                                )}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {hasModulePermission('Save Company details')
                              ? 'Authenticate Email'
                              : 'You do not have permission to make changes'}
                          </TooltipContent>
                        </Tooltip>
                        <p className="text-gray-600 flex text-xs mt-2">
                          <Info className='h-4 w-4 mr-1' /> Emails can only be sent from authenticated email addresses.
                        </p>
                      </>
                    )}
                  </div>
                  {/* <div className="form-field">
                    <Label htmlFor="email_token" className="text-sm font-medium text-gray-700">
                      Email Token *
                    </Label>
                    <Input
                      id="email_token"
                      type="password"
                      value={systemSettings.email_token}
                      onChange={(e) => setSystemSettings({ ...systemSettings, email_token: e.target.value })}
                      className={`mt-1 ${errors.email_token ? 'border-red-500' : ''}`}
                      placeholder="Enter email service token"
                    />
                    {errors.email_token && <p className="text-red-500 text-xs mt-1">{errors.email_token}</p>}
                  </div> */}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Customization Section */}
          <Card className="shadow-sm border-gray-200 accordion-section">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 transition-colors duration-200 accordion-header"
              onClick={() => toggleSection('customization')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-purple-600" />
                  <CardTitle className="text-xl text-gray-900">Report Customization</CardTitle>
                </div>
                {expandedSections.has('customization') ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            {expandedSections.has('customization') && (
              <CardContent className="pt-0">
                <div className="space-y-8">
                  {/* Purchase Order Report */}
                  <div className="border border-gray-200 rounded-lg">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => toggleReportSection('purchase_order')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <h3 className="text-lg font-semibold text-gray-800">Purchase Order Report</h3>
                      </div>
                      {expandedReportSections.has('purchase_order') ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                    </div>

                    {expandedReportSections.has('purchase_order') && (
                      <div className="px-4 pb-4 space-y-4">
                        <div className="form-field">
                          <Label htmlFor="poPaymentDetails" className="text-sm font-medium text-gray-700">
                            Payment Details
                          </Label>
                          <Textarea
                            id="poPaymentDetails"
                            value={reportConfig.purchaseOrderReport.payment_details || ''}
                            onChange={(e) => setReportConfig({
                              ...reportConfig,
                              purchaseOrderReport: {
                                ...reportConfig.purchaseOrderReport,
                                payment_details: e.target.value
                              }
                            })}
                            className="mt-1"
                            placeholder="Enter payment details template"
                            rows={3}
                          />
                        </div>

                        <div className="form-field">
                          <Label htmlFor="poRemarks" className="text-sm font-medium text-gray-700">
                            Remarks
                          </Label>
                          <Textarea
                            id="poRemarks"
                            value={reportConfig.purchaseOrderReport.remarks || ''}
                            onChange={(e) => setReportConfig({
                              ...reportConfig,
                              purchaseOrderReport: {
                                ...reportConfig.purchaseOrderReport,
                                remarks: e.target.value
                              }
                            })}
                            className="mt-1"
                            placeholder="Enter remarks template"
                            rows={3}
                          />
                        </div>

                        <div className="form-field">
                          <Label htmlFor="poFooter" className="text-sm font-medium text-gray-700">
                            Report Footer
                          </Label>
                          <Textarea
                            id="poFooter"
                            value={reportConfig.purchaseOrderReport.report_footer || ''}
                            onChange={(e) => setReportConfig({
                              ...reportConfig,
                              purchaseOrderReport: {
                                ...reportConfig.purchaseOrderReport,
                                report_footer: e.target.value
                              }
                            })}
                            className="mt-1"
                            placeholder="Enter report footer template"
                            rows={3}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sales Report */}
                  <div className="border border-gray-200 rounded-lg">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => toggleReportSection('sales')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <h3 className="text-lg font-semibold text-gray-800">Sales Report</h3>
                      </div>
                      {expandedReportSections.has('sales') ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                    </div>

                    {expandedReportSections.has('sales') && (
                      <div className="px-4 pb-4 space-y-4">
                        <div className="form-field">
                          <Label htmlFor="salesRemarks" className="text-sm font-medium text-gray-700">
                            Remarks
                          </Label>
                          <Textarea
                            id="salesRemarks"
                            value={reportConfig.salesReport.remarks || ''}
                            onChange={(e) => setReportConfig({
                              ...reportConfig,
                              salesReport: {
                                ...reportConfig.salesReport,
                                remarks: e.target.value
                              }
                            })}
                            className="mt-1"
                            placeholder="Enter remarks template"
                            rows={3}
                          />
                        </div>

                        <div className="form-field">
                          <Label htmlFor="salesFooter" className="text-sm font-medium text-gray-700">
                            Report Footer
                          </Label>
                          <Textarea
                            id="salesFooter"
                            value={reportConfig.salesReport.report_footer || ''}
                            className="mt-1"
                            placeholder="Enter report footer template"
                            rows={3}
                            onChange={(e) => setReportConfig({
                              ...reportConfig,
                              salesReport: {
                                ...reportConfig.salesReport,
                                report_footer: e.target.value
                              }
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stock Report */}
                  <div className="border border-gray-200 rounded-lg">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                      onClick={() => toggleReportSection('stock')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <h3 className="text-lg font-semibold text-gray-800">Stock Report</h3>
                      </div>
                      {expandedReportSections.has('stock') ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                    </div>

                    {expandedReportSections.has('stock') && (
                      <div className="px-4 pb-4 space-y-4">
                        <div className="form-field">
                          <Label htmlFor="stockRemarks" className="text-sm font-medium text-gray-700">
                            Remarks
                          </Label>
                          <Textarea
                            id="stockRemarks"
                            value={reportConfig.stockReport.remarks || ''}
                            onChange={(e) => setReportConfig({
                              ...reportConfig,
                              stockReport: {
                                ...reportConfig.stockReport,
                                remarks: e.target.value
                              }
                            })}
                            className="mt-1"
                            placeholder="Enter remarks template"
                            rows={3}
                          />
                        </div>

                        <div className="form-field">
                          <Label htmlFor="stockFooter" className="text-sm font-medium text-gray-700">
                            Report Footer
                          </Label>
                          <Textarea
                            id="stockFooter"
                            value={reportConfig.stockReport.report_footer || ''}
                            onChange={(e) => setReportConfig({
                              ...reportConfig,
                              stockReport: {
                                ...reportConfig.stockReport,
                                report_footer: e.target.value
                              }
                            })}
                            className="mt-1"
                            placeholder="Enter report footer template"
                            rows={3}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-8 flex justify-end">
          {renderSaveButton()}
        </div>
      </div>
    </div>
  );
};

export default CompanyAdministration;
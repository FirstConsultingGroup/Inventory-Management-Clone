import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/Utils/types/supabaseClient';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, Clock } from "lucide-react";
import generateInvoicePDF from './InvoicePrintTemplate';
import { IUser } from '@/Utils/constants';
import { useApprovalDocument } from '@/hooks/useApprovalDocument';
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';
import { useAppSelector } from '@/hooks/redux';
import { formatCurrency } from '@/Utils/formatters';

type TaxPercentages = Record<string, number>;
interface InvoiceItem {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  tax_percentage?: TaxPercentages | null;
}

interface Company {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  modified_at: string;
}

interface SalesInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  contact_number: string;
  invoice_date: string;
  net_amount: number;
  status: "paid" | "pending" | "overdue";
  billing_address: string;
  email: string;
  total_items: number;
  invoice_amount: number;
  discount_amount: number;
  tax_amount: number;
  company: Company;
  items: InvoiceItem[];
  total_discount_amount: number | null | undefined;
  total_discount_percentage: number | null | undefined;
  freight_charges: number | null | undefined;
}

export default function InvoiceView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request_id');
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userInfo = useAppSelector((state) => state.user.userData);
  const user = localStorage.getItem('userData');
  const userData: IUser | null = user ? JSON.parse(user) : null;
  const companyId = userData?.company_id || null;
  
  const [isPending, setIsPending] = useState(false);
  const [actionName, setActionName] = useState('');
  const [requestDetails, setRequestDetails] = useState<any>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) {
        setError('Invoice ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        if (id === 'pending' && requestId) {
          setIsPending(true);
          const { data: requestData, error: requestError } = await supabase
            .from('approval_requests')
            .select(`
                id,
                payload,
                current_level,
                status,
                created_at,
                reference_number,
                actions:action_id(action_name),
                users:requested_by(first_name, last_name)
            `)
            .eq('id', requestId)
            .single();

          if (requestError) throw requestError;

          const action = Array.isArray(requestData.actions)
            ? requestData.actions[0]?.action_name
            : (requestData.actions as any)?.action_name || 'Unknown Action';
          setActionName(action);

          const requestedByObj = Array.isArray(requestData.users)
            ? requestData.users[0]
            : (requestData.users as any);

          setRequestDetails({
            requestedBy: requestedByObj ? `${requestedByObj.first_name || ''} ${requestedByObj.last_name || ''}`.trim() : 'Unknown',
            level: requestData.current_level,
            status: requestData.status,
            createdAt: requestData.created_at,
            referenceNumber: requestData.reference_number
          });

          let parsedPayload: any = requestData.payload;
          if (typeof parsedPayload === 'string') {
              try { parsedPayload = JSON.parse(parsedPayload); } catch(e) {}
          }
          const operations = parsedPayload?.operations || [];
          const invoiceOp = operations.find((op: any) => op.table === 'sales_invoice');
          const itemOps = operations.filter((op: any) => op.table === 'sales_invoice_items' && op.type === 'insert');
          const itemsArray = itemOps.flatMap((op: any) => Array.isArray(op.data) ? op.data : [op.data]);
          const itemIds = itemsArray.map((data: any) => data.item_id).filter(Boolean);

          if (!invoiceOp) {
            setError('No invoice data found in pending request');
            setLoading(false);
            return;
          }

          const invData = invoiceOp.data;
          
          const { data: itemMeta } = await supabase.from('item_mgmt').select('id, item_name, item_id').in('id', itemIds);
          
          const items = itemsArray.map((data: any, index: number) => {
             const meta = itemMeta?.find(i => i.id === data.item_id);
             return {
                 id: `pending-item-${index}`,
                 item_id: data.item_id,
                 item_code: meta?.item_id || 'Unknown',
                 item_name: meta?.item_name || 'Unknown',
                 quantity: data.quantity,
                 unit_price: data.unit_price,
                 discount_percentage: data.discount_percentage || 0,
                 tax_percentage: data.tax_percentage || null
             } as InvoiceItem;
          });

          // Fetch company details
          const { data: compData } = await supabase.from('company_master').select('*').eq('id', companyId!).single();

          const tempInvoice: SalesInvoice = {
             id: 'pending',
             invoice_number: invData.invoice_number || requestData.reference_number || 'Pending',
             customer_name: invData.customer_name || 'Pending Customer',
             contact_number: invData.contact_number || '',
             invoice_date: invData.invoice_date || new Date().toISOString(),
             net_amount: invData.net_amount || 0,
             status: invData.status || "pending",
             billing_address: invData.billing_address || '',
             email: invData.email || '',
             total_items: items.length,
             invoice_amount: invData.invoice_amount || 0,
             discount_amount: invData.discount_amount || 0,
             tax_amount: invData.tax_amount || 0,
             company: compData as Company,
             items: items,
             total_discount_amount: invData.total_discount_amount,
             total_discount_percentage: invData.total_discount_percentage,
             freight_charges: invData.freight_charges,
          };
          setInvoice(tempInvoice);

          if (invData.customer_id) {
             const { data: custData } = await supabase.from('customer_mgmt').select('fullname, phone, address, email').eq('id', invData.customer_id).single();
             if (custData) {
                setInvoice(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        customer_name: custData.fullname || prev.customer_name,
                        contact_number: custData.phone || prev.contact_number,
                        billing_address: custData.address || prev.billing_address,
                        email: custData.email || prev.email
                    };
                });
             }
          }

        } else {
          setIsPending(false);
          const { data, error: rpcError } = await supabase.rpc("get_sales_invoice_by_id", {
            company_id_param: companyId!,
            invoice_id_param: id
          });

          if (rpcError) {
            console.error('RPC Error:', rpcError);
            return;
          }

          if (!data) {
            setError('No invoice data found');
            return;
          }
          const result = data as unknown as SalesInvoice;
          console.log("Current invoice =>", result)
          setInvoice(result);
        }
      } catch (err) {
        console.error('Error fetching invoice:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id, requestId, companyId]);

  const extractTaxLabels = (items: InvoiceItem[]) => {
    const labelSet = new Set<string>();

    items.forEach(item => {
      if (item.tax_percentage && typeof item.tax_percentage === "object") {
        Object.keys(item.tax_percentage).forEach(label => labelSet.add(label));
      }
    });

    return Array.from(labelSet).sort();
  };

  const dynamicTaxLabels = useMemo(() => {
    return invoice?.items ? extractTaxLabels(invoice.items) : [];
  }, [invoice]);

  const taxTotals = useMemo(() => {
    if (!invoice?.items) return {};

    const totals: Record<string, number> = {};

    invoice.items.forEach(item => {
      const gross = item.quantity * item.unit_price;
      const discount = (item.discount_percentage / 100) * gross;
      const afterDiscount = gross - discount;

      const taxes = item.tax_percentage && typeof item.tax_percentage === "object"
        ? item.tax_percentage
        : {};

      Object.entries(taxes).forEach(([label, percent]) => {
        if (typeof percent === "number" && percent > 0) {
          const taxAmount = (afterDiscount * percent) / 100;

          totals[label] = (totals[label] || 0) + taxAmount;
        }
      });
    });

    return totals;
  }, [invoice]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handlePrint = () => {
    if (!invoice) return;

    const invoiceData = {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      customer: {
        name: invoice.customer_name,
        contact: invoice.contact_number,
        address: invoice.billing_address,
      },
      companyInfo: {
        ...userInfo?.company_data,
      },
      vehicle: {
        plateNo: "N/A",
        kms: "N/A",
        brand: "N/A",
        model: "N/A",
        vinNo: "N/A",
        emirates: "N/A",
      },
      insurance: {
        provider: "N/A",
        claimNo: "N/A",
        lpoNo: "N/A",
      },
      paymentType: "Cash",
      items: invoice.items.map(item => {
        const grossAmount = item.quantity * item.unit_price;
        const discountAmount = (item.discount_percentage / 100) * grossAmount;
        const totalAfterDiscount = grossAmount - discountAmount;
        const taxes: Record<string, number> =
          item.tax_percentage && typeof item.tax_percentage === "object"
            ? item.tax_percentage
            : {};

        const totalTaxPercentage = Object.values(taxes)
          .filter(v => typeof v === "number" && !isNaN(v) && v > 0)
          .reduce((sum, v) => sum + v, 0);
        const taxAmount = (totalAfterDiscount * totalTaxPercentage) / 100;
        const netAmount = grossAmount - discountAmount + taxAmount;

        return {
          id: item.id,
          itemNumber: item.item_code,
          name: item.item_name,
          description: "",
          quantity: item.quantity,
          unitPrice: item.unit_price,
          sellingPrice: item.unit_price,
          amount: grossAmount,
          discount: discountAmount,
          grossAmount: grossAmount,
          vat: taxAmount,
          netAmount: netAmount,
          tax_percentage: item.tax_percentage,
          discount_percentage: item.discount_percentage
        };
      }),
      date: invoice.invoice_date,
      status: invoice.status,
      paymentDetails: {
        type: "Cash",
        terms: "Net 30"
      },
      totals: {
        grossAmount: invoice.invoice_amount,
        itemsItotalDiscount: invoice.discount_amount,
        totalTaxAmount: invoice.tax_amount,
        netAmount: invoice.net_amount,
        taxTotals,
        totalDiscountAmount: invoice.total_discount_amount,
        totalDiscountPercentage: invoice.total_discount_percentage,
        freightCharges: invoice.freight_charges,
      },
      taxLabels: dynamicTaxLabels,
    };

    generateInvoicePDF(invoiceData);
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading invoice...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6 text-center">
              <p className="text-red-600 mb-4">{error || 'Invoice not found'}</p>
              <Button onClick={() => navigate(-1)} className="bg-blue-600 hover:bg-blue-700">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Invoices
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen print:p-0 print:bg-white">
      <div className="max-w-6xl mx-auto space-y-6 print:space-y-0">
        <PendingApprovalBanner />
        <div className="flex items-center justify-between print:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-blue-600" />
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        <Card className="border-none shadow-lg print:shadow-none print:border-none">
          <CardContent className="p-6 print:p-8">
            <div id="invoice-content" className="space-y-8 print:min-h-[29.7cm]">
              {/* Header Section */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-6 print:pb-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold text-blue-800">{userInfo?.company_data.name}</h1>
                  <p className="text-gray-600">{userInfo?.company_data.description}</p>
                  <p className="text-gray-600">{userInfo?.company_data.address}</p>
                  <p className="text-gray-600">{userInfo?.company_data.city}, {userInfo?.company_data.state}, {userInfo?.company_data.postal_code}</p>
                  <p className="text-gray-600">Phone: {userInfo?.company_data.phone}</p>
                  {invoice.email && <p className="text-gray-600">Email: {userInfo?.company_data.email}</p>}
                </div>
                <div className="text-right space-y-2">
                  <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                  <p className="text-gray-600">Invoice #: {invoice.invoice_number}</p>
                  <p className="text-gray-600">Date: {new Date(invoice.invoice_date).toLocaleDateString()}</p>
                  <Badge className={`${getStatusColor(invoice.status)} px-3 py-1 text-sm font-semibold capitalize`}>
                    {invoice.status}
                  </Badge>
                </div>
              </div>

              {/* Bill To and Summary Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Bill To</h3>
                  <div className="border-l-4 border-blue-600 pl-4 space-y-1">
                    <p className="text-lg font-medium text-gray-800">{invoice.customer_name}</p>
                    <p className="text-gray-600">Contact: {invoice.contact_number}</p>
                    {invoice.email && <p className="text-gray-600">Email: {invoice.email}</p>}
                    {invoice.billing_address && <p className="text-gray-600">{invoice.billing_address}</p>}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Invoice Summary</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Items:</span>
                      <span className="font-medium">{invoice.total_items}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Gross Amount:</span>
                      <span className="font-medium">{formatCurrency(invoice.invoice_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Items Discount:</span>
                      <span className="font-medium text-green-600">-{formatCurrency(invoice.discount_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Discount Amount ({invoice.total_discount_percentage}%):</span>
                      <span className="font-medium text-green-600">-{formatCurrency(invoice.total_discount_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Tax Amount:</span>
                      <span className="font-medium text-blue-600">+{formatCurrency(invoice.tax_amount ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Freight Charges:</span>
                      <span className="font-medium text-blue-600">+{formatCurrency(invoice.freight_charges ?? 0)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-3">
                      <span className="text-gray-800 font-semibold">Net Amount:</span>
                      <span className="font-bold text-blue-600">{formatCurrency(invoice.net_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-blue-50">
                      <TableRow>
                        <TableHead className="text-sm font-medium text-blue-800">Item Name</TableHead>
                        <TableHead className="text-sm font-medium text-blue-800 text-center">Qty</TableHead>
                        <TableHead className="text-sm font-medium text-blue-800 text-right">Unit Price</TableHead>
                        {dynamicTaxLabels.map(label => (
                          <TableHead key={label} className="text-sm font-medium text-blue-800 text-right pe-2">
                            {label}
                          </TableHead>
                        ))}
                        <TableHead className="text-sm font-medium text-blue-800 text-right">Discount</TableHead>
                        <TableHead className="text-sm font-medium text-blue-800 text-right">Gross Amount</TableHead>
                        <TableHead className="text-sm font-medium text-blue-800 text-right">Net Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.items.map((item) => {
                        const grossAmount = item.quantity * item.unit_price;
                        const discountAmount = (item.discount_percentage / 100) * grossAmount;
                        const totalAfterDiscount = grossAmount - discountAmount;
                        const taxes: Record<string, number> = item.tax_percentage && typeof item.tax_percentage === "object" ? item.tax_percentage : {};
                        const totalTaxPercentage = Object.values(taxes)
                          .filter(v => typeof v === "number" && !isNaN(v) && v > 0)
                          .reduce((sum, v) => sum + v, 0);
                        const taxAmount = (totalAfterDiscount * totalTaxPercentage) / 100;
                        const netAmount = grossAmount - discountAmount + taxAmount;

                        return (
                          <TableRow key={item.id} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="font-medium text-gray-800">{item.item_name}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                            {dynamicTaxLabels.map(label => {
                              const taxes = item.tax_percentage && typeof item.tax_percentage === "object"
                                ? item.tax_percentage
                                : {};

                              const taxPercent = taxes[label] || 0;

                              const base = (item.quantity || 0) * (item.unit_price || 0);
                              const itemDiscountPct = item.discount_percentage || 0;
                              const itemDiscountAmt = (base * itemDiscountPct) / 100;
                              const baseAfterDiscount = base - itemDiscountAmt;

                              const taxAmountForLabel = (baseAfterDiscount * taxPercent) / 100;

                              return (
                                <td key={label} className="py-3 text-sm text-end pe-2">
                                  {taxPercent > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-sm font-semibold">
                                        {taxPercent}%
                                      </span>
                                      <span className="text-[11px] text-blue-600 mt-1">
                                        +{formatCurrency(taxAmountForLabel)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              );
                            })}

                            <TableCell className="text-end">
                              {item.discount_percentage > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-semibold">
                                    {item.discount_percentage}%
                                  </span>
                                  <span className="text-[11px] text-green-600 mt-1">
                                    -{formatCurrency((item.quantity * item.unit_price * item.discount_percentage) / 100)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(grossAmount)}
                              {discountAmount > 0 && (
                                <div className="text-xs text-green-600">-{formatCurrency(discountAmount)}</div>
                              )}
                              {taxAmount > 0 && (
                                <div className="text-xs text-blue-600">+{formatCurrency(taxAmount)}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(netAmount)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totals Section */}
              <div className="flex justify-end">
                <div className="w-full max-w-md">
                  <div className="bg-gray-50 p-6 rounded-lg space-y-2">
                    <div className="flex justify-between text-gray-900 font-semibold">
                      <span>Gross Total:</span>
                      <span>{formatCurrency(invoice.invoice_amount)}</span>
                    </div>
                    <div className="flex justify-between text-gray-900 font-semibold">
                      <span>Total Items Discount:</span>
                      <span className='text-green-600'>-{formatCurrency(invoice.discount_amount)}</span>
                    </div>
                    <div className="flex justify-between text-gray-900 font-semibold">
                      <span>Total Discount Amount ({invoice.total_discount_percentage}%):</span>
                      <span className='text-green-600'>-{formatCurrency(invoice.total_discount_amount)}</span>
                    </div>
                    {/* <div className="flex justify-between text-gray-800 font-semibold border-t pt-3">
                      <span>Subtotal:</span>
                      <span>{formatCurrency((invoice.invoice_amount - invoice.discount_amount))}</span>
                    </div> */}
                    {dynamicTaxLabels.map(label => (
                      <div key={label} className="flex justify-between text-xs text-gray-600 space-y-1">
                        <span>{label}:</span>
                        <span>{formatCurrency(taxTotals[label] || 0)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-gray-900 font-semibold">
                      <span>Total Tax Amount:</span>
                      <span className='text-blue-600'>+{formatCurrency(invoice.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between text-gray-900 font-semibold">
                      <span>Freight Charges:</span>
                      <span className='text-blue-600'>+{formatCurrency(invoice.freight_charges)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg text-blue-600 border-t-2 pt-3">
                      <span>Total Amount:</span>
                      <span>{formatCurrency(invoice.net_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Section */}
              <div className="border-t pt-6 print:pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800">Payment Instructions</h4>
                    <p className="text-gray-600 text-sm">Please make payment via bank transfer to:</p>
                    <p className="text-gray-600 text-sm">Bank: {userInfo?.company_data?.bank_name}</p>
                    <p className="text-gray-600 text-sm">Account: {userInfo?.company_data?.bank_account_number}</p>
                    <p className="text-gray-600 text-sm">Reference: {invoice.invoice_number}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-800">Terms & Conditions</h4>
                    <p className="text-gray-600 text-sm">
                      Payment is due within 30 days. Please include the invoice number as reference.
                      Late payments may incur additional charges.
                    </p>
                  </div>
                </div>
                <div className="text-center mt-6 text-gray-500 text-sm print:fixed print:bottom-0 print:left-0 print:right-0">
                  <p>Thank you for your business!</p>
                  <p>For any queries, please contact us at support@{(invoice.company?.name || userInfo?.company_data?.name || 'ourcompany').toLowerCase().replace(/\s+/g, '')}.com</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
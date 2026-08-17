import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { supabase } from "@/Utils/types/supabaseClient";
import { PendingApprovalBanner } from '@/components/common/PendingApprovalBanner';
import { IPurchaseOrder } from "@/Utils/constants";
import { toast } from "react-hot-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import generatePurchaseOrderPDF from './PurchaseOrderPrintTemplate';
import { formatCurrency } from '@/Utils/formatters';
import { useAppSelector } from '@/hooks/redux';

// Custom interfaces to match Supabase query response
interface ItemMgmt {
  item_name: string;
  description: string | null;
  item_id: string | null;

}

interface SupplierMgmt {
  supplier_name: string | null;
  email: string | null;
  address: string | null;
}

interface StoreMgmt {
  name: string;
  address: string | null;
}

interface PurchaseOrderItem {
  created_at: string;
  id: string;
  is_active: boolean | null;
  item_id: string;
  modified_at: string | null;
  order_price: number | null;
  order_qty: number | null;
  purchase_order_id: string;
  received_qty: number | null;
  remarks: string | null;
  returned_qty: number | null;
  item_mgmt: ItemMgmt;
}

// Interface for combined PO data
interface PurchaseOrderViewData extends IPurchaseOrder {
  items: PurchaseOrderItem[];
  supplier: SupplierMgmt | null;
  store: StoreMgmt | null;
  order_status: string;
}

export default function PurchaseOrderView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request_id');
  const navigate = useNavigate();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [requestDetails, setRequestDetails] = useState<any>(null);
  const userInfo = useAppSelector((state) => state.user.userData);
  const companyData = userInfo?.company_data;
  useEffect(() => {
    const fetchPurchaseOrder = async () => {
      if (!id && !requestId) return;
      setLoading(true);

      try {
        if (id === 'pending' && requestId) {
          setIsPending(true);
          // Fetch from approval_requests
          const { data: requestData, error: requestError } = await (supabase as any)
            .from("approval_requests")
            .select("payload, current_level, status, created_at, users:requested_by(first_name, last_name)")
            .eq("id", requestId)
            .single();

          if (requestError) throw requestError;

          const requestedByObj = Array.isArray(requestData.users) 
              ? requestData.users[0] 
              : (requestData.users as any);

          setRequestDetails({
              requestedBy: requestedByObj ? `${requestedByObj.first_name || ''} ${requestedByObj.last_name || ''}`.trim() : 'Unknown',
              level: requestData.current_level,
              status: requestData.status,
              createdAt: requestData.created_at,
          });

          // Parse operations
          let parsedPayload: any = requestData.payload;
          if (typeof parsedPayload === 'string') {
              try { parsedPayload = JSON.parse(parsedPayload); } catch(e) {}
          }
          const operations = parsedPayload?.operations || [];
          const poOp = operations.find((op: any) => op.table === 'purchase_order' && op.type === 'insert');
          const itemOps = operations.filter((op: any) => op.table === 'purchase_order_items' && op.type === 'insert');

          if (!poOp) {
             toast.error("Pending payload does not contain Purchase Order data.");
             navigate("/dashboard/purchaseOrderManagement");
             return;
          }

          const poData = poOp.data;
          
          // Fetch relations
          const supplierPromise = poData.supplier_id ? supabase.from('supplier_mgmt').select('*').eq('id', poData.supplier_id).single() : Promise.resolve({ data: null });
          const storePromise = poData.store_id ? supabase.from('store_mgmt').select('*').eq('id', poData.store_id).single() : Promise.resolve({ data: null });
          
          const itemsArray = itemOps.flatMap((op: any) => Array.isArray(op.data) ? op.data : [op.data]);
          const itemIds = itemsArray.map((data: any) => data.item_id).filter(Boolean);
          const itemsPromise = itemIds.length > 0 ? supabase.from('item_mgmt').select('item_id:id, item_name, description').in('id', itemIds) : Promise.resolve({ data: [] });

          const [supplierRes, storeRes, itemsRes] = await Promise.all([supplierPromise, storePromise, itemsPromise]);

          const itemsLookup = (itemsRes.data || []).reduce((acc: any, item: any) => {
             acc[item.item_id] = item;
             return acc;
          }, {});

          const items = itemsArray.map((data: any, index: number) => ({
             id: `pending-item-${index}`,
             item_id: data.item_id,
             order_qty: data.order_qty,
             order_price: data.order_price,
             created_at: new Date().toISOString(),
             is_active: true,
             modified_at: null,
             purchase_order_id: poData.id || 'pending',
             received_qty: 0,
             remarks: '',
             returned_qty: 0,
             item_mgmt: itemsLookup[data.item_id] || { item_name: 'Unknown', description: null, item_id: data.item_id }
          }));

          setPurchaseOrder({
            ...poData,
            items,
            supplier: supplierRes.data,
            store: storeRes.data,
            order_status: poData.order_status || '',
          });

        } else {
          setIsPending(false);
          const { data, error } = await supabase
            .from("purchase_order")
            .select(`
              *,
              purchase_order_items (
                *,
                item_mgmt (item_name, description, item_id)
              ),
              supplier_mgmt (supplier_name, email, address),
              store_mgmt (name, address),
              system_message_config(*)
            `)
            .eq("id", id as string)
            .single();

          if (error) throw error;

          setPurchaseOrder({
            ...data,
            items: data.purchase_order_items,
            supplier: data.supplier_mgmt,
            store: data.store_mgmt,
            order_status: data.system_message_config?.sub_category_id ?? '',
          });
        }
      } catch (error) {
        console.error("Error fetching purchase order:", error);
        toast.error("Failed to load purchase order");
        navigate("/dashboard/purchaseOrderManagement");
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseOrder();
  }, [id, requestId, navigate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ORDER_CREATED": return "rgb(59, 130, 246)"; // blue
      case "ORDER_ISSUED": return "rgb(234, 179, 8)"; // yellow
      case "ORDER_RECEIVED": return "rgb(34, 197, 94)"; // green
      case "ORDER_PARTIALLY_RECEIVED": return "rgb(249, 115, 22)"; // orange
      case "ORDER_CANCELLED": return "rgb(239, 68, 68)"; // red
      default: return "rgb(107, 114, 128)"; // gray
    }
  };

  const generatePDF = () => {
    if (!purchaseOrder) return;

    const doc = new jsPDF();
    const companyData = userInfo?.company_data;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text("Purchase Order", 20, 20);

    // Company Details
    doc.setFontSize(11);
    doc.setTextColor(75, 85, 99);
    doc.text(companyData?.name || "GarageInventory", 20, 30);
    doc.text(companyData?.address || "123 Garage Street, City, State 12345", 20, 36);
    doc.text(`Phone: ${companyData?.phone || "(555) 123-4567"}`, 20, 42);

    // PO Details
    doc.setFontSize(11);
    doc.text(`PO #: ${purchaseOrder.po_number || "N/A"}`, 140, 30);
    doc.text(`Date: ${format(new Date(purchaseOrder.order_date), 'dd-MM-yyyy')}`, 140, 36);
    doc.text(`Status: ${purchaseOrder.order_status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || "N/A"}`, 140, 42);

    // Supplier and Store Info
    doc.setFontSize(11);
    doc.text("Supplier:", 20, 60);
    doc.text(purchaseOrder.supplier?.supplier_name || "N/A", 20, 66);
    doc.text(purchaseOrder.supplier?.address || "N/A", 20, 72);
    doc.text(purchaseOrder.supplier?.email || "N/A", 20, 78);

    doc.text("Delivery To:", 140, 60);
    doc.text(purchaseOrder.store?.name || "N/A", 140, 66);
    doc.text(purchaseOrder.store?.address || "N/A", 140, 72);

    // Items Table
    autoTable(doc, {
      startY: 90,
      head: [['Item Name', 'Description', 'Quantity', 'Cost Price', 'Total']],
      body: purchaseOrder.items.map((item) => {

        const unit = item.order_price && item.order_qty
          ? item.order_price / item.order_qty
          : 0;

        const formattedUnit = formatCurrency(unit).substring(1);         // 1200.00 → "1,200.00"
        const formattedTotal = formatCurrency(item.order_price ?? 0).substring(1);

        return [
          item.item_mgmt?.item_name || "N/A",
          item.item_mgmt?.description || "-",
          item.order_qty || 0,
          formattedUnit,
          formattedTotal
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 10 },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9 },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(11);
    doc.text(`Total Items: ${purchaseOrder.total_items || 0}`, 20, finalY + 10);

    const formattedGrandTotal = formatCurrency(purchaseOrder.total_value ?? 0).substring(1);
    doc.text(`Total Value: ${formattedGrandTotal}`, 20, finalY + 16);

    // Additional Details
    doc.text(`Payment Details: ${purchaseOrder.payment_details || 'N/A'}`, 20, finalY + 28);
    doc.text(`Remarks: ${purchaseOrder.remarks || 'N/A'}`, 20, finalY + 34);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text("Thank you for your business!", 20, finalY + 50);
    doc.text(`Contact: ${companyData?.email}`, 20, finalY + 56);

    return doc;
  };

  const handlePrint = () => {
    if (!purchaseOrder) return;
    const purchaseOrderWithUserInfo = { ...purchaseOrder, userInfo };
    generatePurchaseOrderPDF(purchaseOrderWithUserInfo, userInfo);
  };

  const handleDownloadPDF = () => {
    const doc = generatePDF();
    if (doc) {
      doc.save(`${purchaseOrder?.po_number || 'download'}.pdf`);
      toast.success("PDF downloaded successfully");
    }
  };

  if (loading || !purchaseOrder) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen print:p-0 print:m-0">
      <div className="max-w-4xl mx-auto space-y-8 print:space-y-0 print:max-w-none">
        <PendingApprovalBanner />

        {/* Action Header - Hidden when printing */}
        <div className="mb-6 flex items-center justify-between print:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
        >
          <ArrowLeft className="h-5 w-5 text-blue-600" />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div id="po-content" className="bg-white rounded-lg shadow-lg print:shadow-none print:w-full print:m-0 print:p-0">
        <div className="min-h-[29.7cm] p-8 print:p-0">
          {/* Header Section */}
          <div className="flex justify-between items-start mb-8 border-b pb-6 print:border-b-2">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">{userInfo?.company_data.name}</h1>
              <p className="text-gray-600 mt-1 text-sm">{userInfo?.company_data.description}</p>
              <p className="text-gray-600 text-sm">{userInfo?.company_data.address}</p>
              <p className="text-gray-600 text-sm">{userInfo?.company_data.city}, {userInfo?.company_data.state}, {userInfo?.company_data.postal_code}</p>
              <p className="text-gray-600 text-sm">Phone: {userInfo?.company_data.phone}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-blue-800">PURCHASE ORDER</h2>
              <p className="text-gray-600 mt-1 text-sm">PO #: {purchaseOrder.po_number || 'N/A'}</p>
              <p className="text-gray-600 text-sm">Date: {format(new Date(purchaseOrder.order_date), 'dd-MM-yyyy')}</p>
              <Badge
                style={{
                  backgroundColor: getStatusColor(purchaseOrder.order_status || 'Unknown'),
                  color: 'white',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '0.25rem',
                  marginTop: '0.5rem',
                  fontSize: '0.75rem'
                }}
              >
                {purchaseOrder.order_status
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown'}
              </Badge>
            </div>
          </div>

          {/* Supplier and Store Section */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-gray-800 font-semibold mb-2 text-sm">Supplier:</h3>
              <div className="border-l-4 border-blue-600 pl-4">
                <p className="text-gray-800 font-medium text-base">{purchaseOrder.supplier?.supplier_name || 'N/A'}</p>
                <p className="text-gray-600 text-sm">{purchaseOrder.supplier?.address || 'N/A'}</p>
                <p className="text-gray-600 text-sm">{purchaseOrder.supplier?.email || 'N/A'}</p>
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-gray-800 font-semibold mb-2 text-sm">Delivery To:</h3>
              <div className="border-r-4 border-blue-600 pr-4">
                <p className="text-gray-800 font-medium text-base">{purchaseOrder.store?.name || 'N/A'}</p>
                <p className="text-gray-600 text-sm">{purchaseOrder.store?.address || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blue-50 border-y">
                  <th className="py-2 px-4 text-left text-blue-800 font-medium text-sm">Item Name</th>
                  <th className="py-2 px-4 text-left text-blue-800 font-medium text-sm">Description</th>
                  <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Quantity</th>
                  <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Cost Price</th>
                  <th className="py-2 px-4 text-right text-blue-800 font-medium text-sm">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrder.items.map((item: PurchaseOrderItem) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3 px-4 text-gray-800 text-sm">{item.item_mgmt.item_name || 'N/A'}</td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{item.item_mgmt.description || '-'}</td>
                    <td className="py-3 px-4 text-right text-gray-800 text-sm">{item.order_qty || 0}</td>
                    <td className="py-3 px-4 text-right text-gray-800 text-sm">{formatCurrency(item.order_price && item.order_qty ? item.order_price / item.order_qty : 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-800 text-sm">
                      {formatCurrency(item.order_price ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right font-semibold text-sm">Total Items:</td>
                  <td className="py-3 px-4 text-right font-semibold text-sm">{purchaseOrder.total_items || 0}</td>
                </tr>
                <tr className="border-t-2">
                  <td colSpan={3} className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right font-bold text-base">Total:</td>
                  <td className="py-3 px-4 text-right font-bold text-base text-blue-600">
                    {formatCurrency(purchaseOrder.total_value ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Additional Details */}
          <div className="mb-8">
            <h3 className="text-gray-800 font-semibold mb-2 text-sm">Additional Details</h3>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-gray-600 text-sm"><strong>Payment Details:</strong> {purchaseOrder.payment_details || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm"><strong>Remarks:</strong> {purchaseOrder.remarks || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="mt-12 border-t pt-8 print:mt-8">
            <div className="text-center text-gray-500 text-xs print:fixed print:bottom-0 print:left-0 print:right-0">
              <p>Thank you for your business!</p>
              <p>For any queries, please contact at {companyData?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
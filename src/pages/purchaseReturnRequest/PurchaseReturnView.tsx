import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle,
  Clock,
  FileText,
  UserCheck,
  Award,
  ArrowLeft,
  CalendarCheck,
  Package,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/Utils/types/supabaseClient";

interface ApprovalStatus {
  status: string;
  trail: string;
  sequence_no: number;
  isFinalized: boolean;
  approvedBy?: string;
  date?: string;
  comment?: string;
  allApprovers?: string[];
}

interface PurchaseReturnData {
  id: string;
  return_number: string;
  supplier_name?: string;
  return_date: string;
  total_items: number;
  total_value: number;
  approval_status: any[];
  created_by: string;
  purchase_order_id: string;
  remark?: string;
}

function PurchaseReturnView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnData, setReturnData] = useState<PurchaseReturnData | null>(null);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchPurchaseReturn = async () => {
      if (!id) {
        setError("No Purchase Return ID provided.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Fetch purchase return data with supplier information
        const { data, error } = await supabase
          .from("purchase_return")
          .select(
            `
                        *,
                        supplier_mgmt (
                            supplier_name,
                            email,
                            address
                        )
                    `,
          )
          .eq("id", id)
          .single();

        if (error) throw error;

        // Type guard: ensure approval_status is always an array of ApprovalStatus
        let steps: ApprovalStatus[] = [];
        if (Array.isArray(data.approval_status)) {
          steps = data.approval_status
            .filter(
              (s: any) => s && typeof s === "object" && s.status && s.trail,
            )
            .map((s: any) => ({
              status: s.status,
              trail: s.trail,
              sequence_no: s.sequence_no,
              isFinalized: s.isFinalized,
              approvedBy: s.approvedBy,
              date: s.date,
              comment: s.comment,
            }));
        }
        setApprovalSteps(steps);

        setReturnData({
          id: data.id,
          return_number: data.purchase_retrun_number || "",
          supplier_name:
            data.supplier_mgmt?.supplier_name || "Unknown Supplier",
          return_date: data.return_date || "",
          total_items: data.total_items || 0,
          total_value: data.total_value || 0,
          approval_status: Array.isArray(data.approval_status)
            ? data.approval_status
            : [],
          created_by: data.created_by || "",
          purchase_order_id: data.purchase_order_id || "",
          remark: data.remark || undefined,
        });

        // Fetch user names for all unique approvedBy IDs
        const userIds = Array.from(
          new Set(
            steps
              .filter((s) => s.approvedBy && typeof s.approvedBy === "string")
              .map((s) => s.approvedBy as string),
          ),
        ).filter(Boolean);

        if (userIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from("user_mgmt")
            .select("id, first_name, last_name")
            .in("id", userIds);
          if (!usersError && Array.isArray(usersData)) {
            const map: Record<string, string> = {};
            usersData.forEach((u: any) => {
              map[u.id] = `${u.first_name || ""} ${u.last_name || ""}`.trim();
            });
            setUserMap(map);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch purchase return.");
      } finally {
        setLoading(false);
      }
    };
    fetchPurchaseReturn();
  }, [id]);

  // Get level icon
  const getLevelIcon = (status: string, trail: string) => {
    if (status.includes("Created")) {
      return (
        <FileText
          className={`w-6 h-6 ${trail === "Approved" ? "text-green-600" : "text-red-600"}`}
        />
      );
    } else if (status.includes("Approved") && !status.includes("Level")) {
      return (
        <CheckCircle
          className={`w-6 h-6 ${trail === "Approved" ? "text-green-600" : "text-red-600"}`}
        />
      );
    } else if (status.includes("Approved")) {
      return (
        <UserCheck
          className={`w-6 h-6 ${trail === "Approved" ? "text-green-600" : "text-red-600"}`}
        />
      );
    } else if (status.includes("Pending")) {
      return (
        <Clock
          className={`w-6 h-6 ${trail === "Approved" ? "text-green-600" : "text-red-600"}`}
        />
      );
    } else if (status.includes("Returned") || status.includes("Return")) {
      return (
        <Package
          className={`w-6 h-6 ${trail === "Approved" ? "text-green-600" : "text-red-600"}`}
        />
      );
    } else if (status.includes("Issued")) {
      return (
        <CalendarCheck
          className={`w-6 h-6 ${trail === "Approved" ? "text-green-600" : "text-red-600"}`}
        />
      );
    } else {
      return <Award className="w-6 h-6 text-blue-600" />;
    }
  };

  // Helper: Extract level number from status string
  const getLevelNumber = (status: string) => {
    const match = status.match(/Level (\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Filter approval steps to show only the latest status for each level, stop at first rejection
  const getDisplaySteps = (steps: ApprovalStatus[]) => {
    const latestByLevel: Record<number, ApprovalStatus & { allApprovers?: string[] }> = {};
    const approversByLevel: Record<number, string[]> = {};
    let stopAtLevel: number | null = null;

    // First pass: collect all approvers for each level
    for (const step of steps) {
      const level = getLevelNumber(step.status);
      if (level === null) continue;

      // Initialize approvers array for this level
      if (!approversByLevel[level]) {
        approversByLevel[level] = [];
      }

      // Collect all approvers for this level
      if (step.approvedBy && !approversByLevel[level].includes(step.approvedBy)) {
        approversByLevel[level].push(step.approvedBy);
      }

      // If rejected, mark to stop at this level
      if (step.trail === "Rejected" && (stopAtLevel === null || level < stopAtLevel)) {
        stopAtLevel = level;
      }
    }

    // Second pass: get the latest status for each level
    for (const step of steps) {
      const level = getLevelNumber(step.status);
      if (level === null) continue;

      // Always keep the latest (by sequence_no)
      if (!latestByLevel[level] || step.sequence_no > latestByLevel[level].sequence_no) {
        latestByLevel[level] = {
          ...step,
          allApprovers: approversByLevel[level] || []
        };
      }
    }

    // Sort by level
    const sortedLevels = Object.keys(latestByLevel)
      .map(Number)
      .sort((a, b) => a - b);
    const display: ApprovalStatus[] = [];
    for (const level of sortedLevels) {
      if (stopAtLevel !== null && level > stopAtLevel) break;
      display.push(latestByLevel[level]);
      if (latestByLevel[level].trail === "Rejected") break;
    }
    return display;
  };

  const displaySteps = getDisplaySteps(approvalSteps);

  // Calculate summary
  const completedSteps = approvalSteps.filter(
    (s) => s.trail === "Approved",
  ).length;
  const totalSteps = approvalSteps.length;
  const remainingSteps = totalSteps - completedSteps;

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="min-h-[85vh] shadow-sm">
          <CardHeader className="rounded-t-lg border-b pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    navigate(-1)
                  }
                  className="hover:bg-blue-100 transition-colors duration-200 rounded-full"
                >
                  <ArrowLeft className="h-5 w-5 text-blue-600" />
                </Button>
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    Purchase Return Approval View
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Track approval workflows for purchase return requests
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-8">
              {/* Purchase Return Info */}
              {returnData && (
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Return Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Return Number
                      </label>
                      <p className="text-base text-gray-900">
                        {returnData.return_number}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Supplier
                      </label>
                      <p className="text-base text-gray-900">
                        {returnData.supplier_name}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Return Date
                      </label>
                      <p className="text-base text-gray-900">
                        {new Date(returnData.return_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Total Items
                      </label>
                      <p className="text-base text-gray-900">
                        {returnData.total_items}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Total Value
                      </label>
                      <p className="text-base text-gray-900">
                        {formatCurrency(returnData.total_value)}
                      </p>
                    </div>
                    {returnData.remark && (
                      <div className="col-span-full">
                        <label className="text-sm font-medium text-gray-500">
                          Remarks
                        </label>
                        <p className="text-base text-gray-900">
                          {returnData.remark}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Approval Workflow Title */}
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Purchase Return Approval Workflow
                </h2>
                <p className="text-gray-600">
                  Track the progress of your purchase return through each
                  approval level
                </p>
              </div>

              {/* Loading/Error */}
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : error ? (
                <div className="text-center text-red-600 font-medium py-8">
                  {error}
                </div>
              ) : (
                <>
                  {/* Approval Steps */}
                  <div className="relative w-full pt-20 pb-6 min-h-[200px]">
                    {displaySteps.length > 0 ? (
                      <>
                        {/* Horizontal Connection Line */}
                        <div className="absolute top-20 left-0 right-0 h-0.5 bg-gray-200 z-0"></div>
                        {/* Steps Container */}
                        <div className="flex flex-row justify-center items-start w-full relative z-10 gap-6 md:gap-8 lg:gap-12 xl:gap-16">
                          {displaySteps.map((step, idx) => {
                            const IconComponent = getLevelIcon(
                              step.status,
                              step.trail,
                            );
                            return (
                              <div
                                key={idx}
                                className="flex flex-col items-center min-w-[80px] max-w-[140px] w-full"
                              >
                                {/* Icon Circle */}
                                <div
                                  className={`w-12 h-12 rounded-full flex items-center justify-center ${step.trail === "Approved" ? "bg-green-100" : "bg-red-100"} border-2 border-white shadow-sm`}
                                  style={{
                                    zIndex: 2,
                                    marginBottom: "0.5rem",
                                    marginTop: "-1.5rem",
                                  }}
                                >
                                  {IconComponent}
                                </div>
                                {/* Message */}
                                <div
                                  className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${
                                    step.trail === "Approved"
                                      ? "bg-green-100 text-green-800"
                                      : step.trail === "Rejected"
                                        ? "bg-red-200 text-red-800"
                                        : "bg-gray-100 text-gray-700"
                                  } w-full min-h-[80px] flex flex-col items-center justify-center mx-auto`}
                                >
                                  <div className="w-full">
                                    <div className="font-semibold mb-1">{step.status}</div>
                                    
                                    {/* Show all approvers for this level */}
                                    {step.allApprovers && step.allApprovers.length > 0 && (
                                      <div className="text-[10px] mt-2 space-y-1">
                                        {step.allApprovers.map((approverId, i) => (
                                          <div key={i} className="truncate">
                                            {step.trail === "Approved" && (
                                              <span className="text-green-700">
                                                ✓ {userMap[approverId] || approverId}
                                              </span>
                                            )}
                                            {step.trail === "Rejected" && (
                                              <span className="text-red-700">
                                                ✗ {userMap[approverId] || approverId}
                                              </span>
                                            )}
                                            {step.trail !== "Approved" && step.trail !== "Rejected" && (
                                              <span className="text-gray-700">
                                                {userMap[approverId] || approverId}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">
                          No approval workflow steps found
                        </p>
                        <p className="text-gray-400 text-sm">
                          This return request may not have entered the approval
                          process yet
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Current Status Summary */}
                  {displaySteps.length > 0 && (
                    <div className="mt-2 p-6 bg-gray-50 rounded-lg flex flex-col items-center">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Current Status
                      </h3>
                      <div className="flex justify-center w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-auto">
                          <div className="bg-white p-8 rounded-xl border min-w-[220px] max-w-[320px] text-base shadow-md">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <span className="font-medium text-green-800">
                                Completed
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {completedSteps} out of {totalSteps} steps
                            </p>
                          </div>
                          <div className="bg-white p-8 rounded-xl border min-w-[220px] max-w-[320px] text-base shadow-md">
                            <div className="flex items-center space-x-2">
                              <Award className="w-5 h-5 text-blue-600" />
                              <span className="font-medium text-blue-800">
                                Remaining
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {remainingSteps} steps to complete
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PurchaseReturnView;
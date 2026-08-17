import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/Utils/types/supabaseClient";

export interface IssueHistoryEntry {
  issued_qty: number;
  issued_to: string;
  issued_by: string;
  issued_at: string;
}

interface IssueHistoryModalProps {
  open: boolean;
  onClose: () => void;
  history: IssueHistoryEntry[];
}

interface EnrichedHistory {
  issued_qty: number;
  issued_at: string;
  issued_to_name: string;
  issued_to_id: string;
  issued_to_role: string;
  issued_by_name: string;
  issued_by_role: string;
}

const IssueHistoryModal: React.FC<IssueHistoryModalProps> = ({
  open,
  onClose,
  history,
}) => {
  const [enrichedData, setEnrichedData] = useState<EnrichedHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !history || history.length === 0) {
      setEnrichedData([]);
      return;
    }

    const fetchUserDetails = async () => {
      setIsLoading(true);
      try {
        const userIds = new Set<string>();
        history.forEach((h) => {
          if (h.issued_to) userIds.add(h.issued_to);
          if (h.issued_by) userIds.add(h.issued_by);
        });

        const { data: users, error } = await supabase
          .from("user_mgmt")
          .select("id, first_name, last_name, employee_id, role_master(name)")
          .in("id", Array.from(userIds));

        if (error) {
          console.error("Error fetching user details for history:", error);
        }

        const userMap = new Map();
        users?.forEach((u) => {
          const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Unknown";
          userMap.set(u.id, {
            name,
            employee_id: u.employee_id || "N/A",
            role: (u.role_master as any)?.name || "N/A",
          });
        });

        const mapped = history.map((h) => {
          const toUser = userMap.get(h.issued_to) || { name: "Unknown", employee_id: "N/A", role: "N/A" };
          const byUser = userMap.get(h.issued_by) || { name: "Unknown", employee_id: "N/A", role: "N/A" };

          return {
            issued_qty: h.issued_qty,
            issued_at: new Date(h.issued_at).toLocaleString(),
            issued_to_name: toUser.name,
            issued_to_id: toUser.employee_id,
            issued_to_role: toUser.role,
            issued_by_name: byUser.name,
            issued_by_role: byUser.role,
          };
        });

        setEnrichedData(mapped);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserDetails();
  }, [open, history]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          !max-w-[900px]
          w-[95vw]
          p-0
          overflow-hidden
          gap-0
        "
      >
        <DialogHeader className="px-6 pt-6 pb-5 border-b">
          <DialogTitle className="text-3xl font-bold text-slate-900">
            Issue History
          </DialogTitle>
          <p className="text-base text-slate-500 mt-1">
            Details of employees who received this item
          </p>
        </DialogHeader>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-10 text-slate-500">Loading history...</div>
          ) : enrichedData.length === 0 ? (
            <div className="text-center py-10 text-slate-500">No issue history found for this item.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Issued To</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Role</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Quantity</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Issued By</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Issued At</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedData.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200 hover:bg-slate-50/50">
                      <td className="px-6 py-5">
                        <div className="font-semibold text-lg text-blue-600">{row.issued_to_name}</div>
                        <div className="text-sm text-slate-500 mt-1">ID: {row.issued_to_id}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-semibold text-slate-900">{row.issued_to_role}</div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="font-semibold text-lg">{row.issued_qty}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-semibold text-slate-900">{row.issued_by_name}</div>
                        <div className="text-sm text-slate-500 mt-1">{row.issued_by_role}</div>
                      </td>
                      <td className="px-6 py-5 text-right text-slate-600 whitespace-nowrap">
                        {row.issued_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 pb-6">
          <Button type="button" variant="outline" onClick={onClose} className="min-w-[100px]">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IssueHistoryModal;
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/Utils/types/supabaseClient";

interface CancelHistoryModalProps {
  open: boolean;
  onClose: () => void;
  history: any[]; // Replace 'any[]' with the actual type if available
}

interface EnrichedCancelHistory {
  quantity: number;
  reason: string;
  cancelled_at: string;
  user_name: string;
  employee_id: string;
  role: string;
}
const CancelHistoryModal = ({
  open,
  onClose,
  history
}: CancelHistoryModalProps) => {
  useEffect(()=>{
console.log("Received cancel history:", history);
  console.log("History count:", history?.length);
},[history])

const [enrichedData, setEnrichedData] = useState<EnrichedCancelHistory[]>([]);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  if (!open || !history?.length) {
    setEnrichedData([]);
    return;
  }

  const fetchUserDetails = async () => {
    setIsLoading(true);

    try {
      const userIds = [
        ...new Set(
          history
            .map((item) => item.cancelled_by)
            .filter(Boolean)
        ),
      ];

      const { data: users, error } = await supabase
  .from("user_mgmt")
  .select(`
    id,
    first_name,
    last_name,
    employee_id,
    role_master(name)
  `)
  .in("id", userIds);

  console.log("History:", history);
console.log("User IDs:", userIds);
console.log("Users:", users);
console.log("Error:", error);
      if (error) {
        console.error("Error fetching users:", error);
        return;
      }

      const userMap = new Map();

      users?.forEach((user) => {
     userMap.set(user.id, {
  name:
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    "Unknown User",
  employee_id: user.employee_id || "N/A",
  role: (user.role_master as any)?.name || "N/A",
});
      });

      const mappedData = history.map((item) => {
     const user = userMap.get(item.cancelled_by) || {
  name: "Unknown User",
  employee_id: "N/A",
  role: "N/A",
};

    return {
  quantity: item.quantity,
  reason: item.reason,
  cancelled_at: new Date(item.date).toLocaleString(),
  user_name: user.name,
  employee_id: user.employee_id,
  role: user.role,
};
      });
console.log("Mapped Data:", mappedData);
      setEnrichedData(mappedData);
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
        bg-white
      "
    >
      <DialogHeader className="px-6 pt-6 pb-5 border-b">
        <DialogTitle className="text-3xl font-bold text-slate-900">
          Cancel History
        </DialogTitle>
        <p className="text-base text-slate-500 mt-1">
          Details of employees who cancelled this item
        </p>
      </DialogHeader>

      <div className="p-6 max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-10 text-slate-500">
            Loading history...
          </div>
        ) : enrichedData.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            No cancel history found for this item.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    User Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Role
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">
                    Quantity
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Reason
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">
                    Cancelled At
                  </th>
                </tr>
              </thead>

              <tbody>
                {enrichedData.map((item, index) => (
                  <tr
                    key={index}
                    className="border-t border-slate-200 hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-5">
                      <div className="font-semibold text-lg text-blue-600">
                        {item.user_name}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        ID: {item.employee_id}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="font-semibold text-slate-900">
                        {item.role}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <span className="font-semibold text-lg">
                        {item.quantity}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-slate-700">
                      {item.reason}
                    </td>

                    <td className="px-6 py-5 text-right text-slate-600 whitespace-nowrap">
                      {item.cancelled_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end px-6 pb-6">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="min-w-[100px]"
        >
          Close
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);
};

export default CancelHistoryModal;
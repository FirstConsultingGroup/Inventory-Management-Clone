import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmIssueModalProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onConfirm: () => void;
}

const ConfirmIssueModal: React.FC<ConfirmIssueModalProps> = ({
  open,
  onClose,
  user,
  onConfirm,
}) => {
  const userName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : "Unknown User";
  const role = user?.role_master?.name || "Employee";
  const employeeId = user?.employee_id || user?.id || "N/A";
  const contactNumber = user?.email || "N/A";

  const initial = userName.charAt(0).toUpperCase();

  const handleConfirmIssue = () => {
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          !max-w-[700px]
          w-[95vw]
          sm:!max-w-[700px]
          p-0
          overflow-hidden
        "
      >
        {/* Header */}
        <div className="px-8 pt-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Confirm Issue
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Verify user details before issuing items
          </p>
        </div>

        {/* User Card */}
        <div className="px-8 py-6">
          <div className="rounded-xl border bg-slate-50 p-5">
            <div className="flex items-start gap-4">

              {/* Avatar */}
              <div className="h-14 w-14 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl font-semibold shadow-sm">
                {initial}
              </div>

              {/* User Details */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">
                  {userName}
                </h3>

                <p className="text-sm text-slate-500">
                  {role}
                </p>

                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  <p>
                    <span className="font-medium">Employee ID:</span>{" "}
                    {employeeId}
                  </p>

                  <p>
                    <span className="font-medium">Contact:</span>{" "}
                    {contactNumber}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Confirmation Message */}
          <div className="mt-8 text-center">
            <p className="text-lg font-semibold text-slate-900">
              Are you sure you want to issue items to{" "}
              <span className="text-blue-600">
                {userName}
              </span>
              ?
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-8 py-5 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-w-[120px]"
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirmIssue}
            className="bg-blue-600 hover:bg-blue-700 min-w-[160px]"
          >
            Confirm Issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmIssueModal;
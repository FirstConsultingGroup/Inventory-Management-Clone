import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
}

export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  open,
  onOpenChange,
  userId,
  email
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<{ current?: string; password?: string }>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Validate password
  const validatePassword = (password: string) => {
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (password.length > 100) return "Password must be less than 100 characters";
    if (!/[A-Z]/.test(password)) return "Must contain at least one uppercase";
    if (!/\d/.test(password)) return "Must contain at least one number";
    if (!/[^A-Za-z0-9]/.test(password)) return "Must contain a special character";
    return true;
  };

  const resetDialog = () => {
    setStep(1);
    setCurrentPassword("");
    setPasswordData({ newPassword: "", confirmPassword: "" });
    setErrors({});
  };

  const handleCancel = () => {
    resetDialog();
    onOpenChange(false);
  };

  // Verify current password
  const handleVerifyCurrentPassword = async () => {
    if (!currentPassword) {
      setErrors({ current: "Current password is required" });
      return;
    }

    setDialogLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}functions/v1/verify-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ email, password: currentPassword }),
      });

      const data = await res.json();

      if (!data.success || !data.valid) {
        setErrors({ current: "Incorrect password" });
        return;
      }

      setStep(2);
    } catch {
      setErrors({ current: "Error verifying password" });
    } finally {
      setDialogLoading(false);
    }
  };

  // Reset to new password
  const handleConfirmPassword = async () => {
    const { newPassword, confirmPassword } = passwordData;
    setErrors({});

    if (!newPassword || !confirmPassword) {
      setErrors({ password: "Both fields are required" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ password: "Passwords do not match" });
      return;
    }

    const validation = validatePassword(newPassword);
    if (validation !== true) {
      setErrors({ password: validation });
      return;
    }

    setDialogLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}functions/v1/change-user-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          id: userId,
          email,
          password: confirmPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }

        toast.success("Password changed successfully");
        resetDialog();
        onOpenChange(false);
      } else {
        toast.error(data.error || "Failed to change password");
      }
    } finally {
      setDialogLoading(false);
    }
  };

  const buttonConfig = {
    1: { handler: handleVerifyCurrentPassword, label: "Next", loadingText: "Checking..." },
    2: { handler: handleConfirmPassword, label: "Confirm", loadingText: "Submitting..." },
  }[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white backdrop-blur-lg shadow-2xl rounded-2xl p-8 sm:p-12 w-full max-w-md transition-all duration-300">
        <DialogHeader>
          <DialogTitle className="text-blue-600 flex items-center gap-2 text-2xl font-bold">
            <Lock className="h-6 w-6" />
            Change Password
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            {step === 1 && "Enter your current password to continue."}
            {step === 2 && "Set your new password below."}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Current Password */}
        {step === 1 && (
          <div className="space-y-2 mt-6">
            <Label
              htmlFor="current_password"
              className={cn("font-medium", errors.current && "text-destructive")}
            >
              Current Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative group">
              <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-500" />
              <Input
                id="current_password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className={cn(
                  "pl-10 h-12 rounded-lg transition-all duration-300 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500/20",
                  errors.current && "border-destructive focus-visible:ring-destructive"
                )}
              />
            </div>
            {errors.current && (
              <p className="text-sm text-destructive mt-1 animate-slideDown">{errors.current}</p>
            )}
          </div>
        )}

        {/* STEP 2: New Password */}
        {step === 2 && (
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label
                htmlFor="new_password"
                className={cn("font-medium", errors.password && "text-destructive")}
              >
                New Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-500" />
                <Input
                  id="new_password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  placeholder="Enter new password"
                  className={cn(
                    "pl-10 h-12 rounded-lg transition-all duration-300 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500/20",
                    errors.password && "border-destructive focus-visible:ring-destructive"
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirm_password"
                className={cn("font-medium", errors.password && "text-destructive")}
              >
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-500" />
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm new password"
                  className={cn(
                    "pl-10 h-12 rounded-lg transition-all duration-300 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500/20",
                    errors.password && "border-destructive focus-visible:ring-destructive"
                  )}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive mt-1 animate-slideDown">{errors.password}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between items-center mt-8">
          <DialogClose asChild>
            <Button variant="outline" onClick={handleCancel} disabled={dialogLoading}>
              Cancel
            </Button>
          </DialogClose>

          <Button
            onClick={buttonConfig.handler}
            disabled={dialogLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {dialogLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> {buttonConfig.loadingText}
              </span>
            ) : (
              buttonConfig.label
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

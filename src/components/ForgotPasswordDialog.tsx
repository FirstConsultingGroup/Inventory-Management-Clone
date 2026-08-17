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
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { IUser } from "@/Utils/constants";
import { supabase } from "@/Utils/types/supabaseClient";
import toast from "react-hot-toast";

interface ForgotPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
    open,
    onOpenChange,
}) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [dialogLoading, setDialogLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [answer, setAnswer] = useState("");
    const [passwordData, setPasswordData] = useState({
        newPassword: "",
        confirmPassword: "",
    });
    const [forgotPwdErrors, setForgotPwdErrors] = useState<{
        email?: string;
        answer?: string;
        password?: string;
    }>({});
    const [userData, setUserData] = useState<IUser>();
    const [securityQuestion, setSecurityQuestion] = useState<string | null>('');
    const [correctAnswer, setCorrectAnswer] = useState<string | null>('');
    const [isAccLocked, setIsAccLocked] = useState<boolean>(false)
    const userId = userData?.id;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const resetDialog = () => {
        setStep(1);
        setEmail("");
        setAnswer("");
        setPasswordData({ newPassword: "", confirmPassword: "" });
        setForgotPwdErrors({});
        setIsAccLocked(false);
    };

    const handleCancel = () => {
        resetDialog();
        onOpenChange(false);
    };

    // Validate email id
    const validateEmail = (email: string): string | null => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            return "Email is required";
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return "Invalid email address";
        }
        return null;
    };

    // Validate password
    const validatePassword = (password: string) => {
        if (!password) return "Password is required";
        if (password.length < 8) return "Password must be at least 8 characters";
        if (password.length > 100) return "Password must be less than 100 characters";
        if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
        if (!/\d/.test(password)) return "Password must contain at least one number";
        if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character";
        return true;
    };


    // Fetching user data for email verification
    const handleVerifyEmail = async () => {
        setForgotPwdErrors({});
        const emailError = validateEmail(email);

        if (emailError) {
            setForgotPwdErrors({ email: emailError });
            return;
        }

        setDialogLoading(true);
        try {
            // Fetch user by email from Supabase
            const { data, error } = await supabase
                .from("user_mgmt")
                .select("*")
                .eq('is_active', true)
                .eq("email", email)
                .single();

            if (error || !data) {
                setForgotPwdErrors({ email: "Account not found or invalid" });
                return;
            }
            setUserData(data);
            
            // Check if account is locked
            if (data.status === "inactive" && data.failed_attempts === 3) {
                setForgotPwdErrors({ email: "Account locked. Please contact admin." });
                return;
            }

            // Check if secret_question and secret_answer exist
            if (!data.security_question || !data.secret_answer) {
                setForgotPwdErrors({
                    email: "No security question is set for this account. Please contact the admin to reset your password.",
                });
                return;
            }

            setSecurityQuestion(data.security_question);
            setCorrectAnswer(data.secret_answer);

            setStep(2); // move to next step
        } catch (err) {
            console.error('Error fetching user data', err)
            setForgotPwdErrors({ email: "Failed to fetch user data. Try again." });
        } finally {
            setDialogLoading(false);
        }
    };

    // Verify the answer
    const handleVerifyAnswer = async () => {
        if (!userId) return;
        setForgotPwdErrors({});
        if (!answer.trim()) {
            setForgotPwdErrors({ answer: "Answer is required" });
            return;
        }

        setDialogLoading(true);
        try {
            await new Promise((res) => setTimeout(res, 1500));

            const { data, error } = await supabase
                .from("user_mgmt")
                .select("*")
                .eq("id", userId)
                .single();

            if (error || !data) {
                setForgotPwdErrors({ email: "Account not found or invalid" });
                return;
            }

            // Compare answer (case-insensitive)
            const isCorrect = correctAnswer?.toLowerCase().trim() === answer.toLowerCase().trim();

            if (isCorrect) {
                // Correct answer -> Reset attempts
                const { error: updateError } = await supabase
                    .from("user_mgmt")
                    .update({ failed_attempts: 0 })
                    .eq("id", userId);

                if (updateError) throw updateError;
                setStep(3);
            } else {
                // Wrong answer -> Increment failed_attempts
                const newAttempts = (data.failed_attempts || 0) + 1;
                const updates: any = { failed_attempts: newAttempts };

                // If reached 3 attempts -> lock account
                if (newAttempts >= 3) {
                    updates.status = "inactive";
                }

                const { error: updateError } = await supabase
                    .from("user_mgmt")
                    .update(updates)
                    .eq("id", userId);

                if (updateError) throw updateError;

                if (newAttempts >= 3) {
                    setIsAccLocked(true);
                    setForgotPwdErrors({ answer: "Account locked due to too many failed attempts. Contact admin." });

                    // Creating system log for account locking
                    const systemLogs = {
                        company_id: userData?.company_id,
                        transaction_date: new Date().toISOString(),
                        module: 'Forgot Password',
                        scope: 'Password Reset',
                        key: `${email}`,
                        log: `Account locked due to too many failed attempts.`,
                        action_by: userId,
                        created_at: new Date().toISOString(),
                    }

                    const { error: systemLogError } = await supabase
                        .from('system_log')
                        .insert(systemLogs);

                    if (systemLogError) throw systemLogError;
                } else {
                    setForgotPwdErrors({ answer: `Incorrect answer. ${3 - newAttempts} attempts remaining.` });
                }
            }
        } catch (err) {
            setForgotPwdErrors({ answer: "Something went wrong. Try again." });
        } finally {
            setDialogLoading(false);
        }
    };

    const handleConfirmPassword = async () => {
        const { newPassword, confirmPassword } = passwordData;
        setForgotPwdErrors({});

        if (!newPassword || !confirmPassword) {
            setForgotPwdErrors({ password: "Both fields are required" });
            return;
        }

        if (newPassword !== confirmPassword) {
            setForgotPwdErrors({ password: "Passwords do not match" });
            return;
        }

        const validation = validatePassword(newPassword);
        if (validation !== true) {
            setForgotPwdErrors({ password: validation });
            return;
        }

        setDialogLoading(true);
        try {
            const res = await fetch(`${supabaseUrl}functions/v1/reset-user-password`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`
                },
                body: JSON.stringify({
                    id: userId,
                    email,
                    password: confirmPassword,
                }),
            });

            const data = await res.json();

            if (data.success) {
                // Creating system log for password reset
                const systemLogs = {
                    company_id: userData?.company_id,
                    transaction_date: new Date().toISOString(),
                    module: 'Forgot Password',
                    scope: 'Password Reset',
                    key: `${data.user.email}`,
                    log: `User: ${data.user.email} password updated.`,
                    action_by: userId,
                    created_at: new Date().toISOString(),
                }

                const { error: systemLogError } = await supabase
                    .from('system_log')
                    .insert(systemLogs);

                if (systemLogError) throw systemLogError;

                toast.success(data.message);
                resetDialog();
                onOpenChange(false);
            } else {
                toast.error(data.error || "Failed to reset password");
            }
        } catch {
            setForgotPwdErrors({ password: "Failed to reset password. Try again." });
        } finally {
            setDialogLoading(false);
        }
    };

    // Determine dynamic button config
    const buttonConfig = {
        1: { handler: handleVerifyEmail, label: "Next", loadingText: "Processing..." },
        2: { handler: handleVerifyAnswer, label: "Next", loadingText: "Checking..." },
        3: { handler: handleConfirmPassword, label: "Confirm", loadingText: "Submitting..." },
    }[step];


    const handleOpenChange = (open: any) => {
        if (open) {
            onOpenChange(true);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto bg-white backdrop-blur-lg shadow-2xl rounded-2xl p-8 sm:p-12 w-full max-w-md transition-all duration-300">
                <DialogHeader>
                    <DialogTitle className="text-blue-600 flex items-center gap-2 text-2xl font-bold">
                        <Lock className="h-6 w-6" />
                        Forgot Password
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 mt-2">
                        {step === 1 && "Enter your registered email to verify your account."}
                        {step === 2 && "Answer the security question to continue."}
                        {step === 3 && "Set your new password below."}
                    </DialogDescription>
                </DialogHeader>

                {/* Step Content */}
                {step === 1 && (
                    <div className="space-y-2 mt-6">
                        <Label
                            htmlFor="email"
                            className={cn("font-medium", forgotPwdErrors.email && "text-destructive")}
                        >
                            Registered Email ID <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-4 h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-500" />
                            <Input
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className={cn(
                                    "pl-10 h-12 rounded-lg transition-all duration-300 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500/20",
                                    forgotPwdErrors.email && "border-destructive focus-visible:ring-destructive"
                                )}
                            />
                        </div>
                        {forgotPwdErrors.email && (
                            <p className="text-sm text-destructive mt-1 animate-slideDown">{forgotPwdErrors.email}</p>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-2 mt-6">
                        <Label
                            htmlFor="security_question"
                            className={cn("font-medium", forgotPwdErrors.answer && "text-destructive")}
                        >
                            {securityQuestion} <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative group">
                            <ShieldCheck className="absolute left-3 top-4 h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-500" />
                            <Input
                                id="security_question"
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Enter your answer"
                                className={cn(
                                    "pl-10 h-12 rounded-lg transition-all duration-300 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500/20",
                                    forgotPwdErrors.answer && "border-destructive focus-visible:ring-destructive"
                                )}
                            />
                        </div>
                        {forgotPwdErrors.answer && (
                            <p className="text-sm text-destructive mt-1 animate-slideDown">{forgotPwdErrors.answer}</p>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4 mt-6">
                        <div className="space-y-2">
                            <Label
                                htmlFor="new_password"
                                className={cn("font-medium", forgotPwdErrors.password && "text-destructive")}
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
                                        forgotPwdErrors.password && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label
                                htmlFor="confirm_password"
                                className={cn("font-medium", forgotPwdErrors.password && "text-destructive")}
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
                                        forgotPwdErrors.password && "border-destructive focus-visible:ring-destructive"
                                    )}
                                />
                            </div>
                            {forgotPwdErrors.password && (
                                <p className="text-sm text-destructive mt-1 animate-slideDown">{forgotPwdErrors.password}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Buttons */}
                <DialogFooter className="flex justify-between items-center mt-8">
                    <DialogClose asChild>
                        <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={dialogLoading}
                        >
                            Cancel
                        </Button>
                    </DialogClose>

                    <Button
                        onClick={buttonConfig.handler}
                        disabled={dialogLoading || isAccLocked}
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

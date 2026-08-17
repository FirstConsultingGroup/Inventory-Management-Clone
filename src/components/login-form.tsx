import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { supabase } from "@/Utils/types/supabaseClient";
import { useState, useEffect } from "react";
import LoginSidePanelImg from '@/assets/Images/GarageInventoryLoginImg2.png';
import { useDispatch } from 'react-redux';
import { setUser, clearUser, setLoading, setError } from '@/redux/features/userSlice';
import { ForgotPasswordDialog } from "./ForgotPasswordDialog";
import { fetchUserPermissions, ALL_MODULES } from '@/constants/permissions';

// Helper function to convert module name to camelCase URL path
const moduleToPath = (module: string): string => {
  if (module === "Dashboard") return "dashboard";
  return module
    .toLowerCase()
    .split(' ')
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('')
    .replace(/&/g, 'and');
};

// Helper function to find the configured route from grouped modules
const getModuleRoute = (moduleKey: string, groupedModules?: any[]): string | null => {
  if (moduleKey === "Dashboard") return "/dashboard";
  if (!groupedModules) return null;
  for (const parent of groupedModules) {
    if (parent.modules && Array.isArray(parent.modules)) {
      const found = parent.modules.find((m: any) => m.moduleKey === moduleKey);
      if (found && found.moduleRoute) {
        return found.moduleRoute;
      }
    }
  }
  return null;
};

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
const [showResetPassword, setShowResetPassword] = useState(false);

const [resetUser, setResetUser] = useState<{
  id: string;
  email: string;
} | null>(null);
  // FIXED: always clear local state in finally block, regardless of signOut success/failure
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore signOut errors (e.g. session already expired or missing)
      console.warn('SignOut warning (session may already be gone):', error);
    } finally {
      localStorage.removeItem('userData');
      localStorage.removeItem('roleName');
      dispatch(clearUser());
      navigate("/");
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Session data:", session);

        if (session && session.user) {
          const storedUserData = localStorage.getItem('userData');
          const storedRoleName = localStorage.getItem('roleName');
          console.log("Stored userData:", storedUserData, "Stored roleName:", storedRoleName);

          if (storedUserData && storedRoleName) {
            const userData = JSON.parse(storedUserData);
            dispatch(setUser(userData));
            if (storedRoleName.toLowerCase() === 'sales assistant') {
              console.log("Redirecting sales assistant to /dashboard/invoice (from stored data)");
              navigate("/dashboard/invoice");
            } else {
              // Fetch permissions to determine first module
              const userPerms = await fetchUserPermissions(userData.id, userData.company_id);

              if (!userPerms) {
                console.warn('fetchUserPermissions failed');
                navigate("/dashboard");
                return;
              }

              const permissions = userPerms.permissions;
              const firstModule = ALL_MODULES.find(module => permissions[module] === true);
              
              let redirectPath = "/dashboard/userProfile";
              if (firstModule) {
                redirectPath = getModuleRoute(firstModule, userPerms.groupedModules) || (firstModule === "Inventory Dashboard" ? "/dashboard" : `/dashboard/${moduleToPath(firstModule)}`);
              }
              
              console.log(`Redirecting to ${redirectPath} (from stored data)`);
              navigate(redirectPath);
            }
          } else {
            // Fetch user details
            const { data: userDetails, error: userError } = await supabase
              .from('user_mgmt')
              .select(`
                *,
                company_master (*)
              `)
              .eq('id', session.user.id)
              .single();

            if (!userError && userDetails) {
              // Fetch role name
              let roleName = null;
              let roleId = null;
              if (userDetails.role_id) {
                const { data: roleData, error: roleError } = await supabase
                  .from('role_master')
                  .select('name, role_id')
                  .eq('id', userDetails.role_id)
                  .eq('is_active', true)
                  .single();
                if (!roleError && roleData) {
                  roleName = roleData.name || '';
                  roleId = roleData.role_id || '';
                  localStorage.setItem('roleName', roleName);
                } else {
                  console.error("Error fetching role name:", roleError);
                }
              }

              const userData = {
                id: session.user.id,
                email: session.user.email ?? '',
                email_confirmed: session.user.email_confirmed_at ? true : false,
                created_at: session.user.created_at,
                last_sign_in: session.user.last_sign_in_at,
                first_name: userDetails?.first_name || null,
                last_name: userDetails?.last_name || null,
                user_id: session.user.id,
                role_id: userDetails?.role_id || null,
                role_name: roleName,
                role_id_secondary: roleId,
                status: userDetails?.status || null,
                is_active: userDetails?.is_active,
                company_id: userDetails?.company_id || null,
                company_data: userDetails?.company_master || null,
                full_name: userDetails?.first_name && userDetails?.last_name
                  ? `${userDetails.first_name} ${userDetails.last_name}`
                  : null,
                department_id: userDetails?.department_id || null,
                locations: userDetails?.locations || null,
                stores: (userDetails as any)?.stores || [],
                approve_authorizations: userDetails?.approve_authorizations || null,
              };

              if (userData.is_active) {
                localStorage.setItem('userData', JSON.stringify(userData));
                console.log("Setting user data in Redux store:", userData);
                dispatch(setUser(userData as any));
                console.log("Fetched roleName:", roleName, "Role ID:", userDetails.role_id);
                if (roleName?.toLowerCase() === 'sales assistant') {
                  console.log("Redirecting sales assistant to /dashboard/invoice");
                  navigate("/dashboard/invoice");
                } else {
                  const userPerms = await fetchUserPermissions(userData?.id || '', userData.company_id || '');

                  if (!userPerms) {
                    console.warn('fetchUserPermissions failed');
                    navigate("/dashboard");
                    return;
                  }

                  const permissions = userPerms.permissions;
                  const firstModule = ALL_MODULES.find(module => permissions[module] === true);
                  
                  let redirectPath = "/dashboard/userProfile";
                  if (firstModule) {
                    redirectPath = getModuleRoute(firstModule, userPerms.groupedModules) || (firstModule === "Inventory Dashboard" ? "/dashboard" : `/dashboard/${moduleToPath(firstModule)}`);
                  }
                  
                  console.log(`Redirecting to ${redirectPath}`);
                  navigate(redirectPath);
                }
              } else {
                await handleLogout();
                toast.error("Account is inactive");
              }
            } else {
              console.error("Error fetching user details:", userError);
              await handleLogout();
            }
          }
        } else {
          localStorage.removeItem('userData');
          localStorage.removeItem('roleName');
          dispatch(clearUser());
        }
      } catch (error) {
        console.error("Session check error:", error);
        localStorage.removeItem('userData');
        localStorage.removeItem('roleName');
        dispatch(clearUser());
      }
    };

    checkSession();
  }, [navigate, dispatch]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const {
  register: resetRegister,
  handleSubmit: handleResetSubmit,
  watch,
  formState: { errors: resetErrors }
} = useForm({
  mode: "onChange",
});

const newPassword = watch("newPassword");

  const checkUserActiveStatus = async (email: string) => {
    try {
      const { data: user, error } = await supabase
        .from("user_mgmt")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !user) {
        return {
          valid: false,
          message: "User does not exist or has been removed.",
        };
      }

      if (user.is_active === false) {
        return {
          valid: false,
          message: "This account no longer exists. Please contact the administrator.",
        };
      }

      if (String(user.status).toLowerCase() === "inactive") {
        return {
          valid: false,
          message: `This account is ${user.failed_attempts === 3 ? `locked` : `inactive`}. Please contact the administrator.`,
        };
      }

      return { valid: true };
    } catch (err) {
      console.error("Error checking user active status:", err);
      return {
        valid: false,
        message: "An unexpected error occurred while verifying user status.",
      };
    }
  };

  const onSubmit = async (data: { email: string; password: string }) => {
    setIsLoading(true);
    dispatch(setLoading(true));

    try {
      // Check user active status before login
      const statusCheck = await checkUserActiveStatus(data.email);
      if (!statusCheck.valid) {
        toast.error(statusCheck.message || "Unable to log in.");
        dispatch(setError(statusCheck.message || "Account not allowed to log in"));
        return;
      }
console.log("LOGIN EMAIL =", data.email);
console.log("LOGIN PASSWORD =", data.password);
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
console.log("AUTH DATA", authData);
console.log("AUTH ERROR", error);
      if (error) {
        let errorMessage = "Login failed. Please try again.";
        switch (error.message) {
          case "Invalid login credentials":
            errorMessage = "Invalid email or password. Please check your credentials.";
            break;
          case "Email not confirmed":
            errorMessage = "Please confirm your email address before logging in.";
            break;
          case "Too many requests":
            errorMessage = "Too many login attempts. Please try again later.";
            break;
          default:
            errorMessage = error.message;
        }
        toast.error(errorMessage);
        dispatch(setError(errorMessage));
        return;
      }

      if (authData.user) {
        const { data: userDetails, error: userError } = await supabase
          .from('user_mgmt')
          .select(`
            *,
            company_master (*),
            department_master:department_id (
              id,
              department_name,
              department_id
            )
          `)
          .eq('id', authData.user.id)
          .single();

        if (userError) {
          console.error("Error fetching user details:", userError);
          toast.error("Error fetching user profile. Please try again.");
          dispatch(setError("Error fetching user profile"));
          return;
        }

        if (!userDetails) {
          toast.error("User profile not found. Please contact admin.");
          dispatch(setError("User profile not found"));
          return;
        }

       if ((userDetails as any).default_password === true) {
  setShowResetPassword(true);
  setResetUser({
  id: authData.user.id,
  email: authData.user.email ?? ""
});

  await supabase.auth.signOut();

  return;
}

        // Fetch role name
        let roleName = null;
        let roleId = null;
        if (userDetails.role_id) {
          const { data: roleData, error: roleError } = await supabase
            .from('role_master')
            .select('name, role_id')
            .eq('id', userDetails.role_id)
            .eq('is_active', true)
            .single();
          if (!roleError && roleData) {
            roleName = roleData.name as string;
            roleId = roleData.role_id as string;
            localStorage.setItem('roleName', roleName);
          } else {
            console.error("Error fetching role name:", roleError);
          }
        }

        const userData = {
          id: authData.user.id,
          email: authData.user.email ?? '',
          email_confirmed: authData.user.email_confirmed_at ? true : false,
          created_at: authData.user.created_at,
          last_sign_in: authData.user.last_sign_in_at,
          first_name: userDetails?.first_name || null,
          last_name: userDetails?.last_name || null,
          user_id: authData.user.id,
          role_id: userDetails?.role_id || null,
          role_name: roleName,
          role_id_secondary: roleId,
          status: userDetails?.status || null,
          is_active: userDetails?.is_active,
          company_id: userDetails?.company_id || null,
          company_data: userDetails?.company_master || null,
          full_name: userDetails?.first_name && userDetails?.last_name
            ? `${userDetails.first_name} ${userDetails.last_name}`
            : null,
          image: userDetails?.image || null,
          department_id: userDetails?.department_id || null,
          locations: userDetails?.locations || null,
          stores: (userDetails as any)?.stores || [],
          approve_authorizations: userDetails?.approve_authorizations || null,
        };

        if (userData.is_active) {
          localStorage.setItem('userData', JSON.stringify(userData));
           console.log("Setting user data in Redux store:", userData);
          dispatch(setUser(userData as any));
          toast.success("Login successful! Welcome back.");
          console.log("Fetched roleName:", roleName, "Role ID:", userDetails.role_id);
          if (roleName?.toLowerCase() === 'sales assistant') {
            console.log("Redirecting sales assistant to /dashboard/invoice");
            navigate("/dashboard/invoice");
          } else {
            const userPerms = await fetchUserPermissions(userData?.id || '', userData.company_id || '');

            if (!userPerms) {
              console.warn('fetchUserPermissions failed');
              navigate("/dashboard");
              return;
            }

            const permissions = userPerms.permissions;
            console.log("Permissions =>", permissions)
            const firstModule = ALL_MODULES.find(module => permissions[module] === true);
            
            let redirectPath = "/dashboard/userProfile";
            if (firstModule) {
              redirectPath = getModuleRoute(firstModule, userPerms.groupedModules) || (firstModule === "Inventory Dashboard" ? "/dashboard" : `/dashboard/${moduleToPath(firstModule)}`);
            }
            
            console.log(`Redirecting to ${redirectPath}`);
            navigate(redirectPath);
          }
        } else {
          dispatch(setError('Account is inactive'));
          toast.error("Login failed. Account is inactive.");
          await handleLogout();
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      dispatch(setError('An unexpected error occurred'));
    } finally {
      setIsLoading(false);
      dispatch(setLoading(false));
    }
  };

  const onResetPassword = async (data: any) => {
  try {
    setIsLoading(true);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            import.meta.env.VITE_SUPABASE_ANON_KEY
          }`
        },
        body: JSON.stringify({
          id: resetUser?.id,
          email: resetUser?.email,
          password: data.newPassword
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error);
    }

    // update default_password flag
   if (!resetUser) return;

const { error } = await supabase
  .from("user_mgmt")
  .update({
    default_password: false,
  } as any)
  .eq("id", resetUser.id);

    if (error) throw error;

    toast.success("Password reset successful");

    setShowResetPassword(false);
    setResetUser(null);

  } catch (error: any) {
    toast.error(error.message);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className={cn("min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100", className)} {...props}>
      <div className="flex flex-col md:flex-row bg-white/80 backdrop-blur-lg shadow-2xl rounded-2xl overflow-hidden w-full max-w-4xl transition-all duration-300">
        <div className="hidden md:block md:w-1/2">
          <img
            src={LoginSidePanelImg}
            alt="Login Illustration"
            className="h-full w-full object-cover"
          />
        </div>
 <div className="w-full md:w-1/2 p-8 sm:p-12">
  <div className="flex flex-col align-items-center space-y-4">
    <h1 className="text-3xl mt-5 font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
      {showResetPassword ? "Reset Password" : "Welcome Back"}
    </h1>

    <p className="text-gray-600">
      {showResetPassword
        ? "Please create a new password"
        : "Enter your credentials to access your account"}
    </p>
  </div>

  {showResetPassword ? (
    <form
      onSubmit={handleResetSubmit(onResetPassword)}
      className="space-y-6 mt-6"
    >
      <div className="space-y-2">
        <Label>New Password</Label>

        <Input
          type="password"
          placeholder="New Password"
          {...resetRegister("newPassword", {
            required: "Password is required",
            minLength: {
              value: 6,
              message: "Minimum 6 characters",
            },
          })}
        />

        {resetErrors.newPassword && (
          <p className="text-sm text-destructive">
            {String(resetErrors.newPassword.message)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Confirm Password</Label>

        <Input
          type="password"
          placeholder="Confirm Password"
          {...resetRegister("confirmPassword", {
  required: "Confirm Password is required",
  validate: (value) =>
    value === newPassword || "Passwords do not match",
})}
        />

        {resetErrors.confirmPassword && (
          <p className="text-sm text-destructive">
            {String(resetErrors.confirmPassword.message)}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg"
        disabled={isLoading}
      >
        {isLoading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  ) : (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 mt-6"
    >
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className={cn(
            "font-medium",
            errors.email && "text-destructive"
          )}
        >
          Email
        </Label>

        <div className="relative group">
          <User className="absolute left-3 top-4 h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-500" />

          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            className={cn(
              "pl-10 h-12 rounded-lg transition-all duration-300 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500/20",
              errors.email &&
                "border-destructive focus-visible:ring-destructive"
            )}
            {...register("email", {
              required: "Email is required",
              pattern: {
                value:
                  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Invalid email address",
              },
            })}
          />
        </div>

        {errors.email && (
          <p className="text-sm text-destructive mt-1 animate-slideDown">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="password"
          className={cn(
            "font-medium",
            errors.password && "text-destructive"
          )}
        >
          Password
        </Label>

        <div className="relative group">
          <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-500" />

          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            className={cn(
              "pl-10 h-12 rounded-lg transition-all duration-300 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500/20",
              errors.password &&
                "border-destructive focus-visible:ring-destructive"
            )}
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 6,
                message: "Password must be at least 6 characters",
              },
            })}
          />
        </div>

        {errors.password && (
          <p className="text-sm text-destructive mt-1 animate-slideDown">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="flex justify-end mb-0">
        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          onClick={() => setIsDialogOpen(true)}
        >
          Forgot your password?
        </button>
      </div>

      <Button
        type="submit"
        className="w-full h-12 mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 rounded-lg"
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            Logging in...
          </span>
        ) : (
          "Login"
        )}
      </Button>
    </form>
  )}
</div>
      </div>
      <ForgotPasswordDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
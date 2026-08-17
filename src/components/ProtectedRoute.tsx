import { Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Shield, Loader2 } from 'lucide-react';
import type { ModuleKey } from '@/constants/permissions';
import { fetchUserPermissions, getCachedPermissions } from '@/constants/permissions';
import { loadModulePermissions } from '@/Utils/commonFun';

type ProtectedRouteProps = {
  module: ModuleKey;
  action?: string;
};

const APP_CODE = import.meta.env.VITE_APP_AUTH_CODE || 'INV-001';

const hasModuleAction = (
  permissions: { action_id?: { actionName?: string }; isAllowed?: boolean }[] | undefined,
  action: string
): boolean =>
  permissions?.some(
    (p) =>
      p.action_id?.actionName?.toLowerCase() === action.toLowerCase() && p.isAllowed
  ) ?? false;

export default function ProtectedRoute({ module, action }: ProtectedRouteProps) {
  const raw = localStorage.getItem('userData');
  const user = raw ? JSON.parse(raw) : null;

  const [resolvedRoleId, setResolvedRoleId] = useState<string | null>(() => {
    const cached = localStorage.getItem('roleId');
    return cached || null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const checkAccess = async () => {
      setLoading(true);
      try {
        const roleId = resolvedRoleId || user?.role_id || null;
        if (!resolvedRoleId && user?.role_id) {
          try { localStorage.setItem('roleId', user.role_id); } catch {}
          setResolvedRoleId(user.role_id);
        }

        if (!roleId) {
          if (mounted) setHasAccess(false);
          return;
        }

        let cached = getCachedPermissions();
        if (!cached || !cached.permissions) {
          cached = await fetchUserPermissions(user.id, user.company_id);
        }

        if (!cached?.permissions) {
          if (mounted) setHasAccess(false);
          return;
        }

        let access = !!cached.permissions[module];

        if (access && action) {
          const res = await loadModulePermissions(APP_CODE, module, user.user_id);
          access = hasModuleAction(res?.permissions, action);
        }

        if (mounted) setHasAccess(access);
      } catch (err) {
        console.error('Permission check failed:', err);
        if (mounted) setHasAccess(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkAccess();

    return () => { mounted = false; };
  }, [resolvedRoleId, user?.user_id, user?.role_id, module, action]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (hasAccess) return <Outlet />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
            <p className="text-red-100">Insufficient Permissions</p>
          </div>
          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-slate-600 leading-relaxed">
                You don't have the required permissions to access this module.
                Please contact your administrator or check your account privileges.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => window.history.back()}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <button className="w-full border border-slate-300 hover:border-slate-400 text-slate-700 py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2">
                <Mail className="w-4 h-4" />
                Request Access
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">Error Code: 403 • Module Access Denied</p>
        </div>
      </div>
    </div>
  );
}

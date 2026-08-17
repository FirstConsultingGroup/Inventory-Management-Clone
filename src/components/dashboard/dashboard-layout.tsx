import { JSX, useEffect, useRef, useState, useCallback } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  Users,
  Package,
  Truck,
  LayoutTemplate,
  // LayoutDashboard,
  ChevronRight,
  Bell,
  LogOut,
  ChartNoAxesCombined,
  Store,
  FileText,
  ClipboardCheck,
  SquareChartGantt,
  Building2,
  Clock,
  BadgeIndianRupee,
  List,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  Component,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChatWidget } from '@/components/ChatWidget';
import ProfileImg from '@/assets/Images/ProfileImg.png';
import { supabase } from '@/Utils/types/supabaseClient';
import { formatAbsoluteTime, formatRelativeTime, isRecentNotification } from '@/Utils/notificationEvents';
import type { ModuleKey } from '@/constants/permissions';
import { fetchUserPermissions } from '@/constants/permissions';

// Define interfaces for type safety
interface UserData {
  user_id: string;
  id: string;
  role_id: string;
  first_name: string;
  last_name: string;
  company_id: string;
}

interface Notification {
  id: string;
  message: string;
  time: string;
  absoluteTime: string;
  read: boolean;
  isRecent: boolean;
}

interface SystemNotification {
  id: string;
  message: string;
  created_at: string;
  status: string;
}

interface MenuItem {
  path: string;
  label: string;
  icon: JSX.Element;
  module?: ModuleKey;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// Custom event constant for notification updates
const NOTIFICATION_UPDATE_EVENT = 'notificationUpdate';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Dashboards': false,
    'Masters': false,
    'Access Control': false,
    'Item Management': false,
    'Inventory': false,
    'Procurement': false,
    'Sales': false,
    'Administration': false,
  });

  const user: string | null = localStorage.getItem('userData');
  const userData: UserData | null = user ? JSON.parse(user) : null;

  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationPaneRef = useRef<HTMLDivElement>(null);
  const [roleName, setRoleName] = useState<string>('');
  const [_permissions, setPermissions] = useState<Record<ModuleKey, boolean> | null>(null);
  const [groupedModulesData, setGroupedModulesData] = useState<any[] | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string>(ProfileImg);

  // Toggle section expansion
  const toggleSection = useCallback((sectionTitle: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  }, []);

  // Fetch user profile image
  useEffect(() => {
    const fetchUserImage = async () => {
      if (!userData?.id) return;

      try {
        const { data, error } = await supabase
          .from('user_mgmt')
          .select('image')
          .eq('id', userData.id)
          .single();

        if (error) {
          console.error('Error fetching user image:', error);
          return;
        }

        if (data?.image) {
          const imageMetadata = data.image as any;
          if (imageMetadata.path) {
            const { data: publicUrl } = supabase.storage
              .from('profile-picture')
              .getPublicUrl(imageMetadata.path);

            if (publicUrl?.publicUrl) {
              setProfileImageUrl(publicUrl.publicUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile image:', error);
      }
    };

    fetchUserImage();
  }, [userData?.id]);

  // Fetch role name
  useEffect(() => {
    const fetchRoleName = async () => {
      if (!userData?.role_id) return;
      const { data } = await supabase
        .from('role_master')
        .select('name')
        .eq('id', userData.role_id)
        .eq('is_active', true)
        .single();

      if (data?.name) {
        setRoleName(data.name);
        try {
          localStorage.setItem('roleName', data.name);
        } catch {}
      }
    };
    fetchRoleName();
  }, [userData?.role_id]);

  // Fetch permissions
  useEffect(() => {
    let mounted = true;
    const loadPermissions = async () => {
      if (!userData?.id || !userData?.company_id) {
        if (mounted) {
          setPermissions(null);
          setGroupedModulesData(null);
        }
        return;
      }

      try {
        const perms = await fetchUserPermissions(userData.id, userData.company_id);
        if (mounted) {
          setPermissions(perms?.permissions ?? null);
          setGroupedModulesData(perms?.groupedModules ?? null);
        }
      } catch (err) {
        console.error('Failed to load permissions:', err);
        if (mounted) {
          setPermissions(null);
          setGroupedModulesData(null);
        }
      }
    };

    loadPermissions();

    return () => {
      mounted = false;
    };
  }, [userData?.id, userData?.company_id]);


  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userData?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: notificationData, error } = await supabase
        .from('system_notification')
        .select('id, message, created_at, status, expiry_date')
        .eq('assign_to', userData.id)
        .eq('status', 'New')
        .eq('is_active', true)
        .or(`expiry_date.is.null,expiry_date.gte.${today}`)
        .order('created_at', { ascending: false })
        .limit(2);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      const { count, error: countError } = await supabase
        .from('system_notification')
        .select('id', { count: 'exact' })
        .eq('assign_to', userData.id)
        .eq('status', 'New')
        .eq('is_active', true)
        .or(`expiry_date.is.null,expiry_date.gte.${today}`);

      if (countError) {
        console.error('Error fetching notification count:', countError);
        return;
      }

      // Format notifications with relative and absolute time
      const formattedNotifications: Notification[] = (notificationData as SystemNotification[]).map(notification => ({
        id: notification.id,
        message: notification.message,
        time: formatRelativeTime(notification.created_at),
        absoluteTime: formatAbsoluteTime(notification.created_at),
        read: notification.status !== 'New',
        isRecent: isRecentNotification(notification.created_at),
      }));

      setNotifications(formattedNotifications);
      setNotificationCount(count || 0);
    } catch (error) {
      console.error('Unexpected error fetching notifications:', error);
    }
  }, [userData?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleNotificationUpdate = () => {
      fetchNotifications();
    };

    window.addEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate);

    return () => {
      window.removeEventListener(NOTIFICATION_UPDATE_EVENT, handleNotificationUpdate);
    };
  }, [fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!userData?.id) return;

    const subscription = supabase
      .channel('system_notification_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_notification',
          filter: `assign_to=eq.${userData.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userData?.id, fetchNotifications]);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationPaneRef.current && !notificationPaneRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSeeAllNotifications = () => {
    setShowNotifications(false);
    navigate('/dashboard/notifications');
  };

  // FIXED: always clear local state in finally block, regardless of signOut success/failure
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore signOut errors (e.g. session already expired or missing)
      console.warn('SignOut warning (session may already be gone):', error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      navigate('/');
    }
  };

  const isActiveRoute = (path: string): boolean => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getMenuItemStyles = (path: string): string => {
    const isActive = isActiveRoute(path);
    return cn(
      'group relative w-full justify-start text-left transition-all duration-200 rounded-md py-2.5 px-3 text-sm font-medium',
      isActive
        ? 'bg-indigo-50/80 text-indigo-700 font-medium'
        : 'text-gray-600 hover:bg-gray-50/80 hover:text-indigo-600'
    );
  };

  const renderActiveIndicator = (path: string): JSX.Element | null => {
    return isActiveRoute(path) ? (
      <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 rounded-r-full" />
    ) : null;
  };

  // Define icons mapping for modules
  const iconMap: Record<string, JSX.Element> = {
    'Dashboard': <Home className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Purchase Requisitions': <FileText className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Sales Invoice': <BadgeIndianRupee className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Category Master': <List className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Location Master': <Building2 className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Department Management': <Building2 className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Role Master': <Users className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Users': <Users className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Role Management': <ShieldCheck className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Item Configurator': <LayoutTemplate className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Item Master': <Package className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Inventory Management': <Package className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Supplier Management': <Truck className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Store Management': <Store className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Purchase Requisition Approvals': <FileText className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Quotations': <FileText className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Purchase Order Management': <FileText className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Purchase Order Approvals': <ClipboardCheck className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Returns Eligible': <RotateCcw className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Returns Management': <SquareChartGantt className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Purchase Return Requests': <Package className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Customer Master': <Users className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Sales Returns': <BadgeIndianRupee className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Sales Return Approvals': <BadgeIndianRupee className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Reports': <ChartNoAxesCombined className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Audit Trail': <Clock className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Administration': <LayoutTemplate className="mr-3 h-4 w-4 flex-shrink-0" />,
    'Manage Modules':<Component className="mr-3 h-4 w-4 flex-shrink-0" />
  };

  const getVisibleSections = (): MenuSection[] => {
    const sections: MenuSection[] = [];

    if (groupedModulesData && groupedModulesData.length > 0) {
      const dynamicSections = groupedModulesData.map((parentModule: any) => ({
        title: parentModule.name || parentModule.moduleName || 'Other',
        items: (parentModule.modules || [])
          .filter((mod: any) => !['Module and Access', 'Workflow Configuration', 'Purchase Order Management', 'Purchase Order Approvals', 'Quotations'].includes(mod.moduleKey) && !['Module & Access', 'Workflow Management', 'Purchase Orders', 'Quotations', 'Purchase Order Approvals'].includes(mod.moduleName))
          .map((mod: any) => ({
          path: mod.moduleRoute,
          label: mod.moduleName,
          icon: iconMap[mod.moduleKey] || <LayoutTemplate className="mr-3 h-4 w-4 flex-shrink-0" />,
          module: mod.moduleKey as ModuleKey,
        }))
      }));
      sections.push(...dynamicSections);
    }

sections.push({
  title: 'Approval Process',
  items: [
    {
      path: '/dashboard/approval-process',
      label: 'Approval Requests',
      icon: <Component className="mr-3 h-4 w-4 flex-shrink-0" />,
      module: 'Approval Process' as ModuleKey,
    },
  ],
});

return sections.filter(section => section.items.length > 0);
  };

  const visibleSections = getVisibleSections();

  return (
    <div className="min-h-screen bg-gray-50/40 antialiased">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b h-16 fixed top-0 left-0 right-0 z-30 shadow-sm">
        <div className="flex items-center justify-between px-5 h-full">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-gray-700 hover:text-gray-900"
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              Pro<span className="text-indigo-600">Ventory</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={notificationPaneRef}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-gray-600 hover:text-indigo-700 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </Button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-in fade-in slide-in-from-top-5 duration-200">
                  <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-50 to-white flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800 flex items-center">
                      <Bell className="h-4 w-4 mr-2 text-indigo-600" />
                      Notifications
                    </h3>
                    {notificationCount > 0 && (
                      <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        {notificationCount} new
                      </span>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.read ? 'border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                        >
                          <div className="flex justify-between items-start">
                            <p className={`text-sm ${!notification.read ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                              {notification.message}
                            </p>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-12 text-center">
                        <div className="inline-block p-3 rounded-full bg-gray-100 mb-3">
                          <Bell className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No notifications</p>
                        <p className="text-xs text-gray-400 mt-1">We'll notify you when something arrives</p>
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-2 border-t">
                    <button
                      onClick={handleSeeAllNotifications}
                      className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium py-1 rounded hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1"
                    >
                      See all notifications
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-16 bottom-0 left-0 z-20 w-64 bg-white border-r shadow-sm transition-all duration-300 ease-in-out',
          !isSidebarOpen && '-translate-x-full'
        )}
      >
        <nav className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-3 py-5 space-y-2 scrollbar-thin scrollbar-thumb-gray-300/50">
            {visibleSections.map((section) => (
              <div key={section.title} className="mb-1.5">
                <button
                  onClick={() => toggleSection(section.title)}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2.5 rounded-md text-xs font-semibold uppercase tracking-wider text-gray-500 hover:bg-gray-50/70 transition-colors'
                  )}
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-300 ease-out',
                      expandedSections[section.title] && 'rotate-180'
                    )}
                  />
                </button>

                <div
                  className={cn(
                    'grid transition-all duration-300 ease-in-out',
                    expandedSections[section.title]
                      ? 'grid-rows-[1fr] opacity-100 mt-1'
                      : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-0.5 px-1">
                      {section.items.map((item) => (
                        <Link key={item.path} to={item.path}>
                          <Button variant="ghost" className={getMenuItemStyles(item.path)}>
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                            {renderActiveIndicator(item.path)}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Profile section */}
          <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-3">
            <Link to="/dashboard/userProfile">
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg p-2.5 transition-colors',
                  isActiveRoute('/dashboard/userProfile')
                    ? 'bg-indigo-50/60 text-indigo-700'
                    : 'hover:bg-gray-100/80'
                )}
              >
                <img
                  src={profileImageUrl}
                  alt="Profile"
                  className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm"
                  onError={(e) => {
                    e.currentTarget.src = ProfileImg;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {userData?.first_name} {userData?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{roleName}</p>
                </div>
              </div>
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "pt-16 transition-all duration-200 ease-in-out",
          isSidebarOpen ? "ml-64" : "ml-0"
        )}
      >
        <Outlet context={{ isSidebarOpen }} />
      </main>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
};
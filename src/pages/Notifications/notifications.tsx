import { useState, useEffect, JSX, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Search, Bell, CheckCheck, Filter, Undo2, Trash2, AlertTriangle, AlertCircle, Info, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { supabase } from '@/Utils/types/supabaseClient';
import { getLocalDateTime } from '@/Utils/commonFun';
import { formatRelativeTime, normalizeAlertType, NORMALIZED_TO_ALERT_TYPE } from '@/Utils/notificationEvents';
import { useNavigate } from 'react-router-dom';

// Define interfaces for type safety
interface UserData {
  id: string;
  role_id: string;
  first_name: string;
  last_name: string;
}

interface Notification {
  id: string;
  message: string;
  time: string;
  read: boolean;
  type: string;
  priority: string;
  entity_id: string;
}

interface SystemNotification {
  id: string;
  message: string;
  created_at: string;
  status: string;
  alert_type: string;
  priority: string;
  entity_id: string;
}

// Custom event for notification updates
const NOTIFICATION_UPDATE_EVENT = 'notificationUpdate';

const Notifications: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const user: string | null = localStorage.getItem("userData");
  const userData: UserData | null = user ? JSON.parse(user) : null;
  const navigate = useNavigate();

  // Trigger notification update event
  const triggerNotificationUpdate = () => {
    const event = new CustomEvent(NOTIFICATION_UPDATE_EVENT);
    window.dispatchEvent(event);
  };

  // Handle create custom notification navigation
  const handleCreateNotification = () => {
    navigate('/dashboard/notifications/create');
  };

  // Convert normalized type back to original alert_type for filtering
  const getAlertTypeFromNormalized = (normalizedType: string): string | null => {
    return NORMALIZED_TO_ALERT_TYPE[normalizedType as keyof typeof NORMALIZED_TO_ALERT_TYPE] || null;
  };

  // Fetch notifications from Supabase with backend search and filtering
  const fetchNotifications = useCallback(async () => {
    if (!userData?.id) return;

    setIsLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('system_notification')
        .select('id, message, created_at, status, alert_type, priority, expiry_date, entity_id')
        .eq('assign_to', userData.id)
        .eq('is_active', true)
        .or(`expiry_date.is.null,expiry_date.gte.${today}`);

      // Backend search implementation
      if (searchQuery.trim()) {
        query = query.ilike('message', `%${searchQuery.trim()}%`);
      }

      // Filter by alert type
      if (selectedType !== 'all') {
        const alertTypeFilter = getAlertTypeFromNormalized(selectedType);
        if (alertTypeFilter) {
          query = query.eq('alert_type', alertTypeFilter);
        }
      }

      // Filter by status based on active tab
      if (activeTab === 'read') {
        query = query.neq('status', 'New');
      } else if (activeTab === 'unread') {
        query = query.eq('status', 'New');
      }

      query = query.order('created_at', { ascending: false });

      const { data: notificationData, error } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      const formattedNotifications: Notification[] = (notificationData as SystemNotification[]).map(notification => ({
        id: notification.id,
        message: notification.message,
        time: formatRelativeTime(notification.created_at), // Using the utility function
        read: notification.status !== 'New',
        type: normalizeAlertType(notification.alert_type), // Using the utility function
        priority: notification.priority || 'Medium', // Default to Medium if not provided
        entity_id: notification.entity_id || '',
      }));

      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Unexpected error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userData?.id, activeTab, searchQuery, selectedType]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchNotifications();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [fetchNotifications]);

  // Get priority-based styling
  const getPriorityStyles = (priority: string, read: boolean) => {
    const baseStyles = "p-3 sm:p-4 rounded-lg border flex flex-col sm:flex-row sm:items-start sm:justify-between hover:shadow-md transition-all duration-200";
    
    if (read) {
      return `${baseStyles} bg-gray-50 border-gray-200`;
    }

    switch (priority.toLowerCase()) {
      case 'high':
        return `${baseStyles} bg-red-50 border-red-300 border-l-4 border-l-red-500 shadow-sm`;
      case 'medium':
        return `${baseStyles} bg-orange-50 border-orange-300 border-l-4 border-l-orange-500 shadow-sm`;
      case 'low':
        return `${baseStyles} bg-blue-50 border-blue-300 border-l-4 border-l-blue-500 shadow-sm`;
      default:
        return `${baseStyles} bg-gray-50 border-gray-300 border-l-4 border-l-gray-500 shadow-sm`;
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority: string): JSX.Element => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />;
      case 'low':
        return <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />;
    }
  };

  // Get priority badge styling
  const getPriorityBadgeStyles = (priority: string): string => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get notification icon based on type with priority-aware coloring
  const getNotificationIcon = (type: string, priority: string): JSX.Element => {
    const priorityIcon = getPriorityIcon(priority);
    
    switch (type) {
      case 'approval':
        return <CheckCheck className={`h-4 w-4 sm:h-5 sm:w-5 ${priority.toLowerCase() === 'high' ? 'text-red-500' : priority.toLowerCase() === 'medium' ? 'text-orange-500' : 'text-blue-500'}`} />;
      case 'purchase':
        return <Bell className={`h-4 w-4 sm:h-5 sm:w-5 ${priority.toLowerCase() === 'high' ? 'text-red-500' : priority.toLowerCase() === 'medium' ? 'text-orange-500' : 'text-blue-500'}`} />;
      case 'approved':
        return <CheckCheck className={`h-4 w-4 sm:h-5 sm:w-5 ${priority.toLowerCase() === 'high' ? 'text-red-500' : priority.toLowerCase() === 'medium' ? 'text-orange-500' : 'text-green-500'}`} />;
      case 'rejected':
        return <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />;
      default:
        return priorityIcon;
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!userData?.id) return;

    try {
      const { error } = await supabase
        .from('system_notification')
        .update({ status: 'Read', acknowledged_at: getLocalDateTime() })
        .eq('assign_to', userData.id)
        .eq('status', 'New');

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      // Update local state
      setNotifications(notifications.map(notification => ({ ...notification, read: true })));
      
      // Trigger update event for header
      triggerNotificationUpdate();
    } catch (error) {
      console.error('Unexpected error marking all as read:', error);
    }
  };

  // Mark a single notification as read
  const markAsRead = async (id: string) => {
    if (!userData?.id) return;

    try {
      const { error } = await supabase
        .from('system_notification')
        .update({ status: 'Read', acknowledged_at: getLocalDateTime() })
        .eq('id', id)
        .eq('assign_to', userData.id);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setNotifications(notifications.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      ));

      // Trigger update event for header
      triggerNotificationUpdate();
    } catch (error) {
      console.error('Unexpected error marking as read:', error);
    }
  };

  // Mark a single notification as unread
  const markAsUnread = async (id: string) => {
    if (!userData?.id) return;

    try {
      const { error } = await supabase
        .from('system_notification')
        .update({ status: 'New', acknowledged_at: null })
        .eq('id', id)
        .eq('assign_to', userData.id);

      if (error) {
        console.error('Error marking notification as unread:', error);
        return;
      }

      // Update local state
      setNotifications(notifications.map(notification =>
        notification.id === id ? { ...notification, read: false } : notification
      ));

      // Trigger update event for header
      triggerNotificationUpdate();
    } catch (error) {
      console.error('Unexpected error marking as unread:', error);
    }
  };

  // Delete a notification
  const deleteNotification = async (id: string) => {
    if (!userData?.id) return;

    try {
      const { error } = await supabase
        .from('system_notification')
        .update({ is_active: false, acknowledged_at: getLocalDateTime() })
        .eq('id', id)
        .eq('assign_to', userData.id);

      if (error) {
        console.error('Error deleting notification:', error);
        return;
      }

      // Update local state
      setNotifications(notifications.filter(notification => notification.id !== id));

      // Trigger update event for header
      triggerNotificationUpdate();
    } catch (error) {
      console.error('Unexpected error deleting notification:', error);
    }
  };

  // Get unique notification types for filter dropdown (from current results)
  const notificationTypes: string[] = ['all', ...new Set(notifications.map(n => n.type))];

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle type filter change
  const handleTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(e.target.value);
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mx-auto max-w-full sm:max-w-3xl md:max-w-5xl lg:max-w-7xl space-y-4 sm:space-y-6">
        <Card className="min-h-[80vh] shadow-md border-0 rounded-lg overflow-hidden">
          <CardHeader className="border-b pb-4 sm:pb-6 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100">
                  <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800">Notifications</CardTitle>
                  <CardDescription className="mt-1 text-sm sm:text-base text-gray-500">
                    Manage your inventory notifications
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  onClick={handleCreateNotification}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-sm sm:text-sm"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Create Notification
                </Button>
                <Button
                  onClick={markAllAsRead}
                  disabled={isLoading || notifications.filter(n => !n.read).length === 0}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-sm sm:text-sm disabled:opacity-50"
                >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Mark all as read
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 bg-white">
            <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search notifications..."
                    className="pl-8 sm:pl-10 border-gray-200 rounded-lg text-sm sm:text-base"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500" />
                  <select
                    className="border border-gray-200 rounded-lg p-1.5 sm:p-2 text-sm bg-white w-full sm:w-auto disabled:opacity-50"
                    value={selectedType}
                    onChange={handleTypeFilterChange}
                    disabled={isLoading}
                  >
                    {notificationTypes.map(type => (
                      <option key={type} value={type}>
                        {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <Tabs defaultValue="all" className="w-full" onValueChange={handleTabChange}>
              <TabsList className="grid grid-cols-3 mb-4 sm:mb-6 bg-gray-100 rounded-lg w-full">
                <TabsTrigger
                  value="all"
                  className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  disabled={isLoading}
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="unread"
                  className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  disabled={isLoading}
                >
                  Unread
                </TabsTrigger>
                <TabsTrigger
                  value="read"
                  className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  disabled={isLoading}
                >
                  Read
                </TabsTrigger>
              </TabsList>

              {['all', 'unread', 'read'].map(tabValue => (
                <TabsContent key={tabValue} value={tabValue} className="space-y-3 sm:space-y-4 mt-2">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-gray-500">Loading notifications...</p>
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={getPriorityStyles(notification.priority, notification.read)}
                      >
                        <div className="flex items-start space-x-3 sm:space-x-4">
                          <div className="mt-0.5 sm:mt-1">{getNotificationIcon(notification.type, notification.priority)}</div>
                          <div className="flex-1">
                            <div className="flex items-start space-x-2">
                              <p
                                className={`text-sm sm:text-base font-semibold ${
                                  notification.read ? 'text-gray-700' : 'text-gray-900'
                                }`}
                              >
                                {notification.message}
                              </p>
                              {!notification.read && (
                                <div className="flex items-center space-x-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                  {getPriorityIcon(notification.priority)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center mt-2 space-x-2 flex-wrap gap-1">
                              <p className="text-xs sm:text-sm text-gray-500">{notification.time}</p>
                              <Badge className={`text-xs border ${getPriorityBadgeStyles(notification.priority)}`}>
                                {notification.priority}
                              </Badge>
                              <Badge className="text-xs bg-gray-100 text-gray-800 border-gray-200">
                                {notification.type.replace('_', ' ').charAt(0).toUpperCase() + notification.type.slice(1).replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mt-3 sm:mt-0 sm:ml-4 flex-wrap">
                          {[
                            'approval_request', 'approval_level_completed', 'approval_submitted',
                            'approval_rejected', 'approval_fully_completed', 'super_admin_override'
                          ].includes(notification.type) && notification.entity_id && (
                            <Button
                              onClick={() => navigate(`/dashboard/approval-history/${notification.entity_id}`)}
                              variant="outline"
                              size="sm"
                              className="text-xs sm:text-sm text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
                            >
                              View Details
                            </Button>
                          )}
                          {!notification.read ? (
                            <Button
                              onClick={() => markAsRead(notification.id)}
                              variant="ghost"
                              size="sm"
                              className={`text-xs sm:text-sm sm:w-auto ${
                                notification.priority.toLowerCase() === 'high' 
                                  ? 'text-red-600 hover:text-red-800 hover:bg-red-50' 
                                  : notification.priority.toLowerCase() === 'medium'
                                  ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-50'
                                  : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                              }`}
                              disabled={isLoading}
                            >
                              Mark as read
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => markAsUnread(notification.id)}
                                variant="ghost"
                                size="sm"
                                className="text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 text-xs sm:text-sm sm:w-auto"
                                disabled={isLoading}
                              >
                                <Undo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                Mark as unread
                              </Button>
                              <Button
                                onClick={() => deleteNotification(notification.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 text-xs sm:text-sm w-full sm:w-auto"
                                disabled={isLoading}
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 sm:py-8">
                      <Bell className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mb-2 sm:mb-3" />
                      <h3 className="text-base sm:text-lg font-medium text-gray-900">No notifications found</h3>
                      <p className="text-gray-500 mt-1 text-sm sm:text-base">
                        {searchQuery
                          ? 'Try adjusting your search or filters'
                          : tabValue === 'all'
                          ? "You don't have any notifications yet"
                          : `You don't have any ${tabValue} notifications`}
                      </p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
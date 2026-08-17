// utils/notificationEvents.ts

import React from "react";

// Custom event constant for notification updates
export const NOTIFICATION_UPDATE_EVENT = 'notificationUpdate';

// Utility function to trigger notification update
export const triggerNotificationUpdate = (): void => {
  const event = new CustomEvent(NOTIFICATION_UPDATE_EVENT);
  window.dispatchEvent(event);
};

// Hook for listening to notification updates
export const useNotificationUpdates = (callback: () => void): void => {
  React.useEffect(() => {
    window.addEventListener(NOTIFICATION_UPDATE_EVENT, callback);
    
    return () => {
      window.removeEventListener(NOTIFICATION_UPDATE_EVENT, callback);
    };
  }, [callback]);
};

// Notification status constants
export const NOTIFICATION_STATUS = {
  NEW: 'New',
  READ: 'Read',
  DELETED: 'Deleted'
} as const;

// Priority constants
export const NOTIFICATION_PRIORITY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High'
} as const;

// Alert type constants for Purchase Orders
export const PURCHASE_ORDER_ALERT_TYPES = {
  CREATED: 'Purchase Order Created',
  APPROVAL_REQUESTED: 'Purchase Order Approval Requested',
  APPROVED: 'Purchase Order Approved',
  REJECTED: 'Purchase Order Rejected',
  COMPLETED: 'Purchase Order Completed'
} as const;

// Alert type constants for Common Approvals
export const COMMON_APPROVAL_ALERT_TYPES = {
  REQUEST: 'Approval Request',
  LEVEL_COMPLETED: 'Approval Level Completed',
  SUBMITTED: 'Approval Submitted',
  REJECTED: 'Approval Rejected',
  FULLY_COMPLETED: 'Approval Fully Completed',
  OVERRIDE: 'Super Admin Override'
} as const;

// Alert type mapping for normalization
export const ALERT_TYPE_MAPPING = {
  'Purchase Order Created': 'purchase_created',
  'Purchase Order Approval Requested': 'approval_requested',
  'Purchase Order Approved': 'purchase_approved',
  'Purchase Order Rejected': 'purchase_rejected',
  'Purchase Order Completed': 'purchase_completed',
  'System Notification': 'system_notification',
  'Approval Request': 'approval_request',
  'Approval Level Completed': 'approval_level_completed',
  'Approval Submitted': 'approval_submitted',
  'Approval Rejected': 'approval_rejected',
  'Approval Fully Completed': 'approval_fully_completed',
  'Super Admin Override': 'super_admin_override'
} as const;

// Reverse mapping for filtering
export const NORMALIZED_TO_ALERT_TYPE = {
  'purchase_created': 'Purchase Order Created',
  'approval_requested': 'Purchase Order Approval Requested',
  'purchase_approved': 'Purchase Order Approved',
  'purchase_rejected': 'Purchase Order Rejected',
  'purchase_completed': 'Purchase Order Completed',
  'system_notification': 'System Notification',
  'approval_request': 'Approval Request',
  'approval_level_completed': 'Approval Level Completed',
  'approval_submitted': 'Approval Submitted',
  'approval_rejected': 'Approval Rejected',
  'approval_fully_completed': 'Approval Fully Completed',
  'super_admin_override': 'Super Admin Override'
} as const;

// Helper function to normalize alert types
export const normalizeAlertType = (alertType: string): string => {
  return ALERT_TYPE_MAPPING[alertType as keyof typeof ALERT_TYPE_MAPPING] || 
         alertType.toLowerCase().replace(/\s+/g, '_');
};

// Helper function to get original alert type from normalized
export const getAlertTypeFromNormalized = (normalizedType: string): string | null => {
  return NORMALIZED_TO_ALERT_TYPE[normalizedType as keyof typeof NORMALIZED_TO_ALERT_TYPE] || null;
};

// Helper function to safely parse timestamp as local time (not UTC)
export const parseTimestamp = (timestamp: string): { 
  year: number, 
  month: number, 
  day: number, 
  hour: number, 
  minute: number, 
  second: number,
  millisecond: number,
  localTime: number
} => {
  try {
    // Parse timestamp like "2025-08-20T10:42:19.79+00:00", "2025-08-20 10:42:19.79+00", or "2025-08-20 10:42:19.79"
    let cleanTimestamp = timestamp.trim();
    
    // Remove timezone info if present - we'll treat this as local time
    if (cleanTimestamp.includes('+')) {
      cleanTimestamp = cleanTimestamp.split('+')[0];
    }
    if (cleanTimestamp.includes('Z')) {
      cleanTimestamp = cleanTimestamp.replace('Z', '');
    }
    
    // Replace T separator with space if present (ISO format)
    cleanTimestamp = cleanTimestamp.replace('T', ' ');
    
    // Split date and time parts
    const parts = cleanTimestamp.split(' ');
    if (parts.length < 2) {
      throw new Error('Invalid timestamp format');
    }
    
    const [datePart, timePart] = parts;
    const dateComponents = datePart.split('-');
    
    if (dateComponents.length !== 3) {
      throw new Error('Invalid date format');
    }
    
    const year = parseInt(dateComponents[0]);
    const month = parseInt(dateComponents[1]);
    const day = parseInt(dateComponents[2]);
    
    // Validate date components
    if (isNaN(year) || isNaN(month) || isNaN(day) || 
        month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error('Invalid date values');
    }
    
    let hour = 0, minute = 0, second = 0, millisecond = 0;
    
    if (timePart) {
      const timeComponents = timePart.split(':');
      if (timeComponents.length >= 2) {
        hour = parseInt(timeComponents[0]) || 0;
        minute = parseInt(timeComponents[1]) || 0;
        
        if (timeComponents[2]) {
          const secondParts = timeComponents[2].split('.');
          second = parseInt(secondParts[0]) || 0;
          if (secondParts[1]) {
            // Convert fractional seconds to milliseconds
            const fraction = secondParts[1].padEnd(3, '0').substring(0, 3);
            millisecond = parseInt(fraction) || 0;
          }
        }
      }
    }
    
    // Validate time components
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || 
        second < 0 || second > 59 || millisecond < 0 || millisecond > 999) {
      throw new Error('Invalid time values');
    }
    
    // Create local time instead of UTC time
    const localTime = new Date(year, month - 1, day, hour, minute, second, millisecond).getTime();
    
    if (isNaN(localTime)) {
      throw new Error('Failed to create local time');
    }
    
    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
      localTime
    };
  } catch (error) {
    console.error(`Error parsing timestamp: ${timestamp}`, error);
    // Return current time as fallback
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const millisecond = now.getMilliseconds();
    
    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond,
      localTime: now.getTime()
    };
  }
};

// Helper function to format relative time using local time
export const formatRelativeTime = (timestamp: string): string => {
  try {
    const parsedTime = parseTimestamp(timestamp);
    const now = Date.now(); // Current time in milliseconds
    const diffInSeconds = Math.floor((now - parsedTime.localTime) / 1000);

    // Less than 1 minute - show seconds
    if (diffInSeconds < 60) {
      return `just now`;
    }
    
    // Less than 1 hour - show minutes
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }
    
    // Less than 1 day - show hours
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
    
    // Less than 1 week - show days
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }
    
    // More than 1 week - show "Month Day, Year" format
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parsedTime.month - 1]} ${parsedTime.day}, ${parsedTime.year}`;
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'unknown time';
  }
};

// Alternative formatting function for absolute time display using local time
export const formatAbsoluteTime = (timestamp: string): string => {
  try {
    const parsedTime = parseTimestamp(timestamp);
    
    // Format manually using local time
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Convert 24-hour to 12-hour format
    let displayHour = parsedTime.hour;
    let ampm = 'AM';
    
    if (displayHour === 0) {
      displayHour = 12; // Midnight
    } else if (displayHour === 12) {
      ampm = 'PM'; // Noon
    } else if (displayHour > 12) {
      displayHour = displayHour - 12;
      ampm = 'PM';
    }
    
    // Pad minutes with leading zero if needed
    const minutes = parsedTime.minute.toString().padStart(2, '0');
    
    return `${monthNames[parsedTime.month - 1]} ${parsedTime.day}, ${parsedTime.year} ${displayHour}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting absolute time:', error);
    return 'Invalid date';
  }
};

// Helper function to check if timestamp is recent (within last 24 hours)
export const isRecentNotification = (timestamp: string): boolean => {
  try {
    const parsedTime = parseTimestamp(timestamp);
    const now = Date.now();
    const diffInHours = (now - parsedTime.localTime) / (1000 * 60 * 60);
    return diffInHours >= 0 && diffInHours <= 24;
  } catch (error) {
    console.error('Error checking if notification is recent:', error);
    return false;
  }
};

// Helper function to get notification priority color
export const getPriorityColor = (priority: string): string => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low':
      return 'text-green-600 bg-green-50 border-green-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

// Helper function to get alert type color
export const getAlertTypeColor = (alertType: string): string => {
  if (alertType.includes('Created') || alertType.includes('Submitted')) {
    return 'text-blue-600 bg-blue-50';
  } else if (alertType.includes('Approved') || alertType.includes('Completed') || alertType.includes('Override')) {
    return 'text-green-600 bg-green-50';
  } else if (alertType.includes('Rejected')) {
    return 'text-red-600 bg-red-50';
  } else if (alertType.includes('Requested') || alertType.includes('Pending') || alertType.includes('Request')) {
    return 'text-yellow-600 bg-yellow-50';
  }
  return 'text-gray-600 bg-gray-50';
};

// Helper function to truncate long messages
export const truncateMessage = (message: string, maxLength: number = 100): string => {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength) + '...';
};

// Helper function to extract entity ID from notification message if not provided
export const extractEntityId = (message: string): string | null => {
  // Try to match PO-YYYY-XXXX pattern
  const poMatch = message.match(/PO-\d{4}-\d+/);
  if (poMatch) {
    return poMatch[0];
  }
  
  // Try to match Purchase Order followed by PO number
  const purchaseOrderMatch = message.match(/Purchase Order\s+([A-Z0-9-]+)/);
  if (purchaseOrderMatch) {
    return purchaseOrderMatch[1];
  }
  
  return null;
};

// Export interface for notification payload
export interface NotificationPayload {
  created_at?: string;
  acknowledged_at?: string | null;
  assign_to: string;
  message: string;
  status: 'New' | 'Read' | 'Deleted';
  priority: 'Low' | 'Medium' | 'High';
  alert_type: string;
  entity_id: string;
}

// Export interface for notification from database
export interface NotificationFromDB {
  id: string;
  created_at: string;
  acknowledged_at?: string | null;
  assign_to: string;
  message: string;
  status: 'New' | 'Read' | 'Deleted';
  priority: 'Low' | 'Medium' | 'High';
  alert_type: string;
  entity_id: string;
}

// Helper function to format notification for display
export const formatNotificationForDisplay = (notification: NotificationFromDB) => {
  return {
    ...notification,
    formattedTime: formatRelativeTime(notification.created_at),
    absoluteTime: formatAbsoluteTime(notification.created_at),
    isRecent: isRecentNotification(notification.created_at),
    priorityColor: getPriorityColor(notification.priority),
    alertTypeColor: getAlertTypeColor(notification.alert_type),
    truncatedMessage: truncateMessage(notification.message, 80)
  };
};

// Debounced notification trigger to avoid multiple rapid triggers
let triggerTimeout: NodeJS.Timeout | null = null;

export const debouncedTriggerNotificationUpdate = (delay: number = 1000): void => {
  if (triggerTimeout) {
    clearTimeout(triggerTimeout);
  }
  
  triggerTimeout = setTimeout(() => {
    triggerNotificationUpdate();
    triggerTimeout = null;
  }, delay);
};
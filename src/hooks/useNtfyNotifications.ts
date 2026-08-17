import { INotificationMessage } from '@/Utils/constants';
import { useEffect, useCallback, useState, useRef } from 'react';
const server = import.meta.env.VITE_NTFY_SERVER_URL;
const topic = import.meta.env.VITE_NTFY_TOPIC;

interface UseNtfyNotificationsProps {
  onNotification?: (notification: INotificationMessage) => void;
}

export const useNtfyNotifications = ({
  onNotification
}: UseNtfyNotificationsProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isReconnectingRef = useRef<boolean>(false);
  const isErrorPendingRef = useRef<boolean>(false);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 15000; // 15 seconds
  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setError('This browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      setError(null);
      return true;
    }

    if (Notification.permission === 'denied') {
      setError('Notification permission denied. Please enable notifications in your browser settings.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setError(null);
        return true;
      } else {
        setError('Notification permission was not granted.');
        return false;
      }
    } catch (err) {
      setError('Error requesting notification permission.');
      console.error('Permission request error:', err);
      return false;
    }
  }, []);

  // Show system notification
  const showSystemNotification = useCallback((notification: INotificationMessage) => {
    if (Notification.permission === 'granted') {
      const systemNotification = new Notification(
        notification.title || notification.topic,
        {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id,
          requireInteraction: notification.priority === 5,
        }
      );

      systemNotification.onclick = () => {
        if (notification.click) {
          window.open(notification.click, '_blank');
        }
        systemNotification.close();
        window.focus();
      };
    }
  }, []);

  // Connect to ntfy server with retry logic
  const connect = useCallback(async () => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log('Already connected, skipping connect attempt');
      return;
    }

    if (isReconnectingRef.current) {
      console.log('Reconnection already in progress, skipping');
      return;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      if (!isErrorPendingRef.current) {
        isErrorPendingRef.current = true;
        setError('Max reconnection attempts reached. Please check your network or server settings.');
        console.log('Max reconnection attempts reached, stopping retries');
      }
      return;
    }

    isReconnectingRef.current = true;
    try {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        setError('Cannot connect: Notification permission denied.');
        isReconnectingRef.current = false;
        isErrorPendingRef.current = true;
        return;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const url = `${server}/${topic}/sse`;
      console.log('Attempting to connect to:', url);
      const newEventSource = new EventSource(url);
      eventSourceRef.current = newEventSource;

      newEventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        isReconnectingRef.current = false;
        isErrorPendingRef.current = false;
        console.log('Connected to ntfy server');
      };

      newEventSource.onmessage = (event) => {
        try {
          const notification: INotificationMessage = JSON.parse(event.data);
          if (notification.event === 'message') {
            showSystemNotification(notification);
            onNotification?.(notification);
          }
        } catch (err) {
          console.error('Error parsing notification:', err);
        }
      };

      newEventSource.onerror = () => {
        if (isErrorPendingRef.current) {
          console.log('Ignoring onerror due to pending error state');
          return;
        }

        isErrorPendingRef.current = true;
        console.log('EventSource error, attempt:', reconnectAttemptsRef.current);
        setIsConnected(false);
        setError(`Connection error. Attempting to reconnect (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})...`);
        reconnectAttemptsRef.current += 1;

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          console.log(`Scheduling reconnection attempt ${reconnectAttemptsRef.current} in ${delay}ms`);
          reconnectTimeoutRef.current = setTimeout(() => {
            isReconnectingRef.current = false;
            connect();
          }, delay);
        } else {
          setError('Max reconnection attempts reached. Please check your network or server settings.');
          isReconnectingRef.current = false;
          isErrorPendingRef.current = false;
          console.log('Max reconnection attempts reached, stopping retries');
        }
        isErrorPendingRef.current = false;
      };
    } catch (err) {
      if (!isErrorPendingRef.current) {
        isErrorPendingRef.current = true;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsConnected(false);
      }
      reconnectAttemptsRef.current += 1;

      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
        console.log(`Scheduling reconnection attempt ${reconnectAttemptsRef.current} in ${delay}ms`);
        reconnectTimeoutRef.current = setTimeout(() => {
          isReconnectingRef.current = false;
          connect();
        }, delay);
      } else {
        setError('Max reconnection attempts reached. Please check your network or server settings.');
        isReconnectingRef.current = false;
        isErrorPendingRef.current = false;
        console.log('Max reconnection attempts reached, stopping retries');
      }
    }
  }, [topic, server, onNotification, requestNotificationPermission, showSystemNotification]);

  // Disconnect from ntfy server
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;
    isErrorPendingRef.current = false;
  }, []);

  // Send notification to topic
  const sendNotification = useCallback(async (
    message: string,
    options?: {
      title?: string;
      priority?: number;
      tags?: string[];
      click?: string;
    }
  ) => {
    try {
      console.log('Sending notification to:', `${server}/${topic}`);
      const response = await fetch(`${server}/${topic}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          ...(options?.title && { 'Title': options.title }),
          ...(options?.priority && { 'Priority': options.priority.toString() }),
          ...(options?.tags && { 'Tags': options.tags.join(',') }),
          ...(options?.click && { 'Click': options.click }),
        },
        body: message,
      });

      if (!response.ok) {
        throw new Error(`Failed to send notification: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error sending notification:', err);
      throw err;
    }
  }, [server, topic]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    sendNotification,
    requestNotificationPermission
  };
};
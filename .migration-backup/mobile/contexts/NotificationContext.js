import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { notificationSocket } from '../lib/notificationSocket';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({});

export function NotificationProvider({ children }) {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [latestNotification, setLatestNotification] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user && token) {
      notificationSocket.connect();
      
      const removeAuthListener = notificationSocket.addAuthListener((success) => {
        setIsConnected(success);
      });

      const removeNotificationListener = notificationSocket.addNotificationListener((notification) => {
        console.log('[NotificationContext] New notification:', notification.title);
        setLatestNotification(notification);
        setUnreadCount(prev => prev + 1);
      });

      return () => {
        removeAuthListener();
        removeNotificationListener();
        notificationSocket.disconnect();
      };
    }
  }, [user, token]);

  const clearLatestNotification = useCallback(() => {
    setLatestNotification(null);
  }, []);

  const updateUnreadCount = useCallback((count) => {
    setUnreadCount(count);
  }, []);

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  return (
    <NotificationContext.Provider value={{
      isConnected,
      latestNotification,
      clearLatestNotification,
      unreadCount,
      updateUnreadCount,
      decrementUnreadCount,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

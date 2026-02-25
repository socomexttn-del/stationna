import { useEffect, useRef, useCallback, useState } from 'react';

export const useNotifications = (api, role, onNotification) => {
  const [isConnected, setIsConnected] = useState(false);
  const lastCheckRef = useRef(null);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const params = lastCheckRef.current ? `?since=${lastCheckRef.current}` : '';
      const response = await api.get(`/notifications${params}`);
      
      setIsConnected(true);
      
      const { notifications } = response.data;
      if (notifications && notifications.length > 0) {
        // Update last check time
        lastCheckRef.current = new Date().toISOString();
        
        // Process each notification
        const notificationIds = [];
        for (const notif of notifications) {
          notificationIds.push(notif.id);
          onNotification?.({
            type: notif.type,
            ...notif.data
          });
        }
        
        // Mark as read
        if (notificationIds.length > 0) {
          try {
            await api.post('/notifications/read', notificationIds);
          } catch (e) {
            console.error('Error marking notifications as read:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setIsConnected(false);
    }
  }, [api, onNotification]);

  useEffect(() => {
    // Initial fetch
    fetchNotifications();
    lastCheckRef.current = new Date().toISOString();
    
    // Poll every 3 seconds for near real-time updates
    intervalRef.current = setInterval(fetchNotifications, 3000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchNotifications]);

  return { isConnected };
};

export default useNotifications;

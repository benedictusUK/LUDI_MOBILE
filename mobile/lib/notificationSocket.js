import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

class NotificationSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Set();
    this.authListeners = new Set();
  }

  async connect() {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      console.log('[NotificationSocket] Already connected or connecting, skipping');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.log('[NotificationSocket] No token found, skipping connection');
        return;
      }

      const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
      const fullWsUrl = `${wsUrl}/ws/notifications`;
      
      console.log('[NotificationSocket] Connecting to:', fullWsUrl);
      
      this.socket = new WebSocket(fullWsUrl);

      this.socket.onopen = () => {
        console.log('[NotificationSocket] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        this.socket.send(JSON.stringify({
          type: 'auth',
          token: token
        }));
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[NotificationSocket] Received:', message.type);
          
          if (message.type === 'auth_success') {
            console.log('[NotificationSocket] Authenticated successfully');
            this.authListeners.forEach(listener => listener(true));
          } else if (message.type === 'auth_error') {
            console.error('[NotificationSocket] Auth failed:', message.message);
            this.authListeners.forEach(listener => listener(false));
          } else if (message.type === 'notification') {
            this.listeners.forEach(listener => listener(message.data));
          }
        } catch (error) {
          console.error('[NotificationSocket] Parse error:', error);
        }
      };

      this.socket.onclose = (event) => {
        console.log('[NotificationSocket] Disconnected', event.code, event.reason);
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('[NotificationSocket] Error:', error?.message || 'Connection error');
      };

    } catch (error) {
      console.error('[NotificationSocket] Connection error:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[NotificationSocket] Reconnecting... attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), this.reconnectDelay);
    } else {
      console.log('[NotificationSocket] Max reconnect attempts reached');
    }
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }

  addNotificationListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  addAuthListener(callback) {
    this.authListeners.add(callback);
    return () => this.authListeners.delete(callback);
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const notificationSocket = new NotificationSocketService();

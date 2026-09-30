import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  metadata?: any;
  createdAt: Date;
}

class NotificationWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws/notifications' 
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('WebSocket client connected');
      
      ws.isAlive = true;
      
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'auth') {
            this.authenticateClient(ws, message.token);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(ws);
      });
    });

    const interval = setInterval(() => {
      this.wss?.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          this.removeClient(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    console.log('WebSocket notification server initialized on /ws/notifications');
  }

  private authenticateClient(ws: AuthenticatedWebSocket, token: string) {
    try {
      const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
      if (!jwtSecret) {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Server configuration error' }));
        console.error('JWT_SECRET or SESSION_SECRET not configured');
        ws.close(1008, 'Server configuration error');
        return;
      }
      
      const decoded = jwt.verify(token, jwtSecret) as { claims?: { sub?: string }; userId?: string };
      const userId = decoded.claims?.sub || decoded.userId;
      
      if (!userId) {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token structure' }));
        console.error('WebSocket auth failed: no userId in token');
        ws.close(1008, 'Invalid token');
        return;
      }
      
      ws.userId = userId;
      
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)!.add(ws);
      
      ws.send(JSON.stringify({ type: 'auth_success', userId }));
      console.log(`WebSocket authenticated for user: ${userId}`);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
      console.error('WebSocket auth failed:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  private removeClient(ws: AuthenticatedWebSocket) {
    if (ws.userId && this.clients.has(ws.userId)) {
      this.clients.get(ws.userId)!.delete(ws);
      if (this.clients.get(ws.userId)!.size === 0) {
        this.clients.delete(ws.userId);
      }
    }
  }

  sendNotification(userId: string, notification: NotificationPayload) {
    const userClients = this.clients.get(userId);
    
    if (!userClients || userClients.size === 0) {
      console.log(`No active WebSocket connections for user: ${userId}`);
      return false;
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    let sent = false;
    userClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sent = true;
      }
    });

    if (sent) {
      console.log(`Notification sent to user ${userId}: ${notification.title}`);
    }
    
    return sent;
  }

  broadcastToUsers(userIds: string[], notification: NotificationPayload) {
    userIds.forEach(userId => this.sendNotification(userId, notification));
  }

  getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  getConnectionCount(): number {
    let count = 0;
    this.clients.forEach(clients => count += clients.size);
    return count;
  }
}

export const notificationWS = new NotificationWebSocketServer();

'use client';

import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: 'connected' | 'job_update' | 'log' | 'job_completed' | 'job_failed';
  message?: string;
  timestamp?: string;
  job?: any;
  results?: any[];
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<Array<{ message: string; timestamp: string }>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { onMessage, onConnect, onDisconnect, reconnectInterval = 3000 } = options;

  const connect = () => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        onConnect?.();
        console.log('✅ Connexion WebSocket établie');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          
          // Gestion des logs avec vérification stricte des types
          if (data.type === 'log' && typeof data.message === 'string' && typeof data.timestamp === 'string') {
            const message = data.message;
            const timestamp = data.timestamp;
            setLogs(prev => [...prev, { message, timestamp }]);
          }

          onMessage?.(data);
        } catch (error) {
          console.error('Erreur parsing message WebSocket:', error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();
        console.log('🔌 Connexion WebSocket fermée');

        // Reconnexion automatique
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Tentative de reconnexion...');
          connect();
        }, reconnectInterval);
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
      };

    } catch (error) {
      console.error('❌ Erreur lors de la connexion WebSocket:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    isConnected,
    logs,
    clearLogs,
    connect,
    disconnect,
  };
} 
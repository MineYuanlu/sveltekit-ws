import type { WebSocket } from 'ws';
import type { WSConnection, WSMessage, WSManager } from './types.js';
import { randomUUID } from 'crypto';

/**
 * WebSocket 管理器实现
 */
export class WebSocketManager implements WSManager {
    private connections: Map<string, WSConnection> = new Map();

    /**
     * 添加新连接
     */
    addConnection(ws: WebSocket, metadata?: Record<string, any>): WSConnection {
        const id = randomUUID();
        const connection: WSConnection = { ws, id, metadata };
        this.connections.set(id, connection);
        return connection;
    }

    /**
     * 获取所有活跃连接
     */
    getConnections(): Map<string, WSConnection> {
        return new Map(this.connections);
    }

    /**
     * 通过ID获取连接
     */
    getConnection(id: string): WSConnection | undefined {
        return this.connections.get(id);
    }

    /**
     * 发送消息到特定连接
     */
    send(id: string, message: WSMessage): boolean {
        const connection = this.connections.get(id);
        if (!connection || connection.ws.readyState !== 1) {
            return false;
        }

        try {
            const payload = JSON.stringify({
                ...message,
                timestamp: message.timestamp || Date.now()
            });
            connection.ws.send(payload);
            return true;
        } catch (error) {
            console.error(`Failed to send message to ${id}:`, error);
            return false;
        }
    }

    /**
     * 广播消息到所有连接
     */
    broadcast(message: WSMessage, exclude: string[] = []): void {
        const payload = JSON.stringify({
            ...message,
            timestamp: message.timestamp || Date.now()
        });

        this.connections.forEach((connection, id) => {
            if (exclude.includes(id)) return;
            if (connection.ws.readyState === 1) {
                try {
                    connection.ws.send(payload);
                } catch (error) {
                    console.error(`Failed to broadcast to ${id}:`, error);
                }
            }
        });
    }

    /**
     * 移除连接
     */
    removeConnection(id: string): boolean {
        return this.connections.delete(id);
    }

    /**
     * 断开特定连接
     */
    disconnect(id: string): boolean {
        const connection = this.connections.get(id);
        if (!connection) return false;

        try {
            connection.ws.close();
            this.connections.delete(id);
            return true;
        } catch (error) {
            console.error(`Failed to disconnect ${id}:`, error);
            return false;
        }
    }

    /**
     * 获取活跃连接数
     */
    size(): number {
        return this.connections.size;
    }

    /**
     * 清除所有连接
     */
    clear(): void {
        this.connections.forEach((connection) => {
            try {
                connection.ws.close();
            } catch (error) {
                // Ignore errors during cleanup
            }
        });
        this.connections.clear();
    }
}

// 全局单例实例
let globalManager: WebSocketManager | null = null;

/**
 * 获取或创建全局 WebSocket 管理器
 */
export function getWebSocketManager(): WebSocketManager {
    if (!globalManager) {
        globalManager = new WebSocketManager();
    }
    return globalManager;
}
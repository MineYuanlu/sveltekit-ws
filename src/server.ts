import type { Server as HTTPServer } from 'http';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import type { WSServerOptions } from './types.js';
import { getWebSocketManager } from './manager.js';

/**
 * 为生产服务器创建 WebSocket 处理器
 */
export function createWebSocketHandler(
    httpServer: HTTPServer,
    options: WSServerOptions = {}
) {
    const {
        path = '/ws',
        handlers = {},
        maxPayload = 1024 * 1024,
        heartbeat = true,
        heartbeatInterval = 30000,
        verifyClient
    } = options;

    const wss = new WebSocketServer({
        noServer: true,
        maxPayload,
        verifyClient: verifyClient
            ? (info, callback) => {
                Promise.resolve(verifyClient(info))
                    .then((result) => callback(result))
                    .catch(() => callback(false));
            }
            : undefined
    });

    const manager = getWebSocketManager();
    const heartbeatTimers = new Map<string, NodeJS.Timeout>();

    // 处理升级请求
    httpServer.on('upgrade', (
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer
    ) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);

        if (url.pathname === path) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    // 处理连接
    wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
        const connection = manager.addConnection(ws, {
            url: request.url,
            headers: request.headers,
            remoteAddress: request.socket.remoteAddress
        });

        console.log(`[WS] Client connected: ${connection.id}`);

        try {
            await handlers.onConnect?.(connection);
        } catch (error) {
            console.error('[WS] Error in onConnect handler:', error);
        }

        // 设置心跳
        if (heartbeat) {
            const timer = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                }
            }, heartbeatInterval);
            heartbeatTimers.set(connection.id, timer);
        }

        // 处理消息
        ws.on('message', async (rawData) => {
            try {
                const message = JSON.parse(rawData.toString());
                await handlers.onMessage?.(connection, message);
            } catch (error) {
                console.error('[WS] Error handling message:', error);
                await handlers.onError?.(connection, error as Error);
            }
        });

        // 处理错误
        ws.on('error', async (error) => {
            console.error(`[WS] WebSocket error for ${connection.id}:`, error);
            await handlers.onError?.(connection, error);
        });

        // 处理断开连接
        ws.on('close', async () => {
            console.log(`[WS] Client disconnected: ${connection.id}`);

            const timer = heartbeatTimers.get(connection.id);
            if (timer) {
                clearInterval(timer);
                heartbeatTimers.delete(connection.id);
            }

            manager.removeConnection(connection.id);

            try {
                await handlers.onDisconnect?.(connection);
            } catch (error) {
                console.error('[WS] Error in onDisconnect handler:', error);
            }
        });
    });

    console.log(`[WS] WebSocket server initialized at ${path}`);

    // 返回清理函数
    return () => {
        heartbeatTimers.forEach((timer) => clearInterval(timer));
        heartbeatTimers.clear();
        manager.clear();
        wss.close();
    };
}
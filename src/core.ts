import type { Server as HTTPServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import type { WSMessage, WSServerOptions } from './types.js';
import { getWebSocketManagerImpl } from './manager.js';
import type { Plugin, ViteDevServer } from 'vite';

export function isWSMessage(message: unknown): message is WSMessage {
    if (!message || typeof message !== 'object') return false;
    const msg = message as WSMessage;
    if (typeof msg.type !== 'string') return false;
    return true;
}

function create(options: WSServerOptions = {}) {
    const {
        path = '/ws',
        maxPayload = 1024 * 1024,
        heartbeat = true,
        heartbeatInterval = 30000,
        verifyClient,
    } = options;

    let wsServer: WebSocketServer | null = null;
    const manager = getWebSocketManagerImpl();
    const heartbeatTimers = new Map<string, NodeJS.Timeout>();

    function createWSS(httpServer: {
        on(
            event: 'upgrade',
            listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
        ): unknown;
    }) {
        closeWSS();
        const wss = new WebSocketServer({
            noServer: true,
            maxPayload,
            autoPong: true,
            verifyClient: verifyClient
                ? (info, callback) => {
                      Promise.resolve(verifyClient(info))
                          .then((result) => callback(result))
                          .catch(() => callback(false));
                  }
                : undefined,
        });
        wsServer = wss;

        // 处理升级请求
        httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
            const url = new URL(request.url || '', `http://${request.headers.host}`);

            if (url.pathname !== path) return;

            if (!manager.getMainHandler()) {
                socket.destroy();
                return;
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        });

        // 处理连接
        wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
            const connection = manager.addConnection(ws, {
                url: request.url,
                headers: request.headers,
                remoteAddress: request.socket.remoteAddress,
            });

            try {
                await manager.getMainHandler()?.onConnect?.(connection);
            } catch (err) {
                try {
                    manager.log(
                        'error',
                        { err, connection: connection.id },
                        'Error in onConnect handler',
                    );
                } finally {
                    try {
                        connection.ws.close();
                        manager.removeConnection(connection.id);
                    } catch (err) {
                        manager.log(
                            'error',
                            { err, connection: connection.id },
                            'Failed to disconnect',
                        );
                    }
                }
                return;
            }

            let lastActive = Date.now();
            // 设置心跳
            if (heartbeat) {
                const timer = setInterval(() => {
                    if (!lastActive || Date.now() - lastActive > heartbeatInterval * 1.5) {
                        try {
                            ws.terminate();
                        } catch (_) {}
                        return;
                    }
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.ping();
                    }
                }, heartbeatInterval);
                heartbeatTimers.set(connection.id, timer);
            }

            ws.on('pong', () => {
                lastActive = Date.now();
            });

            // 处理消息
            ws.on('message', async (rawData) => {
                let message: WSMessage;
                try {
                    message = JSON.parse(rawData.toString());
                    if (!isWSMessage(message)) throw new Error('Invalid message format');
                } catch (error) {
                    try {
                        await manager.getMainHandler()?.onError?.(connection, error);
                    } catch (err) {
                        manager.log(
                            'error',
                            { err, connection: connection.id },
                            'Error in onError handler',
                        );
                    }
                    return;
                }
                try {
                    await manager.getMainHandler()?.onMessage?.(connection, message);
                } catch (err) {
                    manager.log(
                        'error',
                        { err, connection: connection.id },
                        'Error in onMessage handler',
                    );
                    return;
                }
            });

            // 处理错误
            ws.on('error', async (error) => {
                try {
                    await manager.getMainHandler()?.onError?.(connection, error);
                } catch (err) {
                    manager.log(
                        'error',
                        { err, connection: connection.id },
                        'Error in onError handler',
                    );
                    return;
                }
            });

            // 处理断开连接
            ws.on('close', async () => {
                const timer = heartbeatTimers.get(connection.id);
                if (timer) {
                    clearInterval(timer);
                    heartbeatTimers.delete(connection.id);
                }

                manager.removeConnection(connection.id);

                try {
                    await manager.getMainHandler()?.onDisconnect?.(connection);
                } catch (error) {
                    manager.log(
                        'error',
                        { err: error, connection: connection.id },
                        'Error in onDisconnect handler',
                    );
                    return;
                }
            });
        });
    }
    function closeWSS() {
        heartbeatTimers.forEach((timer) => clearInterval(timer));
        heartbeatTimers.clear();
        manager.clear();
        wsServer?.close();
        wsServer = null;
    }
    return {
        createWSS,
        closeWSS,
    };
}

/**
 * 为生产服务器创建 WebSocket 处理器
 */
export function createWebSocketHandler(httpServer: HTTPServer, options: WSServerOptions = {}) {
    const { createWSS, closeWSS } = create(options);
    createWSS(httpServer);
    process.on('sveltekit:shutdown', closeWSS);
}

/**
 * 为开发环境创建 Vite WebSocket 插件
 */
export function viteWebSocketServer(options: WSServerOptions = {}): Plugin {
    const { createWSS, closeWSS } = create(options);

    return {
        name: 'sveltekit-websocket',

        configureServer(server: ViteDevServer) {
            const httpServer = server.httpServer;
            if (!httpServer) throw new Error('unsupported middleware mode');
            createWSS(httpServer);
        },

        closeBundle: closeWSS,
    };
}

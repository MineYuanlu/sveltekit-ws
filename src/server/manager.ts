import type { WebSocket } from 'ws';
import type {
    WSConnection,
    WSManager,
    WSHandlers,
    WSLogFunction,
    WSConnectionMetadata,
    WSConnectionLocals,
} from './types.js';
import type { WSMessage } from '../common/types.js';
import { defaultHandler, initInternalHandler } from './handler.js';

const IdPrefix = Math.random().toString(36).substring(2);
let IdIndex = 0;

class WebSocketConnection implements WSConnection {
    public readonly locals: Partial<WSConnectionLocals> = {};
    public readonly handlers: ReadonlyArray<WSHandlers<string>>;
    public readonly msgHandler: ReadonlyMap<string, WSHandlers[]>;
    constructor(
        public ws: WebSocket,
        public id: string,
        public readonly metadata: WSConnectionMetadata,
        handlers: ReadonlyArray<WSHandlers<string>>,
        msgHandler: ReadonlyMap<string, WSHandlers[]>,
    ) {
        this.handlers = [...handlers];
        const handlerMap = new Map();
        for (const [type, handlers] of msgHandler) {
            handlerMap.set(type, [...handlers]);
        }
        this.msgHandler = handlerMap;
    }

    /**
     * 发送消息
     */
    send(message: WSMessage): boolean {
        if (this.ws.readyState !== 1) {
            return false;
        }

        try {
            const payload = JSON.stringify({
                ...message,
                timestamp: message.timestamp || Date.now(),
            });
            this.ws.send(payload);
            return true;
        } catch (err) {
            getWebSocketManager().log(
                'error',
                { err, connection: this.id },
                'Failed to send message',
            );
            return false;
        }
    }

    sendRaw(payload: Parameters<WebSocket['send']>[0]): boolean {
        if (this.ws.readyState !== 1) {
            return false;
        }
        try {
            this.ws.send(payload);
            return true;
        } catch (err) {
            getWebSocketManager().log(
                'error',
                { err, connection: this.id },
                'Failed to send message',
            );
            return false;
        }
    }

    disconnect(): boolean {
        return getWebSocketManager().disconnect(this.id);
    }
}
/**
 * WebSocket 管理器实现
 */
export class WebSocketManager implements WSManager {
    private connections: Map<string, WSConnection> = new Map();

    private readonly handlers: WSHandlers<any>[] = [];
    private readonly msgHandler: Map<string, WSHandlers<any>[]> = new Map();
    private logger: WSLogFunction | undefined;
    private mainHandler: WSHandlers<any> = defaultHandler;

    constructor() {
        initInternalHandler(this);
    }
    /**
     * 初始化 WebSocket 管理器
     */
    init(logger: WSLogFunction | undefined) {
        this.logger = logger;
    }

    setMainHandler(handler: WSHandlers<any, any>): void {
        this.mainHandler = handler;
    }

    resetMainHandler(): void {
        this.mainHandler = defaultHandler;
    }

    getMainHandler(): WSHandlers {
        return this.mainHandler;
    }

    /**
     * 添加新连接
     */
    addConnection(ws: WebSocket, metadata: WSConnectionMetadata): WSConnection {
        const id = `${IdPrefix}-${++IdIndex}`;
        const connection = new WebSocketConnection(
            ws,
            id,
            metadata,
            this.handlers,
            this.msgHandler,
        );
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
     * 添加事件处理器
     */
    addHandler<MessageTypes extends string = string>(
        types: readonly MessageTypes[],
        handler: WSHandlers<MessageTypes>,
    ): void {
        types.forEach((type) => {
            let arr = this.msgHandler.get(type);
            if (!arr) this.msgHandler.set(type, (arr = []));
            arr.push(handler);
        });
        this.handlers.push(handler);
    }

    /**
     * 移除事件处理器
     */
    removeHandler(handler: WSHandlers<any>): void {
        const rem = (arr: WSHandlers<any>[]) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i] === handler) arr.splice(i, 1);
            }
        };
        rem(this.handlers);
        this.msgHandler.forEach((arr, type) => {
            rem(arr);
            if (arr.length === 0) this.msgHandler.delete(type);
        });
    }

    /**
     * 获取事件处理器
     */
    getHandlers(type: string): WSHandlers[] | undefined {
        return this.msgHandler.get(type);
    }

    /**
     * 获取日志记录器
     */
    log(...arg: Parameters<WSLogFunction>): void {
        this.logger?.(...arg);
    }

    /**
     * 发送消息到特定连接
     */
    send(id: string, message: WSMessage): boolean {
        const connection = this.connections.get(id);
        if (!connection) {
            return false;
        }
        return connection.send(message);
    }

    /**
     * 广播消息到所有连接
     */
    broadcast(message: WSMessage, exclude: string[] = []): void {
        const payload = JSON.stringify({
            ...message,
            timestamp: message.timestamp || Date.now(),
        });

        this.connections.forEach((connection, id) => {
            if (exclude.includes(id)) return;
            connection.sendRaw(payload);
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
        } catch (err) {
            this.log('error', { err, connection: id }, 'Failed to disconnect');
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
export function getWebSocketManagerImpl(): WebSocketManager {
    return (globalManager ??= new WebSocketManager());
}

/**
 * 获取全局 WebSocket 管理器
 */
export function getWebSocketManager(): WSManager {
    return getWebSocketManagerImpl();
}

import type { WebSocket } from 'ws';

/**
 * WebSocket 连接及其元数据
 */
export interface WSConnection {
    ws: WebSocket;
    id: string;
    metadata?: Record<string, any>;
    handler?: WSHandlers;
}

/**
 * WebSocket 消息结构
 */
export interface WSMessage<T = any> {
    type: string;
    data: T;
    timestamp?: number;
}

/**
 * WebSocket 日志函数
 */
export type WSLogFunction = (msg:{type: "info" | "warn" | "error"; message: string; id?: string;  }) => void;

/**
 * WebSocket 事件处理器
 */
export interface WSHandlers {
    onConnect?: (connection: WSConnection) => void | Promise<void>;
    onDisconnect?: (connection: WSConnection) => void | Promise<void>;
    onMessage?: (connection: WSConnection, message: WSMessage) => void | Promise<void>;
    onError?: (connection: WSConnection, error: Error) => void | Promise<void>;
}

/**
 * WebSocket 服务器选项
 */
export interface WSServerOptions {
    /**
     * WebSocket 连接路径
     * @default '/ws'
     */
    path?: string;

    /**
     * 事件处理器
     */
    handlers?: WSHandlers;

    /**
     * 最大消息大小（字节）
     * @default 1048576 (1MB)
     */
    maxPayload?: number;

    /**
     * 启用 ping/pong 心跳
     * @default true
     */
    heartbeat?: boolean;

    /**
     * 心跳间隔（毫秒）
     * @default 30000
     */
    heartbeatInterval?: number;

    /**
     * 自定义连接验证器
     */
    verifyClient?: (info: {
        origin: string;
        secure: boolean;
        req: any;
    }) => boolean | Promise<boolean>;
}

/**
 * WebSocket 连接管理器
 */
export interface WSManager {
    /**
     * 获取所有活跃连接
     */
    getConnections(): Map<string, WSConnection>;

    /**
     * 通过ID获取连接
     */
    getConnection(id: string): WSConnection | undefined;

    /**
     * 发送消息到特定连接
     */
    send(id: string, message: WSMessage): boolean;

    /**
     * 广播消息到所有连接
     */
    broadcast(message: WSMessage, exclude?: string[]): void;

    /**
     * 断开特定连接
     */
    disconnect(id: string): boolean;

    /**
     * 获取活跃连接数
     */
    size(): number;
}
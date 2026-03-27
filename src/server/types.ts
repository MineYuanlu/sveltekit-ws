import type { IncomingHttpHeaders } from 'node:http';
import type { WebSocket } from 'ws';
import { WSMessage } from '../common/types';

export interface WSConnectionMetadata {
    url?: string;
    headers: IncomingHttpHeaders;
    remoteAddress?: string;
}

export interface WSConnectionLocals {}

/**
 * WebSocket 连接及其元数据
 */
export interface WSConnection {
    ws: WebSocket;
    id: string;
    /** 连接的元数据 */
    readonly metadata: WSConnectionMetadata;
    /** 连接的本地数据 */
    readonly locals: Partial<WSConnectionLocals>;
    /**
     * 处理器列表, 在连接时确定, 确保能正确覆盖完整生命周期
     */
    readonly handlers: ReadonlyArray<WSHandlers>;
    /**
     * 处理器列表, 消息类型到处理器的映射
     */
    readonly msgHandler: ReadonlyMap<string, WSHandlers[]>;

    /**
     * 发送消息
     *
     * @return 是否发送成功
     */
    send(message: WSMessage): boolean;
    sendRaw(payload: Parameters<WebSocket['send']>[0]): boolean;

    disconnect(): boolean;
}

/**
 * WebSocket 日志函数
 *
 * @link https://github.com/pinojs/pino/blob/1e825f32a509ea452c59a143d507379ffe6ee00b/pino.d.ts#L341
 */
export type WSLogFunction = <TMsg extends string = string>(
    type: 'bad_msg' | 'error',
    obj: {
        err?: any;
        connection?: string;
    },
    msg?: TMsg,
    ...args: any[]
) => void;

/**
 * WebSocket 事件处理器
 */
export interface WSHandlers<MessageTypes extends string = string> {
    onConnect?: (connection: WSConnection) => void | Promise<void>;
    onDisconnect?: (connection: WSConnection) => void | Promise<void>;
    onMessage?: (
        connection: WSConnection,
        message: WSMessage<any, MessageTypes>,
    ) => void | Promise<void>;
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
     * 初始化 WebSocket 管理器
     *
     * 应在`hooks.server.js`中调用
     * @param logger 日志记录器
     */
    init(logger: WSLogFunction | undefined): void;

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

    /**
     * 添加事件处理器
     */
    addHandler<MessageTypes extends string = string>(
        type: MessageTypes[],
        handler: WSHandlers<MessageTypes>,
    ): void;

    /**
     * 移除事件处理器
     */
    removeHandler(handler: WSHandlers<any>): void;

    /**
     * 获取事件处理器
     * @param type 事件类型
     */
    getHandlers(type: string): WSHandlers[] | undefined;

    /**
     * 获取日志记录器
     */
    log(...arg: Parameters<WSLogFunction>): void;
}

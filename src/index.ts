export { getWebSocketManager, WebSocketManager } from './manager.js';
export type {
    WSConnection,
    WSMessage,
    WSHandlers,
    WSServerOptions,
    WSManager
} from './types.js';

// 为方便起见重新导出
export { webSocketServer } from './vite.js';
export { createWebSocketHandler } from './server.js';
export { ChannelType, channelHandler } from './handler.js';
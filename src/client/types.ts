import { WSMessage } from '../common/types';

/**
 * WebSocket 事件处理器
 */
export interface WSHandlers<Messages extends WSMessage = WSMessage> {
    onConnect?: () => void | Promise<void>;
    onDisconnect?: () => void | Promise<void>;
    onMessage?: (message: Messages) => void | Promise<void>;
}

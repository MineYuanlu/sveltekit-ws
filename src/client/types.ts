import { WSMessage } from '../common/types';

/**
 * WebSocket 事件处理器
 */
export interface WSHandlers<MessageTypes extends string = string> {
    onConnect?: () => void | Promise<void>;
    onDisconnect?: () => void | Promise<void>;
    onMessage?: (message: WSMessage<any, MessageTypes>) => void | Promise<void>;
}

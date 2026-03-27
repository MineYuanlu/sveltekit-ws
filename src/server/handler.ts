import { TYPE_QUERY_HANDLER, TYPE_QUERY_HANDLER_RESPONSE } from '../common/consts';
import { getWebSocketManagerImpl } from './manager';
import type { WSHandlers, WSManager } from './types';

/** 注册内部处理器 */
export function initInternalHandler(manager: WSManager) {
    manager.addHandler([TYPE_QUERY_HANDLER], {
        onMessage(connection, message) {
            if (message.type === TYPE_QUERY_HANDLER) {
                connection.send({
                    type: TYPE_QUERY_HANDLER_RESPONSE,
                    data: [...connection.msgHandler.keys()],
                });
            }
        },
    });
}

export const defaultHandler: WSHandlers = {
    async onConnect(connection) {
        await Promise.all(connection.handlers.map((h) => h.onConnect?.(connection)));
    },
    async onMessage(connection, message) {
        const handlers = connection.msgHandler.get(message.type);
        if (handlers) await Promise.all(handlers.map((h) => h.onMessage?.(connection, message)));
    },
    async onDisconnect(connection) {
        await Promise.all(connection.handlers.map((h) => h.onDisconnect?.(connection)));
    },
};

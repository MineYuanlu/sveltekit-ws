import { ChannelType } from './consts';
import { getWebSocketManager } from './manager';
import { WSHandlers } from './types';

/**
 * 默认的消息处理器: 分发连接到对应的处理器
 */
export const channelHandler: WSHandlers = {
    onConnect(connection) {},
    async onMessage(connection, message) {
        if (connection.handler) {
            return connection.handler.onMessage?.(connection, message);
        }
        const manager = getWebSocketManager();
        if (message.type !== ChannelType) {
            manager.log(
                'bad_msg',
                { connection: connection.id },
                'Bad Initial Message Type: %s',
                shortStr(message.type),
            );
            manager.disconnect(connection.id);
            return;
        }
        if (typeof message.data !== 'string') {
            manager.log(
                'bad_msg',
                { connection: connection.id },
                'Bad Initial Message Data Type: %s',
                typeof message.data,
            );
            manager.disconnect(connection.id);
            return;
        }
        const handler = manager.getHandler(message.data);
        if (!handler) {
            manager.log(
                'bad_msg',
                { connection: connection.id },
                'Unknown Channel: %s',
                message.data,
            );
            manager.disconnect(connection.id);
            return;
        }
        connection.handler = handler;
        await handler.onConnect?.(connection);
    },
    onError(connection, error) {
        return connection.handler?.onError?.(connection, error);
    },
    onDisconnect(connection) {
        return connection.handler?.onDisconnect?.(connection);
    },
};

function shortStr(str: string, len = 64) {
    return str.length > len ? str.slice(0, len - 3) + '...' : str;
}

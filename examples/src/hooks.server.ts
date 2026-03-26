import type { Handle, ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getWebSocketManager } from '@yuanlu_yl/sveltekit-ws/server';

export const init: ServerInit = async () => {
    const manager = getWebSocketManager();

    // 注册聊天处理器，声明它处理的消息类型
    manager.addHandler(['identify', 'chat'], {
        onConnect(connection) {
            console.log(`[WS] chat: connection ${connection.id} established`);
            manager.send(connection.id, {
                type: 'welcome',
                data: { message: 'Connected to chat!' },
            });
        },
        onMessage(connection, message) {
            console.log(`[WS] chat: message from ${connection.id}`, message);

            switch (message.type) {
                case 'identify':
                    connection.locals.userId = message.data.userId;
                    connection.locals.username = message.data.username;
                    manager.send(connection.id, {
                        type: 'identified',
                        data: { connectionId: connection.id, userId: message.data.userId },
                    });
                    break;

                case 'chat':
                    manager.broadcast(
                        {
                            type: 'chat',
                            data: {
                                userId: connection.locals.userId,
                                username: connection.locals.username,
                                text: message.data.text,
                            },
                        },
                        [connection.id],
                    );
                    break;
            }
        },
        onDisconnect(connection) {
            console.log(`[WS] chat: connection ${connection.id} disconnected`);
        },
    });

    manager.init((type, obj, msg, ...args) => {
        if (type === 'error') console.error('[WS]', obj, msg, ...args);
        else if (type === 'bad_msg') console.warn('[WS]', obj, msg, ...args);
    });
};

export const handle: Handle = sequence();

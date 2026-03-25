import type { Handle, ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { channelHandler, getWebSocketManager } from '@yuanlu_yl/sveltekit-ws/server';

export const init: ServerInit = async () => {
    const manager = getWebSocketManager();

    manager.addHandler('chat', {
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
                    connection.metadata = {
                        ...connection.metadata,
                        userId: message.data.userId,
                        username: message.data.username,
                    };
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
                                userId: connection.metadata?.userId,
                                username: connection.metadata?.username,
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

    manager.init(channelHandler, (type, obj, msg, ...args) => {
        if (type === 'error') console.error('[WS]', obj, msg, ...args);
        else if (type === 'bad_msg') console.warn('[WS]', obj, msg, ...args);
    });
};

export const handle: Handle = sequence();

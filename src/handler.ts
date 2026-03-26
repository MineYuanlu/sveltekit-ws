import { TYPE_QUERY_HANDLER, TYPE_QUERY_HANDLER_RESPONSE } from './consts';
import { WSManager } from './types';

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

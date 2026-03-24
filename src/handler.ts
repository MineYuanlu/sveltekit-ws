import { getWebSocketManager } from "./manager";
import { WSHandlers } from "./types";

export const ChannelType = "channel";
/**
 * 默认的消息处理器: 分发连接到对应的处理器
 */
export const channelHandler: WSHandlers = {
  async onMessage(connection, message) {
    if (connection.handler) {
      await connection.handler.onMessage?.(connection, message);
      return;
    }
    const manager = getWebSocketManager();
    if (message.type !== ChannelType) {
      manager.log({
        type: "warn",
        id: connection.id,
        message: "Bad Initial Message Type: " + message.type,
      });
      manager.disconnect(connection.id);
      return;
    }
    if (typeof message.data !== "string") {
      manager.log({
        type: "warn",
        id: connection.id,
        message: "Bad Initial Message Data Type: " + typeof message.data,
      });
      manager.disconnect(connection.id);
      return;
    }
    const handler = manager.getHandler(message.data);
    if (!handler) {
      manager.log({
        type: "warn",
        id: connection.id,
        message: "Unknown Channel: " + message.data,
      });
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

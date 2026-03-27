/**
 * WebSocket 消息结构
 */
export interface WSMessage<Data = any, Type extends string = string> {
    type: Type;
    data: Data;
    timestamp?: number;
}

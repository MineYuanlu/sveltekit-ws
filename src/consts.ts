/** 消息类型: 查询当前连接加载的处理器都可以处理哪些消息类型 */
export const TYPE_QUERY_HANDLER = 'internal/query-handler';
export const TYPE_QUERY_HANDLER_RESPONSE = 'internal/query-handler/resp';
export const INTERNAL_TYPES = [TYPE_QUERY_HANDLER] as const;

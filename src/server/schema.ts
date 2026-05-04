import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { WSMessage } from '../common/types.js';
import type { WSHandlers, WSConnection } from './types.js';
import { getWebSocketManager } from './manager.js';

export type SchemaOnBad<
    ResponseType extends WSMessage,
    MsgType extends Record<string, StandardSchemaV1>,
> =
    | 'disconnect'
    | 'ignore'
    | {
          /** 发送错误消息的`type`字段 */
          sendError: string;
          /** 自定义错误消息的`data`字段 */
          getData?: (
              message: WSMessage<unknown, keyof MsgType & string>,
              issues: ReadonlyArray<StandardSchemaV1.Issue>,
          ) => unknown;
      }
    | ((
          connection: WSConnection<ResponseType>,
          message: WSMessage<unknown, keyof MsgType & string>,
          issues: ReadonlyArray<StandardSchemaV1.Issue>,
      ) => void | Promise<void>);

type MessageUnion<MsgType extends Record<string, StandardSchemaV1>> = {
    [K in keyof MsgType]: WSMessage<StandardSchemaV1.InferOutput<MsgType[K]>, K & string>;
}[keyof MsgType];

/**
 * 添加带有消息校验的WebSocketServer处理器
 * @param type 包含消息校验的消息类型
 * @param handler WebSocketServer处理器
 * @param onBad 校验失败时的处理方式, 默认为忽略
 */
export function addWssSchemaHandler<
    ResponseType extends WSMessage,
    MsgType extends Record<string, StandardSchemaV1>,
>(
    type: MsgType,
    handler: Omit<WSHandlers<keyof MsgType & string, ResponseType>, 'onMessage'> & {
        onMessage?: (
            connection: WSConnection<ResponseType>,
            message: MessageUnion<MsgType>,
        ) => void | Promise<void>;
    },
    onBad: SchemaOnBad<ResponseType, MsgType> = 'ignore',
): void {
    const onMessageOld = handler.onMessage;

    async function onBadHandler(
        connection: WSConnection<ResponseType>,
        message: WSMessage<unknown, keyof MsgType & string>,
        issues?: ReadonlyArray<StandardSchemaV1.Issue>,
    ): Promise<void> {
        if (onBad === 'disconnect') {
            connection.disconnect();
            return;
        }
        if (onBad === 'ignore') {
            return;
        }
        if (typeof onBad === 'function') {
            await onBad(connection, message, issues ?? []);
            return;
        }
        connection.send({
            type: onBad.sendError,
            data:
                onBad.getData?.(message, issues ?? []) ??
                ({
                    originalType: message.type,
                    issues: issues ?? [],
                } as unknown as ResponseType['data']),
        } as ResponseType);
    }

    async function onMessage(
        connection: WSConnection<ResponseType>,
        message: WSMessage<unknown, string>,
    ): Promise<void> {
        const schema: StandardSchemaV1 | undefined = type[message.type];
        if (!schema) {
            await onBadHandler(connection, message as WSMessage<unknown, keyof MsgType & string>);
            return;
        }
        const result = await schema['~standard'].validate(message.data);
        if (result.issues !== undefined) {
            await onBadHandler(
                connection,
                message as WSMessage<unknown, keyof MsgType & string>,
                result.issues,
            );
            return;
        }
        if (onMessageOld) {
            await onMessageOld(connection, {
                ...message,
                data: result.value,
            } as MessageUnion<MsgType>);
        }
    }

    const wrapperHandler: WSHandlers<keyof MsgType & string, ResponseType> = {
        ...handler,
        onMessage,
    };

    const types = Object.keys(type) as (keyof MsgType & string)[];
    getWebSocketManager().addHandler(types, wrapperHandler);
}

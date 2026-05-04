import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketManager, getWebSocketManagerImpl } from '../src/server/manager';
import { addWssSchemaHandler, type StandardSchemaV1 } from '../src/server/schema';
import type { WSHandlers } from '../src/server/types';
import type { WSMessage } from '../src/common/types';

function createMockSchema<T>(
    validator: (
        data: unknown,
    ) =>
        | { success: true; value: T }
        | { success: false; issues: Array<{ message: string; path?: any[] }> }
        | Promise<
              | { success: true; value: T }
              | { success: false; issues: Array<{ message: string; path?: any[] }> }
          >,
) {
    return {
        '~standard': {
            version: 1,
            vendor: 'mock',
            validate: async (data: unknown) => {
                const maybeResult = validator(data);
                const result = await Promise.resolve(maybeResult);
                if (result.success) {
                    return { value: result.value };
                }
                return { issues: result.issues };
            },
        },
    } as StandardSchemaV1<unknown, T>;
}

function getLastHandler<T extends WSHandlers>(manager: WebSocketManager): T {
    const handlers = (manager as any).handlers as WSHandlers<any>[];
    return handlers[handlers.length - 1] as T;
}

const defaultMetadata = {
    headers: {},
    url: '/ws',
    remoteAddress: '127.0.0.1',
};

describe('addWssSchemaHandler', () => {
    let manager: WebSocketManager;
    let wrapperHandler: WSHandlers | undefined;

    beforeEach(() => {
        manager = getWebSocketManagerImpl();
        manager.clear();
    });

    afterEach(() => {
        if (wrapperHandler) {
            manager.removeHandler(wrapperHandler);
            wrapperHandler = undefined;
        }
    });

    function createConnection() {
        const mockWs = {
            readyState: 1, // OPEN
            send: vi.fn(),
            close: vi.fn(),
        };
        const connection = manager.addConnection(mockWs as any, defaultMetadata);
        return { connection, mockWs };
    }

    it('should call onMessage with parsed data when validation succeeds', async () => {
        const onMessage = vi.fn();
        const schema = createMockSchema<number>((data) => {
            if (typeof data === 'number') {
                return { success: true, value: data * 2 };
            }
            return { success: false, issues: [{ message: 'not a number' }] };
        });

        addWssSchemaHandler<{ type: 'response'; data: { status: string } }, { num: typeof schema }>(
            { num: schema },
            { onMessage },
        );

        wrapperHandler = getLastHandler(manager);

        const { connection } = createConnection();
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'num',
            data: 5,
        } as WSMessage);

        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenCalledWith(
            connection,
            expect.objectContaining({ type: 'num', data: 10 }),
        );
    });

    it('should trigger onBad for unknown message type', async () => {
        const onMessage = vi.fn();
        const onBadFn = vi.fn();
        const schema = createMockSchema<string>((data) => {
            if (typeof data === 'string') {
                return { success: true, value: data };
            }
            return { success: false, issues: [{ message: 'not a string' }] };
        });

        addWssSchemaHandler<{ type: 'response'; data: { status: string } }, { msg: typeof schema }>(
            { msg: schema },
            { onMessage },
            onBadFn,
        );

        wrapperHandler = getLastHandler(manager);

        const { connection } = createConnection();

        // The wrapper handler is registered only for known types, so to test the
        // internal unknown-type path we invoke the wrapper handler directly.
        const handlers = manager.getHandlers('msg')!;
        await handlers[0].onMessage!(connection, {
            type: 'unknown',
            data: 'hello',
        } as WSMessage);

        expect(onMessage).not.toHaveBeenCalled();
        expect(onBadFn).toHaveBeenCalledTimes(1);
        expect(onBadFn).toHaveBeenCalledWith(
            connection,
            expect.objectContaining({ type: 'unknown', data: 'hello' }),
            [],
        );
    });

    it('should silently ignore invalid message when onBad is "ignore" (default)', async () => {
        const onMessage = vi.fn();
        const schema = createMockSchema<number>((data) => {
            if (typeof data === 'number') {
                return { success: true, value: data };
            }
            return { success: false, issues: [{ message: 'not a number' }] };
        });

        addWssSchemaHandler<{ type: 'response'; data: { status: string } }, { num: typeof schema }>(
            { num: schema },
            { onMessage },
            // default onBad = 'ignore'
        );

        wrapperHandler = getLastHandler(manager);

        const { connection, mockWs } = createConnection();
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'num',
            data: 'bad',
        } as WSMessage);

        expect(onMessage).not.toHaveBeenCalled();
        expect(mockWs.close).not.toHaveBeenCalled();
        expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should disconnect connection when onBad is "disconnect"', async () => {
        const onMessage = vi.fn();
        const schema = createMockSchema<number>((data) => {
            if (typeof data === 'number') {
                return { success: true, value: data };
            }
            return { success: false, issues: [{ message: 'not a number' }] };
        });

        addWssSchemaHandler<{ type: 'response'; data: { status: string } }, { num: typeof schema }>(
            { num: schema },
            { onMessage },
            'disconnect',
        );

        wrapperHandler = getLastHandler(manager);

        const { connection, mockWs } = createConnection();
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'num',
            data: 'bad',
        } as WSMessage);

        expect(onMessage).not.toHaveBeenCalled();
        expect(mockWs.close).toHaveBeenCalled();
    });

    it('should call custom function when onBad is a function', async () => {
        const onMessage = vi.fn();
        const onBadFn = vi.fn();
        const schema = createMockSchema<number>((data) => {
            if (typeof data === 'number') {
                return { success: true, value: data };
            }
            return { success: false, issues: [{ message: 'not a number' }] };
        });

        addWssSchemaHandler<{ type: 'response'; data: { status: string } }, { num: typeof schema }>(
            { num: schema },
            { onMessage },
            onBadFn,
        );

        wrapperHandler = getLastHandler(manager);

        const { connection } = createConnection();
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'num',
            data: 'bad',
        } as WSMessage);

        expect(onMessage).not.toHaveBeenCalled();
        expect(onBadFn).toHaveBeenCalledTimes(1);
        expect(onBadFn).toHaveBeenCalledWith(
            connection,
            expect.objectContaining({ type: 'num', data: 'bad' }),
            expect.arrayContaining([expect.objectContaining({ message: 'not a number' })]),
        );
    });

    it('should send error message when onBad is { sendError: string }', async () => {
        const onMessage = vi.fn();
        const schema = createMockSchema<number>((data) => {
            if (typeof data === 'number') {
                return { success: true, value: data };
            }
            return { success: false, issues: [{ message: 'not a number' }] };
        });

        addWssSchemaHandler<
            { type: 'validation_error'; data: { originalType: string; issues: any[] } },
            { num: typeof schema }
        >({ num: schema }, { onMessage }, { sendError: 'validation_error' });

        wrapperHandler = getLastHandler(manager);

        const { connection, mockWs } = createConnection();
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'num',
            data: 'bad',
        } as WSMessage);

        expect(onMessage).not.toHaveBeenCalled();
        expect(mockWs.send).toHaveBeenCalledTimes(1);
        const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
        expect(sent.type).toBe('validation_error');
        expect(sent.data).toEqual({
            originalType: 'num',
            issues: [{ message: 'not a number' }],
        });
    });

    it('should use custom getData when onBad is { sendError, getData }', async () => {
        const onMessage = vi.fn();
        const schema = createMockSchema<number>((data) => {
            if (typeof data === 'number') {
                return { success: true, value: data };
            }
            return { success: false, issues: [{ message: 'not a number' }] };
        });

        const getData = vi.fn((message, issues) => ({
            custom: true,
            msgType: message.type,
            issueCount: issues.length,
        }));

        addWssSchemaHandler<{ type: 'custom_error'; data: any }, { num: typeof schema }>(
            { num: schema },
            { onMessage },
            { sendError: 'custom_error', getData },
        );

        wrapperHandler = getLastHandler(manager);

        const { connection, mockWs } = createConnection();
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'num',
            data: 'bad',
        } as WSMessage);

        expect(onMessage).not.toHaveBeenCalled();
        expect(getData).toHaveBeenCalledTimes(1);
        expect(getData).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'num', data: 'bad' }),
            expect.arrayContaining([expect.objectContaining({ message: 'not a number' })]),
        );
        expect(mockWs.send).toHaveBeenCalledTimes(1);
        const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
        expect(sent.type).toBe('custom_error');
        expect(sent.data).toEqual({ custom: true, msgType: 'num', issueCount: 1 });
    });

    it('should select correct schema for multiple message types', async () => {
        const onMessage = vi.fn();
        const numSchema = createMockSchema<number>((data) => {
            if (typeof data === 'number') {
                return { success: true, value: data };
            }
            return { success: false, issues: [{ message: 'not a number' }] };
        });
        const strSchema = createMockSchema<string>((data) => {
            if (typeof data === 'string') {
                return { success: true, value: data.toUpperCase() };
            }
            return { success: false, issues: [{ message: 'not a string' }] };
        });

        addWssSchemaHandler<
            { type: 'response'; data: { status: string } },
            { num: typeof numSchema; str: typeof strSchema }
        >({ num: numSchema, str: strSchema }, { onMessage });

        wrapperHandler = getLastHandler(manager);

        const { connection } = createConnection();
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'num',
            data: 42,
        } as WSMessage);
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'str',
            data: 'hello',
        } as WSMessage);

        expect(onMessage).toHaveBeenCalledTimes(2);
        expect(onMessage).toHaveBeenNthCalledWith(
            1,
            connection,
            expect.objectContaining({ type: 'num', data: 42 }),
        );
        expect(onMessage).toHaveBeenNthCalledWith(
            2,
            connection,
            expect.objectContaining({ type: 'str', data: 'HELLO' }),
        );
    });

    it('should pass onConnect and onDisconnect through unchanged', async () => {
        const onConnect = vi.fn();
        const onDisconnect = vi.fn();
        const schema = createMockSchema<number>((data) => {
            if (typeof data === 'number') {
                return { success: true, value: data };
            }
            return { success: false, issues: [{ message: 'not a number' }] };
        });

        addWssSchemaHandler<{ type: 'response'; data: { status: string } }, { num: typeof schema }>(
            { num: schema },
            { onConnect, onDisconnect },
        );

        wrapperHandler = getLastHandler(manager);

        const { connection } = createConnection();

        await manager.getMainHandler().onConnect?.(connection);
        expect(onConnect).toHaveBeenCalledTimes(1);
        expect(onConnect).toHaveBeenCalledWith(connection);

        await manager.getMainHandler().onDisconnect?.(connection);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
        expect(onDisconnect).toHaveBeenCalledWith(connection);
    });

    it('should await async validation correctly', async () => {
        const onMessage = vi.fn();
        const schema = createMockSchema<string>((data) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    if (typeof data === 'string') {
                        resolve({ success: true, value: data } as any);
                    } else {
                        resolve({ success: false, issues: [{ message: 'not a string' }] } as any);
                    }
                }, 10);
            }) as any;
        });

        addWssSchemaHandler<{ type: 'response'; data: { status: string } }, { msg: typeof schema }>(
            { msg: schema },
            { onMessage },
        );

        wrapperHandler = getLastHandler(manager);

        const { connection } = createConnection();
        await manager.getMainHandler().onMessage?.(connection, {
            type: 'msg',
            data: 'hello',
        } as WSMessage);

        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onMessage).toHaveBeenCalledWith(
            connection,
            expect.objectContaining({ type: 'msg', data: 'hello' }),
        );
    });
});

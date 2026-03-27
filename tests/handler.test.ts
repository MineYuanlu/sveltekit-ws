import { describe, it, expect, vi } from 'vitest';
import { TYPE_QUERY_HANDLER, TYPE_QUERY_HANDLER_RESPONSE } from '../src/consts';
import { initInternalHandler } from '../src/handler';
import type { WSManager, WSConnection, WSMessage } from '../src/types';

describe('initInternalHandler', () => {
    it('should register handler for TYPE_QUERY_HANDLER', () => {
        const addHandler = vi.fn();
        const mockManager = { addHandler } as unknown as WSManager;

        initInternalHandler(mockManager);

        expect(addHandler).toHaveBeenCalledWith(
            [TYPE_QUERY_HANDLER],
            expect.objectContaining({ onMessage: expect.any(Function) }),
        );
    });

    it('should respond with handler keys on query message', () => {
        const addHandler = vi.fn();
        const mockManager = { addHandler } as unknown as WSManager;

        initInternalHandler(mockManager);

        const handler = addHandler.mock.calls[0][1];
        const handlerKeys = ['type-a', 'type-b'];
        const mockConnection = {
            send: vi.fn(),
            msgHandler: new Map(handlerKeys.map((k) => [k, []])),
        } as unknown as WSConnection;

        handler.onMessage(mockConnection, {
            type: TYPE_QUERY_HANDLER,
            data: null,
        } as WSMessage);

        expect(mockConnection.send).toHaveBeenCalledWith({
            type: TYPE_QUERY_HANDLER_RESPONSE,
            data: handlerKeys,
        });
    });

    it('should not respond to non-query messages', () => {
        const addHandler = vi.fn();
        const mockManager = { addHandler } as unknown as WSManager;

        initInternalHandler(mockManager);

        const handler = addHandler.mock.calls[0][1];
        const mockConnection = {
            send: vi.fn(),
            msgHandler: new Map(),
        } as unknown as WSConnection;

        handler.onMessage(mockConnection, {
            type: 'some-other-type',
            data: null,
        } as WSMessage);

        expect(mockConnection.send).not.toHaveBeenCalled();
    });
});

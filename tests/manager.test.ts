import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketManager } from '../src/server/manager';
import type { WebSocket } from 'ws';
import type { WSConnectionMetadata } from '../src/server/types';

const defaultMetadata: WSConnectionMetadata = {
    headers: {},
    url: '/ws',
    remoteAddress: '127.0.0.1',
};

describe('WebSocketManager', () => {
    let manager: WebSocketManager;
    let mockWs: Partial<WebSocket>;

    beforeEach(() => {
        manager = new WebSocketManager();
        mockWs = {
            readyState: 1, // OPEN
            send: vi.fn(),
            close: vi.fn(),
        };
    });

    afterEach(() => {
        manager.clear();
    });

    it('should add connection', () => {
        const connection = manager.addConnection(mockWs as WebSocket, defaultMetadata);

        expect(connection).toBeDefined();
        expect(connection.id).toBeDefined();
        expect(connection.ws).toBe(mockWs);
        expect(manager.size()).toBe(1);
    });

    it('should get connection by id', () => {
        const connection = manager.addConnection(mockWs as WebSocket, defaultMetadata);
        const retrieved = manager.getConnection(connection.id);

        expect(retrieved).toBe(connection);
    });

    it('should send message to specific connection', () => {
        const connection = manager.addConnection(mockWs as WebSocket, defaultMetadata);
        const message = { type: 'test', data: { value: 'hello' } };

        const result = manager.send(connection.id, message);

        expect(result).toBe(true);
        expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"type":"test"'));
    });

    it('should broadcast to all connections', () => {
        const ws1 = { readyState: 1, send: vi.fn(), close: vi.fn() } as Partial<WebSocket>;
        const ws2 = { readyState: 1, send: vi.fn(), close: vi.fn() } as Partial<WebSocket>;

        manager.addConnection(ws1 as WebSocket, defaultMetadata);
        manager.addConnection(ws2 as WebSocket, defaultMetadata);

        const message = { type: 'broadcast', data: 'hello all' };
        manager.broadcast(message);

        expect(ws1.send).toHaveBeenCalled();
        expect(ws2.send).toHaveBeenCalled();
    });

    it('should broadcast excluding specific connections', () => {
        const ws1 = { readyState: 1, send: vi.fn(), close: vi.fn() } as Partial<WebSocket>;
        const ws2 = { readyState: 1, send: vi.fn(), close: vi.fn() } as Partial<WebSocket>;

        const conn1 = manager.addConnection(ws1 as WebSocket, defaultMetadata);
        manager.addConnection(ws2 as WebSocket, defaultMetadata);

        const message = { type: 'broadcast', data: 'hello' };
        manager.broadcast(message, [conn1.id]);

        expect(ws1.send).not.toHaveBeenCalled();
        expect(ws2.send).toHaveBeenCalled();
    });

    it('should remove connection', () => {
        const connection = manager.addConnection(mockWs as WebSocket, defaultMetadata);

        expect(manager.size()).toBe(1);

        const removed = manager.removeConnection(connection.id);

        expect(removed).toBe(true);
        expect(manager.size()).toBe(0);
    });

    it('should disconnect connection', () => {
        const connection = manager.addConnection(mockWs as WebSocket, defaultMetadata);

        const disconnected = manager.disconnect(connection.id);

        expect(disconnected).toBe(true);
        expect(mockWs.close).toHaveBeenCalled();
        expect(manager.size()).toBe(0);
    });

    it('should clear all connections', () => {
        manager.addConnection(
            { readyState: 1, send: vi.fn(), close: vi.fn() } as Partial<WebSocket> as WebSocket,
            defaultMetadata,
        );
        manager.addConnection(
            { readyState: 1, send: vi.fn(), close: vi.fn() } as Partial<WebSocket> as WebSocket,
            defaultMetadata,
        );
        manager.addConnection(
            { readyState: 1, send: vi.fn(), close: vi.fn() } as Partial<WebSocket> as WebSocket,
            defaultMetadata,
        );

        expect(manager.size()).toBe(3);

        manager.clear();

        expect(manager.size()).toBe(0);
    });

    it('should handle send to non-existent connection', () => {
        const result = manager.send('non-existent-id', {
            type: 'test',
            data: 'hello',
        });

        expect(result).toBe(false);
    });

    it('should handle send to closed connection', () => {
        const closedWs = { readyState: 3, send: vi.fn(), close: vi.fn() } as Partial<WebSocket>;
        const connection = manager.addConnection(closedWs as WebSocket, defaultMetadata);

        const result = manager.send(connection.id, {
            type: 'test',
            data: 'hello',
        });

        expect(result).toBe(false);
    });

    it('should store metadata on connection', () => {
        const metadata: WSConnectionMetadata = {
            headers: { 'x-custom': 'value' },
            url: '/ws',
            remoteAddress: '192.168.1.1',
        };
        const connection = manager.addConnection(mockWs as WebSocket, metadata);

        expect(connection.metadata).toEqual(metadata);
    });

    it('should add and remove handlers', () => {
        const handler = { onMessage: vi.fn() };
        manager.addHandler(['test-type'], handler);

        expect(manager.getHandlers('test-type')).toContain(handler);

        manager.removeHandler(handler);

        expect(manager.getHandlers('test-type')).toBeUndefined();
    });

    it('should return all connections', () => {
        manager.addConnection(mockWs as WebSocket, defaultMetadata);
        const ws2 = { readyState: 1, send: vi.fn(), close: vi.fn() } as Partial<WebSocket>;
        manager.addConnection(ws2 as WebSocket, defaultMetadata);

        const connections = manager.getConnections();
        expect(connections.size).toBe(2);
    });
});

describe('Message Format', () => {
    let manager: WebSocketManager;
    let mockWs: Partial<WebSocket>;

    beforeEach(() => {
        manager = new WebSocketManager();
        mockWs = {
            readyState: 1,
            send: vi.fn(),
            close: vi.fn(),
        };
    });

    it('should include timestamp in sent messages', () => {
        const connection = manager.addConnection(mockWs as WebSocket, defaultMetadata);
        const message = { type: 'test', data: 'hello' };

        manager.send(connection.id, message);

        const sentData = (mockWs.send as any).mock.calls[0][0];
        const parsed = JSON.parse(sentData);

        expect(parsed.timestamp).toBeDefined();
        expect(typeof parsed.timestamp).toBe('number');
    });

    it('should preserve existing timestamp', () => {
        const connection = manager.addConnection(mockWs as WebSocket, defaultMetadata);
        const timestamp = 1234567890;
        const message = { type: 'test', data: 'hello', timestamp };

        manager.send(connection.id, message);

        const sentData = (mockWs.send as any).mock.calls[0][0];
        const parsed = JSON.parse(sentData);

        expect(parsed.timestamp).toBe(timestamp);
    });
});

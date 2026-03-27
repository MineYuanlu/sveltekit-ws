import { describe, it, expect } from 'vitest';
import { isWSMessage } from '../src/core';

describe('isWSMessage', () => {
    it('should return true for valid message', () => {
        expect(isWSMessage({ type: 'test', data: 'hello' })).toBe(true);
    });

    it('should return true for message with timestamp', () => {
        expect(isWSMessage({ type: 'test', data: null, timestamp: 123 })).toBe(true);
    });

    it('should return true for message with any data type', () => {
        expect(isWSMessage({ type: 'test', data: { nested: true } })).toBe(true);
        expect(isWSMessage({ type: 'test', data: [1, 2, 3] })).toBe(true);
        expect(isWSMessage({ type: 'test', data: 42 })).toBe(true);
    });

    it('should return false for null', () => {
        expect(isWSMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        expect(isWSMessage(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
        expect(isWSMessage('string')).toBe(false);
        expect(isWSMessage(42)).toBe(false);
        expect(isWSMessage(true)).toBe(false);
    });

    it('should return false for missing type', () => {
        expect(isWSMessage({ data: 'hello' })).toBe(false);
    });

    it('should return false for non-string type', () => {
        expect(isWSMessage({ type: 123, data: 'hello' })).toBe(false);
        expect(isWSMessage({ type: null, data: 'hello' })).toBe(false);
    });
});

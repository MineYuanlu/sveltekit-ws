import { WSMessage } from './types';

export function isWSMessage(message: unknown): message is WSMessage {
    if (!message || typeof message !== 'object') return false;
    const msg = message as WSMessage;
    if (typeof msg.type !== 'string') return false;
    return true;
}

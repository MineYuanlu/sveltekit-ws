# SvelteKit WebSocket

> This package is a fork of [sveltekit-ws](https://github.com/ketarketir/sveltekit-ws) by [ketarketir](https://github.com/ketarketir), licensed under MIT.

WebSocket integration for SvelteKit without external server - seamlessly works in both development and production.

## Features

- 🚀 **Zero Configuration** - Works out of the box with SvelteKit
- 🔄 **Auto Reconnection** - Built-in reconnection logic with configurable attempts
- 💪 **Type Safe** - Full TypeScript support with proper types
- 🔌 **No External Server** - Integrated directly into Vite dev server and production
- 🎯 **Message-Type Routing** - Multiple handlers triggered by message type
- 💗 **Heartbeat Support** - Automatic ping/pong to keep connections alive
- 🛡️ **Client Verification** - Custom authentication/authorization hooks
- 📦 **Small Bundle** - Minimal dependencies

## Installation

```bash
npm install @yuanlu_yl/sveltekit-ws
# or
pnpm add @yuanlu_yl/sveltekit-ws
```

## Usage

### 1. Vite Plugin (vite.config.ts)

Register the WebSocket transport. No handlers here — just path and options.

```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { viteWebSocketServer } from "@yuanlu_yl/sveltekit-ws/server";

export default defineConfig({
  plugins: [
    // ⚠️ WebSocket plugin MUST be before sveltekit()
    viteWebSocketServer({ path: "/ws" }),
    sveltekit(),
  ],
});
```

### 2. Server Initialization (hooks.server.ts)

Register handlers and initialize the manager in SvelteKit's `init` hook. Each handler declares which message types it handles.

```typescript
import type { ServerInit } from "@sveltejs/kit";
import { getWebSocketManager } from "@yuanlu_yl/sveltekit-ws/server";

export const init: ServerInit = async () => {
  const manager = getWebSocketManager();

  // Register a handler with the message types it handles
  manager.addHandler(["chat/send", "chat/join"], {
    onConnect(connection) {
      manager.send(connection.id, {
        type: "welcome",
        data: { message: "Connected!" },
      });
    },
    onMessage(connection, message) {
      // Only receives messages with type "chat/send" or "chat/join"
      manager.broadcast({ type: "chat", data: message.data }, [connection.id]);
    },
    onDisconnect(connection) {
      console.log("Disconnected:", connection.id);
    },
  });

  manager.init((type, obj, msg, ...args) => {
    if (type === "error") console.error("[WS]", obj, msg, ...args);
    else if (type === "bad_msg") console.warn("[WS]", obj, msg, ...args);
  });
};
```

### 3. Production Setup (server.js)

For production with `@sveltejs/adapter-node`:

```javascript
import { handler } from "./build/handler.js";
import { createServer } from "http";
import { createWebSocketHandler } from "@yuanlu_yl/sveltekit-ws/server";

const server = createServer(handler);

// Setup WebSocket transport (handlers are registered in hooks.server.ts)
createWebSocketHandler(server, { path: "/ws" });

const PORT = process.env.PORT || 3000;
server.listen(PORT);
```

### 4. Client Side

Connect and send messages directly — no channel selection step needed.

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  let ws: WebSocket | null = null;
  let messages: any[] = [];
  let connected = false;

  onMount(() => {
    if (!browser) return;

    ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
      connected = true;
      // Send messages directly — the server routes by message type
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      messages = [...messages, message];
    };

    ws.onclose = () => { connected = false; };
  });

  onDestroy(() => ws?.close());

  function sendMessage(text: string) {
    ws?.send(JSON.stringify({ type: "chat/send", data: { text } }));
  }
</script>
```

## Custom Main Handler

By default, when a WebSocket event fires, the framework iterates all registered handlers in parallel. You can replace this behavior with `setMainHandler` to inject custom logic before handler execution — for example, setting up `AsyncLocalStorage` context:

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { getWebSocketManager, defaultHandler } from "@yuanlu_yl/sveltekit-ws/server";

const als = new AsyncLocalStorage<{ connectionId: string }>();

const manager = getWebSocketManager();
manager.setMainHandler({
  async onConnect(connection) {
    await als.run({ connectionId: connection.id }, () =>
      defaultHandler.onConnect!(connection),
    );
  },
  async onMessage(connection, message) {
    await als.run({ connectionId: connection.id }, () =>
      defaultHandler.onMessage!(connection, message),
    );
  },
  async onDisconnect(connection) {
    await als.run({ connectionId: connection.id }, () =>
      defaultHandler.onDisconnect!(connection),
    );
  },
});

// Reset to default behavior
// manager.resetMainHandler();
```

## Message-Type Routing

Handlers are registered with the message types they handle. When a message arrives, the framework dispatches it to all handlers that registered for that message type. Multiple handlers can process the same message type, and a single handler can handle multiple types.

```typescript
// Register multiple handlers — each declares its message types
manager.addHandler(["chat/send", "chat/join"], chatHandlers);
manager.addHandler(["notification/push"], notificationHandlers);
manager.addHandler(["game/move", "game/join"], gameHandlers);

manager.init(logger);
```

## Connection Management

```typescript
import { getWebSocketManager } from "@yuanlu_yl/sveltekit-ws/server";

const manager = getWebSocketManager();

// Send to specific client
manager.send("connection-id", { type: "private", data: { message: "Only for you" } });

// Broadcast to all
manager.broadcast({ type: "announcement", data: { message: "Hello everyone!" } });

// Broadcast excluding some connections
manager.broadcast({ type: "message", data: "Hello!" }, ["id-1", "id-2"]);

// Get all connections
const connections = manager.getConnections();

// Disconnect a client
manager.disconnect("connection-id");

// Remove a handler
manager.removeHandler(chatHandlers);

// Get connection count
const count = manager.size();
```

## Configuration Options

```typescript
interface WSServerOptions {
  path?: string;              // Default: '/ws'
  maxPayload?: number;        // Default: 1MB
  heartbeat?: boolean;        // Default: true
  heartbeatInterval?: number; // Default: 30000ms
  verifyClient?: (info: { origin: string; secure: boolean; req: any }) => boolean | Promise<boolean>;
}
```

## Custom Client Verification

```typescript
viteWebSocketServer({
  path: "/ws",
  verifyClient: async ({ origin, secure, req }) => {
    const token = req.headers["authorization"];
    if (!token) return false;
    try {
      return !!(await verifyToken(token));
    } catch {
      return false;
    }
  },
});
```

## Message Types

Common types are available from the root export:

```typescript
import { WSMessage, isWSMessage } from "@yuanlu_yl/sveltekit-ws";
```

Server types are available from the server export:

```typescript
import type { WSConnection, WSManager, WSHandlers, defaultHandler } from "@yuanlu_yl/sveltekit-ws/server";
```

```typescript
interface WSMessage<Data = any, Type extends string = string> {
  type: Type;
  data: Data;
  timestamp?: number;
}

interface WSConnection<ResponseType extends WSMessage = WSMessage> {
  ws: WebSocket;
  id: string;
  readonly metadata: WSConnectionMetadata;
  readonly locals: Partial<WSConnectionLocals>;
  readonly handlers: ReadonlyArray<WSHandlers>;
  readonly msgHandler: ReadonlyMap<string, WSHandlers[]>;
}
```

## Examples

Check the `/examples` directory for a complete chat application.

## Deployment

### Vercel / Cloudflare / Netlify

WebSocket is not supported in serverless platforms. Use `adapter-node` with a VPS or dedicated server.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "server.js"]
```

### Nginx Configuration

```nginx
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Troubleshooting

### WebSocket not connecting in production

1. Ensure `createWebSocketHandler` is called before `server.listen()`
2. Expose the correct port
3. Allow WebSocket connections through the firewall
4. Configure reverse proxy (nginx) to support WebSocket upgrade

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © 2024

## Credits

Inspired by [ubermanu/sveltekit-websocket](https://github.com/ubermanu/sveltekit-websocket)

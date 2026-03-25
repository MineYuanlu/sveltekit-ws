# Quick Start Guide

A quick guide to integrating WebSocket into your SvelteKit project.

## 1. Install

```bash
npm install @yuanlu_yl/sveltekit-ws ws
```

## 2. Setup Development (vite.config.ts)

```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { viteWebSocketServer } from "@yuanlu_yl/sveltekit-ws/server";

export default defineConfig({
  plugins: [
    // ⚠️ Must be before sveltekit()
    viteWebSocketServer({ path: "/ws" }),
    sveltekit(),
  ],
});
```

## 3. Register Handlers (hooks.server.ts)

```typescript
import type { ServerInit } from "@sveltejs/kit";
import { channelHandler, getWebSocketManager } from "@yuanlu_yl/sveltekit-ws/server";

export const init: ServerInit = async () => {
  const manager = getWebSocketManager();

  manager.addHandler("chat", {
    onMessage(connection, message) {
      console.log("Got message:", message);
    },
  });

  manager.init(channelHandler, (type, obj, msg, ...args) => {
    if (type === "error") console.error("[WS]", obj, msg, ...args);
    else if (type === "bad_msg") console.warn("[WS]", obj, msg, ...args);
  });
};
```

## 4. Client Side (Svelte Component)

The client must first send a `channel` message to select a handler.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let ws: WebSocket;
  let messages = [];

  onMount(() => {
    if (!browser) return;

    ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
      // Select the "chat" channel handler
      ws.send(JSON.stringify({ type: "channel", data: "chat" }));
    };

    ws.onmessage = (event) => {
      messages = [...messages, JSON.parse(event.data)];
    };
  });

  function send() {
    ws.send(JSON.stringify({ type: 'chat', data: { text: 'Hello!' } }));
  }
</script>

<button on:click={send}>Send</button>

{#each messages as msg}
  <div>{JSON.stringify(msg)}</div>
{/each}
```

## 5. Broadcast to All Clients

```typescript
import { getWebSocketManager } from "@yuanlu_yl/sveltekit-ws/server";

const manager = getWebSocketManager();
manager.broadcast({
  type: "notification",
  data: { message: "Hello everyone!" },
});
```

## 6. Send to Specific Client

```typescript
manager.send("connection-id", {
  type: "private",
  data: { message: "Just for you" },
});
```

## Production Setup

For production with `@sveltejs/adapter-node`, create `server.js`:

```javascript
import { handler } from "./build/handler.js";
import { createServer } from "http";
import { createWebSocketHandler } from "@yuanlu_yl/sveltekit-ws/server";

const server = createServer(handler);

// Transport only — handlers are registered in hooks.server.ts
createWebSocketHandler(server, { path: "/ws" });

server.listen(3000);
```

Update `package.json`:

```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

That's it! 🎉

For more details, check the [README](README.md) or the `/examples` folder.

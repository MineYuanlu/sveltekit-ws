# SvelteKit WebSocket

> 本包 fork 自 [ketarketir](https://github.com/ketarketir) 的 [sveltekit-ws](https://github.com/ketarketir/sveltekit-ws)，基于 MIT 协议。

无需外部服务器的 SvelteKit WebSocket 集成方案，在开发和生产环境中均可无缝运行。

## 特性

- 🚀 **零配置** - 开箱即用，与 SvelteKit 完美集成
- 🔄 **自动重连** - 内置重连逻辑，可配置重试次数
- 💪 **类型安全** - 完整的 TypeScript 支持
- 🔌 **无需外部服务器** - 直接集成到 Vite 开发服务器和生产环境
- 🎯 **消息类型路由** - 多处理器按消息类型并行触发
- 💗 **心跳支持** - 自动 ping/pong 保持连接活跃
- 🛡️ **客户端验证** - 自定义认证/鉴权钩子
- 📦 **体积小巧** - 极少的外部依赖

## 安装

```bash
npm install @yuanlu_yl/sveltekit-ws
# 或
pnpm add @yuanlu_yl/sveltekit-ws
```

## 使用方法

### 1. Vite 插件（vite.config.ts）

注册 WebSocket 传输层，此处只配置路径和选项，不注册处理器。

```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { viteWebSocketServer } from "@yuanlu_yl/sveltekit-ws/server";

export default defineConfig({
  plugins: [
    // ⚠️ WebSocket 插件必须在 sveltekit() 之前
    viteWebSocketServer({ path: "/ws" }),
    sveltekit(),
  ],
});
```

### 2. 服务端初始化（hooks.server.ts）

在 SvelteKit 的 `init` 钩子中注册处理器并初始化管理器。每个处理器声明自己处理的消息类型。

```typescript
import type { ServerInit } from "@sveltejs/kit";
import { getWebSocketManager } from "@yuanlu_yl/sveltekit-ws/server";

export const init: ServerInit = async () => {
  const manager = getWebSocketManager();

  // 注册处理器，声明它处理的消息类型
  manager.addHandler(["chat/send", "chat/join"], {
    onConnect(connection) {
      manager.send(connection.id, {
        type: "welcome",
        data: { message: "已连接！" },
      });
    },
    onMessage(connection, message) {
      // 只会收到 type 为 "chat/send" 或 "chat/join" 的消息
      manager.broadcast({ type: "chat", data: message.data }, [connection.id]);
    },
    onDisconnect(connection) {
      console.log("已断开:", connection.id);
    },
  });

  manager.init((type, obj, msg, ...args) => {
    if (type === "error") console.error("[WS]", obj, msg, ...args);
    else if (type === "bad_msg") console.warn("[WS]", obj, msg, ...args);
  });
};
```

### 3. 生产环境配置（server.js）

使用 `@sveltejs/adapter-node` 的生产环境配置：

```javascript
import { handler } from "./build/handler.js";
import { createServer } from "http";
import { createWebSocketHandler } from "@yuanlu_yl/sveltekit-ws/server";

const server = createServer(handler);

// 配置 WebSocket 传输层（处理器已在 hooks.server.ts 中注册）
createWebSocketHandler(server, { path: "/ws" });

const PORT = process.env.PORT || 3000;
server.listen(PORT);
```

### 4. 客户端

连接后直接发送消息即可，无需频道选择步骤。

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
      // 直接发送业务消息，服务端按消息类型自动路由
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

## 消息类型路由

处理器在注册时声明自己处理的消息类型。当消息到达时，框架将其分发给所有注册了该消息类型的处理器。多个处理器可以处理同一消息类型，单个处理器也可以处理多种类型。

```typescript
// 注册多个处理器，各自声明处理的消息类型
manager.addHandler(["chat/send", "chat/join"], chatHandlers);
manager.addHandler(["notification/push"], notificationHandlers);
manager.addHandler(["game/move", "game/join"], gameHandlers);

manager.init(logger);
```

## 连接管理

```typescript
import { getWebSocketManager } from "@yuanlu_yl/sveltekit-ws/server";

const manager = getWebSocketManager();

// 发送给指定客户端
manager.send("connection-id", { type: "private", data: { message: "仅对你可见" } });

// 广播给所有人
manager.broadcast({ type: "announcement", data: { message: "大家好！" } });

// 广播时排除部分连接
manager.broadcast({ type: "message", data: "Hello!" }, ["id-1", "id-2"]);

// 获取所有连接
const connections = manager.getConnections();

// 断开某个客户端
manager.disconnect("connection-id");

// 移除处理器
manager.removeHandler(chatHandlers);

// 获取连接数
const count = manager.size();
```

## 配置项

```typescript
interface WSServerOptions {
  path?: string;              // 默认: '/ws'
  maxPayload?: number;        // 默认: 1MB
  heartbeat?: boolean;        // 默认: true
  heartbeatInterval?: number; // 默认: 30000ms
  verifyClient?: (info: { origin: string; secure: boolean; req: any }) => boolean | Promise<boolean>;
}
```

## 自定义客户端验证

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

## 消息类型

公共类型可从根导出引入：

```typescript
import { WSMessage, isWSMessage } from "@yuanlu_yl/sveltekit-ws";
```

服务端类型从 server 导出引入：

```typescript
import type { WSConnection, WSManager, WSHandlers } from "@yuanlu_yl/sveltekit-ws/server";
```

```typescript
interface WSMessage<Data = any, Type extends string = string> {
  type: Type;
  data: Data;
  timestamp?: number;
}

interface WSConnection {
  ws: WebSocket;
  id: string;
  readonly metadata: WSConnectionMetadata;
  readonly locals: Partial<WSConnectionLocals>;
  readonly handlers: ReadonlyArray<WSHandlers>;
  readonly msgHandler: ReadonlyMap<string, WSHandlers[]>;
}
```

## 示例

查看 `/examples` 目录，其中包含一个完整的聊天应用示例。

## 部署

### Vercel / Cloudflare / Netlify

Serverless 平台不支持 WebSocket，请使用 `adapter-node` 配合 VPS 或独立服务器部署。

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

### Nginx 配置

```nginx
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## 常见问题

### 生产环境 WebSocket 无法连接

1. 确保 `createWebSocketHandler` 在 `server.listen()` 之前调用
2. 确认端口已正确暴露
3. 防火墙允许 WebSocket 连接
4. 反向代理（nginx）已配置 WebSocket upgrade 支持

## 贡献

欢迎贡献代码！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT © 2024

## 致谢

灵感来源于 [ubermanu/sveltekit-websocket](https://github.com/ubermanu/sveltekit-websocket)

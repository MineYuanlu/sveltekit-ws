# Changelog

本项目 fork 自 [ketarketir/sveltekit-ws](https://github.com/ketarketir/sveltekit-ws)，基于 MIT 协议。

## [1.5.1] - 2026-03-27

### 新特性

- **主处理器（Main Handler）**：新增 `manager.setMainHandler(handler)` 和 `manager.resetMainHandler()` 方法，允许自定义事件处理的入口逻辑。默认主处理器 `defaultHandler` 保持原有行为（遍历所有注册处理器并行调用），用户可替换为自定义实现，例如在调用处理器前注入 `AsyncLocalStorage` 上下文
- **`defaultHandler` 导出**：从 `@yuanlu_yl/sveltekit-ws/server` 导出内置默认主处理器，方便自定义主处理器时复用

### 类型改进

- **`WSHandlers` 新增 `ResponseType` 泛型**：`WSHandlers<MessageTypes, ResponseType>` 支持约束 `connection.send()` 的消息类型
- **`WSConnection` 新增 `ResponseType` 泛型**：`WSConnection<ResponseType>` 约束 `send` 方法只接受指定类型的消息
- **客户端 `WSHandlers` 泛型优化**：泛型参数从 `MessageTypes extends string` 改为 `Messages extends WSMessage`，直接约束 `onMessage` 的消息类型
- **`addHandler` 类型增强**：`types` 参数改为 `readonly` 数组，支持 `as const` 断言

## [1.5.0] - 2026-03-27

### 重构

- **模块结构分离**：将代码重构为 `common/`、`client/`、`server/` 三个独立模块目录：
  - `common/` — 公共类型（`WSMessage`）、工具函数（`isWSMessage`）和常量，通过根导出 `@yuanlu_yl/sveltekit-ws` 引入
  - `client/` — 客户端专用类型（`WSHandlers`），通过 `@yuanlu_yl/sveltekit-ws/client` 引入
  - `server/` — 服务端核心逻辑，通过 `@yuanlu_yl/sveltekit-ws/server` 引入

### 新特性

- **根导出入口**：新增 `"."` 导出，可直接通过 `import { WSMessage, isWSMessage } from '@yuanlu_yl/sveltekit-ws'` 引入公共模块
- **客户端 `WSHandlers` 类型**：新增客户端专用的 `WSHandlers` 接口，包含 `onConnect`、`onDisconnect`、`onMessage` 回调

### 修复

- **URL 解析优化**：WebSocket 升级请求的 URL 解析不再依赖 `request.headers.host`，避免在某些代理环境下解析失败
- **`removeHandler` 类型修正**：参数类型从 `WSHandlers` 改为 `WSHandlers<any>`，修复泛型不兼容问题

## [1.4.1] - 2026-03-27

### 新特性

- **移除处理器**：新增 `manager.removeHandler(handler)` 方法，支持动态移除已注册的事件处理器，同时清理其关联的消息类型映射。

### 改进

- **`sendRaw` 类型放宽**：`WSConnection.sendRaw` 参数类型从 `string` 放宽为 `Parameters<WebSocket['send']>[0]`，支持发送 `Buffer`、`ArrayBuffer` 等二进制数据。

## [1.4.0] - 2026-03-26

### 核心变更：多处理器并行架构

**原版本**：采用单一主处理器 (`mainHandler`) + 频道路由 (`channelHandler`) 模式，连接先经过主处理器，再通过 channel 消息分发到子处理器，每个连接同一时间只能绑定一个处理器。

**新版本**：移除主处理器和频道路由概念，改为多处理器按消息类型并行触发。通过 `addHandler(types, handler)` 注册处理器时声明关心的消息类型，框架自动将消息分发给所有匹配的处理器。同一连接可同时被多个处理器服务。

```typescript
// Before — 频道路由模式
manager.init(channelHandler, logger);
manager.addHandler('chat', chatHandler);
// 客户端需先发 { type: 'channel', data: 'chat' } 绑定处理器

// After — 按消息类型并行触发
manager.init(logger);
manager.addHandler(['chat/send', 'chat/join'], chatHandler);
manager.addHandler(['presence/update'], presenceHandler);
// 消息直接按 type 分发，无需绑定步骤
```

### Breaking Changes

- `init()` 移除 `handler` 参数，签名变为 `init(logger)`
- `addHandler()` 签名从 `addHandler(id, handler)` 改为 `addHandler(types[], handler)`
- `getHandler(id)` 改为 `getHandlers(type)`，返回处理器数组
- 移除 `channelHandler` 导出（`server.ts` 不再导出）
- 移除 `WSHandlers.onError` 回调，错误由框架统一记录
- 移除 `WSConnection.handler` 属性，替换为 `handlers`（处理器列表）和 `msgHandler`（消息类型映射）
- 移除 `WSConnection` / `WSHandlers` 的 `Locals` 泛型参数，改用 `WSConnectionLocals` 接口（支持 declaration merging）
- `WSHandlers` 泛型参数改为 `MessageTypes extends string`，约束 `onMessage` 的消息类型
- 连接建立时不再因缺少主处理器而销毁 socket

### 新特性

- **内部查询处理器**：新增 `TYPE_QUERY_HANDLER` 常量，客户端可查询当前连接加载的处理器支持哪些消息类型
- **`WSMessage` 泛型增强**：支持 `WSMessage<Data, Type>` 形式，`Type` 参数约束消息类型字段
- **`WSConnectionLocals` 接口**：通过 declaration merging 扩展连接本地数据类型，替代原有泛型方案
- 客户端入口 (`client.ts`) 现导出所有常量，包括内部消息类型

## [1.3.4] - 2026-03-26

### 新特性

- **连接元数据增强**：新增 `WSConnectionMetadata` 类型，提供更规范的连接信息，包含请求 URL (`url`)、请求头 (`headers`) 和客户端地址 (`remoteAddress`)。`WSConnection` 的 `metadata` 属性现改为只读，确保元数据在连接生命周期内不可变。
- **连接本地数据支持**：`WSConnection` 新增 `locals` 属性，允许在连接实例上存储请求作用域内的自定义数据，便于在处理链路中传递上下文信息。

### 类型系统完善

- **泛型支持**：`WSConnection` 和 `WSHandlers` 接口增加泛型参数 `Locals`，支持类型安全的连接本地数据定义。
- **类型约束优化**：`WebSocketManager` 的 `addHandler` 和 `init` 方法支持泛型参数，使处理器与对应连接类型的 `locals` 能够正确关联。


## [1.3.3] - 2026-03-25

### 改进

- **增强心跳机制**：WebSocket 服务端现在会记录连接的最后活跃时间，若在心跳间隔的 1.5 倍时间内未收到 `pong` 响应，则主动终止连接，避免僵死连接残留。
- 启用 WebSocket 服务器的 `autoPong` 选项，确保自动响应 `ping` 帧。

## [1.3.2] - 2026-03-25

### 重构

- **连接对象封装**：将 `WSConnection` 从普通对象改为 `WebSocketConnection` 类，将 `send`、`sendRaw`、`disconnect` 等方法封装到连接实例中，提升了代码内聚性和可维护性。
- **发送逻辑简化**：`WSManager` 的 `send` 和 `broadcast` 方法现在直接调用连接对象的方法，减少重复代码和直接操作底层 WebSocket 状态检查。

## [1.3.1] - 2026-03-25

### 修复

- **开发环境 HMR 冲突**：修复 Vite dev 模式下误拦截 Vite HMR WebSocket 连接的问题。原先 `upgrade` 事件处理逻辑在路径不匹配时未正确退出，导致 Vite 自身的 WebSocket 连接被错误销毁；现在仅对匹配 `path` 的请求进行处理，其余请求放行。

## [1.3.0] - 2026-03-25

本版本为 fork 后的首个独立发布版本（包名 `@yuanlu_yl/sveltekit-ws`），包含架构重构、新特性及文档完善。

### 核心变更：处理器注册模式

**原版本的问题**：业务逻辑必须在 `vite.config.ts`（开发环境）和生产服务器入口（生产环境）中各定义一次，既不合理，也造成代码重复。

**新版本**：将传输层与业务逻辑彻底分离。`vite.config.ts` 只负责注册 WebSocket 路径和传输配置，业务处理器通过 `manager.addHandler()` 注册，可在 `src/` 目录下任意位置定义，随 SvelteKit/Vite 构建流程正确打包，开发和生产环境共用同一套代码。

```typescript
// vite.config.ts —— 只配置传输层，不写业务逻辑
viteWebSocketServer({ path: "/ws" })

// src/lib/ws/chat.ts —— 业务逻辑可放在 src 任意位置
manager.addHandler("chat", { onMessage(...) { ... } })
```

### 新特性

- **处理器注册 API**：`manager.addHandler(name, handler)` 支持在 `src/` 内任意模块注册命名处理器，无需集中配置
- **频道路由（Channel Handler）**：新增内置 `channelHandler`，客户端发送 `{ type: "channel", data: "<name>" }` 即可路由到对应处理器
- **反射式消息分发**：连接绑定处理器后，后续消息自动转发，无需手动路由
- **日志回调**：`manager.init()` 支持传入日志回调，可自定义 `error`、`warn`、`bad_msg` 等事件的处理方式

### 重构

- **模块结构重构**：将核心逻辑从 `server.ts` / `vite.ts` 拆分为独立的 `core.ts`，职责更清晰
- **类型系统完善**：扩展 `WSConnection`、`WSHandlers`、`WSMessage` 等核心类型，增加连接级别的处理器绑定支持
- **构建配置优化**：调整 `tsup.config.ts`，精简输出产物
- **代码风格统一**：新增 `.prettierrc` 配置，统一格式化规范

### 改进

- 升级 Vite 依赖版本，兼容最新 SvelteKit 构建环境
- 修正 `hooks.server.ts` 示例，使用 SvelteKit `init` 钩子进行初始化

### 文档

- 新增 `README.zh.md` 中文文档，包含完整的安装、配置、API 说明及使用示例
- 重写 `README.md`，精简英文文档结构
- 更新 `QUICKSTART.md` 快速上手指南
- 更新 `examples/` 示例代码，展示 `channelHandler` 的完整用法

---

## [1.0.2] 及之前

上游版本，详见 [ketarketir/sveltekit-ws releases](https://github.com/ketarketir/sveltekit-ws)。

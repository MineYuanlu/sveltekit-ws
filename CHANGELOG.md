# Changelog

本项目 fork 自 [ketarketir/sveltekit-ws](https://github.com/ketarketir/sveltekit-ws)，基于 MIT 协议。

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

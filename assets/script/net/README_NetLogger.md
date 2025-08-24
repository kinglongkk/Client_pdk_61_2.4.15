# 网络日志功能说明

## 概述

在 `pdk_NetManager.js` 中添加了简单的网络通信日志功能，用于记录客户端与服务器之间的数据交互。

## 功能特性

- **发送数据日志**: 记录客户端向服务器发送的所有数据
- **接收数据日志**: 记录客户端从服务器接收的所有数据  
- **HTTP通信日志**: 记录HTTP请求和响应的详细信息
- **可配置开关**: 可以开启/关闭日志功能

## 使用方法

### 开启/关闭日志

```javascript
// 在 pdk_NetManager 中
this.enableNetLog = true;        // 总开关
this.enableDetailedLog = true;   // 详细日志开关
```

### 日志输出示例

```
[2024-01-15T10:30:45.123Z] [SEND] 发送到GameServer - 事件: game.joinRoom
├─ 数据内容: {roomId: 12345, playerId: 67890}
├─ 数据类型: object
├─ 数据大小: 35 字符
└─ 封包头: 0x1001

[2024-01-15T10:30:45.456Z] [RECV] 从GameServer接收 - 路由: room.info
├─ 数据内容: {roomId: 12345, players: [...], status: "waiting"}
├─ 数据类型: object
├─ 数据大小: 128 字符
└─ 路由名称: room.info
```

## 日志类型

- **SEND**: 发送到服务器的数据
- **RECV**: 从服务器接收的数据
- **HTTP_SEND**: HTTP发送的数据
- **HTTP_RECV**: HTTP接收的数据

## 注意事项

1. 日志仅输出到浏览器控制台
2. 建议在开发环境使用，生产环境可以关闭
3. 详细日志会增加控制台输出量
4. 支持所有现代浏览器 
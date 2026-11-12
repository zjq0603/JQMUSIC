# JQ Music

无广告私人音乐播放器。Navidrome 扫描和提供本地音乐，Node 服务通过 Subsonic API 获取曲库并代理音频流；MySQL 保存收藏、歌单和播放历史。在线音乐首期接入 Jamendo 官方 API，使用它提供的试听地址和授权信息。

## 本机开发

需要 Node.js 20+、npm、小皮面板 MySQL，以及本机 Navidrome。

1. 将自己拥有或获准使用的音乐放进项目根目录的 `music/` 文件夹。
2. 在本机启动 Navidrome，并把音乐目录设为项目的 `music/` 文件夹，默认监听 `http://127.0.0.1:4533`。首次打开 Navidrome 创建管理员后，将用户名和密码填入被忽略的本地 `config.json`。
3. 在 Navidrome 中触发音乐库扫描，或等待它自动扫描。
4. 安装依赖并启动开发服务：`npm install`，然后 `npm run dev`。
5. 打开 `http://localhost:8080`。Node API 位于 `http://127.0.0.1:3000`。

本机 MySQL 默认连接 `127.0.0.1:3306`，数据库 `jqmusic` 和所需表会由 Node 服务在首次启动时创建。把小皮面板 MySQL 账号填入本地 `config.json`。Redis 暂未启用：当前阶段的收藏、歌单和播放记录由 MySQL 保存。

`config.example.json` 是不含个人凭据的模板；服务优先读取被 Git 忽略的本地 `config.json`，未创建时使用模板默认值。

## Jamendo 在线音乐

1. 在 Jamendo 开发者平台注册应用并取得 `client_id`。
2. 将 ID 填入本机 `config.json` 的 `jamendo.clientId`（不要提交此文件），然后重启服务。
3. 在“在线音乐”页搜索曲目，或粘贴 Jamendo 官方公开歌单链接/编号。可以试听、收藏，并把曲目导入本地歌单。

播放器只使用 Jamendo 官方 API 返回的曲目和音频地址，并保留歌曲来源、平台 ID、授权类型及许可链接。不同曲目适用的 Creative Commons 条款可能不同，使用、分享或再发布前请打开许可链接核对条款；本项目不提供音频下载，也不绕过登录、付费或 DRM。尚未配置 ID、API 暂不可用或歌单不可访问时，页面会显示服务端错误信息。

Navidrome 负责读取音乐标签、封面、搜索和音频流；本项目不会复制、上传或转换音乐文件。进度拖动通过 HTTP Range 转发。Navidrome 认证令牌留在 Node 服务端。

## 验证

- `npm test`：运行服务端单元测试。
- `npm run build`：构建 Vue 2 前端。
- `npm run dev`：同时启动前端和 Node API。

手机远程访问和生产部署不在当前本地阶段范围内。其他在线资源只会通过官方 API 和明确授权地址接入。

## 目录

```text
database/schema.sql    MySQL 数据库表
server/index.js        Node API 和业务数据访问
server/navidrome.js    Subsonic API 适配与 Range 音频代理
src/App.vue            Vue 2 播放器界面
src/style.css          响应式播放器样式
config.json            本机服务配置
docker-compose.yml     可选的容器化依赖（本机小皮面板模式无需启动）
```

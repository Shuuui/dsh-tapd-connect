# 在另一台电脑上安装 dsh-tapd-connect

本插件是**自包含**的：运行时只用到 `node:crypto` 一个 Node 内置模块，没有第三方依赖，
不需要联网装包。整包不到 50 KB，解压即可用。

## 一、把文件带过去

把 `dsh-tapd-connect-0.1.0.zip` 拷到新电脑，解压到**任意固定位置**，例如：

```
D:\dsh-plugins\dsh-tapd\
```

> 这个目录之后不要随便删/挪——插件是链接安装的，路径变了要重新安装。

解压后的目录里应当直接看到：

```
package.json
index.js
client.js
cordis.patch.yml
icon.svg
locale\zh.json
locale\en.json
README.md
```

## 二、安装

在新电脑上打开 DeepSeek Harness，在会话里让助手安装，说清楚路径即可：

> 用 plugin_manager 的 install_bundle，target 是 `D:\dsh-plugins\dsh-tapd`

它会做三件事：把包加入 profile 依赖（`link:` 链接到该目录）、加入 `bundles` 列表、
触发生效。安装结果里 `application: applied` 才算真正生效。

装完后侧边栏会出现 **TAPD** 图标。

> 也可以手动执行 `dsh plugin add <目录>`（若你的 dsh 版本提供该命令）。

## 三、首次使用：填令牌

插件不携带任何凭据，**不会**把旧电脑的令牌带过来。新电脑上需要重新填一次：

1. 打开侧边栏 TAPD 面板
2. 在「连接 TAPD」里粘贴**个人访问令牌**
   （获取位置：TAPD 网页 → 个人设置 → 个人访问令牌）
3. 点「保存并验证」

保存成功后显示「已连接：你的昵称」。

令牌存在本机凭据库（记录键 `dsh-tapd/pat`），**不写进配置文件**，也不回显。

## 四、首次使用：配置（可选）

配置文件在 `~/.dsh/profiles/<profile>/cordis.patch.yml` 的 `tapd-connect` 行，
但大部分项可以在**面板里直接改**，不必手写 YAML：

| 面板位置 | 作用 |
|---|---|
| 「项目范围」 | 只显示勾选的项目；不勾=全部 |
| 「工作区映射」 | 每个 TAPD 项目 → 工作区目录；以及默认目录 |

新电脑上原来的项目范围和映射不会自动带过来，按需重配一次即可。

## 五、迁移旧电脑的设置（可选）

如果不想重配，可以把旧电脑的这两段配置抄过来：

- `cordis.patch.yml` 里 `tapd-connect` 行的 `visibleProjects`、`mappings`、`defaultPath`、
  `defaultKind`
- 令牌：旧机器的 `~/.dsh/.credentials.yaml` 里 `dsh-tapd/pat` 那条记录
  （含明文 token，**不建议**通过聊天工具传递；重新生成令牌更安全）

## 六、常见问题

**装完侧边栏没图标**
先刷新页面（Ctrl+R）。仍未出现就看安装结果里有没有 `restart-required`——
这种情况需要重启 Harness。

**点「保存并验证」报 401**
多半是令牌复制不全或已失效，去 TAPD 重新生成一个。面板里的「诊断」按钮会列出
三种传法各自的结果，便于区分是令牌问题还是权限问题。

**点「开始处理」报 `throwIfAborted`**
这是旧版本的 bug（`sessionController.prompt` 少传 AbortSignal），0.1.0 已修复。
确认装的是本包，并重启 Harness。

**链接报错跳到项目首页**
旧版本用过废弃的 `/bug/bug_detail/` 路由，本版已改为 `/tapd_fe/<项目>/bug/detail/`。

## 七、卸载

```js
plugin_manager: { action: "remove_bundle", target: "dsh-tapd-connect" }
```

然后手删解压出来的目录即可。

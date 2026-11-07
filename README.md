# dsh-tapd-connect

把 TAPD 需求接进 DeepSeek Harness：在侧边栏打开「TAPD 需求」面板，选择项目、按条件筛选需求，
一键在当前工作区生成分析清单；审核通过后，再下发处理或批量流转状态。

## 使用

1. 侧边栏点 TAPD 图标打开面板。
2. 首次使用填 TAPD 账号昵称 + 个人访问令牌（TAPD「个人设置 → 开放平台」生成）。
   令牌写入本机凭据库记录 `dsh-tapd/pat`，不进配置、不回显。
3. 选择项目（远端清单拉不到时可直接输入项目 ID），设置状态 / 处理人 / 标题关键词后查询。
4. 勾选需求后：
   - **生成分析清单**：新建会话，让 agent 先只做分析、不改代码、不改 TAPD；
   - **开始处理**：审核通过后，在同样范围下发实现任务；
   - **流转状态**：批量改状态 / 处理人，可附一条评论。

## 配置

`cordis.patch.yml` 中的 `tapd-connect` 行：

| 字段 | 说明 |
|---|---|
| `apiBase` | TAPD Open API 根地址，默认 `https://api.tapd.cn` |
| `webBase` | 网页端根地址，默认 `https://www.tapd.cn`；面板里条目与「打开项目」的链接用它拼接 |
| `username` | 调用 Open API 的账号昵称（也可在面板里保存） |
| `companyId` | 企业 ID；填了才会从 TAPD 自动拉「我参与的项目」 |
| `projects` | 手动维护的项目清单 `[{ id, name }]`，也是远端失败时的兜底 |
| `mappings` | TAPD 项目 → DSH 工作区目录 `[{ workspaceId, path }]`；**面板里可直接编辑** |
| `defaultPath` | 未命中映射时的固定目录；面板里同样可编辑 |

工作目录解析顺序：面板/工具显式指定 → `mappings` → `defaultPath` →
最近活动会话的目录 → Harness 默认工作区。面板顶部会显示本次会话会落在哪个目录。

### 在面板里配置映射

点工具栏的「工作区映射」，每个项目一行：

- 点「选择…」调 Harness 原生目录选择器，也可以直接粘贴绝对路径
- 留空表示该项目不单独映射
- 底部「默认目录」是未映射项目的兜底；同样留空则落到当前工作区

保存走 `configEditor`，只改本行配置，不动 profile 文件里其他行与注释。路径必须是
绝对路径（Windows 盘符/UNC 与 POSIX 都接受），相对路径会被拒绝并说明原因。

### 开始处理前确认工作区

点「生成分析清单」或「开始处理」时会先弹出一个确认框，目录按
**项目映射 → 默认目录 → 当前工作区** 的顺序自动填好，也可以当场改或调选择器；
文案会说明这个值是哪儿来的。清空目录 = 交给 Host 自己解析。取消则什么都不发。

## 模型工具

注册了 `tapd` 工具，与面板共用同一套 Host 逻辑：

- `action=projects` / `stories`：读项目与需求；
- `action=analyze` / `implement`：把需求交给工作区会话（与面板按钮等价）；
- `action=transition`：批量改状态 / 处理人，可带评论；
- `action=comment`：只追加评论。

## 安全边界

- 所有 `/plugins/dsh-tapd/*` 路由只服务 loopback Host；
- 写操作额外要求同源 `Origin`，跨站页面拿不到令牌也改不了数据；
- 令牌只从凭据库或 `TAPD_API_USER` / `TAPD_API_TOKEN` 环境变量读取；
- 「分析」阶段的提示词明确要求只分析、不改代码、不改 TAPD。

## 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/plugins/dsh-tapd/status` | 连接状态、项目清单、目标目录 |
| GET | `/plugins/dsh-tapd/diagnostics` | 依赖服务与目录自检 |
| POST | `/plugins/dsh-tapd/credential` | 保存 / 验证 / 清除令牌 |
| POST | `/plugins/dsh-tapd/projects` | 刷新项目与状态字典 |
| POST | `/plugins/dsh-tapd/stories` | 按条件查询需求 |
| POST | `/plugins/dsh-tapd/analyze` | 新建分析会话 |
| POST | `/plugins/dsh-tapd/implement` | 新建处理会话 |
| POST | `/plugins/dsh-tapd/transition` | 批量流转 / 评论 |

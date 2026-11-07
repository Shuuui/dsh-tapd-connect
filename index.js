/**
 * TAPD 需求处理 —— Host 半。
 *
 * 职责：
 * 1. 保存 TAPD 个人访问令牌（写入本机凭据库记录 `dsh-tapd/pat`，绝不回显）。
 * 2. 通过 TAPD Open API 读取项目、需求及其状态字典。
 * 3. 暴露 `/plugins/dsh-tapd/*` 同源 HTTP 路由，供浏览器面板调用。
 * 4. 把「分析 / 处理」落到真实的 DSH 会话：在工作区里创建会话并投递提示词，
 *    让标准会话生命周期驱动模型，而不是插件自己持有 Agent。
 * 5. 注册 `tapd` 工具，让模型能用同一套逻辑读需求、写评论、流转状态。
 *
 * 安全边界：路由只接受 loopback Host；写操作额外要求同源 Origin；
 * 令牌只从凭据库或环境变量读取，配置与响应里都不会出现明文。
 */

import { randomBytes } from 'node:crypto'

/** 插件自有路由前缀。 */
const ROUTE_BASE = '/plugins/dsh-tapd'
/** 凭据记录键：`<owner>/<id>`。 */
const CREDENTIAL_KEY = 'dsh-tapd/pat'
/** 令牌的环境变量兜底，便于无凭据库的部署。 */
const ENV_USERNAME = 'TAPD_API_USER'
const ENV_TOKEN = 'TAPD_API_TOKEN'
/** 默认 API 根地址。 */
const DEFAULT_API_BASE = 'https://api.tapd.cn'
/**
 * 网页端根地址。
 *
 * 与 `api.tapd.cn` 是两套东西：API 用令牌鉴权，网页端用浏览器登录态。所以面板里
 * 的条目链接只能拼网页端路径，拼成 API 地址点开只会得到 401。
 */
const DEFAULT_WEB_BASE = 'https://www.tapd.cn'
/** 写请求体上限。 */
const MAX_BODY_BYTES = 512 * 1024
/**
 * 优先级的显示定义。
 *
 * 颜色取自 TAPD 前端自己的样式表
 * （`static-fe.tapd.cn/chunk-tapdui/…css` 的 `.tapd-priority-select__textable`），
 * 所以面板里的优先级和 TAPD 网页上是同一套配色。
 *
 * 注意取值并不统一：缺陷用 `urgent/high/medium/low/insignificant`，
 * 而需求在多数项目里是**租户自定义的 MoSCoW 文案**——实测出现过
 * `Must Have (High)`、`Must Have (Middle)`、`Should Have`、`Nice To Have`、`Super`。
 * 所以这里既认编码，也按关键词匹配这些文案。
 */
const PRIORITY_STYLES = {
  urgent: { label: '紧急', color: '#f85e5e' },
  high: { label: '高', color: '#f85e5e' },
  // 需求侧把「中」叫 `Middle`，缺陷侧叫 `medium`；两者必须都能认出来。
  middle: { label: '中', color: '#93c36b' },
  medium: { label: '中', color: '#93c36b' },
  low: { label: '低', color: '#97afd0' },
  insignificant: { label: '微不足道', color: '#97afd0' },
  nicetohave: { label: '锦上添花', color: '#97afd0' },
}

/**
 * 自定义优先级文案 -> 色阶。
 *
 * 按顺序匹配，先命中者生效：`Must Have (High)` 里同时有 must 和 high，
 * 但括号里的等级才是真正的档位，所以 high/middle/low 规则排在 must 之前。
 */
const PRIORITY_TEXT_RULES = [
  { test: /urgent|紧急/i, key: 'urgent' },
  { test: /\bhigh\b|高等|\(高\)/i, key: 'high' },
  { test: /\bmiddle\b|\bmedium\b|中等|中\b/i, key: 'medium' },
  { test: /\blow\b|低等/i, key: 'low' },
  { test: /must\s*have|必须有|必要/i, key: 'high' },
  { test: /should\s*have|应该有|重要/i, key: 'medium' },
  { test: /nice\s*to\s*have|could\s*have|可以有|锦上添花/i, key: 'nicetohave' },
  { test: /super|超级/i, key: 'urgent' },
]

/**
 * 把 TAPD 的优先级取值归一成样式键。
 *
 * 先按内置编码精确匹配，再按关键词规则兜底，这样租户自定义的文案也能着色。
 * 完全认不出的值返回空串，面板原样显示但不加颜色——宁可素色，也不涂错色。
 *
 * @param {unknown} value 原始优先级（`priority` 或 `priority_label`）
 * @returns {string} `urgent|high|medium|low|insignificant|nicetohave` 或空串
 */
function priorityKey(value) {
  const raw = text(value).trim()
  if (raw === '') return ''
  const exact = raw.toLowerCase()
  if (Object.hasOwn(PRIORITY_STYLES, exact)) return exact
  for (const rule of PRIORITY_TEXT_RULES) {
    if (rule.test.test(raw)) return rule.key
  }
  return ''
}

/**
 * 生成优先级的展示对象：样式键、颜色、中文名。
 *
 * `label` 优先用 TAPD 的 `priority_label`（服务端已本地化），缺失时回落到内置中文名，
 * 两者都没有就返回空对象，面板据此决定不渲染这一项。
 *
 * @param {{priority?: unknown, priorityLabel?: unknown}} raw TAPD 原始记录
 */
function describePriority(raw) {
  // 面板上要显示的原文：`priority` 与 `priority_label` 在需求侧往往是同一句
  // 租户自定义文案（如 `Must Have (High)`），保留原文比换成中文简称更贴近 TAPD。
  const shown = text(raw.priority_label).trim() || text(raw.priority).trim()
  const key = priorityKey(raw.priority) || priorityKey(raw.priorityLabel) || priorityKey(shown)
  if (key === '') {
    // 认不出的优先级仍然要显示，只是不上色；完全为空才不渲染。
    return shown === '' ? {} : { priorityKey: '', priorityLabel: shown, priorityColor: '' }
  }
  return {
    priorityKey: key,
    priorityLabel: shown || PRIORITY_STYLES[key].label,
    priorityColor: PRIORITY_STYLES[key].color,
  }
}
/** 单次分析/处理最多覆盖的条目数，避免一次投递过长的提示词。 */
const MAX_BATCH = 30
/** 描述进入提示词时的截断长度。 */
const DESCRIPTION_LIMIT = 900

/**
 * 支持的条目类型。
 *
 * TAPD 的需求（story）与缺陷（bug）是两套独立的 REST 资源，连字段名都不一样：
 * 标题是 `name` / `title`，处理人是 `owner` / `current_owner`，创建人是
 * `creator` / `reporter`，没有 `creator` 的是缺陷。所以这里用一张表把差异集中
 * 收口，其余逻辑（筛选、分析提示词、流转、评论）只面对统一后的条目形状。
 *
 * @typedef {'story'|'bug'} ItemKind
 */
const ITEM_KINDS = {
  story: {
    id: 'story',
    /** REST 资源路径。 */
    path: '/stories',
    countPath: '/stories/count',
    /** 列表响应里每条记录的包装键。 */
    envelope: 'Story',
    /** 写接口与评论用的 entry_type。 */
    entryType: 'stories',
    /** 用户可见的名字。 */
    label: '需求',
    fields: [
      'id', 'name', 'status', 'owner', 'creator', 'created', 'modified', 'due',
      'priority_label', 'iteration_id', 'category_id', 'type', 'label', 'description',
    ],
    /** 把 TAPD 原始记录映射成统一形状。 */
    normalize(raw) {
      return {
        type: 'story',
        id: text(raw.id),
        name: text(raw.name),
        status: text(raw.status),
        statusLabel: text(raw.v_status),
        owner: text(raw.owner),
        creator: text(raw.creator),
        created: text(raw.created),
        modified: text(raw.modified),
        due: text(raw.due),
        priority: text(raw.priority_label) || text(raw.priority),
        ...describePriority(raw),
        iterationId: text(raw.iteration_id),
        category: text(raw.type),
        label: text(raw.label),
        description: plainText(raw.description, 400),
        descriptionFull: plainText(raw.description),
      }
    },
    /** 筛选参数 → TAPD 查询串。 */
    filterQuery(filters) {
      return {
        // 状态支持多选，TAPD 用 `|` 分隔多个取值。
        status: statusQuery(filters.status),
        owner: filters.owner || undefined,
        creator: filters.creator || undefined,
        iteration_id: filters.iterationId || undefined,
        name: filters.keyword ? `LIKE<${filters.keyword}>` : undefined,
        label: filters.label || undefined,
      }
    },
    /** 写接口里表达「状态 / 处理人」的字段。 */
    writeForm({ status, owner }) {
      const form = {}
      if (status) form.status = status
      if (owner) form.owner = owner
      return form
    },
  },
  bug: {
    id: 'bug',
    path: '/bugs',
    countPath: '/bugs/count',
    envelope: 'Bug',
    entryType: 'bug',
    label: '缺陷',
    fields: [
      'id', 'title', 'status', 'current_owner', 'reporter', 'created', 'modified', 'due',
      'priority_label', 'severity', 'iteration_id', 'bugtype', 'label', 'description',
    ],
    normalize(raw) {
      return {
        type: 'bug',
        id: text(raw.id),
        name: text(raw.title),
        status: text(raw.status),
        statusLabel: text(raw.v_status),
        owner: text(raw.current_owner),
        creator: text(raw.reporter),
        created: text(raw.created),
        modified: text(raw.modified),
        due: text(raw.due),
        priority: text(raw.priority_label) || text(raw.priority),
        ...describePriority(raw),
        severity: text(raw.severity),
        iterationId: text(raw.iteration_id),
        category: text(raw.bugtype),
        label: text(raw.label),
        description: plainText(raw.description, 400),
        descriptionFull: plainText(raw.description),
      }
    },
    filterQuery(filters) {
      return {
        // 状态支持多选，TAPD 用 `|` 分隔多个取值。
        status: statusQuery(filters.status),
        current_owner: filters.owner || undefined,
        reporter: filters.creator || undefined,
        iteration_id: filters.iterationId || undefined,
        title: filters.keyword ? `LIKE<${filters.keyword}>` : undefined,
        label: filters.label || undefined,
      }
    },
    writeForm({ status, owner }) {
      const form = {}
      if (status) form.status = status
      if (owner) form.current_owner = owner
      return form
    },
  },
}

/**
 * 归一化条目类型；未知值一律回落到需求。
 * @param {unknown} value 调用方给出的类型
 * @returns {ItemKind} 受支持的类型
 */
function itemKind(value) {
  const key = text(value).trim().toLowerCase()
  return key === 'bug' && Object.hasOwn(ITEM_KINDS, 'bug') ? 'bug' : 'story'
}

/**
 * 取类型定义。
 * @param {unknown} value 类型标识
 */
function kindSpec(value) {
  return ITEM_KINDS[itemKind(value)]
}

/**
 * 把状态筛选值拼成 TAPD 的多值查询串。
 *
 * TAPD Open API 用竖线分隔同字段的多个取值：`status=new|resolved`（实测：
 * 返回并集 8832 条；换成逗号则返回 0，说明它不认逗号）。面板可以传数组，
 * 也可以传已拼好的字符串，这里统一收敛，并去掉空值与重复项。
 *
 * @param {unknown} value 状态数组或单个状态字符串
 * @returns {string|undefined} 形如 `new|resolved`，无有效值时 undefined
 */
function statusQuery(value) {
  const list = Array.isArray(value) ? value : [value]
  const kept = []
  for (const entry of list) {
    for (const piece of text(entry).split('|')) {
      const item = piece.trim()
      if (item !== '' && !kept.includes(item)) kept.push(item)
    }
  }
  return kept.length === 0 ? undefined : kept.join('|')
}

/**
 * 拼出条目在 TAPD 网页端的地址。
 *
 * 路径取自 TAPD 前端自己的路由表（`static-fe.tapd.cn` 的 `chunk-common`）：
 * 需求 `tapd_fe/{项目}/story/detail/{id}`，缺陷 `tapd_fe/{项目}/bug/detail/{id}`。
 * 旧版的 `/{项目}/bug/bug_detail/{id}` 是已废弃路由，点开会被重定向回项目首页。
 *
 * @param {string} webBase 网页端根地址（不带结尾斜杠）
 * @param {string} workspaceId TAPD 项目 ID
 * @param {ItemKind} kind 条目类型
 * @param {string} id 条目 ID
 * @returns {string} 可直接打开的网址，缺参数时为空串
 */
function itemWebUrl(webBase, workspaceId, kind, id) {
  const project = text(workspaceId).trim()
  const item = text(id).trim()
  const base = text(webBase).trim().replace(/\/+$/, '')
  if (project === '' || item === '' || base === '') return ''
  const segment = itemKind(kind) === 'bug' ? 'bug' : 'story'
  return `${base}/tapd_fe/${encodeURIComponent(project)}/${segment}/detail/${encodeURIComponent(item)}`
}

/**
 * 项目主页地址，与条目链接同属 TAPD 前端的 `tapd_fe` 路由。
 * @param {string} webBase 网页端根地址
 * @param {string} workspaceId TAPD 项目 ID
 */
function projectWebUrl(webBase, workspaceId) {
  const project = text(workspaceId).trim()
  const base = text(webBase).trim().replace(/\/+$/, '')
  if (project === '' || base === '') return ''
  return `${base}/tapd_fe/${encodeURIComponent(project)}`
}

/**
 * 给条目补上网页端地址，面板据此渲染可点击的链接。
 * @param {object[]} items 已归一化的条目
 * @param {string} webBase 网页端根地址
 * @param {string} workspaceId TAPD 项目 ID
 * @param {ItemKind} kind 条目类型
 */
function withWebUrl(items, webBase, workspaceId, kind) {
  return items.map((item) => ({ ...item, url: itemWebUrl(webBase, workspaceId, kind, item.id) }))
}

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

/** 读取 JSON 请求体，超过上限即拒绝。 */
async function readJsonBody(req, limit = MAX_BODY_BYTES) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > limit) throw new Error('请求体过大')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') return {}
  const parsed = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('请求体必须是 JSON 对象')
  }
  return parsed
}

/** 统一的 JSON 响应。 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

/** 取 Host 头里的主机名（忽略端口，兼容 IPv6 括号形式）。 */
function hostnameOf(host) {
  const value = String(host ?? '').trim().toLowerCase()
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end === -1 ? value : value.slice(0, end + 1)
  }
  const colon = value.lastIndexOf(':')
  if (colon !== -1 && /^\d+$/.test(value.slice(colon + 1))) return value.slice(0, colon)
  return value
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** 只服务本机页面：远端绑定或 DNS 重绑定页面都拿不到数据。 */
function isLoopbackRequest(req) {
  return LOOPBACK_HOSTS.has(hostnameOf(req.headers.host))
}

/**
 * 判断一个请求能否进入插件路由。
 *
 * 用 Harness 自己的连接信任判定（`ctx.connection.requestRejection`）：它已经盖住
 * loopback / 绑定 IP / `trustedHosts`、Origin 与 Host 在各自 scheme 下的默认端口
 * 归一化（HTTPS 代理转 HTTP 上游也能过），以及 `sec-fetch-site: cross-site`。
 * 自建一套更严的 Host===Origin 比较只会在代理、容器端口映射或桌面外壳改写
 * Host 时误杀正常请求。
 *
 * 返回 401 表示「信任检查已过、只差浏览器凭据」，不属于本函数的拒绝范围。
 *
 * @returns {{ rejected: false } | { rejected: true, status: number, reason: string }}
 */
function admitRequest(ctx, req) {
  const connection = ctx.get('connection')
  if (connection && typeof connection.requestRejection === 'function') {
    let rejection
    try {
      rejection = connection.requestRejection({ headers: req.headers })
    } catch {
      rejection = undefined
    }
    if (rejection === 403) {
      return { rejected: true, status: 403, reason: 'request-not-trusted' }
    }
    return { rejected: false }
  }
  if (!isLoopbackRequest(req)) {
    return { rejected: true, status: 403, reason: 'request-not-trusted' }
  }
  return { rejected: false }
}

/** 去掉描述里的 HTML 标签，压平空白。 */
function plainText(value, limit = DESCRIPTION_LIMIT) {
  if (typeof value !== 'string') return ''
  const stripped = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return stripped.length > limit ? `${stripped.slice(0, limit)}…` : stripped
}

/** 空值安全的字符串。 */
function text(value) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

/** 数组去重并保序。 */
function unique(values) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value !== '')))
}

/**
 * 判断是否是绝对路径。
 *
 * 同时接受 Windows（`C:\x`、`\\server\share`）与 POSIX（`/x`）两种写法：
 * 面板和 Host 可能不在同一个平台上，用 `path.isAbsolute` 会把对方平台的形式判错。
 *
 * @param {string} value 待判断的路径
 */
function isAbsolutePath(value) {
  const p = text(value).trim()
  if (p === '') return false
  if (p.startsWith('/')) return true
  // UNC 路径：\\server\share
  if (/^\\\\[^\\]+\\[^\\]+/.test(p)) return true
  // 盘符路径：C:\ 或 C:/
  return /^[A-Za-z]:[\\/]/.test(p)
}

/* ------------------------------------------------------------------ */
/* 配置                                                                */
/* ------------------------------------------------------------------ */

/** 把任意配置收敛成插件内部使用的形状。 */
function normalizeConfig(raw) {
  const source = typeof raw === 'object' && raw !== null ? raw : {}
  const projects = Array.isArray(source.projects)
    ? source.projects
        .map((item) => {
          if (typeof item === 'string') return { id: item.trim(), name: item.trim() }
          if (typeof item !== 'object' || item === null) return undefined
          const id = text(item.id).trim()
          const name = text(item.name).trim() || id
          return id === '' ? undefined : { id, name }
        })
        .filter(Boolean)
    : []
  const mappings = Array.isArray(source.mappings)
    ? source.mappings
        .map((item) => {
          if (typeof item !== 'object' || item === null) return undefined
          const workspaceId = text(item.workspaceId ?? item.workspace_id ?? item.id).trim()
          const path = text(item.path).trim()
          return workspaceId === '' || path === '' ? undefined : { workspaceId, path }
        })
        .filter(Boolean)
    : []
  return {
    apiBase: (text(source.apiBase).trim() || DEFAULT_API_BASE).replace(/\/+$/, ''),
    /** 网页端根地址，用于在面板里生成可点击跳转的条目链接。 */
    webBase: (text(source.webBase).trim() || DEFAULT_WEB_BASE).replace(/\/+$/, ''),
    username: text(source.username).trim(),
    companyId: text(source.companyId).trim(),
    projects,
    mappings,
    defaultPath: text(source.defaultPath).trim(),
    /**
     * 只在面板里显示这些项目（按项目 ID）。空数组表示不过滤、全部显示。
     * 这是纯展示偏好，不影响 API 权限——没勾选的项目只是不出现在下拉框里。
     */
    visibleProjects: Array.isArray(source.visibleProjects)
      ? source.visibleProjects.map((id) => text(id).trim()).filter(Boolean)
      : [],
    /** 面板默认选中的条目类型：story（需求）或 bug（缺陷）。 */
    defaultKind: itemKind(source.defaultKind),
  }
}

/* ------------------------------------------------------------------ */
/* TAPD 客户端                                                         */
/* ------------------------------------------------------------------ */

/** 把 TAPD 的错误形状收敛成一条可读消息。 */
function tapdFailure(status, payload) {
  const info = payload && typeof payload === 'object' ? payload.info : undefined
  const requestId =
    payload && typeof payload === 'object' && payload.meta && typeof payload.meta === 'object'
      ? text(payload.meta.request_id)
      : ''
  const detail = typeof info === 'string' && info !== '' ? info : `HTTP ${status}`
  const error = new Error(
    `TAPD 拒绝了请求（HTTP ${status}）：${detail}` +
      (requestId === '' ? '' : `（request_id ${requestId}）`),
  )
  error.code = 'tapd/upstream'
  error.status = status
  error.requestId = requestId
  return error
}

/**
 * TAPD Open API 接受的 Authorization 形态，按「最可能是个人访问令牌」的顺序排列。
 *
 * 三种形态的凭证模型互不通用：
 *
 * - `bearer`     —— `Authorization: Bearer <令牌>`：**个人访问令牌**（TAPD 个人设置
 *                   里生成），也是 tapd-mcp 一类现成实现的用法，所以排第一。
 * - `basic`      —— Basic `昵称:令牌` 或 `api_user:api_password`：企业申请的 API 账号。
 * - `token-user` —— Basic `令牌:`：少数实现把令牌当用户名，留作兜底。
 */
const AUTH_MODES = ['bearer', 'basic', 'token-user']

/**
 * 按指定形态组装 Authorization 头。
 * @param {'basic'|'bearer'|'token-user'} mode 认证形态
 * @param {{username: string, token: string}} credentials 账号与令牌
 * @returns {string} 完整的 Authorization 头取值
 */
function authHeaderFor(mode, credentials) {
  if (mode === 'bearer') return `Bearer ${credentials.token}`
  const pair =
    mode === 'token-user' ? `${credentials.token}:` : `${credentials.username}:${credentials.token}`
  return `Basic ${Buffer.from(pair).toString('base64')}`
}

/** 创建绑定到一份配置与凭据的 TAPD 客户端。 */
function createTapdClient(config, initialCredentials) {
  // 可变：个人访问令牌不带昵称，首次需要时由 /users/info 问出来并缓存在这里。
  const credentials = { ...initialCredentials }
  const mode = AUTH_MODES.includes(credentials.mode) ? credentials.mode : 'bearer'
  const authHeader = authHeaderFor(mode, credentials)

  async function call(method, path, { query, form, signal } = {}) {
    const url = new URL(config.apiBase + path)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue
        url.searchParams.set(key, String(value))
      }
    }
    const headers = { Authorization: authHeader, Accept: 'application/json' }
    let body
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8'
      body = new URLSearchParams(
        Object.entries(form).filter(([, value]) => value !== undefined && value !== null),
      ).toString()
    }
    const response = await fetch(url, { method, headers, body, signal })
    const raw = await response.text()
    let payload
    try {
      payload = raw === '' ? {} : JSON.parse(raw)
    } catch {
      throw new Error(`TAPD 返回了无法解析的响应（HTTP ${response.status}）`)
    }
    if (!response.ok) throw tapdFailure(response.status, payload)
    if (Number(payload?.status) !== 1) throw tapdFailure(response.status, payload)
    return payload.data
  }

  return {
    /** 本次使用的认证形态，让调用方知道探测结果。 */
    mode,

    /**
     * 读取令牌对应的 TAPD 用户。
     *
     * `/users/info` 是**用户态**接口，Bearer（个人访问令牌）直接就能用，返回
     * 当前用户 id / name / nick / current_company_id。有了它，用户不必再手填昵称，
     * 也不必知道公司 ID——这正是 tapd-mcp 一类实现的做法。
     *
     * @param {AbortSignal} signal 取消信号
     * @returns {Promise<{id: string, name: string, nick: string, companyId: string}>}
     */
    async currentUser(signal) {
      const data = await call('GET', '/users/info', { signal })
      return {
        id: text(data?.id),
        name: text(data?.name),
        nick: text(data?.nick),
        companyId: text(data?.current_company_id),
      }
    },

    /**
     * 校验凭证是否可用。
     *
     * 不碰 `/quickstart/testauth`：那是文档里专给 **Basic Auth** 写的探针，
     * Bearer（个人访问令牌）打过去只会得到 422 ParamError，会把好令牌误判成坏令牌。
     *
     * 这里用 `/users/info`：它同样是用户态、Bearer 原生支持，令牌无效会明确 401/422，
     * 和「权限不足」区分得开；顺带还能拿到昵称与公司 ID 供后续接口使用。
     *
     * @param {AbortSignal} signal 取消信号
     * @returns {Promise<{user: {id: string, name: string, nick: string, companyId: string}}>}
     */
    async verify(signal) {
      const user = await this.currentUser(signal)
      return { user }
    },

    /**
     * 需求或缺陷列表（含总量）。
     *
     * @param {{workspaceId: string, kind?: ItemKind, filters?: object, limit?: number, page?: number, signal?: AbortSignal}} request
     *   项目、条目类型与筛选条件
     * @returns {Promise<{total: number, page: number, limit: number, kind: ItemKind, items: object[]}>}
     *   统一后的条目列表
     */
    async listItems({ workspaceId, kind = 'story', filters = {}, limit = 50, page = 1, signal }) {
      const spec = kindSpec(kind)
      const filterQuery = spec.filterQuery(filters)
      const query = {
        workspace_id: workspaceId,
        limit,
        page,
        with_v_status: 1,
        fields: spec.fields.join(','),
        order: filters.order ?? 'created desc',
        ...filterQuery,
      }
      const [list, count] = await Promise.all([
        call('GET', spec.path, { query, signal }),
        call('GET', spec.countPath, {
          query: { workspace_id: workspaceId, ...filterQuery },
          signal,
        }),
      ])
      const rows = Array.isArray(list) ? list : []
      return {
        total: Number(count?.count ?? rows.length) || rows.length,
        page,
        limit,
        kind: spec.id,
        items: rows
          .map((entry) => entry?.[spec.envelope])
          .filter(Boolean)
          .map((raw) => spec.normalize(raw)),
      }
    },

    /**
     * 按 ID 拉取条目详情，保持调用方给出的顺序。
     *
     * @param {string} workspaceId 项目 ID
     * @param {ItemKind} kind 条目类型
     * @param {string[]} ids 条目 ID
     * @param {AbortSignal} signal 取消信号
     * @returns {Promise<object[]>} 统一后的条目
     */
    async getItems(workspaceId, kind, ids, signal) {
      if (ids.length === 0) return []
      const spec = kindSpec(kind)
      const data = await call('GET', spec.path, {
        query: {
          workspace_id: workspaceId,
          id: ids.join(','),
          with_v_status: 1,
          limit: ids.length,
        },
        signal,
      })
      const byId = new Map()
      for (const entry of Array.isArray(data) ? data : []) {
        const raw = entry?.[spec.envelope]
        if (raw) byId.set(text(raw.id), raw)
      }
      return ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((raw) => ({ ...spec.normalize(raw), descriptionFull: plainText(raw.description) }))
    },

    /** 按 ID 拉取需求详情，保持调用方给出的顺序。 */
    async getStories(workspaceId, ids, signal) {
      return this.getItems(workspaceId, 'story', ids, signal)
    },

    /**
     * 项目列表：优先「我参与的项目」，回退到配置里的清单。
     *
     * `/workspaces/user_participant_projects` 的 `nick` 是必填项。个人访问令牌
     * （Bearer）不携带昵称，所以先经 `/users/info` 问出昵称再查——用户无需手填。
     */
    async listProjects(signal) {
      let nick = credentials.username
      let companyId = config.companyId
      if (nick === '' || companyId === '') {
        try {
          const user = await this.currentUser(signal)
          if (nick === '') nick = user.nick
          if (companyId === '') companyId = user.companyId
          credentials.username = nick
        } catch (error) {
          if (error?.name === 'AbortError') throw error
          if (nick === '') return { source: 'config', projects: config.projects }
        }
      }
      try {
        const data = await call('GET', '/workspaces/user_participant_projects', {
          query: { nick, company_id: companyId },
          signal,
        })
        const rows = (Array.isArray(data) ? data : [])
          .map((entry) => entry?.Workspace)
          .filter(Boolean)
          .map((workspace) => ({
            id: text(workspace.id),
            name: text(workspace.name) || text(workspace.pretty_name) || text(workspace.id),
            status: text(workspace.status),
          }))
        if (rows.length > 0) return { source: 'remote', projects: rows }
      } catch (error) {
        if (error?.name === 'AbortError') throw error
      }
      return { source: 'config', projects: config.projects }
    },

    /**
     * 状态中英文对照。
     *
     * `/workflows/status_map` 的 `system` 必须与条目类型对应：需求是 `story`，
     * 缺陷是 `bug`。两者工作流不同，状态集合也不同，不能混用。
     *
     * @param {string} workspaceId 项目 ID
     * @param {ItemKind} kind 条目类型
     * @param {AbortSignal} signal 取消信号
     * @returns {Promise<Array<{id: string, label: string}>>} 状态字典
     */
    async statusMap(workspaceId, kind, signal) {
      if (workspaceId === '') return []
      try {
        const data = await call('GET', '/workflows/status_map', {
          query: { workspace_id: workspaceId, system: kindSpec(kind).id },
          signal,
        })
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return Object.entries(data)
            .filter(([key]) => typeof key === 'string' && key !== '')
            .map(([id, label]) => ({ id, label: text(label) || id }))
        }
      } catch (error) {
        if (error?.name === 'AbortError') throw error
      }
      return []
    },

    /**
     * 更新单条条目（状态 / 处理人）。
     *
     * 缺陷写接口用 `current_owner` 表示处理人，需求用 `owner`，由类型定义收口。
     *
     * @param {{workspaceId: string, kind: ItemKind, id: string, status?: string, owner?: string, signal?: AbortSignal}} request
     *   项目、类型、条目 ID 与要改的字段
     * @returns {Promise<{id: string, status: string, owner: string}>} 更新后的关键字段
     */
    async updateItem({ workspaceId, kind, id, status, owner, signal }) {
      const spec = kindSpec(kind)
      const form = {
        workspace_id: workspaceId,
        id,
        current_user: credentials.username,
        ...spec.writeForm({ status: text(status), owner: text(owner) }),
      }
      const data = await call('POST', spec.path, { form, signal })
      const raw = data?.[spec.envelope]
      const normalized = raw ? spec.normalize(raw) : undefined
      return {
        id: text(normalized?.id ?? id),
        status: text(normalized?.status ?? status),
        owner: text(normalized?.owner ?? owner),
      }
    },

    /**
     * 追加评论。
     *
     * 评论接口的 `entry_type` 必须与条目类型匹配：需求是 `stories`，缺陷是 `bug`。
     *
     * @param {{workspaceId: string, kind: ItemKind, id: string, description: string, signal?: AbortSignal}} request
     *   项目、类型、条目与评论内容
     * @returns {Promise<{id: string}>} 新评论 ID
     */
    async addComment({ workspaceId, kind, id, description, signal }) {
      const spec = kindSpec(kind)
      const data = await call('POST', '/comments', {
        form: {
          workspace_id: workspaceId,
          entry_type: spec.entryType,
          entry_id: id,
          description,
          author: credentials.username,
        },
        signal,
      })
      return { id: text(data?.Comment?.id) }
    },
  }
}

/* ------------------------------------------------------------------ */
/* 提示词                                                              */
/* ------------------------------------------------------------------ */

/**
 * 一条条目（需求或缺陷）的提示词片段。
 * @param {object} item 统一后的条目
 * @param {number} index 序号
 * @param {string} kindLabel 类型名（需求 / 缺陷）
 */
function itemBlock(item, index, kindLabel) {
  const lines = [
    `### ${index + 1}. ${text(item.name) || text(item.id)}`,
    `- TAPD ${kindLabel} ID：${text(item.id)}`,
    `- 状态：${text(item.statusLabel) || text(item.status) || '未知'}` +
      `　处理人：${text(item.owner) || '未指派'}` +
      `　优先级：${text(item.priority) || '未设置'}` +
      (text(item.severity) ? `　严重程度：${text(item.severity)}` : ''),
  ]
  if (text(item.due)) lines.push(`- 预计完成：${text(item.due)}`)
  if (text(item.iterationId)) lines.push(`- 迭代：${text(item.iterationId)}`)
  const description = text(item.descriptionFull) || text(item.description)
  if (description) lines.push(`- 描述：${description}`)
  return lines.join('\n')
}

/**
 * 分析阶段：先产出清单，不改代码。
 * @param {{project: object, items: object[], kind: ItemKind, filters: object}} request 分析范围
 */
function buildAnalysisPrompt({ project, items, kind, filters }) {
  const spec = kindSpec(kind)
  const filterNote = [
    filters.status ? `状态=${filters.status}` : '',
    filters.owner ? `处理人=${filters.owner}` : '',
    filters.keyword ? `标题含「${filters.keyword}」` : '',
    filters.iterationId ? `迭代=${filters.iterationId}` : '',
  ]
    .filter(Boolean)
    .join('，')
  const what = spec.label
  return [
    `请先分析下面从 TAPD 项目「${project.name}」（ID ${project.id}）筛选出的 ${items.length} 条${what}，` +
      `筛选条件：${filterNote || '全部'}。`,
    '',
    '要求：',
    '1. **只分析，不改代码**，也不要调用会修改文件的工具；',
    `2. 在当前工作区里核实每条${what}涉及的位置（模块、文件、接口、配置），找不到就明确写「未定位」；`,
    `3. 指出${what}之间的依赖、重复或可合并项；`,
    '4. 列出风险与不确定点，需要我确认的问题集中放在最后一节；',
    `5. 给出建议的处理顺序与分批方式，以及每条建议的目标 TAPD 状态流转（仅供我审核，不要自己改 TAPD）。`,
    '',
    `输出格式：先一个总览表（${what} ID / 标题 / 建议优先级 / 预估工作量 / 是否可立即开工），` +
      `再按${what}逐条展开（改动点、验收要点、风险），最后是待确认问题与建议顺序。`,
    '',
    '---',
    '',
    items.map((item, index) => itemBlock(item, index, what)).join('\n\n'),
  ].join('\n')
}

/**
 * 处理阶段：在已审核的范围内动手。
 * @param {{project: object, items: object[], kind: ItemKind, note?: string}} request 处理范围
 */
function buildImplementationPrompt({ project, items, kind, note }) {
  const what = kindSpec(kind).label
  return [
    `下面 ${items.length} 条 TAPD 项目「${project.name}」${what}的分析清单已经审核通过，现在开始处理。`,
    note ? `补充说明：${note}` : '',
    '',
    '要求：',
    '1. 按依赖与风险顺序逐条实现，每条完成后说明改动文件与验证方式；',
    '2. 遇到与描述不符、或必须改变外部契约的地方，停下来先问我；',
    '3. 不要自行流转 TAPD 状态，等我确认后再统一流转。',
    '',
    '---',
    '',
    items.map((item, index) => itemBlock(item, index, what)).join('\n\n'),
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/* ------------------------------------------------------------------ */
/* 插件                                                                */
/* ------------------------------------------------------------------ */

export const name = 'dsh-tapd-connect'

/** `webServer` 是路由的硬依赖；凭据、工具、会话控制器按可选处理。 */
export const inject = ['webServer']

export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)

  /** 读取当前有效的 TAPD 身份：凭据库优先，其次环境变量与配置。 */
  async function resolveIdentity() {
    const credentials = ctx.get('credentials')
    let record
    if (credentials) {
      try {
        record = await credentials.readRecord(CREDENTIAL_KEY)
      } catch {
        record = undefined
      }
    }
    const payload =
      record && record.kind === 'grant' && typeof record.payload === 'object' && record.payload !== null
        ? record.payload
        : {}
    const token = text(payload.token) || text(process.env[ENV_TOKEN])
    const username = text(payload.username) || config.username || text(process.env[ENV_USERNAME])
    const savedMode = text(payload.mode)
    return {
      username: username.trim(),
      token: token.trim(),
      mode: AUTH_MODES.includes(savedMode) ? savedMode : 'bearer',
      source: token === '' ? 'none' : text(payload.token) ? 'store' : 'env',
      savedAt: text(payload.savedAt),
      writable: Boolean(credentials),
    }
  }

  /**
   * 需要已认证的 TAPD 客户端。
   *
   * 只有令牌是硬条件：个人访问令牌走 Bearer，本来就没有账号昵称；昵称只在
   * Basic（企业 API 账号）下才需要，缺了它由 Basic 自己返回 401 更准确。
   */
  async function requireClient(signal) {
    const identity = await resolveIdentity()
    if (identity.token === '') {
      const error = new Error('尚未配置 TAPD 访问令牌，请先在面板里填写令牌')
      error.code = 'tapd/unauthorized'
      throw error
    }
    return { identity, client: createTapdClient(config, identity) }
  }

  /** 解析项目身份：优先调用方给的名字，其次配置/远端清单。 */
  async function resolveProject(workspaceId, signal) {
    const id = text(workspaceId).trim()
    if (id === '') throw new Error('缺少 TAPD 项目 ID')
    const configured = config.projects.find((item) => item.id === id)
    if (configured) return configured
    try {
      const { client } = await requireClient(signal)
      const { projects } = await client.listProjects(signal)
      return projects.find((item) => item.id === id) ?? { id, name: id }
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      return { id, name: id }
    }
  }

  /**
   * 解析目标工作目录：调用方指定 → 项目映射 → 配置默认目录 →
   * 当前/最近工作区中最近活动的会话目录 → Harness 默认工作区。
   *
   * 中间那一步很关键：`workingDirectory.defaultDirectory` 是 Harness 进程的
   * 兜底目录（桌面版里就是 profile 目录），不是用户正在用的代码库。
   */
  async function resolveCwd(workspaceId, explicit) {
    const requested = text(explicit).trim()
    if (requested !== '') return requested
    const mapped = config.mappings.find((item) => item.workspaceId === workspaceId)
    if (mapped) return mapped.path
    if (config.defaultPath !== '') return config.defaultPath
    const recent = await mostRecentSessionDirectory()
    if (recent !== '') return recent
    const workingDirectory = ctx.get('workingDirectory')
    return workingDirectory?.defaultDirectory ?? process.cwd()
  }

  /** 取最近活动会话所在目录，作为「当前工作区」的最佳近似。 */
  async function mostRecentSessionDirectory() {
    const controller = ctx.get('sessionController')
    if (!controller) return ''
    let sessions = []
    try {
      const listed = await controller.list({}, new AbortController().signal)
      sessions = Array.isArray(listed?.items) ? listed.items : []
    } catch {
      return ''
    }
    const candidates = sessions
      .filter((item) => text(item?.cwd) !== '' && text(item?.origin) === '')
      .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt))
    return candidates.length > 0 ? text(candidates[0].cwd) : ''
  }

  /** 确认目标目录存在，返回它的进程路径。 */
  async function ensureDirectory(path, signal) {
    const fs = ctx.get('fs')
    if (fs) {
      try {
        const target = await fs.resolve(path, { signal })
        const info = await fs.stat(target, signal)
        if (info === undefined) throw new Error(`工作区目录不存在：${path}`)
        if (info.type !== 'directory') throw new Error(`工作区路径不是目录：${path}`)
        return fs.processPath(target)
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        if (error instanceof Error && error.message.startsWith('工作区')) throw error
        throw new Error(`无法使用工作区目录 ${path}：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return path
  }

  /**
   * 在解析出的工作区里创建一个会话并投递提示词。
   * 会话由标准 Session Controller / Agent 生命周期管理，插件不持有 Agent。
   */
  async function createSessionWithPrompt({ workspaceId, cwd, prompt, signal }) {
    const controller = ctx.get('sessionController')
    if (!controller) throw new Error('当前部署没有可用的会话控制器，无法创建分析会话')
    let workspacePath = await ensureDirectory(cwd, signal)
    let registeredWorkspaceId
    const registry = ctx.get('workspaceRegistry')
    if (registry) {
      try {
        const workspace = await registry.resolveByPath(workspacePath)
        if (workspace) {
          registeredWorkspaceId = workspace.id
          workspacePath = workspace.path
        }
      } catch {
        /* 未注册的目录按 cwd 直接创建会话 */
      }
    }
    const created = await controller.create(
      registeredWorkspaceId ? { workspaceId: registeredWorkspaceId } : { cwd: workspacePath },
    )
    const sessionId = created?.sessionId
    if (!sessionId) throw new Error('会话创建失败：未返回会话 ID')
    // `prompt` 是 Remote 方法，第二个参数必须是 AbortSignal：它会直接调用
    // `signal.throwIfAborted()`，传 undefined 就炸「Cannot read properties of
    // undefined (reading 'throwIfAborted')」。HTTP 路由拿不到请求的 signal，
    // 所以这里用一个不会被取消的 signal 兜底。
    await controller.prompt(
      {
        sessionId,
        requestId: `tapd-${randomBytes(8).toString('hex')}`,
        mode: 'queue',
        content: [{ type: 'text', text: prompt }],
      },
      signal ?? new AbortController().signal,
    )
    return { sessionId, cwd: workspacePath }
  }

  /* ---------------------------------------------------------------- */
  /* 业务动作                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * 按 `visibleProjects` 过滤项目清单。
   *
   * 空清单 = 不启用过滤，全部显示。过滤只影响面板展示，不改变 API 权限。
   *
   * @param {Array<{id: string, name: string}>} all 全部项目
   * @returns {Array<{id: string, name: string}>} 面板要显示的项目
   */
  function applyProjectFilter(all) {
    if (config.visibleProjects.length === 0) return all
    const wanted = new Set(config.visibleProjects)
    const kept = all.filter((project) => wanted.has(project.id))
    // 过滤后一个都不剩（例如换了账号）时不静默显示空列表，退回全量并在面板提示。
    return kept.length > 0 ? kept : all
  }

  /** 项目清单 + 当前身份状态，面板首屏用。 */
  async function describeState(signal) {
    const identity = await resolveIdentity()
    let allProjects = config.projects
    let source = 'config'
    let tapdUser = identity.username
    if (identity.token !== '') {
      try {
        const { client } = await requireClient(signal)
        // 个人访问令牌不携带昵称，先问一次自报身份，面板才能显示「已连接：谁」。
        if (tapdUser === '') {
          try {
            const user = await client.currentUser(signal)
            tapdUser = user.nick || user.name
          } catch (error) {
            if (error?.name === 'AbortError') throw error
          }
        }
        const result = await client.listProjects(signal)
        allProjects = result.projects.length > 0 ? result.projects : config.projects
        source = result.source
      } catch (error) {
        if (error?.name === 'AbortError') throw error
      }
    }
    const projects = applyProjectFilter(allProjects)
    return {
      configured: identity.source !== 'none',
      username: tapdUser,
      source: identity.source,
      savedAt: identity.savedAt,
      writable: identity.writable,
      companyId: config.companyId,
      apiBase: config.apiBase,
      webBase: config.webBase,
      defaultPath: config.defaultPath,
      mappings: config.mappings,
      /** 面板实际可选项：已应用 visibleProjects 过滤。 */
      projects,
      /** 全量项目，供设置面板的勾选列表使用。 */
      allProjects,
      /** 过滤是否生效（勾选列表非空且确实筛掉了项目）。 */
      projectFilterActive: projects.length !== allProjects.length,
      visibleProjects: config.visibleProjects,
      defaultKind: config.defaultKind,
      projectsSource: source,
      effectiveDirectory: await resolveCwd('', ''),
    }
  }

  /**
   * 归一化并校验面板提交的映射。
   *
   * 只接受「项目 ID → 绝对路径」这种形状：项目 ID 必填，路径必须是绝对路径。
   * 相对路径在不同进程的工作目录下指向不同地方，静默接受只会在建会话时出错，
   * 所以这里直接拒绝并说清原因。
   *
   * @param {unknown} input 面板提交的映射数组
   * @returns {Array<{workspaceId: string, path: string}>} 干净的映射
   */
  function normalizeMappings(input) {
    if (!Array.isArray(input)) return []
    const out = []
    const seen = new Set()
    for (const item of input) {
      if (typeof item !== 'object' || item === null) continue
      const workspaceId = text(item.workspaceId ?? item.workspace_id ?? item.id).trim()
      const path = text(item.path).trim()
      if (workspaceId === '' || path === '') continue
      // 同一个项目只能映射到一个目录，重复时以最后一条为准。
      if (seen.has(workspaceId)) {
        const at = out.findIndex((entry) => entry.workspaceId === workspaceId)
        if (at >= 0) out.splice(at, 1)
      }
      if (!isAbsolutePath(path)) {
        throw new Error(`「${workspaceId}」的目录必须是绝对路径，收到的是：${path}`)
      }
      seen.add(workspaceId)
      out.push({ workspaceId, path })
    }
    return out
  }

  /**
   * 保存面板偏好到插件配置：项目显示范围、默认条目类型、项目→工作区映射。
   *
   * 走 `configEditor`：它是 Loader 认可的写入口，会保留 profile 文件里其他行与注释，
   * 而不是让插件自己去改 `cordis.patch.yml`。
   *
   * @param {{visibleProjects?: string[], defaultKind?: ItemKind, mappings?: unknown, defaultPath?: string}} input 要保存的偏好
   * @returns {Promise<object>} 保存后的完整状态
   */
  async function updatePreferences({ visibleProjects, defaultKind, mappings, defaultPath }) {
    const editor = ctx.get('configEditor')
    const entry = ctx.fiber?.entry
    if (!editor || !entry) {
      throw new Error('当前 profile 不支持保存插件配置（缺少 configEditor）')
    }
    const nextVisible = Array.isArray(visibleProjects)
      ? visibleProjects.map((id) => text(id).trim()).filter(Boolean)
      : config.visibleProjects
    const nextKind = defaultKind === undefined ? config.defaultKind : itemKind(defaultKind)
    const nextMappings =
      mappings === undefined ? config.mappings : normalizeMappings(mappings)
    const nextDefaultPath =
      defaultPath === undefined ? config.defaultPath : text(defaultPath).trim()
    if (nextDefaultPath !== '' && !isAbsolutePath(nextDefaultPath)) {
      throw new Error(`默认目录必须是绝对路径，收到的是：${nextDefaultPath}`)
    }
    await editor.edit(entry, (current) => ({
      ...current,
      visibleProjects: nextVisible,
      defaultKind: nextKind,
      mappings: nextMappings,
      defaultPath: nextDefaultPath,
    }))
    // 配置变更会让插件重启，这里先按新值更新内存副本，面板能立即看到结果。
    config.visibleProjects = nextVisible
    config.defaultKind = nextKind
    config.mappings = nextMappings
    config.defaultPath = nextDefaultPath
    return describeState()
  }

  /**
   * 保存或清除令牌。
   *
   * 不预设凭证类型：个人访问令牌走 Bearer，企业 API 账号走 Basic，两者凭据互不通
   * 用，用户名只在 Basic 下有意义。这里依次探测，谁通过就记住谁，并把 TAPD 的原始
   * 答复带回面板，便于区分「令牌失效」和「账号没权限」。
   *
   * @param {{username?: string, token?: string, clear?: boolean}} input 面板提交的内容
   */
  async function updateCredential({ username, token, clear }) {
    const credentials = ctx.get('credentials')
    if (!credentials) throw new Error('当前部署没有凭据库，无法保存令牌')
    const nextUser = text(username).trim() || config.username
    if (clear === true) {
      await credentials.deleteRecord(CREDENTIAL_KEY)
      return describeState()
    }
    const nextToken = text(token).trim()
    if (nextToken === '') throw new Error('令牌不能为空')

    const attempts = []
    let accepted
    let user
    for (const mode of AUTH_MODES) {
      const probe = createTapdClient(config, { username: nextUser, token: nextToken, mode })
      try {
        const result = await probe.verify()
        user = result.user
        accepted = mode
        break
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        attempts.push({ mode, message: error instanceof Error ? error.message : String(error) })
      }
    }
    if (accepted === undefined) {
      const detail = attempts.map((item) => `- ${item.mode}：${item.message}`).join('\n')
      const bearerFailed = attempts.some(
        (item) => item.mode === 'bearer' && /invalid|Unauthorized|401|422/i.test(item.message),
      )
      throw new Error(
        '令牌验证失败，TAPD 没有接受这组凭证。试过的传法：\n' +
          `${detail}\n` +
          (bearerFailed
            ? 'Bearer 报「The access token provided is invalid」说明个人访问令牌失效或复制不全，' +
              '请到 TAPD「个人设置 → 个人访问令牌」重新生成；Basic 401 则多为账号口令错。'
            : '请核对令牌是否来自 TAPD 开放平台，且账号有 Open API 权限。'),
      )
    }

    await credentials.modifyRecord(CREDENTIAL_KEY, async () => ({
      kind: 'grant',
      payload: {
        // 昵称以令牌自报的身份为准：个人访问令牌不需要用户手填，也不会填错。
        username: user?.nick || nextUser,
        token: nextToken,
        mode: accepted,
        userId: user?.id ?? '',
        companyId: user?.companyId ?? '',
        savedAt: new Date().toISOString(),
      },
    }))
    return {
      ...(await describeState()),
      acceptedMode: accepted,
      tapdUser: user?.nick ?? '',
      companyId: user?.companyId ?? '',
    }
  }

  /**
   * 一键分析：把筛选结果整理成清单任务，投递到一个会话里。
   * @param {{workspaceId: string, kind?: ItemKind, ids?: string[], filters?: object, cwd?: string, signal?: AbortSignal}} request
   *   项目、条目类型与范围
   */
  async function analyze({ workspaceId, kind = 'story', ids, filters = {}, cwd, signal }) {
    const { client } = await requireClient(signal)
    const project = await resolveProject(workspaceId, signal)
    const spec = kindSpec(kind)
    const requested = unique(Array.isArray(ids) ? ids.map(text) : []).slice(0, MAX_BATCH)
    let items
    if (requested.length > 0) {
      items = await client.getItems(project.id, spec.id, requested, signal)
    } else {
      const listed = await client.listItems({
        workspaceId: project.id,
        kind: spec.id,
        filters,
        limit: MAX_BATCH,
        signal,
      })
      items = listed.items
    }
    if (items.length === 0) throw new Error(`没有可分析的${spec.label}，请调整筛选条件`)
    const target = await resolveCwd(project.id, cwd)
    const session = await createSessionWithPrompt({
      workspaceId: project.id,
      cwd: target,
      prompt: buildAnalysisPrompt({ project, items, kind: spec.id, filters }),
      signal,
    })
    return {
      project,
      kind: spec.id,
      count: items.length,
      ids: items.map((item) => text(item.id)),
      cwd: session.cwd,
      sessionId: session.sessionId,
    }
  }

  /**
   * 审核后处理：在同一项目范围内下发实现任务。
   * @param {{workspaceId: string, kind?: ItemKind, ids?: string[], cwd?: string, note?: string, signal?: AbortSignal}} request
   *   项目、条目类型与范围
   */
  async function implement({ workspaceId, kind = 'story', ids, cwd, note, signal }) {
    const { client } = await requireClient(signal)
    const project = await resolveProject(workspaceId, signal)
    const spec = kindSpec(kind)
    const requested = unique(Array.isArray(ids) ? ids.map(text) : []).slice(0, MAX_BATCH)
    if (requested.length === 0) throw new Error(`请先选择要处理的${spec.label}`)
    const items = await client.getItems(project.id, spec.id, requested, signal)
    if (items.length === 0) throw new Error(`选中的${spec.label}已不可读取`)
    const target = await resolveCwd(project.id, cwd)
    const session = await createSessionWithPrompt({
      workspaceId: project.id,
      cwd: target,
      prompt: buildImplementationPrompt({ project, items, kind: spec.id, note }),
      signal,
    })
    return {
      project,
      kind: spec.id,
      count: items.length,
      ids: items.map((item) => text(item.id)),
      cwd: session.cwd,
      sessionId: session.sessionId,
    }
  }

  /**
   * 审核后流转：批量改状态 / 处理人，可选追加一条评论。
   * @param {{workspaceId: string, kind?: ItemKind, ids?: string[], status?: string, owner?: string, comment?: string, signal?: AbortSignal}} request
   *   项目、条目类型与要执行的变更
   */
  async function transition({ workspaceId, kind = 'story', ids, status, owner, comment, signal }) {
    const { client } = await requireClient(signal)
    const project = await resolveProject(workspaceId, signal)
    const spec = kindSpec(kind)
    const requested = unique(Array.isArray(ids) ? ids.map(text) : []).slice(0, MAX_BATCH)
    if (requested.length === 0) throw new Error(`请先选择要流转的${spec.label}`)
    const nextStatus = text(status).trim()
    const nextOwner = text(owner).trim()
    const note = text(comment).trim()
    if (nextStatus === '' && nextOwner === '' && note === '') {
      throw new Error('请至少指定目标状态、处理人或评论内容之一')
    }
    const results = []
    for (const id of requested) {
      const item = { id, updated: false, commented: false, message: '' }
      try {
        if (nextStatus !== '' || nextOwner !== '') {
          await client.updateItem({
            workspaceId: project.id,
            kind: spec.id,
            id,
            status: nextStatus,
            owner: nextOwner,
            signal,
          })
          item.updated = true
        }
        if (note !== '') {
          await client.addComment({
            workspaceId: project.id,
            kind: spec.id,
            id,
            description: note,
            signal,
          })
          item.commented = true
        }
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        item.message = error instanceof Error ? error.message : String(error)
      }
      results.push(item)
    }
    return {
      project,
      kind: spec.id,
      status: nextStatus,
      owner: nextOwner,
      results,
      succeeded: results.filter((item) => item.message === '').length,
      failed: results.filter((item) => item.message !== '').length,
    }
  }

  /* ---------------------------------------------------------------- */
  /* HTTP 路由                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * 注册一条插件路由。
   * @param {'exact'|'prefix'} kind 路由类型
   * @param {string} path 完整路径
   * @param {(req: any, res: any, body: any) => Promise<void>} handler 业务处理
   * @param {{write?: boolean}} options write=true 时读取 JSON 请求体
   *
   * 每条路由都过一遍 Harness 的请求信任判定（`ctx.connection.requestRejection`），
   * 它同时负责 Host 白名单和 Origin 同源比较：带 Origin 的请求必须指向同一 authority，
   * `sec-fetch-site: cross-site` 直接拒绝。没有 Origin 只可能来自非浏览器调用者，
   * 而这类调用者带不上浏览器 Cookie，构不成 CSRF，因此不再自行加一层判断。
   */
  function route(kind, path, handler, options = {}) {
    ctx.effect(
      () =>
        ctx.webServer.register({
          kind,
          path,
          handler: async (req, res) => {
            const admission = admitRequest(ctx, req)
            if (admission.rejected) {
              // 带上观察到的请求头原样回显，拒绝时能直接看出是哪一项不匹配。
              sendJson(res, admission.status, {
                error: admission.reason,
                observed: {
                  host: text(req.headers.host),
                  origin: text(req.headers.origin),
                  scheme: text(req.headers['x-forwarded-proto']),
                  secFetchSite: text(req.headers['sec-fetch-site']),
                },
                hint:
                  'Harness 认为该请求的 Host/Origin 不受信任。若页面地址不是 127.0.0.1/localhost，' +
                  '请在 Web 层配置 trustedHosts，或直接用 http://127.0.0.1:14593 打开。',
              })
              return
            }
            let body = {}
            try {
              if (options.write === true) body = await readJsonBody(req)
              await handler(req, res, body)
            } catch (error) {
              const status = error?.code === 'tapd/unauthorized' ? 401 : 400
              sendJson(res, status, {
                error: error instanceof Error ? error.message : String(error),
              })
            }
          },
        }),
      `dsh-tapd-connect: ${path}`,
    )
  }

  route('exact', `${ROUTE_BASE}/status`, async (_req, res) => {
    sendJson(res, 200, { status: 'ok', ...(await describeState()) })
  })

  /**
   * 依赖自检：面板报错时先看这里——哪一项服务缺失，就决定了「一键分析」能不能落地。
   * 只报告能力是否存在，不触碰任何业务数据。
   */
  route('exact', `${ROUTE_BASE}/diagnostics`, async (_req, res) => {
    const has = (name) => {
      const service = ctx.get(name)
      return service !== undefined && service !== null
    }
    const workingDirectory = ctx.get('workingDirectory')
    const defaultDirectory = text(workingDirectory?.defaultDirectory)
    let effectiveDirectory = defaultDirectory
    let directoryError = ''
    try {
      effectiveDirectory = await ensureDirectory(await resolveCwd('', ''))
    } catch (error) {
      directoryError = error instanceof Error ? error.message : String(error)
    }
    sendJson(res, 200, {
      status: 'ok',
      services: {
        credentials: has('credentials'),
        sessionController: has('sessionController'),
        workspaceRegistry: has('workspaceRegistry'),
        workingDirectory: has('workingDirectory'),
        fs: has('fs'),
        tools: has('tools'),
        webServer: has('webServer'),
      },
      defaultDirectory,
      effectiveDirectory,
      directoryError,
      configuredMappings: config.mappings.length,
    })
  })

  route(
    'exact',
    `${ROUTE_BASE}/credential`,
    async (_req, res, body) => {
      sendJson(res, 200, { status: 'ok', ...(await updateCredential(body)) })
    },
    { write: true },
  )

  /**
   * 凭证诊断：不保存任何东西，把三种传法各打一次探针，逐条回报 TAPD 的答复。
   * 用来区分「口令填错」「账号没开通 Open API」「用的是个人令牌但拼法不同」。
   */
  route(
    'exact',
    `${ROUTE_BASE}/credential/diagnose`,
    async (_req, res, body) => {
      const username = text(body.username).trim() || config.username
      const token = text(body.token).trim()
      if (token === '') throw new Error('请填写令牌后再诊断')
      const attempts = []
      for (const mode of AUTH_MODES) {
        const probe = createTapdClient(config, { username, token, mode })
        try {
          const identity = await probe.verify()
          attempts.push({
            mode,
            ok: true,
            message: '',
            user: identity.user?.nick ?? '',
          })
        } catch (error) {
          if (error?.name === 'AbortError') throw error
          attempts.push({
            mode,
            ok: false,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }
      sendJson(res, 200, { status: 'ok', apiBase: config.apiBase, username, attempts })
    },
    { write: true },
  )

  route(
    'exact',
    `${ROUTE_BASE}/projects`,
    async (_req, res) => {
      const { client, identity } = await requireClient()
      const listed = await client.listProjects()
      // 个人访问令牌没有昵称，用 /users/info 自报身份回显，面板才知道「已连接：谁」。
      let username = identity.username
      if (username === '') {
        try {
          const user = await client.currentUser()
          username = user.nick || user.name
        } catch {
          username = ''
        }
      }
      const allProjects = listed.projects.length > 0 ? listed.projects : config.projects
      sendJson(res, 200, {
        status: 'ok',
        username,
        ...listed,
        projects: applyProjectFilter(allProjects),
        allProjects,
        visibleProjects: config.visibleProjects,
      })
    },
    { write: true },
  )

  /**
   * 查询需求或缺陷。
   *
   * `kind` 决定资源路径、字段映射与状态字典：需求 `/stories` + `system=story`，
   * 缺陷 `/bugs` + `system=bug`，两者工作流不同，状态集合也不能混用。
   */
  route(
    'exact',
    `${ROUTE_BASE}/items`,
    async (_req, res, body) => {
      const { client } = await requireClient()
      const workspaceId = text(body.workspaceId).trim()
      if (workspaceId === '') throw new Error('缺少 TAPD 项目 ID')
      const spec = kindSpec(body.kind)
      const [listed, statuses] = await Promise.all([
        client.listItems({
          workspaceId,
          kind: spec.id,
          filters: body.filters ?? {},
          limit: Math.min(Number(body.limit) || 30, 200),
          page: Math.max(Number(body.page) || 1, 1),
        }),
        client.statusMap(workspaceId, spec.id),
      ])
      sendJson(res, 200, {
        status: 'ok',
        statuses,
        ...listed,
        items: withWebUrl(listed.items, config.webBase, workspaceId, spec.id),
      })
    },
    { write: true },
  )

  /** 保存面板偏好：项目显示范围与默认条目类型。 */
  route(
    'exact',
    `${ROUTE_BASE}/preferences`,
    async (_req, res, body) => {
      sendJson(res, 200, { status: 'ok', ...(await updatePreferences(body ?? {})) })
    },
    { write: true },
  )

  route(
    'exact',
    `${ROUTE_BASE}/analyze`,
    async (_req, res, body) => {
      const result = await analyze(body ?? {})
      sendJson(res, 200, { status: 'ok', ...result })
    },
    { write: true },
  )

  route(
    'exact',
    `${ROUTE_BASE}/implement`,
    async (_req, res, body) => {
      const result = await implement(body ?? {})
      sendJson(res, 200, { status: 'ok', ...result })
    },
    { write: true },
  )

  route(
    'exact',
    `${ROUTE_BASE}/transition`,
    async (_req, res, body) => {
      const result = await transition(body ?? {})
      sendJson(res, 200, { status: 'ok', ...result })
    },
    { write: true },
  )

  /* ---------------------------------------------------------------- */
  /* 模型工具                                                          */
  /* ---------------------------------------------------------------- */

  ctx.inject(['tools'], (toolsCtx) => {
    toolsCtx.effect(
      () =>
        toolsCtx.tools.register({
          name: 'tapd',
          description:
            '读写 TAPD 需求与缺陷。action=projects 列出项目；action=items 按条件查询需求或缺陷；' +
            'action=analyze 把选中的条目交给一个工作区会话先做分析清单；' +
            'action=implement 在审核后下发实现任务；' +
            'action=transition 批量流转状态或处理人；action=comment 追加评论。',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['projects', 'items', 'stories', 'analyze', 'implement', 'transition', 'comment'],
                description: '要执行的操作。items 与 stories 等价，stories 仅为兼容保留。',
              },
              kind: {
                type: 'string',
                enum: ['story', 'bug'],
                description: '条目类型：story=需求（默认），bug=缺陷。',
              },
              workspaceId: { type: 'string', description: 'TAPD 项目 ID。' },
              ids: {
                type: 'array',
                items: { type: 'string' },
                description: '条目 ID 列表；analyze/implement/transition/comment 使用。',
              },
              filters: {
                type: 'object',
                description: 'items 的筛选条件：status、owner、keyword、iterationId、label。',
                additionalProperties: true,
              },
              limit: { type: 'integer', description: 'items 返回条数上限，默认 30，最大 200。' },
              page: { type: 'integer', description: 'items 页码，默认 1。' },
              status: { type: 'string', description: 'transition 的目标状态（英文状态名）。' },
              owner: { type: 'string', description: 'transition 的目标处理人。' },
              comment: { type: 'string', description: 'transition 追加的评论，或 comment 的内容。' },
              cwd: { type: 'string', description: 'analyze/implement 的目标工作区目录。' },
              note: { type: 'string', description: 'implement 的补充说明。' },
            },
            required: ['action'],
            additionalProperties: false,
          },
          output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
          },
          async execute(args, exec) {
            const signal = exec.signal
            const action = text(args.action)
            const workspaceId = text(args.workspaceId)
            const kind = itemKind(args.kind ?? config.defaultKind)
            const ids = Array.isArray(args.ids) ? args.ids.map(text) : []
            if (action === 'projects') {
              const { client } = await requireClient(signal)
              const listed = await client.listProjects(signal)
              return {
                projects: applyProjectFilter(listed.projects),
                allProjects: listed.projects,
                source: listed.source,
              }
            }
            if (action === 'items' || action === 'stories') {
              const { client } = await requireClient(signal)
              if (workspaceId === '') throw new Error('缺少 TAPD 项目 ID')
              return client.listItems({
                workspaceId,
                kind,
                filters: args.filters ?? {},
                limit: Math.min(Number(args.limit) || 30, 200),
                page: Math.max(Number(args.page) || 1, 1),
                signal,
              })
            }
            if (action === 'analyze') {
              return analyze({
                workspaceId,
                kind,
                ids,
                filters: args.filters ?? {},
                cwd: args.cwd,
                signal,
              })
            }
            if (action === 'implement') {
              return implement({ workspaceId, kind, ids, cwd: args.cwd, note: args.note, signal })
            }
            if (action === 'transition') {
              return transition({
                workspaceId,
                kind,
                ids,
                status: args.status,
                owner: args.owner,
                comment: args.comment,
                signal,
              })
            }
            if (action === 'comment') {
              const { client } = await requireClient(signal)
              const project = await resolveProject(workspaceId, signal)
              const description = text(args.comment).trim()
              if (description === '') throw new Error('评论内容不能为空')
              const results = []
              for (const id of ids) {
                try {
                  await client.addComment({
                    workspaceId: project.id,
                    kind,
                    id,
                    description,
                    signal,
                  })
                  results.push({ id, ok: true })
                } catch (error) {
                  if (error?.name === 'AbortError') throw error
                  results.push({
                    id,
                    ok: false,
                    message: error instanceof Error ? error.message : String(error),
                  })
                }
              }
              return { project, kind, results }
            }
            throw new Error(`未知操作：${action}`)
          },
        }),
      'dsh-tapd-connect: tapd tool',
    )
  })
}

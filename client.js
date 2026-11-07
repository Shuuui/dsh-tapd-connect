window.__ModuleLoader__.load({
  id: 'dsh-tapd-connect',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** 侧边栏入口 id 与主面板 key 必须一致：侧边栏按这个 id 打开面板。 */
    const PANEL_ID = 'tapd-requests'
    const ROUTE_BASE = '/plugins/dsh-tapd'
    /** 网页端默认根地址；Host 的 webBase 配置优先。 */
    const DEFAULT_WEB_BASE = 'https://www.tapd.cn'

    /* -------------------------------------------------------------- */
    /* 样式                                                            */
    /* -------------------------------------------------------------- */

    const CSS = `
.dsh-tapd { display:flex; flex-direction:column; height:100%; min-height:0;
  color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base);
  font-size:13px; }
.dsh-tapd-head { display:flex; align-items:center; gap:10px; padding:14px 18px;
  border-bottom:1px solid var(--dsw-alias-border-l1); flex:0 0 auto; }
.dsh-tapd-title { font-size:15px; font-weight:600; }
.dsh-tapd-sub { color:var(--dsw-alias-label-secondary); font-size:12px; }
.dsh-tapd-grow { flex:1 1 auto; }
.dsh-tapd-body { flex:1 1 auto; min-height:0; overflow:auto; padding:14px 18px 24px; }
.dsh-tapd-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dsh-tapd-stack { display:flex; flex-direction:column; gap:10px; }
.dsh-tapd-card { border:1px solid var(--dsw-alias-border-l1); border-radius:10px;
  background:var(--dsw-alias-bg-layer-1); padding:12px; }
.dsh-tapd-field { display:flex; flex-direction:column; gap:4px; min-width:140px; }
.dsh-tapd-label { font-size:11px; color:var(--dsw-alias-label-secondary); }
.dsh-tapd-input, .dsh-tapd-select { height:30px; padding:0 8px; border-radius:7px;
  border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary); font-size:12px; outline:none; min-width:0; }
.dsh-tapd-input:focus, .dsh-tapd-select:focus { border-color:var(--dsw-alias-brand-primary); }
.dsh-tapd-btn { height:30px; padding:0 12px; border-radius:7px; cursor:pointer;
  border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary); font-size:12px; white-space:nowrap; }
.dsh-tapd-btn:hover:not(:disabled) { border-color:var(--dsw-alias-border-l2); }
.dsh-tapd-btn:disabled { opacity:.5; cursor:not-allowed; }
.dsh-tapd-btn-primary { background:var(--dsw-alias-brand-primary); border-color:transparent;
  color:#fff; font-weight:500; }
.dsh-tapd-btn-ghost { background:transparent; }
.dsh-tapd-seg { display:inline-flex; border:1px solid var(--dsw-alias-border-l1);
  border-radius:7px; overflow:hidden; }
.dsh-tapd-seg button { height:30px; padding:0 14px; border:0; cursor:pointer;
  background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary);
  font-size:12px; }
.dsh-tapd-seg button[data-on="1"] { background:var(--dsw-alias-brand-primary); color:#fff; }
.dsh-tapd-list { display:flex; flex-direction:column; border:1px solid var(--dsw-alias-border-l1);
  border-radius:10px; overflow:hidden; }
.dsh-tapd-item { display:flex; gap:10px; padding:10px 12px; align-items:flex-start;
  border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); }
.dsh-tapd-item:last-child { border-bottom:none; }
.dsh-tapd-item:hover { background:var(--dsw-alias-bg-layer-2); }
.dsh-tapd-item-main { display:flex; flex-direction:column; gap:4px; min-width:0; flex:1 1 auto; }
.dsh-tapd-item-title { font-size:13px; line-height:1.4; word-break:break-word; }
.dsh-tapd-item-meta { font-size:11px; color:var(--dsw-alias-label-secondary);
  display:flex; gap:10px; flex-wrap:wrap; }
.dsh-tapd-check { margin-top:3px; width:14px; height:14px; accent-color:var(--dsw-alias-brand-primary); }
.dsh-tapd-empty { padding:28px; text-align:center; color:var(--dsw-alias-label-secondary);
  font-size:12px; }
.dsh-tapd-error { color:var(--dsw-alias-state-error-primary); font-size:12px;
  white-space:pre-line; }
.dsh-tapd-ok { color:var(--dsw-alias-state-success-primary); font-size:12px; }
.dsh-tapd-warn { color:var(--dsw-alias-state-warn-primary); font-size:12px; }
.dsh-tapd-chip { font-size:11px; padding:1px 6px; border-radius:6px;
  background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary);
  border:1px solid var(--dsw-alias-border-l1); }
.dsh-tapd-bar { position:sticky; bottom:0; display:flex; align-items:center; gap:8px;
  padding:10px 18px; border-top:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-1); flex:0 0 auto; flex-wrap:wrap; }
.dsh-tapd-count { font-size:12px; color:var(--dsw-alias-label-secondary); }
.dsh-tapd-mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; }
.dsh-tapd-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr));
  gap:4px 12px; max-height:260px; overflow:auto; padding:8px 10px;
  border:1px solid var(--dsw-alias-border-l1); border-radius:8px;
  background:var(--dsw-alias-bg-layer-2); }
.dsh-tapd-opt { display:flex; align-items:center; gap:6px; font-size:12px; padding:2px 0; }
.dsh-tapd-opt span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsh-tapd-link { color:var(--dsw-alias-brand-primary); text-decoration:none; cursor:pointer; }
.dsh-tapd-link:hover { text-decoration:underline; }
/* 优先级沿用 TAPD 的彩色文字样式：只上色，不加底色。 */
.dsh-tapd-priority { font-weight:600; }
/* 项目 → 目录映射编辑区 */
.dsh-tapd-map-list { display:flex; flex-direction:column; gap:6px; max-height:280px;
  overflow:auto; padding:8px 10px; border:1px solid var(--dsw-alias-border-l1);
  border-radius:8px; background:var(--dsw-alias-bg-layer-2); }
.dsh-tapd-map-row { display:flex; align-items:center; gap:8px; }
.dsh-tapd-map-name { flex:0 0 170px; font-size:12px; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.dsh-tapd-map-path { flex:1 1 auto; min-width:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:11px; }
/* 开始处理前的工作区确认弹窗：用强调边框从卡片流里跳出来 */
.dsh-tapd-dialog { border-color:var(--dsw-alias-brand-primary);
  box-shadow:0 6px 24px rgba(24,43,80,.12); }
`

    /* -------------------------------------------------------------- */
    /* HTTP                                                            */
    /* -------------------------------------------------------------- */

    /**
     * 拼出条目在 TAPD 网页端的地址。
     *
     * 优先用 Host 下发的 `url`（它能跟随 `webBase` 配置变化）；老版本 Host 没有这个
     * 字段时，这里按同样的路径规则兜底，避免刷新页面后链接整体消失。
     *
     * 路径取自 TAPD 前端自己的路由表（`static-fe.tapd.cn` 的 `chunk-common`）：
     * 需求 `tapd_fe/{项目}/story/detail/{id}`，缺陷 `tapd_fe/{项目}/bug/detail/{id}`，
     * 项目主页 `tapd_fe/{项目}`。这不是猜的——旧版的 `/{项目}/bug/bug_detail/{id}`
     * 是已废弃路由，点开会被重定向回项目首页。
     *
     * @param {object} item 条目（可能带 url）
     * @param {string} webBase 网页端根地址
     * @param {string} kind 条目类型
     * @param {string} projectId TAPD 项目 ID
     */
    function itemUrl(item, webBase, kind, projectId) {
      const direct = typeof item?.url === 'string' ? item.url.trim() : ''
      if (direct !== '') return direct
      const id = typeof item?.id === 'string' ? item.id.trim() : ''
      const project = typeof projectId === 'string' ? projectId.trim() : ''
      if (id === '' || project === '') return ''
      const base = (typeof webBase === 'string' && webBase.trim() !== ''
        ? webBase.trim()
        : DEFAULT_WEB_BASE
      ).replace(/\/+$/, '')
      const segment = kind === 'bug' ? 'bug' : 'story'
      return `${base}/tapd_fe/${encodeURIComponent(project)}/${segment}/detail/${encodeURIComponent(id)}`
    }

    /** 项目主页地址，同样是 TAPD 前端的 `tapd_fe` 路由。 */
    function projectUrl(webBase, projectId) {
      const project = typeof projectId === 'string' ? projectId.trim() : ''
      if (project === '') return ''
      const base = (typeof webBase === 'string' && webBase.trim() !== ''
        ? webBase.trim()
        : DEFAULT_WEB_BASE
      ).replace(/\/+$/, '')
      return `${base}/tapd_fe/${encodeURIComponent(project)}`
    }

    /**
     * 优先级配色兜底。
     *
     * 颜色抄自 TAPD 前端的 `.tapd-priority-select__textable`（chunk-tapdui 样式表），
     * 与 Host 下发的 `priorityColor` 是同一套。Host 尚未重启、没带这个字段时，
     * 面板据此仍能显示与 TAPD 一致的颜色。
     */
    const PRIORITY_FALLBACK = {
      urgent: { label: '紧急', color: '#f85e5e' },
      high: { label: '高', color: '#f85e5e' },
      middle: { label: '中', color: '#93c36b' },
      medium: { label: '中', color: '#93c36b' },
      low: { label: '低', color: '#97afd0' },
      insignificant: { label: '微不足道', color: '#97afd0' },
      nicetohave: { label: '锦上添花', color: '#97afd0' },
    }

    /**
     * 自定义优先级文案的识别规则。
     *
     * 需求在多数项目里用的不是 `High/Middle` 这种编码，而是租户自定义的文案，
     * 实测出现过 `Must Have (High)`、`Must Have (Middle)`、`Should Have`、
     * `Nice To Have`、`Super`。这里按关键词兜底，先匹配等级词再匹配 MoSCoW 词。
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
     * 把任意优先级取值收敛成样式键（先精确编码，再关键词兜底）。
     * @param {unknown} value 原始优先级
     * @returns {string} 样式键，认不出时为空串
     */
    function priorityKey(value) {
      const raw = text(value).trim()
      if (raw === '') return ''
      const exact = raw.toLowerCase()
      if (Object.hasOwn(PRIORITY_FALLBACK, exact)) return exact
      for (const rule of PRIORITY_TEXT_RULES) {
        if (rule.test.test(raw)) return rule.key
      }
      return ''
    }

    /**
     * 解析一条条目的优先级展示：文字与颜色。
     *
     * 文字优先用 TAPD 原文（Host 的 `priorityLabel`，或条目自身的 `priority`），
     * 颜色优先用 Host 下发的 `priorityColor`；都没有时按关键词兜底。
     * 认不出的值原样显示且不上色，避免把陌生优先级涂成误导性的颜色。
     *
     * @param {object} item 条目
     * @returns {{text: string, color: string}} 展示用文字与色值
     */
    function priorityView(item) {
      const raw = text(item?.priority).trim()
      const hostLabel = text(item?.priorityLabel).trim()
      const key = priorityKey(raw) || priorityKey(hostLabel)
      const known = key === '' ? undefined : PRIORITY_FALLBACK[key]
      const label = hostLabel || raw || (known ? known.label : '')
      const color = text(item?.priorityColor).trim() || (known ? known.color : '')
      return { text: label, color: label === '' ? '' : color }
    }

    /** 把任意值收敛成字符串（宿主字段可能缺失）。 */
    function text(value) {
      return value === null || value === undefined ? '' : String(value)
    }

    /** 把 Host 的结构化失败拼成一条可读消息，便于直接判断成因。 */
    function failureMessage(payload, status) {
      const error =
        typeof payload?.error === 'string' && payload.error !== ''
          ? payload.error
          : `请求失败（HTTP ${status}）`
      if (error === 'request-not-trusted') {
        const observed = payload?.observed
        const seen =
          observed && typeof observed === 'object'
            ? `页面 Host=${observed.host || '空'}，Origin=${observed.origin || '空'}，` +
              `sec-fetch-site=${observed.secFetchSite || '空'}`
            : ''
        return [
          'Harness 拒绝了这次请求的 Host/Origin 校验。',
          seen,
          typeof payload?.hint === 'string' ? payload.hint : '',
        ]
          .filter(Boolean)
          .join('\n')
      }
      return error
    }

    async function post(path, body) {
      const response = await fetch(`${ROUTE_BASE}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(failureMessage(payload, response.status))
      return payload
    }

    async function readStatus() {
      const response = await fetch(`${ROUTE_BASE}/status`, {
        headers: { accept: 'application/json' },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(failureMessage(payload, response.status))
      return payload
    }

    /* -------------------------------------------------------------- */
    /* 小部件                                                          */
    /* -------------------------------------------------------------- */

    function Field(props) {
      return h(
        'label',
        { className: 'dsh-tapd-field' },
        h('span', { className: 'dsh-tapd-label' }, props.label),
        props.children,
      )
    }

    /** 需求 / 缺陷切换。两者是 TAPD 里不同的资源与工作流。 */
    function KindSwitch({ kind, onChange, t }) {
      return h(
        'div',
        { className: 'dsh-tapd-seg', role: 'tablist', 'aria-label': t('itemKind') },
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': kind === 'story',
            'data-on': kind === 'story' ? '1' : '0',
            onClick: () => onChange('story'),
          },
          t('kindStory'),
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': kind === 'bug',
            'data-on': kind === 'bug' ? '1' : '0',
            onClick: () => onChange('bug'),
          },
          t('kindBug'),
        ),
      )
    }

    /** 侧边栏图标：一张带勾选的表单。 */
    function TapdPanelIcon(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 16
      const stroke = props.active ? 'var(--dsw-alias-brand-primary)' : 'currentColor'
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke,
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('rect', { x: 2.5, y: 1.8, width: 11, height: 12.4, rx: 2 }),
        h('path', { d: 'M5.4 5.2h5.2' }),
        h('path', { d: 'M5.4 8h5.2' }),
        h('path', { d: 'M5.4 10.8h3' }),
      )
    }

    /* -------------------------------------------------------------- */
    /* 主面板                                                          */
    /* -------------------------------------------------------------- */

    function TapdPanel(props) {
      const t = props.t
      const [state, setState] = React.useState(null)
      const [loading, setLoading] = React.useState(false)
      const [busy, setBusy] = React.useState('')
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [projects, setProjects] = React.useState([])
      const [allProjects, setAllProjects] = React.useState([])
      const [projectId, setProjectId] = React.useState('')
      const [manualId, setManualId] = React.useState('')
      const [kind, setKind] = React.useState('story')
      const [statuses, setStatuses] = React.useState([])
      const [filters, setFilters] = React.useState({
        status: '',
        owner: '',
        keyword: '',
        iterationId: '',
      })
      const [items, setItems] = React.useState([])
      const [total, setTotal] = React.useState(0)
      const [selected, setSelected] = React.useState([])
      const [credential, setCredential] = React.useState({ username: '', token: '' })
      const [transition, setTransition] = React.useState(null)
      const [result, setResult] = React.useState(null)
      const [showScope, setShowScope] = React.useState(false)
      const [scopeDraft, setScopeDraft] = React.useState([])
      /** 设置里草拟的默认条目类型，保存后才写入插件配置。 */
      const [kindDraft, setKindDraft] = React.useState('story')
      /** 处理人是否已按「自己」初始化过；置位后允许首屏那次查询带上它。 */
      const [ownerSeeded, setOwnerSeeded] = React.useState(false)

      const selectedIds = React.useMemo(() => selected.filter(Boolean), [selected])
      const toggle = (id) =>
        setSelected((current) =>
          current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
        )

      /** 首屏：读取状态，恢复到已保存的项目与条目类型。 */
      const refreshState = React.useCallback(async () => {
        setError('')
        try {
          const payload = await readStatus()
          setState(payload)
          setCredential((current) => ({ ...current, username: payload.username || '' }))
          setAllProjects(Array.isArray(payload.allProjects) ? payload.allProjects : [])
          setScopeDraft(Array.isArray(payload.visibleProjects) ? payload.visibleProjects : [])
          setKindDraft(payload.defaultKind === 'bug' ? 'bug' : 'story')
          if (payload.defaultKind === 'bug' || payload.defaultKind === 'story') {
            setKind((current) => (current === 'story' ? payload.defaultKind : current))
          }
          const shown = Array.isArray(payload.projects) ? payload.projects : []
          if (shown.length > 0) {
            setProjects(shown)
            setProjectId((current) =>
              shown.some((project) => project.id === current) ? current : shown[0].id,
            )
          }
          // 处理人默认筛自己：TAPD 的「我的缺陷/需求」是最常用的入口。
          // 只在处理人仍为空时填充，避免覆盖用户手动改过的条件。
          const me = typeof payload.username === 'string' ? payload.username.trim() : ''
          if (me !== '') {
            setFilters((current) => (current.owner === '' ? { ...current, owner: me } : current))
          }
          setOwnerSeeded(true)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }, [])

      React.useEffect(() => {
        refreshState()
      }, [refreshState])

      /** 拉取需求或缺陷列表；两者共用同一链路，由 kind 决定资源。 */
      const loadItems = React.useCallback(
        async (nextProjectId, nextFilters, nextKind) => {
          if (!nextProjectId) return
          setLoading(true)
          setError('')
          setNotice('')
          try {
            const payload = await post('items', {
              workspaceId: nextProjectId,
              kind: nextKind,
              filters: nextFilters,
              limit: 50,
            })
            setItems(Array.isArray(payload.items) ? payload.items : [])
            setTotal(Number(payload.total) || 0)
            setStatuses(Array.isArray(payload.statuses) ? payload.statuses : [])
            setSelected([])
            if (Array.isArray(payload.items) && payload.items.length === 0) {
              setNotice(t('emptyItems'))
            }
          } catch (cause) {
            setItems([])
            setTotal(0)
            setError(cause instanceof Error ? cause.message : String(cause))
          } finally {
            setLoading(false)
          }
        },
        [t],
      )

      React.useEffect(() => {
        // 等首屏状态读完再查：否则会先用空处理人发一次请求，紧接着又被「自己」覆盖，
        // 用户会看到列表闪一下再变。`ownerSeeded` 保证只查一次。
        if (!projectId || !ownerSeeded) return
        loadItems(projectId, filters, kind)
        // 项目与条目类型变化时重新拉取；筛选条件由「查询」按钮触发。
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [projectId, kind, ownerSeeded])

      /** 手动输入的项目 ID：远端清单拿不到时的兜底入口。 */
      const applyManualId = () => {
        const id = manualId.trim()
        if (id === '') return
        setProjects((current) =>
          current.some((item) => item.id === id) ? current : [...current, { id, name: id }],
        )
        setProjectId(id)
        setManualId('')
      }

      /** 保存面板偏好：项目显示范围。空数组表示全部显示。 */
      const saveScope = async () => {
        setBusy('scope')
        setError('')
        setNotice('')
        try {
          const payload = await post('preferences', {
            visibleProjects: scopeDraft,
            defaultKind: kindDraft,
          })
          setState((current) => ({ ...(current || {}), ...payload }))
          setAllProjects(Array.isArray(payload.allProjects) ? payload.allProjects : [])
          setScopeDraft(Array.isArray(payload.visibleProjects) ? payload.visibleProjects : [])
          setKindDraft(payload.defaultKind === 'bug' ? 'bug' : 'story')
          const shown = Array.isArray(payload.projects) ? payload.projects : []
          setProjects(shown)
          if (shown.length > 0) {
            setProjectId((current) =>
              shown.some((project) => project.id === current) ? current : shown[0].id,
            )
          }
          setShowScope(false)
          setNotice(
            scopeDraft.length === 0
              ? t('scopeAllSaved')
              : t('scopeSaved', { count: String(scopeDraft.filter(Boolean).length) }),
          )
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      const toggleScope = (id) =>
        setScopeDraft((current) =>
          current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
        )

      /** 草稿里的项目 → 目录映射；保存后写入插件配置。 */
      const [mappingDraft, setMappingDraft] = React.useState({})
      /** 草稿里的默认目录（未命中映射时用）。 */
      const [defaultPathDraft, setDefaultPathDraft] = React.useState('')
      const [showMapping, setShowMapping] = React.useState(false)
      /**
       * 开始处理/分析前的工作区确认弹窗。
       * `mode` 区分「生成分析清单」与「开始处理」两条链路，两者提示词不同。
       */
      const [workspaceDialog, setWorkspaceDialog] = React.useState(null)

      /** 打开映射编辑器时，把已保存的配置复制进草稿。 */
      const openMapping = () => {
        const saved = {}
        for (const item of Array.isArray(state?.mappings) ? state.mappings : []) {
          if (item && typeof item.workspaceId === 'string') saved[item.workspaceId] = item.path || ''
        }
        setMappingDraft(saved)
        setDefaultPathDraft(typeof state?.defaultPath === 'string' ? state.defaultPath : '')
        setShowMapping(true)
      }

      /** 调 Harness 的原生目录选择器；取消时返回 null，不改动草稿。 */
      const pickMappingDirectory = async (workspaceId) => {
        const ui = props.ctxGet ? props.ctxGet('uiWorkspace') : undefined
        if (!ui || typeof ui.pickDirectory !== 'function') {
          setError(t('pickerUnavailable'))
          return
        }
        try {
          const chosen = await ui.pickDirectory()
          if (typeof chosen === 'string' && chosen !== '') {
            setMappingDraft((current) => ({ ...current, [workspaceId]: chosen }))
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }

      const pickDefaultPath = async () => {
        const ui = props.ctxGet ? props.ctxGet('uiWorkspace') : undefined
        if (!ui || typeof ui.pickDirectory !== 'function') {
          setError(t('pickerUnavailable'))
          return
        }
        try {
          const chosen = await ui.pickDirectory()
          if (typeof chosen === 'string' && chosen !== '') setDefaultPathDraft(chosen)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }

      /** 保存映射；空路径的行会被丢弃（等于「这个项目不映射」）。 */
      const saveMapping = async () => {
        setBusy('mapping')
        setError('')
        setNotice('')
        try {
          const list = Object.keys(mappingDraft)
            .map((workspaceId) => ({
              workspaceId,
              path: String(mappingDraft[workspaceId] || '').trim(),
            }))
            .filter((item) => item.path !== '')
          const payload = await post('preferences', {
            mappings: list,
            defaultPath: defaultPathDraft.trim(),
          })
          setState((current) => ({ ...(current || {}), ...payload }))
          setShowMapping(false)
          setNotice(
            list.length === 0
              ? t('mappingCleared')
              : t('mappingSaved', { count: String(list.length) }),
          )
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      const saveCredential = async () => {
        setBusy('credential')
        setError('')
        setNotice('')
        try {
          const payload = await post('credential', {
            username: credential.username,
            token: credential.token,
          })
          setCredential((current) => ({ ...current, token: '' }))
          setNotice(
            [
              t('credentialSaved'),
              payload.acceptedMode ? t('acceptedMode', { mode: payload.acceptedMode }) : '',
              payload.tapdUser ? t('apiUserLabel', { user: payload.tapdUser }) : '',
            ]
              .filter(Boolean)
              .join('　'),
          )
          await refreshState()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      /** 一次性打印每种认证形态的探测结果，省得来回试。 */
      const diagnoseCredential = async () => {
        setBusy('diagnose')
        setError('')
        setNotice('')
        try {
          const payload = await post('credential/diagnose', {
            username: credential.username,
            token: credential.token,
          })
          const lines = (payload.attempts || []).map(
            (attempt) =>
              `${attempt.ok ? '✔' : '✘'} ${attempt.mode}${
                attempt.message ? `：${attempt.message}` : ''
              }`,
          )
          setError([t('diagnoseTitle'), ...lines].join('\n'))
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      const openSession = (sessionId) => {
        const uiWorkspace = props.ctxGet ? props.ctxGet('uiWorkspace') : undefined
        if (uiWorkspace && typeof uiWorkspace.openSession === 'function') {
          uiWorkspace.openSession(sessionId)
        }
      }

      /**
       * 算出某个项目「应该」用的目录，用于弹窗默认值。
       *
       * 与 Host 的 `resolveCwd` 保持同一优先级：项目映射 → 默认目录 → 空（交给 Host
       * 回落到当前工作区）。这里只负责给弹窗填默认值，最终仍以 Host 解析为准。
       *
       * @param {string} widgetProjectId TAPD 项目 ID
       */
      const suggestedDirectory = (widgetProjectId) => {
        const list = Array.isArray(state?.mappings) ? state.mappings : []
        const mapped = list.find((item) => item && item.workspaceId === widgetProjectId)
        if (mapped && typeof mapped.path === 'string' && mapped.path.trim() !== '') {
          return { path: mapped.path.trim(), source: 'mapping' }
        }
        if (typeof state?.defaultPath === 'string' && state.defaultPath.trim() !== '') {
          return { path: state.defaultPath.trim(), source: 'default' }
        }
        const effective =
          typeof state?.effectiveDirectory === 'string' ? state.effectiveDirectory.trim() : ''
        return { path: effective, source: effective === '' ? 'none' : 'current' }
      }

      /** 打开工作区确认弹窗。 */
      const openWorkspaceDialog = (mode) => {
        const suggestion = suggestedDirectory(projectId)
        setWorkspaceDialog({ mode, path: suggestion.path, source: suggestion.source })
      }

      /** 优先用弹窗里确认过的目录；取消则什么都不发。 */
      const confirmWorkspaceDialog = () => {
        if (!workspaceDialog) return
        const chosen = workspaceDialog.path.trim()
        const mode = workspaceDialog.mode
        setWorkspaceDialog(null)
        if (mode === 'analyze') runAnalyze(chosen)
        else runImplement(chosen)
      }

      const runAnalyze = async (cwd) => {
        if (!projectId) return
        setBusy('analyze')
        setError('')
        setNotice('')
        try {
          const payload = await post('analyze', {
            workspaceId: projectId,
            kind,
            ids: selectedIds,
            filters,
            // 空串表示「不指定」，交给 Host 按映射/默认目录解析。
            cwd: typeof cwd === 'string' && cwd.trim() !== '' ? cwd.trim() : undefined,
          })
          setNotice(
            t('analyzeStarted', { count: String(payload.count), cwd: payload.cwd }),
          )
          setResult(payload)
          setTransition(null)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      const runImplement = async (cwd) => {
        if (!projectId || selectedIds.length === 0) return
        setBusy('implement')
        setError('')
        setNotice('')
        try {
          const payload = await post('implement', {
            workspaceId: projectId,
            kind,
            ids: selectedIds,
            cwd: typeof cwd === 'string' && cwd.trim() !== '' ? cwd.trim() : undefined,
          })
          setNotice(t('implementStarted', { count: String(payload.count), cwd: payload.cwd }))
          setResult(payload)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      const runTransition = async () => {
        if (!projectId || selectedIds.length === 0 || !transition) return
        setBusy('transition')
        setError('')
        setNotice('')
        try {
          const payload = await post('transition', {
            workspaceId: projectId,
            kind,
            ids: selectedIds,
            status: transition.status,
            owner: transition.owner,
            comment: transition.comment,
          })
          setNotice(
            t('transitionDone', {
              ok: String(payload.succeeded),
              failed: String(payload.failed),
            }),
          )
          setTransition(null)
          await loadItems(projectId, filters, kind)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setBusy('')
        }
      }

      const connected = Boolean(state && state.configured)
      const allChecked = items.length > 0 && selectedIds.length === items.length
      const kindLabel = kind === 'bug' ? t('kindBug') : t('kindStory')

      /* 认证卡片 */
      const authCard = h(
        'div',
        { className: 'dsh-tapd-card dsh-tapd-stack' },
        h('div', { className: 'dsh-tapd-title', style: { fontSize: 13 } }, t('connectTitle')),
        h('div', { className: 'dsh-tapd-sub' }, t('connectHint')),
        h(
          'div',
          { className: 'dsh-tapd-row' },
          h(
            Field,
            { label: t('username') },
            h('input', {
              className: 'dsh-tapd-input',
              value: credential.username,
              placeholder: t('usernamePlaceholder'),
              onChange: (event) =>
                setCredential((current) => ({ ...current, username: event.target.value })),
            }),
          ),
          h(
            Field,
            { label: t('token') },
            h('input', {
              className: 'dsh-tapd-input',
              type: 'password',
              value: credential.token,
              placeholder: '********',
              onChange: (event) =>
                setCredential((current) => ({ ...current, token: event.target.value })),
              style: { minWidth: 220 },
            }),
          ),
          h(
            'button',
            {
              className: 'dsh-tapd-btn dsh-tapd-btn-primary',
              disabled: busy === 'credential',
              onClick: saveCredential,
              style: { alignSelf: 'flex-end' },
            },
            busy === 'credential' ? t('saving') : t('saveAndVerify'),
          ),
          h(
            'button',
            {
              className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
              disabled: busy === 'diagnose' || credential.token.trim() === '',
              onClick: diagnoseCredential,
              title: t('diagnoseHint'),
              style: { alignSelf: 'flex-end' },
            },
            busy === 'diagnose' ? t('working') : t('diagnose'),
          ),
        ),
        h('div', { className: 'dsh-tapd-sub' }, t('tokenStorageHint')),
      )

      /* 项目显示范围设置 */
      const scopeCard = showScope
        ? h(
            'div',
            { className: 'dsh-tapd-card dsh-tapd-stack' },
            h('div', { className: 'dsh-tapd-title', style: { fontSize: 13 } }, t('scopeTitle')),
            h('div', { className: 'dsh-tapd-sub' }, t('scopeHint')),
            h(
              'div',
              { className: 'dsh-tapd-row' },
              h(
                Field,
                { label: t('defaultKindLabel') },
                h(
                  'select',
                  {
                    className: 'dsh-tapd-select',
                    value: kindDraft,
                    onChange: (event) => setKindDraft(event.target.value),
                    style: { minWidth: 120 },
                  },
                  h('option', { value: 'story' }, t('kindStory')),
                  h('option', { value: 'bug' }, t('kindBug')),
                ),
              ),
              h('span', { className: 'dsh-tapd-sub' }, t('defaultKindHint')),
            ),
            h(
              'div',
              { className: 'dsh-tapd-row' },
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  onClick: () =>
                    setScopeDraft(
                      scopeDraft.length === allProjects.length
                        ? []
                        : allProjects.map((project) => project.id),
                    ),
                },
                scopeDraft.length === allProjects.length && allProjects.length > 0
                  ? t('clearAll')
                  : t('selectAll'),
              ),
              h('span', { className: 'dsh-tapd-count' }, t('scopeCount', {
                count: String(scopeDraft.filter(Boolean).length),
                total: String(allProjects.length),
              })),
              h('span', { className: 'dsh-tapd-grow' }),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-primary',
                  disabled: busy === 'scope',
                  onClick: saveScope,
                },
                busy === 'scope' ? t('working') : t('save'),
              ),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  onClick: () => setShowScope(false),
                },
                t('cancel'),
              ),
            ),
            h(
              'div',
              { className: 'dsh-tapd-grid' },
              allProjects.length === 0
                ? h('div', { className: 'dsh-tapd-sub' }, t('noProject'))
                : allProjects.map((project) =>
                    h(
                      'label',
                      { key: project.id, className: 'dsh-tapd-opt' },
                      h('input', {
                        className: 'dsh-tapd-check',
                        type: 'checkbox',
                        checked: scopeDraft.includes(project.id),
                        onChange: () => toggleScope(project.id),
                      }),
                      h('span', { title: `${project.name}（${project.id}）` }, project.name),
                    ),
                  ),
            ),
          )
        : null

      /* 项目 → 工作区目录映射 */
      const mappingProjects = (projects.length > 0 ? projects : allProjects).slice()
      const mappingCard = showMapping
        ? h(
            'div',
            { className: 'dsh-tapd-card dsh-tapd-stack' },
            h('div', { className: 'dsh-tapd-title', style: { fontSize: 13 } }, t('mappingTitle')),
            h('div', { className: 'dsh-tapd-sub' }, t('mappingHint')),
            h(
              'div',
              { className: 'dsh-tapd-map-list' },
              mappingProjects.length === 0
                ? h('div', { className: 'dsh-tapd-sub' }, t('noProject'))
                : mappingProjects.map((project) => {
                    const value =
                      mappingDraft[project.id] === undefined ? '' : mappingDraft[project.id]
                    return h(
                      'div',
                      { key: project.id, className: 'dsh-tapd-map-row' },
                      h(
                        'span',
                        {
                          className: 'dsh-tapd-map-name',
                          title: `${project.name}（${project.id}）`,
                        },
                        project.name,
                      ),
                      h('input', {
                        className: 'dsh-tapd-input dsh-tapd-map-path',
                        value,
                        placeholder: t('mappingEmpty'),
                        title: value,
                        onChange: (event) =>
                          setMappingDraft((current) => ({
                            ...current,
                            [project.id]: event.target.value,
                          })),
                      }),
                      h(
                        'button',
                        {
                          className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                          onClick: () => pickMappingDirectory(project.id),
                        },
                        t('chooseDirectory'),
                      ),
                      h(
                        'button',
                        {
                          className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                          disabled: value === '',
                          title: t('clear'),
                          onClick: () =>
                            setMappingDraft((current) => ({ ...current, [project.id]: '' })),
                        },
                        '✕',
                      ),
                    )
                  }),
            ),
            h(
              'div',
              { className: 'dsh-tapd-row' },
              h(
                Field,
                { label: t('defaultPathLabel') },
                h('input', {
                  className: 'dsh-tapd-input',
                  value: defaultPathDraft,
                  placeholder: t('defaultPathPlaceholder'),
                  style: { minWidth: 260 },
                  onChange: (event) => setDefaultPathDraft(event.target.value),
                }),
              ),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  onClick: pickDefaultPath,
                  style: { alignSelf: 'flex-end' },
                },
                t('chooseDirectory'),
              ),
              h('span', { className: 'dsh-tapd-grow' }),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-primary',
                  disabled: busy === 'mapping',
                  onClick: saveMapping,
                  style: { alignSelf: 'flex-end' },
                },
                busy === 'mapping' ? t('working') : t('save'),
              ),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  onClick: () => setShowMapping(false),
                  style: { alignSelf: 'flex-end' },
                },
                t('cancel'),
              ),
            ),
          )
        : null

      /** 当前 TAPD 身份，用于「只看我处理的」默认筛选与一键切换。 */
      const myName = state && typeof state.username === 'string' ? state.username.trim() : ''

      /** 当前项目在 TAPD 网页端的地址，供工具栏的「打开项目」用。 */
      const projectWebUrl = projectUrl(state && state.webBase, projectId)

      /* 工具栏 */
      const toolbar = h(
        'div',
        { className: 'dsh-tapd-card dsh-tapd-stack' },
        h(
          'div',
          { className: 'dsh-tapd-row' },
          h(KindSwitch, {
            kind,
            t,
            onChange: (next) => {
              setKind(next)
              setSelected([])
            },
          }),
          h('span', { className: 'dsh-tapd-grow' }),
          h(
            'button',
            {
              className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
              onClick: () => (showMapping ? setShowMapping(false) : openMapping()),
            },
            t('mappingButton'),
          ),
          h(
            'button',
            {
              className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
              onClick: () => setShowScope((current) => !current),
            },
            t('scopeButton'),
          ),
        ),
        h(
          'div',
          { className: 'dsh-tapd-row' },
          h(
            Field,
            { label: t('project') },
            h(
              'select',
              {
                className: 'dsh-tapd-select',
                value: projectId,
                onChange: (event) => setProjectId(event.target.value),
                style: { minWidth: 200 },
              },
              projects.length === 0 ? h('option', { value: '' }, t('noProject')) : null,
              projects.map((project) =>
                h('option', { key: project.id, value: project.id }, `${project.name}（${project.id}）`),
              ),
            ),
          ),
          projectWebUrl
            ? h(
                'a',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost dsh-tapd-link',
                  href: projectWebUrl,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  title: t('openProjectInTapd'),
                  style: { alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center' },
                },
                t('openProject'),
              )
            : null,
          h(
            Field,
            { label: t('manualProject') },
            h('input', {
              className: 'dsh-tapd-input',
              value: manualId,
              placeholder: t('manualProjectHint'),
              onChange: (event) => setManualId(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') applyManualId()
              },
              style: { minWidth: 110 },
            }),
          ),
          h(
            'button',
            {
              className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
              disabled: manualId.trim() === '',
              onClick: applyManualId,
              style: { alignSelf: 'flex-end' },
            },
            t('use'),
          ),
          h(
            Field,
            { label: t('filterStatus') },
            h(
              'select',
              {
                className: 'dsh-tapd-select',
                value: filters.status,
                onChange: (event) =>
                  setFilters((current) => ({ ...current, status: event.target.value })),
              },
              h('option', { value: '' }, t('any')),
              statuses.map((item) => h('option', { key: item.id, value: item.id }, item.label)),
            ),
          ),
          h(
            Field,
            { label: t('filterOwner') },
            h(
              'div',
              { className: 'dsh-tapd-row', style: { flexWrap: 'nowrap', gap: 4 } },
              h('input', {
                className: 'dsh-tapd-input',
                value: filters.owner,
                placeholder: t('any'),
                onChange: (event) =>
                  setFilters((current) => ({ ...current, owner: event.target.value })),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') loadItems(projectId, filters, kind)
                },
              }),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  disabled: !myName,
                  title: t('ownerSelfHint'),
                  onClick: () => {
                    // 一键在「只看自己」和「全部处理人」之间切换。
                    const next =
                      filters.owner.trim() === myName
                        ? { ...filters, owner: '' }
                        : { ...filters, owner: myName }
                    setFilters(next)
                    loadItems(projectId, next, kind)
                  },
                },
                filters.owner.trim() === myName && myName !== '' ? t('ownerAll') : t('ownerSelf'),
              ),
            ),
          ),
          h(
            Field,
            { label: t('filterKeyword') },
            h('input', {
              className: 'dsh-tapd-input',
              value: filters.keyword,
              placeholder: t('keywordHint'),
              onChange: (event) =>
                setFilters((current) => ({ ...current, keyword: event.target.value })),
              onKeyDown: (event) => {
                if (event.key === 'Enter') loadItems(projectId, filters, kind)
              },
            }),
          ),
          h(
            'button',
            {
              className: 'dsh-tapd-btn',
              disabled: loading || !projectId,
              onClick: () => loadItems(projectId, filters, kind),
              style: { alignSelf: 'flex-end' },
            },
            loading ? t('loading') : t('query'),
          ),
          h(
            'button',
            {
              className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
              disabled: loading,
              onClick: () => {
                const reset = { status: '', owner: '', keyword: '', iterationId: '' }
                setFilters(reset)
                loadItems(projectId, reset, kind)
              },
              style: { alignSelf: 'flex-end' },
            },
            t('reset'),
          ),
        ),
      )

      /* 列表 */
      const listRows = items.map((item) => {
        const url = itemUrl(item, state && state.webBase, kind, projectId)
        const priority = priorityView(item)
        return h(
          'div',
          { key: item.id, className: 'dsh-tapd-item' },
          h('input', {
            className: 'dsh-tapd-check',
            type: 'checkbox',
            checked: selectedIds.includes(item.id),
            onChange: () => toggle(item.id),
            'aria-label': item.name,
          }),
          h(
            'div',
            { className: 'dsh-tapd-item-main' },
            url
              ? h(
                  'a',
                  {
                    className: 'dsh-tapd-item-title dsh-tapd-link',
                    href: url,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    title: t('openInTapd'),
                  },
                  item.name || t('untitled'),
                )
              : h('div', { className: 'dsh-tapd-item-title' }, item.name || t('untitled')),
            h(
              'div',
              { className: 'dsh-tapd-item-meta' },
              url
                ? h(
                    'a',
                    {
                      className: 'dsh-tapd-mono dsh-tapd-link',
                      href: url,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      title: t('openInTapd'),
                    },
                    item.id,
                  )
                : h('span', { className: 'dsh-tapd-mono' }, item.id),
              h('span', { className: 'dsh-tapd-chip' }, item.statusLabel || item.status || '—'),
              h('span', null, `${t('ownerLabel')}：${item.owner || t('unassigned')}`),
              priority.text !== ''
                ? h(
                    'span',
                    null,
                    `${t('priorityLabel')}：`,
                    h(
                      'span',
                      {
                        // 有颜色就沿用 TAPD 的彩色文字样式；认不出的优先级保持素色。
                        className: priority.color ? 'dsh-tapd-priority' : undefined,
                        style: priority.color ? { color: priority.color } : undefined,
                        title: priority.color ? t('priorityFromTapd') : undefined,
                      },
                      priority.text,
                    ),
                  )
                : null,
              item.severity ? h('span', null, `${t('severityLabel')}：${item.severity}`) : null,
              h('span', null, `${t('modifiedLabel')}：${item.modified || '—'}`),
            ),
          ),
        )
      })

      const list = h(
        'div',
        { className: 'dsh-tapd-list' },
        items.length === 0
          ? h(
              'div',
              { className: 'dsh-tapd-empty' },
              loading ? t('loading') : connected ? t('emptyItems') : t('connectFirst'),
            )
          : listRows,
      )

      /* 结果提示 */
      const resultCard =
        result && result.sessionId
          ? h(
              'div',
              { className: 'dsh-tapd-card dsh-tapd-row' },
              h('span', { className: 'dsh-tapd-ok' }, `✔ ${t('sessionCreated')}`),
              h('span', { className: 'dsh-tapd-mono' }, result.sessionId),
              h('span', { className: 'dsh-tapd-sub' }, result.cwd),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn',
                  onClick: () => openSession(result.sessionId),
                },
                t('openSession'),
              ),
            )
          : null

      /* 流转表单 */
      const transitionCard = transition
        ? h(
            'div',
            { className: 'dsh-tapd-card dsh-tapd-stack' },
            h('div', { className: 'dsh-tapd-title', style: { fontSize: 13 } }, t('transitionTitle')),
            h(
              'div',
              { className: 'dsh-tapd-sub' },
              t('transitionHint', { count: String(selectedIds.length), kind: kindLabel }),
            ),
            h(
              'div',
              { className: 'dsh-tapd-row' },
              h(
                Field,
                { label: t('targetStatus') },
                h(
                  'select',
                  {
                    className: 'dsh-tapd-select',
                    value: transition.status,
                    onChange: (event) =>
                      setTransition((current) => ({ ...current, status: event.target.value })),
                  },
                  h('option', { value: '' }, t('keepUnchanged')),
                  statuses.map((item) => h('option', { key: item.id, value: item.id }, item.label)),
                ),
              ),
              h(
                Field,
                { label: t('targetOwner') },
                h('input', {
                  className: 'dsh-tapd-input',
                  value: transition.owner,
                  placeholder: t('keepUnchanged'),
                  onChange: (event) =>
                    setTransition((current) => ({ ...current, owner: event.target.value })),
                }),
              ),
              h(
                Field,
                { label: t('comment') },
                h('input', {
                  className: 'dsh-tapd-input',
                  value: transition.comment,
                  placeholder: t('commentHint'),
                  style: { minWidth: 240 },
                  onChange: (event) =>
                    setTransition((current) => ({ ...current, comment: event.target.value })),
                }),
              ),
            ),
            h(
              'div',
              { className: 'dsh-tapd-row' },
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-primary',
                  disabled: busy === 'transition' || selectedIds.length === 0,
                  onClick: runTransition,
                },
                busy === 'transition' ? t('working') : t('confirmTransition'),
              ),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  onClick: () => setTransition(null),
                },
                t('cancel'),
              ),
            ),
          )
        : null

      /* 开始处理前的工作区确认弹窗 */
      const workspaceDialogCard = workspaceDialog
        ? h(
            'div',
            { className: 'dsh-tapd-card dsh-tapd-stack dsh-tapd-dialog' },
            h(
              'div',
              { className: 'dsh-tapd-title', style: { fontSize: 13 } },
              workspaceDialog.mode === 'analyze' ? t('dialogAnalyzeTitle') : t('dialogImplementTitle'),
            ),
            h(
              'div',
              { className: 'dsh-tapd-sub' },
              workspaceDialog.mode === 'analyze'
                ? t('dialogAnalyzeHint', { count: String(selectedIds.length) })
                : t('dialogImplementHint', { count: String(selectedIds.length) }),
            ),
            h(
              'div',
              { className: 'dsh-tapd-row' },
              h(
                Field,
                { label: t('dialogWorkspaceLabel') },
                h('input', {
                  className: 'dsh-tapd-input',
                  value: workspaceDialog.path,
                  placeholder: t('dialogWorkspacePlaceholder'),
                  style: { minWidth: 320 },
                  onChange: (event) =>
                    setWorkspaceDialog((current) =>
                      current ? { ...current, path: event.target.value } : current,
                    ),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') confirmWorkspaceDialog()
                  },
                }),
              ),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  style: { alignSelf: 'flex-end' },
                  onClick: async () => {
                    const ui = props.ctxGet ? props.ctxGet('uiWorkspace') : undefined
                    if (!ui || typeof ui.pickDirectory !== 'function') {
                      setError(t('pickerUnavailable'))
                      return
                    }
                    try {
                      const chosen = await ui.pickDirectory()
                      if (typeof chosen === 'string' && chosen !== '') {
                        setWorkspaceDialog((current) =>
                          current ? { ...current, path: chosen, source: 'picked' } : current,
                        )
                      }
                    } catch (cause) {
                      setError(cause instanceof Error ? cause.message : String(cause))
                    }
                  },
                },
                t('chooseDirectory'),
              ),
            ),
            workspaceDialog.source === 'mapping'
              ? h('div', { className: 'dsh-tapd-sub' }, t('dialogFromMapping'))
              : workspaceDialog.source === 'default'
                ? h('div', { className: 'dsh-tapd-sub' }, t('dialogFromDefault'))
                : workspaceDialog.source === 'current'
                  ? h('div', { className: 'dsh-tapd-sub' }, t('dialogFromCurrent'))
                  : h(
                      'div',
                      { className: 'dsh-tapd-warn' },
                      t('dialogNoMapping'),
                    ),
            h(
              'div',
              { className: 'dsh-tapd-row' },
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-primary',
                  disabled: busy !== '',
                  onClick: confirmWorkspaceDialog,
                },
                busy === '' ? t('dialogConfirm') : t('working'),
              ),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  onClick: () => setWorkspaceDialog(null),
                },
                t('cancel'),
              ),
              h('span', { className: 'dsh-tapd-grow' }),
              h(
                'button',
                {
                  className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                  onClick: () => {
                    setWorkspaceDialog(null)
                    openMapping()
                  },
                },
                t('mappingConfigure'),
              ),
            ),
          )
        : null

      /* 底栏 */
      const bar = h(
        'div',
        { className: 'dsh-tapd-bar' },
        h(
          'button',
          {
            className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
            disabled: items.length === 0,
            onClick: () => setSelected(allChecked ? [] : items.map((item) => item.id)),
          },
          allChecked ? t('clearAll') : t('selectAll'),
        ),
        h(
          'span',
          { className: 'dsh-tapd-count' },
          t('selectedCount', { count: String(selectedIds.length), total: String(total) }),
        ),
        h('span', { className: 'dsh-tapd-grow' }),
        h(
          'button',
          {
            className: 'dsh-tapd-btn dsh-tapd-btn-primary',
            disabled: !connected || busy !== '' || !projectId,
            onClick: () => openWorkspaceDialog('analyze'),
          },
          busy === 'analyze' ? t('working') : t('analyze'),
        ),
        h(
          'button',
          {
            className: 'dsh-tapd-btn',
            disabled: !connected || busy !== '' || selectedIds.length === 0,
            onClick: () => openWorkspaceDialog('implement'),
          },
          busy === 'implement' ? t('working') : t('implement'),
        ),
        h(
          'button',
          {
            className: 'dsh-tapd-btn',
            disabled: !connected || busy !== '' || selectedIds.length === 0,
            onClick: () =>
              setTransition((current) => current ?? { status: '', owner: '', comment: '' }),
          },
          t('transition'),
        ),
      )

      return h(
        'div',
        { className: 'dsh-tapd' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'dsh-tapd-head' },
          h('span', { className: 'dsh-tapd-title' }, t('panelTitle')),
          h(
            'span',
            { className: 'dsh-tapd-sub' },
            connected ? t('connectedAs', { username: state.username || '—' }) : t('notConnected'),
          ),
          h('span', { className: 'dsh-tapd-grow' }),
          h(
            'button',
            { className: 'dsh-tapd-btn dsh-tapd-btn-ghost', onClick: refreshState, disabled: loading },
            t('refresh'),
          ),
          h(
            'button',
            { className: 'dsh-tapd-btn dsh-tapd-btn-ghost', onClick: () => props.close() },
            t('close'),
          ),
        ),
        h(
          'div',
          { className: 'dsh-tapd-body dsh-tapd-stack' },
          error ? h('div', { className: 'dsh-tapd-error' }, error) : null,
          notice ? h('div', { className: 'dsh-tapd-ok' }, notice) : null,
          !connected ? authCard : null,
          connected ? toolbar : null,
          connected && showScope ? scopeCard : null,
          connected && showMapping ? mappingCard : null,
          connected ? workspaceDialogCard : null,
          connected && state && state.effectiveDirectory
            ? h(
                'div',
                { className: 'dsh-tapd-sub' },
                t('targetDirectory', { path: state.effectiveDirectory }),
              )
            : null,
          connected ? list : null,
          resultCard,
          transitionCard,
          connected &&
          state &&
          state.defaultPath === '' &&
          Array.isArray(state.mappings) &&
          state.mappings.length === 0
            ? h(
                'div',
                { className: 'dsh-tapd-warn dsh-tapd-row' },
                h('span', null, t('noMappingHint')),
                h(
                  'button',
                  {
                    className: 'dsh-tapd-btn dsh-tapd-btn-ghost',
                    onClick: openMapping,
                  },
                  t('mappingConfigure'),
                ),
              )
            : null,
        ),
        connected ? bar : null,
      )
    }

    /* -------------------------------------------------------------- */
    /* 词典                                                            */
    /* -------------------------------------------------------------- */

    const zh = {
      panelTitle: 'TAPD',
      connectedAs: '已连接：{username}',
      notConnected: '未连接 TAPD',
      connectTitle: '连接 TAPD',
      connectHint: '个人访问令牌（TAPD「个人设置 → 个人访问令牌」）只需填令牌；企业 API 账号再填账号昵称。',
      tokenStorageHint: '令牌保存在本机凭据库（dsh-tapd/pat），不会写入配置文件，也不会回显。',
      username: '账号昵称（API 账号才需要）',
      usernamePlaceholder: '可留空',
      token: '访问令牌',
      saveAndVerify: '保存并验证',
      saving: '验证中…',
      credentialSaved: '令牌已保存并通过验证',
      acceptedMode: '生效传法：{mode}',
      apiUserLabel: 'TAPD 账号：{user}',
      diagnose: '诊断',
      diagnoseHint: '依次尝试三种令牌传法，回报 TAPD 的原始答复，不保存任何内容',
      diagnoseTitle: '三种传法的探测结果：',
      itemKind: '条目类型',
      kindStory: '需求',
      kindBug: '缺陷',
      project: 'TAPD 项目',
      noProject: '暂无项目',
      manualProject: '项目 ID',
      manualProjectHint: '如 10104801',
      use: '使用',
      scopeButton: '项目范围',
      openProject: '打开项目',
      openProjectInTapd: '在 TAPD 网页中打开当前项目',
      scopeTitle: '只显示哪些项目',
      scopeHint: '勾选的项目会出现在项目下拉框里；一个都不勾表示全部显示。这是纯展示偏好，不影响权限。',
      mappingButton: '工作区映射',
      mappingTitle: 'TAPD 项目 → 工作区目录',
      mappingHint:
        '一键分析或处理时，会话在哪建取决于这里的映射：优先看项目映射，其次是默认目录，都没配就落在当前工作区。留空表示该项目不单独映射。',
      mappingEmpty: '未映射（留空即用默认目录）',
      mappingConfigure: '配置映射',
      chooseDirectory: '选择…',
      clear: '清空',
      defaultPathLabel: '默认目录（未映射的项目用）',
      defaultPathPlaceholder: '留空则使用当前工作区',
      mappingSaved: '已保存 {count} 条项目映射',
      mappingCleared: '已清空项目映射，将使用默认目录或当前工作区',
      pickerUnavailable: '当前环境不支持目录选择器，可以直接手动输入绝对路径',
      dialogAnalyzeTitle: '确认分析用的工作区',
      dialogAnalyzeHint: '将在下面这个目录里新建分析会话，处理 {count} 条。',
      dialogImplementTitle: '确认处理用的工作区',
      dialogImplementHint: '将在下面这个目录里新建处理会话，处理 {count} 条。',
      dialogWorkspaceLabel: '工作区目录',
      dialogWorkspacePlaceholder: '留空则按映射或当前工作区',
      dialogConfirm: '开始',
      dialogFromMapping: '已按项目映射自动填充。',
      dialogFromDefault: '该项目没有单独映射，已填入默认目录。',
      dialogFromCurrent: '尚未配置映射，将使用当前工作区。',
      dialogNoMapping: '没有可用的目录：请填写一个绝对路径，或先在「工作区映射」里配置。',
      defaultKindLabel: '默认打开',
      defaultKindHint: '面板打开时先选中哪一类',
      scopeCount: '已选 {count} / 共 {total} 个',
      scopeSaved: '已保存：只显示选中的 {count} 个项目',
      scopeAllSaved: '已保存：显示全部项目',
      save: '保存',
      selectAll: '全选',
      clearAll: '取消全选',
      filterStatus: '状态',
      filterOwner: '处理人',
      filterKeyword: '标题关键词',
      keywordHint: '模糊匹配',
      any: '不限',
      query: '查询',
      reset: '重置',
      loading: '加载中…',
      refresh: '刷新',
      close: '关闭',
      emptyItems: '没有符合条件的条目',
      connectFirst: '先连接 TAPD 再查询',
      untitled: '（无标题）',
      openInTapd: '在 TAPD 网页中打开',
      ownerLabel: '处理人',
      priorityLabel: '优先级',
      priorityFromTapd: '配色与 TAPD 网页一致',
      ownerSelf: '只看我处理的',
      ownerAll: '全部处理人',
      ownerSelfHint: '在「只看我处理的」和「全部处理人」之间切换',
      severityLabel: '严重程度',
      modifiedLabel: '更新于',
      unassigned: '未指派',
      selectedCount: '已选 {count} / 共 {total} 条',
      analyze: '生成分析清单',
      implement: '开始处理',
      transition: '流转状态',
      working: '处理中…',
      analyzeStarted: '已在 {cwd} 新建分析会话（{count} 条），审核后再处理',
      implementStarted: '已在 {cwd} 新建处理会话（{count} 条）',
      transitionDone: '流转完成：成功 {ok} 条，失败 {failed} 条',
      transitionTitle: '批量流转',
      transitionHint: '将对已选的 {count} 条{kind}执行；留空的字段不修改。',
      targetStatus: '目标状态',
      targetOwner: '指派给',
      comment: '追加评论',
      commentHint: '写在 TAPD 对应条目下',
      keepUnchanged: '保持不变',
      confirmTransition: '确认流转',
      cancel: '取消',
      sessionCreated: '会话已创建',
      openSession: '打开会话',
      noMappingHint:
        '尚未配置 TAPD 项目到工作区的映射，将使用当前工作区；可在插件配置的 mappings 中指定。',
      targetDirectory: '分析会话将创建在：{path}',
    }

    const en = {
      panelTitle: 'TAPD',
      connectedAs: 'Connected as {username}',
      notConnected: 'TAPD not connected',
      connectTitle: 'Connect TAPD',
      connectHint:
        'A personal access token (TAPD → personal settings) needs only the token; an enterprise API account also needs its nick.',
      tokenStorageHint:
        'The token is stored in the local credential store (dsh-tapd/pat), never in configuration and never echoed back.',
      username: 'Account nick (API account only)',
      usernamePlaceholder: 'May be left blank',
      token: 'Access token',
      saveAndVerify: 'Save and verify',
      saving: 'Verifying…',
      credentialSaved: 'Token saved and verified',
      acceptedMode: 'Working scheme: {mode}',
      apiUserLabel: 'TAPD account: {user}',
      diagnose: 'Diagnose',
      diagnoseHint: 'Try all three token schemes and report TAPD raw replies; nothing is saved',
      diagnoseTitle: 'Probe results for the three schemes:',
      itemKind: 'Item type',
      kindStory: 'Stories',
      kindBug: 'Bugs',
      project: 'TAPD project',
      noProject: 'No projects',
      manualProject: 'Project ID',
      manualProjectHint: 'e.g. 10104801',
      use: 'Use',
      scopeButton: 'Project scope',
      openProject: 'Open project',
      openProjectInTapd: 'Open the current project in TAPD',
      scopeTitle: 'Show only these projects',
      scopeHint:
        'Checked projects appear in the project picker; checking none shows all. Display-only preference.',
      mappingButton: 'Workspace mapping',
      mappingTitle: 'TAPD project → workspace directory',
      mappingHint:
        'Where an analysis or implementation session opens: a per-project mapping wins, then the default directory, otherwise the current workspace. Leave a path blank to skip that project.',
      mappingEmpty: 'Not mapped (blank uses the default directory)',
      mappingConfigure: 'Configure mapping',
      chooseDirectory: 'Choose…',
      clear: 'Clear',
      defaultPathLabel: 'Default directory (for unmapped projects)',
      defaultPathPlaceholder: 'Blank uses the current workspace',
      mappingSaved: 'Saved {count} project mapping(s)',
      mappingCleared: 'Project mappings cleared; the default directory or current workspace is used',
      pickerUnavailable:
        'This environment has no directory picker; type an absolute path instead',
      dialogAnalyzeTitle: 'Confirm the workspace for analysis',
      dialogAnalyzeHint: 'A new analysis session for {count} item(s) opens in this directory.',
      dialogImplementTitle: 'Confirm the workspace for implementation',
      dialogImplementHint: 'A new implementation session for {count} item(s) opens in this directory.',
      dialogWorkspaceLabel: 'Workspace directory',
      dialogWorkspacePlaceholder: 'Blank uses the mapping or the current workspace',
      dialogConfirm: 'Start',
      dialogFromMapping: 'Filled from the project mapping.',
      dialogFromDefault: 'This project has no mapping; the default directory is used.',
      dialogFromCurrent: 'No mapping configured yet; the current workspace is used.',
      dialogNoMapping:
        'No directory available: type an absolute path, or configure one under Workspace mapping.',
      defaultKindLabel: 'Opens on',
      defaultKindHint: 'Which kind the panel selects first',
      scopeCount: '{count} of {total} selected',
      scopeSaved: 'Saved: showing {count} selected project(s)',
      scopeAllSaved: 'Saved: showing all projects',
      save: 'Save',
      selectAll: 'Select all',
      clearAll: 'Clear all',
      filterStatus: 'Status',
      filterOwner: 'Owner',
      filterKeyword: 'Title contains',
      keywordHint: 'Fuzzy match',
      any: 'Any',
      query: 'Query',
      reset: 'Reset',
      loading: 'Loading…',
      refresh: 'Refresh',
      close: 'Close',
      emptyItems: 'No matching items',
      connectFirst: 'Connect TAPD before querying',
      untitled: '(untitled)',
      openInTapd: 'Open in TAPD',
      ownerLabel: 'Owner',
      priorityLabel: 'Priority',
      priorityFromTapd: 'Same colours as the TAPD web UI',
      ownerSelf: 'Assigned to me',
      ownerAll: 'All assignees',
      ownerSelfHint: 'Toggle between items assigned to me and all assignees',
      severityLabel: 'Severity',
      modifiedLabel: 'Updated',
      unassigned: 'Unassigned',
      selectedCount: '{count} of {total} selected',
      analyze: 'Build analysis list',
      implement: 'Start work',
      transition: 'Change status',
      working: 'Working…',
      analyzeStarted: 'Started an analysis session in {cwd} for {count} item(s); review before continuing',
      implementStarted: 'Started a work session in {cwd} for {count} item(s)',
      transitionDone: 'Status update finished: {ok} succeeded, {failed} failed',
      transitionTitle: 'Batch transition',
      transitionHint: 'Applies to {count} selected {kind}; empty fields stay unchanged.',
      targetStatus: 'Target status',
      targetOwner: 'Assign to',
      comment: 'Add comment',
      commentHint: 'Posted on the matching TAPD item',
      keepUnchanged: 'Keep unchanged',
      confirmTransition: 'Apply',
      cancel: 'Cancel',
      sessionCreated: 'Session created',
      openSession: 'Open session',
      noMappingHint:
        'No TAPD project to workspace mapping is configured; the current workspace is used. Set mappings in the plugin configuration.',
      targetDirectory: 'Analysis sessions open in: {path}',
    }

    /* -------------------------------------------------------------- */
    /* 插件                                                            */
    /* -------------------------------------------------------------- */

    const NS = 'tapd'

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-tapd-connect: dictionaries')
      const t = ctx.locale.bind(NS)

      /** 面板内的转发能力：会话跳转与关闭面板都由宿主服务提供。 */
      const face = () => ({ t, ctxGet: (key) => ctx.get(key) })

      // 侧边栏图标：id 同时也是打开主面板时使用的 key。
      try {
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              label: () => t('panelTitle'),
            },
            TapdPanelIcon,
          ),
        )
      } catch (cause) {
        console.error('[dsh-tapd-connect] 无法注册侧边栏图标：', cause)
      }

      // 主面板：与图标 id 同名，侧边栏点击即打开。
      try {
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({
                ...face(),
                close: () => {
                  const layout = ctx.get('layout')
                  if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null)
                },
              }),
            },
            TapdPanel,
          ),
        )
      } catch (cause) {
        console.error('[dsh-tapd-connect] 无法注册 TAPD 面板：', cause)
      }
    }

    return { name: 'dsh-tapd-connect-client', inject: ['slots', 'locale'], apply }
  },
})

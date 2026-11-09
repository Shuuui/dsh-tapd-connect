# 更新插件（另一台电脑，git 安装）

远端最新提交：`a4b8a58`

---

## 先判断你那台机器是哪种"git 安装"

两种都叫 git 安装，但更新方式完全不同。在**那台电脑**的 Harness 里执行：

```powershell
# 看依赖是怎么声明的
type $env:USERPROFILE\.dsh\profiles\<你的profile>\package.json
```

找到 `dsh-tapd-connect` 这一行，看冒号后面：

| 声明形式 | 说明 | 走哪一节 |
|---|---|---|
| `link:D:\...\dsh-tapd` | 本地目录链接 | **方案 A** |
| `github:Shuuui/dsh-tapd-connect` | 直接指向仓库 | **方案 B** |

---

## 方案 A：`link:` / 本地目录（推荐，最省事）

插件目录就是一份 git clone，直接拉取即可。

```powershell
cd D:\dsh-plugins\dsh-tapd        # 换成你实际的位置
git pull
```

如果 pull 报 `schannel` 或 `ssh` 错误，是 git 自带 MSYS ssh 的问题，加一条全局配置：

```powershell
git config --global core.sshCommand "C:/WINDOWS/System32/OpenSSH/ssh.exe"
```

然后**重启 Harness**（见下方「为什么必须重启」）。

---

## 方案 B：`github:Shuuui/dsh-tapd-connect`

⚠️ **这种方式有个坑**：pnpm 的 lockfile 会把 github 依赖钉死在某个
commit 的 tarball 上，例如：

```
version: https://codeload.github.com/.../tar.gz/afe199397365acffcaa49b7301684fd60fcbb86b
```

所以**直接重新 install_bundle 很可能装回旧代码**，因为锁文件指向的还是老
commit。要更新必须先让锁文件重新解析。

### B-1 先试最简方式

```
plugin_manager: { action: "install_bundle", target: "github:Shuuui/dsh-tapd-connect" }
```

装完用下面的「确认版本」检查。**如果还停在旧版本，走 B-2。**

### B-2 强制重新解析（可靠）

```powershell
cd $env:USERPROFILE\.dsh\profiles\<你的profile>

# 1. 先备份，便于出问题回滚
Copy-Item package.json package.json.bak -Force
Copy-Item pnpm-lock.yaml pnpm-lock.yaml.bak -Force

# 2. 删掉 tapd 的锁条目，强制重新拉取
#    （用编辑器打开 pnpm-lock.yaml，搜索 dsh-tapd-connect，
#      删除 importers 下那两行 specifier/version，以及 packages 段
#      里对应的 @Shuuui/dsh-tapd-connect@... 整块）

# 3. 重新安装
pnpm install --no-frozen-lockfile
```

然后**重启 Harness**。

### B-3 更彻底：改成方案 A

长期看 B 方式的版本控制很别扭。建议改成 clone 到本地再安装：

```powershell
git clone git@github.com:Shuuui/dsh-tapd-connect.git D:\dsh-plugins\dsh-tapd
```

```
plugin_manager: { action: "install_bundle", target: "D:\\dsh-plugins\\dsh-tapd" }
```

之后更新就永远是 `cd D:\dsh-plugins\dsh-tapd; git pull` 一句，不用碰锁文件。

---

## 为什么必须重启

本次要更新的提交里，**`index.js`（Host 侧）有改动**：

| 提交 | 涉及文件 |
|---|---|
| `a4b8a58` 暗色按钮对比度 | client.js |
| `4aebd89` 暗色模式 | client.js |
| `6c9429b` 状态多选 | client.js **+ index.js** |

- `client.js`（客户端）→ 刷新页面即可
- `index.js`（Host）→ **必须重启 Harness**，进程不会重新加载已加载的模块

所以这次更新后请**重启**，再按 `Ctrl + Shift + R` 强刷页面。

---

## 确认版本

```powershell
cd D:\dsh-plugins\dsh-tapd
git log --oneline -1
```

期望输出开头是：

```
a4b8a58 fix: white-on-brand text invisible in dark theme
```

对上了就说明是最新版。

面板里也可以直观确认（这些是最近几轮才有的）：

- 状态筛选是**多选复选框**（不是单选下拉）
- 切到暗色主题后，**「缺陷/需求」选中态**和**「生成分析清单」按钮**上的文字清晰可见
- 列表**能用滚轮滚动**

三项都在，说明代码是新的。

---

## 更新后会丢什么

- **令牌**：存在 `~/.dsh/.credentials.yaml`（键 `dsh-tapd/pat`），不在插件目录里，
  `git pull` **不会**动它，更新后无需重新填。
- **配置**（项目范围、工作区映射、默认条目类型）：在 profile 的
  `cordis.patch.yml` 里，同样不受 `git pull` 影响。
- 但如果你走的是 B-2/B-3（重装插件），配置文件里 `tapd-connect` 那一行的
  `visibleProjects` / `mappings` 仍会保留——它们属于插件 config，不是依赖声明。

## 出问题怎么回滚

```powershell
cd D:\dsh-plugins\dsh-tapd
git log --oneline -5          # 找到之前的版本
git checkout <commit>         # 临时回到某个版本
# 或者
git reset --hard <commit>
```

B-2 动过 lockfile 的话，恢复备份：

```powershell
Copy-Item package.json.bak package.json -Force
Copy-Item pnpm-lock.yaml.bak pnpm-lock.yaml -Force
pnpm install
```

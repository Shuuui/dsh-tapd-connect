# 用 Git 分发与安装

比 zip 更好的地方：以后改完 `git push`，另一台机器 `git pull` 就能同步；
也能直接让 plugin_manager 从仓库地址安装。

## 一、把仓库推到一个你能访问的地方

本机已验证：GitHub 直连失败（`schannel: SEC_E_NO_CREDENTIALS`），所以下面几种按你的网络情况选一种。

### A. GitHub / Gitee / 自建 Git（推荐，能长期同步）

在有网络的环境里创建空仓库，然后推送：

```powershell
cd <插件仓库目录>

git remote add origin https://github.com/<你的账号>/dsh-tapd-connect.git
git push -u origin main
```

如果这台机器连不上，可以在**能上网的机器**上：

```powershell
git clone --bare . dsh-tapd-connect.git   # 在本机做成裸库
# 把 dsh-tapd-connect.git 整个目录拷到能上网的机器，再：
#   git clone --bare dsh-tapd-connect.git repo.git
#   cd repo.git && git push --mirror https://github.com/<账号>/dsh-tapd-connect.git
```

或者用 U 盘把 `.git` 目录一起拷过去再推。

### B. 私有仓库要注意

插件只含代码，**不含令牌**（`.gitignore` 已排除凭据类文件）。
但如果你之后把机器相关的路径写进配置，建议仓库设为 **private**。

## 二、在另一台电脑安装

### 方式 1：让 plugin_manager 直接从仓库装（最省事）

```
plugin_manager: {
  action: "install_bundle",
  target: "github:<你的账号>/dsh-tapd-connect"
}
```

装完刷新页面，侧边栏出现 TAPD 图标。

### 方式 2：先 clone 再本地安装（便于以后改）

```powershell
git clone https://github.com/<你的账号>/dsh-tapd-connect.git D:\dsh-plugins\dsh-tapd
```

然后：

```
plugin_manager: {
  action: "install_bundle",
  target: "D:\\dsh-plugins\\dsh-tapd"
}
```

`link:` 方式安装，之后 `git pull` 更新代码、重启 Harness 即可生效。

## 三、首次使用

插件**不携带凭据**，新机器必须重新填一次令牌：

1. 打开侧边栏 TAPD 面板
2. 粘贴个人访问令牌（TAPD → 个人设置 → 个人访问令牌）
3. 点「保存并验证」

项目范围、工作区映射也需重配（面板里点「项目范围」「工作区映射」即可，不必改 YAML）。

## 四、日常更新流程

在开发机：

```powershell
cd <插件仓库目录>
git add -A
git commit -m "fix: ..."
git push
```

在另一台机器：

```powershell
cd D:\dsh-plugins\dsh-tapd
git pull
```

然后**重启 Harness**（Host 侧改动需要重启；只改 client.js 刷新页面即可）。

## 五、版本发布（可选）

打 tag 便于回滚：

```powershell
git tag -a v0.1.0 -m "v0.1.0"
git push --tags
```

另一台机器回到某个版本：

```powershell
git checkout v0.1.0
```

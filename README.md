# dsh-deepseek-account-balance

[![test](https://github.com/h2fe1/dsh-deepseek-account-balance/actions/workflows/test.yml/badge.svg)](https://github.com/h2fe1/dsh-deepseek-account-balance/actions/workflows/test.yml)

在 DSH 对话输入框下方、**上下文用量的右边**放一枚很小的余额标签，显示当前登录的 DeepSeek 账号余额：

```
[1 轮 114 步 · 216 tok/s] [12M tok · 缓存命中 99%] ◔ 19%  余额 ¥61.48
```

只显示余额本身，不占整条底栏，也不显示账号、更新时间等额外内容。悬停可看充值余额、赠送余额和最近更新时间；点击整枚标签立即刷新。字号、颜色与该行其他项一致（12px、tertiary、正常字重）。

## 数据来源

DSH 的 `deepseek-account` 服务已经把账号余额投影成页面可安全使用的数据；本插件直接走客户端 `account` Remote 的只读方法：

| 方法 | 用途 |
| --- | --- |
| `account.getState()` | 判断是否已登录（`credential-stored` / `signed-out`） |
| `account.getBalance(client)` | `normal_wallets`（充值余额）与 `bonus_wallets`（赠送余额） |

- 请求由 Host 携带登录凭证发往 Platform，**页面拿不到 token**，也没有新增任何 Host 路由或第三方接口。
- 只读，不会发起推理请求，也不会改动账号、额度或订阅。
- 金额按 Platform 的两小数规则显示；不足一分钱显示 `<¥0.01`（负数显示 `-¥0.01`），多币种用 ` + ` 连接。

## 安装

### 从 GitHub

在 DSH Web GUI 打开 **Plugins → 添加插件 → 安装第三方插件**，填仓库地址：

```
https://github.com/h2fe1/dsh-deepseek-account-balance
```

也可以让 Agent 或 CLI 安装：

```bash
dsh plugin --profile <你的 profile> add github:h2fe1/dsh-deepseek-account-balance
```

装好后进入任意会话，输入框下方上下文用量的右侧就会出现余额标签；页面可见时每 60 秒自动刷新一次，切回页面也会刷新。

### 本地开发

```bash
git clone https://github.com/h2fe1/dsh-deepseek-account-balance.git
dsh plugin --profile <你的 profile> add link:$PWD/dsh-deepseek-account-balance
```

## 显示规则

- 已登录：`余额 ¥61.48`；有赠送额度时只在悬停提示里显示 `赠送 ¥x.xx`。
- 未登录：`余额 —`，悬停提示去「设置 → 账号」登录。
- 查询失败：保留上一次金额并标红；悬停看具体错误，点一下重试。
- 账号切换或退出登录会在下一次刷新时反映。
- 语言跟随 DSH 的界面语言（中文 / English）。
- 只在有会话、显示上下文用量时出现；欢迎页不占用空间。

## 配置

无。插件不读取任何密钥，也不需要填写账号信息。

## 开发

```bash
node --test test/*.test.mjs
node --check index.js && node --check client.js
```

- `index.js` — 宿主半：只保留 Loader 行，不注册路由。
- `client.js` — 浏览器半：`conversation.composer.dock` 里的余额标签、账号 Remote 读取与格式化。
- `locale/*.json` — 插件列表里的标题和描述。

## License

[MIT](LICENSE)

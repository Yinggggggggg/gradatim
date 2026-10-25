<p align="center"><img src="assets/images/icon.png" width="128" alt=""></p>

# Gradatim · 日日新

Gradatim 是拉丁语，意思是“一步一步地”。这个 App 帮你坚持“成长”本身：每天记下一件让自己变好的事，做什么都算；AI 会对照你以前的记录，用一两句话点出变化，每周日再写一份“这周的你”。

## 下载

安卓手机：到 [Releases](https://github.com/Yinggggggggg/gradatim/releases/latest) 下载 `Gradatim.apk`，在手机上打开安装（第一次要允许“安装未知应用”）。暂时只有安卓版。

记录只存在手机上。用云端 AI 时，相关记录会发给你自己选的 AI 服务商；用手机本地模型时（模型要先下载一次），AI 完全在手机上运行。登录和排行榜用的是作者搭的服务器，只上传昵称、累计天数和主页头像。

## 开发

```bash
npm install
npx expo start          # 手机上用 Expo Go 扫码；网页预览在 http://localhost:8081
npx tsc --noEmit        # 类型检查
npx eslint src          # 代码规范检查
```

Expo Go 里跑不了手机本地模型（需要原生模块），其余功能都能用。

“今天”页的圣杯用 Skia 绘制。网页预览要从 `public/canvaskit.wasm` 加载 Skia 的 WebAssembly 文件，升级 `@shopify/react-native-skia` 之后重新复制一份：

```bash
cp node_modules/canvaskit-wasm/bin/full/canvaskit.wasm public/
```

## 打包安卓安装包

```bash
./scripts/setup-android.sh      # 第一次：JDK 17 和安卓命令行工具，装在 ~/Library/Android
~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager --licenses   # 第一次：阅读并同意安卓 SDK 许可
./scripts/build-android.sh      # 生成 Gradatim.apk
```

打出来的是 release 版。项目旁边有正式签名文件夹 `gradatim-signing`（或用 `GRADATIM_SIGNING_DIR` 指定）时，脚本会换成正式签名，并用安卓的签名轮换让之前调试签名的版本可以直接覆盖升级；没有的话是调试签名，只适合装在自己手机上。

## 开通账号和全服排行榜（Supabase）

账号用邮箱验证码登录，只用于排行榜；排行榜只上传昵称、累计天数和主页上的头像（头像放在 Supabase Storage 的公开存储桶 `avatars` 里，由 `supabase/leaderboard.sql` 创建）。每个账号有一个随机的 7 位数字 UID，显示在“我的”页的账号里。不开通的话，这两个功能不会出现，其余功能照常可用。

1. 在 [supabase.com](https://supabase.com) 注册，新建一个项目（地区选离你近的，比如 Tokyo 或 Seoul）。
2. 打开项目的 **SQL Editor**，把 `supabase/leaderboard.sql` 的全部内容贴进去，点 Run。会提示“包含破坏性操作”，那是函数里的 delete 语句，确认运行即可。
3. 接上自己的发信服务。Supabase 自带的发信只能发给项目成员自己的邮箱、每小时 2 封，而且不能改邮件模板（默认邮件里只有登录链接，没有验证码），所以必须换掉。用 [Resend](https://resend.com)：
   - 在 Resend 添加一个自己域名下的子域名（比如 `gradatim.你的域名`），按提示把 DNS 记录加到域名的 DNS 服务商，等它显示 Verified；
   - 在 Resend 的 **Settings → Integrations → Supabase** 里连接 Supabase，选项目、选域名、生成密钥、填发件人，它会自动配好 Supabase 的 SMTP。
4. 打开 **Authentication → Sign In / Providers → Email**，把 Email OTP length 设成 `6`（App 只认 6 位验证码，新项目默认是 8 位），Email OTP expiration 设成 `600`（10 分钟）。
5. 打开 **Authentication → Emails → Templates**，把 “Magic link or OTP” 和 “Confirm sign up” 两个模板改成发验证码（模板里要有 `{{ .Token }}`，不要放链接），比如：
   - 标题：`Gradatim 验证码：{{ .Token }}`
   - 正文：`<p>你的验证码是 <b>{{ .Token }}</b>，10 分钟内有效。不是你本人在登录的话，忽略这封邮件即可。</p>`
6. 打开 **Project Settings → API Keys**，把 Project URL 和 publishable key 按 `.env.example` 的格式写进项目根目录的 `.env`。
7. 重启开发服务器，或者重新打安装包（这两个值会被打进包里）。

### 国内访问：经自己的服务器中转

国内连不上 `*.supabase.co`。可以在一台国内能连上的境外服务器上，用 Caddy 把一个自己的域名原样转发给 Supabase，再把 `.env` 里的 `EXPO_PUBLIC_SUPABASE_URL` 换成这个域名。登录、排行榜和头像图片都会走这条路。

```
api.你的域名 {
	reverse_proxy https://你的项目.supabase.co {
		header_up Host {upstream_hostport}
	}
}
```

域名的 DNS 记录指向这台服务器，设成“仅 DNS”（不要经过 Cloudflare 代理，它在国内不稳定）。Caddy 会自动申请 HTTPS 证书。

## AI

在“我的 → AI”里选服务商：

- **Claude**：用官方 SDK 和结构化输出；Opus 和 Sonnet 开启了服务端拒答回退。
- **手机本地模型**：用 llama.rn 在手机上运行 Qwen3（标准 1.7B，约 1.1GB；轻量 0.6B，约 0.4GB）。模型在 App 里下载（ModelScope 或 Hugging Face），下载后会做 SHA-256 校验。不联网、不花钱，记录不离开手机。
- **DeepSeek、通义千问、智谱、Kimi、电脑上的 Ollama、自定义**：都走兼容 OpenAI 的接口，模型列表从服务商实时获取。

密钥存在系统的加密存储里；所有记录只存在手机上，可以在“我的 → 数据”里导出。

## 代码结构

| 位置 | 内容 |
| --- | --- |
| `src/app/` | 底部四个标签：今天（`index.tsx`）、成长（`growth/`，往期周报在里面）、排行（`board.tsx`）、我的（`settings/`，顶部是个人主页，下面每一项点进去是单独的页面） |
| `src/components/record-sheet.tsx` | 点“今天”页的 ＋ 弹出的记录面板 |
| `src/hooks/use-weekly-reports.ts` | 周报：读取、生成，周日 18 点后自动写这一周 |
| `src/lib/db.ts` | 本地数据库 |
| `src/lib/witness.ts` | 把记录交给 AI，写回应和周报 |
| `src/lib/relevance.ts` | 找出和新记录相关的旧记录 |
| `src/lib/ai/` | 各服务商的实现；`prompts.ts` 给云端模型，`local-prompts.ts` 给手机本地模型 |
| `src/lib/local-model.ts` | 本地模型的下载、校验和删除 |
| `src/lib/attachments.ts` | 记录里的图片：选图、拍照、压缩、存储 |
| `src/lib/cloud.ts` | 邮箱验证码登录、云端函数调用和头像文件存储（直接调 Supabase 的 REST 接口） |
| `src/lib/leaderboard.ts` | 加入、退出排行榜，同步天数、昵称和头像 |
| `src/lib/profile.ts` | 个人主页：昵称、箴言、目标、背景、头像，只存在手机上 |
| `src/lib/profile-images.ts` | 主页的头像和背景照片：裁剪压缩、存储、上传（`.web.ts` 是网页预览版） |
| `src/lib/grail.ts` | 圣杯进度：每 100 个成长日装满一杯 |
| `src/components/grail-hero-canvas.tsx` | “今天”页的大圣杯（Skia）：光芒、粒子、液面波动；当天第一条记录存下后落进一颗光点 |
| `src/components/grail.tsx` | “成长”页和“关于”里的小圣杯（SVG） |
| `src/lib/grail-memory.ts` | 记住光点已经为哪一天落过，不重复播放 |
| `supabase/leaderboard.sql` | 云端的表和函数，带防作弊校验 |
| `src/lib/reminders.ts` | 每晚提醒 |
| `scripts/render-icons.mjs` | 用 Skia 画应用图标、启动画面和网页图标，圣杯和“今天”页一致；改了圣杯样子后运行 `node scripts/render-icons.mjs` |
| `metro.config.js` | 让 Claude SDK 走 CommonJS 版本（避免开发模式下的循环引用报错），以及网页版 SQLite 需要的设置 |

## 许可证

[MIT](LICENSE)

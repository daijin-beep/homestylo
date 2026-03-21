# HomeStylo

买大件前，先放进你家看看。

HomeStylo 是一个面向中文家居决策场景的 AI 工具。用户可以上传自家空间照片，生成空间分析与尺寸校验结果，获得家具推荐，查看 AI 效果图，并继续做替换、三选一对比、购物清单和分享。

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS + Radix UI + shadcn 风格基础组件
- Supabase（Auth / Postgres / Storage）
- Cloudflare R2（图片资源存储）
- Anthropic Claude Vision（空间分析 / 热点识别）
- Replicate（深度估计 / 效果图生成）
- Vercel（部署）

## 环境变量

复制 `env.local.example` 为 `.env.local` 后，填写以下变量：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Replicate
REPLICATE_API_TOKEN=

# Cloudflare R2
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT=
R2_BUCKET_NAME=homestylo-assets
R2_PUBLIC_URL=
```

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 创建本地环境变量文件

```bash
cp .env.local.example .env.local
```

3. 填写 `.env.local` 中的实际密钥与服务地址

4. 启动开发环境

```bash
npm run dev
```

5. 常用检查命令

```bash
npm run lint
npm run build
npm run test
```

## 数据与任务卡

- `docs/DATABASE_SCHEMA.sql`：数据库结构说明
- `docs/PHASE_0_TASKS.md` ~ `docs/PHASE_3_TASKS.md`：阶段任务卡
- `supabase/migrations/`：增量迁移脚本

## 部署到 Vercel

1. 将仓库导入 Vercel
2. Framework Preset 选择 Next.js
3. 在 Vercel 项目设置中补齐 `.env.local.example` 里的全部环境变量
4. 确认构建命令为 `npm run build`
5. 点击 Deploy 完成首次部署

本仓库已包含 `vercel.json`，默认部署区域为 `hkg1`。

## 说明

- `.env.local` 不应提交到 git
- R2 公网访问请使用 `R2_PUBLIC_URL`
- 效果图、分享图与支付流程当前仍是 MVP 方案，后续可替换为正式商业化实现

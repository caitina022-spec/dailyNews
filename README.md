# 中国电信系统部新闻情报平台

面向华为中国电信系统部团队的新闻情报 MVP。第一版支持 RSS 新闻采集、规则/AI 分析、8 个栏目分类、新闻检索、详情研判、日报生成、人工编辑、保存和复制。

## 技术栈

- Next.js + React + TypeScript
- Tailwind CSS
- Node.js API Routes
- SQLite，本地 Demo 和轻量部署友好
- rss-parser
- OpenAI API 预留；未配置时自动使用规则分析

## 本地运行

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

打开 `http://localhost:3000`。

当前机器如果 Node.js 低于 Next.js 部署环境建议版本，请升级到 Node.js 18.17+ 后运行。`package.json` 使用 Next.js 13，部署到 Vercel、Node Server 或轻量云主机都可以。

## 环境变量

```bash
DATABASE_PATH=./data/intel.db
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
FETCH_LIMIT_PER_SOURCE=20
```

不填写 `OPENAI_API_KEY` 时，系统使用 `lib/rules.ts` 中的规则分析函数生成分类、摘要、标签、重要性、风险等级和日报建议。

## 页面

- `/` 首页 Dashboard
- `/news` 新闻列表与筛选
- `/news/[id]` 新闻详情研判
- `/daily` 日报生成、编辑、保存和复制
- `/daily/history` 历史日报
- `/settings/sources` 新闻源配置

## 数据库

启动 API 或运行 `npm run db:init` 会自动创建 SQLite 数据库：

- `news`
- `daily_reports`
- `sources`

默认新闻源来自 `config/sources.json`，首次初始化会导入 `sources` 表。之后可在网页 `/settings/sources` 中新增、删除、启用或停用。

## 使用流程

1. 进入首页，点击“手动抓取新闻”。
2. 在 `/news` 查看采集结果，按栏目、厂商、关键词、重要性、中国电信/华为/舆情等条件筛选。
3. 在新闻详情页检查分析结果，必要时调整是否纳入日报。
4. 进入 `/daily`，选择日期并生成日报。
5. 人工编辑日报内容，保存草稿或标记已审核。
6. 点击复制 Markdown 或纯文本，人工发送到工作群。
7. 发送后标记 `sent_manually`。

## 扩展建议

- 新增新闻源：在 `/settings/sources` 添加 RSS；或修改 `config/sources.json` 后重新初始化空库。
- 新增分类规则：编辑 `lib/rules.ts` 的 `rules`、`vendors`、风险词和机会判断。
- 接入真实大模型：配置 `OPENAI_API_KEY`，并根据团队口径调整 `tryOpenAiAnalysis` 的 system prompt。
- 增加指定网站爬虫：保留 `source_type=website` 配置，后续可在 `lib/fetcher.ts` 中按来源类型扩展。
- 增加企业微信推送：可在日报保存后扩展 webhook 模块，但 MVP 已按要求不自动推送。
- 增加登录权限：可后续接入 NextAuth 或企业 SSO；当前 MVP 不做登录。

## 部署说明

### Node Server

```bash
npm install
npm run build
npm run start
```

请确保部署目录可写入 `DATABASE_PATH` 指向的 SQLite 文件。

### Vercel

Vercel 的无服务器环境不适合长期写入本地 SQLite 文件。若部署到 Vercel，建议把 SQLite 换成 Turso、D1 或托管数据库。当前代码的数据访问集中在 `lib/db.ts`，迁移成本较低。

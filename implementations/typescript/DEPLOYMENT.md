# Cloudflare Pages 部署指南

## 🚀 自动部署设置

本项目使用 GitHub Actions 自动部署到 Cloudflare Pages，支持以下功能：

- ✅ 自动构建和部署
- ✅ PR 预览部署
- ✅ PWA 功能完整支持
- ✅ 构建状态通知

## 📋 前置准备

### 1. 获取 Cloudflare 凭据

#### 获取 Account ID

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 在右侧边栏找到 **Account ID**
3. 复制该 ID

#### 获取 API Token

1. 进入 [API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 **Create Token**
3. 选择 **Cloudflare Pages:Edit** 模板
4. 配置权限：
   - **Account** - 选择你的账户
   - **Zone Resources** - 包含所有区域（或选择特定域名）
   - **Page Resources** - 包含所有页面
5. 点击 **Continue to summary** 并创建 Token
6. **重要：立即复制 Token，只会显示一次**

### 2. 在 GitHub 设置 Secrets

1. 进入你的 GitHub 仓库
2. 点击 **Settings** > **Secrets and variables** > **Actions**
3. 点击 **New repository secret** 添加以下两个密钥：

```
CLOUDFLARE_API_TOKEN=你的API令牌
CLOUDFLARE_ACCOUNT_ID=你的账户ID
```

### 3. 在 Cloudflare 创建 Pages 项目

1. 进入 [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. 点击 **Create a project**
3. 选择 **Direct Upload**（不要连接 Git）
4. 项目名称：`fire-balance-typescript`
5. 创建项目（暂时为空）

## 🔄 部署流程

### 自动触发条件

部署会在以下情况自动触发：

1. **推送到主分支**

   ```bash
   git push origin main
   git push origin feat/typescript-implementation
   ```

2. **创建 Pull Request**
   - 自动创建预览部署
   - 在 PR 中自动添加预览链接评论

### 手动部署

如果需要手动触发部署：

1. 进入 GitHub 仓库的 **Actions** 标签
2. 选择 **Deploy TypeScript App to Cloudflare Pages** workflow
3. 点击 **Run workflow**

## 📊 部署过程

GitHub Actions 会执行以下步骤：

1. **📥 检出代码** - 获取最新代码
2. **📋 设置 Node.js** - 安装 Node.js 20
3. **📦 安装依赖** - 运行 `npm ci`
4. **🔍 代码检查** - 运行 ESLint（不阻塞部署）
5. **🧪 运行测试** - 执行测试套件（不阻塞部署）
6. **🏗️ 构建应用** - 使用 `npx vite build`
7. **✅ 构建验证** - 检查 PWA 文件完整性
8. **🚀 部署到 Cloudflare** - 上传到 Pages
9. **💬 添加评论** - 在 PR 中添加预览链接

## 🔗 访问链接

### 生产环境

- **主域名**: `https://fire-balance-typescript.pages.dev`
- **自定义域名**: 可以在 Cloudflare Pages 设置中添加

### 预览环境

每个 PR 都会生成唯一的预览链接，格式：

```
https://[commit-hash].fire-balance-typescript.pages.dev
```

## 🛠️ 本地测试部署构建

在推送前，可以本地测试构建：

```bash
# 构建并检查
npm run build:cf

# 或者分步执行
npm run build
npm run deploy:check

# 预览构建结果
npm run preview
```

## 📱 PWA 功能验证

部署后确认以下 PWA 功能：

- [ ] **安装按钮** - 在支持的浏览器中出现
- [ ] **离线访问** - 断网后仍可使用
- [ ] **Service Worker** - 检查开发者工具中的注册状态
- [ ] **Manifest** - 确认 `/manifest.json` 正确加载
- [ ] **图标** - 各尺寸图标正确显示

## 🐛 故障排除

### 构建失败

1. 检查 GitHub Actions 日志
2. 本地运行 `npm run build:cf` 复现问题
3. 检查 TypeScript 错误（部署使用 `npx vite build` 跳过 TS 检查）

### PWA 功能异常

1. 检查浏览器开发者工具的 Console 和 Application 标签
2. 确认 Service Worker 正确注册
3. 检查 Network 标签中的 manifest.json 请求

### 部署权限错误

1. 验证 Cloudflare API Token 和 Account ID
2. 确认 Token 权限包含 Cloudflare Pages:Edit
3. 检查项目名称是否正确（`fire-balance-typescript`）

## 📈 监控和分析

### Cloudflare Analytics

- 访问 Cloudflare Pages 项目仪表板
- 查看访问统计、性能指标
- 监控 Core Web Vitals

### GitHub Actions 历史

- 查看所有部署历史和日志
- 监控构建时间和成功率

## 🔒 安全配置

已配置的安全头：

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- 禁用不必要的权限（地理位置、摄像头等）

## 📝 更新和维护

### 依赖更新

定期更新依赖并测试：

```bash
npm update
npm run build:cf
```

### GitHub Actions 维护

- 定期更新 action 版本
- 监控安全公告
- 测试新功能

---

**问题反馈**: 如有部署问题，请创建 GitHub Issue 并提供详细的错误日志。

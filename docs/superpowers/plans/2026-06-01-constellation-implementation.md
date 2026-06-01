# Our Constellation 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 将单页星空记忆 HTML 改造为双人情侣共享记忆网站，支持 Supabase 认证、数据库持久化、图片上传

**架构：** 纯静态前端（Vercel 托管）+ Supabase（Auth + PostgreSQL + Storage），前端直连 Supabase SDK，无后端代码

**技术栈：** HTML/CSS/JS（原生）+ Supabase JS SDK v2 + Vercel

---

## 文件结构

```
/
├── index.html              # 主入口 HTML
├── vercel.json             # Vercel 部署配置
├── css/
│   └── style.css           # 所有样式（从原 HTML 提取并扩展）
├── js/
│   ├── supabase.js         # Supabase 客户端初始化 + 配置
│   ├── auth.js             # 认证 UI（登录/注册/邀请码）+ 逻辑
│   ├── storage.js          # 图片压缩 + Supabase Storage 上传
│   ├── memories.js         # 记忆 CRUD + Supabase 数据库操作
│   ├── starfield.js        # 背景星空 Canvas 动画
│   ├── ui.js               # 星星渲染、拍立得、弹窗、设置面板
│   └── app.js              # 应用初始化、视图切换、全局状态
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-06-01-constellation-website-design.md
        └── plans/
            └── this-file.md
```

---

### Task 1: Supabase 项目初始化（手动操作）

**说明：** 用户在 Supabase 后台创建项目并获取配置信息

- [ ] **Step 1: 创建 Supabase 项目**
  1. 打开 https://supabase.com 注册/登录
  2. 点击 "New project"
  3. 填写项目名：`our-constellation`
  4. 设置数据库密码（妥善保存）
  5. 选择离你最近的区域
  6. 等待项目创建完成（约 2 分钟）

- [ ] **Step 2: 获取 API 配置**
  1. 项目创建后进入 Settings → API
  2. 找到 `Project URL`（类似 `https://xxx.supabase.co`）
  3. 找到 `anon public` 密钥（不是 service_role 密钥）
  4. 记下这两个值，后续会用到

- [ ] **Step 3: 在 Supabase SQL 编辑器执行建表语句**
  1. 进入 SQL Editor → New Query
  2. 执行以下 SQL：

```sql
-- 开启 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 情侣配对表
CREATE TABLE couples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 情侣成员表
CREATE TABLE couple_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(couple_id, user_id)
);

-- 记忆表
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  story TEXT NOT NULL,
  date DATE NOT NULL,
  image_url TEXT,
  image_path TEXT,
  x FLOAT NOT NULL DEFAULT 50,
  y FLOAT NOT NULL DEFAULT 50,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 行级安全策略
ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- couples: 用户只能查看自己所在的 couple
CREATE POLICY "view_own_couple" ON couples
  FOR SELECT USING (
    id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

-- couples: 允许注册时创建
CREATE POLICY "insert_couple" ON couples
  FOR INSERT WITH CHECK (true);

-- couple_members: 查看自己的成员关系
CREATE POLICY "view_own_membership" ON couple_members
  FOR SELECT USING (user_id = auth.uid());

-- couple_members: 插入自己的成员关系
CREATE POLICY "insert_membership" ON couple_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- memories: 查看自己 couple 的记忆
CREATE POLICY "view_couple_memories" ON memories
  FOR SELECT USING (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

-- memories: 插入自己 couple 的记忆
CREATE POLICY "insert_couple_memory" ON memories
  FOR INSERT WITH CHECK (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

-- memories: 更新自己 couple 的记忆
CREATE POLICY "update_couple_memory" ON memories
  FOR UPDATE USING (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

-- memories: 删除自己 couple 的记忆
CREATE POLICY "delete_couple_memory" ON memories
  FOR DELETE USING (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );
```

- [ ] **Step 4: 创建 Storage 存储桶**
  1. Supabase 后台 → Storage → Create bucket
  2. Bucket 名称: `memory-images`
  3. 勾选 "Public bucket"（让图片可公开访问）
  4. 点击确认

- [ ] **Step 5: 设置 Storage 安全策略**
  1. 在 Storage → `memory-images` bucket → Policies
  2. 点击 "New Policy" → "Create a policy from scratch"
  3. 添加以下两条策略：

```sql
-- 允许登录用户查看图片
CREATE POLICY "view_memory_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'memory-images');

-- 允许登录用户上传图片
CREATE POLICY "upload_memory_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'memory-images' AND auth.role() = 'authenticated'
  );
```

---

### Task 2: 项目脚手架

**文件：**
- 创建: `D:/网站项目1/vercel.json`
- 创建: `D:/网站项目1/css/style.css`

- [ ] **Step 1: 创建 vercel.json**

```json
{
  "version": 2,
  "buildCommand": null,
  "outputDirectory": ".",
  "framework": null
}
```

- [ ] **Step 2: 创建 style.css**

提取原 HTML 中的样式并扩展，主题色使用原星空风格。使用 CSS 变量统一管理。

```css
:root {
  --bg-deep: #020408;
  --bg-mid: #090d16;
  --star-glow: #fef08a;
  --star-core: #fde047;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --card-bg: rgba(15, 23, 42, 0.9);
  --border-subtle: rgba(51, 65, 85, 0.6);
  --danger: #ef4444;
  --success: #22c55e;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: radial-gradient(circle at bottom, var(--bg-mid), var(--bg-deep));
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text-primary);
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* ===== 星星动画 ===== */
@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes memoryPulse {
  0%, 100% { box-shadow: 0 0 8px var(--star-glow), 0 0 15px rgba(254, 240, 138, 0.4); }
  50% { box-shadow: 0 0 18px var(--star-glow), 0 0 30px rgba(254, 240, 138, 0.8); }
}

@keyframes popIn {
  0% { transform: scale(0.8) rotate(-5deg) translateY(50px); opacity: 0; }
  100% { transform: scale(1) rotate(-1deg) translateY(0); opacity: 1; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== 图层 ===== */
#starfield { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
#constellation { position: absolute; inset: 0; z-index: 10; pointer-events: none; width: 100%; height: 100%; }
#starsContainer { position: absolute; inset: 0; z-index: 20; }

/* ===== 记忆星星 ===== */
.memory-star {
  position: absolute;
  width: 20px; height: 20px;
  background: var(--star-glow);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid rgba(255,255,255,0.8);
  z-index: 20;
  animation: memoryPulse 3s infinite ease-in-out;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transform: translate(-50%, -50%);
}
.memory-star:hover {
  transform: translate(-50%, -50%) scale(1.4);
  box-shadow: 0 0 25px #fff, 0 0 40px var(--star-core) !important;
}
.memory-star .dot {
  width: 6px; height: 6px;
  background: var(--star-core);
  border-radius: 50%;
}
.memory-star .tooltip {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(8px);
  padding: 6px 12px;
  border-radius: 10px;
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  width: 140px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.memory-star:hover .tooltip { opacity: 1; }
.memory-star .tooltip .title {
  font-size: 12px; font-weight: 600;
  color: var(--star-glow);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.memory-star .tooltip .date {
  font-size: 10px;
  color: var(--text-secondary);
  font-family: monospace;
  margin-top: 2px;
}

/* ===== 头部 ===== */
header {
  position: absolute;
  top: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  text-align: center;
  pointer-events: none;
}
header h1 {
  font-size: 28px;
  font-weight: 300;
  letter-spacing: 0.2em;
  color: #fef9c3;
  text-shadow: 0 2px 10px rgba(254, 240, 138, 0.3);
}
header p {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 8px;
  letter-spacing: 0.1em;
  font-family: monospace;
}

/* ===== 拍立得弹窗 ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  padding: 16px;
}
.modal-overlay.hidden { display: none; }

.polaroid-card {
  background: #fbfbfa;
  padding: 16px;
  padding-bottom: 24px;
  border-radius: 4px;
  width: 100%;
  max-width: 360px;
  border: 1px solid rgba(203, 213, 225, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
  position: relative;
}
.polaroid-card .photo-area {
  width: 100%;
  aspect-ratio: 1;
  background: #e2e8f0;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(203, 213, 225, 0.5);
  border-radius: 2px;
}
.polaroid-card .photo-area img {
  width: 100%; height: 100%;
  object-fit: cover;
}
.polaroid-card .photo-area .img-loader {
  position: absolute; inset: 0;
  background: #1e293b;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--text-secondary);
}
.polaroid-card .info {
  width: 100%;
  margin-top: 16px;
  padding: 0 8px;
  color: #334155;
}
.polaroid-card .info .header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.polaroid-card .info .header-row h2 {
  font-size: 18px;
  font-weight: 700;
  font-family: serif;
}
.polaroid-card .info .header-row .date {
  font-size: 11px;
  color: #64748b;
  font-family: monospace;
}
.polaroid-card .info hr {
  margin: 10px 0;
  border: none;
  border-top: 1px solid #e2e8f0;
}
.polaroid-card .info .story {
  font-size: 13px;
  line-height: 1.7;
  color: #475569;
  font-weight: 300;
  min-height: 60px;
  white-space: pre-line;
}
.polaroid-card .actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  width: 100%;
}
.polaroid-card .actions button {
  flex: 1;
  padding: 8px 0;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  color: var(--text-secondary);
}
.polaroid-card .actions button:hover {
  background: rgba(51, 65, 85, 0.1);
  color: var(--text-primary);
}
.polaroid-card .actions .btn-danger {
  color: var(--danger);
  border-color: rgba(239, 68, 68, 0.3);
}
.polaroid-card .actions .btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}
.polaroid-card .btn-close-top {
  position: absolute;
  top: 8px; right: 10px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  z-index: 2;
}
.polaroid-card .btn-close-top:hover { color: #334155; }

/* ===== 添加/编辑弹窗 ===== */
.form-modal {
  position: absolute;
  z-index: 40;
  background: var(--card-bg);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 20px;
  width: 320px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  transition: all 0.3s;
}
.form-modal.hidden { display: none; }
.form-modal h3 {
  color: var(--star-glow);
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
}
.form-modal .close-btn {
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
}
.form-modal .close-btn:hover { color: #fff; }
.form-modal .form-group {
  margin-bottom: 10px;
}
.form-modal .form-group label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.form-modal .form-group input,
.form-modal .form-group textarea {
  width: 100%;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #fff;
  outline: none;
}
.form-modal .form-group input:focus,
.form-modal .form-group textarea:focus {
  border-color: var(--star-core);
}
.form-modal .form-group textarea { resize: none; }
.form-modal .submit-btn {
  width: 100%;
  background: var(--star-core);
  border: none;
  color: #0f172a;
  font-weight: 600;
  padding: 10px 0;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.form-modal .submit-btn:hover { opacity: 0.85; }
.form-modal .file-input-wrapper {
  position: relative;
  overflow: hidden;
}
.form-modal .file-input-wrapper input[type="file"] {
  position: absolute; inset: 0;
  opacity: 0; cursor: pointer;
}
.form-modal .file-input-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px dashed var(--border-subtle);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.form-modal .file-input-label:hover {
  border-color: var(--star-core);
  color: var(--star-glow);
}
.form-modal .file-preview {
  width: 100%;
  max-height: 100px;
  object-fit: cover;
  border-radius: 6px;
  margin-top: 6px;
}

/* ===== 认证页面 ===== */
.auth-view {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: radial-gradient(circle at bottom, var(--bg-mid), var(--bg-deep));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.auth-view.hidden { display: none; }
.auth-card {
  width: 100%;
  max-width: 360px;
  padding: 32px 24px;
  background: var(--card-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  text-align: center;
  animation: fadeIn 0.5s ease-out;
}
.auth-card h1 {
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 0.15em;
  color: var(--star-glow);
  margin-bottom: 4px;
}
.auth-card p.subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 24px;
}
.auth-card .form-group {
  margin-bottom: 12px;
  text-align: left;
}
.auth-card .form-group label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
  display: block;
}
.auth-card .form-group input {
  width: 100%;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #fff;
  outline: none;
}
.auth-card .form-group input:focus {
  border-color: var(--star-core);
}
.auth-card .auth-btn {
  width: 100%;
  padding: 10px 0;
  background: var(--star-core);
  border: none;
  color: #0f172a;
  font-weight: 600;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;
}
.auth-card .auth-btn:hover { opacity: 0.85; }
.auth-card .auth-switch {
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-muted);
}
.auth-card .auth-switch a {
  color: var(--star-glow);
  cursor: pointer;
  text-decoration: none;
}
.auth-card .auth-switch a:hover { text-decoration: underline; }
.auth-card .auth-error {
  font-size: 12px;
  color: var(--danger);
  margin-bottom: 10px;
  min-height: 18px;
}
.auth-card .invite-info {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
  padding: 8px;
  background: rgba(254, 240, 138, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(254, 240, 138, 0.1);
}

/* ===== 设置面板 ===== */
.settings-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 35;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(8px);
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.settings-btn:hover {
  background: rgba(51, 65, 85, 0.8);
  color: #fff;
}
.settings-panel {
  position: absolute;
  top: 60px;
  right: 16px;
  z-index: 35;
  width: 260px;
  background: var(--card-bg);
  border: 1px solid var(--border-subtle);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.4);
  animation: fadeIn 0.2s ease-out;
}
.settings-panel.hidden { display: none; }
.settings-panel h3 {
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 12px;
}
.settings-panel .invite-box {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  text-align: center;
}
.settings-panel .invite-box .code {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: var(--star-glow);
  font-family: monospace;
}
.settings-panel .invite-box .label {
  font-size: 10px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.settings-panel .logout-btn {
  width: 100%;
  padding: 8px 0;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: transparent;
  color: var(--danger);
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.settings-panel .logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* ===== Loading ===== */
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at bottom, var(--bg-mid), var(--bg-deep));
}
.loading-overlay.hidden { display: none; }
.loading-spinner {
  width: 32px; height: 32px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--star-core);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== 通用 ===== */
.pointer-events-none { pointer-events: none; }
```

---

### Task 3: 创建 js/supabase.js

**文件：**
- 创建: `D:/网站项目1/js/supabase.js`

**职责：** 初始化 Supabase 客户端，暴露给全局使用

- [ ] **Step 1: 编写 js/supabase.js**

```javascript
// Supabase 配置 - 部署前替换为你的项目配置
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// 初始化 Supabase 客户端
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

// 暴露到全局
window.App = window.App || {};
window.App.supabase = supabaseClient;
```

---

### Task 4: 创建 js/starfield.js

**文件：**
- 创建: `D:/网站项目1/js/starfield.js`

**职责：** 提取原 HTML 中的 Canvas 背景星空动画

- [ ] **Step 1: 编写 js/starfield.js**

```javascript
window.App = window.App || {};

(function() {
  'use strict';

  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let bgStars = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initBgStars();
    // 触发连线重绘
    if (window.App.drawLines) window.App.drawLines();
  }

  function initBgStars() {
    bgStars = [];
    const count = Math.floor((canvas.width * canvas.height) / 8000);
    for (let i = 0; i < count; i++) {
      bgStars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        alpha: Math.random(),
        speed: 0.01 + Math.random() * 0.02
      });
    }
  }

  function animateStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    for (const star of bgStars) {
      star.alpha += star.speed;
      if (star.alpha > 1 || star.alpha < 0.2) star.speed = -star.speed;
      ctx.globalAlpha = Math.max(0.1, star.alpha);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(animateStars);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  animateStars();

  window.App.initStarfield = true;
})();
```

---

### Task 5: 创建 js/auth.js

**文件：**
- 创建: `D:/网站项目1/js/auth.js`

**职责：** 登录/注册视图渲染、表单提交、邀请码处理、退出登录

- [ ] **Step 1: 编写 js/auth.js**

```javascript
window.App = window.App || {};

(function() {
  'use strict';

  const { supabase } = window.App;

  // ===== 生成邀请码 =====
  function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ===== 渲染登录页 =====
  function showLogin() {
    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('authForm').innerHTML = `
      <div class="auth-card">
        <h1>OUR CONSTELLATION</h1>
        <p class="subtitle">登录到你们的星空</p>
        <div class="auth-error" id="authError"></div>
        <div class="form-group">
          <label>邮箱</label>
          <input type="email" id="loginEmail" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" id="loginPassword" placeholder="至少 6 位" autocomplete="current-password">
        </div>
        <button class="auth-btn" id="authSubmitBtn">登录</button>
        <div class="auth-switch">
          还没有账号？<a id="authToggle">注册新账号</a>
        </div>
      </div>
    `;
    document.getElementById('authToggle').addEventListener('click', showRegister);
    document.getElementById('authSubmitBtn').addEventListener('click', handleLogin);
    // 回车提交
    document.getElementById('loginPassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  // ===== 渲染注册页 =====
  function showRegister() {
    document.getElementById('authForm').innerHTML = `
      <div class="auth-card">
        <h1>OUR CONSTELLATION</h1>
        <p class="subtitle">创建你们的专属星空</p>
        <div class="auth-error" id="authError"></div>
        <div class="form-group">
          <label>邮箱</label>
          <input type="email" id="regEmail" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" id="regPassword" placeholder="至少 6 位" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label>邀请码（可选，加入另一半的星空）</label>
          <input type="text" id="regInvite" placeholder="6 位邀请码" maxlength="6" style="text-transform:uppercase;letter-spacing:0.3em;font-family:monospace">
        </div>
        <div class="invite-info">没有邀请码？注册后将自动创建新的星空并生成邀请码，分享给另一半即可加入。</div>
        <button class="auth-btn" id="authSubmitBtn">注册</button>
        <div class="auth-switch">
          已有账号？<a id="authToggle">登录</a>
        </div>
      </div>
    `;
    document.getElementById('authToggle').addEventListener('click', showLogin);
    document.getElementById('authSubmitBtn').addEventListener('click', handleRegister);
    document.getElementById('regPassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRegister();
    });
  }

  // ===== 处理登录 =====
  async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('authError');

    if (!email || !password) { errorEl.textContent = '请填写邮箱和密码'; return; }

    errorEl.textContent = '';
    const submitBtn = document.getElementById('authSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = '登录';

    if (error) {
      errorEl.textContent = error.message === 'Invalid login credentials'
        ? '邮箱或密码错误'
        : error.message;
    }
    // 登录成功后 auth state change 会自动触发进入主界面
  }

  // ===== 处理注册 =====
  async function handleRegister() {
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const inviteCode = document.getElementById('regInvite').value.trim().toUpperCase();
    const errorEl = document.getElementById('authError');

    if (!email || !password) { errorEl.textContent = '请填写邮箱和密码'; return; }
    if (password.length < 6) { errorEl.textContent = '密码至少 6 位'; return; }

    errorEl.textContent = '';
    const submitBtn = document.getElementById('authSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';

    // 1. 注册用户
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      submitBtn.disabled = false;
      submitBtn.textContent = '注册';
      errorEl.textContent = authError.message;
      return;
    }

    const userId = authData.user.id;

    if (inviteCode) {
      // 有邀请码 → 加入已有 couple
      const { data: couples, error: coupleError } = await supabase
        .from('couples')
        .select('id')
        .eq('invite_code', inviteCode)
        .limit(1);

      if (coupleError || !couples || couples.length === 0) {
        submitBtn.disabled = false;
        submitBtn.textContent = '注册';
        errorEl.textContent = '邀请码无效，请确认后重试';
        return;
      }

      const coupleId = couples[0].id;

      const { error: memberError } = await supabase
        .from('couple_members')
        .insert({ couple_id: coupleId, user_id: userId });

      if (memberError) {
        submitBtn.disabled = false;
        submitBtn.textContent = '注册';
        errorEl.textContent = '加入失败：' + memberError.message;
        return;
      }
    } else {
      // 没有邀请码 → 创建新 couple
      const code = generateInviteCode();

      const { data: coupleData, error: createError } = await supabase
        .from('couples')
        .insert({ invite_code: code })
        .select()
        .single();

      if (createError) {
        // 邀请码冲突才重试
        if (createError.message.includes('invite_code')) {
          const { data: coupleData2, error: createError2 } = await supabase
            .from('couples')
            .insert({ invite_code: generateInviteCode() })
            .select()
            .single();

          if (createError2) {
            submitBtn.disabled = false;
            submitBtn.textContent = '注册';
            errorEl.textContent = '创建失败：' + createError2.message;
            return;
          }

          await supabase.from('couple_members').insert({
            couple_id: coupleData2.id,
            user_id: userId
          });
          // 保存邀请码到内存
          window.App._currentInviteCode = code;
          window.App._currentCoupleId = coupleData2.id;
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = '注册';
          errorEl.textContent = '创建失败：' + createError.message;
          return;
        }
      } else {
        await supabase.from('couple_members').insert({
          couple_id: coupleData.id,
          user_id: userId
        });
        window.App._currentInviteCode = code;
        window.App._currentCoupleId = coupleData.id;
      }
    }

    submitBtn.disabled = false;
    submitBtn.textContent = '注册';
    // auth state change 会自动触发进入主界面
  }

  // ===== 退出登录 =====
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // ===== 获取当前用户的 couple_id =====
  async function getCoupleId(userId) {
    const { data, error } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.couple_id;
  }

  // ===== 获取邀请码 =====
  async function getInviteCode(coupleId) {
    const { data, error } = await supabase
      .from('couples')
      .select('invite_code')
      .eq('id', coupleId)
      .single();

    if (error || !data) return '------';
    return data.invite_code;
  }

  // ===== 暴露公共 API =====
  window.App.auth = {
    showLogin,
    showRegister,
    handleLogout,
    getCoupleId,
    getInviteCode,
    generateInviteCode
  };
})();
```

---

### Task 6: 创建 js/storage.js

**文件：**
- 创建: `D:/网站项目1/js/storage.js`

**职责：** 图片压缩 + 上传到 Supabase Storage

- [ ] **Step 1: 编写 js/storage.js**

```javascript
window.App = window.App || {};

(function() {
  'use strict';

  const { supabase } = window.App;

  /**
   * 压缩图片
   * @param {File} file - 原始文件
   * @param {number} maxWidth - 最大宽度
   * @param {number} quality - 压缩质量 0-1
   * @returns {Promise<Blob>} 压缩后的 Blob
   */
  function compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('压缩失败'));
          }, 'image/jpeg', quality);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
    });
  }

  /**
   * 上传图片到 Supabase Storage
   * @param {File} file - 原始文件
   * @param {string} coupleId - 情侣 ID
   * @returns {Promise<{url: string, path: string}>}
   */
  async function uploadImage(file, coupleId) {
    // 压缩
    const compressed = await compressImage(file);

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}-${random}.${ext}`;
    const filePath = `${coupleId}/${fileName}`;

    // 上传
    const { error: uploadError } = await supabase.storage
      .from('memory-images')
      .upload(filePath, compressed, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 获取公共 URL
    const { data: urlData } = supabase.storage
      .from('memory-images')
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, path: filePath };
  }

  // ===== 暴露公共 API =====
  window.App.storage = {
    compressImage,
    uploadImage
  };
})();
```

---

### Task 7: 创建 js/memories.js

**文件：**
- 创建: `D:/网站项目1/js/memories.js`

**职责：** 记忆的增删改查，排序

- [ ] **Step 1: 编写 js/memories.js**

```javascript
window.App = window.App || {};

(function() {
  'use strict';

  const { supabase } = window.App;

  /**
   * 获取某个 couple 的所有记忆
   */
  async function fetchMemories(coupleId) {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('couple_id', coupleId)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * 添加新记忆
   */
  async function addMemory(coupleId, userId, memory) {
    const { data, error } = await supabase
      .from('memories')
      .insert({
        couple_id: coupleId,
        created_by: userId,
        title: memory.title,
        story: memory.story,
        date: memory.date,
        image_url: memory.image_url || null,
        image_path: memory.image_path || null,
        x: memory.x,
        y: memory.y
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 更新记忆
   */
  async function updateMemory(memoryId, updates) {
    const { data, error } = await supabase
      .from('memories')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', memoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 删除记忆
   */
  async function deleteMemory(memoryId, imagePath) {
    // 如果有图片，先删除 storage 中的文件
    if (imagePath) {
      await supabase.storage
        .from('memory-images')
        .remove([imagePath])
        .catch(() => {}); // 忽略图片删除失败
    }

    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memoryId);

    if (error) throw error;
  }

  // ===== 暴露公共 API =====
  window.App.memories = {
    fetchMemories,
    addMemory,
    updateMemory,
    deleteMemory
  };
})();
```

---

### Task 8: 创建 js/ui.js

**文件：**
- 创建: `D:/网站项目1/js/ui.js`

**职责：** 渲染记忆星星、绘制星座连线、拍立得弹窗、添加/编辑表单、设置面板

- [ ] **Step 1: 编写 js/ui.js**

```javascript
window.App = window.App || {};

(function() {
  'use strict';

  let memories = [];
  let tempCoords = { x: 50, y: 50 };
  let editingMemoryId = null;
  let selectedFile = null;

  const starsContainer = document.getElementById('starsContainer');
  const svg = document.getElementById('constellation');

  // ===== 渲染记忆星星 =====
  function renderMemoryStars(memoriesData) {
    memories = memoriesData || [];
    starsContainer.innerHTML = '';

    memories.forEach((star) => {
      const starEl = document.createElement('div');
      starEl.className = 'memory-star';
      starEl.style.left = `${star.x}%`;
      starEl.style.top = `${star.y}%`;

      starEl.innerHTML = `
        <div class="tooltip">
          <div class="title">${star.title}</div>
          <div class="date">${star.date}</div>
        </div>
        <div class="dot"></div>
      `;

      starEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showPolaroid(star);
      });

      starsContainer.appendChild(starEl);
    });

    drawLines();
  }

  // ===== 绘制星座连线 =====
  function drawLines() {
    if (!svg) return;
    svg.innerHTML = '';
    if (memories.length < 2) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    let pathD = '';

    memories.forEach((star, index) => {
      const px = (star.x / 100) * width;
      const py = (star.y / 100) * height;
      if (index === 0) pathD += `M ${px} ${py}`;
      else pathD += ` L ${px} ${py}`;
    });

    // 主路径虚线
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', 'rgba(254, 240, 138, 0.45)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-dasharray', '5,5');
    svg.appendChild(path);

    // 背景微光
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', pathD);
    glow.setAttribute('stroke', 'rgba(234, 179, 8, 0.15)');
    glow.setAttribute('stroke-width', '6');
    glow.setAttribute('fill', 'none');
    svg.appendChild(glow);
  }

  // ===== 拍立得展示 =====
  function showPolaroid(star) {
    document.getElementById('polaroidTitle').textContent = star.title;
    document.getElementById('polaroidDate').textContent = star.date;
    document.getElementById('polaroidStory').textContent = star.story;

    const img = document.getElementById('polaroidImg');
    const loader = document.getElementById('imgLoader');

    if (star.image_url) {
      loader.classList.remove('hidden');
      img.src = star.image_url;
      img.onload = () => loader.classList.add('hidden');
      img.onerror = () => {
        loader.classList.add('hidden');
        img.src = '';
      };
    } else {
      loader.classList.add('hidden');
      img.src = '';
      img.parentElement.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:13px;">
          没有图片
        </div>
      `;
    }

    // 编辑按钮
    document.getElementById('btnEdit').onclick = () => {
      closePolaroid();
      showEditForm(star);
    };

    // 删除按钮
    document.getElementById('btnDelete').onclick = () => {
      if (confirm('确定要删除这颗记忆星星吗？')) {
        handleDelete(star);
      }
    };

    // 关闭按钮
    document.getElementById('btnClosePolaroid').onclick = closePolaroid;

    document.getElementById('polaroidModal').classList.remove('hidden');
  }

  function closePolaroid() {
    document.getElementById('polaroidModal').classList.add('hidden');
  }

  // ===== 添加记忆表单 =====
  function showAddForm(x, y) {
    editingMemoryId = null;
    selectedFile = null;
    tempCoords = { x, y };

    document.getElementById('formModalTitle').textContent = '标记新的印记';
    document.getElementById('starTitle').value = '';
    document.getElementById('starDate').value = '';
    document.getElementById('starStory').value = '';
    document.getElementById('filePreview').classList.add('hidden');
    document.getElementById('filePreview').src = '';

    document.getElementById('formModal').classList.remove('hidden');
    document.getElementById('starTitle').focus();
  }

  function showEditForm(star) {
    editingMemoryId = star.id;
    selectedFile = null;

    document.getElementById('formModalTitle').textContent = '编辑记忆';
    document.getElementById('starTitle').value = star.title;
    document.getElementById('starDate').value = star.date;
    document.getElementById('starStory').value = star.story;

    if (star.image_url) {
      document.getElementById('filePreview').src = star.image_url;
      document.getElementById('filePreview').classList.remove('hidden');
    } else {
      document.getElementById('filePreview').classList.add('hidden');
    }

    document.getElementById('formModal').classList.remove('hidden');
    document.getElementById('starTitle').focus();
  }

  function closeFormModal() {
    document.getElementById('formModal').classList.add('hidden');
    selectedFile = null;
    editingMemoryId = null;
  }

  // ===== 文件选择处理 =====
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    selectedFile = file;

    // 预览
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('filePreview').src = ev.target.result;
      document.getElementById('filePreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  // ===== 保存记忆 =====
  async function handleSave() {
    const title = document.getElementById('starTitle').value.trim();
    const date = document.getElementById('starDate').value;
    const story = document.getElementById('starStory').value.trim();

    if (!title || !date || !story) {
      alert('请填满信息哦，回忆不能空白～');
      return;
    }

    const userId = (await App.supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    const saveBtn = document.getElementById('formSubmitBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
      let imageUrl = null;
      let imagePath = null;

      // 如果有新图片，上传
      if (selectedFile) {
        const coupleId = await App.auth.getCoupleId(userId);
        if (coupleId) {
          const result = await App.storage.uploadImage(selectedFile, coupleId);
          imageUrl = result.url;
          imagePath = result.path;
        }
      }

      if (editingMemoryId) {
        // 编辑
        const updates = { title, date, story };
        if (imageUrl) {
          updates.image_url = imageUrl;
          updates.image_path = imagePath;
        }
        await App.memories.updateMemory(editingMemoryId, updates);
      } else {
        // 新增
        const coupleId = await App.auth.getCoupleId(userId);
        if (!coupleId) throw new Error('未找到情侣配对');

        await App.memories.addMemory(coupleId, userId, {
          title,
          date,
          story,
          image_url: imageUrl,
          image_path: imagePath,
          x: tempCoords.x,
          y: tempCoords.y
        });
      }

      closeFormModal();
      // 刷新星空
      await App.loadMemories();

    } catch (err) {
      alert('保存失败：' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = editingMemoryId ? '保存修改' : '凝聚星光';
    }
  }

  // ===== 删除记忆 =====
  async function handleDelete(star) {
    try {
      closePolaroid();
      await App.memories.deleteMemory(star.id, star.image_path);
      await App.loadMemories();
    } catch (err) {
      alert('删除失败：' + err.message);
    }
  }

  // ===== 设置面板 =====
  function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.toggle('hidden');
  }

  async function updateInviteCode() {
    const userId = (await App.supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    const coupleId = await App.auth.getCoupleId(userId);
    if (!coupleId) return;
    const code = await App.auth.getInviteCode(coupleId);
    document.getElementById('inviteCodeDisplay').textContent = code;
  }

  // ===== 暴露公共 API =====
  window.App.ui = {
    renderMemoryStars,
    drawLines,
    showAddForm,
    showEditForm,
    closeFormModal,
    closePolaroid,
    handleFileSelect,
    handleSave,
    toggleSettings,
    updateInviteCode
  };
})();
```

---

### Task 9: 创建 js/app.js

**文件：**
- 创建: `D:/网站项目1/js/app.js`

**职责：** 应用初始化、认证状态监听、视图切换、加载记忆

- [ ] **Step 1: 编写 js/app.js**

```javascript
window.App = window.App || {};

(function() {
  'use strict';

  const { supabase } = window.App;

  // ===== 加载记忆 =====
  async function loadMemories() {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    const coupleId = await App.auth.getCoupleId(userId);
    if (!coupleId) return;

    const memories = await App.memories.fetchMemories(coupleId);
    App.ui.renderMemoryStars(memories);

    // 更新邀请码
    await App.ui.updateInviteCode();
  }

  window.App.loadMemories = loadMemories;

  // ===== 进入主界面 =====
  async function enterMainView() {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.remove('hidden');

    try {
      await loadMemories();
    } catch (err) {
      console.error('加载记忆失败:', err);
    } finally {
      document.getElementById('loadingOverlay').classList.add('hidden');
    }
  }

  // ===== 监听认证状态 =====
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session) {
        enterMainView();
      }
    } else if (event === 'SIGNED_OUT') {
      document.getElementById('authView').classList.remove('hidden');
      document.getElementById('mainView').classList.add('hidden');
      App.auth.showLogin();
    }
  });

  // ===== 初始化 =====
  function init() {
    // 初始显示登录页
    App.auth.showLogin();

    // 点击空白 → 添加记忆
    document.getElementById('starsContainer').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      App.ui.showAddForm(x, y);
    });

    // 设置按钮
    document.getElementById('settingsBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      App.ui.toggleSettings();
    });

    // 点击外面关闭设置面板
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('settingsPanel');
      const btn = document.getElementById('settingsBtn');
      if (!panel.classList.contains('hidden') &&
          !panel.contains(e.target) &&
          !btn.contains(e.target)) {
        panel.classList.add('hidden');
      }
    });

    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('确定要退出登录吗？')) {
        App.auth.handleLogout();
      }
    });

    // 表单文件选择
    document.getElementById('starImage').addEventListener('change', App.ui.handleFileSelect);

    // 表单提交
    document.getElementById('formSubmitBtn').addEventListener('click', App.ui.handleSave);

    // 表单关闭
    document.getElementById('formCloseBtn').addEventListener('click', App.ui.closeFormModal);

    // 导出 drawLines 供 starfield.js 调用的重绘
    window.App.drawLines = App.ui.drawLines;

    console.log('✨ Our Constellation 已加载');
  }

  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

---

### Task 10: 重写 index.html

**文件：**
- 重写: `D:/网站项目1/index.html`

**职责：** 主入口 HTML，加载所有资源和视图

- [ ] **Step 1: 编写 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Our Constellation - 我们的星空记忆</title>
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <!-- Lucide 图标（按需） -->
  <script src="https://unpkg.com/lucide@latest" defer></script>
</head>
<body>
  <!-- Loading -->
  <div id="loadingOverlay" class="loading-overlay">
    <div class="loading-spinner"></div>
  </div>

  <!-- 认证视图 -->
  <div id="authView" class="auth-view">
    <div id="authForm"></div>
  </div>

  <!-- 主视图 -->
  <div id="mainView" class="hidden">
    <canvas id="starfield"></canvas>
    <svg id="constellation"></svg>
    <div id="starsContainer"></div>

    <header>
      <h1>OUR CONSTELLATION</h1>
      <p>点击空白处，在星空下种下一颗记忆星星</p>
    </header>

    <!-- 设置按钮 -->
    <button id="settingsBtn" class="settings-btn" title="设置">
      ⚙
    </button>

    <!-- 设置面板 -->
    <div id="settingsPanel" class="settings-panel hidden">
      <h3>星空设置</h3>
      <div class="invite-box">
        <div class="label">邀请另一半加入</div>
        <div class="code" id="inviteCodeDisplay">------</div>
      </div>
      <button id="logoutBtn" class="logout-btn">退出登录</button>
    </div>

    <!-- 添加/编辑表单弹窗 -->
    <div id="formModal" class="form-modal hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 id="formModalTitle">标记新的印记</h3>
        <button id="formCloseBtn" class="close-btn">✕</button>
      </div>
      <div class="form-group">
        <label>标题</label>
        <input type="text" id="starTitle" placeholder="例: 第一次旅行">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="starDate">
      </div>
      <div class="form-group">
        <label>故事</label>
        <textarea id="starStory" rows="3" placeholder="记录下这一刻..."></textarea>
      </div>
      <div class="form-group">
        <label>照片</label>
        <div class="file-input-wrapper">
          <div class="file-input-label">
            <span>📷</span> 选择照片
          </div>
          <input type="file" id="starImage" accept="image/*">
        </div>
        <img id="filePreview" class="file-preview hidden" alt="预览">
      </div>
      <button id="formSubmitBtn" class="submit-btn">凝聚星光</button>
    </div>

    <!-- 拍立得弹窗 -->
    <div id="polaroidModal" class="modal-overlay hidden">
      <div class="polaroid-card">
        <button id="btnClosePolaroid" class="btn-close-top">✕</button>
        <div class="photo-area">
          <img id="polaroidImg" alt="记忆照片">
          <div id="imgLoader" class="img-loader">
            <div style="width:24px;height:24px;border:2px solid rgba(255,255,255,0.2);border-top-color:#fde047;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:8px;"></div>
            <span style="font-size:11px;">加载中...</span>
          </div>
        </div>
        <div class="info">
          <div class="header-row">
            <h2 id="polaroidTitle"></h2>
            <span class="date" id="polaroidDate"></span>
          </div>
          <hr>
          <div class="story" id="polaroidStory"></div>
        </div>
        <div class="actions">
          <button id="btnEdit">编辑</button>
          <button id="btnDelete" class="btn-danger">删除</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Scripts -->
  <script src="js/supabase.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/memories.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/starfield.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

---

### Task 11: 配置与部署

**说明：** 配置 Supabase 项目信息并部署到 Vercel

- [ ] **Step 1: 替换 Supabase 配置**
  打开 `js/supabase.js`，将两处 `YOUR_` 开头的占位符替换为实际的 Supabase 项目 URL 和 anon key

- [ ] **Step 2: 本地测试**
  使用 VSCode Live Server 或直接打开 index.html（需处理 CORS）测试功能

- [ ] **Step 3: 推送到 GitHub**
```bash
cd D:/网站项目1
git init
git add .
git commit -m "feat: 初始化星空记忆网站"
```

- [ ] **Step 4: 部署到 Vercel**
  1. 打开 https://vercel.com 并登录（建议用 GitHub 账号）
  2. 点击 "Add New" → "Project"
  3. 导入 GitHub 仓库
  4. Framework Preset 选择 "Other"
  5. 点击 "Deploy"
  6. 部署完成后，Vercel 会生成一个 `xxx.vercel.app` 域名

- [ ] **Step 5: 验证**
  1. 打开 Vercel 生成的域名
  2. 用邮箱 A 注册 → 记录邀请码
  3. 在另一浏览器用邮箱 B 注册 → 输入邀请码
  4. 验证两人都能添加、编辑、删除记忆
  5. 验证图片上传功能

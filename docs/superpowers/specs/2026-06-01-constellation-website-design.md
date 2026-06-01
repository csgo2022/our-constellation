# Our Constellation — 真实网站设计文档

## 概述
将现有的"我们的星空记忆"单页 HTML 改造为双人情侣共享记忆网站，支持认证、数据持久化、图片上传、多端访问。

## 技术栈
- **前端**：原生 HTML/CSS/JS（保留现有星空交互效果）
- **认证 & 数据库**：Supabase (Auth + PostgreSQL + Storage)
- **部署**：Vercel

## 架构

```
用户浏览器 → Vercel（静态文件）→ Supabase SDK（直接调用）
                                  ├── Auth（邮箱登录）
                                  ├── Database（memories 表）
                                  └── Storage（memory-images 桶）
```

不写后端代码，前端通过 Supabase JS SDK 直连。

## 数据模型

### memories 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键，自动生成 |
| couple_id | uuid | 关联到 couples 表 |
| title | text | 记忆标题 |
| story | text | 故事内容 |
| date | date | 发生日期 |
| image_url | text | Supabase Storage 中的图片路径 |
| image_path | text | 存储桶文件路径 |
| x | float | 星星在星空中的 X 位置 (%) |
| y | float | 星星在星空中的 Y 位置 (%) |
| created_by | uuid | 创建者用户 ID |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 最后更新时间 |

### couples 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| invite_code | text | 6 位邀请码，唯一 |

### couple_members 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| couple_id | uuid | 关联 couples |
| user_id | uuid | 关联 auth.users |

## 认证流程
1. 用户 A 注册 → 自动创建 couple 和邀请码 → 进入星空页
2. 用户 B 注册 → 输入邀请码 → 加入同一 couple
3. 后续两人直接登录 → 自动进入各自的星空（同一数据）
4. 使用 Supabase Row Level Security (RLS) 确保只能看到自己 couple 的数据

## 图片处理
- 前端用 Canvas 压缩：最大宽度 800px，质量 0.8
- 上传到 Supabase Storage `memory-images` 桶
- 路径格式：`{couple_id}/{timestamp}-{filename}`

## 前端页面结构

| 页面/视图 | 说明 |
|-----------|------|
| 登录页 | 邮箱+密码登录，切换"注册"模式 |
| 注册页 | 邮箱+密码+邀请码（可选），带邀请码即加入已有 couple |
| 星空主页 | 现有星空交互，从 Supabase 读取/写入数据 |
| 添加记忆 | 现有弹窗 + 图片选择/压缩/上传 |
| 编辑记忆 | 点击星星 → 拍立得卡片 + 编辑按钮 → 修改弹窗 |
| 删除确认 | 拍立得卡片上删除按钮 → 确认弹窗 |
| 设置面板 | 齿轮图标 → 显示邀请码 + 退出登录 |

## 关键交互
- **登录判断**：未登录 → 显示登录页，已登录 → 直接进星空
- **数据加载**：登录后从 Supabase 加载该 couple 的所有记忆，渲染星星
- **实时更新**：添加/编辑/删除后立即刷新星空
- **退出登录**：清除本地 session，回到登录页

## 安全策略
- Supabase RLS：`couple_members` 表中包含当前用户的 couple_id 才能读写
- Storage RLS：只能上传/读取自己 couple 的文件
- 密码由 Supabase Auth 托管，不自行处理

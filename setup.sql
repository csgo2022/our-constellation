-- Our Constellation 数据库初始化 SQL
-- 在 Supabase SQL Editor 中粘贴并运行此文件

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

-- ===== 行级安全策略 =====

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

-- ===== Storage 安全策略 =====
-- 注意：以下两条在 Supabase Storage → memory-images bucket → Policies 中执行
-- 或者直接在 SQL Editor 中一起运行

CREATE POLICY "view_memory_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'memory-images');

CREATE POLICY "upload_memory_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'memory-images' AND auth.role() = 'authenticated'
  );

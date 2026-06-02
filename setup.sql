-- Our Constellation 数据库初始化 SQL
-- 可重复运行，不会因对象已存在而报错

-- 开启 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== 建表 =====

CREATE TABLE IF NOT EXISTS couples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS couple_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(couple_id, user_id)
);

CREATE TABLE IF NOT EXISTS memories (
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

-- couples
DROP POLICY IF EXISTS "view_own_couple" ON couples;
CREATE POLICY "view_own_couple" ON couples
  FOR SELECT USING (
    id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_couple" ON couples;
CREATE POLICY "insert_couple" ON couples
  FOR INSERT WITH CHECK (true);

-- couple_members
DROP POLICY IF EXISTS "view_own_membership" ON couple_members;
CREATE POLICY "view_own_membership" ON couple_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_membership" ON couple_members;
CREATE POLICY "insert_membership" ON couple_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- memories
DROP POLICY IF EXISTS "view_couple_memories" ON memories;
CREATE POLICY "view_couple_memories" ON memories
  FOR SELECT USING (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_couple_memory" ON memories;
CREATE POLICY "insert_couple_memory" ON memories
  FOR INSERT WITH CHECK (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_couple_memory" ON memories;
CREATE POLICY "update_couple_memory" ON memories
  FOR UPDATE USING (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_couple_memory" ON memories;
CREATE POLICY "delete_couple_memory" ON memories
  FOR DELETE USING (
    couple_id IN (SELECT couple_id FROM couple_members WHERE user_id = auth.uid())
  );

-- ===== Storage 安全策略 =====

DROP POLICY IF EXISTS "view_memory_images" ON storage.objects;
CREATE POLICY "view_memory_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'memory-images');

DROP POLICY IF EXISTS "upload_memory_images" ON storage.objects;
CREATE POLICY "upload_memory_images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'memory-images' AND auth.role() = 'authenticated'
  );

-- ===== RPC 函数（SECURITY DEFINER 绕过 RLS，确保客户端能写入） =====

CREATE OR REPLACE FUNCTION create_couple(invite_code TEXT)
RETURNS SETOF public.couples
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY INSERT INTO public.couples (invite_code) VALUES (invite_code) RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION join_couple(p_invite_code TEXT)
RETURNS SETOF public.couple_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_couple_id UUID;
BEGIN
  SELECT id INTO v_couple_id FROM public.couples WHERE invite_code = p_invite_code;
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION '无效的邀请码';
  END IF;
  RETURN QUERY INSERT INTO public.couple_members (couple_id, user_id) VALUES (v_couple_id, auth.uid()) RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION get_member_count(p_couple_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM public.couple_members WHERE couple_id = p_couple_id);
END;
$$;

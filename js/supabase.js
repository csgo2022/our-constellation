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

// Supabase 配置 - 部署前替换为你的项目配置
const SUPABASE_URL = 'https://ygpvedhuehcnnllttfxc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cRfjnwUaVjhlHfIpAxsVkg_BrrI4e0h';

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

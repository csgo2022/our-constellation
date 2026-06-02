// Supabase 配置
const SUPABASE_URL = 'https://ygpvedhuehcnnllttfxc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cRfjnwUaVjhlHfIpAxsVkg_BrrI4e0h';

// 初始化 Supabase 客户端 (仅用于 Auth 操作)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

// ===== 直连 REST API（绕过 supabase-js 内部请求卡住问题） =====

var cachedToken = null;

function setRestToken(token) {
  cachedToken = token;
}

function getRestUrl(path, query) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  if (query) {
    var parts = [];
    for (var key in query) {
      if (query.hasOwnProperty(key)) {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(query[key]));
      }
    }
    if (parts.length > 0) url += '?' + parts.join('&');
  }
  return url;
}

async function restFetch(method, path, query, body) {
  var headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  };
  if (cachedToken) {
    headers['Authorization'] = 'Bearer ' + cachedToken;
  }

  // 用 Prefer 让 INSERT/UPDATE/PATCH/DELETE 返回数据
  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    headers['Prefer'] = 'return=representation';
  }

  var url = getRestUrl(path, query);
  console.log('[restFetch]', method, url);

  // 10 秒超时
  var controller = new AbortController();
  var timeout = setTimeout(function() { controller.abort(); }, 10000);

  try {
    var response = await fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeout);

    var text = await response.text();
    var data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      return { data: null, error: data || { message: 'HTTP ' + response.status } };
    }
    return { data: data, error: null };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { data: null, error: { message: '请求超时' } };
    }
    return { data: null, error: { message: err.message || '网络错误' } };
  }
}

// 对外暴露的简化 API
var rest = {
  // 查询：rest.select('couple_members', { select: 'couple_id', user_id: 'eq.xxx', limit: '1' })
  select: function(table, params) {
    var query = {};
    if (params.select) query.select = params.select;
    if (params.limit) query.limit = params.limit;
    for (var key in params) {
      if (key !== 'select' && key !== 'limit' && key !== 'order' && key !== 'count') {
        query[key] = 'eq.' + params[key];
      }
    }
    if (params.order) query.order = params.order;
    return restFetch('GET', table, query);
  },

  // 插入：rest.insert('couples', { invite_code: 'ABC123' })
  insert: function(table, row) {
    return restFetch('POST', table, null, row);
  },

  // 更新：rest.update('memories', { id: 'eq.xxx' }, { title: '...' })
  update: function(table, filter, updates) {
    return restFetch('PATCH', table, filter, updates);
  },

  // 删除：rest.remove('memories', { id: 'eq.xxx' })
  remove: function(table, filter) {
    return restFetch('DELETE', table, filter);
  },

  // 上传文件
  upload: async function(bucket, filePath, blob, contentType) {
    var headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': contentType || 'image/jpeg'
    };
    if (cachedToken) headers['Authorization'] = 'Bearer ' + cachedToken;

    var url = SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + filePath;
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 30000);

    try {
      var response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: blob,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        var errText = await response.text();
        return { data: null, error: { message: errText || '上传失败' } };
      }
      var data = await response.json();
      return { data: data, error: null };
    } catch (e) {
      clearTimeout(timeout);
      return { data: null, error: { message: e.message || '上传失败' } };
    }
  },

  // 获取公开 URL
  getPublicUrl: function(bucket, filePath) {
    return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + filePath;
  }
};

// 暴露到全局
window.App = window.App || {};
window.App.supabase = supabaseClient;
window.App.rest = rest;
window.App.setRestToken = setRestToken;

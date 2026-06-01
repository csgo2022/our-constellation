window.App = window.App || {};

(function() {
  'use strict';

  var supabase = window.App.supabase;

  // 检查 couple 里有多少人
  async function getMemberCount(coupleId) {
    var result = await supabase
      .from('couple_members')
      .select('id', { count: 'exact' })
      .eq('couple_id', coupleId);
    return result.count || 0;
  }

  // 确保用户有 couple（创建或加入），带重试
  async function ensureCouple(userId) {
    var coupleId = await App.auth.getCoupleId(userId);
    if (coupleId) return coupleId;

    var pendingInvite = window.App._pendingInviteCode;

    if (pendingInvite) {
      var joinResult = await supabase
        .from('couples')
        .select('id')
        .eq('invite_code', pendingInvite)
        .limit(1);

      if (joinResult.data && joinResult.data.length > 0) {
        coupleId = joinResult.data[0].id;
        await safeInsert('couple_members', { couple_id: coupleId, user_id: userId });
      }
      window.App._pendingInviteCode = null;
    }

    if (!coupleId) {
      var code = App.auth.generateInviteCode();
      var coupleResult = await supabase
        .from('couples')
        .insert({ invite_code: code })
        .select()
        .single();

      if (coupleResult.error) {
        // 重试一次（邀请码冲突）
        if (coupleResult.error.message && coupleResult.error.message.includes('invite_code')) {
          code = App.auth.generateInviteCode();
          coupleResult = await supabase
            .from('couples')
            .insert({ invite_code: code })
            .select()
            .single();

          if (coupleResult.error) throw new Error('创建星空失败，请重试');
        } else {
          throw new Error('创建星空失败：' + coupleResult.error.message);
        }
      }

      coupleId = coupleResult.data.id;
      await safeInsert('couple_members', { couple_id: coupleId, user_id: userId });
    }

    return coupleId;
  }

  // 带重试的插入
  async function safeInsert(table, row, retries) {
    retries = retries || 3;
    for (var i = 0; i < retries; i++) {
      var result = await supabase.from(table).insert(row);
      if (!result.error) return;
      // 等待后重试
      await new Promise(function(r) { setTimeout(r, 1000); });
    }
    throw new Error('数据库写入失败，请检查网络后重试');
  }

  async function loadMemories() {
    var userResult = await supabase.auth.getUser();
    var userId = userResult.data.user ? userResult.data.user.id : null;
    if (!userId) throw new Error('未登录');

    var coupleId = await ensureCouple(userId);
    if (!coupleId) throw new Error('未能获取星空');

    var count = await getMemberCount(coupleId);

    if (count < 2) {
      showWaitingView(coupleId);
    } else {
      var memories = await App.memories.fetchMemories(coupleId);
      App.ui.renderMemoryStars(memories);
      showMainView();
      await App.ui.updateInviteCode();
    }
  }

  async function showWaitingView(coupleId) {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('waitingView').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.add('hidden');

    var code = await App.auth.getInviteCode(coupleId);
    document.getElementById('waitingInviteCode').textContent = code;
  }

  function showMainView() {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('waitingView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  window.App.loadMemories = loadMemories;

  async function enterMainView() {
    // 先隐藏登录页和等待页
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('waitingView').classList.add('hidden');
    document.getElementById('loadingOverlay').classList.remove('hidden');

    try {
      await loadMemories();
    } catch (err) {
      // 加载失败，显示错误信息并回到登录页
      alert('加载失败：' + (err.message || '未知错误'));
      document.getElementById('authView').classList.remove('hidden');
      document.getElementById('mainView').classList.add('hidden');
      document.getElementById('waitingView').classList.add('hidden');
      App.auth.showLogin();
    } finally {
      document.getElementById('loadingOverlay').classList.add('hidden');
    }
  }

  supabase.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session) {
        enterMainView();
      }
    } else if (event === 'SIGNED_OUT') {
      document.getElementById('authView').classList.remove('hidden');
      document.getElementById('waitingView').classList.add('hidden');
      document.getElementById('mainView').classList.add('hidden');
      App.auth.showLogin();
    }
  });

  function init() {
    App.auth.showLogin();

    document.getElementById('starsContainer').addEventListener('click', function(e) {
      var rect = e.currentTarget.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      App.ui.showAddForm(x, y);
    });

    document.getElementById('settingsBtn').addEventListener('click', function(e) {
      e.stopPropagation();
      App.ui.toggleSettings();
    });

    document.addEventListener('click', function(e) {
      var panel = document.getElementById('settingsPanel');
      var btn = document.getElementById('settingsBtn');
      if (!panel.classList.contains('hidden') &&
          !panel.contains(e.target) &&
          !btn.contains(e.target)) {
        panel.classList.add('hidden');
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', function() {
      if (confirm('确定要退出登录吗？')) {
        App.auth.handleLogout();
      }
    });

    document.getElementById('checkPartnerBtn').addEventListener('click', function() {
      document.getElementById('loadingOverlay').classList.remove('hidden');
      loadMemories().finally(function() {
        document.getElementById('loadingOverlay').classList.add('hidden');
      });
    });

    document.getElementById('waitingLogoutBtn').addEventListener('click', function() {
      App.auth.handleLogout();
    });

    document.getElementById('starImage').addEventListener('change', App.ui.handleFileSelect);
    document.getElementById('formSubmitBtn').addEventListener('click', App.ui.handleSave);
    document.getElementById('formCloseBtn').addEventListener('click', App.ui.closeFormModal);

    window.App.drawLines = App.ui.drawLines;

    console.log('Our Constellation 已加载');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

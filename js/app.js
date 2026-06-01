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

  // 确保用户有 couple（创建或加入）
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
        await supabase
          .from('couple_members')
          .insert({ couple_id: coupleId, user_id: userId });
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

      if (coupleResult.error) throw coupleResult.error;
      coupleId = coupleResult.data.id;

      await supabase
        .from('couple_members')
        .insert({ couple_id: coupleId, user_id: userId });
    }

    return coupleId;
  }

  async function loadMemories() {
    var userResult = await supabase.auth.getUser();
    var userId = userResult.data.user ? userResult.data.user.id : null;
    if (!userId) return;

    var coupleId = await ensureCouple(userId);
    if (!coupleId) return;

    var count = await getMemberCount(coupleId);

    if (count < 2) {
      // 一个人，显示等待伴侣页面
      showWaitingView(coupleId);
    } else {
      // 两个人，进入星空
      var memories = await App.memories.fetchMemories(coupleId);
      App.ui.renderMemoryStars(memories);
      showMainView();
      await App.ui.updateInviteCode();
    }
  }

  // 显示等待伴侣页面
  async function showWaitingView(coupleId) {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('waitingView').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.add('hidden');

    var code = await App.auth.getInviteCode(coupleId);
    document.getElementById('waitingInviteCode').textContent = code;
  }

  // 显示星空主页
  function showMainView() {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('waitingView').classList.add('hidden');
    document.getElementById('mainView').classList.remove('hidden');
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  window.App.loadMemories = loadMemories;

  async function enterMainView() {
    document.getElementById('loadingOverlay').classList.remove('hidden');

    try {
      await loadMemories();
    } catch (err) {
      console.error('加载记忆失败:', err);
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

    // 等待页：检查伴侣是否已加入
    document.getElementById('checkPartnerBtn').addEventListener('click', function() {
      document.getElementById('loadingOverlay').classList.remove('hidden');
      loadMemories().finally(function() {
        document.getElementById('loadingOverlay').classList.add('hidden');
      });
    });

    // 等待页：退出登录
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

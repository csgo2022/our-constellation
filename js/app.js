window.App = window.App || {};

(function() {
  'use strict';

  var rest = window.App.rest;
  var supabase = window.App.supabase;

  // 检查 couple 里有多少人
  async function getMemberCount(coupleId) {
    var result = await rest.select('couple_members', {
      select: 'id',
      couple_id: coupleId,
      count: 'exact'
    });
    return result.data ? result.data.length : 0;
  }

  // 确保用户有 couple（创建或加入）
  async function ensureCouple(userId) {
    console.log('[ensureCouple] 开始, userId=', userId);

    var coupleId = await App.auth.getCoupleId(userId);
    console.log('[ensureCouple] getCoupleId 返回:', coupleId);
    if (coupleId) return coupleId;

    var pendingInvite = window.App._pendingInviteCode;
    console.log('[ensureCouple] pendingInvite:', pendingInvite);

    if (pendingInvite) {
      console.log('[ensureCouple] 尝试加入已有星空...');
      var joinResult = await rest.select('couples', {
        select: 'id',
        invite_code: pendingInvite,
        limit: '1'
      });

      if (joinResult.data && joinResult.data.length > 0) {
        coupleId = joinResult.data[0].id;
        console.log('[ensureCouple] 找到 couple:', coupleId);
        await rest.insert('couple_members', { couple_id: coupleId, user_id: userId });
      }
      window.App._pendingInviteCode = null;
    }

    if (!coupleId) {
      var code = App.auth.generateInviteCode();
      console.log('[ensureCouple] 创建新星空, code:', code);

      var coupleResult = await rest.insert('couples', { invite_code: code });

      console.log('[ensureCouple] insert couples 结果:', coupleResult.error ? coupleResult.error.message : '成功');

      if (coupleResult.error) {
        if (coupleResult.error.message && coupleResult.error.message.includes('invite_code')) {
          code = App.auth.generateInviteCode();
          coupleResult = await rest.insert('couples', { invite_code: code });
          if (coupleResult.error) throw new Error('创建星空失败，请重试');
        } else {
          throw new Error('创建星空失败：' + coupleResult.error.message);
        }
      }

      coupleId = coupleResult.data[0].id;
      console.log('[ensureCouple] 新 coupleId:', coupleId);

      var memberResult = await rest.insert('couple_members', { couple_id: coupleId, user_id: userId });
      if (memberResult.error) throw new Error('加入星空失败：' + memberResult.error.message);
      console.log('[ensureCouple] 成员关系已创建');
    }

    return coupleId;
  }

  async function loadMemories(userId) {
    userId = userId || currentUserId;
    console.log('[loadMemories] 开始, userId=', userId);
    if (!userId) throw new Error('未登录');

    var coupleId = await ensureCouple(userId);
    if (!coupleId) throw new Error('未能获取星空');

    console.log('[loadMemories] coupleId:', coupleId);

    var count = await getMemberCount(coupleId);
    console.log('[loadMemories] 成员数:', count);

    if (count < 2) {
      showWaitingView(coupleId);
    } else {
      var memories = await App.memories.fetchMemories(coupleId);
      App.ui.renderMemoryStars(memories);
      showMainView();
      await App.ui.updateInviteCode();
    }
    console.log('[loadMemories] 完成');
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

  var currentUserId = null;

  async function enterMainView(userId) {
    currentUserId = userId;
    console.log('[enterMainView] 开始, userId=', userId);
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('waitingView').classList.add('hidden');
    document.getElementById('loadingOverlay').classList.remove('hidden');

    try {
      // 15 秒兜底超时
      await Promise.race([
        loadMemories(userId),
        new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('加载超时，请检查网络连接')); }, 15000);
        })
      ]);
    } catch (err) {
      console.error('[enterMainView] 失败:', err.message);
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
    console.log('[onAuthStateChange] event:', event, 'session:', !!session);
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session && session.user) {
        window.App.setRestToken(session.access_token);
        enterMainView(session.user.id);
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

    document.getElementById('checkPartnerBtn').addEventListener('click', async function() {
      document.getElementById('loadingOverlay').classList.remove('hidden');
      try {
        var session = await supabase.auth.getSession();
        var userId = session.data.session ? session.data.session.user.id : null;
        if (userId) {
          await loadMemories(userId);
        }
      } finally {
        document.getElementById('loadingOverlay').classList.add('hidden');
      }
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

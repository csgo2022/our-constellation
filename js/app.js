window.App = window.App || {};

(function() {
  'use strict';

  var supabase = window.App.supabase;

  async function loadMemories() {
    var userResult = await supabase.auth.getUser();
    var userId = userResult.data.user ? userResult.data.user.id : null;
    if (!userId) return;

    var coupleId = await App.auth.getCoupleId(userId);
    if (!coupleId) return;

    var memories = await App.memories.fetchMemories(coupleId);
    App.ui.renderMemoryStars(memories);
    await App.ui.updateInviteCode();
  }

  window.App.loadMemories = loadMemories;

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

  supabase.auth.onAuthStateChange(function(event, session) {
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

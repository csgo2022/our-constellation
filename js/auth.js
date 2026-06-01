window.App = window.App || {};

(function() {
  'use strict';

  const { supabase } = window.App;

  function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function showLogin() {
    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('authForm').innerHTML = `
      <div class="auth-card">
        <h1>OUR CONSTELLATION</h1>
        <p class="subtitle">登录到你们的星空</p>
        <div class="auth-error" id="authError"></div>
        <div class="form-group">
          <label>邮箱</label>
          <input type="email" id="loginEmail" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" id="loginPassword" placeholder="至少 6 位" autocomplete="current-password">
        </div>
        <button class="auth-btn" id="authSubmitBtn">登录</button>
        <div class="auth-switch">
          还没有账号？<a id="authToggle">注册新账号</a>
        </div>
      </div>
    `;
    document.getElementById('authToggle').addEventListener('click', showRegister);
    document.getElementById('authSubmitBtn').addEventListener('click', handleLogin);
    document.getElementById('loginPassword').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleLogin();
    });
  }

  function showRegister() {
    document.getElementById('authForm').innerHTML = `
      <div class="auth-card">
        <h1>OUR CONSTELLATION</h1>
        <p class="subtitle">创建你们的专属星空</p>
        <div class="auth-error" id="authError"></div>
        <div class="form-group">
          <label>邮箱</label>
          <input type="email" id="regEmail" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label>密码</label>
          <input type="password" id="regPassword" placeholder="至少 6 位" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label>邀请码（可选，加入另一半的星空）</label>
          <input type="text" id="regInvite" placeholder="6 位邀请码" maxlength="6" style="text-transform:uppercase;letter-spacing:0.3em;font-family:monospace">
        </div>
        <div class="invite-info">没有邀请码？注册后将自动创建新的星空并生成邀请码，分享给另一半即可加入。</div>
        <button class="auth-btn" id="authSubmitBtn">注册</button>
        <div class="auth-switch">
          已有账号？<a id="authToggle">登录</a>
        </div>
      </div>
    `;
    document.getElementById('authToggle').addEventListener('click', showLogin);
    document.getElementById('authSubmitBtn').addEventListener('click', handleRegister);
    document.getElementById('regPassword').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleRegister();
    });
  }

  async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('authError');

    if (!email || !password) { errorEl.textContent = '请填写邮箱和密码'; return; }

    errorEl.textContent = '';
    const submitBtn = document.getElementById('authSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = '登录';

    if (error) {
      errorEl.textContent = error.message === 'Invalid login credentials'
        ? '邮箱或密码错误'
        : error.message;
    }
  }

  async function handleRegister() {
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const inviteCode = document.getElementById('regInvite').value.trim().toUpperCase();
    const errorEl = document.getElementById('authError');

    if (!email || !password) { errorEl.textContent = '请填写邮箱和密码'; return; }
    if (password.length < 6) { errorEl.textContent = '密码至少 6 位'; return; }

    errorEl.textContent = '';
    const submitBtn = document.getElementById('authSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      submitBtn.disabled = false;
      submitBtn.textContent = '注册';
      errorEl.textContent = authError.message;
      return;
    }

    const userId = authData.user.id;

    if (inviteCode) {
      const { data: couples, error: coupleError } = await supabase
        .from('couples')
        .select('id')
        .eq('invite_code', inviteCode)
        .limit(1);

      if (coupleError || !couples || couples.length === 0) {
        submitBtn.disabled = false;
        submitBtn.textContent = '注册';
        errorEl.textContent = '邀请码无效，请确认后重试';
        return;
      }

      const coupleId = couples[0].id;

      const { error: memberError } = await supabase
        .from('couple_members')
        .insert({ couple_id: coupleId, user_id: userId });

      if (memberError) {
        submitBtn.disabled = false;
        submitBtn.textContent = '注册';
        errorEl.textContent = '加入失败：' + memberError.message;
        return;
      }
    } else {
      const code = generateInviteCode();

      const { data: coupleData, error: createError } = await supabase
        .from('couples')
        .insert({ invite_code: code })
        .select()
        .single();

      if (createError) {
        if (createError.message.includes('invite_code')) {
          const retryCode = generateInviteCode();
          const { data: coupleData2, error: createError2 } = await supabase
            .from('couples')
            .insert({ invite_code: retryCode })
            .select()
            .single();

          if (createError2) {
            submitBtn.disabled = false;
            submitBtn.textContent = '注册';
            errorEl.textContent = '创建失败：' + createError2.message;
            return;
          }

          await supabase.from('couple_members').insert({
            couple_id: coupleData2.id,
            user_id: userId
          });
          window.App._currentInviteCode = retryCode;
          window.App._currentCoupleId = coupleData2.id;
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = '注册';
          errorEl.textContent = '创建失败：' + createError.message;
          return;
        }
      } else {
        await supabase.from('couple_members').insert({
          couple_id: coupleData.id,
          user_id: userId
        });
        window.App._currentInviteCode = code;
        window.App._currentCoupleId = coupleData.id;
      }
    }

    submitBtn.disabled = false;
    submitBtn.textContent = '注册';
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function getCoupleId(userId) {
    const { data, error } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.couple_id;
  }

  async function getInviteCode(coupleId) {
    const { data, error } = await supabase
      .from('couples')
      .select('invite_code')
      .eq('id', coupleId)
      .single();

    if (error || !data) return '------';
    return data.invite_code;
  }

  window.App.auth = {
    showLogin: showLogin,
    showRegister: showRegister,
    handleLogout: handleLogout,
    getCoupleId: getCoupleId,
    getInviteCode: getInviteCode,
    generateInviteCode: generateInviteCode
  };
})();

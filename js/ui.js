window.App = window.App || {};

(function() {
  'use strict';

  let memories = [];
  let tempCoords = { x: 50, y: 50 };
  let editingMemoryId = null;
  let selectedFile = null;

  const starsContainer = document.getElementById('starsContainer');
  const svg = document.getElementById('constellation');

  function renderMemoryStars(memoriesData) {
    memories = memoriesData || [];
    starsContainer.innerHTML = '';

    for (var i = 0; i < memories.length; i++) {
      var star = memories[i];
      var starEl = document.createElement('div');
      starEl.className = 'memory-star';
      starEl.style.left = star.x + '%';
      starEl.style.top = star.y + '%';

      starEl.innerHTML =
        '<div class="tooltip">' +
          '<div class="title">' + star.title + '</div>' +
          '<div class="date">' + star.date + '</div>' +
        '</div>' +
        '<div class="dot"></div>';

      starEl.addEventListener('click', (function(s) {
        return function(e) {
          e.stopPropagation();
          showPolaroid(s);
        };
      })(star));

      starsContainer.appendChild(starEl);
    }

    drawLines();
  }

  function drawLines() {
    if (!svg) return;
    svg.innerHTML = '';
    if (memories.length < 2) return;

    var width = window.innerWidth;
    var height = window.innerHeight;
    var pathD = '';

    for (var i = 0; i < memories.length; i++) {
      var px = (memories[i].x / 100) * width;
      var py = (memories[i].y / 100) * height;
      if (i === 0) pathD += 'M ' + px + ' ' + py;
      else pathD += ' L ' + px + ' ' + py;
    }

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', 'rgba(254, 240, 138, 0.45)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-dasharray', '5,5');
    svg.appendChild(path);

    var glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', pathD);
    glow.setAttribute('stroke', 'rgba(234, 179, 8, 0.15)');
    glow.setAttribute('stroke-width', '6');
    glow.setAttribute('fill', 'none');
    svg.appendChild(glow);
  }

  function showPolaroid(star) {
    document.getElementById('polaroidTitle').textContent = star.title;
    document.getElementById('polaroidDate').textContent = star.date;
    document.getElementById('polaroidStory').textContent = star.story;

    var photoArea = document.querySelector('.polaroid-card .photo-area');
    var imgLoader = document.getElementById('imgLoader');

    if (star.image_url) {
      var img = document.getElementById('polaroidImg');
      imgLoader.classList.remove('hidden');
      img.src = star.image_url;
      img.onload = function() { imgLoader.classList.add('hidden'); };
      img.onerror = function() {
        imgLoader.classList.add('hidden');
        img.src = '';
      };
      img.style.display = '';
    } else {
      imgLoader.classList.add('hidden');
      document.getElementById('polaroidImg').style.display = 'none';
    }

    document.getElementById('btnEdit').onclick = function() {
      closePolaroid();
      showEditForm(star);
    };

    document.getElementById('btnDelete').onclick = function() {
      if (confirm('确定要删除这颗记忆星星吗？')) {
        handleDelete(star);
      }
    };

    document.getElementById('btnClosePolaroid').onclick = closePolaroid;
    document.getElementById('polaroidModal').classList.remove('hidden');
  }

  function closePolaroid() {
    document.getElementById('polaroidModal').classList.add('hidden');
  }

  function showAddForm(x, y) {
    editingMemoryId = null;
    selectedFile = null;
    tempCoords = { x: x, y: y };

    document.getElementById('formModalTitle').textContent = '标记新的印记';
    document.getElementById('starTitle').value = '';
    document.getElementById('starDate').value = '';
    document.getElementById('starStory').value = '';
    document.getElementById('filePreview').classList.add('hidden');
    document.getElementById('filePreview').src = '';

    document.getElementById('formModal').classList.remove('hidden');
    document.getElementById('starTitle').focus();
  }

  function showEditForm(star) {
    editingMemoryId = star.id;
    selectedFile = null;

    document.getElementById('formModalTitle').textContent = '编辑记忆';
    document.getElementById('starTitle').value = star.title;
    document.getElementById('starDate').value = star.date;
    document.getElementById('starStory').value = star.story;

    if (star.image_url) {
      document.getElementById('filePreview').src = star.image_url;
      document.getElementById('filePreview').classList.remove('hidden');
    } else {
      document.getElementById('filePreview').classList.add('hidden');
    }

    document.getElementById('formModal').classList.remove('hidden');
    document.getElementById('starTitle').focus();
  }

  function closeFormModal() {
    document.getElementById('formModal').classList.add('hidden');
    selectedFile = null;
    editingMemoryId = null;
  }

  function handleFileSelect(e) {
    var file = e.target.files[0];
    if (!file) return;

    selectedFile = file;

    var reader = new FileReader();
    reader.onload = function(ev) {
      document.getElementById('filePreview').src = ev.target.result;
      document.getElementById('filePreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    var title = document.getElementById('starTitle').value.trim();
    var date = document.getElementById('starDate').value;
    var story = document.getElementById('starStory').value.trim();

    if (!title || !date || !story) {
      alert('请填满信息哦，回忆不能空白～');
      return;
    }

    var session = await App.supabase.auth.getSession();
    var userId = session.data.session ? session.data.session.user.id : null;
    if (!userId) return;

    var saveBtn = document.getElementById('formSubmitBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    try {
      var imageUrl = null;
      var imagePath = null;

      if (selectedFile) {
        var coupleId = await App.auth.getCoupleId(userId);
        if (coupleId) {
          var result = await App.storage.uploadImage(selectedFile, coupleId);
          imageUrl = result.url;
          imagePath = result.path;
        }
      }

      if (editingMemoryId) {
        var updates = { title: title, date: date, story: story };
        if (imageUrl) {
          updates.image_url = imageUrl;
          updates.image_path = imagePath;
        }
        await App.memories.updateMemory(editingMemoryId, updates);
      } else {
        var coupleId = await App.auth.getCoupleId(userId);
        if (!coupleId) throw new Error('未找到情侣配对');

        await App.memories.addMemory(coupleId, userId, {
          title: title,
          date: date,
          story: story,
          image_url: imageUrl,
          image_path: imagePath,
          x: tempCoords.x,
          y: tempCoords.y
        });
      }

      closeFormModal();
      await App.loadMemories();

    } catch (err) {
      alert('保存失败：' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = editingMemoryId ? '保存修改' : '凝聚星光';
    }
  }

  async function handleDelete(star) {
    try {
      closePolaroid();
      await App.memories.deleteMemory(star.id, star.image_path);
      await App.loadMemories();
    } catch (err) {
      alert('删除失败：' + err.message);
    }
  }

  function toggleSettings() {
    var panel = document.getElementById('settingsPanel');
    panel.classList.toggle('hidden');
  }

  async function updateInviteCode() {
    var session = await App.supabase.auth.getSession();
    var userId = session.data.session ? session.data.session.user.id : null;
    if (!userId) return;
    var coupleId = await App.auth.getCoupleId(userId);
    if (!coupleId) return;
    var code = await App.auth.getInviteCode(coupleId);
    document.getElementById('inviteCodeDisplay').textContent = code;
  }

  window.App.ui = {
    renderMemoryStars: renderMemoryStars,
    drawLines: drawLines,
    showAddForm: showAddForm,
    showEditForm: showEditForm,
    closeFormModal: closeFormModal,
    closePolaroid: closePolaroid,
    handleFileSelect: handleFileSelect,
    handleSave: handleSave,
    toggleSettings: toggleSettings,
    updateInviteCode: updateInviteCode
  };
})();

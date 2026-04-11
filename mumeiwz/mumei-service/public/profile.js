<script>
// ============ 个人中心完整功能 ============
(function() {
  const token = localStorage.getItem('authToken');
  if (!token) { window.location.href = '/panel'; return; }

  // ============ 加载用户信息 ============
  async function loadUserInfo() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (!data.success) {
        window.location.href = '/panel';
        return;
      }
      const u = data.user;
      // 填充表单
      if (document.getElementById('emailInput')) document.getElementById('emailInput').value = u.email;
      if (document.getElementById('displayName')) document.getElementById('displayName').value = u.displayName || '';
      if (document.getElementById('bioInput')) document.getElementById('bioInput').value = u.bio || '';
      if (document.getElementById('userEmail')) document.getElementById('userEmail').textContent = u.email;
      if (document.getElementById('userName')) {
        document.getElementById('userName').textContent = u.displayName || u.email.split('@')[0];
      }
      if (document.getElementById('userPlan')) {
        var planMap = { free: '免费版', basic: '基础版', pro: '专业版', enterprise: '企业版' };
        document.getElementById('userPlan').textContent = planMap[u.plan] || '免费版';
      }
      // 头像首字母
      var avatar = document.getElementById('userAvatar');
      if (avatar) avatar.textContent = (u.displayName || u.email.charAt(0).toUpperCase()).charAt(0).toUpperCase();
      // 会员时长
      if (u.createdAt && document.getElementById('memberDays')) {
        var days = Math.floor((Date.now() - new Date(u.createdAt)) / 86400000);
        document.getElementById('memberDays').textContent = days + '天';
      }
    } catch(e) {
      console.error('加载用户信息失败', e);
    }
  }

  // ============ 保存资料 ============
  window.saveProfile = async function() {
    var name = document.getElementById('displayName').value.trim();
    var bio = document.getElementById('bioInput').value.trim();
    var btn = document.querySelector('button[onclick="saveProfile()"]');
    if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
    try {
      var res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ displayName: name, bio: bio })
      });
      var data = await res.json();
      if (data.success) {
        if (document.getElementById('userName')) document.getElementById('userName').textContent = name || data.user.displayName || '用户';
        showToast('资料已保存 ✓');
      } else {
        showToast(data.error || '保存失败', 'error');
      }
    } catch(e) {
      showToast('保存失败，请重试', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = '保存修改'; }
  };

  // ============ 修改密码 ============
  window.changePassword = async function() {
    var current = document.getElementById('currentPassword').value;
    var newPass = document.getElementById('newPassword').value;
    var confirm = document.getElementById('confirmPassword').value;
    if (!current || !newPass || !confirm) {
      showToast('请填写所有密码字段', 'error'); return;
    }
    if (newPass.length < 6) {
      showToast('新密码至少6位', 'error'); return;
    }
    if (newPass !== confirm) {
      showToast('两次密码不一致', 'error'); return;
    }
    var btn = document.querySelector('button[onclick="changePassword()"]');
    if (btn) { btn.disabled = true; btn.textContent = '修改中...'; }
    try {
      var res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass, confirmPassword: confirm })
      });
      var data = await res.json();
      if (data.success) {
        showToast('密码修改成功 ✓');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
      } else {
        showToast(data.error || '修改失败', 'error');
      }
    } catch(e) {
      showToast('修改失败，请重试', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = '修改密码'; }
  };

  // ============ 导出数据 ============
  window.exportData = async function() {
    var btn = document.querySelector('button[onclick="exportData()"]');
    if (btn) { btn.disabled = true; btn.textContent = '导出中...'; }
    showToast('正在导出数据...');
    try {
      var res = await fetch('/api/auth/export', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('导出失败');
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'mumei-data.csv'; a.click();
      URL.revokeObjectURL(url);
      showToast('数据已导出 ✓');
    } catch(e) {
      showToast('导出失败: ' + e.message, 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = '导出数据'; }
  };

  // ============ 删除账户 ============
  window.deleteAccount = async function() {
    if (!confirm('⚠️ 确定要删除账户吗？\n\n此操作将永久删除：\n- 您的所有账户数据\n- API Keys 和使用记录\n- 所有设置和偏好\n\n此操作不可恢复！')) return;
    if (!confirm('最后确认：删除后所有数据将无法恢复，确定吗？')) return;
    showToast('正在删除账户...');
    try {
      var res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      var data = await res.json();
      if (data.success) {
        showToast('账户已删除');
        localStorage.removeItem('authToken');
        setTimeout(function() { window.location.href = '/'; }, 1500);
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch(e) {
      showToast('删除失败，请稍后重试', 'error');
    }
  };

  // ============ 切换开关 + 保存通知设置 ============
  var notificationSettings = {};
  window.toggleSwitch = function(el) {
    el.classList.toggle('active');
    var key = el.parentElement.querySelector('h4').textContent;
    var map = { '邮件通知': 'emailNotify', '使用报告': 'weeklyReport', '安全提醒': 'securityAlert', '产品更新': 'productUpdates' };
    notificationSettings[map[key]] = el.classList.contains('active');
    // 自动保存设置
    saveNotificationSettings();
  };

  async function saveNotificationSettings() {
    try {
      var res = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(notificationSettings)
      });
      var data = await res.json();
      if (data.success) showToast('设置已保存');
    } catch (e) {
      console.error('保存通知设置失败', e);
    }
  }

  async function loadNotificationSettings() {
    try {
      var res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      var data = await res.json();
      if (!data.success) return;
      var s = data.user.settings || {};
      notificationSettings = s;
      var map = { emailNotify: '邮件通知', weeklyReport: '使用报告', securityAlert: '安全提醒', productUpdates: '产品更新' };
      var toggles = document.querySelectorAll('.toggle-switch');
      toggles.forEach(function(t) {
        var h = t.parentElement.querySelector('h4');
        if (!h) return;
        var key = h.textContent;
        var field = map[key];
        if (field !== undefined) {
          if (s[field] === false) t.classList.remove('active');
          else t.classList.add('active');
        }
      });
    } catch (e) {
      console.error('加载通知设置失败', e);
    }
  }

  // ============ Toast 提示 ============
  function showToast(msg, type) {
    var existing = document.getElementById('profileToast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'profileToast';
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);padding:12px 24px;background:' +
      (type === 'error' ? '#ef4444' : '#22c55e') + ';color:white;border-radius:8px;font-size:14px;' +
      'z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.3s;';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 2500);
  }

  // ============ 导航栏 ============
  function initNav() {
    var nav = document.querySelector('.top-nav');
    if (!nav) return;
    var token = localStorage.getItem('authToken');
    var isLoggedIn = !!token;
    nav.innerHTML = '<div style="display:flex;align-items:center;gap:16px;justify-content:space-between;padding:0 20px;max-width:1100px;margin:0 auto;height:64px;">' +
      '<a href="/" style="font-size:1.25rem;font-weight:700;color:var(--text);text-decoration:none;">沐美服务</a>' +
      '<div style="display:flex;gap:8px;">' +
      (isLoggedIn
        ? '<a href="/panel" style="padding:8px 16px;color:var(--text-muted);text-decoration:none;font-size:14px;">控制台</a><a href="/tools" style="padding:8px 16px;color:var(--text-muted);text-decoration:none;font-size:14px;">工具箱</a><a href="/pricing" style="padding:8px 16px;color:var(--text-muted);text-decoration:none;font-size:14px;">定价</a><a href="/profile" style="padding:8px 16px;color:var(--primary);text-decoration:none;font-size:14px;font-weight:600;">个人中心</a><button onclick="localStorage.removeItem(\'authToken\');window.location.href=\'/panel\'" style="padding:8px 16px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-size:14px;">退出</button>'
        : '<a href="/panel" style="padding:8px 16px;color:var(--text-muted);text-decoration:none;font-size:14px;">登录</a><a href="/panel" style="padding:8px 16px;background:var(--primary);color:white;border-radius:8px;text-decoration:none;font-size:14px;">注册</a>'
      ) + '</div></div>';
  }

  // ============ 初始化 ============
  loadUserInfo();
  loadNotificationSettings();
  initNav();
})();
</script>
</body>
</html>

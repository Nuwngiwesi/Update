// LYNKO CHAT — Settings, Contacts, add-by-number, rename contacts (WhatsApp-style, iOS look).
// Runs after the main script in chat.html and uses its globals (me, contacts, api, sheet, toast, openChat …).
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.innerHTML = x; return e; };
  const svg = (p, n = 26) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const IC = {
    chat: '<path d="M12 3.5C6.9 3.5 2.8 6.9 2.8 11.2c0 2.2 1 4.1 2.7 5.5L4.6 20.5l4.2-2c1 .3 2 .4 3.2.4 5.1 0 9.2-3.4 9.2-7.7S17.1 3.5 12 3.500z"/>',
    status: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="4.2 3"/><circle cx="12" cy="12" r="3.4"/>',
    contacts: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17.5 14c2.6 0 4.5 1.8 4.5 4.5"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>',
    compose: '<path d="M4 20h4L19.5 8.500a2.1 2.1 0 000-3l-1-1a2.1 2.1 0 00-3 0L4 16v4z"/><path d="M13.5 6l4.5 4.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>'
  };

  // same rules as the server: 0771234567 / 771234567 -> 94771234567
  const CC = '94';
  const normPhone = s => { let d = String(s || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2);
    else if (d.length == 10 && d[0] == '0') d = CC + d.slice(1); else if (d.length == 9) d = CC + d; return d; };
  const kdf = async (pw, salt) => { const m = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 150000 }, m, 256); };
  const wrapKey = async (pw, p) => crypto.subtle.importKey('raw', await kdf(pw, 'wrap:' + p), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const authOf = async (pw, p) => hex(await kdf(pw, 'auth:' + p));
  const myPhone = () => me.phone || localStorage.getItem('lynko_phone') || '';

  // ── theme ──
  function applyTheme(t) {
    try { localStorage.setItem('theme', t); } catch {}
    const d = t == 'dark' || (t == 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = d ? 'dark' : 'light';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = d ? '#000000' : '#f2f2f7';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if ((localStorage.getItem('theme') || 'auto') == 'auto') applyTheme('auto'); });

  // ── iOS icons / titles on the main screen ──
  $('n1').querySelector('i').innerHTML = svg(IC.chat);
  $('n4').querySelector('i').innerHTML = svg(IC.status);
  $('n2').querySelector('i').innerHTML = svg(IC.contacts);
  $('n3').querySelector('i').innerHTML = svg(IC.sliders);
  $('menub').innerHTML = svg(IC.compose, 24); $('menub').title = 'New contact';
  $('back').innerHTML = svg(IC.back, 28);
  const _setTab = window.setTab;
  window.setTab = function (t) { _setTab(t); $('ttl').textContent = t == 'status' ? 'Status' : 'Chats'; };

  // ── tiny page stack (iOS push / back) ──
  const P = { el: null, st: [] };
  const closePg = () => { if (P.el) { P.el.remove(); P.el = null; P.st = []; } };
  const openPg = scr => { closePg(); P.el = h('div', 'pg'); document.body.appendChild(P.el); P.st = [scr]; draw(true); };
  const pushPg = scr => { P.st.push(scr); draw(true); };
  const popPg = () => { P.st.pop(); P.st.length ? draw(false) : closePg(); };
  const refresh = () => { if (P.el) draw(false); };
  function draw(anim) {
    const s = P.st[P.st.length - 1], prev = P.st[P.st.length - 2];
    P.el.innerHTML = '';
    const bar = h('div', 'pgbar'), bk = h('button', 'bk', prev ? svg(IC.back, 24) + esc(prev.title) : '');
    if (prev) bk.onclick = popPg; else bk.style.visibility = 'hidden';
    bar.append(bk, h('h2', null, esc(s.title)));
    if (s.right || !prev) { const rt = h('button', 'rt' + (s.right && s.right.plus ? ' plus' : ''), esc(s.right ? s.right.label : 'Done')); rt.onclick = s.right ? s.right.fn : closePg; bar.append(rt); }
    const body = h('div', 'pgb' + (anim ? ' slide' : '')); P.el.append(bar, body);
    s.render(body);
  }

  // ── building blocks ──
  function cell(o, fn) {
    const b = h(fn ? 'button' : 'div', 'cell' + (o.red ? ' red' : '') + (o.icon ? ' hasi' : '') + (o.av ? ' hasav' : ''));
    if (fn) b.type = 'button';
    b.innerHTML = (o.icon ? `<span class="ci" style="background:${o.color || '#8e8e93'}">${o.icon}</span>` : '') + (o.av || '') +
      `<span class="cl"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>` +
      ((o.value != null || o.toggle != null || o.chev) ? `<span class="cv">${o.value != null ? esc(o.value) : ''}${o.toggle != null ? `<i class="sw${o.toggle ? ' on' : ''}"></i>` : ''}${o.chev ? '<i class="chev">›</i>' : ''}</span>` : '');
    if (fn) b.onclick = () => fn(b);
    return b;
  }
  function field(label, val, ph, type) {
    const c = h('label', 'cell fld'); c.innerHTML = `<span class="cl"><b>${esc(label)}</b></span><input>`;
    const i = c.querySelector('input'); i.value = val || ''; i.placeholder = ph || ''; i.type = type || 'text';
    if (type == 'password') i.autocomplete = 'off'; else i.maxLength = 120; return c;
  }
  function grp(title, cells, foot) {
    const f = document.createDocumentFragment(); if (title) f.append(h('div', 'gh', esc(title)));
    const g = h('div', 'gl'); cells.forEach(c => g.append(c)); f.append(g); if (foot) f.append(h('div', 'gf', esc(foot))); return f;
  }
  const textDlg = (title, val, ph, ok = 'Save') => new Promise(res => {
    const o = h('div', 'ov'); o.innerHTML = `<div class="dlg"><h3></h3><input class="tin" maxlength="30"><div class="r"><button class="no">Cancel</button><button class="ok">${ok}</button></div></div>`;
    o.querySelector('h3').textContent = title; const i = o.querySelector('input'); i.value = val || ''; i.placeholder = ph || '';
    document.body.appendChild(o); i.focus(); i.select();
    const done = v => { o.remove(); res(v); };
    o.querySelector('.no').onclick = () => done(null); o.querySelector('.ok').onclick = () => done(i.value.trim());
    i.addEventListener('keydown', e => { if (e.key == 'Enter') done(i.value.trim()); });
  });
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  // ── screens ──
  function rootScr() {
    return { title: 'Settings', render(b) {
      const prof = h('button', 'cell prof'); prof.type = 'button';
      prof.innerHTML = `${av(me)}<span class="cl"><b>${esc(me.username)}</b><small>${esc(me.about || 'Hey there! I’m using LYNKO CHAT')}</small><small>+${esc(myPhone())}</small></span><i class="chev">›</i>`;
      prof.onclick = () => pushPg(profileScr());
      b.append(grp(null, [prof]));
      b.append(grp(null, [
        cell({ icon: '🔑', color: '#0a84ff', label: 'Account', chev: 1 }, () => pushPg(accountScr())),
        cell({ icon: '💬', color: '#34c759', label: 'Chats', chev: 1 }, () => pushPg(chatsScr())),
        cell({ icon: '🔔', color: '#ff453a', label: 'Notifications', chev: 1 }, () => pushPg(notifScr())),
        cell({ icon: '🔒', color: '#5e5ce6', label: 'Privacy', chev: 1 }, () => pushPg(privacyScr())),
        cell({ icon: '👥', color: '#ff9f0a', label: 'Contacts', chev: 1 }, () => pushPg(contactsScr()))]));
      const more = [];
      if (!standalone()) more.push(cell({ icon: '📲', color: '#ff4d86', label: 'Install app', chev: 1 }, () => window.lynkoInstall && window.lynkoInstall()));
      more.push(cell({ icon: 'ℹ️', color: '#8e8e93', label: 'About', chev: 1 }, () => pushPg(aboutScr())));
      b.append(grp(null, more));
      b.append(grp(null, [cell({ label: 'Log out', red: 1 }, async () => {
        if (!(await ask('Log out of LYNKO CHAT?', { ok: 'Log out' }))) return;
        try { await fetch('/api/logout', { method: 'POST' }); } catch {} leave(); })]));
    } };
  }

  function profileScr() {
    let dp = null, nameC, aboutC;
    const save = async () => {
      const name = nameC.querySelector('input').value.trim(); if (!name) return toast('Name cannot be empty');
      try { const r = await api('/api/profile', 'POST', { name, about: aboutC.querySelector('input').value, dp });
        me.username = r.name || name; me.about = r.about; me.dpv = r.dpv; paintMe(); toast('Saved ♥'); popPg(); }
      catch (e) { toast(e.message); }
    };
    return { title: 'Profile', right: { label: 'Save', fn: save }, render(b) {
      const top = h('div', 'ptop'), a = h('label', 'av avbig'), f = h('input'); f.type = 'file'; f.accept = 'image/*'; f.hidden = true;
      const paint = () => { a.innerHTML = dp ? `<img src="data:image/jpeg;base64,${dp}">` : me.dpv ? `<img src="/api/dp/${me.id}?v=${me.dpv}">` : esc((me.username || '?')[0].toUpperCase()); };
      paint(); a.onclick = () => f.click();
      f.onchange = async e => { const file = e.target.files[0]; if (!file) return;
        try { const bm = await createImageBitmap(file), s = Math.min(bm.width, bm.height), c = document.createElement('canvas'); c.width = c.height = 256;
          c.getContext('2d').drawImage(bm, (bm.width - s) / 2, (bm.height - s) / 2, s, s, 0, 0, 256, 256); dp = c.toDataURL('image/jpeg', .8).split(',')[1]; paint(); }
        catch { toast('Could not read that photo'); } };
      const hint = h('small', null, 'Tap to change photo'); top.append(a, f, hint); b.append(top);
      nameC = field('Name', me.username, 'Your name'); aboutC = field('About', me.about, 'Hey there! I’m using LYNKO CHAT');
      b.append(grp(null, [nameC, aboutC]));
      b.append(grp('Phone number', [cell({ label: '+' + myPhone(), sub: 'Tap to copy' }, () => { navigator.clipboard?.writeText('+' + myPhone()); toast('Number copied'); })],
        'Friends add you using this number. Only you can see names you save for your contacts.'));
    } };
  }

  function accountScr() {
    return { title: 'Account', render(b) {
      b.append(grp(null, [cell({ label: 'Phone number', value: '+' + myPhone() }), cell({ label: 'Change password', chev: 1 }, () => pushPg(passScr()))],
        'You can be signed in on one device at a time. Logging in on another device signs this one out.'));
    } };
  }

  function passScr() {
    let a, n, c;
    const save = async () => {
      const o = a.querySelector('input').value, nw = n.querySelector('input').value, cf = c.querySelector('input').value;
      if (!o) return toast('Enter your current password');
      if (nw.length < 6) return toast('New password must be 6+ characters');
      if (nw !== cf) return toast('Passwords don’t match');
      try {
        const ph = myPhone(), iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await wrapKey(nw, ph), enc.encode(localStorage.getItem('lynko_priv')));
        await api('/api/password', 'POST', { oldAuth: await authOf(o, ph), newAuth: await authOf(nw, ph), encPriv: JSON.stringify({ iv: b64(iv), ct: b64(ct) }) });
        toast('Password changed ✓'); popPg();
      } catch (e) { toast(e.message); }
    };
    return { title: 'Password', right: { label: 'Save', fn: save }, render(b) {
      a = field('Current', '', 'Current password', 'password'); n = field('New', '', '6+ characters', 'password'); c = field('Confirm', '', 'Repeat new password', 'password');
      b.append(grp(null, [a, n, c], 'Your chats stay readable — your encryption key is re-protected with the new password.'));
    } };
  }

  function chatsScr() {
    return { title: 'Chats', render(b) {
      const cur_ = localStorage.getItem('theme') || 'auto', seg = h('div', 'seg3');
      [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].forEach(([k, l]) => {
        const x = h('button', k == cur_ ? 'on' : '', l); x.type = 'button';
        x.onclick = () => { applyTheme(k); seg.querySelectorAll('button').forEach(y => y.classList.toggle('on', y == x)); }; seg.append(x); });
      const w = h('div', 'gl'); w.append(seg);
      b.append(h('div', 'gh', 'Appearance'), w);
      b.append(grp('Chat background', [cell({ icon: '🖼', color: '#af52de', label: 'Wallpaper', chev: 1 }, () => wallpaper())]));
    } };
  }

  function notifScr() {
    return { title: 'Notifications', render(b) {
      const on = localStorage.getItem('vib') !== '0';
      b.append(grp(null, [cell({ label: 'Vibration', toggle: on }, el => {
        const sw = el.querySelector('.sw'), v = !sw.classList.contains('on'); sw.classList.toggle('on', v); localStorage.setItem('vib', v ? '1' : '0'); })],
        'You get alerts while LYNKO CHAT is open. New messages also appear as unread badges.'));
    } };
  }

  function privacyScr() {
    return { title: 'Privacy', render(b) {
      b.append(grp(null, [
        cell({ icon: '🔐', color: '#34c759', label: 'End-to-end encrypted', sub: 'Only you and your friend can read messages' }),
        cell({ icon: '⏳', color: '#ff9f0a', label: 'Disappear in 24 hours', sub: 'Messages and statuses vanish automatically' }),
        cell({ icon: '📱', color: '#0a84ff', label: 'One device per number', sub: 'A new login signs out the old device' })]));
      b.append(grp('Chat lock', [cell({ icon: '🔒', color: '#5e5ce6', label: 'Lock a chat', sub: 'Open a chat → ⋮ → Lock this chat' })]));
      b.append(grp('Offline data', [cell({ label: 'Clear saved offline data', red: 1 }, async () => {
        try { await caches.delete('lynko-api-v2'); } catch {} toast('Offline data cleared'); })],
        'Chats you opened are kept (encrypted) so they show without internet. This removes them from this device.'));
    } };
  }

  function contactsScr() {
    return { title: 'Contacts', right: { label: '+', plus: 1, fn: () => newChat() }, render(b) {
      const list = [...contacts.values()].sort((x, y) => x.username.localeCompare(y.username));
      if (!list.length) { b.append(h('div', 'empty', 'No contacts yet.<br>Tap + to add a friend by phone number.')); return; }
      b.append(grp(null, list.map(c => cell({ av: av(c), label: c.username, sub: '+' + (c.phone || '') }, () => pushPg(contactScr(c.id))))));
    } };
  }

  function contactScr(id) {
    return { title: 'Contact', render(b) {
      const c = contacts.get(id); if (!c) { popPg(); return; }
      const top = h('div', 'ptop'); top.innerHTML = av(c, 'avbig'); top.append(h('h2', null, esc(c.username)), h('p', null, esc(c.about || 'Hey there! I’m using LYNKO CHAT')));
      b.append(top);
      b.append(grp(null, [cell({ label: 'Phone', value: '+' + (c.phone || '') }),
        cell({ label: 'Profile name', value: c.pname || '—' })]));
      b.append(grp(null, [cell({ icon: '💬', color: '#34c759', label: 'Send message', chev: 1 }, () => { closePg(); openChat(id); }),
        cell({ icon: '✏️', color: '#ff9f0a', label: 'Edit contact name', chev: 1 }, async () => { await editContact(id); refresh(); })]));
    } };
  }

  function aboutScr() {
    return { title: 'About', render(b) {
      const top = h('div', 'ptop'); top.innerHTML = '<img src="/icons/icon-192.png" width="84" height="84" style="border-radius:20px">';
      top.append(h('h2', null, 'LYNKO CHAT'), h('p', null, 'Private chats that fade · v2.0'));
      b.append(top);
    } };
  }

  // ── contacts: add by number / rename ──
  window.editContact = async function (id) {
    const c = contacts.get(id); if (!c) return;
    const v = await textDlg('Contact name', c.username == '+' + c.phone ? '' : c.username, c.pname || '+' + c.phone);
    if (v === null) return;
    try { const r = await api('/api/contacts/name', 'POST', { id, name: v }); await loadContacts();
      if (cur == id) $('hn').textContent = contacts.get(id).username; toast(r.name ? 'Name saved' : 'Name reset'); }
    catch (e) { toast(e.message); }
  };
  window.newChat = function () {
    const o = sheet(`<div class="pf"><h3 style="margin:0">New contact</h3><input id="ncn" placeholder="Name (optional)" maxlength="30" autocomplete="off"><input id="ncp" type="tel" inputmode="tel" placeholder="Phone number  07X XXX XXXX"><button class="btn p" style="width:100%" id="ngo">Add &amp; chat</button><div class="idbox" id="nme">Your number — tap to copy<b>+${esc(myPhone())}</b></div></div>`);
    o.querySelector('#nme').onclick = () => { navigator.clipboard?.writeText('+' + myPhone()); toast('Number copied'); };
    o.querySelector('#ngo').onclick = async () => {
      const phone = normPhone(o.querySelector('#ncp').value);
      if (!/^\d{9,15}$/.test(phone)) return toast('Enter a valid phone number');
      try { const p = await api('/api/contacts', 'POST', { phone, name: o.querySelector('#ncn').value.trim() });
        await loadContacts(); o.remove(); closePg(); openChat(p.id); }
      catch (e) { toast(e.message); }
    };
  };

  const openSettings = sub => { openPg(rootScr()); if (sub == 'profile') pushPg(profileScr()); };
  window.profile = () => openSettings('profile');
  $('meb').onclick = () => openSettings('profile');
  $('n3').onclick = () => openSettings();
  $('n2').onclick = () => openPg(contactsScr());
  $('menub').onclick = () => newChat();
})();

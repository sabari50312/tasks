import './style.css';
import { LoadBoard, UpsertItem, UpsertProject, DeleteItem, DeleteProject } from '../wailsjs/go/main/App';

(function () {
  'use strict';

  /* ---------- Constants ---------- */
  const STATUSES = [
    { id: 'backlog', name: 'Backlog' },
    { id: 'doing', name: 'Doing' },
    { id: 'blocked', name: 'Blocked' },
    { id: 'done', name: 'Done' }
  ];
  const STATUS_NAME = Object.fromEntries(STATUSES.map(s => [s.id, s.name]));
  const ICON = {
    backlog: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--s-backlog)" stroke-width="2" stroke-dasharray="3 2.5"/></svg>',
    doing: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--s-doing)" stroke-width="2"/><path d="M8 2a6 6 0 0 1 0 12z" fill="var(--s-doing)"/></svg>',
    blocked: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" fill="none" stroke="var(--s-blocked)" stroke-width="2"/><path d="M5.5 8h5" stroke="var(--s-blocked)" stroke-width="2" stroke-linecap="round"/></svg>',
    done: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--s-done)"/><path d="M5 8.2l2 2 4-4.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const GLYPH = {
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3"/><path d="M5.2 8.2l2 2 3.6-4"/></svg>',
    link: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.5 9.5l3-3"/><path d="M7 4.5l1.2-1.2a2.8 2.8 0 0 1 4 4L11 8.5"/><path d="M9 11.5l-1.2 1.2a2.8 2.8 0 0 1-4-4L5 7.5"/></svg>',
    comment: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>',
    tick: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>',
    chev: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg>',
    spark: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5l1.4 4.1 4.1 1.4-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4z"/><path d="M13 10.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/></svg>'
  };
  const TYPES = { feature: 'Feature', bug: 'Bug', task: 'Task' };
  const PRIOS = { high: 'High', med: 'Medium', low: 'Low' };
  const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,120}$/;
  const LS_UI = 'devboard.v2.ui';
  const LS_LOCAL = 'devboard.v2.local';
  const CAN_DRAG = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Helpers ---------- */
  const $ = id => document.getElementById(id);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function glyph(map, key, cls) { const s = el('span', cls || 'sicon'); s.innerHTML = map[key]; return s; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function nowISO() { return new Date().toISOString(); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function lsGet(k) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }

  function parseDay(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function shortDate(d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  function dueInfo(it) {
    const d = parseDay(it.due); if (!d) return null;
    const today = parseDay(dayStr(new Date()));
    const diff = Math.round((d - today) / 86400000);
    let label = diff === 0 ? 'Due today' : diff === 1 ? 'Due tomorrow' : diff === -1 ? 'Due yesterday' : 'Due ' + shortDate(d);
    let cls = '';
    if (it.status !== 'done') { if (diff < 0) cls = 'overdue'; else if (diff === 0) cls = 'today'; }
    return { label, cls };
  }
  function rel(iso) {
    const t = Date.parse(iso); if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
    return shortDate(new Date(t));
  }
  function fullTime(iso) { const t = Date.parse(iso); return t ? new Date(t).toLocaleString() : ''; }
  function safeUrl(raw) {
    let s = str(raw).trim(); if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null; } catch (e) { return null; }
  }
  function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }

  /* ---------- UI prefs (per device) ---------- */
  const ui = Object.assign({ projectId: 'all', addTo: '', type: 'all', prio: 'all', tab: 'backlog' }, lsGet(LS_UI) || {});
  if (!STATUS_NAME[ui.tab]) ui.tab = 'backlog';
  if (ui.type !== 'all' && !TYPES[ui.type]) ui.type = 'all';
  if (ui.prio !== 'all' && !PRIOS[ui.prio]) ui.prio = 'all';
  function saveUI() { lsSet(LS_UI, ui); }
  let query = '';

  /* ---------- Store ---------- */
  const S = {
    mode: 'pending', cols: null,
    raw: { projects: {}, items: {} },
    pending: {}, deleting: {}, writers: {},
    loaded: { projects: false, items: false },
    busy: 0, error: ''
  };
  const state = { projects: {}, items: {}, ready: false };

  function compose() {
    for (const kind of ['projects', 'items']) {
      const out = {};
      for (const id in S.raw[kind]) if (!S.deleting[kind + '/' + id]) out[id] = S.raw[kind][id];
      for (const k in S.pending) {
        const i = k.indexOf('/');
        if (k.slice(0, i) === kind) out[k.slice(i + 1)] = S.pending[k];
      }
      state[kind] = out;
    }
  }
  function persistLocal() { lsSet(LS_LOCAL, S.raw); }

  function enqueue(k, job) {
    const w = S.writers[k] || (S.writers[k] = { running: false, next: null });
    w.next = job;
    if (!w.running) drain(w);
  }
  async function drain(w) {
    w.running = true;
    while (w.next) {
      const job = w.next; w.next = null;
      S.busy++; updateSync();
      try { await job(); S.error = ''; }
      catch (e) {
        if (e && e.code === 'unavailable') {
          await new Promise(r => setTimeout(r, 400 + Math.random() * 800));
          try { await job(); S.error = ''; } catch (e2) { setError(e2); }
        } else setError(e);
      }
      S.busy--; updateSync();
    }
    w.running = false;
  }
  function setError(e) {
    const c = e && e.code;
    S.error = c === 'quota_exceeded' ? 'Storage is full. Delete some items to keep saving.'
      : c === 'revoked' ? 'Sync stopped. Reload the page.'
      : c === 'invalid_argument' ? 'A change could not be saved.'
      : c === 'resource_exhausted' ? 'Saving too fast. Wait a moment.'
      : 'Could not save: ' + (e && (e.message || e) || 'unknown error');
    updateSync();
    console.error(e);
  }

  function put(kind, obj) {
    obj = clone(obj);
    obj.updatedAt = nowISO();
    const k = kind + '/' + obj.id;
    if (S.mode !== 'db') {
      S.raw[kind][obj.id] = obj; persistLocal(); compose(); scheduleRender(); return;
    }
    S.pending[k] = obj; delete S.deleting[k];
    compose(); scheduleRender();
    enqueue(k, async () => {
      await S.cols[kind].doc(obj.id).set(obj);
      if (S.pending[k] === obj) { delete S.pending[k]; S.raw[kind][obj.id] = obj; }
    });
  }
  function del(kind, id) {
    const k = kind + '/' + id;
    if (S.mode !== 'db') { delete S.raw[kind][id]; persistLocal(); compose(); scheduleRender(); return; }
    delete S.pending[k]; S.deleting[k] = true;
    compose(); scheduleRender();
    enqueue(k, async () => {
      await S.cols[kind].doc(id).delete();
      delete S.raw[kind][id]; delete S.deleting[k];
    });
  }
  async function writeMany(ops) {
    // ops: [{kind, op:'set'|'delete', obj?, id?}] written one at a time
    if (S.mode !== 'db') {
      for (const o of ops) { if (o.op === 'set') S.raw[o.kind][o.obj.id] = o.obj; else delete S.raw[o.kind][o.id]; }
      persistLocal(); compose(); scheduleRender(); return;
    }
    for (const o of ops) {
      const id = o.op === 'set' ? o.obj.id : o.id;
      const k = o.kind + '/' + id;
      if (o.op === 'set') { S.pending[k] = o.obj; delete S.deleting[k]; } else { delete S.pending[k]; S.deleting[k] = true; }
    }
    compose(); scheduleRender();
    S.busy++; updateSync();
    try {
      for (const o of ops) {
        const id = o.op === 'set' ? o.obj.id : o.id;
        const k = o.kind + '/' + id;
        if (o.op === 'set') {
          await S.cols[o.kind].doc(id).set(o.obj);
          if (S.pending[k] === o.obj) { delete S.pending[k]; S.raw[o.kind][id] = o.obj; }
        } else {
          await S.cols[o.kind].doc(id).delete();
          delete S.raw[o.kind][id]; delete S.deleting[k];
        }
      }
      S.error = '';
    } catch (e) { setError(e); }
    S.busy--; updateSync(); compose(); scheduleRender();
  }

  /* ---------- Wails bridge ---------- */
  // app.go exposes LoadBoard / UpsertProject / UpsertItem / DeleteProject /
  // DeleteItem. Wails turns each one into an async JS function returning a
  // Promise; a Go `error` rejects that promise with the error text.
  function indexById(list) {
    const m = {};
    for (const obj of list || []) if (obj && obj.id) m[obj.id] = obj;
    return m;
  }

  async function refresh() {
    const board = await LoadBoard();
    S.raw = { projects: indexById(board.projects), items: indexById(board.items) };
    S.loaded = { projects: true, items: true };
    state.ready = true;
    compose(); onData();
  }

  function setupWails() {
    S.mode = 'db';
    // Only the write side of the original collection API is still needed:
    // reads come back through refresh() after every write.
    S.cols = {};
    for (const kind of ['projects', 'items']) {
      S.cols[kind] = {
        doc(id) {
          return {
            async set(obj) {
              if (kind === 'items') await UpsertItem(obj); else await UpsertProject(obj);
              await refresh();
            },
            async delete() {
              if (kind === 'items') {
                const it = S.raw.items[id];
                await DeleteItem(it ? it.projectId : '', id);
              } else {
                await DeleteProject(id);
              }
              await refresh();
            }
          };
        }
      };
    }
    refresh().then(updateSync).catch(e => { setError(e); state.ready = true; scheduleRender(); });
    updateSync();
  }

  async function init() {
    render();
    setupWails();
  }

  function updateSync() {
    const n = $('sync');
    n.classList.remove('err', 'warn'); n.title = '';
    if (S.error) { n.textContent = S.error; n.classList.add('err'); return; }
    n.textContent = S.busy ? 'Saving…' : (state.ready ? 'Saved' : 'Loading…');
  }

  /* ---------- Derived data ---------- */
  function projectList() {
    return Object.values(state.projects).sort((a, b) => str(a.name).localeCompare(str(b.name)));
  }
  function matches(it) {
    if (ui.projectId !== 'all' && it.projectId !== ui.projectId) return false;
    if (ui.type !== 'all' && it.type !== ui.type) return false;
    if (ui.prio !== 'all' && (it.priority || 'med') !== ui.prio) return false;
    if (query) {
      if (query.charAt(0) === '#') {
        const t = query.slice(1);
        if (t && !arr(it.tags).some(x => x.toLowerCase().indexOf(t) === 0)) return false;
      } else {
        const hay = [it.title, it.description].concat(arr(it.tags)).join(' ').toLowerCase();
        if (hay.indexOf(query) === -1) return false;
      }
    }
    return true;
  }
  function columnItems(status) {
    return Object.values(state.items)
      .filter(it => it.status === status && matches(it))
      .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || str(a.id).localeCompare(str(b.id)));
  }
  function nextOrder(status, excludeId) {
    let m = 0;
    for (const it of Object.values(state.items)) if (it.status === status && it.id !== excludeId && it.order > m) m = it.order;
    return m + 1;
  }
  function allTags() {
    const seen = {};
    for (const it of Object.values(state.items)) for (const t of arr(it.tags)) seen[t.toLowerCase()] = t;
    return Object.values(seen).sort((a, b) => a.localeCompare(b));
  }

  /* ---------- Rendering ---------- */
  let rq = false, dragId = null, renderQueued = false;
  function scheduleRender() {
    if (rq) return; rq = true;
    requestAnimationFrame(() => { rq = false; render(); });
  }
  function render() {
    if (dragId) { renderQueued = true; return; }
    if (pop && pop.kind === 'addTarget') closePopover();
    renderHeader();
    renderBoard();
    if (pop && pop.kind === 'proj') renderProjList();
    if (pop && !pop.anchor.isConnected) closePopover();
  }
  function onData() {
    scheduleRender();
    if ($('itemDlg').open && cur && !state.items[cur.id]) { cur = null; $('itemDlg').close(); }
  }

  function renderHeader() {
    if (state.ready && ui.projectId !== 'all' && !state.projects[ui.projectId]) { ui.projectId = 'all'; saveUI(); }
    const p = state.projects[ui.projectId];
    const hasProjects = Object.keys(state.projects).length > 0;
    $('projName').textContent = p ? p.name : (hasProjects ? 'All projects' : 'Dev Board');
    document.querySelectorAll('#typeChips .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.type === ui.type ? 'true' : 'false'));
    document.querySelectorAll('#prioChips .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.prio === ui.prio ? 'true' : 'false'));
    updateSync();
  }

  function emptyText(s) {
    return { backlog: 'Nothing queued.', doing: 'Nothing in progress.', blocked: 'Nothing blocked.', done: 'Finished items land here.' }[s];
  }

  function renderBoard() {
    const board = $('board'), tabs = $('tabs');
    // keep scroll and in-progress typing across re-renders
    const scrolls = {};
    board.querySelectorAll('.list').forEach(l => { scrolls[l.dataset.status] = l.scrollTop; });
    const ae = document.activeElement;
    const typing = ae && ae.dataset && ae.dataset.add ? { status: ae.dataset.add, value: ae.value, start: ae.selectionStart, end: ae.selectionEnd } : null;
    const scrollLeft = board.scrollLeft;

    board.textContent = ''; tabs.textContent = '';
    if (!state.ready) { tabs.hidden = true; board.appendChild(el('div', 'notice', 'Loading your board…')); return; }
    if (!Object.keys(state.projects).length) { tabs.hidden = true; board.appendChild(startPanel()); return; }
    tabs.hidden = false;

    for (const s of STATUSES) {
      const items = columnItems(s.id);

      const t = el('button', 'tab'); t.type = 'button';
      t.setAttribute('aria-pressed', ui.tab === s.id ? 'true' : 'false');
      t.appendChild(glyph(ICON, s.id)); t.appendChild(el('span', '', s.name)); t.appendChild(el('span', 'tcount', String(items.length)));
      t.addEventListener('click', () => { ui.tab = s.id; saveUI(); render(); });
      tabs.appendChild(t);

      const col = el('section', 'column' + (ui.tab === s.id ? ' active' : ''));
      col.setAttribute('aria-label', s.name);
      const head = el('div', 'col-head');
      head.appendChild(glyph(ICON, s.id)); head.appendChild(el('h2', '', s.name)); head.appendChild(el('span', 'count', String(items.length)));
      col.appendChild(head);

      const list = el('div', 'list'); list.dataset.status = s.id;
      if (!items.length) list.appendChild(el('div', 'empty', emptyText(s.id)));
      items.forEach(it => list.appendChild(cardNode(it)));
      if (CAN_DRAG) wireDrop(list, s.id);
      col.appendChild(list);

      const add = el('div', 'add');
      {
        if (ui.projectId === 'all') {
          const tp = state.projects[addTarget()];
          const tb = el('button', 'add-target'); tb.type = 'button';
          tb.setAttribute('aria-haspopup', 'menu'); tb.setAttribute('aria-expanded', 'false');
          tb.appendChild(el('span', '', 'Add to')); tb.appendChild(el('b', '', tp ? tp.name : ''));
          tb.appendChild(glyph(GLYPH, 'chev', 'ic'));
          tb.addEventListener('click', () => togglePopover(tb, 'addTarget', buildAddTarget));
          add.appendChild(tb);
        }
        const input = document.createElement('input');
        input.placeholder = 'Add an item, e.g. bug: login 401';
        input.setAttribute('aria-label', 'Add an item to ' + s.name);
        input.maxLength = 300;
        input.dataset.add = s.id;
        input.enterKeyHint = 'done';
        const aiOn = aiAvailable();
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if ((e.metaKey || e.ctrlKey) && aiOn) addWithAI(s.id, input.value); else addItem(s.id, input.value);
            input.value = '';
          }
          if (e.key === 'Escape') { input.value = ''; input.blur(); }
        });
        const rowEl = el('div', 'add-row');
        rowEl.appendChild(input);
        if (aiOn) {
          const ab = el('button', 'ai-add'); ab.type = 'button';
          ab.title = 'Add with AI (Ctrl/Cmd + Enter)'; ab.setAttribute('aria-label', 'Add with AI');
          ab.appendChild(glyph(GLYPH, 'spark', 'ic')); ab.appendChild(el('span', '', 'AI'));
          ab.addEventListener('mousedown', e => e.preventDefault());
          ab.addEventListener('click', () => {
            if (!input.value.trim()) { input.focus(); showToast('Type a short note first, then tap AI.'); return; }
            addWithAI(s.id, input.value); input.value = '';
          });
          rowEl.appendChild(ab);
        }
        add.appendChild(rowEl);
      }
      col.appendChild(add);
      board.appendChild(col);
    }

    board.scrollLeft = scrollLeft;
    board.querySelectorAll('.list').forEach(l => { if (scrolls[l.dataset.status] != null) l.scrollTop = scrolls[l.dataset.status]; });
    if (typing) {
      const again = board.querySelector('input[data-add="' + typing.status + '"]');
      if (again) { again.value = typing.value; again.focus(); try { again.setSelectionRange(typing.start, typing.end); } catch (e) {} }
    }
  }

  function startPanel() {
    const box = el('div', 'start');
    box.appendChild(el('h2', '', 'Create your first project'));
    box.appendChild(el('p', '', 'Projects hold your features, bugs and tasks. You can add more later from the project menu.'));
    const row = el('div', 'row');
    const input = document.createElement('input');
    input.placeholder = 'Project name'; input.maxLength = 60; input.setAttribute('aria-label', 'Project name');
    const b = el('button', 'btn primary', 'Create project'); b.type = 'button';
    const go = () => { if (createProject(input.value)) input.value = ''; };
    b.addEventListener('click', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    row.appendChild(input); row.appendChild(b); box.appendChild(row);
    return box;
  }

  function cardNode(it) {
    const n = el('div', 'card' + (it.status === 'done' ? ' done' : ''));
    n.dataset.id = it.id; n.dataset.p = it.priority || 'med';
    n.tabIndex = 0; n.setAttribute('role', 'button');

    const top = el('div', 'card-top');
    top.appendChild(el('span', 'type t-' + (TYPES[it.type] ? it.type : 'task'), TYPES[it.type] || 'Task'));
    if (ui.projectId === 'all') { const p = state.projects[it.projectId]; if (p) top.appendChild(el('span', 'cproj', p.name)); }
    const d = dueInfo(it);
    if (aiBusy[it.id]) top.appendChild(el('span', 'due ai-busy-label', 'AI is writing…'));
    else if (d) top.appendChild(el('span', 'due ' + d.cls, d.label));
    n.appendChild(top);
    n.appendChild(el('div', 'title', it.title));

    const foot = el('div', 'card-foot');
    const tags = arr(it.tags);
    tags.slice(0, 3).forEach(t => foot.appendChild(el('span', 'tag', '#' + t)));
    if (tags.length > 3) foot.appendChild(el('span', '', '+' + (tags.length - 3)));
    const cl = arr(it.checklist);
    if (cl.length) {
      const done = cl.filter(c => c.done).length;
      const s = el('span', 'stat' + (done === cl.length ? ' ok' : '')); s.appendChild(glyph(GLYPH, 'check', 'ic')); s.appendChild(document.createTextNode(done + '/' + cl.length));
      foot.appendChild(s);
    }
    const nl = arr(it.links).length;
    if (nl) { const s = el('span', 'stat'); s.appendChild(glyph(GLYPH, 'link', 'ic')); s.appendChild(document.createTextNode(String(nl))); foot.appendChild(s); }
    const nc = arr(it.log).filter(l => l.kind === 'comment').length;
    if (nc) { const s = el('span', 'stat'); s.appendChild(glyph(GLYPH, 'comment', 'ic')); s.appendChild(document.createTextNode(String(nc))); foot.appendChild(s); }
    if (foot.childNodes.length) n.appendChild(foot);

    n.addEventListener('click', () => openItem(it.id));
    n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(it.id); } });

    if (CAN_DRAG) {
      n.draggable = true;
      n.addEventListener('dragstart', e => {
        dragId = it.id;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', it.id); } catch (err) {}
        setTimeout(() => n.classList.add('dragging'), 0);
      });
      n.addEventListener('dragend', () => {
        n.classList.remove('dragging');
        dragId = null;
        if (ph.parentNode) ph.parentNode.removeChild(ph);
        document.querySelectorAll('.list.over').forEach(l => l.classList.remove('over'));
        if (renderQueued) { renderQueued = false; scheduleRender(); }
      });
    }
    return n;
  }

  /* ---------- Drag and drop (desktop) ---------- */
  const ph = el('div', 'ph');
  function afterElement(list, y) {
    const els = list.querySelectorAll('.card:not(.dragging)');
    for (const c of els) { const r = c.getBoundingClientRect(); if (y < r.top + r.height / 2) return c; }
    return null;
  }
  function wireDrop(list, status) {
    list.addEventListener('dragover', e => {
      if (!dragId) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      list.classList.add('over');
      const after = afterElement(list, e.clientY);
      if (after) list.insertBefore(ph, after); else list.appendChild(ph);
    });
    list.addEventListener('dragleave', e => {
      if (!list.contains(e.relatedTarget)) { list.classList.remove('over'); if (ph.parentNode === list) list.removeChild(ph); }
    });
    list.addEventListener('drop', e => {
      if (!dragId) return;
      e.preventDefault();
      const next = ph.nextElementSibling;
      const beforeId = next && next.classList.contains('card') ? next.dataset.id : null;
      const id = dragId;
      if (ph.parentNode) ph.parentNode.removeChild(ph);
      list.classList.remove('over');
      dragId = null;
      moveItem(id, status, beforeId);
    });
  }

  /* ---------- Mutations ---------- */
  function logEntry(kind, text) { return { id: uid(), kind, text, at: nowISO() }; }

  function makeItem(status, raw, createdText) {
    const projectId = ui.projectId === 'all' ? addTarget() : ui.projectId;
    let title = str(raw).trim(); if (!title || !projectId) return null;
    let type = 'task';
    const m = title.match(/^(bug|feature|feat|task)\s*:\s*/i);
    if (m) { const w = m[1].toLowerCase(); type = w === 'feat' ? 'feature' : w; title = title.slice(m[0].length).trim(); if (!title) return null; }
    return {
      id: uid(), projectId, title: title.slice(0, 300), type, status, priority: 'med',
      tags: [], description: '', checklist: [], links: [], log: [logEntry('created', createdText || 'Created')],
      due: null, order: nextOrder(status), createdAt: nowISO()
    };
  }
  function addItem(status, raw) { const it = makeItem(status, raw); if (it) put('items', it); }

  /* ---------- AI ---------- */
  let sampleFn = null, aiOff = false;
  const aiBusy = {};
  let toastT = null;
  function aiAvailable() { return !!sampleFn && !aiOff; }
  function showToast(msg) {
    if (!msg) return;
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4500);
  }
  function aiErrorText(e) {
    const c = e && e.code;
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].indexOf(c) > -1) {
      aiOff = true; scheduleRender(); if (cur) renderAiBar();
      return c === 'not_granted' ? 'AI was not allowed, so it is off for this visit.' : 'AI is not available on this page right now.';
    }
    if (c === 'cancelled') return '';
    if (c === 'rate_limited') return 'Too many AI requests. Wait a minute and try again.';
    if (c === 'session_expired') return 'Your session expired. Reload the page.';
    if (c === 'invalid_json' || c === 'empty_completion') return 'The AI reply could not be read. Try again.';
    if (c === 'refused') return 'The AI declined this one. Reword the note and try again.';
    if (c === 'prompt_too_large') return 'This item is too long for the AI. Trim the description.';
    return 'The AI request failed. Try again.';
  }

  function buildPrompt(note, item, projectName) {
    const existing = allTags().slice(0, 60);
    const current = item ? {
      title: item.title, type: item.type, priority: item.priority, due: item.due,
      description: str(item.description).slice(0, 6000),
      checklist: arr(item.checklist).map(c => c.text).slice(0, 30),
      tags: arr(item.tags)
    } : null;
    return [
      'You turn a developer\'s short note into a clear item for their personal kanban board.',
      '',
      'Project: ' + (projectName || 'unnamed'),
      "Today's date: " + dayStr(new Date()),
      'Tags already used on the board: ' + (existing.length ? existing.join(', ') : 'none'),
      current ? 'Current item (keep every fact in it):\n' + JSON.stringify(current, null, 2) : '',
      note ? 'Developer note:\n' + note : '',
      '',
      'Rules:',
      '- Use only facts from the note and the current item. Never invent error messages, file names, versions, numbers, people or root causes.',
      '- When something important is unknown, add it under an "Open questions:" line in the description instead of guessing.',
      '- title: specific, under 80 characters. Bugs describe the symptom ("Token refresh returns 401 on SharePoint calls"). Features and tasks start with a verb.',
      '- type: "bug" for broken behaviour, "feature" for new capability, "task" for everything else. Keep the current type if one is given and it fits.',
      '- priority: "high", "med" or "low". Use "med" unless the note signals urgency or low importance.',
      '- due: "YYYY-MM-DD" only if the note states a deadline (resolve words like "Friday" against today\'s date), otherwise null. Keep a current due date.',
      '- description: plain text, at most about 120 words, short labelled lines. For bugs use "Context:", "Expected:", "Actual:" where known. For features and tasks use "Goal:" and "Done when:". Use "- " for list lines. No markdown headings or bold.',
      '- checklist: 2 to 6 concrete next steps, each under 80 characters. Include the current checklist points first, unchanged.',
      '- tags: 1 to 4 short lowercase tags without "#". Reuse existing board tags when they fit. Keep current tags.',
      '',
      'Reply with only this JSON object:',
      '{"title": "...", "type": "bug", "priority": "med", "due": null, "description": "...", "checklist": ["..."], "tags": ["..."]}'
    ].filter(Boolean).join('\n');
  }
  function normSuggestion(o, fallback) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw { code: 'invalid_json' };
    const title = str(o.title).replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!title) throw { code: 'invalid_json' };
    const tags = arr(o.tags).filter(t => typeof t === 'string').map(t => t.replace(/^#/, '').replace(/,/g, '').trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 6);
    return {
      title,
      type: TYPES[o.type] ? o.type : (fallback && fallback.type) || 'task',
      priority: PRIOS[o.priority] ? o.priority : (fallback && fallback.priority) || 'med',
      due: /^\d{4}-\d{2}-\d{2}$/.test(str(o.due)) ? o.due : (fallback && fallback.due) || null,
      description: str(o.description).trim().slice(0, 8000),
      checklist: arr(o.checklist).filter(c => typeof c === 'string' && c.trim()).map(c => c.trim().slice(0, 300)).slice(0, 12),
      tags
    };
  }
  async function askAI(note, item, opts, projectId) {
    const p = state.projects[projectId || (item && item.projectId) || ui.projectId];
    const raw = await sampleFn.json(buildPrompt(note, item, p && p.name), Object.assign({ modelTier: 'quick' }, opts || {}));
    return normSuggestion(raw, item);
  }
  function applySuggestion(it, sg) {
    it.title = sg.title; it.type = sg.type; it.priority = sg.priority;
    if (sg.due) it.due = sg.due;
    if (sg.description) it.description = sg.description;
    const tags = arr(it.tags).slice();
    for (const t of sg.tags) if (!tags.some(x => x.toLowerCase() === t) && tags.length < 20) tags.push(t);
    it.tags = tags;
    const cl = arr(it.checklist).slice();
    for (const c of sg.checklist) if (!cl.some(x => x.text.trim().toLowerCase() === c.toLowerCase())) cl.push({ id: uid(), text: c, done: false });
    it.checklist = cl;
    it.log = arr(it.log).concat([logEntry('ai', 'Expanded with AI')]);
    return it;
  }

  async function addWithAI(status, raw) {
    if (!aiAvailable()) { addItem(status, raw); return; }
    const note = str(raw).trim();
    const base = makeItem(status, note, 'Created from note: ' + note.slice(0, 300));
    if (!base) return;
    put('items', base);
    aiBusy[base.id] = true; scheduleRender();
    try {
      const sg = await askAI(note, null, null, base.projectId);
      const latest = state.items[base.id];
      if (!latest) return;
      const keepType = base.type !== 'task' ? base.type : null;
      const u = applySuggestion(clone(latest), sg);
      if (keepType) u.type = keepType;
      put('items', u);
      if (cur && cur.id === base.id) { clearTimeout(saveT); saveT = null; openItem(base.id, true); }
    } catch (e) { showToast(aiErrorText(e)); }
    finally { delete aiBusy[base.id]; scheduleRender(); if (cur && cur.id === base.id) renderAiBar(); }
  }

  function moveItem(id, status, beforeId) {
    const it = state.items[id]; if (!it) return;
    const list = columnItems(status).filter(x => x.id !== id);
    const idx = beforeId ? list.findIndex(x => x.id === beforeId) : -1;
    let order;
    if (idx === -1) order = list.length ? list[list.length - 1].order + 1 : nextOrder(status, id);
    else { const nx = list[idx], pv = list[idx - 1]; order = pv ? (pv.order + nx.order) / 2 : nx.order - 1; }
    const u = clone(it);
    const changed = u.status !== status;
    u.status = status; u.order = order;
    if (changed) u.log = arr(u.log).concat([logEntry('status', 'Moved to ' + STATUS_NAME[status])]);
    put('items', u);
  }

  function createProject(name, keepView) {
    name = str(name).trim(); if (!name) return null;
    const order = projectList().reduce((m, p) => Math.max(m, p.order || 0), 0) + 1;
    const p = { id: uid(), name: name.slice(0, 60), order, createdAt: nowISO() };
    put('projects', p);
    if (!keepView) { ui.projectId = p.id; saveUI(); }
    render();
    return p.id;
  }
  function addTarget() {
    if (ui.addTo && state.projects[ui.addTo]) return ui.addTo;
    const first = projectList()[0];
    return first ? first.id : null;
  }

  /* ---------- Popover menus (anchored dropdowns) ---------- */
  let pop = null, popClosedAt = 0;
  function closePopover() {
    if (!pop) return;
    pop.anchor.setAttribute('aria-expanded', 'false');
    pop.el.remove(); pop = null; popClosedAt = Date.now();
  }
  function positionPopover() {
    if (!pop) return;
    const p = pop.el, r = pop.anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    p.style.maxHeight = Math.max(180, vh - r.bottom - 16) + 'px';
    const w = p.offsetWidth;
    let left = r.left;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    p.style.left = left + 'px';
    p.style.top = (r.bottom + 6) + 'px';
  }
  function togglePopover(anchor, kind, build, cls) {
    if (pop && pop.anchor === anchor) { closePopover(); return; }
    closePopover();
    const p = el('div', 'popover' + (cls ? ' ' + cls : '')); p.setAttribute('role', 'menu');
    (anchor.closest('dialog') || document.body).appendChild(p);
    pop = { el: p, anchor, kind };
    anchor.setAttribute('aria-expanded', 'true');
    build(p);
    positionPopover();
    if (CAN_DRAG) { const f = p.querySelector('.menu-item.sel, .menu-item, .proj-pick'); if (f) f.focus(); }
  }
  function menuItem(label, selected, onPick, opts) {
    const b = el('button', 'menu-item' + (selected ? ' sel' : '')); b.type = 'button';
    b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', selected ? 'true' : 'false');
    if (opts && opts.cls) b.appendChild(el('span', 'nm ' + opts.cls, label)); else b.appendChild(el('span', 'nm', label));
    if (opts && opts.count != null) b.appendChild(el('span', 'n', opts.count));
    if (selected) b.appendChild(glyph(GLYPH, 'tick', 'ic'));
    b.addEventListener('click', onPick);
    return b;
  }
  function newProjectRow(placeholder, onCreate) {
    const row = el('div', 'new-proj');
    const input = document.createElement('input'); input.placeholder = placeholder; input.maxLength = 60; input.setAttribute('aria-label', placeholder);
    const b = el('button', 'btn primary small', 'Add'); b.type = 'button';
    const go = () => { const id = createProject(input.value, true); if (id) onCreate(id); };
    b.addEventListener('click', go);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    row.appendChild(input); row.appendChild(b);
    return row;
  }
  function openCounts() {
    const c = {};
    for (const it of Object.values(state.items)) if (it.status !== 'done') c[it.projectId] = (c[it.projectId] || 0) + 1;
    return c;
  }
  function buildAddTarget(p) {
    p.appendChild(el('div', 'pop-label', 'Add new items to'));
    const cur0 = addTarget(), counts = openCounts();
    projectList().forEach(pr => p.appendChild(menuItem(pr.name, pr.id === cur0, () => {
      ui.addTo = pr.id; saveUI(); closePopover(); render();
      const i = document.querySelector('input[data-add="' + ui.tab + '"]'); if (i && CAN_DRAG) i.focus();
    }, { count: (counts[pr.id] || 0) + ' open' })));
    p.appendChild(newProjectRow('New project', id => { ui.addTo = id; saveUI(); closePopover(); render(); }));
  }
  document.addEventListener('pointerdown', e => {
    if (pop && !pop.el.contains(e.target) && !pop.anchor.contains(e.target)) closePopover();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop) { e.preventDefault(); e.stopPropagation(); closePopover(); }
  }, true);
  window.addEventListener('resize', closePopover);
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('cancel', e => {
    if (Date.now() - popClosedAt < 80) e.preventDefault();
  }));
  function renameProject(id, name) {
    name = str(name).trim(); const p = state.projects[id]; if (!p || !name) return;
    const u = clone(p); u.name = name.slice(0, 60); put('projects', u);
  }
  function deleteProject(id) {
    const ops = Object.values(state.items).filter(it => it.projectId === id).map(it => ({ kind: 'items', op: 'delete', id: it.id }));
    ops.push({ kind: 'projects', op: 'delete', id });
    if (ui.projectId === id) { ui.projectId = 'all'; saveUI(); }
    writeMany(ops);
  }

  /* ---------- Project menu ---------- */
  let renaming = null;
  function armButton(btn, idle, armed, action) {
    btn.textContent = idle;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.armed) { action(); return; }
      btn.dataset.armed = '1'; btn.textContent = armed;
      setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = idle; } }, 3000);
    });
  }
  function renderProjList() {
    const box = $('projList'); if (!box) return; box.textContent = '';
    const counts = {};
    for (const it of Object.values(state.items)) if (it.status !== 'done') counts[it.projectId] = (counts[it.projectId] || 0) + 1;
    const total = Object.values(state.items).filter(it => it.status !== 'done').length;

    const rows = [{ id: 'all', name: 'All projects', n: total }].concat(projectList().map(p => ({ id: p.id, name: p.name, n: counts[p.id] || 0, real: true })));
    for (const r of rows) {
      const row = el('div', 'proj-row' + (ui.projectId === r.id ? ' current' : ''));
      if (renaming === r.id) {
        const input = document.createElement('input'); input.value = r.name; input.maxLength = 60; input.setAttribute('aria-label', 'Project name');
        const save = el('button', 'btn small primary', 'Save'); save.type = 'button';
        const done = () => { renameProject(r.id, input.value); renaming = null; renderProjList(); };
        save.addEventListener('click', done);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { e.preventDefault(); renaming = null; renderProjList(); } });
        row.appendChild(input); row.appendChild(save);
        box.appendChild(row);
        setTimeout(() => input.focus(), 0);
        continue;
      }
      const pick = el('button', 'proj-pick'); pick.type = 'button';
      pick.appendChild(el('span', 'nm', r.name)); pick.appendChild(el('span', 'n', r.n + ' open'));
      if (ui.projectId === r.id) pick.appendChild(glyph(GLYPH, 'tick', 'ic'));
      pick.addEventListener('click', () => { ui.projectId = r.id; saveUI(); closePopover(); render(); });
      row.appendChild(pick);
      if (r.real) {
        const rn = el('button', 'btn ghost small', 'Rename'); rn.type = 'button';
        rn.addEventListener('click', () => { renaming = r.id; renderProjList(); });
        const dl = el('button', 'btn ghost small danger'); dl.type = 'button';
        const all = Object.values(state.items).filter(it => it.projectId === r.id).length;
        armButton(dl, 'Delete', all ? 'Delete ' + all + ' items' : 'Confirm', () => { deleteProject(r.id); });
        row.appendChild(rn); row.appendChild(dl);
      }
      box.appendChild(row);
    }
  }
  $('projBtn').addEventListener('click', () => {
    if (!state.ready) return;
    renaming = null;
    togglePopover($('projBtn'), 'proj', p => {
      const list = el('div', 'proj-list'); list.id = 'projList'; p.appendChild(list);
      p.appendChild(newProjectRow('New project', id => { ui.projectId = id; saveUI(); closePopover(); render(); }));
      renderProjList();
    });
  });

  /* ---------- Item detail ---------- */
  const itemDlg = $('itemDlg');
  let cur = null, saveT = null;

  function openItem(id, refresh) {
    const it = state.items[id]; if (!it) return;
    cur = clone(it);
    cur.tags = arr(cur.tags); cur.checklist = arr(cur.checklist); cur.links = arr(cur.links); cur.log = arr(cur.log);
    renderDetail();
    if (refresh) { requestAnimationFrame(() => { grow($('dTitle')); grow($('dDesc')); }); return; }
    resetAiPanel();
    itemDlg.showModal();
    $('dDelete').textContent = 'Delete'; delete $('dDelete').dataset.armed;
    requestAnimationFrame(() => { grow($('dTitle')); grow($('dDesc')); $('itemDlg').querySelector('.sheet-body').scrollTop = 0; });
  }
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveNow, 600); }
  function saveNow() {
    clearTimeout(saveT); saveT = null;
    if (!cur || !state.items[cur.id]) return;
    const copy = clone(cur);
    copy.title = copy.title.trim() || 'Untitled';
    put('items', copy);
  }

  function renderDetail() {
    renderDetailHead();
    $('dTitle').value = cur.title;
    $('dPrio').value = PRIOS[cur.priority] ? cur.priority : 'med';
    $('dDue').value = cur.due || '';
    $('dDesc').value = cur.description || '';
    $('dCreated').textContent = 'Created ' + fullTime(cur.createdAt);
    renderStatusSeg(); renderTags(); renderChecklist(); renderLinks(); renderLog(); renderAiBar();
  }

  /* detail AI: expand with preview */
  let aiCtl = null, aiSug = null;
  function renderAiBar() {
    const bar = $('dAiBar'), btn = $('dAi');
    bar.hidden = !aiAvailable() || !cur;
    if (bar.hidden) { $('dAiPanel').hidden = true; return; }
    btn.textContent = '';
    btn.appendChild(glyph(GLYPH, 'spark', 'ic'));
    const busy = !!(cur && aiBusy[cur.id]);
    btn.appendChild(el('span', '', busy ? 'AI is writing this item…' : 'Expand with AI'));
    btn.disabled = busy || !!aiCtl;
  }
  function resetAiPanel() {
    if (aiCtl) { try { aiCtl.abort(); } catch (e) {} }
    aiCtl = null; aiSug = null;
    const pn = $('dAiPanel'); pn.hidden = true; pn.textContent = '';
  }
  async function expandCurrent(fresh) {
    if (!cur || !aiAvailable()) return;
    if (saveT) saveNow();
    const pn = $('dAiPanel');
    pn.textContent = ''; pn.hidden = false; aiSug = null;
    const row = el('div', 'actions');
    row.appendChild(el('span', 'thinking push', 'Thinking…'));
    const stop = el('button', 'btn small', 'Stop'); stop.type = 'button';
    row.appendChild(stop); pn.appendChild(row);
    const ctl = new AbortController(); aiCtl = ctl;
    stop.addEventListener('click', () => ctl.abort());
    renderAiBar();
    const forId = cur.id;
    try {
      const sg = await askAI('', clone(cur), fresh ? { signal: ctl.signal, cache: false } : { signal: ctl.signal });
      if (aiCtl !== ctl || !cur || cur.id !== forId) return;
      aiCtl = null; aiSug = sg; renderPreview(); renderAiBar();
    } catch (e) {
      if (aiCtl !== ctl) return;
      aiCtl = null;
      const msg = aiErrorText(e);
      pn.textContent = '';
      if (msg) {
        const r = el('div', 'actions');
        r.appendChild(el('span', 'push hint', msg));
        if (!aiOff) { const again = el('button', 'btn small', 'Try again'); again.type = 'button'; again.addEventListener('click', () => expandCurrent(true)); r.appendChild(again); }
        pn.appendChild(r);
      } else pn.hidden = true;
      renderAiBar();
    }
  }
  function renderPreview() {
    const pn = $('dAiPanel'), sg = aiSug; pn.textContent = '';
    pn.appendChild(el('h5', '', 'Suggested version'));
    pn.appendChild(el('div', 's-title', sg.title));
    const meta = el('div', 's-meta');
    meta.appendChild(el('span', 't-' + sg.type, TYPES[sg.type]));
    meta.appendChild(el('span', '', PRIOS[sg.priority] + ' priority'));
    if (sg.due) { const d = parseDay(sg.due); meta.appendChild(el('span', '', 'Due ' + (d ? shortDate(d) : sg.due))); }
    sg.tags.forEach(t => meta.appendChild(el('span', 'tag', '#' + t)));
    pn.appendChild(meta);
    if (sg.description) pn.appendChild(el('div', 's-desc', sg.description));
    if (sg.checklist.length) {
      const ul = el('ul'); sg.checklist.forEach(c => ul.appendChild(el('li', '', c))); pn.appendChild(ul);
    }
    pn.appendChild(el('p', 'hint', 'Applying replaces the title, type, priority and description. Tags and checklist points are added to what you have.'));
    const r = el('div', 'actions');
    const discard = el('button', 'btn small ghost push', 'Discard'); discard.type = 'button';
    discard.addEventListener('click', resetAiPanel);
    const again = el('button', 'btn small', 'Try again'); again.type = 'button';
    again.addEventListener('click', () => expandCurrent(true));
    const apply = el('button', 'btn small primary', 'Apply'); apply.type = 'button';
    apply.addEventListener('click', () => {
      if (!cur || !aiSug) return;
      applySuggestion(cur, aiSug);
      saveNow(); resetAiPanel(); renderDetail();
      requestAnimationFrame(() => { grow($('dTitle')); grow($('dDesc')); });
    });
    r.appendChild(discard); r.appendChild(again); r.appendChild(apply);
    pn.appendChild(r);
  }
  function renderStatusSeg() {
    const seg = $('dStatus'); seg.textContent = '';
    for (const s of STATUSES) {
      const b = el('button', 'seg-btn'); b.type = 'button';
      b.setAttribute('aria-pressed', cur.status === s.id ? 'true' : 'false');
      b.appendChild(glyph(ICON, s.id)); b.appendChild(el('span', '', s.name));
      b.addEventListener('click', () => setStatus(s.id));
      seg.appendChild(b);
    }
  }
  function setStatus(s) {
    if (!cur || cur.status === s) return;
    cur.status = s; cur.order = nextOrder(s, cur.id);
    cur.log.push(logEntry('status', 'Moved to ' + STATUS_NAME[s]));
    saveNow(); renderStatusSeg(); renderLog();
  }

  function renderTags() {
    const box = $('dTags'); box.textContent = '';
    cur.tags.forEach((t, i) => {
      const c = el('span', 'tag-chip'); c.appendChild(el('span', '', '#' + t));
      const x = el('button', '', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove tag ' + t);
      x.addEventListener('click', () => { cur.tags.splice(i, 1); saveNow(); renderTags(); });
      c.appendChild(x); box.appendChild(c);
    });
    const input = document.createElement('input');
    input.className = 'tag-input'; input.placeholder = cur.tags.length ? 'Add tag' : 'Add a tag, e.g. auth';
    input.maxLength = 30; input.setAttribute('aria-label', 'Add tag'); input.setAttribute('list', 'tagList');
    input.enterKeyHint = 'done';
    let dl = $('tagList'); if (!dl) { dl = document.createElement('datalist'); dl.id = 'tagList'; document.body.appendChild(dl); }
    dl.textContent = ''; allTags().forEach(t => { const o = document.createElement('option'); o.value = t; dl.appendChild(o); });
    const commit = (refocus) => {
      const v = input.value.replace(/^#/, '').replace(/,/g, '').trim();
      if (v && !cur.tags.some(t => t.toLowerCase() === v.toLowerCase()) && cur.tags.length < 20) {
        cur.tags.push(v); saveNow(); renderTags();
        if (refocus) { const again = $('dTags').querySelector('.tag-input'); if (again) again.focus(); }
      } else input.value = '';
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(true); }
      if (e.key === 'Backspace' && !input.value && cur.tags.length) { cur.tags.pop(); saveNow(); renderTags(); const again = $('dTags').querySelector('.tag-input'); if (again) again.focus(); }
    });
    input.addEventListener('blur', () => { if (input.value.trim()) commit(false); });
    box.appendChild(input);
  }

  function renderChecklist() {
    const box = $('dChecklist'); box.textContent = '';
    const done = cur.checklist.filter(c => c.done).length;
    $('dCheckCount').textContent = cur.checklist.length ? done + ' of ' + cur.checklist.length + ' done' : '';
    cur.checklist.forEach((c, i) => {
      const row = el('div', 'check-row' + (c.done ? ' is-done' : ''));
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!c.done; cb.setAttribute('aria-label', 'Mark done');
      cb.addEventListener('change', () => { c.done = cb.checked; saveNow(); renderChecklist(); });
      const tx = document.createElement('input'); tx.className = 'ctext'; tx.value = c.text; tx.maxLength = 300; tx.setAttribute('aria-label', 'Checklist point');
      tx.addEventListener('input', () => { c.text = tx.value; saveSoon(); });
      tx.addEventListener('blur', () => { if (!tx.value.trim()) { cur.checklist.splice(cur.checklist.indexOf(c), 1); saveNow(); renderChecklist(); } });
      tx.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('dCheckAdd').focus(); } });
      const x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove point');
      x.addEventListener('mousedown', e => e.preventDefault());
      x.addEventListener('click', () => { cur.checklist.splice(i, 1); saveNow(); renderChecklist(); });
      row.appendChild(cb); row.appendChild(tx); row.appendChild(x); box.appendChild(row);
    });
    box.hidden = !cur.checklist.length;
  }

  function renderLinks() {
    const box = $('dLinks'); box.textContent = '';
    cur.links.forEach((l, i) => {
      const row = el('div', 'link-row');
      const a = el('a', '', l.label || hostOf(l.url) || l.url); a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      row.appendChild(a);
      if (l.label) row.appendChild(el('span', 'host', hostOf(l.url)));
      const x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove link');
      x.addEventListener('click', () => { cur.links.splice(i, 1); saveNow(); renderLinks(); });
      row.appendChild(x); box.appendChild(row);
    });
    box.hidden = !cur.links.length;
  }

  function renderLog() {
    const box = $('dLog'); box.textContent = '';
    const entries = cur.log.slice().reverse();
    for (const l of entries) {
      if (l.kind === 'comment') {
        const e = el('div', 'entry');
        const meta = el('div', 'meta');
        const t = el('time', '', rel(l.at)); t.title = fullTime(l.at); t.dateTime = l.at;
        meta.appendChild(t);
        const x = el('button', 'x', 'Remove'); x.type = 'button';
        armButton(x, 'Remove', 'Confirm', () => { cur.log = cur.log.filter(z => z.id !== l.id); saveNow(); renderLog(); });
        meta.appendChild(x);
        e.appendChild(meta); e.appendChild(el('div', 'text', l.text));
        box.appendChild(e);
      } else {
        const e = el('div', 'entry sys');
        if (l.kind === 'ai') e.appendChild(glyph(GLYPH, 'spark', 'ic'));
        if (l.kind === 'status') {
          const sid = Object.keys(STATUS_NAME).find(k => l.text === 'Moved to ' + STATUS_NAME[k]);
          if (sid) e.appendChild(glyph(ICON, sid));
        }
        e.appendChild(el('span', '', l.text));
        const t = el('time', '', rel(l.at)); t.title = fullTime(l.at); t.dateTime = l.at;
        e.appendChild(t);
        box.appendChild(e);
      }
    }
  }

  // static detail wiring
  $('dTitle').addEventListener('input', e => { cur.title = e.target.value.replace(/\n/g, ' '); grow(e.target); saveSoon(); });
  $('dTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
  $('dPrio').addEventListener('change', e => { cur.priority = e.target.value; saveNow(); });
  $('dDue').addEventListener('change', e => { cur.due = e.target.value || null; saveNow(); });
  $('dDueClear').addEventListener('click', e => { e.preventDefault(); $('dDue').value = ''; cur.due = null; saveNow(); });
  $('dDesc').addEventListener('input', e => { cur.description = e.target.value; grow(e.target); saveSoon(); });
  $('dCheckAdd').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = e.target.value.trim(); if (!v) return;
    cur.checklist.push({ id: uid(), text: v, done: false });
    e.target.value = ''; saveNow(); renderChecklist();
  });
  function addLink() {
    const url = safeUrl($('dLinkUrl').value);
    if (!url) { $('dLinkUrl').focus(); $('dLinkUrl').setCustomValidity('Enter a web address'); $('dLinkUrl').reportValidity(); return; }
    $('dLinkUrl').setCustomValidity('');
    cur.links.push({ id: uid(), url, label: $('dLinkLabel').value.trim() });
    $('dLinkUrl').value = ''; $('dLinkLabel').value = '';
    saveNow(); renderLinks();
  }
  $('dLinkUrl').addEventListener('input', e => e.target.setCustomValidity(''));
  $('dLinkAdd').addEventListener('click', addLink);
  $('dLinkLabel').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } });
  $('dLinkUrl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } });
  $('dComment').addEventListener('input', e => grow(e.target));
  function post() {
    const v = $('dComment').value.trim(); if (!v) return;
    if (cur.log.length >= 500) cur.log = cur.log.slice(-450);
    cur.log.push(logEntry('comment', v));
    $('dComment').value = ''; grow($('dComment'));
    saveNow(); renderLog();
  }
  $('dPost').addEventListener('click', post);
  $('dComment').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); } });
  function renderDetailHead() {
    if (!cur) return;
    const p = state.projects[cur.projectId];
    $('dProjName').textContent = p ? p.name : 'No project';
    const t = TYPES[cur.type] ? cur.type : 'task';
    $('dTypeName').textContent = TYPES[t]; $('dTypeName').className = 't-' + t;
  }
  function moveToProject(id) {
    if (!cur || cur.projectId === id) { closePopover(); return; }
    cur.projectId = id;
    const pr = state.projects[id];
    cur.log.push(logEntry('status', 'Moved to project ' + (pr ? pr.name : '')));
    saveNow(); renderDetailHead(); renderLog(); closePopover();
  }
  $('dProjBtn').addEventListener('click', () => togglePopover($('dProjBtn'), 'itemProj', p => {
    p.appendChild(el('div', 'pop-label', 'Move to project'));
    const counts = openCounts();
    projectList().forEach(pr => p.appendChild(menuItem(pr.name, pr.id === cur.projectId, () => moveToProject(pr.id), { count: (counts[pr.id] || 0) + ' open' })));
    p.appendChild(newProjectRow('New project', id => moveToProject(id)));
  }));
  $('dTypeBtn').addEventListener('click', () => togglePopover($('dTypeBtn'), 'itemType', p => {
    Object.keys(TYPES).forEach(t => p.appendChild(menuItem(TYPES[t], cur.type === t, () => {
      cur.type = t; saveNow(); renderDetailHead(); closePopover();
    }, { cls: 't-' + t })));
  }, 'narrow'));
  armButton($('dDelete'), 'Delete', 'Tap again to delete', () => {
    if (!cur) return;
    clearTimeout(saveT); saveT = null;
    const id = cur.id; cur = null;
    itemDlg.close(); del('items', id);
  });
  $('dClose').addEventListener('click', () => itemDlg.close());
  $('dAi').addEventListener('click', () => expandCurrent(false));
  itemDlg.addEventListener('close', () => { closePopover(); if (cur && saveT) saveNow(); resetAiPanel(); cur = null; });

  /* ---------- Backup ---------- */
  const backupDlg = $('backupDlg');
  function normItem(o, projectIds, fallbackProject) {
    const id = ID_RE.test(str(o.id)) ? o.id : uid();
    return {
      id,
      projectId: projectIds[o.projectId] ? o.projectId : fallbackProject,
      title: (str(o.title).trim() || 'Untitled').slice(0, 300),
      type: TYPES[o.type] ? o.type : (o.type === 'idea' ? 'feature' : 'task'),
      status: STATUS_NAME[o.status] ? o.status : 'backlog',
      priority: PRIOS[o.priority] ? o.priority : 'med',
      tags: arr(o.tags).filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().slice(0, 30)).slice(0, 20),
      description: str(o.description || o.notes),
      checklist: arr(o.checklist).filter(c => c && typeof c.text === 'string').map(c => ({ id: ID_RE.test(str(c.id)) ? c.id : uid(), text: c.text.slice(0, 300), done: !!c.done })),
      links: arr(o.links).map(l => ({ id: ID_RE.test(str(l && l.id)) ? l.id : uid(), url: safeUrl(l && l.url), label: str(l && l.label).slice(0, 80) })).filter(l => l.url),
      log: arr(o.log).filter(l => l && typeof l.text === 'string').map(l => ({ id: ID_RE.test(str(l.id)) ? l.id : uid(), kind: ['comment', 'status', 'created', 'ai'].indexOf(l.kind) > -1 ? l.kind : 'comment', text: l.text, at: str(l.at) || nowISO() })).slice(-500),
      due: /^\d{4}-\d{2}-\d{2}$/.test(str(o.due)) ? o.due : null,
      order: Number.isFinite(o.order) ? o.order : 0,
      createdAt: str(o.createdAt) || nowISO(),
      updatedAt: nowISO()
    };
  }
  $('backupBtn').addEventListener('click', () => {
    if (!state.ready) return;
    $('dump').value = JSON.stringify({ version: 2, exportedAt: nowISO(), projects: projectList(), items: Object.values(state.items) }, null, 2);
    $('backupMsg').textContent = '';
    backupDlg.showModal();
  });
  $('bClose').addEventListener('click', () => backupDlg.close());
  $('bCopy').addEventListener('click', () => {
    const ta = $('dump'); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    if (ok) { $('backupMsg').textContent = 'Copied.'; return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ta.value).then(() => { $('backupMsg').textContent = 'Copied.'; }, () => { $('backupMsg').textContent = 'Copy is blocked here. Select the text and copy it manually.'; });
    } else $('backupMsg').textContent = 'Copy is blocked here. Select the text and copy it manually.';
  });
  $('bLoad').addEventListener('click', () => {
    let data;
    try { data = JSON.parse($('dump').value); } catch (e) { $('backupMsg').textContent = 'That text is not valid JSON.'; return; }
    const ops = []; const projectIds = {};
    Object.keys(state.projects).forEach(id => { projectIds[id] = true; });
    let fallback = null;
    if (data && Array.isArray(data.projects) && Array.isArray(data.items)) {
      let order = projectList().reduce((m, p) => Math.max(m, p.order || 0), 0);
      for (const p of data.projects) {
        if (!p || !str(p.name).trim()) continue;
        const id = ID_RE.test(str(p.id)) ? p.id : uid();
        const obj = { id, name: str(p.name).trim().slice(0, 60), order: Number.isFinite(p.order) ? p.order : ++order, createdAt: str(p.createdAt) || nowISO(), updatedAt: nowISO() };
        projectIds[id] = true; ops.push({ kind: 'projects', op: 'set', obj });
        if (!fallback) fallback = id;
      }
      if (!fallback) fallback = Object.keys(projectIds)[0] || null;
      if (!fallback && data.items.length) {
        const obj = { id: uid(), name: 'Imported', order: 1, createdAt: nowISO(), updatedAt: nowISO() };
        projectIds[obj.id] = true; fallback = obj.id; ops.push({ kind: 'projects', op: 'set', obj });
      }
      for (const it of data.items) if (it && typeof it.title === 'string') ops.push({ kind: 'items', op: 'set', obj: normItem(it, projectIds, fallback) });
    } else if (data && Array.isArray(data.cards)) {
      // first Dev Board version
      const byName = {};
      let order = projectList().reduce((m, p) => Math.max(m, p.order || 0), 0);
      data.cards.forEach((c, i) => {
        if (!c || typeof c.title !== 'string') return;
        const name = str(c.project).trim() || 'Imported';
        if (!byName[name]) {
          const obj = { id: uid(), name: name.slice(0, 60), order: ++order, createdAt: nowISO(), updatedAt: nowISO() };
          byName[name] = obj.id; projectIds[obj.id] = true; ops.push({ kind: 'projects', op: 'set', obj });
        }
        ops.push({ kind: 'items', op: 'set', obj: normItem({ title: c.title, notes: c.notes, type: c.type, priority: c.priority, status: c.status, order: i + 1, projectId: byName[name] }, projectIds, byName[name]) });
      });
    } else { $('backupMsg').textContent = 'That text is not a Dev Board backup.'; return; }
    const n = ops.filter(o => o.kind === 'items').length;
    writeMany(ops).then(() => { $('backupMsg').textContent = S.error ? S.error : 'Loaded ' + n + ' items.'; });
  });

  /* ---------- Filters and shortcuts ---------- */
  document.querySelectorAll('#typeChips .chip').forEach(b => b.addEventListener('click', () => { ui.type = b.dataset.type; saveUI(); render(); }));
  document.querySelectorAll('#prioChips .chip').forEach(b => b.addEventListener('click', () => { ui.prio = b.dataset.prio; saveUI(); render(); }));
  const search = $('search');
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderBoard(); });
  document.addEventListener('keydown', e => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'n') { const i = document.querySelector('input[data-add="' + ui.tab + '"]') || document.querySelector('input[data-add]'); if (i) { e.preventDefault(); i.focus(); } }
    if (e.key === '/') { e.preventDefault(); search.focus(); }
  });
  // refresh relative times and due labels now and then
  setInterval(() => { if (!document.hidden && !dragId) scheduleRender(); }, 60000);

  init();
})();

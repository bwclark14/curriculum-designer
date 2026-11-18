(() => {
  'use strict';

  /* ---------- constants & helpers ---------- */
  const LEVELS = [
    { key: 'early',  name: 'Early',  hint: 'Pre-school – P1' },
    { key: 'first',  name: 'First',  hint: 'To end of P4' },
    { key: 'second', name: 'Second', hint: 'To end of P7' },
    { key: 'third',  name: 'Third',  hint: 'S1 – S3' },
    { key: 'fourth', name: 'Fourth', hint: 'S1 – S3, deeper' }
  ];
  const LV = Object.fromEntries(LEVELS.map(l => [l.key, l]));
  const STORE = 'curriculum-designer.v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = o => JSON.parse(JSON.stringify(o));
  const kind = d => ['Strand', 'Sub-strand', 'Sub-sub-strand'][d] || `Depth ${d} sub-strand`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ---------- state ---------- */
  let db = load();
  const ui = { view: 'matrix', focus: 'second', collapsed: new Set(), drawer: null };

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.areas) && d.areas.length) return d;
      }
    } catch (e) { /* storage unavailable: fall back to seed */ }
    return clone(window.SEED);
  }
  let savedTimer;
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* ignore */ }
    const el = $('#saved');
    el.classList.add('show');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => el.classList.remove('show'), 1100);
  }
  const area = () => db.areas.find(a => a.id === db.currentId) || db.areas[0];

  /* ---------- tree index & inheritance ---------- */
  let idx = {};
  function reindex() {
    idx = {};
    const walk = (list, parent, depth, path) => list.forEach((s, i) => {
      s.levels ||= {}; s.children ||= [];
      idx[s.id] = { s, parent, depth, list, i, path: [...path, s] };
      walk(s.children, s, depth + 1, [...path, s]);
    });
    walk(area().strands, null, 0, []);
  }

  /** What does strand `id` say at level `lvl`?
   *  status: 'na' | 'own' | 'inherit' | 'orphan'  (+ statements, source) */
  function resolve(id, lvl) {
    const n = idx[id];
    const L = n && n.s.levels[lvl];
    if (!L) return { status: 'na' };
    if (L.mode === 'own') return { status: 'own', statements: L.statements, source: n.s };
    if (!n.parent) return { status: 'orphan', reason: 'Top-level strands have no parent to inherit from.' };
    const up = resolve(n.parent.id, lvl);
    if (up.status === 'own' || up.status === 'inherit') {
      return { status: 'inherit', statements: up.statements, source: up.source, via: n.parent };
    }
    return { status: 'orphan', reason: `“${n.parent.name}” is not taught at ${LV[lvl].name} level, so there is nothing to inherit.` };
  }
  const inheritorsOf = (id, lvl) =>
    Object.values(idx).filter(n => n.s.id !== id && n.s.levels[lvl]?.mode === 'inherit' && resolve(n.s.id, lvl).source?.id === id);

  function canInherit(id, lvl) {
    const p = idx[id].parent;
    if (!p) return false;
    const r = resolve(p.id, lvl);
    return r.status === 'own' || r.status === 'inherit';
  }

  function applyLevel(s, lvl) {
    const prev = s.levels[lvl];
    s.levels[lvl] = canInherit(s.id, lvl)
      ? { mode: 'inherit', statements: prev?.statements || [] }
      : { mode: 'own', statements: prev?.statements?.length ? prev.statements : [''] };
  }

  /* ---------- rendering ---------- */
  function render() {
    reindex();
    renderTop();
    renderHero();
    renderBody();
    renderDrawer();
  }

  function renderTop() {
    $('#areaSelect').innerHTML = db.areas
      .map(a => `<option value="${a.id}" ${a.id === area().id ? 'selected' : ''}>${esc(a.name || 'Untitled area')}</option>`)
      .join('');
  }

  function renderHero() {
    const a = area();
    $('#hero').innerHTML = `
      <div class="hero">
        <div class="hero-main">
          <label class="eyebrow" for="f-name">Curriculum area</label>
          <input id="f-name" class="area-name" data-field="name" value="${esc(a.name)}" placeholder="Name this curriculum area">
          <label class="eyebrow" for="f-purpose">Purpose</label>
          <textarea id="f-purpose" class="purpose autosize" data-field="purpose" rows="2" placeholder="Why does this area matter? What is it for?">${esc(a.purpose)}</textarea>
          <div id="stats"></div>
        </div>
        <div class="hero-ideas">
          <div class="eyebrow">Big ideas</div>
          <ol class="ideas">
            ${a.bigIdeas.map((b, i) => `
              <li>
                <span class="idea-num">${i + 1}</span>
                <textarea class="autosize" rows="1" data-idea="${i}" aria-label="Big idea ${i + 1}" placeholder="A big idea learners should come to understand">${esc(b)}</textarea>
                <button class="icon-btn" data-action="del-idea" data-i="${i}" title="Remove big idea" aria-label="Remove big idea ${i + 1}">×</button>
              </li>`).join('')}
          </ol>
          <button class="btn subtle" data-action="add-idea">+ Add big idea</button>
        </div>
      </div>`;
    autosizeAll($('#hero'));
  }

  function renderStats() {
    const nodes = Object.values(idx);
    let own = 0, inh = 0, orphan = 0;
    const per = LEVELS.map(l => {
      let c = 0;
      nodes.forEach(n => {
        const r = resolve(n.s.id, l.key);
        if (r.status === 'na') return;
        c++;
        if (r.status === 'own') own += r.statements.length;
        else if (r.status === 'inherit') inh++;
        else orphan++;
      });
      return { l, c };
    });
    const max = Math.max(1, nodes.length);
    const top = area().strands.length;
    $('#stats').innerHTML = `
      <div class="stat-row">
        <div class="stat"><b>${top}</b><span>${top === 1 ? 'strand' : 'strands'}</span></div>
        <div class="stat"><b>${nodes.length - top}</b><span>sub-strands</span></div>
        <div class="stat"><b>${own}</b><span>statements written</span></div>
        <div class="stat"><b>${inh}</b><span>cells inheriting</span></div>
        ${orphan ? `<div class="stat warn"><b>${orphan}</b><span>need attention</span></div>` : ''}
      </div>
      <div class="coverage" aria-label="Strands taught at each level">
        ${per.map(({ l, c }) => `
          <div class="cov" style="--lc:var(--${l.key})" title="${c} of ${nodes.length} strands and sub-strands taught at ${l.name}">
            <div class="cov-bar"><i style="height:${Math.round((c / max) * 100)}%"></i></div>
            <span>${l.name}</span>
          </div>`).join('')}
      </div>`;
  }

  function renderBody() {
    reindex();
    renderStats();
    $$('.seg [data-view]').forEach(b => b.setAttribute('aria-selected', b.dataset.view === ui.view));
    $('#body').innerHTML = ui.view === 'matrix' ? matrixHTML() : levelHTML();
    document.body.classList.toggle('drawer-open', !!ui.drawer);
  }

  /* --- matrix view --- */
  function visibleRows() {
    const out = [];
    const walk = list => list.forEach(s => {
      out.push(idx[s.id]);
      if (s.children.length && !ui.collapsed.has(s.id)) walk(s.children);
    });
    walk(area().strands);
    return out;
  }

  function matrixHTML() {
    const a = area();
    if (!a.strands.length) {
      return `<div class="empty">
        <h3>No strands yet</h3>
        <p>Strands organise the area into its main threads of learning. Each strand is taught at one or more levels, and can be broken down into sub-strands.</p>
        <button class="btn primary" data-action="add-strand">+ Add the first strand</button>
      </div>`;
    }
    const head = `<div class="mh corner"><span>Strands</span><span class="mh-sub">click a name to edit</span></div>` +
      LEVELS.map(l => `<div class="mh lvl" style="--lc:var(--${l.key})"><span class="lvl-pill">${l.name}</span><small>${l.hint}</small></div>`).join('');
    const rows = visibleRows().map(rowHTML).join('');
    return `<div class="matrix-scroll"><div class="matrix">${head}${rows}</div></div>
      <button class="btn add-strand" data-action="add-strand">+ Add strand</button>`;
  }

  function rowHTML(n) {
    const { s, depth } = n;
    const isTop = depth === 0;
    const sel = ui.drawer && ui.drawer.id === s.id;
    const guides = Array.from({ length: depth }, (_, i) => `<span class="guide" style="left:${18 + i * 22}px"></span>`).join('');
    const kids = s.children.length;
    const open = !ui.collapsed.has(s.id);
    const tree = `
      <div class="slot tc d${Math.min(depth, 3)} ${isTop ? 'row-top' : ''} ${sel ? 'row-sel' : ''}" style="--depth:${depth}">
        ${guides}
        <div class="tc-inner">
          ${kids ? `<button class="twisty ${open ? 'open' : ''}" data-action="toggle" data-id="${s.id}" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(s.name)}">▸</button>` : `<span class="twisty-spacer"></span>`}
          <div class="tc-text">
            <span class="kind">${kind(depth)}${kids ? ` · ${plural(kids, 'sub-strand')}` : ''}</span>
            <button class="sname" data-action="edit-strand" data-id="${s.id}">${s.name ? esc(s.name) : '<em>Untitled</em>'}</button>
          </div>
          <button class="add-child" data-action="add-child" data-id="${s.id}" title="Add a sub-strand inside “${esc(s.name)}”">+ sub</button>
        </div>
      </div>`;
    return tree + LEVELS.map(l => `<div class="slot ${isTop ? 'row-top' : ''} ${sel ? 'row-sel' : ''}">${cellHTML(n, l)}</div>`).join('');
  }

  function stmtList(list, cls = '') {
    if (!list.length || list.every(t => !t.trim())) return `<p class="muted-note">No statements yet — click to write one.</p>`;
    return `<ol class="stmts ${cls}">${list.map(t => `<li>${t.trim() ? esc(t) : '<em>Empty statement</em>'}</li>`).join('')}</ol>`;
  }

  function cellHTML(n, l) {
    const s = n.s;
    const r = resolve(s.id, l.key);
    const key = `${s.id}:${l.key}`;
    const sel = ui.drawer?.type === 'cell' && ui.drawer.id === s.id && ui.drawer.level === l.key ? 'selected' : '';
    const base = `style="--lc:var(--${l.key})" data-cell="${key}" role="button" tabindex="0"`;
    if (r.status === 'na') {
      return `<div class="cell na" ${base} data-action="apply" data-id="${s.id}" data-level="${l.key}" aria-label="Teach ${esc(s.name)} at ${l.name} level"><span>+ Teach at ${l.name}</span></div>`;
    }
    if (r.status === 'orphan') {
      return `<div class="cell orphan ${sel}" ${base} data-action="edit-cell" data-id="${s.id}" data-level="${l.key}"><span class="ribbon">⚠ Nothing to inherit</span><p>${esc(r.reason)}</p></div>`;
    }
    if (r.status === 'inherit') {
      return `<div class="cell inh ${sel}" ${base} data-src="${r.source.id}:${l.key}" data-action="edit-cell" data-id="${s.id}" data-level="${l.key}">
        <span class="ribbon">↑ from ${esc(r.source.name)}</span>${stmtList(r.statements, 'faded')}</div>`;
    }
    const heirs = inheritorsOf(s.id, l.key).length;
    return `<div class="cell own ${sel}" ${base} data-action="edit-cell" data-id="${s.id}" data-level="${l.key}">
      ${stmtList(r.statements)}
      ${heirs ? `<span class="heirs" title="${heirs} sub-strand(s) inherit these statements">↓ shared with ${plural(heirs, 'sub-strand')}</span>` : ''}</div>`;
  }

  /* --- one-level view --- */
  function levelHTML() {
    const a = area();
    const nodes = Object.values(idx);
    const tabs = LEVELS.map(l => {
      const c = nodes.filter(n => resolve(n.s.id, l.key).status !== 'na').length;
      return `<button class="ltab ${l.key === ui.focus ? 'on' : ''}" style="--lc:var(--${l.key})" data-action="focus" data-level="${l.key}">
        <b>${l.name}</b><small>${l.hint}</small><span class="ltab-count">${c}/${nodes.length} taught</span></button>`;
    }).join('');
    if (!a.strands.length) return `<div class="ltabs">${tabs}</div><div class="empty"><p>Add strands in the Strands × Levels view first.</p></div>`;
    const L = LV[ui.focus];
    const node = n => {
      const s = n.s; const r = resolve(s.id, L.key);
      let body = '';
      if (r.status === 'own') body = stmtList(r.statements);
      else if (r.status === 'inherit') body = `<span class="ribbon">↑ from ${esc(r.source.name)}</span>${stmtList(r.statements, 'faded')}`;
      else if (r.status === 'orphan') body = `<span class="ribbon warn">⚠ Nothing to inherit</span>`;
      else body = `<p class="muted-note">Not taught at ${L.name} level.</p>`;
      const action = r.status === 'na' ? 'apply' : 'edit-cell';
      return `<div class="jn d${Math.min(n.depth, 3)} ${r.status}">
        <div class="jn-card" data-action="${action}" data-id="${s.id}" data-level="${L.key}" role="button" tabindex="0">
          <span class="kind">${kind(n.depth)}</span>
          <h4>${esc(s.name) || '<em>Untitled</em>'}</h4>
          ${body}
        </div>
        ${s.children.length ? `<div class="jn-kids">${s.children.map(c => node(idx[c.id])).join('')}</div>` : ''}
      </div>`;
    };
    return `<div class="ltabs">${tabs}</div>
      <div class="journey" style="--lc:var(--${L.key})">
        <h3 class="journey-title"><span class="lvl-pill">${L.name}</span> What learners come to understand at ${L.name} level</h3>
        <div class="journey-grid">${a.strands.map(s => node(idx[s.id])).join('')}</div>
      </div>`;
  }

  /* --- drawer --- */
  function renderDrawer() {
    const d = ui.drawer;
    const el = $('#drawer');
    if (d && !idx[d.id]) ui.drawer = null;
    if (!ui.drawer) {
      el.innerHTML = ''; el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('drawer-open');
      return;
    }
    el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
    el.innerHTML = ui.drawer.type === 'cell' ? cellDrawer() : strandDrawer();
    autosizeAll(el);
  }

  function crumbs(n) {
    return `<nav class="crumbs">${esc(area().name)}${n.path.map(p =>
      ` <span>›</span> <button data-action="edit-strand" data-id="${p.id}">${esc(p.name) || 'Untitled'}</button>`).join('')}</nav>`;
  }

  function levelChips(s, active, action) {
    return `<div class="lchips">${LEVELS.map(l => {
      const st = resolve(s.id, l.key).status;
      return `<button class="lchip ${st} ${l.key === active ? 'active' : ''}" style="--lc:var(--${l.key})"
        data-action="${action}" data-id="${s.id}" data-level="${l.key}" title="${l.name}: ${statusText(st)}">
        <i></i>${l.name}</button>`;
    }).join('')}</div>`;
  }
  const statusText = st => ({ own: 'own statements', inherit: 'inherits from parent', na: 'not taught', orphan: 'needs attention' }[st]);

  function cellDrawer() {
    const { id, level } = ui.drawer;
    const n = idx[id], s = n.s, L = LV[level];
    const cur = s.levels[level];
    const mode = cur ? cur.mode : 'na';
    const r = resolve(id, level);
    const inheritable = canInherit(id, level);
    const parentNote = !n.parent
      ? 'Top-level strands have no parent to inherit from.'
      : inheritable ? `Use the statements from “${esc(n.parent.name)}”.`
        : `“${esc(n.parent.name)}” isn’t taught at ${L.name} level.`;

    let body = '';
    if (mode === 'na') {
      body = `<div class="explain na-explain"><p><b>${esc(s.name)}</b> is not taught at <b>${L.name}</b> level.</p>
        <p>Choose <em>Inherit</em> or <em>Write own</em> above to include it.</p></div>`;
    } else if (mode === 'inherit') {
      if (r.status === 'inherit') {
        const chain = [];
        for (let p = n.parent; p; p = idx[p.id].parent) { chain.push(p); if (p.id === r.source.id) break; }
        body = `<div class="explain inh-explain" style="--lc:var(--${level})">
          <div class="flow">${[...chain].reverse().map(p => `<span class="flow-node ${p.id === r.source.id ? 'src' : ''}">${esc(p.name)}</span><span class="flow-arrow">↓</span>`).join('')}<span class="flow-node here">${esc(s.name)}</span></div>
          <p>These statements are written on <b>${esc(r.source.name)}</b>. Edit them there and every sub-strand that inherits them updates automatically.</p>
          ${stmtList(r.statements, 'faded big')}
          <div class="btn-row">
            <button class="btn" data-action="edit-cell" data-id="${r.source.id}" data-level="${level}">Edit at source</button>
            <button class="btn primary" data-action="override">Override — write own</button>
          </div></div>`;
      } else {
        body = `<div class="explain orphan-explain"><p>⚠ ${esc(r.reason)}</p><p>Write this strand’s own statements, teach the parent at this level, or mark this as not taught.</p></div>`;
      }
    } else {
      const heirs = inheritorsOf(id, level);
      body = `<div class="stmt-editor" style="--lc:var(--${level})">
        ${cur.statements.map((t, i) => `
          <div class="stmt-row">
            <span class="stmt-num">${i + 1}</span>
            <textarea class="autosize" rows="2" data-stmt="${i}" aria-label="Understanding statement ${i + 1}" placeholder="Learners understand that…">${esc(t)}</textarea>
            <button class="icon-btn" data-action="del-stmt" data-i="${i}" title="Remove statement" aria-label="Remove statement ${i + 1}">×</button>
          </div>`).join('')}
        <button class="btn subtle" data-action="add-stmt">+ Add understanding statement</button>
        ${inheritable ? `<button class="btn subtle" data-action="copy-parent">Copy parent’s statements in</button>` : ''}
        ${heirs.length ? `<div class="heirs-box"><b>↓ Shared with ${plural(heirs.length, 'sub-strand')}</b> — these statements also appear in:
          <ul>${heirs.map(h => `<li><button data-action="edit-cell" data-id="${h.s.id}" data-level="${level}">${esc(h.s.name)}</button></li>`).join('')}</ul></div>` : ''}
      </div>`;
    }

    return `
      <div class="dr-head" style="--lc:var(--${level})">
        <button class="icon-btn close" data-action="close-drawer" aria-label="Close panel">×</button>
        ${crumbs(n)}
        <h2><span class="lvl-pill">${L.name}</span> <span id="dr-title">${esc(s.name)}</span></h2>
        <p class="dr-sub">Understanding statements for this ${kind(n.depth).toLowerCase()} at ${L.name} level</p>
        ${levelChips(s, level, 'edit-cell')}
      </div>
      <div class="dr-body">
        <div class="mode" role="radiogroup" aria-label="How is this level defined?">
          <button class="mode-opt ${mode === 'na' ? 'on' : ''}" data-action="set-mode" data-mode="na" role="radio" aria-checked="${mode === 'na'}">
            <i class="sw na"></i><b>Not taught</b><small>Skip this level</small></button>
          <button class="mode-opt ${mode === 'inherit' ? 'on' : ''}" data-action="set-mode" data-mode="inherit" role="radio" aria-checked="${mode === 'inherit'}" ${!n.parent ? 'disabled' : ''}>
            <i class="sw inh"></i><b>Inherit</b><small>${parentNote}</small></button>
          <button class="mode-opt ${mode === 'own' ? 'on' : ''}" data-action="set-mode" data-mode="own" role="radio" aria-checked="${mode === 'own'}">
            <i class="sw own"></i><b>Write own</b><small>Specific to this strand</small></button>
        </div>
        ${body}
      </div>
      <div class="dr-foot">
        <button class="btn ghost" data-action="edit-strand" data-id="${id}">Strand settings</button>
        <span class="grow"></span>
        <button class="btn ghost" data-action="step" data-dir="-1" ${level === 'early' ? 'disabled' : ''}>← Previous level</button>
        <button class="btn ghost" data-action="step" data-dir="1" ${level === 'fourth' ? 'disabled' : ''}>Next level →</button>
      </div>`;
  }

  function strandDrawer() {
    const n = idx[ui.drawer.id], s = n.s;
    return `
      <div class="dr-head">
        <button class="icon-btn close" data-action="close-drawer" aria-label="Close panel">×</button>
        ${crumbs(n)}
        <div class="kind">${kind(n.depth)}</div>
        <input class="dr-name" id="strandName" data-sfield="name" value="${esc(s.name)}" placeholder="Strand name" aria-label="Strand name">
        <textarea class="autosize dr-desc" rows="1" data-sfield="description" placeholder="Optional: a short description of this strand" aria-label="Strand description">${esc(s.description || '')}</textarea>
      </div>
      <div class="dr-body">
        <h3 class="dr-h">Levels this ${kind(n.depth).toLowerCase()} applies at</h3>
        <p class="hint">Click a level to switch it on or off. ${n.parent ? 'New levels inherit from the parent strand where they can.' : ''}</p>
        ${levelChips(s, null, 'toggle-level')}
        <div class="lvl-list">
          ${LEVELS.map(l => {
            const r = resolve(s.id, l.key);
            if (r.status === 'na') return '';
            const cnt = r.status === 'orphan' ? '⚠ nothing to inherit' : r.status === 'inherit' ? `inherits ${plural(r.statements.length, 'statement')} from ${esc(r.source.name)}` : plural(r.statements.filter(t => t.trim()).length, 'statement');
            return `<button class="lvl-row ${r.status}" style="--lc:var(--${l.key})" data-action="edit-cell" data-id="${s.id}" data-level="${l.key}">
              <span class="lvl-pill">${l.name}</span><span>${cnt}</span><span class="go">Edit →</span></button>`;
          }).join('') || '<p class="muted-note">Not taught at any level yet.</p>'}
        </div>

        <h3 class="dr-h">Sub-strands</h3>
        ${s.children.length ? `<ul class="kid-list">${s.children.map(c => `<li><button data-action="edit-strand" data-id="${c.id}">${esc(c.name) || 'Untitled'}</button><span>${plural(c.children.length, 'sub-strand')}</span></li>`).join('')}</ul>` : '<p class="muted-note">None yet.</p>'}
        <button class="btn subtle" data-action="add-child" data-id="${s.id}">+ Add sub-strand</button>
      </div>
      <div class="dr-foot">
        <button class="btn ghost" data-action="move" data-dir="-1" ${n.i === 0 ? 'disabled' : ''}>↑ Move up</button>
        <button class="btn ghost" data-action="move" data-dir="1" ${n.i === n.list.length - 1 ? 'disabled' : ''}>↓ Move down</button>
        <span class="grow"></span>
        <button class="btn danger" data-action="del-strand">Delete</button>
      </div>`;
  }

  /* ---------- actions ---------- */
  function openDrawer(d) { ui.drawer = d; reindex(); renderDrawer(); renderBody(); }
  function commit({ hero = false, drawer = true } = {}) {
    save(); reindex();
    if (hero) renderHero();
    renderBody();
    if (drawer) renderDrawer();
  }
  function newStrand(name) { return { id: uid(), name, description: '', levels: {}, children: [] }; }

  const actions = {
    toggle(t) { const id = t.dataset.id; ui.collapsed.has(id) ? ui.collapsed.delete(id) : ui.collapsed.add(id); renderBody(); },
    'edit-strand'(t) { openDrawer({ type: 'strand', id: t.dataset.id }); },
    'edit-cell'(t) { openDrawer({ type: 'cell', id: t.dataset.id, level: t.dataset.level }); },
    apply(t) { applyLevel(idx[t.dataset.id].s, t.dataset.level); save(); openDrawer({ type: 'cell', id: t.dataset.id, level: t.dataset.level }); },
    'toggle-level'(t) {
      const s = idx[t.dataset.id].s, l = t.dataset.level;
      if (s.levels[l]) delete s.levels[l]; else applyLevel(s, l);
      commit();
    },
    'set-mode'(t) {
      const s = idx[ui.drawer.id].s, l = ui.drawer.level, m = t.dataset.mode;
      if (m === 'na') delete s.levels[l];
      else {
        const prev = s.levels[l] || { statements: [] };
        s.levels[l] = { mode: m, statements: prev.statements };
        if (m === 'own' && !prev.statements.length) s.levels[l].statements = [''];
      }
      commit();
    },
    override() {
      const r = resolve(ui.drawer.id, ui.drawer.level);
      idx[ui.drawer.id].s.levels[ui.drawer.level] = { mode: 'own', statements: r.statements ? [...r.statements] : [''] };
      commit();
      $('#drawer [data-stmt="0"]')?.focus();
    },
    'copy-parent'() {
      const n = idx[ui.drawer.id];
      const r = resolve(n.parent.id, ui.drawer.level);
      const L = n.s.levels[ui.drawer.level];
      L.statements = [...L.statements.filter(t => t.trim()), ...r.statements];
      commit();
    },
    'add-stmt'() {
      const L = idx[ui.drawer.id].s.levels[ui.drawer.level];
      L.statements.push('');
      commit();
      const all = $$('#drawer [data-stmt]'); all[all.length - 1]?.focus();
    },
    'del-stmt'(t) {
      const L = idx[ui.drawer.id].s.levels[ui.drawer.level];
      L.statements.splice(+t.dataset.i, 1);
      commit();
    },
    step(t) {
      const i = LEVELS.findIndex(l => l.key === ui.drawer.level) + +t.dataset.dir;
      if (LEVELS[i]) openDrawer({ ...ui.drawer, level: LEVELS[i].key });
    },
    'add-strand'() {
      const s = newStrand('New strand');
      area().strands.push(s);
      save(); openDrawer({ type: 'strand', id: s.id });
      selectName();
    },
    'add-child'(t) {
      const p = idx[t.dataset.id].s;
      const s = newStrand('New sub-strand');
      p.children.push(s);
      ui.collapsed.delete(p.id);
      reindex();
      LEVELS.forEach(l => { if (canInherit(s.id, l.key)) s.levels[l.key] = { mode: 'inherit', statements: [] }; });
      save(); openDrawer({ type: 'strand', id: s.id });
      selectName();
    },
    'del-strand'() {
      const n = idx[ui.drawer.id];
      const count = Object.values(idx).filter(x => x.path.includes(n.s)).length - 1;
      if (!confirm(`Delete “${n.s.name}”${count ? ` and its ${plural(count, 'sub-strand')}` : ''}?`)) return;
      n.list.splice(n.i, 1);
      ui.drawer = n.parent ? { type: 'strand', id: n.parent.id } : null;
      commit();
    },
    move(t) {
      const n = idx[ui.drawer.id], j = n.i + +t.dataset.dir;
      if (j < 0 || j >= n.list.length) return;
      [n.list[n.i], n.list[j]] = [n.list[j], n.list[n.i]];
      commit();
    },
    'close-drawer'() { ui.drawer = null; renderDrawer(); renderBody(); },
    view(t) { ui.view = t.dataset.view; renderBody(); },
    focus(t) { ui.focus = t.dataset.level; renderBody(); },
    'add-idea'() { area().bigIdeas.push(''); commit({ hero: true, drawer: false }); const all = $$('#hero [data-idea]'); all[all.length - 1]?.focus(); },
    'del-idea'(t) { area().bigIdeas.splice(+t.dataset.i, 1); commit({ hero: true, drawer: false }); },
    'new-area'() {
      const a = { id: uid(), name: 'New curriculum area', purpose: '', bigIdeas: [''], strands: [] };
      db.areas.push(a); db.currentId = a.id; ui.drawer = null; ui.collapsed.clear();
      save(); render();
      const f = $('#f-name'); f.focus(); f.select();
    },
    export() {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'curriculum.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import() { $('#importFile').click(); },
    reset() {
      if (!confirm('Replace everything with the demo data? Your changes will be lost.')) return;
      db = clone(window.SEED); ui.drawer = null; ui.collapsed.clear(); save(); render();
    }
  };

  function selectName() { const f = $('#strandName'); if (f) { f.focus(); f.select(); } }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t || t.disabled) return;
    const fn = actions[t.dataset.action];
    if (fn) { e.preventDefault(); fn(t); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.drawer) { actions['close-drawer'](); return; }
    const t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('[role="button"][data-action]')) { e.preventDefault(); t.click(); }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('autosize')) autosize(t);
    if (t.dataset.field) {
      area()[t.dataset.field] = t.value; save();
      if (t.dataset.field === 'name') renderTop();
    } else if (t.dataset.idea != null) {
      area().bigIdeas[+t.dataset.idea] = t.value; save();
    } else if (t.dataset.sfield) {
      idx[ui.drawer.id].s[t.dataset.sfield] = t.value; save(); renderBody();
    } else if (t.dataset.stmt != null) {
      idx[ui.drawer.id].s.levels[ui.drawer.level].statements[+t.dataset.stmt] = t.value; save(); renderBody();
    }
  });

  $('#areaSelect').addEventListener('change', e => {
    db.currentId = e.target.value; ui.drawer = null; ui.collapsed.clear(); save(); render();
  });

  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.areas) || !d.areas.length) throw new Error('No curriculum areas found in this file.');
      db = d; db.currentId ||= d.areas[0].id; ui.drawer = null; save(); render();
    } catch (err) { alert('Could not import: ' + err.message); }
  });

  // Hovering an inherited cell lights up the cell it inherits from.
  document.addEventListener('mouseover', e => {
    const c = e.target.closest('.cell.inh');
    $$('.src-hl').forEach(x => x.classList.remove('src-hl'));
    if (c) $(`[data-cell="${c.dataset.src}"]`)?.classList.add('src-hl');
  });

  function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
  function autosizeAll(root) { requestAnimationFrame(() => $$('textarea.autosize', root).forEach(autosize)); }

  // Re-measure textareas once web fonts arrive and when the layout width changes.
  const remeasure = () => $$('textarea.autosize').forEach(autosize);
  document.fonts?.ready.then(remeasure);
  let rzTimer;
  window.addEventListener('resize', () => { clearTimeout(rzTimer); rzTimer = setTimeout(remeasure, 100); });
  // Opening/closing the side panel changes the hero's width without a window resize.
  if (window.ResizeObserver) {
    let lastW = 0;
    new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w !== lastW) { lastW = w; $$('#hero textarea.autosize').forEach(autosize); }
    }).observe($('#hero'));
  }

  render();
})();

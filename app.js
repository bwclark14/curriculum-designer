(() => {
  'use strict';

  /* ---------- constants & helpers ---------- */
  const LEVELS = [
    { key: 'early',  name: 'Early' },
    { key: 'first',  name: 'First' },
    { key: 'second', name: 'Second' },
    { key: 'third',  name: 'Third' },
    { key: 'fourth', name: 'Fourth' }
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
  const ui = {
    page: location.hash.startsWith('#knows-and-dos') ? 'kd' : location.hash === '#dashboard' ? 'dash' : 'structure',
    view: 'matrix', focus: 'second', collapsed: new Set(), drawer: null,
    // Knows & Dos page: selected understanding, list filters, edit/preview, open editor
    kd: { sel: selFromHash(), level: 'all', q: '', preview: false },
    ed: null,
    dash: { area: 'all' }        // Dashboard scope: 'all' areas or one area id
  };

  // The open understanding is kept in the URL (#knows-and-dos/<strand>/<level>/<n>) so a reload or link returns to it.
  function selFromHash() {
    const m = location.hash.match(/^#knows-and-dos\/([^/]+)\/([a-z]+)\/(\d+)$/);
    return m ? { id: decodeURIComponent(m[1]), level: m[2], i: +m[3] } : null;
  }
  function kdHash() {
    const s = ui.kd.sel;
    return s ? `#knows-and-dos/${encodeURIComponent(s.id)}/${s.level}/${s.i}` : '#knows-and-dos';
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.areas) && d.areas.length) return normalise(d);
      }
    } catch (e) { /* storage unavailable: fall back to seed */ }
    return normalise(clone(window.SEED));
  }
  // Older data stored big ideas and understanding statements as plain strings;
  // they are now { name, description } and { code, text }.
  function normalise(d) {
    const fixStrands = list => (list || []).forEach(s => {
      Object.values(s.levels || {}).forEach(L => {
        L.statements = (L.statements || []).map(toStmt);
        // IDs for inherited statements, entered on the inheriting (lowest-level) strand.
        L.codes = Array.isArray(L.codes) ? L.codes.map(c => c || '') : [];
        // Knows & dos for inherited statements, lined up with L.codes.
        L.kd = Array.isArray(L.kd) ? L.kd.map(normKD) : [];
      });
      fixStrands(s.children);
    });
    d.areas.forEach(a => {
      a.bigIdeas = (a.bigIdeas || []).map(b => typeof b === 'string'
        ? { name: '', description: b }
        : { name: b.name || '', description: b.description || '' });
      fixStrands(a.strands);
    });
    return d;
  }
  // Function declarations (not consts) so they are available when load() runs at start-up.
  function toStmt(t) {
    if (typeof t === 'string') return { code: '', text: t };
    const s = { code: t.code || '', text: t.text || '' };
    if (t.kd) s.kd = normKD(t.kd);
    return s;
  }
  /* Knows & dos for one understanding:
     { sequenced, collections: [{ id, name, sequenced, knows: [item], dos: [item] }] }
     item: { id, text (may contain $LaTeX$), images: [{ id, src (data URL), alt }] } */
  function newKD() { return { sequenced: false, collections: [] }; }
  function newCollection() { return { id: uid(), name: '', sequenced: false, knows: [], dos: [] }; }
  function normKD(k) {
    if (!k) return null;
    return {
      sequenced: !!k.sequenced,
      collections: (k.collections || []).map(c => ({
        id: c.id || uid(), name: c.name || '', sequenced: !!c.sequenced,
        knows: (c.knows || []).map(normItem), dos: (c.dos || []).map(normItem)
      }))
    };
  }
  function normItem(it) {
    return { id: it.id || uid(), text: it.text || '', images: (it.images || []).filter(im => im && im.src).map(im => ({ id: im.id || uid(), src: im.src, alt: im.alt || '' })) };
  }
  function blankStmt() { return { code: '', text: '' }; }
  function copyStmts(list) { return list.map(t => ({ ...t })); }
  let savedTimer;
  let warnedFull = false;
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(db));
      warnedFull = false;
    } catch (e) {
      // Usually the browser's storage limit, most often reached by large images.
      if (!warnedFull && /quota/i.test(e.name + e.message)) {
        warnedFull = true;
        alert('Your browser’s storage for this site is full, so the latest changes could not be saved. Remove some images, or use Export to keep a copy of your work.');
      }
    }
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
   *  status: 'na'      not taught at this level
   *          'group'   named only: no statement, it just groups its sub-strands
   *          'own'     its own understanding statements
   *          'inherit' the nearest statements written above it
   *          'orphan'  set to inherit, but nothing is written above it */
  function resolve(id, lvl) {
    const n = idx[id];
    const L = n && n.s.levels[lvl];
    if (!L) return { status: 'na' };
    if (L.mode === 'own') return { status: 'own', statements: L.statements, source: n.s };
    if (L.mode === 'group') return { status: 'group', statements: [] };
    if (!n.parent) return { status: 'orphan', reason: 'Top-level strands have no parent to inherit from.' };
    const up = inheritable(n.parent.id, lvl);
    if (up) return { status: 'inherit', statements: up.statements, source: up.source };
    return {
      status: 'orphan',
      reason: !n.parent.levels[lvl]
        ? `“${n.parent.name}” is not taught at ${LV[lvl].name} level, so there is nothing to inherit.`
        : `No understanding statement is written above “${n.s.name}” at ${LV[lvl].name} level, so there is nothing to inherit.`
    };
  }

  /** What a sub-strand of `id` would inherit at `lvl`: the nearest written statements at or above it.
   *  Name-only strands pass their parent's statements through. */
  function inheritable(id, lvl) {
    const r = resolve(id, lvl);
    if (r.status === 'own' || r.status === 'inherit') return r;
    if (r.status === 'group') { const p = idx[id].parent; return p ? inheritable(p.id, lvl) : null; }
    return null;
  }

  const inheritorsOf = (id, lvl) =>
    Object.values(idx).filter(n => n.s.id !== id && n.s.levels[lvl]?.mode === 'inherit' && resolve(n.s.id, lvl).source?.id === id);

  function canInherit(id, lvl) {
    const p = idx[id].parent;
    return !!(p && inheritable(p.id, lvl));
  }

  /** Switch a level on: inherit when something is written above, otherwise name only. */
  function applyLevel(s, lvl) {
    const prev = s.levels[lvl];
    s.levels[lvl] = {
      mode: canInherit(s.id, lvl) ? 'inherit' : 'group',
      statements: prev?.statements || [],
      codes: prev?.codes || []
    };
  }

  /* Understanding IDs live at the lowest level of understanding: a strand holds the
     IDs at a level only when none of its sub-strands are taught at that level.
     Otherwise the IDs are entered on the sub-strands (even ones that inherit). */
  function isLeaf(id, lvl) {
    const s = idx[id].s;
    return !!s.levels[lvl] && !s.children.some(c => c.levels[lvl]);
  }
  const taughtKids = (id, lvl) => idx[id].s.children.filter(c => c.levels[lvl]);

  /** IDs lined up with the statements a cell shows, or null when its IDs belong to sub-strands. */
  function cellCodes(id, lvl, r = resolve(id, lvl)) {
    if (!isLeaf(id, lvl)) return null;
    const L = idx[id].s.levels[lvl];
    if (r.status === 'own') return L.statements.map(t => t.code);
    if (r.status === 'inherit') return r.statements.map((_, i) => L.codes[i] || '');
    return null;
  }

  /** Other lowest-level places in this area that use `code` (case-insensitive). */
  function codeClashes(code, selfId, selfLevel, selfIndex) {
    const c = code.trim().toLowerCase();
    if (!c) return [];
    const out = [];
    Object.values(idx).forEach(n => LEVELS.forEach(l => {
      (cellCodes(n.s.id, l.key) || []).forEach((k, i) => {
        if (n.s.id === selfId && l.key === selfLevel && i === selfIndex) return;
        if (k.trim().toLowerCase() === c) out.push(`${n.s.name} (${l.name})`);
      });
    }));
    return out;
  }
  const clashText = list => list.length ? `⚠ This ID is also used in ${list.join(', ')}` : '';

  /** An ID is only needed once there is statement text; then it must be present and unique. */
  function idProblem(code, text, id, lvl, i) {
    if (!text.trim()) return '';
    if (!code.trim()) return '⚠ This statement needs an understanding ID';
    return clashText(codeClashes(code, id, lvl, i));
  }

  /** Lowest-level statements in this area that have text but no ID. */
  function missingIdCount() {
    let c = 0;
    Object.values(idx).forEach(n => LEVELS.forEach(l => {
      const r = resolve(n.s.id, l.key);
      const codes = cellCodes(n.s.id, l.key, r);
      if (codes) r.statements.forEach((t, i) => { if (t.text.trim() && !(codes[i] || '').trim()) c++; });
    }));
    return c;
  }

  /* ---------- rendering ---------- */
  function render() {
    reindex();
    renderTop();
    renderPage();
    if (ui.page === 'kd') { renderDrawer(); renderKD(); return; }
    if (ui.page === 'dash') { renderDrawer(); renderDash(); return; }
    renderHero();
    renderBody();
    renderDrawer();
  }

  /** Switch between the Structure page and the Knows & Dos page. */
  function renderPage() {
    $('#structure-page').hidden = ui.page !== 'structure';
    $('#kd-page').hidden = ui.page !== 'kd';
    $('#dash-page').hidden = ui.page !== 'dash';
    $('#dashTip').hidden = true;
    $$('.pages [data-page]').forEach(b => b.setAttribute('aria-current', b.dataset.page === ui.page ? 'page' : 'false'));
    if (ui.page !== 'structure') ui.drawer = null;
    // Knows & Dos keeps its own hash (with the open understanding) in renderKD.
    const hash = ui.page === 'dash' ? '#dashboard' : ui.page === 'structure' ? '' : null;
    if (hash !== null && location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
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
                <div class="idea-body">
                  <input class="idea-name" data-idea="${i}" data-ifield="name" value="${esc(b.name)}" aria-label="Big idea ${i + 1} name" placeholder="Name this big idea">
                  <textarea class="idea-desc autosize" rows="1" data-idea="${i}" data-ifield="description" aria-label="Big idea ${i + 1} description" placeholder="Describe what learners should come to understand">${esc(b.description)}</textarea>
                </div>
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
        if (r.status === 'own') own += r.statements.filter(t => t.text.trim()).length;
        else if (r.status === 'inherit') inh++;
        else if (r.status === 'orphan') orphan++;
      });
      return { l, c };
    });
    const missing = missingIdCount();
    const max = Math.max(1, nodes.length);
    const top = area().strands.length;
    $('#stats').innerHTML = `
      <div class="stat-row">
        <div class="stat"><b>${top}</b><span>${top === 1 ? 'strand' : 'strands'}</span></div>
        <div class="stat"><b>${nodes.length - top}</b><span>sub-strands</span></div>
        <div class="stat"><b>${own}</b><span>statements written</span></div>
        <div class="stat"><b>${inh}</b><span>cells inheriting</span></div>
        ${orphan ? `<div class="stat warn"><b>${orphan}</b><span>need attention</span></div>` : ''}
        ${missing ? `<div class="stat warn"><b>${missing}</b><span>${missing === 1 ? 'statement needs' : 'statements need'} an ID</span></div>` : ''}
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
      LEVELS.map(l => `<div class="mh lvl" style="--lc:var(--${l.key})"><span class="lvl-pill">${l.name}</span></div>`).join('');
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

  /** `codes` lines up with `list`; pass null where IDs belong to sub-strands. */
  function stmtList(list, cls = '', codes = null, ref = null) {
    const code = i => (codes && codes[i] || '').trim();
    const counts = i => {
      if (!ref || !code(i)) return '';
      const { K, D } = kdCount({ ...ref, i });
      return K || D ? ` <span class="kd-count" title="${K} know, ${D} do statements">K ${K} · D ${D}</span>` : '';
    };
    if (!list.length || list.every((t, i) => !t.text.trim() && !code(i))) return `<p class="muted-note">No statements yet — click to write one.</p>`;
    const tag = (t, i) => code(i) ? `<span class="sid">${esc(code(i))}</span> `
      : codes && t.text.trim() ? `<span class="sid missing" title="Statements at the lowest level need an understanding ID">ID needed</span> ` : '';
    return `<ol class="stmts ${cls}">${list.map((t, i) => `<li>${tag(t, i)}${t.text.trim() ? esc(t.text) : '<em>Empty statement</em>'}${counts(i)}</li>`).join('')}</ol>`;
  }
  /** Body of a name-only cell: no statement, just a heading for its sub-strands. */
  function groupBody(id, lvl) {
    const k = taughtKids(id, lvl).length;
    return `<span class="group-tag">Name only</span>
      <p class="group-note">${k ? `Groups ${plural(k, 'sub-strand')} ↓` : 'No understanding statement at this level'}</p>`;
  }
  /** Shown on a cell whose IDs are entered further down, on its sub-strands. */
  function idNote(id, lvl) {
    if (isLeaf(id, lvl)) return '';
    const k = taughtKids(id, lvl).length;
    return `<span class="id-note" title="Understanding IDs at this level are entered on the sub-strands">IDs on ${plural(k, 'sub-strand')} ↓</span>`;
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
    if (r.status === 'group') {
      return `<div class="cell group ${sel}" ${base} data-action="edit-cell" data-id="${s.id}" data-level="${l.key}">${groupBody(s.id, l.key)}</div>`;
    }
    if (r.status === 'orphan') {
      return `<div class="cell orphan ${sel}" ${base} data-action="edit-cell" data-id="${s.id}" data-level="${l.key}"><span class="ribbon">⚠ Nothing to inherit</span><p>${esc(r.reason)}</p></div>`;
    }
    if (r.status === 'inherit') {
      return `<div class="cell inh ${sel}" ${base} data-src="${r.source.id}:${l.key}" data-action="edit-cell" data-id="${s.id}" data-level="${l.key}">
        <span class="ribbon">↑ from ${esc(r.source.name)}</span>${stmtList(r.statements, 'faded', cellCodes(s.id, l.key, r), { id: s.id, level: l.key })}${idNote(s.id, l.key)}</div>`;
    }
    const heirs = inheritorsOf(s.id, l.key).length;
    return `<div class="cell own ${sel}" ${base} data-action="edit-cell" data-id="${s.id}" data-level="${l.key}">
      ${stmtList(r.statements, '', cellCodes(s.id, l.key, r), { id: s.id, level: l.key })}${idNote(s.id, l.key)}
      ${heirs ? `<span class="heirs" title="${heirs} sub-strand(s) inherit these statements">↓ shared with ${plural(heirs, 'sub-strand')}</span>` : ''}</div>`;
  }

  /* --- one-level view --- */
  function levelHTML() {
    const a = area();
    const nodes = Object.values(idx);
    const tabs = LEVELS.map(l => {
      const c = nodes.filter(n => resolve(n.s.id, l.key).status !== 'na').length;
      return `<button class="ltab ${l.key === ui.focus ? 'on' : ''}" style="--lc:var(--${l.key})" data-action="focus" data-level="${l.key}">
        <b>${l.name}</b><span class="ltab-count">${c}/${nodes.length} taught</span></button>`;
    }).join('');
    if (!a.strands.length) return `<div class="ltabs">${tabs}</div><div class="empty"><p>Add strands in the Strands × Levels view first.</p></div>`;
    const L = LV[ui.focus];
    const node = n => {
      const s = n.s; const r = resolve(s.id, L.key);
      let body = '';
      if (r.status === 'own') body = stmtList(r.statements, '', cellCodes(s.id, L.key, r), { id: s.id, level: L.key }) + idNote(s.id, L.key);
      else if (r.status === 'inherit') body = `<span class="ribbon">↑ from ${esc(r.source.name)}</span>${stmtList(r.statements, 'faded', cellCodes(s.id, L.key, r), { id: s.id, level: L.key })}${idNote(s.id, L.key)}`;
      else if (r.status === 'group') body = groupBody(s.id, L.key);
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
  /** Panel note for a strand whose IDs at this level are entered on its sub-strands. */
  function idBox(id, level) {
    const kids = taughtKids(id, level);
    return `<div class="id-box">
      <b>Understanding IDs are entered on the sub-strands.</b>
      At ${LV[level].name} level ${kids.length === 1 ? 'this sub-strand is' : 'these sub-strands are'} the lowest level, so each gives its understandings their own IDs:
      <ul>${kids.map(k => `<li><button data-action="edit-cell" data-id="${k.id}" data-level="${level}">${esc(k.name) || 'Untitled'}</button></li>`).join('')}</ul>
    </div>`;
  }
  const statusText = st => ({ own: 'own statements', group: 'name only', inherit: 'inherits from parent', na: 'not taught', orphan: 'needs attention' }[st]);

  function cellDrawer() {
    const { id, level } = ui.drawer;
    const n = idx[id], s = n.s, L = LV[level];
    const cur = s.levels[level];
    const mode = cur ? cur.mode : 'na';
    const r = resolve(id, level);
    const canInh = canInherit(id, level);
    const above = n.parent && inheritable(n.parent.id, level);
    const parentNote = !n.parent
      ? 'Top-level strands have no parent to inherit from.'
      : above ? `Use the statements from “${esc(above.source.name)}”.`
        : !n.parent.levels[level] ? `“${esc(n.parent.name)}” isn’t taught at ${L.name} level.`
          : 'Nothing is written above it at this level.';

    let body = '';
    if (mode === 'na') {
      body = `<div class="explain na-explain"><p><b>${esc(s.name)}</b> is not taught at <b>${L.name}</b> level.</p>
        <p>Choose <em>Name only</em>, <em>Inherit</em> or <em>Write own</em> above to include it.</p></div>`;
    } else if (mode === 'group') {
      const kids = taughtKids(id, level);
      body = `<div class="explain group-explain">
        <p><b>${esc(s.name)}</b> is named at ${L.name} level but has no understanding statement, so it needs no understanding ID.</p>
        <p>Use it to group sub-strands. Sub-strands with statements carry their own IDs${above ? `, and sub-strands that inherit pick up the statements from “${esc(above.source.name)}”` : ''}.</p>
        ${kids.length ? `<p class="group-kids-h">Sub-strands at ${L.name} level:</p>
          <ul class="group-kids">${kids.map(k => {
            const kr = resolve(k.id, level);
            return `<li><button data-action="edit-cell" data-id="${k.id}" data-level="${level}">${esc(k.name) || 'Untitled'}</button><span>${statusText(kr.status)}</span></li>`;
          }).join('')}</ul>` : ''}
        <button class="btn subtle" data-action="add-child" data-id="${id}">+ Add sub-strand</button>
      </div>`;
    } else if (mode === 'inherit') {
      if (r.status === 'inherit') {
        const chain = [];
        for (let p = n.parent; p; p = idx[p.id].parent) { chain.push(p); if (p.id === r.source.id) break; }
        body = `<div class="explain inh-explain" style="--lc:var(--${level})">
          <div class="flow">${[...chain].reverse().map(p => `<span class="flow-node ${p.id === r.source.id ? 'src' : ''}">${esc(p.name)}</span><span class="flow-arrow">↓</span>`).join('')}<span class="flow-node here">${esc(s.name)}</span></div>
          <p>These statements are written on <b>${esc(r.source.name)}</b>. Edit them there and every sub-strand that inherits them updates automatically.</p>
          ${isLeaf(id, level) ? `
            <p class="id-lead">This is the lowest level for <b>${esc(s.name)}</b> at ${L.name}, so give each understanding its own ID here.</p>
            <div class="inh-ids">${r.statements.map((t, i) => `
              <div class="inh-id-row">
                <span class="stmt-num">${i + 1}</span>
                <div class="stmt-fields">
                  <label class="sid-field">
                    <span>Understanding ID</span>
                    <input data-icode="${i}" class="${!(cur.codes[i] || '').trim() && t.text.trim() ? 'need' : ''}" value="${esc(cur.codes[i] || '')}" placeholder="e.g. TCH 2-01" aria-label="Understanding ID for inherited statement ${i + 1}" autocomplete="off" spellcheck="false">
                  </label>
                  <p class="inh-text">${t.text.trim() ? esc(t.text) : '<em>Empty statement</em>'}</p>
                  <p class="dup-warn" id="dup-${i}" role="status">${esc(idProblem(cur.codes[i] || '', t.text, id, level, i))}</p>
                  ${(cur.codes[i] || '').trim() ? kdLink(id, level, i) : ''}
                </div>
              </div>`).join('')}
            </div>` : stmtList(r.statements, 'faded big') + idBox(id, level)}
          <div class="btn-row">
            <button class="btn" data-action="edit-cell" data-id="${r.source.id}" data-level="${level}">Edit at source</button>
            <button class="btn primary" data-action="override">Override — write own</button>
          </div></div>`;
      } else {
        body = `<div class="explain orphan-explain"><p>⚠ ${esc(r.reason)}</p><p>Write this strand’s own statements, teach the parent at this level, or mark this as not taught.</p></div>`;
      }
    } else {
      const heirs = inheritorsOf(id, level);
      const leaf = isLeaf(id, level);
      body = `<div class="stmt-editor" style="--lc:var(--${level})">
        ${leaf ? '' : idBox(id, level)}
        ${cur.statements.map((t, i) => `
          <div class="stmt-row">
            <span class="stmt-num">${i + 1}</span>
            <div class="stmt-fields">
              ${leaf ? `<label class="sid-field">
                <span>Understanding ID</span>
                <input data-stmt="${i}" data-part="code" class="${!t.code.trim() && t.text.trim() ? 'need' : ''}" value="${esc(t.code)}" placeholder="e.g. SCN 1-01" aria-label="Understanding ID for statement ${i + 1}" autocomplete="off" spellcheck="false">
              </label>` : ''}
              <textarea class="autosize" rows="2" data-stmt="${i}" data-part="text" aria-label="Understanding statement ${i + 1}" placeholder="Learners understand that…">${esc(t.text)}</textarea>
              ${leaf ? `<p class="dup-warn" id="dup-${i}" role="status">${esc(idProblem(t.code, t.text, id, level, i))}</p>` : ''}
              ${leaf && t.code.trim() ? kdLink(id, level, i) : ''}
            </div>
            <button class="icon-btn" data-action="del-stmt" data-i="${i}" title="Remove statement" aria-label="Remove statement ${i + 1}">×</button>
          </div>`).join('')}
        <button class="btn subtle" data-action="add-stmt">+ Add understanding statement</button>
        ${canInh ? `<button class="btn subtle" data-action="copy-parent">Copy parent’s statements in</button>` : ''}
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
          <button class="mode-opt ${mode === 'group' ? 'on' : ''}" data-action="set-mode" data-mode="group" role="radio" aria-checked="${mode === 'group'}">
            <i class="sw group"></i><b>Name only</b><small>No statement or ID; groups sub-strands</small></button>
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
            const cnt = r.status === 'orphan' ? '⚠ nothing to inherit' : r.status === 'group' ? 'name only — no statement' : r.status === 'inherit' ? `inherits ${plural(r.statements.length, 'statement')} from ${esc(r.source.name)}` : plural(r.statements.filter(t => t.text.trim()).length, 'statement');
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
        s.levels[l] = { mode: m, statements: prev.statements, codes: prev.codes || [] };
        if (m === 'own' && !prev.statements.length) s.levels[l].statements = [blankStmt()];
      }
      commit();
    },
    override() {
      const r = resolve(ui.drawer.id, ui.drawer.level);
      // Keep the IDs this strand gave the inherited statements; the source's own IDs stay with the source.
      // Knows & dos written for those inherited statements move across with them.
      const prev = idx[ui.drawer.id].s.levels[ui.drawer.level];
      const codes = prev?.codes || [], kds = prev?.kd || [];
      idx[ui.drawer.id].s.levels[ui.drawer.level] = {
        mode: 'own', codes, kd: [],
        statements: r.statements
          ? r.statements.map((t, i) => ({ code: codes[i] || '', text: t.text, ...(kds[i] ? { kd: kds[i] } : {}) }))
          : [blankStmt()]
      };
      commit();
      $('#drawer [data-stmt="0"][data-part="text"]')?.focus();
    },
    'copy-parent'() {
      const n = idx[ui.drawer.id];
      const r = inheritable(n.parent.id, ui.drawer.level);
      const L = n.s.levels[ui.drawer.level];
      L.statements = [...L.statements.filter(t => t.text.trim() || t.code.trim()), ...r.statements.map(t => ({ code: '', text: t.text }))];
      commit();
    },
    'add-stmt'() {
      const L = idx[ui.drawer.id].s.levels[ui.drawer.level];
      L.statements.push(blankStmt());
      commit();
      // Start at the ID box so every new statement gets the chance of an ID.
      // Lowest level: start at the ID box. Otherwise IDs live on sub-strands, so start at the text.
      const all = $$('#drawer [data-part="code"]');
      const texts = $$('#drawer [data-part="text"]');
      (all.length ? all[all.length - 1] : texts[texts.length - 1])?.focus();
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
      // Present wherever the parent is: inherit when something is written above, otherwise name only.
      LEVELS.forEach(l => { if (p.levels[l.key]) applyLevel(s, l.key); });
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
    'add-idea'() { area().bigIdeas.push({ name: '', description: '' }); commit({ hero: true, drawer: false }); const all = $$('#hero .idea-name'); all[all.length - 1]?.focus(); },
    'del-idea'(t) { area().bigIdeas.splice(+t.dataset.i, 1); commit({ hero: true, drawer: false }); },
    'new-area'() {
      const a = { id: uid(), name: 'New curriculum area', purpose: '', bigIdeas: [{ name: '', description: '' }], strands: [] };
      db.areas.push(a); db.currentId = a.id; ui.drawer = null; ui.collapsed.clear(); ui.page = 'structure'; ui.kd.sel = null;
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
      db = normalise(clone(window.SEED)); ui.drawer = null; ui.kd.sel = null; ui.collapsed.clear(); save(); render();
    }
  };

  function selectName() { const f = $('#strandName'); if (f) { f.focus(); f.select(); } }

  /* =====================================================================
     Knows & Dos
     Every lowest-level understanding that has an ID can hold know and do
     statements, grouped into collections. A collection is one row: its knows
     on the left and its dos on the right, so related content lines up.
     ===================================================================== */
  const SIDES = { knows: 'Know', dos: 'Do' };
  const sameRef = (a, b) => a && b && a.id === b.id && a.level === b.level && a.i === b.i;

  /** The knows & dos for one understanding (strand × level × statement index). */
  function getKD(ref, create) {
    const n = idx[ref.id];
    const L = n && n.s.levels[ref.level];
    if (!L) return null;
    if (L.mode === 'own') {
      const st = L.statements[ref.i];
      if (!st) return null;
      if (!st.kd && create) st.kd = newKD();
      return st.kd || null;
    }
    L.kd ||= [];
    if (!L.kd[ref.i] && create) L.kd[ref.i] = newKD();
    return L.kd[ref.i] || null;
  }
  function kdCount(ref) {
    let K = 0, D = 0;
    getKD(ref, false)?.collections.forEach(c => { K += c.knows.length; D += c.dos.length; });
    return { K, D };
  }

  /** All lowest-level understandings in this area, in level then tree order. */
  function understandings() {
    const out = [];
    LEVELS.forEach(l => {
      const walk = list => list.forEach(s => {
        const r = resolve(s.id, l.key);
        const codes = cellCodes(s.id, l.key, r);
        if (codes) r.statements.forEach((t, i) => {
          if (!t.text.trim() && !(codes[i] || '').trim()) return;
          out.push({ id: s.id, level: l.key, i, code: (codes[i] || '').trim(), text: t.text, inherited: r.status === 'inherit', source: r.source, path: idx[s.id].path });
        });
        walk(s.children);
      });
      walk(area().strands);
    });
    return out;
  }

  /* --- rich text: $inline$ and $$display$$ LaTeX, rendered with KaTeX --- */
  function mathHTML(tex, display) {
    if (window.katex) {
      try { return katex.renderToString(tex, { throwOnError: false, displayMode: display }); } catch (e) { /* fall through */ }
    }
    return `<code class="tex">${esc(tex)}</code>`;
  }
  function renderRich(text) {
    if (!text || !text.trim()) return '<em>Empty statement</em>';
    const DOLLAR = '\u0000';                       // "\$" means a literal dollar sign
    return text.replace(/\\\$/g, DOLLAR)
      .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/)
      .map(p => {
        if (p.length > 4 && p.startsWith('$$') && p.endsWith('$$')) return mathHTML(p.slice(2, -2), true);
        if (p.length > 2 && p.startsWith('$') && p.endsWith('$')) return mathHTML(p.slice(1, -1), false);
        return esc(p).replace(/\n/g, '<br>');
      })
      .join('')
      .replace(/\u0000/g, '$');
  }
  function imagesHTML(images, cls = '') {
    if (!images.length) return '';
    return `<div class="kd-imgs ${cls}">${images.map(im => `<figure><img src="${esc(im.src)}" alt="${esc(im.alt)}">${im.alt ? `<figcaption>${esc(im.alt)}</figcaption>` : ''}</figure>`).join('')}</div>`;
  }

  /* --- page --- */
  function renderKD() {
    const page = $('#kd-page');
    const all = understandings();
    let sel = ui.kd.sel && all.find(u => sameRef(u, ui.kd.sel) && u.code);
    if (!sel) {
      sel = all.find(u => u.code) || null;
      ui.kd.sel = sel ? { id: sel.id, level: sel.level, i: sel.i } : null;
    }
    if (location.hash !== kdHash()) history.replaceState(null, '', kdHash());
    page.innerHTML = `
      <div class="kd-layout">
        <aside class="kd-nav" aria-label="Understandings">
          <div class="kd-nav-head">
            <h2>Understandings</h2>
            <p>Choose an understanding to add the knows and dos that support it.</p>
            <label class="sr-only" for="kdSearch">Search understandings</label>
            <input id="kdSearch" class="kd-search" type="search" placeholder="Search by ID, statement or strand" value="${esc(ui.kd.q)}">
            <div class="kd-levels" role="group" aria-label="Filter by level">
              <button class="kd-lvl ${ui.kd.level === 'all' ? 'on' : ''}" data-action="kd-level" data-level="all">All</button>
              ${LEVELS.map(l => `<button class="kd-lvl ${ui.kd.level === l.key ? 'on' : ''}" style="--lc:var(--${l.key})" data-action="kd-level" data-level="${l.key}">${l.name}</button>`).join('')}
            </div>
          </div>
          <div id="kdNavList" class="kd-nav-list">${kdNavList(all)}</div>
        </aside>
        <section class="kd-main">${sel ? kdMain(sel, all) : kdEmpty(all)}</section>
      </div>`;
  }

  function kdNavList(all) {
    const q = ui.kd.q.trim().toLowerCase();
    const shown = all.filter(u =>
      (ui.kd.level === 'all' || u.level === ui.kd.level) &&
      (!q || [u.code, u.text, ...u.path.map(p => p.name)].join(' ').toLowerCase().includes(q)));
    if (!shown.length) return `<p class="muted-note kd-none">${all.length ? 'No understandings match.' : 'No understanding statements yet.'}</p>`;
    let html = '', lastLevel = '';
    shown.forEach(u => {
      if (u.level !== lastLevel) { lastLevel = u.level; html += `<h3 class="kd-nav-level" style="--lc:var(--${u.level})"><span class="lvl-pill">${LV[u.level].name}</span></h3>`; }
      const { K, D } = kdCount(u);
      const on = sameRef(u, ui.kd.sel);
      html += u.code
        ? `<button class="kd-u ${on ? 'on' : ''}" style="--lc:var(--${u.level})" data-action="kd-select" data-id="${u.id}" data-level="${u.level}" data-i="${u.i}" ${on ? 'aria-current="true"' : ''}>
            <span class="kd-u-top"><span class="sid">${esc(u.code)}</span><span class="kd-u-count ${K || D ? '' : 'zero'}">${K || D ? `K ${K} · D ${D}` : 'none yet'}</span></span>
            <span class="kd-u-path">${u.path.map(p => esc(p.name)).join(' › ')}</span>
            <span class="kd-u-text">${esc(u.text) || '<em>Empty statement</em>'}</span>
          </button>`
        : `<button class="kd-u noid" data-action="kd-fix-id" data-id="${u.id}" data-level="${u.level}" title="Give this statement an understanding ID in Structure first">
            <span class="kd-u-top"><span class="sid missing">ID needed</span></span>
            <span class="kd-u-path">${u.path.map(p => esc(p.name)).join(' › ')}</span>
            <span class="kd-u-text">${esc(u.text)}</span>
          </button>`;
    });
    return html;
  }

  function kdEmpty(all) {
    const needIds = all.filter(u => !u.code).length;
    return `<div class="empty">
      <h3>No understandings with IDs yet</h3>
      <p>Knows and dos are added to understandings. Write an understanding statement at the lowest level of a strand in Structure and give it an understanding ID.${needIds ? ` ${plural(needIds, 'statement')} ${needIds === 1 ? 'is' : 'are'} waiting for an ID.` : ''}</p>
      <button class="btn primary" data-action="page" data-page="structure">Go to Structure</button>
    </div>`;
  }

  function kdMain(sel, all) {
    const withIds = all.filter(u => u.code);
    const pos = withIds.findIndex(u => sameRef(u, sel));
    const kd = getKD(sel, false) || newKD();
    const L = LV[sel.level];
    const head = `
      <header class="kd-head" style="--lc:var(--${sel.level})">
        <div class="kd-head-top">
          <span class="lvl-pill">${L.name}</span>
          <span class="sid big">${esc(sel.code)}</span>
          <nav class="crumbs kd-crumbs">${esc(area().name)}${sel.path.map(p => ` <span>›</span> ${esc(p.name)}`).join('')}</nav>
        </div>
        <p class="kd-understanding">${esc(sel.text) || '<em>Empty statement</em>'}</p>
        ${sel.inherited ? `<p class="kd-inh">↑ Statement inherited from ${esc(sel.source.name)}; the ID and these knows and dos belong to ${esc(sel.path[sel.path.length - 1].name)}.</p>` : ''}
        <div class="kd-head-actions">
          <button class="btn ghost" data-action="kd-structure">View in Structure</button>
          <span class="grow"></span>
          <button class="btn ghost" data-action="kd-step" data-dir="-1" ${pos <= 0 ? 'disabled' : ''}>← Previous</button>
          <span class="kd-pos">${pos + 1} of ${withIds.length}</span>
          <button class="btn ghost" data-action="kd-step" data-dir="1" ${pos >= withIds.length - 1 ? 'disabled' : ''}>Next →</button>
        </div>
      </header>`;

    const bar = `
      <div class="kd-bar">
        <div class="seg" role="tablist" aria-label="Mode">
          <button data-action="kd-mode" data-preview="0" role="tab" aria-selected="${!ui.kd.preview}">Edit</button>
          <button data-action="kd-mode" data-preview="1" role="tab" aria-selected="${ui.kd.preview}">Preview</button>
        </div>
        ${ui.kd.preview ? '' : `
          <label class="tog"><input type="checkbox" data-kdseq ${kd.sequenced ? 'checked' : ''}><span>Sequence collections</span></label>
          <span class="grow"></span>
          <button class="btn" data-action="kd-add-col">+ Add collection</button>`}
      </div>`;

    if (!kd.collections.length) {
      return head + bar + `
        <div class="kd-start">
          <div class="kd-cols-head"><span>Know</span><span>Do</span></div>
          <div class="kd-start-row">
            <button class="kd-add big" data-action="kd-add-first" data-side="knows">+ Add a know statement</button>
            <button class="kd-add big" data-action="kd-add-first" data-side="dos">+ Add a do statement</button>
          </div>
          <p class="hint">Knows and dos are grouped into collections. Each collection is one row, with its knows and dos side by side. Give a collection a name to show it as a heading, or leave it unnamed and use it just to line content up.</p>
        </div>`;
    }
    return head + bar + (ui.kd.preview ? kdPreview(kd) : kdEditor(kd));
  }

  function kdEditor(kd) {
    return `<div class="kd-cols-head"><span>Know</span><span>Do</span></div>
      <div class="kd-collections">${kd.collections.map((c, ci) => `
        <section class="kd-col ${c.name.trim() ? 'named' : ''}" data-col="${c.id}">
          <header class="kd-col-head">
            <span class="handle" draggable="true" data-drag="col" data-col="${c.id}" title="Drag to reorder collections" aria-hidden="true">⋮⋮</span>
            ${kd.sequenced ? `<span class="col-num">${ci + 1}</span>` : ''}
            <input class="col-name" data-colname="${c.id}" value="${esc(c.name)}" placeholder="Unnamed collection (name is optional)" aria-label="Collection name">
            <label class="tog sm"><input type="checkbox" data-colseq="${c.id}" ${c.sequenced ? 'checked' : ''}><span>Numbered</span></label>
            <button class="icon-btn sm" data-action="kd-col-move" data-col="${c.id}" data-dir="-1" ${ci === 0 ? 'disabled' : ''} aria-label="Move collection up" title="Move up">↑</button>
            <button class="icon-btn sm" data-action="kd-col-move" data-col="${c.id}" data-dir="1" ${ci === kd.collections.length - 1 ? 'disabled' : ''} aria-label="Move collection down" title="Move down">↓</button>
            <button class="icon-btn sm danger" data-action="kd-col-del" data-col="${c.id}" aria-label="Delete collection" title="Delete collection">×</button>
          </header>
          <div class="kd-col-body">
            ${Object.keys(SIDES).map(side => `
              <div class="kd-list" data-list="${c.id}" data-side="${side}">
                <span class="kd-side-label">${SIDES[side]}</span>
                ${c[side].map((it, ii) => `
                  <div class="kd-item" draggable="true" data-drag="item" data-col="${c.id}" data-side="${side}" data-item="${it.id}">
                    <span class="kd-marker">${c.sequenced ? ii + 1 : '•'}</span>
                    <div class="kd-content" data-action="kd-edit" data-col="${c.id}" data-side="${side}" data-item="${it.id}" role="button" tabindex="0" aria-label="Edit ${SIDES[side].toLowerCase()} statement">
                      ${renderRich(it.text)}${imagesHTML(it.images, 'thumbs')}
                    </div>
                    <div class="kd-item-actions">
                      <button class="icon-btn sm" data-action="kd-item-move" data-col="${c.id}" data-side="${side}" data-item="${it.id}" data-dir="-1" ${ii === 0 ? 'disabled' : ''} aria-label="Move up" title="Move up">↑</button>
                      <button class="icon-btn sm" data-action="kd-item-move" data-col="${c.id}" data-side="${side}" data-item="${it.id}" data-dir="1" ${ii === c[side].length - 1 ? 'disabled' : ''} aria-label="Move down" title="Move down">↓</button>
                      <button class="icon-btn sm danger" data-action="kd-item-del" data-col="${c.id}" data-side="${side}" data-item="${it.id}" aria-label="Delete" title="Delete">×</button>
                    </div>
                  </div>`).join('')}
                <button class="kd-add" data-action="kd-add" data-col="${c.id}" data-side="${side}">+ Add ${SIDES[side].toLowerCase()}</button>
              </div>`).join('')}
          </div>
        </section>`).join('')}
      </div>
      <p class="hint kd-tip">Drag statements to reorder them or move them to another collection; drag ⋮⋮ to reorder collections. Click a statement to edit it.</p>`;
  }

  /** Read-only display: named collections become bold headings; unnamed ones just align content. */
  function kdPreview(kd) {
    const list = (c, side) => {
      if (!c[side].length) return '<div class="kd-pv-list empty-side"></div>';
      const tag = c.sequenced ? 'ol' : 'ul';
      return `<div class="kd-pv-list"><span class="kd-side-label">${SIDES[side]}</span><${tag}>${c[side].map(it => `<li>${renderRich(it.text)}${imagesHTML(it.images)}</li>`).join('')}</${tag}></div>`;
    };
    return `<div class="kd-preview">
      <div class="kd-cols-head"><span>Know</span><span>Do</span></div>
      ${kd.collections.map((c, ci) => `
        <section class="kd-pv-col ${c.name.trim() ? 'named' : ''}">
          ${c.name.trim() || kd.sequenced ? `<h3 class="kd-pv-name">${kd.sequenced ? `<span class="col-num">${ci + 1}</span>` : ''}${esc(c.name.trim())}</h3>` : ''}
          <div class="kd-pv-row">${list(c, 'knows')}${list(c, 'dos')}</div>
        </section>`).join('')}
    </div>`;
  }

  /* --- data operations --- */
  const kdHere = () => getKD(ui.kd.sel, true);
  const findCol = colId => kdHere().collections.find(c => c.id === colId);
  function commitKD() { save(); renderKD(); }

  function moveItem(fromCol, side, itemId, toCol, beforeId) {
    const from = findCol(fromCol), to = findCol(toCol);
    if (!from || !to) return;
    const i = from[side].findIndex(x => x.id === itemId);
    if (i < 0) return;
    const [item] = from[side].splice(i, 1);
    const j = beforeId ? to[side].findIndex(x => x.id === beforeId) : -1;
    to[side].splice(j < 0 ? to[side].length : j, 0, item);
  }
  function moveCol(colId, beforeId) {
    const cols = kdHere().collections;
    const i = cols.findIndex(c => c.id === colId);
    if (i < 0 || colId === beforeId) return;
    const [c] = cols.splice(i, 1);
    const j = beforeId ? cols.findIndex(x => x.id === beforeId) : -1;
    cols.splice(j < 0 ? cols.length : j, 0, c);
  }

  Object.assign(actions, {
    page(t) { ui.page = t.dataset.page; ui.ed = null; render(); window.scrollTo(0, 0); },
    'open-kd'(t) { ui.kd.sel = { id: t.dataset.id, level: t.dataset.level, i: +t.dataset.i }; ui.page = 'kd'; render(); window.scrollTo(0, 0); },
    'kd-select'(t) { ui.kd.sel = { id: t.dataset.id, level: t.dataset.level, i: +t.dataset.i }; renderKD(); },
    'kd-fix-id'(t) { ui.page = 'structure'; render(); openDrawer({ type: 'cell', id: t.dataset.id, level: t.dataset.level }); },
    'kd-structure'() { const s = ui.kd.sel; ui.page = 'structure'; render(); openDrawer({ type: 'cell', id: s.id, level: s.level }); },
    'kd-level'(t) { ui.kd.level = t.dataset.level; renderKD(); },
    'kd-step'(t) {
      const list = understandings().filter(u => u.code);
      const next = list[list.findIndex(u => sameRef(u, ui.kd.sel)) + +t.dataset.dir];
      if (next) { ui.kd.sel = { id: next.id, level: next.level, i: next.i }; renderKD(); }
    },
    'kd-mode'(t) { ui.kd.preview = t.dataset.preview === '1'; renderKD(); },
    'kd-add-col'() {
      const c = newCollection();
      kdHere().collections.push(c);
      commitKD();
      $(`[data-colname="${c.id}"]`)?.focus();
    },
    'kd-add-first'(t) {
      const c = newCollection();
      kdHere().collections.push(c);
      save();
      openEditor({ col: c.id, side: t.dataset.side, item: null });
    },
    'kd-col-move'(t) {
      const cols = kdHere().collections;
      const i = cols.findIndex(c => c.id === t.dataset.col), j = i + +t.dataset.dir;
      if (j < 0 || j >= cols.length) return;
      [cols[i], cols[j]] = [cols[j], cols[i]];
      commitKD();
    },
    'kd-col-del'(t) {
      const kd = kdHere(), c = findCol(t.dataset.col);
      const n = c.knows.length + c.dos.length;
      if (n && !confirm(`Delete ${c.name.trim() ? `“${c.name.trim()}”` : 'this collection'} and its ${plural(n, 'statement')}?`)) return;
      kd.collections = kd.collections.filter(x => x !== c);
      commitKD();
    },
    'kd-add'(t) { openEditor({ col: t.dataset.col, side: t.dataset.side, item: null }); },
    'kd-edit'(t) { openEditor({ col: t.dataset.col, side: t.dataset.side, item: t.dataset.item }); },
    'kd-item-move'(t) {
      const list = findCol(t.dataset.col)[t.dataset.side];
      const i = list.findIndex(x => x.id === t.dataset.item), j = i + +t.dataset.dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      commitKD();
    },
    'kd-item-del'(t) {
      const c = findCol(t.dataset.col), side = t.dataset.side;
      if (!confirm(`Delete this ${SIDES[side].toLowerCase()} statement?`)) return;
      c[side] = c[side].filter(x => x.id !== t.dataset.item);
      commitKD();
    },
    // editor
    'ed-close'() { closeEditor(); },
    'ed-save'() { saveEditor(); },
    'ed-delete'() {
      const { col, side, item } = ui.ed;
      if (!confirm(`Delete this ${SIDES[side].toLowerCase()} statement?`)) return;
      const c = findCol(col); c[side] = c[side].filter(x => x.id !== item);
      closeEditor(); commitKD();
    },
    'ed-sym'(t) { insertAtCursor($('#edText'), t.dataset.sym); edPreview(); },
    'ed-eq'() { const p = $('#eqPanel'); p.hidden = !p.hidden; if (!p.hidden) $('#eqLatex').focus(); },
    'eq-tpl'(t) { insertAtCursor($('#eqLatex'), t.dataset.tpl); eqPreview(); },
    'eq-insert'() {
      const tex = $('#eqLatex').value.trim();
      if (!tex) return;
      const display = $('#eqDisplay').checked;
      insertAtCursor($('#edText'), display ? `$$${tex}$$` : `$${tex}$`);
      $('#eqLatex').value = ''; eqPreview(); $('#eqPanel').hidden = true;
      edPreview(); $('#edText').focus();
    },
    'ed-img'() { $('#imageFile').click(); },
    'ed-img-del'(t) { ui.ed.images = ui.ed.images.filter(im => im.id !== t.dataset.img); renderEdImages(); edPreview(); }
  });

  /* --- statement editor (modal) --- */
  const SYMBOLS = [
    ['Operators', ['+', '−', '×', '÷', '±', '=', '≠', '≈', '<', '>', '≤', '≥', '∝']],
    ['Number', ['√', '∛', '²', '³', 'ⁿ', '½', '¼', '¾', 'π', '∞', '%', '‰']],
    ['Geometry', ['°', '∠', '△', '⊥', '∥', '≅', '∼', '⌒']],
    ['Sets & logic', ['∈', '∉', '⊂', '∪', '∩', '∅', '→', '⇒', '⇔', '∴']],
    ['Greek', ['α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'ρ', 'σ', 'ω', 'Δ', 'Σ', 'Ω']]
  ];
  const TEMPLATES = [
    ['Fraction', '\\frac{a}{b}', '\\frac{a}{b}'],
    ['Power', 'x^{n}', 'x^{n}'],
    ['Subscript', 'x_{1}', 'x_{1}'],
    ['Square root', '\\sqrt{x}', '\\sqrt{x}'],
    ['nth root', '\\sqrt[n]{x}', '\\sqrt[n]{x}'],
    ['Sum', '\\sum_{i=1}^{n} x_i', '\\sum_{i=1}^{n} x_i'],
    ['Integral', '\\int_{a}^{b} f(x)\\,dx', '\\int_{a}^{b} f(x)\\,dx'],
    ['Brackets', '\\left( x \\right)', '\\left( x \\right)'],
    ['Vector', '\\vec{v}', '\\vec{v}'],
    ['Units', '\\text{m s}^{-1}', '\\text{m s}^{-1}'],
    ['Times', '\\times', '\\times'],
    ['Pi', '\\pi', '\\pi']
  ];

  function openEditor({ col, side, item }) {
    const c = findCol(col);
    const it = item ? c[side].find(x => x.id === item) : null;
    ui.ed = { col, side, item, text: it ? it.text : '', images: it ? it.images.map(im => ({ ...im })) : [] };
    const sel = understandings().find(u => sameRef(u, ui.kd.sel));
    const m = $('#modal');
    m.hidden = false;
    m.innerHTML = `
      <div class="modal-backdrop" data-action="ed-close"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edTitle" style="--lc:var(--${ui.kd.sel.level})">
        <header class="modal-head">
          <div>
            <h2 id="edTitle">${it ? 'Edit' : 'Add'} ${SIDES[side].toLowerCase()} statement</h2>
            <p class="dr-sub">Supports <span class="sid">${esc(sel?.code || '')}</span> ${esc(sel?.text || '')}</p>
          </div>
          <button class="icon-btn" data-action="ed-close" aria-label="Close">×</button>
        </header>
        <div class="modal-body">
          <div class="ed-toolbar" role="toolbar" aria-label="Insert symbols">
            ${SYMBOLS.map(([label, syms]) => `<div class="sym-group" role="group" aria-label="${label}"><span class="sym-label">${label}</span>${syms.map(s => `<button class="sym" data-action="ed-sym" data-sym="${s}" title="Insert ${s}">${s}</button>`).join('')}</div>`).join('')}
          </div>
          <div class="ed-actions">
            <button class="btn" data-action="ed-eq">ƒ(x) Equation</button>
            <button class="btn" data-action="ed-img">Add image</button>
            <span class="hint">Or paste an image straight into the text box.</span>
          </div>
          <div id="eqPanel" class="eq-panel" hidden>
            <div class="eq-tpls">${TEMPLATES.map(([label, tpl, prev]) => `<button class="eq-tpl" data-action="eq-tpl" data-tpl="${esc(tpl)}" title="${label}">${mathHTML(prev, false)}<small>${label}</small></button>`).join('')}</div>
            <label class="eq-field"><span>Equation (LaTeX)</span>
              <input id="eqLatex" autocomplete="off" spellcheck="false" placeholder="e.g. P = \\frac{F}{A}">
            </label>
            <div id="eqPreview" class="eq-preview" aria-live="polite"><span class="muted-note">Preview appears here</span></div>
            <div class="eq-foot">
              <label class="tog sm"><input type="checkbox" id="eqDisplay"><span>On its own line</span></label>
              <span class="grow"></span>
              <button class="btn primary" data-action="eq-insert">Insert equation</button>
            </div>
          </div>
          <label class="sr-only" for="edText">${SIDES[side]} statement</label>
          <textarea id="edText" class="ed-text autosize" rows="3" placeholder="${side === 'knows' ? 'Learners know that…' : 'Learners can…'}">${esc(ui.ed.text)}</textarea>
          <p class="hint">Equations go between dollar signs, e.g. <code>$\\frac{1}{2}$</code>. Use <code>\\$</code> for a dollar sign.</p>
          <div id="edImages" class="ed-images"></div>
          <div class="ed-preview-wrap">
            <span class="eyebrow">Preview</span>
            <div id="edPreview" class="ed-preview"></div>
          </div>
        </div>
        <footer class="modal-foot">
          ${it ? '<button class="btn danger" data-action="ed-delete">Delete</button>' : ''}
          <span class="grow"></span>
          <button class="btn ghost" data-action="ed-close">Cancel</button>
          <button class="btn primary" data-action="ed-save">${it ? 'Save' : 'Add'} <small class="kbd">⌘↵</small></button>
        </footer>
      </div>`;
    renderEdImages(); edPreview();
    const ta = $('#edText'); autosize(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  function renderEdImages() {
    $('#edImages').innerHTML = ui.ed.images.map(im => `
      <div class="ed-img">
        <img src="${esc(im.src)}" alt="">
        <input data-imgalt="${im.id}" value="${esc(im.alt)}" placeholder="Describe the image (alt text)" aria-label="Image description">
        <button class="icon-btn sm danger" data-action="ed-img-del" data-img="${im.id}" aria-label="Remove image" title="Remove image">×</button>
      </div>`).join('');
  }
  function edPreview() {
    if (!ui.ed) return;
    ui.ed.text = $('#edText').value;
    $('#edPreview').innerHTML = ui.ed.text.trim() || ui.ed.images.length
      ? renderRich(ui.ed.text) + imagesHTML(ui.ed.images)
      : '<span class="muted-note">Start typing to see the statement.</span>';
  }
  function eqPreview() {
    const tex = $('#eqLatex').value.trim();
    $('#eqPreview').innerHTML = tex ? mathHTML(tex, true) : '<span class="muted-note">Preview appears here</span>';
  }
  function closeEditor() { ui.ed = null; const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  function saveEditor() {
    const e = ui.ed;
    if (!e) return;
    e.text = $('#edText').value;
    if (!e.text.trim() && !e.images.length) { $('#edText').focus(); return; }
    const c = findCol(e.col);
    if (e.item) Object.assign(c[e.side].find(x => x.id === e.item), { text: e.text, images: e.images });
    else c[e.side].push({ id: uid(), text: e.text, images: e.images });
    closeEditor();
    commitKD();
  }
  function insertAtCursor(el, str) {
    const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
    el.value = el.value.slice(0, a) + str + el.value.slice(b);
    el.focus();
    el.setSelectionRange(a + str.length, a + str.length);
    if (el.classList.contains('autosize')) autosize(el);
  }

  /** Downscale an image to at most 1000px and store it as a data URL, to keep browser storage small. */
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, 1000 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          const g = c.getContext('2d');
          const png = c.toDataURL && file.type === 'image/png';
          if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
          g.drawImage(img, 0, 0, c.width, c.height);
          const out = png ? c.toDataURL('image/png') : '';
          resolve(out && out.length < 400000 ? out : c.toDataURL('image/jpeg', 0.85));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async function addImages(files) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try { ui.ed.images.push({ id: uid(), src: await readImage(f), alt: '' }); }
      catch (e) { alert(`Could not read “${f.name}” as an image.`); }
    }
    renderEdImages(); edPreview();
  }

  /* --- Knows & Dos events --- */
  $('#imageFile').addEventListener('change', e => { const files = [...e.target.files]; e.target.value = ''; if (ui.ed) addImages(files); });
  document.addEventListener('paste', e => {
    if (!ui.ed) return;
    const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); addImages(files); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'kdSearch') { ui.kd.q = t.value; $('#kdNavList').innerHTML = kdNavList(understandings()); }
    else if (t.dataset.colname) { const c = findCol(t.dataset.colname); c.name = t.value; save(); t.closest('.kd-col').classList.toggle('named', !!t.value.trim()); }
    else if (t.id === 'edText') { autosize(t); edPreview(); }
    else if (t.id === 'eqLatex') eqPreview();
    else if (t.dataset.imgalt) { const im = ui.ed.images.find(x => x.id === t.dataset.imgalt); if (im) im.alt = t.value; edPreview(); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-kdseq]')) { kdHere().sequenced = t.checked; commitKD(); }
    else if (t.dataset.colseq) { findCol(t.dataset.colseq).sequenced = t.checked; commitKD(); }
  });

  // Drag and drop: statements within or between collections (same side), and whole collections.
  let drag = null;
  const clearDrop = () => $$('.drop-before, .drop-end, .dragging').forEach(x => x.classList.remove('drop-before', 'drop-end', 'dragging'));
  document.addEventListener('dragstart', e => {
    const el = e.target.closest?.('[data-drag]');
    if (!el || ui.page !== 'kd') return;
    drag = { ...el.dataset };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', drag.item || drag.col);
    const ghost = drag.drag === 'col' ? el.closest('.kd-col') : el;
    if (drag.drag === 'col') e.dataTransfer.setDragImage(ghost, 20, 20);
    requestAnimationFrame(() => ghost.classList.add('dragging'));
  });
  document.addEventListener('dragover', e => {
    if (!drag) return;
    $$('.drop-before, .drop-end').forEach(x => x.classList.remove('drop-before', 'drop-end'));
    if (drag.drag === 'item') {
      const item = e.target.closest('.kd-item'), list = e.target.closest('.kd-list');
      if (!list || list.dataset.side !== drag.side) return;
      e.preventDefault();
      if (item && item.dataset.item !== drag.item) item.classList.add('drop-before');
      else if (!item) list.classList.add('drop-end');
    } else {
      const col = e.target.closest('.kd-col'), wrap = e.target.closest('.kd-collections');
      if (!wrap) return;
      e.preventDefault();
      if (col && col.dataset.col !== drag.col) col.classList.add('drop-before');
      else if (!col) wrap.classList.add('drop-end');
    }
  });
  document.addEventListener('drop', e => {
    if (!drag) return;
    e.preventDefault();
    if (drag.drag === 'item') {
      const list = e.target.closest('.kd-list');
      if (list && list.dataset.side === drag.side) {
        const before = e.target.closest('.kd-item');
        moveItem(drag.col, drag.side, drag.item, list.dataset.list, before && before.dataset.item !== drag.item ? before.dataset.item : null);
        if (!before || before.dataset.item !== drag.item) commitKD();
      }
    } else {
      const col = e.target.closest('.kd-col');
      moveCol(drag.col, col ? col.dataset.col : null);
      commitKD();
    }
    drag = null; clearDrop();
  });
  document.addEventListener('dragend', () => { drag = null; clearDrop(); });

  /* =====================================================================
     Dashboard: understanding, know and do statements across the curriculum,
     at each level. Understandings are counted at the lowest level (each gets
     its own ID there, including sub-strands that inherit their statement).
     ===================================================================== */
  const MEASURES = [
    { key: 'u', title: 'Understanding statements', short: 'Understandings' },
    { key: 'k', title: 'Know statements', short: 'Knows' },
    { key: 'd', title: 'Do statements', short: 'Dos' }
  ];
  const BAR = '#2a78d6';                      // single hue: the level is named on the axis, not by colour
  const blankStat = () => ({ u: 0, uId: 0, covered: 0, k: 0, d: 0 });
  const addStat = (a, b) => { for (const k in a) a[k] += b[k]; return a; };

  /** Counts per area and level. Index helpers work on the current area, so switch to each one in turn. */
  function curriculumStats() {
    const keep = db.currentId, byArea = {};
    try {
      db.areas.forEach(a => {
        db.currentId = a.id; reindex();
        const per = Object.fromEntries(LEVELS.map(l => [l.key, blankStat()]));
        understandings().forEach(u => {
          const { K, D } = kdCount(u), t = per[u.level];
          t.u++; if (u.code) t.uId++; if (K || D) t.covered++; t.k += K; t.d += D;
        });
        byArea[a.id] = per;
      });
    } finally { db.currentId = keep; reindex(); }
    return byArea;
  }

  function niceScale(max) {
    if (max <= 4) return { top: 4, step: 1 };
    const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw);
    return { top: step * 4, step };
  }
  const fmt = n => n.toLocaleString('en-GB');
  const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

  /** One column chart: a measure at each level. */
  function columnChart(m, lv) {
    const vals = LEVELS.map(l => lv[l.key][m.key]);
    const total = vals.reduce((a, b) => a + b, 0);
    const { top, step } = niceScale(Math.max(...vals));
    const W = 340, H = 200, L = 34, R = 6, T = 10, B = 28, pw = W - L - R, ph = H - T - B;
    const band = pw / LEVELS.length, bw = 24, y0 = T + ph;
    const y = v => y0 - (v / top) * ph;
    let g = '';
    for (let v = 0; v <= top; v += step) {
      g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? 'axis' : 'grid'}"/>
        <text x="${L - 6}" y="${y(v) + 4}" class="tick" text-anchor="end">${fmt(v)}</text>`;
    }
    LEVELS.forEach((l, i) => {
      const v = vals[i], cx = L + band * i + band / 2, x = cx - bw / 2, yt = y(v), r = Math.min(4, y0 - yt);
      if (v > 0) g += `<path class="bar" d="M${x},${y0} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + bw - r} Q${x + bw},${yt} ${x + bw},${yt + r} V${y0} Z" fill="${BAR}"/>`;
      g += `<text x="${cx}" y="${H - 8}" class="xlab" text-anchor="middle">${l.name}</text>
        <rect class="hit" x="${L + band * i}" y="${T}" width="${band}" height="${ph}" tabindex="0"
          data-tip="${esc(`<b>${l.name}</b><span>${fmt(v)} ${m.short.toLowerCase()}</span>`)}"
          aria-label="${l.name}: ${v} ${m.title.toLowerCase()}"/>`;
    });
    return `<figure class="dash-card chart">
      <figcaption><h3>${m.title}</h3><span class="dash-total">${fmt(total)} in total</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.title} at each level">${g}</svg>
    </figure>`;
  }

  function renderDash() {
    const byArea = curriculumStats();
    if (ui.dash.area !== 'all' && !byArea[ui.dash.area]) ui.dash.area = 'all';
    const areas = ui.dash.area === 'all' ? db.areas : db.areas.filter(a => a.id === ui.dash.area);
    const lv = Object.fromEntries(LEVELS.map(l => [l.key, areas.reduce((t, a) => addStat(t, byArea[a.id][l.key]), blankStat())]));
    const tot = LEVELS.reduce((t, l) => addStat(t, { ...lv[l.key] }), blankStat());
    const scopeName = ui.dash.area === 'all' ? 'the full curriculum' : areas[0].name;

    const tiles = `
      <div class="dash-tiles">
        <div class="dash-card tile"><span class="tile-label">Understanding statements</span><b class="tile-value">${fmt(tot.u)}</b><span class="tile-sub">${fmt(tot.uId)} with an understanding ID</span></div>
        <div class="dash-card tile"><span class="tile-label">Know statements</span><b class="tile-value">${fmt(tot.k)}</b><span class="tile-sub">${tot.covered ? `${(tot.k / tot.covered).toFixed(1)} per supported understanding` : 'None written yet'}</span></div>
        <div class="dash-card tile"><span class="tile-label">Do statements</span><b class="tile-value">${fmt(tot.d)}</b><span class="tile-sub">${tot.covered ? `${(tot.d / tot.covered).toFixed(1)} per supported understanding` : 'None written yet'}</span></div>
        <div class="dash-card tile"><span class="tile-label">Understandings with knows &amp; dos</span><b class="tile-value">${pct(tot.covered, tot.u)}%</b>
          <span class="meter" role="meter" aria-valuemin="0" aria-valuemax="${tot.u}" aria-valuenow="${tot.covered}" aria-label="Understandings with knows and dos"><i style="width:${pct(tot.covered, tot.u)}%"></i></span>
          <span class="tile-sub">${fmt(tot.covered)} of ${fmt(tot.u)}</span></div>
      </div>`;

    const levelTable = `
      <div class="dash-card table-card">
        <h3>By level</h3>
        <div class="table-scroll"><table class="dash-table">
          <thead><tr><th scope="col">Level</th><th scope="col">Understandings</th><th scope="col">With an ID</th><th scope="col">With knows &amp; dos</th><th scope="col">Knows</th><th scope="col">Dos</th></tr></thead>
          <tbody>${LEVELS.map(l => { const r = lv[l.key]; return `<tr>
            <th scope="row"><span class="lvl-pill" style="--lc:var(--${l.key})">${l.name}</span></th>
            <td>${fmt(r.u)}</td><td>${fmt(r.uId)}</td><td>${fmt(r.covered)} <span class="muted">(${pct(r.covered, r.u)}%)</span></td><td>${fmt(r.k)}</td><td>${fmt(r.d)}</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><th scope="row">Total</th><td>${fmt(tot.u)}</td><td>${fmt(tot.uId)}</td><td>${fmt(tot.covered)} <span class="muted">(${pct(tot.covered, tot.u)}%)</span></td><td>${fmt(tot.k)}</td><td>${fmt(tot.d)}</td></tr></tfoot>
        </table></div>
      </div>`;

    const areaTable = ui.dash.area !== 'all' ? '' : `
      <div class="dash-card table-card">
        <h3>By curriculum area and level</h3>
        <p class="hint">Each cell shows understandings · knows · dos.</p>
        <div class="table-scroll"><table class="dash-table area-table">
          <thead><tr><th scope="col">Curriculum area</th>${LEVELS.map(l => `<th scope="col"><span class="lvl-pill" style="--lc:var(--${l.key})">${l.name}</span></th>`).join('')}<th scope="col">Total</th></tr></thead>
          <tbody>${db.areas.map(a => {
            const per = byArea[a.id], t = LEVELS.reduce((s, l) => addStat(s, { ...per[l.key] }), blankStat());
            const cell = r => r.u || r.k || r.d ? `${fmt(r.u)} · ${fmt(r.k)} · ${fmt(r.d)}` : '<span class="muted">—</span>';
            return `<tr><th scope="row"><button class="link" data-action="dash-area" data-area="${a.id}">${esc(a.name || 'Untitled area')}</button></th>${LEVELS.map(l => `<td>${cell(per[l.key])}</td>`).join('')}<td><b>${cell(t)}</b></td></tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>`;

    $('#dash-page').innerHTML = `
      <header class="dash-head">
        <div>
          <h1>Curriculum dashboard</h1>
          <p>Understanding, know and do statements in ${esc(scopeName)}, at each level.</p>
        </div>
        <div class="dash-filter" role="group" aria-label="Curriculum area">
          <button class="kd-lvl ${ui.dash.area === 'all' ? 'on' : ''}" data-action="dash-area" data-area="all">Full curriculum</button>
          ${db.areas.map(a => `<button class="kd-lvl ${ui.dash.area === a.id ? 'on' : ''}" data-action="dash-area" data-area="${a.id}">${esc(a.name || 'Untitled area')}</button>`).join('')}
        </div>
      </header>
      ${tot.u ? `${tiles}<div class="dash-charts">${MEASURES.map(m => columnChart(m, lv)).join('')}</div>${levelTable}${areaTable}`
        : `<div class="empty"><h3>Nothing to count yet</h3><p>Write understanding statements in Structure and they will be summarised here.</p><button class="btn primary" data-action="page" data-page="structure">Go to Structure</button></div>`}
      <p class="hint dash-note">Understanding statements are counted at the lowest level of each strand, where each one has its own understanding ID. Sub-strands that inherit a statement count it as their own understanding.</p>`;
  }
  actions['dash-area'] = t => { ui.dash.area = t.dataset.area; renderDash(); };

  // Tooltip for chart columns (mouse and keyboard focus).
  const tip = $('#dashTip');
  const showTip = (el, x, y) => {
    tip.innerHTML = el.dataset.tip; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2)) + 'px';
    tip.style.top = Math.max(8, y - h - 12) + 'px';
  };
  document.addEventListener('mousemove', e => {
    const el = e.target.closest?.('#dash-page [data-tip]');
    $$('#dash-page .hit.on').forEach(x => x !== el && x.classList.remove('on'));
    if (!el) { tip.hidden = true; return; }
    el.classList.add('on'); showTip(el, e.clientX, e.clientY);
  });
  document.addEventListener('focusin', e => {
    const el = e.target.closest?.('#dash-page [data-tip]');
    if (!el) { if (!e.target.closest?.('#dash-page')) tip.hidden = true; return; }
    const r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top + r.height / 3);
  });

  function kdLink(id, level, i) {
    const { K, D } = kdCount({ id, level, i });
    return `<button class="kd-link" data-action="open-kd" data-id="${id}" data-level="${level}" data-i="${i}">Knows &amp; Dos <span>K ${K} · D ${D}</span> →</button>`;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t || t.disabled) return;
    const fn = actions[t.dataset.action];
    if (fn) { e.preventDefault(); fn(t); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.ed) { closeEditor(); return; }
    if (ui.ed && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEditor(); return; }
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
      area().bigIdeas[+t.dataset.idea][t.dataset.ifield] = t.value; save();
    } else if (t.dataset.sfield) {
      idx[ui.drawer.id].s[t.dataset.sfield] = t.value; save(); renderBody();
    } else if (t.dataset.icode != null) {
      // ID for an inherited statement, stored on this (lowest-level) strand.
      const i = +t.dataset.icode;
      const L = idx[ui.drawer.id].s.levels[ui.drawer.level];
      L.codes ||= [];
      L.codes[i] = t.value;
      save(); renderBody();
      const text = resolve(ui.drawer.id, ui.drawer.level).statements?.[i]?.text || '';
      showIdProblem(i, idProblem(t.value, text, ui.drawer.id, ui.drawer.level, i));
    } else if (t.dataset.stmt != null) {
      const i = +t.dataset.stmt, part = t.dataset.part;
      const st = idx[ui.drawer.id].s.levels[ui.drawer.level].statements[i];
      st[part] = t.value;
      save(); renderBody();
      // An ID becomes required as soon as the statement has text, so re-check on either field.
      showIdProblem(i, idProblem(st.code, st.text, ui.drawer.id, ui.drawer.level, i));
    }
  });

  $('#areaSelect').addEventListener('change', e => {
    db.currentId = e.target.value; ui.drawer = null; ui.kd.sel = null; ui.collapsed.clear(); save(); render();
  });

  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.areas) || !d.areas.length) throw new Error('No curriculum areas found in this file.');
      db = normalise(d); db.currentId ||= d.areas[0].id; ui.drawer = null; ui.kd.sel = null; save(); render();
    } catch (err) { alert('Could not import: ' + err.message); }
  });

  // Hovering an inherited cell lights up the cell it inherits from.
  document.addEventListener('mouseover', e => {
    const c = e.target.closest('.cell.inh');
    $$('.src-hl').forEach(x => x.classList.remove('src-hl'));
    if (c) $(`[data-cell="${c.dataset.src}"]`)?.classList.add('src-hl');
  });

  function showIdProblem(i, msg) {
    const w = $(`#dup-${i}`);
    if (w) w.textContent = msg;
    const inp = $(`#drawer [data-icode="${i}"], #drawer [data-stmt="${i}"][data-part="code"]`);
    if (inp) inp.classList.toggle('need', msg.includes('needs'));
  }

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

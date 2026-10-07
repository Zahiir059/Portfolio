'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const mb = (b) => (b.size / 1048576).toFixed(1) + ' MB';
  const view = $('#view');

  let projects = [];
  let profile = {};
  let draft = null;
  let pdraft = null;
  let current = 'portfolio';
  let urls = [];
  let deferredInstall = null;

  /* ---------- storage (IndexedDB) ---------- */
  let db;
  function openDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('portfolio-builder', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('projects', { keyPath: 'id' });
        r.result.createObjectStore('kv');
      };
      r.onsuccess = () => { db = r.result; resolve(); };
      r.onerror = () => reject(r.error);
    });
  }
  function tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const rq = fn(t.objectStore(store));
      t.oncomplete = () => resolve(rq ? rq.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const dbAll = () => tx('projects', 'readonly', (s) => s.getAll());
  const dbPutProject = (p) => tx('projects', 'readwrite', (s) => s.put(p));
  const dbDelProject = (id) => tx('projects', 'readwrite', (s) => s.delete(id));
  const dbGetKV = (k) => tx('kv', 'readonly', (s) => s.get(k));
  const dbPutKV = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));

  async function loadAll() {
    projects = (await dbAll()).sort((a, b) => b.created - a.created);
    profile = (await dbGetKV('profile')) || {};
  }

  /* ---------- helpers ---------- */
  function url(blob) {
    const u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  }
  function clearUrls() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function resizeImage(file, max = 1600, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * k);
        const h = Math.round(img.height * k);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const c = cv.getContext('2d');
        c.fillStyle = '#fff';
        c.fillRect(0, 0, w, h);
        c.drawImage(img, 0, 0, w, h);
        cv.toBlob((b) => { URL.revokeObjectURL(u); b ? resolve(b) : reject(new Error('Could not process image')); }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('Could not read this image')); };
      img.src = u;
    });
  }
  const toDataURL = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  const toBlob = (dataUrl) => fetch(dataUrl).then((r) => r.blob());

  /* ---------- graphs ---------- */
  function parseData(text) {
    const rows = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[,;\t]/).map((c) => c.trim()));
    if (!rows.length) return null;
    const num = (v) => v !== undefined && v !== '' && isFinite(Number(v));
    let names = null;
    let body = rows;
    if (rows[0].length > 1 && rows[0].slice(1).some((c) => !num(c))) { names = rows[0].slice(1); body = rows.slice(1); }
    body = body.filter((r) => r.length > 1 && r.slice(1).some(num));
    if (!body.length) return null;
    const n = Math.max.apply(null, body.map((r) => r.length - 1));
    const series = [];
    for (let s = 0; s < n; s++) {
      series.push({
        name: (names && names[s]) || (n > 1 ? 'Series ' + (s + 1) : ''),
        values: body.map((r) => (num(r[s + 1]) ? Number(r[s + 1]) : null))
      });
    }
    return { labels: body.map((r) => r[0]), series };
  }
  function niceNum(x, round) {
    const e = Math.floor(Math.log10(x));
    const f = x / Math.pow(10, e);
    let nf;
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, e);
  }
  function niceTicks(min, max, n) {
    const range = niceNum(max - min, false);
    const step = niceNum(range / n, true);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const t = [];
    for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function drawChart(cv, g) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300;
    const h = cv.clientHeight || 200;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const d = parseData(g.data);
    c.font = '12px ' + css('--font-mono');
    c.textBaseline = 'middle';
    if (!d) {
      c.fillStyle = css('--muted');
      c.textAlign = 'center';
      c.fillText('Enter data to see the graph', w / 2, h / 2);
      return;
    }
    const cols = [css('--s1'), css('--s2'), css('--s3'), css('--s4')];
    const multi = d.series.length > 1;
    const padL = 46, padR = 12, padT = 12 + (multi ? 22 : 0), padB = 32;
    const pw = w - padL - padR;
    const ph = h - padT - padB;
    const vals = [];
    d.series.forEach((s) => s.values.forEach((v) => { if (v !== null) vals.push(v); }));
    let min = Math.min.apply(null, vals);
    let max = Math.max.apply(null, vals);
    if (g.type !== 'line') min = Math.min(0, min);
    if (min === max) max = min + 1;
    const ticks = niceTicks(min, max, 4);
    min = ticks[0];
    max = ticks[ticks.length - 1];
    const Y = (v) => padT + ph * (1 - (v - min) / (max - min));
    const L = d.labels.length;
    const slot = pw / L;

    // grid and y labels
    c.lineWidth = 1;
    c.textAlign = 'right';
    ticks.forEach((t) => {
      const y = Math.round(Y(t)) + 0.5;
      c.strokeStyle = t === 0 ? css('--muted') : css('--grid');
      c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + pw, y); c.stroke();
      c.fillStyle = css('--muted');
      c.fillText(String(+t.toPrecision(4)), padL - 6, y);
    });

    // x labels, skipping some when they would collide
    c.textAlign = 'center';
    c.fillStyle = css('--muted');
    let maxW = 0;
    d.labels.forEach((l) => { maxW = Math.max(maxW, c.measureText(l).width); });
    const every = Math.max(1, Math.ceil((maxW + 10) / slot));
    d.labels.forEach((l, i) => {
      if (i % every === 0) c.fillText(l, padL + slot * (i + 0.5), padT + ph + 16);
    });

    // marks
    const ns = d.series.length;
    if (g.type === 'line') {
      d.series.forEach((s, si) => {
        c.strokeStyle = cols[si % 4];
        c.fillStyle = cols[si % 4];
        c.lineWidth = 2;
        c.lineJoin = 'round';
        c.beginPath();
        let pen = false;
        s.values.forEach((v, i) => {
          if (v === null) { pen = false; return; }
          const x = padL + slot * (i + 0.5);
          if (!pen) { c.moveTo(x, Y(v)); pen = true; } else c.lineTo(x, Y(v));
        });
        c.stroke();
        s.values.forEach((v, i) => {
          if (v === null) return;
          c.beginPath();
          c.arc(padL + slot * (i + 0.5), Y(v), 3, 0, Math.PI * 2);
          c.fill();
        });
      });
    } else {
      const group = slot * 0.72;
      const bw = group / ns;
      d.series.forEach((s, si) => {
        c.fillStyle = cols[si % 4];
        s.values.forEach((v, i) => {
          if (v === null) return;
          const x = padL + slot * i + (slot - group) / 2 + bw * si;
          const y0 = Y(0), y1 = Y(v);
          c.fillRect(x, Math.min(y0, y1), Math.max(bw - 1, 1), Math.abs(y0 - y1));
        });
      });
    }

    // legend
    if (multi) {
      c.textAlign = 'left';
      let x = padL;
      d.series.forEach((s, si) => {
        c.fillStyle = cols[si % 4];
        c.fillRect(x, 10, 12, 4);
        c.fillStyle = css('--muted');
        c.fillText(s.name, x + 18, 12);
        x += 18 + c.measureText(s.name).width + 18;
      });
    }
  }
  function drawAllCharts() {
    if (current === 'detail') {
      const p = projects.find((x) => x.id === currentId);
      if (p) $$('canvas[data-gview]').forEach((cv) => drawChart(cv, p.graphs[+cv.dataset.gview]));
    } else if (current === 'add' && draft) {
      $$('canvas[data-gprev]').forEach((cv) => drawChart(cv, draft.graphs[+cv.dataset.gprev]));
    }
  }

  /* ---------- navigation ---------- */
  let currentId = null;
  function go(v, id) {
    current = v;
    currentId = id || null;
    clearUrls();
    if (v === 'add') {
      const p = id && projects.find((x) => x.id === id);
      draft = p ? draftFrom(p) : blankDraft();
      renderForm();
    } else if (v === 'detail') renderDetail(id);
    else if (v === 'profile') { pdraft = Object.assign({}, profile); renderProfile(); }
    else if (v === 'backup') renderBackup();
    else { current = 'portfolio'; renderPortfolio(); }
    $$('#nav button').forEach((b) => {
      const on = b.dataset.go === (current === 'detail' ? 'portfolio' : current);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }

  /* ---------- portfolio ---------- */
  function renderPortfolio() {
    const p = profile;
    const contact = [];
    if (p.location) contact.push(`<span>${esc(p.location)}</span>`);
    if (p.email) contact.push(`<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`);
    if (p.phone) contact.push(`<span>${esc(p.phone)}</span>`);
    if (p.linkedin) contact.push(/^https?:\/\//i.test(p.linkedin) ? `<a href="${esc(p.linkedin)}" target="_blank" rel="noopener">${esc(p.linkedin.replace(/^https?:\/\/(www\.)?/i, ''))}</a>` : `<span>${esc(p.linkedin)}</span>`);

    const cards = projects.map((pr) => {
      const counts = [];
      if (pr.images.length) counts.push(pr.images.length + (pr.images.length === 1 ? ' image' : ' images'));
      if (pr.videos.length) counts.push(pr.videos.length + (pr.videos.length === 1 ? ' video' : ' videos'));
      if (pr.graphs.length) counts.push(pr.graphs.length + (pr.graphs.length === 1 ? ' graph' : ' graphs'));
      return `<article class="pcard" data-open="${esc(pr.id)}" tabindex="0" role="button" aria-label="Open ${esc(pr.title)}">
        ${pr.images.length ? `<img class="cover" src="${url(pr.images[0])}" alt="">` : `<div class="nocover">No image</div>`}
        <div class="pbody">
          <h3>${esc(pr.title)}</h3>
          ${pr.summary ? `<p>${esc(pr.summary)}</p>` : ''}
          ${pr.tools.length ? `<ul class="tags">${pr.tools.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          ${counts.length ? `<span class="counts">${counts.join(' · ')}</span>` : ''}
        </div>
      </article>`;
    }).join('');

    view.innerHTML = `
      <section class="hero">
        ${p.photo ? `<img class="avatar" src="${url(p.photo)}" alt="">` : ''}
        <div>
          <h1>${esc(p.name || 'Your name')}</h1>
          ${p.headline ? `<p class="headline">${esc(p.headline)}</p>` : ''}
          ${contact.length ? `<div class="contact">${contact.join('')}</div>` : ''}
        </div>
      </section>
      ${p.about ? `<p class="about">${esc(p.about)}</p>` : ''}
      ${!p.name ? `<p class="hint">Open the Profile tab to add your name, headline and contact details.</p>` : ''}
      <div class="sec-head"><h2>Projects</h2><span class="label">${projects.length}</span></div>
      ${projects.length ? `<div class="grid">${cards}</div>` : `
        <div class="empty">
          <p>No projects yet. Add your first project with its details, images, videos and graphs, and it will appear here.</p>
          <button type="button" class="btn" data-act="new">Add a project</button>
        </div>`}
    `;
  }

  /* ---------- project detail ---------- */
  function renderDetail(id) {
    const p = projects.find((x) => x.id === id);
    if (!p) { go('portfolio'); return; }
    const links = (p.links || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    view.innerHTML = `
      <article class="detail">
        <div class="actions">
          <button type="button" class="btn ghost small" data-act="back">Back</button>
          <button type="button" class="btn ghost small" data-act="edit" data-i="${esc(p.id)}">Edit</button>
          <button type="button" class="btn danger small" data-act="delete" data-i="${esc(p.id)}">Delete</button>
        </div>
        <div class="block">
          ${p.date ? `<p class="label">${esc(p.date)}</p>` : ''}
          <h1>${esc(p.title)}</h1>
          ${p.tools.length ? `<ul class="tags">${p.tools.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        </div>
        ${p.summary ? `<div class="block"><p class="label">Summary</p><p>${esc(p.summary)}</p></div>` : ''}
        ${p.work ? `<div class="block"><p class="label">What I did</p><p>${esc(p.work)}</p></div>` : ''}
        ${p.images.length ? `<div class="block"><p class="label">Images</p><div class="gallery">${p.images.map((b, i) => `<img src="${url(b)}" alt="Project image ${i + 1}" data-act="zoom">`).join('')}</div></div>` : ''}
        ${p.videos.length ? `<div class="block"><p class="label">Videos</p>${p.videos.map((b) => `<video controls preload="metadata" playsinline src="${url(b)}"></video>`).join('')}</div>` : ''}
        ${links.length ? `<div class="block"><p class="label">Links</p><div class="links">${links.map((l) => /^https?:\/\//i.test(l) ? `<a href="${esc(l)}" target="_blank" rel="noopener">${esc(l)}</a>` : `<span>${esc(l)}</span>`).join('')}</div></div>` : ''}
        ${p.graphs.length ? `<div class="block"><p class="label">Graphs</p>${p.graphs.map((g, i) => `<figure class="chart">${g.title ? `<h3>${esc(g.title)}</h3>` : ''}<canvas data-gview="${i}" role="img" aria-label="${esc(g.title || 'Graph')}"></canvas></figure>`).join('')}</div>` : ''}
      </article>`;
    drawAllCharts();
  }

  /* ---------- add / edit project ---------- */
  const blankDraft = () => ({ id: null, created: null, title: '', date: '', toolsText: '', summary: '', work: '', links: '', images: [], videos: [], graphs: [] });
  const draftFrom = (p) => ({
    id: p.id, created: p.created, title: p.title, date: p.date || '', toolsText: p.tools.join(', '),
    summary: p.summary || '', work: p.work || '', links: p.links || '',
    images: p.images.slice(), videos: p.videos.slice(), graphs: p.graphs.map((g) => Object.assign({}, g))
  });

  function renderForm() {
    const y = window.scrollY;
    clearUrls();
    const d = draft;
    view.innerHTML = `
      <div class="screen-head">
        <p class="label">${d.id ? 'Edit project' : 'New project'}</p>
        <h1>${d.id ? 'Edit project' : 'Add a project'}</h1>
      </div>
      <div class="form">
        <section class="panel">
          <h2>Details</h2>
          <label class="field"><span>Title</span><input type="text" id="f-title" data-f="title" value="${esc(d.title)}" placeholder="Project name" autocomplete="off"></label>
          <div class="two">
            <label class="field"><span>When</span><input type="text" data-f="date" value="${esc(d.date)}" placeholder="Jun to Sep 2026" autocomplete="off"></label>
            <label class="field"><span>Tools, comma separated</span><input type="text" data-f="toolsText" value="${esc(d.toolsText)}" placeholder="Allen Bradley PLC, VFD" autocomplete="off"></label>
          </div>
          <label class="field"><span>Summary</span><textarea data-f="summary" rows="3" placeholder="What the project is about">${esc(d.summary)}</textarea></label>
          <label class="field"><span>What I did</span><textarea data-f="work" rows="5" placeholder="Your part, steps, results">${esc(d.work)}</textarea></label>
        </section>

        <section class="panel">
          <h2>Images</h2>
          ${d.images.length ? `<div class="thumbs">${d.images.map((b, i) => `<div class="thumb"><img src="${url(b)}" alt="Image ${i + 1}"><button type="button" class="btn danger small" data-act="rm-image" data-i="${i}" aria-label="Remove image ${i + 1}">Remove</button></div>`).join('')}</div>` : ''}
          <label class="field"><span>Add images from gallery or camera</span><input type="file" id="f-images" accept="image/*" multiple></label>
          <p class="note">Images are resized to save space.</p>
        </section>

        <section class="panel">
          <h2>Videos</h2>
          ${d.videos.map((b, i) => `<div class="filerow"><span>${esc(b.name || 'Video ' + (i + 1))} · ${mb(b)}</span><button type="button" class="btn danger small" data-act="rm-video" data-i="${i}">Remove</button></div>`).join('')}
          <label class="field"><span>Add videos from gallery</span><input type="file" id="f-videos" accept="video/*" multiple></label>
          <p class="note">Videos take a lot of phone storage. For long videos, paste a YouTube or Drive link below instead.</p>
          <label class="field"><span>Video or other links, one per line</span><textarea data-f="links" rows="3" placeholder="https://...">${esc(d.links)}</textarea></label>
        </section>

        <section class="panel">
          <h2>Graphs</h2>
          ${d.graphs.map((g, i) => `
            <div class="gform">
              <div class="two">
                <label class="field"><span>Graph title</span><input type="text" data-g="${i}" data-gf="title" value="${esc(g.title)}" placeholder="Power factor before and after" autocomplete="off"></label>
                <label class="field"><span>Type</span><select data-g="${i}" data-gf="type"><option value="bar"${g.type === 'bar' ? ' selected' : ''}>Bar</option><option value="line"${g.type === 'line' ? ' selected' : ''}>Line</option></select></label>
              </div>
              <label class="field"><span>Data, one row per line</span><textarea class="mono" rows="6" data-g="${i}" data-gf="data" placeholder="Month,Before,After&#10;Jan,0.82,0.96&#10;Feb,0.80,0.97">${esc(g.data)}</textarea></label>
              <canvas data-gprev="${i}" role="img" aria-label="Graph preview"></canvas>
              <div class="actions"><button type="button" class="btn danger small" data-act="rm-graph" data-i="${i}">Remove graph</button></div>
            </div>`).join('')}
          <div class="actions"><button type="button" class="btn ghost" data-act="add-graph">Add a graph</button></div>
          <p class="note">The first line can be column names, for example Month,Before,After. Each next line is a label followed by numbers. You can paste rows copied from Excel.</p>
        </section>

        <div class="actions">
          <button type="button" class="btn" data-act="save">Save project</button>
          <button type="button" class="btn ghost" data-act="cancel">Cancel</button>
        </div>
      </div>`;
    drawAllCharts();
    window.scrollTo(0, y);
  }

  async function saveDraft() {
    const d = draft;
    if (!d.title.trim()) { toast('Add a title first'); $('#f-title').focus(); return; }
    const now = Date.now();
    const rec = {
      id: d.id || uid(),
      title: d.title.trim(),
      date: d.date.trim(),
      tools: d.toolsText.split(/[,\n]/).map((t) => t.trim()).filter(Boolean),
      summary: d.summary.trim(),
      work: d.work.trim(),
      links: d.links.trim(),
      images: d.images,
      videos: d.videos,
      graphs: d.graphs.filter((g) => g.title.trim() || g.data.trim()),
      created: d.created || now,
      updated: now
    };
    try {
      await dbPutProject(rec);
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      await loadAll();
      toast('Saved');
      go('detail', rec.id);
    } catch (err) {
      toast('Could not save. Storage may be full: remove a video or some images and try again.');
    }
  }

  async function addImages(files) {
    toast('Adding images');
    for (const f of files) {
      try { draft.images.push(await resizeImage(f)); } catch (err) { toast(err.message); }
    }
    renderForm();
  }

  /* ---------- profile ---------- */
  function renderProfile() {
    const y = window.scrollY;
    clearUrls();
    const p = pdraft;
    view.innerHTML = `
      <div class="screen-head"><p class="label">Profile</p><h1>Your details</h1></div>
      <div class="form">
        <section class="panel">
          ${p.photo ? `<img class="avatar" src="${url(p.photo)}" alt="Profile photo">` : ''}
          <label class="field"><span>Photo</span><input type="file" id="p-photo" accept="image/*"></label>
          ${p.photo ? `<div class="actions"><button type="button" class="btn danger small" data-act="rm-photo">Remove photo</button></div>` : ''}
          <label class="field"><span>Name</span><input type="text" data-p="name" value="${esc(p.name)}" autocomplete="name"></label>
          <label class="field"><span>Headline</span><input type="text" data-p="headline" value="${esc(p.headline)}" placeholder="Electrical Engineer, FAST-NUCES" autocomplete="off"></label>
          <label class="field"><span>About you</span><textarea data-p="about" rows="5">${esc(p.about)}</textarea></label>
          <label class="field"><span>Location</span><input type="text" data-p="location" value="${esc(p.location)}" autocomplete="off"></label>
          <div class="two">
            <label class="field"><span>Email</span><input type="email" data-p="email" value="${esc(p.email)}" autocomplete="email"></label>
            <label class="field"><span>Phone or WhatsApp</span><input type="tel" data-p="phone" value="${esc(p.phone)}" autocomplete="tel"></label>
          </div>
          <label class="field"><span>LinkedIn link</span><input type="url" data-p="linkedin" value="${esc(p.linkedin)}" placeholder="https://linkedin.com/in/..." autocomplete="off"></label>
        </section>
        <div class="actions"><button type="button" class="btn" data-act="save-profile">Save profile</button></div>
      </div>`;
    window.scrollTo(0, y);
  }
  async function saveProfile() {
    try {
      profile = Object.assign({}, pdraft);
      await dbPutKV('profile', profile);
      toast('Profile saved');
      go('portfolio');
    } catch (err) { toast('Could not save the profile'); }
  }

  /* ---------- backup and restore ---------- */
  function renderBackup() {
    view.innerHTML = `
      <div class="screen-head"><p class="label">Backup</p><h1>Keep your work safe</h1></div>
      <div class="form">
        <section class="panel">
          <h2>Save a copy</h2>
          <p class="note">Your projects live inside this phone's browser. Clearing browser data deletes them, so save a backup file now and then.</p>
          <p class="stat"><span>${projects.length} projects</span><span id="storage-info"></span></p>
          <label class="check"><input type="checkbox" id="b-videos"><span>Include videos (the file can become very large)</span></label>
          <div class="actions">
            <button type="button" class="btn" data-act="backup">Download backup</button>
            <button type="button" class="btn ghost" data-act="share-backup" id="share-btn" hidden>Share backup</button>
          </div>
        </section>
        <section class="panel">
          <h2>Restore</h2>
          <p class="note">Pick a backup file saved earlier. Projects with the same id are replaced, others are kept.</p>
          <label class="field"><span>Backup file</span><input type="file" id="restore-file" accept="application/json,.json"></label>
        </section>
        <section class="panel">
          <h2>Install</h2>
          ${deferredInstall
            ? `<p class="note">Install this app on your home screen so it opens like any other app.</p><div class="actions"><button type="button" class="btn" data-act="install">Install app</button></div>`
            : `<p class="note">In Chrome, open the menu and choose Install app or Add to Home screen.</p>`}
        </section>
      </div>`;
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((e) => {
        const el = $('#storage-info');
        if (el && e.usage != null) el.textContent = 'Using ' + (e.usage / 1048576).toFixed(1) + ' MB' + (e.quota ? ' of ' + Math.round(e.quota / 1048576) + ' MB available' : '');
      });
    }
    if (navigator.canShare) $('#share-btn').hidden = false;
  }

  async function makeBackup() {
    const withVideos = $('#b-videos') && $('#b-videos').checked;
    const out = {
      app: 'portfolio-builder', version: 1, exported: new Date().toISOString(), videosIncluded: !!withVideos,
      profile: Object.assign({}, profile, { photo: profile.photo ? await toDataURL(profile.photo) : null }),
      projects: []
    };
    for (const p of projects) {
      out.projects.push(Object.assign({}, p, {
        images: await Promise.all(p.images.map(toDataURL)),
        videos: withVideos ? await Promise.all(p.videos.map(toDataURL)) : []
      }));
    }
    const name = 'portfolio-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    return { blob: new Blob([JSON.stringify(out)], { type: 'application/json' }), name };
  }
  async function downloadBackup() {
    try {
      toast('Preparing backup');
      const { blob, name } = await makeBackup();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Backup saved to your downloads');
    } catch (err) { toast('Could not make the backup'); }
  }
  async function shareBackup() {
    try {
      const { blob, name } = await makeBackup();
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Portfolio backup' });
      else toast('Sharing is not available here. Use Download backup.');
    } catch (err) { if (err && err.name !== 'AbortError') toast('Could not share the backup'); }
  }
  async function restore(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'portfolio-builder' || !Array.isArray(data.projects)) throw new Error('This is not a Portfolio Builder backup.');
      const existing = new Map(projects.map((p) => [p.id, p]));
      for (const p of data.projects) {
        const old = existing.get(p.id);
        const rec = Object.assign({}, p, {
          images: await Promise.all((p.images || []).map(toBlob)),
          videos: data.videosIncluded ? await Promise.all((p.videos || []).map(toBlob)) : (old ? old.videos : [])
        });
        await dbPutProject(rec);
      }
      if (data.profile) {
        const pr = Object.assign({}, data.profile);
        pr.photo = pr.photo ? await toBlob(pr.photo) : undefined;
        await dbPutKV('profile', pr);
      }
      await loadAll();
      toast('Restored ' + data.projects.length + (data.projects.length === 1 ? ' project' : ' projects'));
      renderBackup();
    } catch (err) { toast(err.message || 'Could not restore this file'); }
  }

  /* ---------- events ---------- */
  view.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) {
      const card = e.target.closest('[data-open]');
      if (card) go('detail', card.dataset.open);
      return;
    }
    const i = el.dataset.i;
    switch (el.dataset.act) {
      case 'new': go('add'); break;
      case 'back': go('portfolio'); break;
      case 'edit': go('add', i); break;
      case 'cancel': go(draft && draft.id ? 'detail' : 'portfolio', draft && draft.id); break;
      case 'delete':
        if (window.confirm('Delete this project? This cannot be undone.')) {
          await dbDelProject(i);
          await loadAll();
          toast('Project deleted');
          go('portfolio');
        }
        break;
      case 'zoom': $('#lightbox img').src = el.src; $('#lightbox').hidden = false; break;
      case 'save': saveDraft(); break;
      case 'rm-image': draft.images.splice(+i, 1); renderForm(); break;
      case 'rm-video': draft.videos.splice(+i, 1); renderForm(); break;
      case 'add-graph': draft.graphs.push({ title: '', type: 'bar', data: '' }); renderForm(); break;
      case 'rm-graph': draft.graphs.splice(+i, 1); renderForm(); break;
      case 'rm-photo': pdraft.photo = undefined; renderProfile(); break;
      case 'save-profile': saveProfile(); break;
      case 'backup': downloadBackup(); break;
      case 'share-backup': shareBackup(); break;
      case 'install':
        if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; renderBackup(); }
        break;
    }
  });

  view.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const card = e.target.closest && e.target.closest('[data-open]');
    if (card) go('detail', card.dataset.open);
  });

  function onField(t) {
    if (t.dataset.f && draft) draft[t.dataset.f] = t.value;
    if (t.dataset.p && pdraft) pdraft[t.dataset.p] = t.value;
    if (t.dataset.g !== undefined && draft) {
      const i = +t.dataset.g;
      draft.graphs[i][t.dataset.gf] = t.value;
      const cv = view.querySelector('canvas[data-gprev="' + i + '"]');
      if (cv) drawChart(cv, draft.graphs[i]);
    }
  }
  view.addEventListener('input', (e) => onField(e.target));
  view.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.tagName === 'SELECT') onField(t);
    if (t.id === 'f-images' && t.files.length) addImages(Array.from(t.files));
    if (t.id === 'f-videos' && t.files.length) {
      Array.from(t.files).forEach((f) => draft.videos.push(f));
      renderForm();
    }
    if (t.id === 'p-photo' && t.files.length) {
      try { pdraft.photo = await resizeImage(t.files[0], 480, 0.88); renderProfile(); } catch (err) { toast(err.message); }
    }
    if (t.id === 'restore-file' && t.files.length) restore(t.files[0]);
  });

  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) go(b.dataset.go);
  });

  const closeLightbox = () => { $('#lightbox').hidden = true; $('#lightbox img').removeAttribute('src'); };
  $('#lb-close').addEventListener('click', closeLightbox);
  $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  window.addEventListener('resize', drawAllCharts);
  if (window.matchMedia) {
    const dm = window.matchMedia('(prefers-color-scheme: dark)');
    if (dm.addEventListener) dm.addEventListener('change', drawAllCharts);
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (current === 'backup') renderBackup();
  });

  /* ---------- start ---------- */
  (async () => {
    try {
      await openDB();
      await loadAll();
      go('portfolio');
    } catch (err) {
      view.innerHTML = '<div class="empty"><p>This browser cannot store data for the app. Open it in Chrome and make sure you are not in a private window.</p></div>';
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  })();
})();

function initCounselingApp(){
  document.body.classList.remove('data-loading');
  const students = DATA.students;
  const mentors = DATA.mentors;

  // ---- indices ----
  const studentById = new Map(students.map(s => [s.id, s]));
  const mentorById = new Map(mentors.map(m => [m.id, m]));

  // ---- palette for avatars (derived from brand tokens) ----
  const PALETTE = ['#8B1A1A','#1C3557','#B8860B','#2F5233','#6B4226','#4A3B6B','#1F5F5B','#8B4513'];
  function colorFor(str){
    let h = 0;
    for (let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) >>> 0; }
    return PALETTE[h % PALETTE.length];
  }
  function initials(name){
    if(!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if(parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  }
  function titleCase(name){
    if(!name) return '';
    return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+/g,' ').trim();
  }
  function fmtPhone(v){
    if(v === null || v === undefined || v === '') return '&mdash;';
    return String(v).trim();
  }
  function fmtYear(yos){
    if(yos === null || yos === undefined || yos === '') return '&mdash;';
    const map = {1:'1st Year',2:'2nd Year',3:'3rd Year',4:'4th Year'};
    return map[yos] || (yos + (typeof yos === 'number' ? ' Year' : ''));
  }
  function escapeHtml(str){
    if(str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---- academic helpers ----
  function cgpaBand(cgpa){
    if(cgpa === null || cgpa === undefined) return null;
    if(cgpa >= 7.75) return {cls:'cgpa-dist', label:'Distinction'};
    if(cgpa >= 6.75) return {cls:'cgpa-first', label:'First Class'};
    if(cgpa >= 5.75) return {cls:'cgpa-second', label:'Second Class'};
    if(cgpa >= 5.25) return {cls:'cgpa-pass', label:'Pass Class'};
    return {cls:'cgpa-low', label:'Below Pass'};
  }
  const STATUS_LABEL = {F:'Fail', DT:'Detained', NA:'Not Attempted', GP:'Grade Pending', 'GP/MP':'Grade Pending'};
  function statusLabel(code){ return STATUS_LABEL[code] || code || '&mdash;'; }

  function renderAcademicPanel(s){
    const hasAcademics = s.cgpa !== null && s.cgpa !== undefined;
    if(!hasAcademics) return '';

    const band = cgpaBand(s.cgpa);
    const backlogCount = s.backlogCount || 0;
    const backlogs = Array.isArray(s.backlogs) ? s.backlogs : [];
    const notDeclared = Array.isArray(s.notDeclared) ? s.notDeclared : [];
    const total = s.totalCredits, obtained = s.obtainedCredits;
    const pct = (total && obtained !== null) ? Math.min(100, Math.round((obtained/total)*100)) : null;

    const cgpaChip = `
      <div class="acad-chip ${band ? band.cls : ''}">
        <div class="acad-lbl">CGPA</div>
        <div class="acad-val">${s.cgpa.toFixed(2)}</div>
        ${band ? `<div class="acad-sub">${band.label}</div>` : ''}
      </div>`;

    const creditsChip = `
      <div class="acad-chip">
        <div class="acad-lbl">Credits</div>
        <div class="acad-val">${obtained !== null ? obtained : '&mdash;'}${total ? ` <span style="font-size:12px;color:var(--ink-soft);">/ ${total}</span>` : ''}</div>
        ${pct !== null ? `<div class="credit-bar-track"><div class="credit-bar-fill" style="width:${pct}%"></div></div>` : ''}
      </div>`;

    const backlogChip = `
      <div class="acad-chip ${backlogCount > 0 ? 'backlog-bad' : 'backlog-ok'}">
        <div class="acad-lbl">Backlogs</div>
        <div class="acad-val">${backlogCount}</div>
        <div class="acad-sub">${backlogCount > 0 ? 'active' : 'clear'}</div>
      </div>`;

    const backlogListId = 'bl_' + s.id;
    const backlogSection = backlogCount > 0 ? `
      <button class="acad-detail-toggle" data-toggle="${backlogListId}">Show ${backlogCount} backlog${backlogCount>1?'s':''} &darr;</button>
      <div class="backlog-list hidden" id="${backlogListId}">
        ${backlogs.map(b => `
          <div class="backlog-row">
            <div class="bl-course">${escapeHtml(b.course)}</div>
            <div class="bl-meta">${escapeHtml(b.year)} &middot; ${escapeHtml(b.sem)}${b.credits ? ` &middot; ${escapeHtml(b.credits)} cr` : ''}</div>
            <div class="bl-status">${escapeHtml(statusLabel(b.status))}</div>
          </div>
        `).join('')}
      </div>` : '';

    const notDeclaredSection = notDeclared.length > 0 ? `
      <div class="notdeclared-note">
        <b>${notDeclared.length}</b> course${notDeclared.length>1?'s':''} awaiting result declaration: ${notDeclared.map(escapeHtml).join(', ')}
      </div>` : '';

    return `
      <div class="acad-panel">
        <div class="acad-chips">
          ${cgpaChip}
          ${creditsChip}
          ${backlogChip}
        </div>
        ${backlogSection}
        ${notDeclaredSection}
      </div>`;
  }

  // ---- stats ----
  const statsRow = document.getElementById('statsRow');
  const avgLoad = (students.length / mentors.length).toFixed(1);
  const withBacklogs = students.filter(s => (s.backlogCount || 0) > 0).length;
  statsRow.innerHTML ='' ;/*<div class="num">Students in their early academic stage need the help of an expert who acts as their mentor, guide, and well-wisher. At KLU CS&IT, we initiate counseling of all sorts at different stages, or students can approach us directly when in need.</p></div>';/*  `
    <div class="stat"><div class="num">${students.length}</div><div class="lbl">Students Enrolled</div></div>
    <div class="stat"><div class="num">${mentors.length}</div><div class="lbl">Counselors</div></div>
    <div class="stat"><div class="num">${avgLoad}</div><div class="lbl">Avg. Students / Counselor</div></div>
    <div class="stat"><div class="num">3</div><div class="lbl">Batches Covered (Y23&ndash;Y25)</div></div>
    <div class="stat"><div class="num">${withBacklogs}</div><div class="lbl">Students with Backlogs</div></div>
  `;*/

  // ---- mode state ----
  let mode = 'student'; // 'student' | 'counselor'
  const btnStudent = document.getElementById('btnStudent');
  const btnCounselor = document.getElementById('btnCounselor');
  const searchInput = document.getElementById('searchInput');
  const suggestionsEl = document.getElementById('suggestions');
  const clearBtn = document.getElementById('clearBtn');
  const goBtn = document.getElementById('goBtn');
  const resultsEl = document.getElementById('results');
  const hintRow = document.getElementById('hintRow');

  function setMode(m){
    mode = m;
    btnStudent.classList.toggle('active', m === 'student');
    btnCounselor.classList.toggle('active', m === 'counselor');
    searchInput.placeholder = m === 'student'
      ? 'Enter student name or ID (e.g. Asif or 2300090001)'
      : 'Enter counselor name or Emp ID (e.g. Sateesh or 9024)';
    hintRow.innerHTML = m === 'student'
      ? 'Try <span>a partial name</span> or <span>an enrolment ID</span>'
      : 'Try <span>a partial name</span> or <span>an employee ID</span>';
    searchInput.value = '';
    clearBtn.classList.remove('show');
    hideSuggestions();
    searchInput.focus();
  }
  btnStudent.addEventListener('click', () => setMode('student'));
  btnCounselor.addEventListener('click', () => setMode('counselor'));

  // ---- search / suggestions ----
  function searchStudents(q){
    q = q.trim().toLowerCase();
    if(!q) return [];
    const isNum = /^\d+$/.test(q);
    return students.filter(s => {
      if(isNum) return s.id.includes(q);
      return s.name.toLowerCase().includes(q) || s.id.includes(q);
    }).slice(0, 40);
  }
  function searchMentors(q){
    q = q.trim().toLowerCase();
    if(!q) return [];
    const isNum = /^\d+$/.test(q);
    return mentors.filter(m => {
      if(isNum) return String(m.id).includes(q);
      return (m.name||'').toLowerCase().includes(q) || String(m.id).includes(q);
    }).slice(0, 40);
  }

  let activeIndex = -1;
  let currentSuggList = [];

  function renderSuggestions(list){
    currentSuggList = list;
    activeIndex = -1;
    if(list.length === 0){
      suggestionsEl.innerHTML = '';
      hideSuggestions();
      return;
    }
    suggestionsEl.innerHTML = list.map((item, i) => {
      if(mode === 'student'){
        const s = item;
        return `<div class="sugg-item" data-idx="${i}" data-id="${escapeHtml(s.id)}">
          <div class="sugg-avatar" style="background:${colorFor(s.name)}">${initials(s.name)}</div>
          <div>
            <div class="sugg-main">${escapeHtml(titleCase(s.name))}</div>
            <div class="sugg-sub">ID ${escapeHtml(s.id)} &middot; Y${escapeHtml(String(s.yos||''))}</div>
          </div>
          <div class="sugg-tag">Student</div>
        </div>`;
      } else {
        const m = item;
        return `<div class="sugg-item" data-idx="${i}" data-id="${escapeHtml(m.id)}">
          <div class="sugg-avatar" style="background:${colorFor(m.name)}">${initials(m.name)}</div>
          <div>
            <div class="sugg-main">${escapeHtml(m.name)}</div>
            <div class="sugg-sub">Emp ID ${escapeHtml(m.id)} &middot; ${m.studentIds.length} students</div>
          </div>
          <div class="sugg-tag" style="background:var(--crimson)">Counselor</div>
        </div>`;
      }
    }).join('');
    showSuggestions();
    suggestionsEl.querySelectorAll('.sugg-item').forEach(el => {
      el.addEventListener('click', () => {
        selectById(el.getAttribute('data-id'));
      });
    });
  }
  function showSuggestions(){ suggestionsEl.classList.add('show'); }
  function hideSuggestions(){ suggestionsEl.classList.remove('show'); }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value;
    clearBtn.classList.toggle('show', q.length > 0);
    if(q.trim().length === 0){
      hideSuggestions();
      return;
    }
    const list = mode === 'student' ? searchStudents(q) : searchMentors(q);
    renderSuggestions(list);
  });

  searchInput.addEventListener('keydown', (e) => {
    if(!suggestionsEl.classList.contains('show')) {
      if(e.key === 'Enter'){ runSearch(); }
      return;
    }
    const items = suggestionsEl.querySelectorAll('.sugg-item');
    if(e.key === 'ArrowDown'){
      e.preventDefault();
      activeIndex = Math.min(activeIndex+1, items.length-1);
      updateActive(items);
    } else if(e.key === 'ArrowUp'){
      e.preventDefault();
      activeIndex = Math.max(activeIndex-1, 0);
      updateActive(items);
    } else if(e.key === 'Enter'){
      e.preventDefault();
      if(activeIndex >= 0 && currentSuggList[activeIndex]){
        selectById(currentSuggList[activeIndex].id);
      } else {
        runSearch();
      }
    } else if(e.key === 'Escape'){
      hideSuggestions();
    }
  });
  function updateActive(items){
    items.forEach((el,i) => el.classList.toggle('hi', i===activeIndex));
    if(activeIndex>=0) items[activeIndex].scrollIntoView({block:'nearest'});
  }

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.remove('show');
    hideSuggestions();
    searchInput.focus();
  });

  goBtn.addEventListener('click', runSearch);

  document.addEventListener('click', (e) => {
    if(!e.target.closest('.search-box-outer')) hideSuggestions();
  });

  function runSearch(){
    const q = searchInput.value.trim();
    if(!q) return;
    const list = mode === 'student' ? searchStudents(q) : searchMentors(q);
    hideSuggestions();
    if(list.length === 0){
      renderNotFound(q);
    } else if(list.length === 1){
      selectById(list[0].id);
    } else {
      // multiple matches, show a compact chooser
      renderMultiMatch(list, q);
    }
  }

  function selectById(id){
    hideSuggestions();
    if(mode === 'student'){
      const s = studentById.get(id);
      if(s) renderPairing(s);
    } else {
      const m = mentorById.get(id);
      if(m) renderRoster(m);
    }
  }

  function renderNotFound(q){
    resultsEl.innerHTML = `
      <div class="not-found">
        <div class="glyph">&#128269;</div>
        <p>No ${mode === 'student' ? 'student' : 'counselor'} matched <b>&ldquo;${escapeHtml(q)}&rdquo;</b>. Check the spelling or try the ID number instead.</p>
      </div>`;
  }

  function renderMultiMatch(list, q){
    const isStu = mode === 'student';
    resultsEl.innerHTML = `
      <div class="roster-header">
        <div class="roster-title">${list.length} matches for &ldquo;${escapeHtml(q)}&rdquo;</div>
      </div>
      <div class="roster-grid">
        ${list.map(item => isStu ? `
          <div class="stu-tile" data-id="${escapeHtml(item.id)}">
            <div class="mini-avatar" style="background:${colorFor(item.name)}">${initials(item.name)}</div>
            <div>
              <div class="stu-name">${escapeHtml(titleCase(item.name))}</div>
              <div class="stu-id">ID ${escapeHtml(item.id)}</div>
            </div>
            <div class="stu-year">Y${escapeHtml(String(item.yos||''))}</div>
          </div>
        ` : `
          <div class="stu-tile" data-id="${escapeHtml(item.id)}">
            <div class="mini-avatar" style="background:${colorFor(item.name)}">${initials(item.name)}</div>
            <div>
              <div class="stu-name">${escapeHtml(item.name)}</div>
              <div class="stu-id">Emp ID ${escapeHtml(item.id)}</div>
            </div>
            <div class="stu-year">${item.studentIds.length} stu.</div>
          </div>
        `).join('')}
      </div>`;
    resultsEl.querySelectorAll('.stu-tile').forEach(el => {
      el.addEventListener('click', () => selectById(el.getAttribute('data-id')));
    });
  }

  function fieldRow(k, v){
    return `<div class="field"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  }

  function renderPairing(s){
    const m = mentorById.get(s.mentorId);
    const sColor = colorFor(s.name);
    const mColor = m ? colorFor(m.name) : '#999';

    resultsEl.innerHTML = `
      <div class="pairing">
        <div class="badge-card student-card">
          <div class="badge-banner">
            <div class="badge-role">Student</div>
            <div class="badge-id-chip">${escapeHtml(s.id)}</div>
          </div>
          <div class="badge-body">
            <div class="badge-avatar" style="background:${sColor}">${initials(s.name)}</div>
            <div class="badge-name">${escapeHtml(titleCase(s.name))}</div>
            <div class="badge-role-line">${escapeHtml(s.prog)} &middot; Year of Joining ${escapeHtml(s.yoj)}</div>
            <div class="badge-fields">
              ${fieldRow('Year', fmtYear(s.yos))}
              ${fieldRow('Gender', escapeHtml(titleCase(s.gender)))}
              ${fieldRow('Campus', escapeHtml(s.campus))}
              ${fieldRow('Email', s.email ? `<a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a>` : '&mdash;')}
              ${fieldRow('Contact', fmtPhone(s.contact))}
              ${fieldRow('Father', escapeHtml(titleCase(s.father)))}
              ${fieldRow('Address', escapeHtml(titleCase(s.addr)))}
            </div>
            ${renderAcademicPanel(s)}
          </div>
        </div>

        <div class="link-col">
          <div class="link-line"></div>
          <div class="link-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"></path><path d="M15 7h2a5 5 0 1 1 0 10h-2"></path><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          </div>
          <div class="link-caption">Counseled&nbsp;by</div>
          <div class="link-line"></div>
        </div>

        ${m ? `
        <div class="badge-card counselor-card">
          <div class="badge-banner">
            <div class="badge-role">Counselor</div>
            <div class="badge-id-chip">${escapeHtml(m.id)}</div>
          </div>
          <div class="badge-body">
            <div class="badge-avatar" style="background:${mColor}">${initials(m.name)}</div>
            <div class="badge-name">${escapeHtml(m.name)}</div>
            <div class="badge-role-line">${escapeHtml(m.designation)}</div>
            <div class="badge-fields">
              ${fieldRow('Email', m.email ? `<a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>` : '&mdash;')}
              ${fieldRow('Contact', fmtPhone(m.contact))}
              ${fieldRow('Students', `${m.studentIds.length} under counseling &nbsp;&middot;&nbsp; <a href="#" data-view-roster="${escapeHtml(m.id)}">view all &rarr;</a>`)}
            </div>
          </div>
        </div>` : `
        <div class="badge-card counselor-card">
          <div class="badge-body" style="padding-top:26px;">
            <p style="color:var(--ink-soft); font-size:13.5px;">No counselor record found for this student.</p>
          </div>
        </div>`}
      </div>
    `;
    const rosterLink = resultsEl.querySelector('[data-view-roster]');
    if(rosterLink){
      rosterLink.addEventListener('click', (e) => {
        e.preventDefault();
        const mm = mentorById.get(rosterLink.getAttribute('data-view-roster'));
        if(mm) renderRoster(mm);
        setMode('counselor');
        searchInput.value = mm.name;
      });
    }
    const blToggle = resultsEl.querySelector('.acad-detail-toggle');
    if(blToggle){
      blToggle.addEventListener('click', () => {
        const list = document.getElementById(blToggle.getAttribute('data-toggle'));
        if(!list) return;
        const nowHidden = list.classList.toggle('hidden');
        const count = list.querySelectorAll('.backlog-row').length;
        blToggle.textContent = nowHidden
          ? `Show ${count} backlog${count>1?'s':''} \u2193`
          : `Hide backlog details \u2191`;
      });
    }
    resultsEl.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function renderRoster(m){
    const roster = m.studentIds.map(id => studentById.get(id)).filter(Boolean);
    const mColor = colorFor(m.name);

    resultsEl.innerHTML = `
      <div class="badge-card counselor-card" style="max-width:520px;">
        <div class="badge-banner">
          <div class="badge-role">Counselor</div>
          <div class="badge-id-chip">${escapeHtml(m.id)}</div>
        </div>
        <div class="badge-body">
          <div class="badge-avatar" style="background:${mColor}">${initials(m.name)}</div>
          <div class="badge-name">${escapeHtml(m.name)}</div>
          <div class="badge-role-line">${escapeHtml(m.designation)}</div>
          <div class="badge-fields">
            ${fieldRow('Email', m.email ? `<a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>` : '&mdash;')}
            ${fieldRow('Contact', fmtPhone(m.contact))}
            ${fieldRow('Students', `${roster.length} under counseling`)}
          </div>
        </div>
      </div>

      <div class="roster-header">
        <div class="roster-title">Students counseled by ${escapeHtml(m.name.split(' ').slice(0,2).join(' '))}</div>
        <div class="roster-filter">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#615850" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="rosterFilter" placeholder="Filter roster by name or ID">
        </div>
      </div>
      <div class="roster-grid" id="rosterGrid"></div>
    `;

    function paintRoster(filterQ){
      const q = (filterQ||'').trim().toLowerCase();
      const filtered = q ? roster.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q)) : roster;
      const grid = document.getElementById('rosterGrid');
      if(filtered.length === 0){
        grid.innerHTML = `<div class="not-found" style="grid-column:1/-1;">No students match &ldquo;${escapeHtml(filterQ)}&rdquo; in this roster.</div>`;
        return;
      }
      grid.innerHTML = filtered.map(s => `
        <div class="stu-tile" data-id="${escapeHtml(s.id)}">
          <div class="mini-avatar" style="background:${colorFor(s.name)}">${initials(s.name)}</div>
          <div>
            <div class="stu-name">${escapeHtml(titleCase(s.name))}</div>
            <div class="stu-id">ID ${escapeHtml(s.id)}${s.cgpa !== null && s.cgpa !== undefined ? ` &middot; CGPA ${s.cgpa.toFixed(2)}` : ''}</div>
          </div>
          ${s.backlogCount > 0
            ? `<div class="stu-year" style="background:rgba(139,26,26,0.10); color:var(--crimson);">${s.backlogCount} BL</div>`
            : `<div class="stu-year">Y${escapeHtml(String(s.yos||''))}</div>`}
        </div>
      `).join('');
      grid.querySelectorAll('.stu-tile').forEach(el => {
        el.addEventListener('click', () => {
          const st = studentById.get(el.getAttribute('data-id'));
          if(st){
            setMode('student');
            searchInput.value = titleCase(st.name);
            renderPairing(st);
          }
        });
      });
    }
    paintRoster('');
    document.getElementById('rosterFilter').addEventListener('input', (e) => paintRoster(e.target.value));
    resultsEl.scrollIntoView({behavior:'smooth', block:'start'});
  }

}

if (window.DATA) {
  initCounselingApp();
} else {
  window.addEventListener('data:ready', initCounselingApp, { once: true });
}

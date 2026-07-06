/* ==========================================================
   data-loader.js
   ----------------------------------------------------------
   Loads TWO plain CSV files at runtime and builds window.DATA:

     1) counseling_roster.csv  — student/mentor roster
     2) csit_CGPA_JULY2026.csv — CGPA / credits / backlog data

   Whenever either file is replaced (same column headers) and
   pushed to the repo, the site picks up the new data on the
   next page load — no rebuild step, nothing to regenerate.

   To update:
     - Edit/replace counseling_roster.csv for roster changes
       (new batch, mentor re-assignment, contact updates, etc.)
     - Edit/replace csit_CGPA_JULY2026.csv for CGPA/credit/
       backlog updates (e.g. after a new result declaration).
     - Keep the header row text the same — columns are matched
       by header name, not position, so column order doesn't
       matter, but the header text should stay recognizable
       (e.g. containing "roll", "cgpa", "backlog" + "count" etc).
   ========================================================== */
(function () {
  const ROSTER_FILE = 'counseling_roster.csv';
  const CGPA_FILE = 'csit_CGPA_JULY2026.csv';

  function showLoading(msg) {
    const el = document.getElementById('loadState');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
  function hideLoading() {
    const el = document.getElementById('loadState');
    if (el) el.style.display = 'none';
  }
  function showError(msg) {
    const el = document.getElementById('errorState');
    if (el) {
      el.innerHTML = '<b>Could not load directory data.</b><br>' + msg;
      el.style.display = 'block';
    }
    hideLoading();
    console.error('data-loader:', msg);
  }

  /* ---- RFC4180-ish CSV parser (handles quoted fields, embedded
     commas, escaped "" quotes, \r\n or \n line endings) ---- */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\r') { /* skip, \n handles the break */ }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else { field += c; }
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    // drop fully-empty trailing rows
    while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
    if (rows.length === 0) return [];

    const header = rows[0].map(h => h.trim());
    const headerLower = header.map(h => h.toLowerCase());
    return rows.slice(1).map(cols => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = (cols[i] !== undefined ? cols[i] : '').trim(); });
      obj.__lower = headerLower; // for flexible lookup
      obj.__cols = cols;
      return obj;
    });
  }

  // flexible header lookup: find the actual header key whose
  // lowercased text satisfies `test`, then read its value
  function findKey(sampleRow, test) {
    if (!sampleRow) return null;
    const keys = Object.keys(sampleRow).filter(k => k !== '__lower' && k !== '__cols');
    return keys.find(k => test(k.toLowerCase())) || null;
  }

  function toNumber(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === '') return null;
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  }
  function toIntSafe(v) {
    const n = toNumber(v);
    return n === null ? null : Math.round(n);
  }

  function parseBacklogEntry(raw) {
    // format: "23CC3013:GP:2025-2026:Odd Sem:3"
    const parts = raw.split(':');
    return {
      course: parts[0] || raw,
      status: parts[1] || '',
      year: parts[2] || '',
      sem: parts[3] || '',
      credits: parts[4] || ''
    };
  }

  function buildRosterData(rosterRows) {
    if (rosterRows.length === 0) throw new Error(ROSTER_FILE + ' has no data rows.');
    const sample = rosterRows[0];

    const kSno = findKey(sample, h => h.includes('s.no') || h === 'sno' || h.includes('sl no'));
    const kYoj = findKey(sample, h => h.includes('year of joining') || h === 'yoj');
    const kRoll = findKey(sample, h => h.includes('roll'));
    const kName = findKey(sample, h => h === 'name' || h.includes('student name'));
    const kGender = findKey(sample, h => h.includes('gender') || h.includes('sex'));
    const kDept = findKey(sample, h => h.includes('department') || h === 'dept');
    const kProg = findKey(sample, h => h.includes('program'));
    const kSpec = findKey(sample, h => h.includes('specialization'));
    const kYos = findKey(sample, h => h.includes('year of study') || h === 'yos');
    const kEmail = findKey(sample, h => h.includes('email') && !h.includes('mentor'));
    const kContact = findKey(sample, h => (h.includes('contact') || h.includes('phone')) && !h.includes('father') && !h.includes('mentor'));
    const kFather = findKey(sample, h => h.includes('father') && h.includes('name'));
    const kFContact = findKey(sample, h => h.includes('father') && (h.includes('contact') || h.includes('phone')));
    const kAddr = findKey(sample, h => h.includes('address'));
    const kCampus = findKey(sample, h => h.includes('campus'));
    const kMentorName = findKey(sample, h => h.includes('mentor') && h.includes('name'));
    const kMentorId = findKey(sample, h => h.includes('mentor') && (h.includes('emp') || h.includes('id')));
    const kMentorDesig = findKey(sample, h => h.includes('mentor') && h.includes('design'));
    const kMentorEmail = findKey(sample, h => h.includes('mentor') && h.includes('email'));
    const kMentorContact = findKey(sample, h => h.includes('mentor') && (h.includes('contact') || h.includes('phone')));

    if (!kRoll) throw new Error(ROSTER_FILE + ': could not find a "Roll No" column.');
    if (!kMentorId) throw new Error(ROSTER_FILE + ': could not find a "Mentor Emp ID" column.');

    const students = [];
    const mentorsMap = new Map();

    rosterRows.forEach(r => {
      const id = (r[kRoll] || '').trim();
      if (!id) return;
      const mentorId = (r[kMentorId] || '').trim();

      students.push({
        sno: kSno ? r[kSno] : '',
        yoj: kYoj ? r[kYoj] : '',
        id: id,
        name: kName ? r[kName] : '',
        gender: kGender ? r[kGender] : '',
        dept: kDept ? r[kDept] : '',
        prog: kProg ? r[kProg] : '',
        spec: kSpec ? r[kSpec] : '',
        yos: kYos ? toIntSafe(r[kYos]) : null,
        email: kEmail ? r[kEmail] : '',
        contact: kContact ? r[kContact] : '',
        father: kFather ? r[kFather] : '',
        fcontact: kFContact ? r[kFContact] : '',
        addr: kAddr ? r[kAddr] : '',
        campus: kCampus ? r[kCampus] : '',
        mentorId: mentorId
      });

      if (mentorId && !mentorsMap.has(mentorId)) {
        mentorsMap.set(mentorId, {
          id: mentorId,
          name: kMentorName ? r[kMentorName] : '',
          designation: kMentorDesig ? r[kMentorDesig] : '',
          email: kMentorEmail ? r[kMentorEmail] : '',
          contact: kMentorContact ? r[kMentorContact] : '',
          studentIds: []
        });
      }
      if (mentorId) mentorsMap.get(mentorId).studentIds.push(id);
    });

    if (students.length === 0) throw new Error(ROSTER_FILE + ': no valid student rows found (empty Roll No column?).');

    return { students, mentors: Array.from(mentorsMap.values()) };
  }

  function mergeCgpaData(students, cgpaRows) {
    if (cgpaRows.length === 0) return; // no CGPA file content — leave students without academic fields
    const sample = cgpaRows[0];

    const kRoll = findKey(sample, h => h.includes('roll'));
    const kCgpa = findKey(sample, h => h.includes('cgpa'));
    const kTotal = findKey(sample, h => h.includes('total') && h.includes('credit'));
    const kDeclared = findKey(sample, h => h.includes('declared') && h.includes('credit'));
    const kAwaiting = findKey(sample, h => h.includes('awaiting') && h.includes('credit'));
    const kObtained = findKey(sample, h => h.includes('obtained') && h.includes('credit'));
    const kBacklogCount = findKey(sample, h => h.includes('backlog') && h.includes('count'));
    const kBacklogDetails = findKey(sample, h => h.includes('backlog') && h.includes('detail'));
    const kNotDeclared = findKey(sample, h => h.includes('not declared'));
    const kMissing = findKey(sample, h => h.includes('missing') && h.includes('course'));

    if (!kRoll) { console.warn('data-loader: CGPA file has no recognizable Roll No column — skipping CGPA merge.'); return; }

    const byId = new Map(students.map(s => [s.id, s]));
    let matched = 0;

    cgpaRows.forEach(r => {
      const roll = (r[kRoll] || '').trim();
      if (!roll) return;
      const stu = byId.get(roll);
      if (!stu) return;
      matched++;

      stu.cgpa = kCgpa ? toNumber(r[kCgpa]) : null;
      stu.totalCredits = kTotal ? toNumber(r[kTotal]) : null;
      stu.declaredCredits = kDeclared ? toNumber(r[kDeclared]) : null;
      stu.awaitingCredits = kAwaiting ? toNumber(r[kAwaiting]) : null;
      stu.obtainedCredits = kObtained ? toNumber(r[kObtained]) : null;

      const backlogCountRaw = kBacklogCount ? toIntSafe(r[kBacklogCount]) : null;
      const backlogDetailsRaw = kBacklogDetails ? (r[kBacklogDetails] || '') : '';
      const backlogs = backlogDetailsRaw
        ? backlogDetailsRaw.split('||').map(p => p.trim()).filter(Boolean).map(parseBacklogEntry)
        : [];
      stu.backlogCount = backlogCountRaw !== null ? backlogCountRaw : backlogs.length;
      stu.backlogs = backlogs;

      const notDeclaredRaw = kNotDeclared ? (r[kNotDeclared] || '') : '';
      stu.notDeclared = notDeclaredRaw ? notDeclaredRaw.split('||').map(c => c.trim()).filter(Boolean) : [];

      const missingRaw = kMissing ? (r[kMissing] || '') : '';
      stu.missingCourses = missingRaw ? missingRaw.split('||').map(c => c.trim()).filter(Boolean) : [];
    });

    console.log('data-loader: CGPA merged for', matched, 'of', students.length, 'students (', cgpaRows.length, 'CGPA rows read ).');
  }

  showLoading('Loading counseling directory\u2026');

  Promise.all([
    fetch(ROSTER_FILE).then(r => { if (!r.ok) throw new Error(ROSTER_FILE + ' not found (HTTP ' + r.status + ').'); return r.text(); }),
    fetch(CGPA_FILE).then(r => { if (!r.ok) { console.warn(CGPA_FILE + ' not found — continuing without CGPA data.'); return ''; } return r.text(); })
  ]).then(([rosterText, cgpaText]) => {
    const rosterRows = parseCSV(rosterText);
    const cgpaRows = cgpaText ? parseCSV(cgpaText) : [];

    const built = buildRosterData(rosterRows);
    mergeCgpaData(built.students, cgpaRows);

    window.DATA = built;
    hideLoading();
    window.dispatchEvent(new Event('data:ready'));
  }).catch(err => {
    showError((err && err.message) || String(err));
  });
})();

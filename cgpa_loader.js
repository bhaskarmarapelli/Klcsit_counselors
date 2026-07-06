// Loads local CSV `csit_CGPA_JULY2026.csv`, parses minimal fields,
// and merges CGPA/backlog info into the already-embedded `DATA.students`.
(function(){
  function safeTrim(v){ return v===undefined||v===null? '': String(v).trim(); }
  function parseCSV(text){
    const lines = text.split(/\r?\n/).filter(Boolean);
    if(lines.length === 0) return {};
    const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
    // best-effort index resolution
    const iRoll = header.findIndex(h => h.includes('roll'));
    const iCgpa = header.findIndex(h => h.includes('cgpa'));
    const iBacklogCount = header.findIndex(h => h.includes('backlog') && h.includes('count'));
    const iBacklogDetails = header.findIndex(h => h.includes('backlog') && h.includes('detail'));
    const iObtained = header.findIndex(h => h.includes('obtained'));
    const iNotDeclared = header.findIndex(h => h.includes('not declared') || h.includes('not_declared'));

    const map = Object.create(null);
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(',');
      const roll = safeTrim(cols[iRoll] || cols[0] || '');
      if(!roll) continue;
      const cgpa = safeTrim( (iCgpa>=0? cols[iCgpa] : cols[3]) || '' );
      // attempt to read obtained credits and not-declared courses
      const obtainedCredits = iObtained>=0 ? safeTrim(cols[iObtained]) : safeTrim(cols[7] || '');
      const notDeclaredCourses = iNotDeclared>=0 ? safeTrim(cols[iNotDeclared]) : safeTrim(cols[10] || '');
      // fallback: use last columns for backlog info if header indices missing
      const backlogCount = iBacklogCount>=0 ? safeTrim(cols[iBacklogCount]) : safeTrim(cols[cols.length-2]);
      const backlogDetails = iBacklogDetails>=0 ? safeTrim(cols[iBacklogDetails]) : safeTrim(cols[cols.length-1]);
      map[roll] = { cgpa: cgpa || '', backlogCount: backlogCount || '', backlogDetails: backlogDetails || '', obtainedCredits: obtainedCredits || '', notDeclaredCourses: notDeclaredCourses || '' };
    }
    return map;
  }

  // Try to fetch the CSV next to the page
  fetch('csit_CGPA_JULY2026.csv').then(r => {
    if(!r.ok) throw new Error('CSV not found');
    return r.text();
  }).then(txt => {
    const m = parseCSV(txt);
    // merge into DATA if present
    if(window.DATA && Array.isArray(window.DATA.students)){
      window.DATA.students.forEach(s => {
        const entry = m[s.id] || m[String(s.id)];
        if(entry){
          s.cgpa = entry.cgpa;
          s.backlogCount = entry.backlogCount;
          s.backlogDetails = entry.backlogDetails;
        }
      });
      // expose map for debugging
      window.CGPA_MAP = m;
    } else {
      // still expose map so app.js can consume later if needed
      window.CGPA_MAP = m;
    }
  }).catch(err => {
    console.warn('cgpa_loader: could not load CSV', err && err.message);
  });
})();

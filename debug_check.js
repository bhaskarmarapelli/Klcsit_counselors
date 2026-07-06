const fs = require('fs');
const vm = require('vm');

function loadDataEmbed(path){
  const code = fs.readFileSync(path,'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  try{
    vm.runInContext(code, sandbox, {filename: path});
  }catch(e){
    console.error('eval error', e && e.message);
    process.exit(2);
  }
  const DATA = sandbox.DATA || sandbox.window.DATA;
  return DATA;
}

function parseCsv(path){
  const txt = fs.readFileSync(path,'utf8');
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map(h=>h.trim());
  const rows = lines.slice(1).map(l => l.split(','));
  return { header, rows };
}

const base = __dirname;
const dataPath = base + '/data_embed.js';
if(!fs.existsSync(dataPath)) { console.error('data_embed.js missing'); process.exit(3); }
const DATA = loadDataEmbed(dataPath);
console.log('students:', Array.isArray(DATA.students) ? DATA.students.length : 'missing');
console.log('mentors:', Array.isArray(DATA.mentors) ? DATA.mentors.length : 'missing');
if(DATA.students && DATA.students.length>0){
  console.log('sample student id/name/mentorId:', DATA.students[0].id, DATA.students[0].name, DATA.students[0].mentorId);
}
if(DATA.mentors && DATA.mentors.length>0){
  console.log('sample mentor id/name:', DATA.mentors[0].id, DATA.mentors[0].name);
}
const csvPath = base + '/csit_CGPA_JULY2026.csv';
if(fs.existsSync(csvPath)){
  const csv = parseCsv(csvPath);
  console.log('csv header cols:', csv.header.length, csv.header.slice(0,8).join(', '));
  console.log('csv rows count:', csv.rows.length);
  // check mapping for first student id
  const sid = DATA.students && DATA.students[0] && DATA.students[0].id;
  if(sid){
    const found = csv.rows.find(r => r[0].trim() === sid);
    console.log('csv contains first student id?', !!found);
  }
} else {
  console.log('CSV not found at', csvPath);
}

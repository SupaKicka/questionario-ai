const express = require('express');
const initSqlJs = require('sql.js');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ai_surv2026';
const ADMIN_TOKEN = crypto.randomBytes(32).toString('hex');
const DB_PATH = process.env.DB_PATH || './data/quiz.db';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db;
function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Self-Assessment Questions ────────────────────────────────────────────────
const QUESTIONS = [
  { id:1, section:'Strumenti e Consapevolezza', type:'knowledge',
    text:'Conosci i principali strumenti di AI generativa (ChatGPT, Claude, Gemini, Copilot…)?' },
  { id:2, section:'Strumenti e Consapevolezza', type:'usage',
    text:'Utilizzi strumenti di AI generativa nelle tue attività lavorative o personali?' },
  { id:3, section:'Strumenti e Consapevolezza', type:'knowledge',
    text:'Conosci le differenze tra i principali modelli (GPT-4, Claude, Gemini, Llama, Mistral…)?' },
  { id:4, section:'Prompt ed Interazione', type:'knowledge',
    text:'Sai strutturare un prompt efficace per ottenere risposte di qualità da un modello AI?' },
  { id:5, section:'Prompt ed Interazione', type:'usage',
    text:'Hai mai scritto system prompt o prompt avanzati con istruzioni strutturate e dettagliate?' },
  { id:6, section:'Prompt ed Interazione', type:'knowledge',
    text:'Conosci tecniche di prompting come few-shot, chain-of-thought, role prompting, meta-prompting?' },
  { id:7, section:'Comprensione dei Modelli', type:'knowledge',
    text:'Conosci le principali limitazioni degli LLM: allucinazioni, training cutoff, bias nei dati?' },
  { id:8, section:'Comprensione dei Modelli', type:'knowledge',
    text:"Sai cos'è la context window e come influisce sulla memoria e coerenza del modello?" },
  { id:9, section:'Comprensione dei Modelli', type:'knowledge',
    text:'Conosci parametri come temperature, top-p, max tokens e il loro effetto sulle risposte?' },
  { id:10, section:'Sviluppo e API', type:'usage',
    text:'Hai mai usato API di modelli AI (OpenAI, Anthropic, Google AI, Hugging Face…) in un progetto?' },
  { id:11, section:'Sviluppo e API', type:'usage',
    text:"Hai mai usato l'AI per generare, correggere o analizzare codice in modo sistematico?" },
  { id:12, section:'Sviluppo e API', type:'knowledge',
    text:"Conosci il concetto di function calling / tool use per connettere un modello a sistemi esterni?" },
  { id:13, section:'Tecniche Avanzate', type:'knowledge',
    text:"Conosci il concetto di embedding e come viene usato per la ricerca semantica (similarity search)?" },
  { id:14, section:'Tecniche Avanzate', type:'knowledge',
    text:"Sai cos'è il fine-tuning e quando è preferibile rispetto al RAG o al prompt engineering?" },
  { id:15, section:'Tecniche Avanzate', type:'usage',
    text:"Hai mai lavorato con sistemi RAG (Retrieval-Augmented Generation) o vector database?" },
  { id:16, section:'Tecniche Avanzate', type:'knowledge',
    text:"Conosci framework di orchestrazione AI come LangChain, LlamaIndex, AutoGen, CrewAI, Semantic Kernel?" },
  { id:17, section:'Agenti e Architetture Complesse', type:'usage',
    text:"Hai mai costruito o progettato un agente AI o un sistema multi-agente autonomo?" },
  { id:18, section:'Agenti e Architetture Complesse', type:'knowledge',
    text:"Conosci protocolli per estendere i modelli con strumenti esterni (MCP, plugin, custom tools, workflow AI)?" },
];

const OPEN_QUESTIONS = [
  { id:'open_20', text:"Come utilizzi — o vorresti utilizzare — l'AI nel tuo lavoro quotidiano?" },
  { id:'open_21', text:"Quali argomenti o competenze vorresti approfondire in questo percorso formativo?" },
];

const SCALE = {
  knowledge: { label:'Quanto conosci?', steps:['Non conosco','Conosco poco','Conosco abbastanza','Conosco bene','Padronanza'] },
  usage:     { label:'Quanto hai usato?', steps:['Mai','Raramente','A volte','Spesso','Ogni giorno'] },
};

function calculateScore(answers) {
  let score = 0;
  for (const q of QUESTIONS) {
    const v = parseInt(answers[`q${q.id}`]);
    if (v >= 1 && v <= 5) score += v;
  }
  return score;
}

function getLevel(score) {
  const avg = score / QUESTIONS.length;
  if (avg <= 2.0) return 'Principiante';
  if (avg <= 3.5) return 'Intermedio';
  return 'Avanzato';
}

const MAX_SCORE = QUESTIONS.length * 5;

// ─── DB helpers ───────────────────────────────────────────────────────────────
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}
function dbGet(sql, params = []) {
  const rows = dbAll(sql, params);
  return rows.length ? rows[0] : null;
}
function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

function requireAdmin(req, res, next) {
  if (req.cookies.admin_token === ADMIN_TOKEN) return next();
  res.redirect('/admin/login');
}

app.get('/', (req, res) => res.redirect('/admin'));

// ─── Admin ────────────────────────────────────────────────────────────────────
app.get('/admin/login', (req, res) => res.render('admin-login', { error: null }));
app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.cookie('admin_token', ADMIN_TOKEN, { httpOnly: true, sameSite: 'lax' });
    return res.redirect('/admin');
  }
  res.render('admin-login', { error: 'Password non valida' });
});
app.get('/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.redirect('/admin/login');
});

app.get('/admin', requireAdmin, (req, res) => {
  const companies = dbAll(`
    SELECT c.*, COUNT(r.id) as response_count,
           ROUND(AVG(r.score), 1) as avg_score,
           SUM(CASE WHEN r.level='Principiante' THEN 1 ELSE 0 END) as n_principiante,
           SUM(CASE WHEN r.level='Intermedio'   THEN 1 ELSE 0 END) as n_intermedio,
           SUM(CASE WHEN r.level='Avanzato'     THEN 1 ELSE 0 END) as n_avanzato
    FROM companies c
    LEFT JOIN responses r ON r.company_id = c.id
    GROUP BY c.id ORDER BY c.created_at DESC
  `);
  const totals = dbGet(`SELECT COUNT(*) as total_responses, ROUND(AVG(score),1) as global_avg FROM responses`);
  res.render('admin', { companies, totals, maxScore: MAX_SCORE, numQuestions: QUESTIONS.length, host: req.get('host'), protocol: req.protocol });
});

app.post('/admin/companies', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.redirect('/admin');
  dbRun('INSERT INTO companies (name, slug) VALUES (?, ?)', [name, uuidv4().slice(0, 8)]);
  res.redirect('/admin');
});

app.post('/admin/companies/:id/delete', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  dbRun('DELETE FROM responses WHERE company_id = ?', [id]);
  dbRun('DELETE FROM companies WHERE id = ?', [id]);
  res.redirect('/admin');
});

app.get('/admin/companies/:id', requireAdmin, (req, res) => {
  const company = dbGet('SELECT * FROM companies WHERE id = ?', [parseInt(req.params.id)]);
  if (!company) return res.status(404).send('Azienda non trovata');

  const responses = dbAll('SELECT * FROM responses WHERE company_id = ? ORDER BY created_at DESC', [company.id]);
  responses.forEach(r => { try { r.parsedAnswers = JSON.parse(r.answers); } catch { r.parsedAnswers = {}; } });

  const stats = {
    total: responses.length,
    avgScore: responses.length ? (responses.reduce((s,r)=>s+r.score,0)/responses.length/QUESTIONS.length).toFixed(2) : 0,
    principiante: responses.filter(r=>r.level==='Principiante').length,
    intermedio:   responses.filter(r=>r.level==='Intermedio').length,
    avanzato:     responses.filter(r=>r.level==='Avanzato').length,
  };

  const questionStats = {};
  for (const q of QUESTIONS) {
    const vals = responses.map(r=>parseInt(r.parsedAnswers[`q${q.id}`])).filter(v=>v>=1&&v<=5);
    questionStats[q.id] = {
      avg: vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : null,
      count: vals.length,
      dist: [1,2,3,4,5].map(v=>vals.filter(x=>x===v).length),
    };
  }

  const sections = [...new Set(QUESTIONS.map(q=>q.section))];
  const sectionStats = {};
  for (const s of sections) {
    const avgs = QUESTIONS.filter(q=>q.section===s).map(q=>questionStats[q.id].avg).filter(Boolean).map(Number);
    sectionStats[s] = avgs.length ? (avgs.reduce((a,b)=>a+b,0)/avgs.length).toFixed(1) : null;
  }

  res.render('company-results', {
    company, responses, stats, questions: QUESTIONS, openQuestions: OPEN_QUESTIONS,
    questionStats, sectionStats, sections, scale: SCALE,
    maxScore: MAX_SCORE, numQuestions: QUESTIONS.length,
    host: req.get('host'), protocol: req.protocol
  });
});

app.get('/admin/companies/:id/export', requireAdmin, (req, res) => {
  const company = dbGet('SELECT * FROM companies WHERE id = ?', [parseInt(req.params.id)]);
  if (!company) return res.status(404).send('Non trovata');
  const responses = dbAll('SELECT * FROM responses WHERE company_id = ? ORDER BY created_at DESC', [company.id]);
  const esc = s => `"${(s||'').replace(/"/g,'""')}"`;
  const qH = QUESTIONS.map(q=>`Q${q.id}`).join(',');
  const hdr = `Nome,Ruolo,Score,Media/5,Livello,${qH},Come-useresti-AI,Cosa-approfondire,Data\n`;
  const rows = responses.map(r=>{
    let p={}; try{p=JSON.parse(r.answers);}catch{}
    const qv = QUESTIONS.map(q=>p[`q${q.id}`]||'').join(',');
    return `${esc(r.respondent_name)},${esc(r.respondent_role)},${r.score},${(r.score/QUESTIONS.length).toFixed(2)},${r.level},${qv},${esc(r.open_20)},${esc(r.open_21)},${r.created_at}`;
  }).join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="${company.name.replace(/[^a-zA-Z0-9]/g,'_')}_autovalutazione.csv"`);
  res.send('\uFEFF'+hdr+rows);
});

// ─── Public Survey ────────────────────────────────────────────────────────────
app.get('/test/:slug', (req, res) => {
  const company = dbGet('SELECT * FROM companies WHERE slug = ?', [req.params.slug]);
  if (!company) return res.status(404).render('not-found');
  res.render('test', { company, questions: QUESTIONS, openQuestions: OPEN_QUESTIONS, scale: SCALE });
});

app.post('/test/:slug', (req, res) => {
  const company = dbGet('SELECT * FROM companies WHERE slug = ?', [req.params.slug]);
  if (!company) return res.status(404).render('not-found');
  const body = req.body;
  const answers = {};
  for (const k of Object.keys(body)) if (k.startsWith('q')) answers[k] = body[k];
  const score = calculateScore(answers);
  const level = getLevel(score);
  const avg = (score / QUESTIONS.length).toFixed(1);
  const sections = [...new Set(QUESTIONS.map(q=>q.section))];
  const sectionAvgs = {};
  for (const s of sections) {
    const vals = QUESTIONS.filter(q=>q.section===s).map(q=>parseInt(answers[`q${q.id}`])).filter(v=>v>=1&&v<=5);
    sectionAvgs[s] = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : null;
  }
  dbRun(`INSERT INTO responses (company_id,respondent_name,respondent_role,answers,score,level,open_20,open_21) VALUES (?,?,?,?,?,?,?,?)`, [
    company.id, (body.respondent_name||'').trim(), (body.respondent_role||'').trim(),
    JSON.stringify(answers), score, level, (body.open_20||'').trim(), (body.open_21||'').trim()
  ]);
  res.render('thanks', { company, score, level, avg, maxScore: MAX_SCORE, numQuestions: QUESTIONS.length, sectionAvgs, sections });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, respondent_name TEXT NOT NULL DEFAULT '', respondent_role TEXT NOT NULL DEFAULT '', answers TEXT NOT NULL, score INTEGER NOT NULL, level TEXT NOT NULL, open_20 TEXT DEFAULT '', open_21 TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES companies(id))`);
  saveDb();
  app.listen(PORT, () => { console.log(`Server: http://localhost:${PORT}`); });
}

start().catch(err => { console.error(err); process.exit(1); });

const express = require('express');
const initSqlJs = require('sql.js');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2025';
const ADMIN_TOKEN = crypto.randomBytes(32).toString('hex');
const DB_PATH = process.env.DB_PATH || './data/quiz.db';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// --- Questions & scoring ---
const QUESTIONS = [
  { id: 3, section: 'Conoscenze di Base', text: "Cos'è l'Intelligenza Artificiale?", options: [
    "Un sistema che simula capacità umane come apprendimento e ragionamento",
    "Un software che esegue solo istruzioni pre-programmate",
    "Un robot fisico autonomo",
    "Non so"
  ], correct: 0, points: 1 },
  { id: 4, section: 'Conoscenze di Base', text: 'Cosa significa "machine learning"?', options: [
    "Programmare manualmente ogni possibile caso",
    "Permettere a un sistema di apprendere dai dati",
    "Creare robot intelligenti",
    "Non so"
  ], correct: 1, points: 1 },
  { id: 5, section: 'Conoscenze di Base', text: "Quale tra questi è un esempio di AI generativa?", options: [
    "Excel", "ChatGPT", "Antivirus", "Firewall"
  ], correct: 1, points: 1 },

  { id: 6, section: 'Utilizzo Pratico', text: "Hai mai utilizzato l'AI per uno di questi scopi?", options: [
    "Scrivere email o documenti", "Generare codice", "Analizzare dati",
    "Creare immagini / contenuti visivi", "Non ho mai utilizzato AI"
  ], correct: null, points: 0, multi: true },
  { id: 7, section: 'Utilizzo Pratico', text: "Quando usi un'AI come ChatGPT, cosa influisce maggiormente sulla qualità della risposta?", options: [
    "Il tipo di computer utilizzato",
    "La qualità del prompt (istruzioni date)",
    "L'orario della giornata",
    "È casuale"
  ], correct: 1, points: 2 },
  { id: 8, section: 'Utilizzo Pratico', text: "Se chiedi a un'AI un'informazione e ricevi una risposta plausibile ma errata, cosa sta succedendo?", options: [
    "L'AI ha accesso a dati falsi",
    "L'AI sta \"allucinando\" (hallucination)",
    "Il sistema è rotto",
    "È impossibile"
  ], correct: 1, points: 2 },

  { id: 9, section: 'Sicurezza e Consapevolezza', text: "È sicuro inserire dati aziendali sensibili in un'AI pubblica?", options: [
    "Sì, sempre", "No, mai",
    "Dipende dallo strumento e dalle policy",
    "Solo se si cancella dopo"
  ], correct: 2, points: 2 },
  { id: 10, section: 'Sicurezza e Consapevolezza', text: "Quale tra questi è un rischio reale nell'uso dell'AI?", options: [
    "Violazione della privacy", "Bias nei risultati",
    "Informazioni errate", "Tutte le precedenti"
  ], correct: 3, points: 1 },
  { id: 11, section: 'Sicurezza e Consapevolezza', text: 'Cosa sono i "bias" nell\'AI?', options: [
    "Errori casuali", "Distorsioni nei risultati dovute ai dati",
    "Problemi hardware", "Non so"
  ], correct: 1, points: 2 },

  { id: 12, section: 'Comprensione Avanzata', text: 'Un modello come ChatGPT "capisce" davvero quello che dice?', options: [
    "Sì, come un essere umano",
    "No, genera risposte basate su probabilità",
    "Solo se è aggiornato", "Dipende"
  ], correct: 1, points: 2 },
  { id: 13, section: 'Comprensione Avanzata', text: "Quale tra queste affermazioni è corretta?", options: [
    "L'AI prende decisioni autonome sempre corrette",
    "L'AI può commettere errori anche se sembra sicura",
    "L'AI è sempre neutrale",
    "L'AI sostituirà completamente ogni lavoro umano"
  ], correct: 1, points: 1 },
  { id: 14, section: 'Comprensione Avanzata', text: 'Cos\'è un "prompt"?', options: [
    "Un comando o istruzione data all'AI",
    "Un errore del sistema", "Un tipo di algoritmo", "Non so"
  ], correct: 0, points: 1 },

  { id: 15, section: 'Domande Avanzate', text: "Cosa distingue un modello LLM da un classico algoritmo deterministico?", options: [
    "Produce sempre lo stesso output dato lo stesso input",
    "È basato su probabilità e distribuzioni statistiche",
    "Non utilizza dati",
    "È programmato manualmente per ogni risposta"
  ], correct: 1, points: 2 },
  { id: 16, section: 'Domande Avanzate', text: 'Cosa rappresenta il "temperature" nei modelli generativi?', options: [
    "La velocità del modello",
    "Il livello di casualità/creatività nelle risposte",
    "La quantità di dati usati", "La memoria del sistema"
  ], correct: 1, points: 2 },
  { id: 17, section: 'Domande Avanzate', text: 'Cosa significa "fine-tuning" di un modello AI?', options: [
    "Allenare il modello da zero",
    "Adattare un modello pre-addestrato su dati specifici",
    "Ridurre la dimensione del modello", "Migliorare l'hardware"
  ], correct: 1, points: 2 },
  { id: 18, section: 'Domande Avanzate', text: "Quale tra questi è un limite reale degli LLM?", options: [
    "Non possono generare testo",
    "Non hanno comprensione semantica reale",
    "Non possono essere usati in azienda",
    "Sono sempre aggiornati in tempo reale"
  ], correct: 1, points: 2 },
  { id: 19, section: 'Domande Avanzate', text: 'Cos\'è un "embedding" in ambito AI?', options: [
    "Un tipo di hardware",
    "Una rappresentazione numerica di dati (es. testo)",
    "Un errore del sistema", "Un linguaggio di programmazione"
  ], correct: 1, points: 3 },
];

function calculateScore(answers) {
  let score = 0;
  for (const q of QUESTIONS) {
    if (q.correct === null) continue;
    if (parseInt(answers[`q${q.id}`]) === q.correct) score += q.points;
  }
  return score;
}

function getLevel(score) {
  if (score <= 10) return 'Principiante';
  if (score <= 20) return 'Intermedio';
  return 'Avanzato';
}

// sql.js helpers
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

// --- Middleware ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

function requireAdmin(req, res, next) {
  if (req.cookies.admin_token === ADMIN_TOKEN) return next();
  res.redirect('/admin/login');
}

// --- Admin Routes ---

app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

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
           ROUND(AVG(r.score), 1) as avg_score
    FROM companies c
    LEFT JOIN responses r ON r.company_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  res.render('admin', { companies, host: req.get('host'), protocol: req.protocol });
});

app.post('/admin/companies', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.redirect('/admin');
  const slug = uuidv4().slice(0, 8);
  dbRun('INSERT INTO companies (name, slug) VALUES (?, ?)', [name, slug]);
  res.redirect('/admin');
});

app.post('/admin/companies/:id/delete', requireAdmin, (req, res) => {
  dbRun('DELETE FROM responses WHERE company_id = ?', [parseInt(req.params.id)]);
  dbRun('DELETE FROM companies WHERE id = ?', [parseInt(req.params.id)]);
  res.redirect('/admin');
});

app.get('/admin/companies/:id', requireAdmin, (req, res) => {
  const company = dbGet('SELECT * FROM companies WHERE id = ?', [parseInt(req.params.id)]);
  if (!company) return res.status(404).send('Azienda non trovata');

  const responses = dbAll(
    'SELECT * FROM responses WHERE company_id = ? ORDER BY created_at DESC',
    [company.id]
  );

  responses.forEach(r => {
    try { r.parsedAnswers = JSON.parse(r.answers); } catch { r.parsedAnswers = {}; }
  });

  const stats = {
    total: responses.length,
    avgScore: responses.length ? (responses.reduce((s, r) => s + r.score, 0) / responses.length).toFixed(1) : 0,
    principiante: responses.filter(r => r.level === 'Principiante').length,
    intermedio: responses.filter(r => r.level === 'Intermedio').length,
    avanzato: responses.filter(r => r.level === 'Avanzato').length,
  };

  res.render('company-results', {
    company, responses, stats, questions: QUESTIONS,
    host: req.get('host'), protocol: req.protocol
  });
});

app.get('/admin/companies/:id/export', requireAdmin, (req, res) => {
  const company = dbGet('SELECT * FROM companies WHERE id = ?', [parseInt(req.params.id)]);
  if (!company) return res.status(404).send('Non trovata');

  const responses = dbAll(
    'SELECT * FROM responses WHERE company_id = ? ORDER BY created_at DESC',
    [company.id]
  );

  const header = 'Nome,Ruolo,Punteggio,Livello,Uso AI (D20),Preoccupazione (D21),Data\n';
  const rows = responses.map(r => {
    const esc = s => `"${(s || '').replace(/"/g, '""')}"`;
    return `${esc(r.respondent_name)},${esc(r.respondent_role)},${r.score},${r.level},${esc(r.open_20)},${esc(r.open_21)},${r.created_at}`;
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${company.name.replace(/[^a-zA-Z0-9]/g, '_')}_risultati.csv"`);
  res.send('\uFEFF' + header + rows);
});

// --- Public Test Routes ---

app.get('/test/:slug', (req, res) => {
  const company = dbGet('SELECT * FROM companies WHERE slug = ?', [req.params.slug]);
  if (!company) return res.status(404).render('not-found');
  res.render('test', { company, questions: QUESTIONS });
});

app.post('/test/:slug', (req, res) => {
  const company = dbGet('SELECT * FROM companies WHERE slug = ?', [req.params.slug]);
  if (!company) return res.status(404).render('not-found');

  const body = req.body;
  const answers = {};
  for (const key of Object.keys(body)) {
    if (key.startsWith('q')) answers[key] = body[key];
  }

  const score = calculateScore(answers);
  const level = getLevel(score);

  dbRun(`
    INSERT INTO responses (company_id, respondent_name, respondent_role, answers, score, level, open_20, open_21)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    company.id,
    (body.respondent_name || '').trim(),
    (body.respondent_role || '').trim(),
    JSON.stringify(answers),
    score, level,
    (body.open_20 || '').trim(),
    (body.open_21 || '').trim()
  ]);

  res.render('thanks', { company, score, level });
});

// --- Start ---
async function start() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      respondent_name TEXT NOT NULL DEFAULT '',
      respondent_role TEXT NOT NULL DEFAULT '',
      answers TEXT NOT NULL,
      score INTEGER NOT NULL,
      level TEXT NOT NULL,
      open_20 TEXT DEFAULT '',
      open_21 TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `);
  saveDb();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

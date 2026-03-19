# Questionario AI — Valutazione Competenze

Applicazione web per somministrare questionari di valutazione sulle competenze AI alle aziende.

## Funzionalità

- **Area admin** protetta da password per gestire le aziende
- **Link unico** generato automaticamente per ogni azienda
- **Test interattivo** con calcolo automatico del punteggio (27 punti max)
- **Dashboard risultati** con statistiche, dettagli per risposta, e export CSV
- **Classificazione automatica**: Principiante (0-10), Intermedio (11-20), Avanzato (21-27)

## Avvio locale

```bash
npm install
node server.js
```

Apri http://localhost:8080/admin (password default: `admin2025`)

## Deploy su Cloud Run

### 1. Build e push dell'immagine

```bash
# Imposta il progetto GCP
gcloud config set project IL-TUO-PROGETTO

# Build con Cloud Build
gcloud builds submit --tag gcr.io/IL-TUO-PROGETTO/questionario-ai

# Oppure con Artifact Registry
gcloud builds submit --tag europe-west1-docker.pkg.dev/IL-TUO-PROGETTO/REPO/questionario-ai
```

### 2. Deploy

```bash
gcloud run deploy questionario-ai \
  --image gcr.io/IL-TUO-PROGETTO/questionario-ai \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars="ADMIN_PASSWORD=la-tua-password-sicura"
```

### Persistenza dati

Il database SQLite viene salvato nel container. Per persistere i dati tra i deploy:

**Opzione A — Volume Cloud Storage (FUSE):**
```bash
gcloud run deploy questionario-ai \
  --image gcr.io/IL-TUO-PROGETTO/questionario-ai \
  --add-volume name=data,type=cloud-storage,bucket=IL-TUO-BUCKET \
  --add-volume-mount volume=data,mount-path=/app/data \
  --set-env-vars="ADMIN_PASSWORD=xxx,DB_PATH=/app/data/quiz.db" \
  --allow-unauthenticated
```

**Opzione B — Migra a Cloud SQL (PostgreSQL):**
Per un uso in produzione con molti utenti, considera la migrazione a PostgreSQL su Cloud SQL.

## Variabili d'ambiente

| Variabile        | Default       | Descrizione                    |
|------------------|---------------|--------------------------------|
| `PORT`           | `8080`        | Porta del server               |
| `ADMIN_PASSWORD` | `admin2025`   | Password area admin            |
| `DB_PATH`        | `./data/quiz.db` | Percorso database SQLite    |

## Struttura

```
├── server.js          # Server Express + routes + logica quiz
├── views/
│   ├── admin-login.ejs
│   ├── admin.ejs
│   ├── company-results.ejs
│   ├── test.ejs
│   ├── thanks.ejs
│   └── not-found.ejs
├── Dockerfile
├── package.json
└── README.md
```

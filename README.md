# EatUp

EatUp e' una web application full stack per organizzare ingredienti, ricette e programmi alimentari settimanali in un unico posto.

L'app permette all'utente di partire da cio' che ha gia' in cucina, selezionare ingredienti, cercarli rapidamente e generare ricette tramite AI. Include anche un meal planner settimanale che crea colazione, pranzo, merenda e cena sulla base di calorie, macronutrienti, preferenze e intolleranze.

## Funzionalita'

- Home page con presentazione del progetto e anteprima del programma di oggi.
- Registrazione con email e password.
- Login tradizionale con password cifrata tramite bcrypt.
- Login con Google tramite Google Identity Services.
- Logout con rimozione del cookie di sessione.
- Sessione utente tramite JWT salvato in cookie HTTP-only.
- Lista ingredienti divisa per categorie.
- Ricerca testuale degli ingredienti.
- Selezione e rimozione rapida degli ingredienti scelti.
- Generazione AI di ricette divise in tre gruppi:
  - solo ingredienti selezionati;
  - pochi ingredienti extra;
  - ricette piu' complete con ingredienti da comprare.
- Programma alimentare settimanale generato con AI.
- Salvataggio e recupero del programma settimanale per utente.
- Invio email di benvenuto per i nuovi account Google.

## Stack tecnico

### Client

- Angular 20
- TypeScript
- Angular Router
- Angular Forms
- Bootstrap
- CSS custom

### Server

- Node.js
- Express
- TypeScript
- MongoDB
- JWT
- bcrypt
- Nodemailer
- Google GenAI / Vertex AI
- Google Identity Services
- HTTPS

## Struttura del progetto

```text
Progetto_EatUp/
├── Client/
│   └── Client_EatUp/
│       └── src/app/
│           ├── home/
│           ├── login/
│           ├── registration/
│           ├── ingredients-recipes/
│           ├── week-program/
│           └── services/
├── Server/
│   ├── server.ts
│   ├── message.html
│   ├── Keys/
│   └── DB/
└── README.md
```

## Requisiti

- Node.js installato
- npm installato
- MongoDB disponibile in locale o su Atlas
- Credenziali Google configurate per:
  - login OAuth lato client;
  - invio email Gmail con password per app;
  - Google Cloud / Vertex AI per la generazione AI.

## Configurazione server

Nel percorso `Server/` crea un file `.env` con le variabili necessarie.

Esempio:

```env
dbName=EatUp
HTTPS_PORT=3000
DURATA_TOKEN=3600
connectionStringLocal=mongodb://127.0.0.1:27017
connectionStringAtlas=mongodb+srv://...
googleOAuth={"user":"tua-email@gmail.com","pass":"password-per-app-google"}
GOOGLE_CLOUD_PROJECT=nome-progetto-google-cloud
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
VERTEX_AI_MODEL=gemini-2.5-flash
GOOGLE_APPLICATION_CREDENTIALS=percorso/al/service-account.json
```

> Nota: `googleOAuth` deve essere JSON valido e scritto su una sola riga.

## Configurazione client

Nel file:

```text
Client/Client_EatUp/src/environments/environment.ts
```

inserisci il tuo Google Client ID:

```ts
export const environment = {
  googleClientId: 'IL_TUO_GOOGLE_CLIENT_ID',
};
```

## Installazione

Installa le dipendenze del client:

```bash
cd Client/Client_EatUp
npm install
```

Installa le dipendenze del server:

```bash
cd Server
npm install
```

## Avvio in sviluppo

Avvia il server HTTPS:

```bash
cd Server
npm start
```

Avvia il client Angular:

```bash
cd Client/Client_EatUp
npm start
```

Il client sara' disponibile normalmente su:

```text
http://localhost:4200
```

Il server risponde su:

```text
https://localhost:3000/api
```

## Build del client

```bash
cd Client/Client_EatUp
npm run build
```

## Endpoint principali

- `POST /api/register` registra un nuovo utente.
- `POST /api/login` effettua il login classico.
- `POST /api/loginWithGoogle` effettua il login tramite Google.
- `POST /api/logout` termina la sessione ed elimina il cookie JWT.
- `GET /api/getIngredients` recupera gli ingredienti.
- `POST /api/generateRecipesFromIngredients` genera ricette con AI.
- `POST /api/generateWeekProgram` genera il programma settimanale.
- `GET /api/weekProgram` recupera il programma settimanale salvato.

## Note di sicurezza

- Non caricare su Git file `.env`.
- Non caricare chiavi private, certificati reali o service account Google.
- Usa una password per app Google per Nodemailer, non la password normale dell'account.
- Se qualche segreto e' gia' stato committato in passato, va rimosso dalla history e rigenerato.

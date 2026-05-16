"use strict"

//a. importare le librerie
import http from "http";
import https from "https";
import fs from "fs";
import express, { CookieOptions } from "express";
import dotenv from "dotenv";
import cors from "cors";
import queryStringParcer from "./queryStringParser";
import { Document, MongoClient, ObjectId, WithId } from "mongodb";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import path from "path";
import cookieParser from "cookie-parser"
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";

//b. callback
const app: express.Express = express();
// prende le configurazioni dal file .env
dotenv.config({ path: './.env' });
const connectionString = process.env.connectionStringLocal;  //process.env.connectionStringLocal    process.env.connectionStringAtlas
const dbName = process.env.dbName;
//const PORT = parseInt(process.env.PORT!);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT!);
const googleOAuth = JSON.parse(process.env.googleOAuth!);

//c. configurazione e avvio del server http
// const server = http.createServer(app);
let paginaErrore: string = "";

fs.readFile("./static/error.html", function (err, content) {
    if (err) {
        paginaErrore = "<h1>Risorsa non trovata</h1>";
    }
    else {
        paginaErrore = content.toString();
    }
});

// server.listen(PORT, function () {
//     console.log(`Server in ascolto sulla porta ${PORT}`);
// });

// creazione ed avvio del server HTTPS
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const credentials = { "key": privateKey, "cert": certificate }
const jwtKey = fs.readFileSync("keys/jwtKey", "utf8")

let httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT, function () {
    console.log("Server in ascolto sulla porta HTTPS:" + HTTPS_PORT)
});

//d. middleware
// 1. log della richiesta
// in app.use() se ometto la risorsa, vuol dire che richiama '/'
app.use('/', function (req, res, next) {
    console.log(`${req.method} : ${req.originalUrl}`);
    next();
});

// 2. gestione delle risorse statiche
app.use('/', express.static('./static'));

// 3. lettura dei parametri post
// i parametri post sono restuituiti in req.body già parsificati
// i parametri get sono sempre in req.query già parsificati
app.use('/', express.json({ 'limit': '5mb' }));

// 4. gestione dei parametri GET
app.use('/', queryStringParcer);

// 5. log dei parametri post, non get perchè sono già visibili nel 1o middleware
app.use('/', function (req: any, res: any, next: any) {
    if (req.body && Object.keys(req.body).length > 0) {
        console.log("    parametri body: " + JSON.stringify(req.body));
    }
    if (req.query && Object.keys(req.query).length > 0) {
        console.log("    parametri query: " + JSON.stringify(req.query));
    }
    next();
});

// 6. vincoli CORS
const corsOptions = {
    origin: function (origin: any, callback: any) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", cors(corsOptions))

// 7. cookie parsing
app.use(cookieParser())

// D2. Gestione login e token
//il servizio di login deve essere eseguito PRIMA del controllo token
const cookiesOpsions: CookieOptions = {
    path: "/",//vale per tutte le sotto-route
    httpOnly: true, //non è visibile da javascript
    secure: true,//trasmesso solo su canali HTTPS
    maxAge: parseInt(process.env.DURATA_TOKEN!) * 1000, //durata relativa a partire da ora espressa in millisecondi
    sameSite: "none" //i cookie devono essere trasmessi anche extra domain
}

//1. login
app.post('/api/login', async function (req, res, next) {
    let username = req.body.username;
    let password = req.body.password;
    const client = new MongoClient(connectionString!);
    await client.connect().catch(err => {
        res.status(503).send("Errore di connessione al database");
        return;
    });
    const db = client.db(dbName);
    const collection = client.db(dbName).collection("users");
    const cmd = collection.findOne({ "username": username });
    cmd.then(function (dbUser) {
        if (!dbUser) {
            res.status(401).send("Username non valido");
        } else {
            console.log("Password ricevuta: ", password, "Password DB: ", dbUser.password)
            bcrypt.compare(password, dbUser.password, function (err, ok) {
                if (err) {
                    res.status(500).send("bcrypt execution error");
                    console.log(err.stack);
                } else if (!ok) {
                    res.status(401).send("Password non valida")
                } else {
                    const TOKEN = createToken(dbUser)
                    res.cookie("TOKEN", TOKEN, cookiesOpsions)
                    res.send({ _id: dbUser._id })
                }
            })
        }
    });
    cmd.catch(function (err) {
        res.status(500).send("Errore lettura collezioni" + err);
    });
    cmd.finally(function () {
        client.close();
    });
});

app.post('/api/loginWithGoogle', async function (req, res, next) {
    const googleToken:any = req.body.googleToken;
    const payloadGoogleToken:any = jwt.decode(googleToken)
    console.log("Google token", payloadGoogleToken)
    const client = new MongoClient(connectionString!);
    await client.connect().catch(function(err){
        res.status(503).send("Errore di connessione al database");
        return;
    });
    const collection = client.db(dbName).collection("users");
    const cmd = collection.findOne({ "username": payloadGoogleToken?.email });
    cmd.catch(function (err) {
        res.status(500).send("Errore lettura collezioni" + err);
        client.close();
    })
    cmd.then(function (dbUser) {
        if (!dbUser) {
            // se l'utente non esiste lo creo
            let password = ""
            for (let i = 0; i < 12; i++) {
                password += String.fromCharCode(Math.floor(Math.random() * 26) + 65)
            }
            const newUser:any = {
                username: payloadGoogleToken.email,
                password: bcrypt.hashSync(password, 10), // non serve perchè l'autenticazione avviene tramite google
                oldPassword: password
            }
            const cmd2 = collection.insertOne(newUser)
            cmd2.catch(function(err){
                res.status(500).send("Errore lettura collezioni" + err);
            })
            cmd2.then(function(mongoResponse){
                newUser._id = mongoResponse.insertedId.toString()
                sendGmail(payloadGoogleToken.email,password).catch((err: any) => {
                    console.log("Errore invio email Google login", err);
                })
                let TOKEN = createToken(newUser);
                res.cookie("TOKEN", TOKEN, cookiesOpsions)
                res.send({username: payloadGoogleToken.email})
            })
            cmd2.finally(function(){
                client.close()
            })
        }else{
            let TOKEN = createToken(dbUser);
            res.cookie("TOKEN", TOKEN, cookiesOpsions)
            res.send({username: payloadGoogleToken.email})
        }
    });
});

async function sendGmail(email:string,password:string){
    let message = fs.readFileSync("./message.html", "utf-8")
    message = message.replace("__user",email)
    message = message.replace("__password",password)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: googleOAuth
    })

    await transporter.sendMail({
        from: `"EatUp" <${googleOAuth.user}>`,
        to: email,
        subject: "Benvenuto su EatUp",
        html: message
    })
}



// Registrazione
app.post('/api/register', async function (req, res) {
    const username = req.body.username;
    const password = req.body.password;

    const client = new MongoClient(connectionString!);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection("users");

        const dbUser = await collection.findOne({ username: username });

        if (dbUser) {
            return res.status(401).send("Username già esistente");
        }

        const newUser = {
            username: username,
            password: bcrypt.hashSync(password, 10)
        };

        const result = await collection.insertOne(newUser);

        return res.send({ _id: result.insertedId });

    } catch (err) {
        return res.status(500).send("Errore server: " + err);
    } finally {
        await client.close();
    }
});

app.post("/api/logout", function (req, res, next) {
    let options = {
        ...cookiesOpsions,
        maxAge: -1
    }
    res.cookie("TOKEN", "", options)
    res.send({ ok: 1 })
})

// nome della collezione passato come risorsa
app.get('/api/getIngredients', async function (req: any, res: any) {
    const currentCollection: string = "ingredienti"

    const client = new MongoClient(connectionString!);
    await client.connect().catch((err: any) => {
        res.status(503).send("Errore di connessione al database");
        return;
    });
    const collection = client.db(dbName).collection(currentCollection);
    const cmd = collection.find({}).toArray();
    cmd.then(function (data: any) {
        res.send(data);
    });
    cmd.catch(function (err: any) {
        res.status(500).send("Errore lettura collezioni" + err);
    });
    cmd.finally(function () {
        client.close();
    });
});

//2. controllo token
//controllo su tutte le richieste che iniziano per /api se il token è valido
app.use("/api", function (req:any, res, next) {
    //vediamo se nella collezione dei cookies c'è un cookie che si chaima token
    if (!req.cookies || !req.cookies.TOKEN) {
        res.status(403).send("Token mancante")
    } else {
        let token = req.cookies.TOKEN
        jwt.verify(token, jwtKey, function (err: any, payload: any) {
            if (err) {
                res.status(403).send("Token scaduto o non valido")
            } else {
                const newToken = createToken(payload)
                res.cookie("TOKEN", newToken, cookiesOpsions)
                req["username"] = payload.username
                next();
            }
        })

    }
})

app.post('/api/generateWeekProgram', async function (req: any, res: any) {
    const calorie = Number(req.body?.calorie);

    if (!calorie || calorie <= 0) {
        return res.status(400).send("Le calorie sono obbligatorie");
    }

    if (!process.env.GOOGLE_CLOUD_PROJECT) {
        return res.status(500).send("GOOGLE_CLOUD_PROJECT non configurato nel file .env");
    }

    const vertexAI = createVertexAIClient();

    try {
        const response = await vertexAI.models.generateContent({
            model: process.env.VERTEX_AI_MODEL || "gemini-2.5-flash",
            contents: JSON.stringify({
                richiesta: "Crea un programma alimentare settimanale in JSON per 7 giorni con colazione, pranzo, merenda e cena.",
                vincoli: {
                    calorieGiornaliere: calorie,
                    proteineGrammi: req.body?.proteine ?? null,
                    carboidratiGrammi: req.body?.carboidrati ?? null,
                    grassiGrammi: req.body?.grassi ?? null,
                    fibreGrammi: req.body?.fibre ?? null,
                    preferenze: req.body?.preferenze ?? "",
                    intolleranze: req.body?.intolleranze ?? ""
                }
            }),
            config: {
                systemInstruction: "Sei un nutrizionista digitale per EatUp. Genera solo programmi alimentari realistici e vari, senza diagnosi mediche.",
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["days"],
                    properties: {
                        days: {
                            type: "array",
                            minItems: 7,
                            maxItems: 7,
                            items: {
                                type: "object",
                                additionalProperties: false,
                                required: ["giorno", "colazione", "pranzo", "merenda", "cena"],
                                properties: {
                                    giorno: { type: "string" },
                                    colazione: { type: "string" },
                                    pranzo: { type: "string" },
                                    merenda: { type: "string" },
                                    cena: { type: "string" }
                                }
                            }
                        }
                    }
                }
            }
        });

        const generatedProgram = parseVertexJson(response.text);
        const weekProgram = buildDatedWeekProgram(generatedProgram, req.body);
        await saveWeekProgram(req.username, weekProgram);

        return res.send(weekProgram);
    } catch (err: any) {
        console.log("Errore generazione programma settimanale", err);
        return res.status(500).send("Errore durante la generazione del programma settimanale");
    }
});

app.get('/api/weekProgram', async function (req: any, res: any) {
    const client = new MongoClient(connectionString!);

    try {
        await client.connect();
        const collection = client.db(dbName).collection("weekPrograms");
        const program = await collection.findOne(
            { username: req.username },
            { sort: { updatedAt: -1 }, projection: { _id: 0 } }
        );

        return res.send(program ?? { days: [] });
    } catch (err: any) {
        console.log("Errore lettura programma settimanale", err);
        return res.status(500).send("Errore durante il recupero del programma settimanale");
    } finally {
        await client.close();
    }
});

app.post('/api/generateRecipesFromIngredients', async function (req: any, res: any) {
    const ingredients = Array.isArray(req.body?.ingredients)
        ? req.body.ingredients.map((ingredient: any) => String(ingredient).trim()).filter((ingredient: string) => ingredient.length > 0)
        : [];

    if (ingredients.length === 0) {
        return res.status(400).send("Seleziona almeno un ingrediente");
    }

    if (!process.env.GOOGLE_CLOUD_PROJECT) {
        return res.status(500).send("GOOGLE_CLOUD_PROJECT non configurato nel file .env");
    }

    const vertexAI = createVertexAIClient();

    try {
        const response = await vertexAI.models.generateContent({
            model: process.env.VERTEX_AI_MODEL || "gemini-2.5-flash",
            contents: JSON.stringify({
                richiesta: "Genera ricette divise in tre gruppi: solo ingredienti selezionati, ricette con 2 o 3 ingredienti extra, ricette con piu ingredienti da comprare ma molto valide.",
                ingredientiSelezionati: ingredients,
                regole: [
                    "Ogni ricetta deve avere qualita da 0 a 5, immagine, ingredienti e descrizione.",
                    "Il campo immagine deve essere un URL fotografico costruito con https://loremflickr.com/900/620/ seguito da 2 o 3 keyword inglesi separate da virgola, coerenti con la ricetta.",
                    "Le ricette del gruppo soloSelezionati devono usare solo gli ingredienti selezionati piu acqua, sale, pepe, olio o spezie base.",
                    "Le ricette del gruppo pochiExtra devono indicare 2 o 3 ingredienti extra.",
                    "Le ricette del gruppo daComprare possono indicare piu ingredienti extra, ma devono spiegare perche vale la pena."
                ]
            }),
            config: {
                systemInstruction: "Sei lo chef digitale di EatUp. Suggerisci ricette realistiche in italiano, valorizzando gli ingredienti gia disponibili e limitando gli sprechi.",
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["soloSelezionati", "pochiExtra", "daComprare"],
                    properties: {
                        soloSelezionati: {
                            type: "array",
                            minItems: 1,
                            maxItems: 4,
                            items: recipeSchema()
                        },
                        pochiExtra: {
                            type: "array",
                            minItems: 1,
                            maxItems: 4,
                            items: recipeSchema()
                        },
                        daComprare: {
                            type: "array",
                            minItems: 1,
                            maxItems: 4,
                            items: recipeSchema()
                        }
                    }
                }
            }
        });

        const recipes = parseVertexJson(response.text);
        return res.send(recipes);
    } catch (err: any) {
        console.log("Errore generazione ricette", err);
        return res.status(500).send("Errore durante la generazione delle ricette");
    }
});

function createVertexAIClient() {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) {
        throw new Error("GOOGLE_CLOUD_PROJECT non configurato");
    }

    return new GoogleGenAI({
        vertexai: true,
        project,
        location: process.env.GOOGLE_CLOUD_LOCATION || "global"
    });
}

function parseVertexJson(text: string | undefined) {
    if (!text) {
        throw new Error("Vertex AI non ha restituito testo");
    }
    return JSON.parse(text);
}

function buildDatedWeekProgram(generatedProgram: any, preferences: any) {
    const days = Array.isArray(generatedProgram?.days) ? generatedProgram.days : [];
    const startDate = todayIsoDate();
    const datedDays = days.map((day: any, index: number) => ({
        ...day,
        date: addDaysIsoDate(startDate, index)
    }));

    return {
        startDate,
        endDate: addDaysIsoDate(startDate, Math.max(datedDays.length - 1, 0)),
        updatedAt: new Date(),
        preferences: {
            calorie: preferences?.calorie ?? null,
            proteine: preferences?.proteine ?? null,
            carboidrati: preferences?.carboidrati ?? null,
            grassi: preferences?.grassi ?? null,
            fibre: preferences?.fibre ?? null,
            preferenze: preferences?.preferenze ?? "",
            intolleranze: preferences?.intolleranze ?? ""
        },
        days: datedDays
    };
}

async function saveWeekProgram(username: string, weekProgram: any) {
    const client = new MongoClient(connectionString!);

    try {
        await client.connect();
        const collection = client.db(dbName).collection("weekPrograms");
        await collection.updateOne(
            { username },
            {
                $set: {
                    ...weekProgram,
                    username,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
    } finally {
        await client.close();
    }
}

function todayIsoDate() {
    return formatIsoDate(new Date());
}

function addDaysIsoDate(isoDate: string, daysToAdd: number) {
    const date = new Date(`${isoDate}T00:00:00`);
    date.setDate(date.getDate() + daysToAdd);
    return formatIsoDate(date);
}

function formatIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function recipeSchema() {
    return {
        type: "object",
        additionalProperties: false,
        required: ["titolo", "qualita", "immagine", "ingredienti", "ingredientiExtra", "descrizione"],
        properties: {
            titolo: { type: "string" },
            qualita: { type: "number", minimum: 0, maximum: 5 },
            immagine: { type: "string" },
            ingredienti: {
                type: "array",
                minItems: 1,
                items: { type: "string" }
            },
            ingredientiExtra: {
                type: "array",
                items: { type: "string" }
            },
            descrizione: { type: "string" }
        }
    };
}

function createToken(data: any) {
    //tempo di creazione del token in secondi
    let now = Math.floor(((new Date()).getTime()) / 1000);
    const payload = {
        _id: data._id,
        username: data.username,
        iat: data.iat || now,
        exp: now + parseInt(process.env.DURATA_TOKEN!)
    }
    const token = jwt.sign(payload, jwtKey)
    console.log("Creato nuovo token", token)
    return token
}

//e. gestione delle root dinamiche
app.get('/api/getCollections', async function (req, res, next) {
    const client = new MongoClient(connectionString!);
    await client.connect().catch(err => {
        res.status(503).send("Errore di connessione al database");
        return;
    });
    const db = client.db(dbName);
    // restituisce l'elenco delle collezioni presenti nel db
    const cmd = db.listCollections().toArray();
    cmd.then(function (data) {
        res.send(data);
    });
    cmd.catch(function (err) {
        res.status(500).send("Errore lettura collezioni" + err);
    });
    cmd.finally(function () {
        client.close();
    });
});



//f. default root
app.use(function (req, res, next) {
    if (req.originalUrl.startsWith('/api/')) {
        // servizio non trovato
        res.status(404).send("Risorsa non trovata");
    }
    else if (req.accepts('html')) {
        res.status(404).send(paginaErrore);
    }
    else {
        res.sendStatus(404);
    }
});

//g. gestione degli errori
app.use('/', function (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
    // err.stack contiene l'elenco completo degli errori
    res.status(500).send(err.message);
    console.log('****** ERRORE ******\n' + err.stack);
});


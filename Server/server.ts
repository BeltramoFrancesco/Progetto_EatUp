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
const FOOD_NOT_FOUND_IMAGE = "/foodNotFound.png";
const recipeImageCache = new Map<string, string>();

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
                richiesta: "Genera solo ricette vere, riconoscibili e cucinabili, divise in tre gruppi: solo ingredienti selezionati, ricette con 2 o 3 ingredienti extra, ricette con piu ingredienti da comprare ma molto valide.",
                ingredientiSelezionati: ingredients,
                regole: [
                    "Ogni ricetta deve essere un piatto realmente esistente o una variante comune e credibile della cucina italiana o internazionale.",
                    "Non inventare nomi fantasiosi, non proporre abbinamenti assurdi e non creare ricette impossibili da preparare.",
                    "Il titolo deve essere il nome di un piatto vero e riconoscibile, non una frase generica.",
                    "Ogni ricetta deve avere qualita da 0 a 5, ingredienti, ingredientiExtra, descrizione e imageSearchQuery.",
                    "imageSearchQuery deve essere una query breve e precisa per cercare una foto reale dello stesso piatto, non di una categoria generica. Se il piatto ha un nome italiano tradizionale, usa quel nome esatto.",
                    "La descrizione deve spiegare in modo realistico che tipo di piatto e' e perche' funziona con gli ingredienti indicati.",
                    "Le ricette del gruppo soloSelezionati devono usare solo gli ingredienti selezionati piu acqua, sale, pepe, olio o spezie base.",
                    "Le ricette del gruppo pochiExtra devono indicare 2 o 3 ingredienti extra.",
                    "Le ricette del gruppo daComprare possono indicare piu ingredienti extra, ma devono spiegare perche vale la pena.",
                    "Se per un gruppo non esistono ricette vere e plausibili, restituisci un array vuoto invece di forzare una ricetta inventata."
                ]
            }),
            config: {
                temperature: 0.35,
                systemInstruction: "Sei lo chef digitale di EatUp. Suggerisci solo ricette vere, realistiche e cucinabili in italiano. Privilegia piatti riconoscibili, ingredienti compatibili e preparazioni sensate. Non inventare ricette finte.",
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["soloSelezionati", "pochiExtra", "daComprare"],
                    properties: {
                        soloSelezionati: {
                            type: "array",
                            minItems: 0,
                            maxItems: 4,
                            items: recipeSchema()
                        },
                        pochiExtra: {
                            type: "array",
                            minItems: 0,
                            maxItems: 4,
                            items: recipeSchema()
                        },
                        daComprare: {
                            type: "array",
                            minItems: 0,
                            maxItems: 4,
                            items: recipeSchema()
                        }
                    }
                }
            }
        });

        const recipes = await prepareRecipesForClient(parseVertexJson(response.text));
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
        required: ["titolo", "qualita", "imageSearchQuery", "ingredienti", "ingredientiExtra", "descrizione"],
        properties: {
            titolo: { type: "string" },
            qualita: { type: "number", minimum: 0, maximum: 5 },
            imageSearchQuery: { type: "string" },
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

async function prepareRecipesForClient(recipes: any) {
    const groupKeys = ["soloSelezionati", "pochiExtra", "daComprare"];
    const result: any = {};

    for (const groupKey of groupKeys) {
        const groupRecipes = Array.isArray(recipes?.[groupKey]) ? recipes[groupKey] : [];
        const realisticRecipes = groupRecipes.filter((recipe: any) => isRealisticRecipe(recipe));

        result[groupKey] = await Promise.all(realisticRecipes.map(async (recipe: any) => ({
                titolo: String(recipe.titolo).trim(),
                qualita: Math.max(0, Math.min(5, Number(recipe.qualita ?? 0))),
                immagine: await findRecipeImage(recipe),
                ingredienti: normalizeStringArray(recipe.ingredienti),
                ingredientiExtra: normalizeStringArray(recipe.ingredientiExtra),
                descrizione: String(recipe.descrizione ?? "").trim()
            })));
    }

    return result;
}

function isRealisticRecipe(recipe: any) {
    const title = String(recipe?.titolo ?? "").trim();
    const description = String(recipe?.descrizione ?? "").trim();
    const ingredients = normalizeStringArray(recipe?.ingredienti);

    if (title.length < 4 || description.length < 20 || ingredients.length === 0) {
        return false;
    }

    const bannedGenericTitles = [
        "ricetta consigliata",
        "ricetta inventata",
        "piatto creativo",
        "mix di ingredienti",
        "fantasia di ingredienti"
    ];

    return !bannedGenericTitles.some((bannedTitle) => title.toLocaleLowerCase("it-IT").includes(bannedTitle));
}

async function findRecipeImage(recipe: any) {
    const queries = buildRecipeImageQueries(recipe);

    if (queries.length === 0) {
        return FOOD_NOT_FOUND_IMAGE;
    }

    const cacheKey = queries.join("|");

    if (recipeImageCache.has(cacheKey)) {
        return recipeImageCache.get(cacheKey)!;
    }

    let imageUrl: string | null = null;

    for (const query of queries) {
        imageUrl =
            await findTheMealDbImage(query) ??
            await findWikipediaImage(query) ??
            await findWikimediaCommonsImage(query);

        if (imageUrl) {
            break;
        }
    }

    imageUrl ??= FOOD_NOT_FOUND_IMAGE;

    recipeImageCache.set(cacheKey, imageUrl);
    return imageUrl;
}

function buildRecipeImageQueries(recipe: any) {
    const title = String(recipe?.titolo ?? "").trim();
    const suggestedQuery = String(recipe?.imageSearchQuery ?? "").trim();
    const ingredients = normalizeStringArray(recipe?.ingredienti).slice(0, 2).join(" ");
    const titleTokens = significantTokens(title);
    const suggestedTokens = significantTokens(suggestedQuery);

    return Array.from(new Set([
        title,
        suggestedQuery,
        titleTokens.join(" "),
        suggestedTokens.join(" "),
        titleTokens.slice(-2).join(" "),
        suggestedTokens.slice(-2).join(" "),
        ...titleTokens,
        ...suggestedTokens,
        [title, ingredients].filter(Boolean).join(" ")
    ].map((query) => query.trim()).filter((query) => query.length >= 3)));
}

async function findTheMealDbImage(query: string) {
    const url = "https://www.themealdb.com/api/json/v1/1/search.php?" + new URLSearchParams({
        s: query
    }).toString();

    const data = await fetchJson(url);
    const meals = Array.isArray(data?.meals) ? data.meals : [];

    return meals
        .filter((meal: any) => isRelevantImageResult(query, meal?.strMeal, true))
        .sort((first: any, second: any) => relevanceScore(query, second?.strMeal) - relevanceScore(query, first?.strMeal))
        .map((meal: any) => meal?.strMealThumb)
        .find((imageUrl: any) => isUsableImageUrl(imageUrl)) ?? null;
}

async function findWikipediaImage(query: string) {
    return await findWikipediaImageInLanguage("it", query) ??
        await findWikipediaImageInLanguage("en", query);
}

async function findWikipediaImageInLanguage(language: "it" | "en", query: string) {
    const exactImage = await findExactWikipediaImage(language, query);

    if (exactImage) {
        return exactImage;
    }

    const url = `https://${language}.wikipedia.org/w/api.php?` + new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrlimit: "5",
        prop: "pageimages|info",
        piprop: "thumbnail|original",
        pithumbsize: "900",
        inprop: "url",
        format: "json",
        origin: "*"
    }).toString();

    const data = await fetchJson(url);
    const pages = Object.values(data?.query?.pages ?? {}) as any[];

    return pages
        .filter((page: any) => isRelevantImageResult(query, page?.title))
        .sort((first: any, second: any) => relevanceScore(query, second?.title) - relevanceScore(query, first?.title))
        .flatMap((page: any) => [page?.original?.source, page?.thumbnail?.source])
        .find((imageUrl: any) => isUsableImageUrl(imageUrl)) ?? null;
}

async function findExactWikipediaImage(language: "it" | "en", query: string) {
    const url = `https://${language}.wikipedia.org/w/api.php?` + new URLSearchParams({
        action: "query",
        titles: query,
        redirects: "1",
        prop: "pageimages|info",
        piprop: "thumbnail|original",
        pithumbsize: "900",
        inprop: "url",
        format: "json",
        origin: "*"
    }).toString();

    const data = await fetchJson(url);
    const pages = Object.values(data?.query?.pages ?? {}) as any[];
    const page = pages.find((item: any) => !item?.missing && isRelevantImageResult(query, item?.title));

    return [page?.original?.source, page?.thumbnail?.source]
        .find((imageUrl: any) => isUsableImageUrl(imageUrl)) ?? null;
}

async function findWikimediaCommonsImage(query: string) {
    const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
        action: "query",
        generator: "search",
        gsrnamespace: "6",
        gsrsearch: query,
        gsrlimit: "20",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "900",
        format: "json",
        origin: "*"
    }).toString();

    const data = await fetchJson(url);
    const pages = Object.values(data?.query?.pages ?? {}) as any[];

    return pages
        .filter((page: any) => isRelevantImageResult(query, page?.title, true))
        .sort((first: any, second: any) => relevanceScore(query, second?.title) - relevanceScore(query, first?.title))
        .map((page: any) => page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url)
        .find((imageUrl: any) => isUsableImageUrl(imageUrl)) ?? null;
}

async function fetchJson(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "EatUp/1.0 recipe-image-search"
            }
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (err: any) {
        console.log("Ricerca immagine non riuscita", err?.message ?? err);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function isUsableImageUrl(imageUrl: any) {
    return typeof imageUrl === "string" &&
        imageUrl.startsWith("https://") &&
        /\.(jpg|jpeg|png|webp)(\?|$)/i.test(imageUrl);
}

function isRelevantImageResult(query: string, resultTitle: any, allowPartialMatch = false) {
    if (typeof resultTitle !== "string") {
        return false;
    }

    const queryTokens = significantTokens(query);
    const titleTokens = significantTokens(resultTitle.replace(/^file:/i, ""));

    if (queryTokens.length === 0 || titleTokens.length === 0) {
        return false;
    }

    const matchedTokens = queryTokens.filter((token) => titleTokens.includes(token));
    const requiredMatches = allowPartialMatch
        ? Math.max(1, Math.ceil(queryTokens.length * 0.5))
        : (queryTokens.length <= 2 ? queryTokens.length : Math.ceil(queryTokens.length * 0.65));

    return matchedTokens.length >= requiredMatches;
}

function relevanceScore(query: string, resultTitle: any) {
    if (typeof resultTitle !== "string") {
        return 0;
    }

    const queryTokens = significantTokens(query);
    const titleTokens = significantTokens(resultTitle.replace(/^file:/i, ""));
    const matchedTokens = queryTokens.filter((token) => titleTokens.includes(token));

    return matchedTokens.length * 10 - Math.max(0, titleTokens.length - matchedTokens.length);
}

function significantTokens(value: string) {
    const stopWords = new Set([
        "con", "alla", "alle", "allo", "all", "della", "delle", "degli", "del", "di", "e", "al", "ai",
        "the", "and", "with", "food", "dish", "recipe", "recipes", "cooked", "homemade", "plate", "file", "jpg", "jpeg", "png", "webp"
    ]);

    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function normalizeStringArray(value: any) {
    return Array.isArray(value)
        ? value.map((item: any) => String(item).trim()).filter((item: string) => item.length > 0)
        : [];
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

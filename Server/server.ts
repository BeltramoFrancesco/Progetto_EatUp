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

//b. callback
const app: express.Express = express();
// prende le configurazioni dal file .env
dotenv.config({ path: './.env' });
const connectionString = process.env.connectionStringLocal;  //process.env.connectionStringLocal    process.env.connectionStringAtlas
const dbName = process.env.dbName;
const PORT = parseInt(process.env.PORT!);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT!);

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



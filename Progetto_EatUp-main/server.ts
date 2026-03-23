//A. import delle librerie
import http, { request } from "http";
import fs from "fs";
import express from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import queryStringParser from "./queryStringParser";
import cors from "cors"

//req.query = parametri GET
//req.body = parametri POST
//req.params = parametri passati nella risorsa

//B. configurazioni
//funzione di callback richiamata in corrispondenza di ogni richiesta al server
const app: express.Express = express();
//prende le configurazioni dal file .env
dotenv.config({
    path: ".env"
});

const connectionString = process.env.connectionStringLocal;
const dbName = process.env.dbName;
const PORT = parseInt(process.env.PORT!);
//C. creazione ed avvio del server HTTP
const server = http.createServer(app);
let paginaErrore: string = "";

//avviamo il server sulla porta indicata
server.listen(PORT, function () {
    console.log("server in ascolto sulla porta " + PORT);
    fs.readFile("./static/error.html", function (err, content) {
        if (err)
            paginaErrore = "<h1>Risorsa non trovata</h1>"
        else
            paginaErrore = content.toString();
    })
});

//D. middleware
//1. request log
app.use("/", function (req, res, next) {
    console.log(req.method + ": " + req.originalUrl);
    next();
})

//2. gestione risorse statiche
app.use("/", express.static("./static"));

//3. lettura dei parametri post
//express.json({"limit": "5mb"}) = accetto parametri post con una dimensione massima di 5MB e li restituisce
//i parametri post sono restituiti come json all'interno di req.body
//i parametri get sono restituiti come json all'interno di req.query
//(agganciati automaticamente perchè in coda alla url)
app.use("/", express.json({ "limit": "5mb" }));

//4. Parsing dei parametri GET
app.use("/", queryStringParser)

//5. log dei parametri
app.use("/", function (req, res, next) {
    if (req.body && Object.keys(req.body).length > 0)
        console.log("      parametri body: " + JSON.stringify(req.body));
    else if (req.query && Object.keys(req.query).length > 0)
        console.log("      parametri query: " + JSON.stringify(req.query));
    next();
})

//6. Vincoli CORS
//accettiamo sul nostro server richieste da qualunque client
const corsOptions = {
    origin: function (origin: any, callback: any) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", cors(corsOptions));


//E. gestione delle risorse dinamiche

//elenco delle collezioni
app.get("/api/getCollections", async function (req, res, next) {
    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const db = client.db(dbName);
    //restituisce un JSON per ogni collezione presenti nel DB con all'interno 
    //name e altre informazioni
    const cmd = db.listCollections().toArray();
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore lettura collezioni: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
});

//inviaRichiesta("GET", "/unicorns", {filters})
app.get("/api/:collection", async function (req: any, res, next) {
    const selectedCollection = req.params.collection;
    //parametri passati in GET
    const filters = req["parsedQuery"];
    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const collection = client.db(dbName).collection(selectedCollection);
    const cmd = collection.find(filters).toArray();
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
});

//inviaRichiesta("GET", "/unicorns/id"})
app.get("/api/:collection/:id", async function (req, res, next) {
    const selectedCollection = req.params.collection;
    const selectedId = req.params.id;

    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const collection = client.db(dbName).collection(selectedCollection);
    const cmd = collection.findOne({ "_id": new ObjectId(selectedId) });
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
});

//inviaRichiesta("POST", "/unicorns" {newRecord})
app.post("/api/:collection", async function (req, res, next) {
    const selectedCollection = req.params.collection;
    const newRecord = req.body;

    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const collection = client.db(dbName).collection(selectedCollection);
    const cmd = collection.insertOne(newRecord);
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
});

//inviaRichiesta("DELETE", "/unicorns/id")
app.delete("/api/:collection/:id", async function (req, res, next) {
    const selectedCollection = req.params.collection;
    const _id = req.params.id;

    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const collection = client.db(dbName).collection(selectedCollection);
    const cmd = collection.deleteOne({ "_id": new ObjectId(_id) });
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
});

//inviaRichiesta("DELETE", "/unicorns", {filters})
app.delete("/api/:collection", async function (req: any, res, next) {
    const selectedCollection = req.params.collection;
    const filters = req["parsedQuery"];

    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const collection = client.db(dbName).collection(selectedCollection);
    const cmd = collection.deleteMany(filters);
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
});

//unviaRichiesta("PATCH", "/unicorns/id", {fieldsToUpdate})
app.patch("/api/:collection/:id", async function (req, res, next) {
    const selectedCollection = req.params.collection;
    const _id = new ObjectId(req.params.id);
    const action = req.body;

    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const collection = client.db(dbName).collection(selectedCollection);
    const cmd = collection.updateOne({ "_id": _id }, { "$set": action });
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
})

//inviaRichiesta("PUT", "/unicorns/id", {mongoActions})
app.put("/api/:collection/:id", async function (req, res, next) {
    const selectedCollection = req.params.collection;
    const _id = new ObjectId(req.params.id);
    const action = req.body;

    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const collection = client.db(dbName).collection(selectedCollection);
    const cmd = collection.updateOne({ "_id": _id }, action);
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
})


//inviaRichiesta("PUT", "/unicorns/", {"filter":{filters}, "action":{mongoActions}})
app.put("/api/:collection", async function (req, res, next) {
    const selectedCollection = req.params.collection;
    const filter = req.body.filter;
    const action = req.body.action;

    const client = new MongoClient(connectionString!);
    await client.connect().catch(function (err) {
        res.status(503).send("Errore di connessione al dbms")
        return;
    })
    const collection = client.db(dbName).collection(selectedCollection);
    const cmd = collection.updateMany(filter, action);
    cmd.then(function (data) {
        res.send(data);
    })
    cmd.catch(function (err) {
        res.status(500).send("Errore esecuzione query: " + err);
    });
    cmd.finally(function () {
        client.close();
    })
})


//F. default root
app.use("/", function (req, res, next) {
    res.status(404);
    if (!req.originalUrl.startsWith("/api/")) {
        //risorsa statica
        res.send(paginaErrore)
    }
    else {
        res.send("Risorsa non trovata")
    }
})

//G. gestione errori
app.use("/", function (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
    //err.stack elenco completo degli errori
    res.status(500).send(err.message);
    console.log("******** ERRORE ********:\n " + err.stack);
})






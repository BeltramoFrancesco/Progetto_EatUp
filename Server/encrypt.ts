// import
import bcrypt from "bcryptjs" // + @types
import {MongoClient, ObjectId}  from "mongodb";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

// mongo
const connectionString:string = process.env.connectionStringLocal!;
const DBNAME = process.env.DBNAME

encrypt()

async function encrypt(){
    const client = new MongoClient(connectionString);
    await client.connect().catch(function(err) {
        console.log("503 - Errore di connessione al DBMS");
        return;
    });
    const collection = client.db(DBNAME).collection('mails');
	// query 1 : lettura delle password
    const cmd = collection.find().project({"password":1}).toArray()
	cmd.then(function(data){
		let promises = []
		for(let item of data){
			// Controlo se la password corrente è già in formato bcrypt
			// Le stringhe bcrypt inizano con $2[ayb]$10$ e sono lunghe 60
			// Non può essere fatto con .startWith perchè non supporta le regex
			let regex = new RegExp("^\\$2[ayb]\\$10\\$.{53}$");
			if (!regex.test(item["password"])) {
			   let newPass = bcrypt.hashSync(item["password"], 10)
			   // query 2 : aggiornamento delle password				
			   let promise=collection.updateOne({"_id":new ObjectId(item["_id"])},
								   {"$set":{"password":newPass}})
			   promises.push(promise)
			   console.log("aggiornamento in corso ... ", item["_id"]);
			}
		}
		const finalPromise = Promise.all(promises)
		finalPromise.then(function (results) {
			// results è un vett enumerativo con tutte risposte di updateOne
			console.log(promises.length + " password aggiornate correttamente")
		})
		finalPromise.catch(function (err) {
			console.log("errore aggiornamento password : " +  err.message)
		})
		// essendoci 2 query annidate
		// la connessione deve essere chiusa dalla query interna
		finalPromise.finally(function () {
			console.log("closing connection")
			client.close();	
		}) 
	})    
	cmd.catch(function (err) {
		console.log("errore lettura password : " +  err.message);
		client.close();	
	})
}

/*NON E' CONSENTITO MODIFICARE REQ["QUERY"] CHE E' IN SOLA LETTURA 
E NON è POSSIBILE MODIFICARE LE SINGOLE CHIAVI DEL JSON*/

function parseQueryString(req: any, res: any, next: any) {
    //creo una nuova chiave parsedQuery che contiene req.query ma con ogni chiave parsificata
    req["parsedQuery"] = {};
    if (req["query"] && typeof req["query"] == "object") {
        for (const key in req["query"]) {
            const value = req["query"][key];
            req["parsedQuery"][key] = parseValue(value);
        }
    }
    next();
}

function parseValue(value: any) {
    if (value == "true")
        return true;

    if (value == "false")
        return false;

    //Number è simile a ParseInt ma nel caso abbiamo una stringa "15a" 
    //ParseInt restituisce solo 15 (si ferma al primo carattere non-numerico)
    //Number invece restituisce "Not a number" se non sono presenti solo numeri
    //Number accetta sia interi che decimali
    const num = Number(value);

    if (!isNaN(num))//se è un numero valido
        return num;

    //typeof NaN restituisce number
    // if (typeof num == "number")
    //     return num

    if (typeof value == "string" && (value.startsWith("{") || value.startsWith("["))) {
        try {
            return JSON.parse(value);
        }
        catch (error) {
            return value
        }
    }

    //se è una stringa: 
    return value;
}

export default parseQueryString;

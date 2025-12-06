/* webapp02/src/database.js */

import { MongoClient } from 'mongodb';

// Connection string to your local database
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

// Object to export. It will contain the connection and the database name.
const db = {};

async function connect() {
    try {
        // Connect the client to the server
        await client.connect();

        // Assign the connection to the specific database
        db.connection = client.db('secretosDeCocina'); // You can name your database whatever you want

        console.log("✅ Conectado exitosamente a la base de datos MongoDB.");

    } catch (error) {
        console.error("❌ No se pudo conectar a la base de datos:", error);
        // If the connection fails, the application cannot continue.
        process.exit(1);
    }
}

export { connect, db };
/* webapp02/src/database.js */

import { MongoClient } from 'mongodb';

// Connection URI
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

// Exported database object wrapper
const db = {};

/**
 * Establishes the connection to the MongoDB server.
 */
async function connect() {
    try {
        await client.connect();
        db.connection = client.db('secretosDeCocina');
        console.log("Successfully connected to MongoDB.");
    } catch (error) {
        console.error("Failed to connect to database:", error);
        process.exit(1); // Exit process on critical DB failure
    }
}

export { connect, db };
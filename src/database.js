
import { MongoClient } from 'mongodb';

// Cadena de conexión a tu base de datos local
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

// Objeto para exportar. Contendrá la conexión y el nombre de la BD.
const db = {};

async function connect() {
    try {
        // Conecta el cliente al servidor
        await client.connect();

        // Asigna la conexión a la base de datos específica
        db.connection = client.db('secretosDeCocina'); // Puedes nombrar tu BD como quieras

        console.log("✅ Conectado exitosamente a la base de datos MongoDB.");

    } catch (error) {
        console.error("❌ No se pudo conectar a la base de datos:", error);
        // Si la conexión falla, la aplicación no puede continuar.
        process.exit(1);
    }
}

export { connect, db };
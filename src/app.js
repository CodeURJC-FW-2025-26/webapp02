/* webapp02/src/app.js */

import express from 'express';
import session from 'express-session';
import mustacheExpress from 'mustache-express';
//import bodyParser from 'body-parser';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { connect } from './database.js';
import { seedDatabase } from './loadData.js';
import mainRouter from './routes/main.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// 1. Serve static files from the 'public' folder
app.use(express.static(join(__dirname, '../public')));
app.use('/uploads', express.static(join(__dirname, '../uploads')));
// Serve files from the 'uploads' folder
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// 2. Configure body-parser to read data from POST forms
//app.use(bodyParser.urlencoded({ extended: true }));

// Configuration for parsing form data (replaces body-parser)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'cadena-aleatoria-secreta-webb',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Change into 'true' if using https
}));

// 3. Configure the Mustache template engine
app.engine('html', mustacheExpress());
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'html');

// 4. Connect the routers
app.use('/', mainRouter);

// 5. Main function to start the application
async function startServer() {
    await connect();      // First, we connect to the database
    await seedDatabase();   // Then, we load the data if necessary

    const PORT = 3000;
    app.listen(PORT, () => { // Finally, we started the web server.
        console.log(`🚀 Servidor web funcionando en http://localhost:${PORT}`);
    });
}

startServer(); // Call the function to get everything started
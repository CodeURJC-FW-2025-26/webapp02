/* webapp02/src/app.js */

import express from 'express';
import session from 'express-session';
import mustacheExpress from 'mustache-express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { connect } from './database.js';
import { seedDatabase } from './loadData.js';
import mainRouter from './routes/main.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// 1. Serve static files (CSS, JS, Images)
app.use(express.static(join(__dirname, '../public')));
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// 2. Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Session Configuration
app.use(session({
    secret: 'your-random-secret-key-webapp',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to 'true' if using HTTPS
}));

// 4. Configure Mustache Template Engine
app.engine('html', mustacheExpress());
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'html');

// 5. Register Routes
app.use('/', mainRouter);

// 6. Application Entry Point
async function startServer() {
    try {
        await connect();        // Establish DB connection
        await seedDatabase();   // Seed initial data if empty

        const PORT = 3000;
        app.listen(PORT, () => {
            console.log(`Web server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Critical error starting server:", error);
    }
}

startServer();
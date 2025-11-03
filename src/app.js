
import express from 'express';
import mustacheExpress from 'mustache-express';
import bodyParser from 'body-parser';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';


import mainRouter from './routes/main.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// 1. Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(join(__dirname, '../public')));

// 2. Configurar body-parser para leer datos de formularios POST
app.use(bodyParser.urlencoded({ extended: true }));

// 3. Configurar el motor de plantillas Mustache
app.engine('html', mustacheExpress());
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'html');

// 4. Conectar los routers
app.use('/', mainRouter);

// 5. Iniciar el servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor web funcionando en http://localhost:${PORT}`);
});
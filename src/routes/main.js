// src/routes/main.js
import express from 'express';
const router = express.Router();

// Ruta para la página principal
router.get('/', (req, res) => {
    // Por ahora, solo renderizamos la vista sin pasarle datos.
    // Más adelante, aquí consultaremos la base de datos.
    res.render('index');
});

export default router;
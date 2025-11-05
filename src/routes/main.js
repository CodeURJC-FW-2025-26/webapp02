
import express from 'express';
import { db } from '../database.js';

const router = express.Router();

// Ruta para la página principal con paginación, búsqueda y filtro
router.get('/', async (req, res) => {
    try {
        // 1. Configuración de la Paginación
        const page = parseInt(req.query.page) || 1; // Página actual, por defecto 1
        const pageSize = 6; // Número de recetas por página (requisito rúbrica)
        const skip = (page - 1) * pageSize;

        // 2. Configuración de Filtros (Búsqueda y Categoría)
        const filter = {};
        const searchQuery = req.query.search;
        const categoryQuery = req.query.category;

        if (searchQuery) {
            // Búsqueda por nombre no sensible a mayúsculas/minúsculas
            filter.name = { $regex: searchQuery, $options: 'i' };
        }
        if (categoryQuery) {
            filter.category = categoryQuery;
        }

        // 3. Consultas a la Base de Datos
        const recipesCollection = db.connection.collection('recipes');

        // Obtenemos las recetas para la página actual aplicando filtros y paginación
        const recipes = await recipesCollection.find(filter)
            .skip(skip)
            .limit(pageSize)
            .toArray();

        // Obtenemos el número total de recetas que coinciden con el filtro para calcular las páginas
        const totalRecipes = await recipesCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalRecipes / pageSize);

        // 4. Renderizar la vista pasando todos los datos necesarios
        res.render('index', {
            recipes: recipes,
            currentPage: page,
            totalPages: totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            searchQuery: searchQuery, // Para mantener el valor en el buscador
            categoryQuery: categoryQuery // Para saber qué categoría está activa
        });

    } catch (error) {
        console.error("❌ Error al obtener las recetas:", error);
        res.status(500).render('error', { errorMessage: "No se pudieron cargar las recetas del servidor." });
    }
});

// ... aquí irán otras rutas como /receta/nueva, etc.

export default router;
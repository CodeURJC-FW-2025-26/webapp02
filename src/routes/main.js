/* src/routes/main.js */

import express from 'express';
import { db } from '../database.js';
import { ObjectId } from 'mongodb';
import upload from '../multerConfig.js';

const router = express.Router();

let recipesCollection;

// Middleware: Ensure database collection is initialized
router.use((req, res, next) => {
    if (!recipesCollection) {
        recipesCollection = db.connection.collection('recipes');
    }
    next();
});

// =================================================================
//  GENERAL ROUTES & API
// =================================================================

/**
 * API: Check if a recipe title already exists (for AJAX validation)
 * Query Params: title (string), id (optional string to exclude current recipe)
 */
router.get('/api/check-title', async (req, res) => {
    try {
        const { title, id } = req.query;

        // Case-insensitive exact match
        const query = { name: { $regex: `^${title.trim()}$`, $options: 'i' } };

        // Exclude current recipe if editing
        if (id && ObjectId.isValid(id)) {
            query._id = { $ne: new ObjectId(id) };
        }

        const existingRecipe = await db.connection.collection('recipes').findOne(query);

        res.json({ exists: !!existingRecipe });
    } catch (error) {
        console.error("Error de validación del título:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

/**
 * HOME PAGE
 * Handles both HTML rendering and JSON data fetching (Infinite Scroll)
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 6;
        const skip = (page - 1) * pageSize;

        // Filter Configuration
        const filter = {};
        if (req.query.search) {
            filter.name = { $regex: req.query.search, $options: 'i' };
        }
        if (req.query.category) {
            filter.category = req.query.category;
        }

        // Fetch Data
        const recipes = await recipesCollection.find(filter)
            .skip(skip)
            .limit(pageSize)
            .toArray();

        const totalRecipes = await recipesCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalRecipes / pageSize);
        const nextPage = page < totalPages ? page + 1 : null;

        // --- JSON RESPONSE (Infinite Scroll) ---
        if (req.query.format === 'json') {
            return res.json({
                recipes: recipes,
                nextPage: nextPage
            });
        }

        // --- HTML RESPONSE (Initial Load) ---

        // Classic Pagination Logic (Fallback / SEO)
        const pagesForTemplate = [];
        const window = 2;
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
                    pagesForTemplate.push({ page: i, isCurrent: i === page, isEllipsis: false });
                } else if (pagesForTemplate.length > 0 && pagesForTemplate[pagesForTemplate.length - 1].page < i - 1) {
                    if (!pagesForTemplate[pagesForTemplate.length - 1].isEllipsis) {
                        pagesForTemplate.push({ isEllipsis: true });
                    }
                }
            }
        }

        // Active Category Logic
        const categoryStates = {
            all: !req.query.category,
            entrante: req.query.category === 'entrante',
            principal: req.query.category === 'principal',
            postre: req.query.category === 'postre',
            vegano: req.query.category === 'vegano'
        };

        res.render('index', {
            recipes,
            currentPage: page,
            totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            searchQuery: req.query.search,
            categoryQuery: req.query.category,
            pagesForTemplate,
            categoryStates,
            initialNextPage: nextPage // Critical for client.js infinite scroll start point
        });

    } catch (error) {
        console.error("❌ Error al obtener las recetas:", error);
        if (req.query.format === 'json') {
            return res.status(500).json({ error: "Error interno del servidor" });
        }
        res.status(500).render('error', {
            errorMessage: "No se pudieron cargar recetas desde el servidor.",
            backUrl: '/',
            backUrlText: 'Volver al inicio'
        });
    }
});

/**
 * GENERIC ERROR PAGE
 */
router.get('/error', (req, res) => {
    const errorMessage = req.session.errorMessage;
    const backUrl = req.session.backUrl;

    delete req.session.errorMessage;
    delete req.session.backUrl;

    if (!errorMessage) return res.redirect('/');

    res.render('error', {
        errorMessage,
        backUrl: backUrl || '/',
        backUrlText: 'Volver'
    });
});

// =================================================================
//  RECIPE MANAGEMENT ROUTES
// =================================================================

/**
 * FORM: New Recipe
 */
router.get('/receta/nueva', (req, res) => {
    const formData = req.session.formData;
    delete req.session.formData;

    const recipeData = formData || {};

    // Helper properties for Select inputs
    if (recipeData.category) {
        recipeData[`isCategory${recipeData.category.charAt(0).toUpperCase() + recipeData.category.slice(1)}`] = true;
    }
    if (recipeData.difficulty) {
        recipeData[`isDifficulty${recipeData.difficulty.charAt(0).toUpperCase() + recipeData.difficulty.slice(1)}`] = true;
    }

    const recipe = {
        name: recipeData.recipeName,
        description: recipeData.description,
        ingredients: recipeData.ingredients,
        preparation_time: recipeData.preparationTime,
        ...recipeData
    };

    res.render('AñadirReceta', { recipe });
});

/**
 * ACTION: Create New Recipe
 * Returns JSON for AJAX handling
 */
router.post('/receta/nueva', upload.single('recipeImage'), async (req, res) => {
    try {
        const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;

        // 1. Server-Side Validation
        if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
        }

        if (recipeName.trim()[0] !== recipeName.trim()[0].toUpperCase()) {
            return res.status(400).json({ success: false, message: 'El nombre de la receta debe comenzar con una letra mayúscula.' });
        }

        if (description.trim().length < 20 || description.trim().length > 500) {
            return res.status(400).json({ success: false, message: 'La descripción debe tener entre 20 y 500 caracteres.' });
        }

        if (isNaN(preparationTime) || parseInt(preparationTime) <= 0) {
            return res.status(400).json({ success: false, message: 'El tiempo de preparación debe ser un número positivo.' });
        }

        const existingRecipe = await db.connection.collection('recipes').findOne({
            name: { $regex: `^${recipeName.trim()}$`, $options: 'i' }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `Ya existe una receta con el nombre "${recipeName}"` });
        }

        // 2. Object Creation
        const newRecipe = {
            name: recipeName.trim(),
            description: description.trim(),
            ingredients: ingredients,
            category: category,
            difficulty: difficulty,
            preparation_time: parseInt(preparationTime),
            image: req.file ? req.file.filename : 'logo.jpg',
            steps: []
        };

        // 3. Database Insertion
        const result = await db.connection.collection('recipes').insertOne(newRecipe);

        // 4. Response
        res.json({
            success: true,
            message: `Receta "${newRecipe.name}" creada con éxito.`,
            redirectUrl: `/receta/${result.insertedId}`
        });

    } catch (error) {
        console.error("❌ Error al crear la receta:", error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

/**
 * VIEW: Recipe Details
 */
router.get('/receta/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(404).render('error', { errorMessage: 'ID de receta no válida.' });
        }

        const recipe = await recipesCollection.findOne({ _id: new ObjectId(req.params.id) });

        if (recipe) {
            // Inject recipe_id into each step for easier templating
            if (recipe.steps) {
                recipe.steps.forEach(step => {
                    step.recipe_id = recipe._id;
                });
            }
            res.render('detalleReceta', { recipe });
        } else {
            res.status(404).render('error', { errorMessage: 'Receta no encontrada.' });
        }
    } catch (error) {
        console.error("❌ Error al obtener los detalles de la receta:", error);
        res.status(500).render('error', { errorMessage: "Error Interno del Servidor." });
    }
});

/**
 * FORM: Edit Recipe
 */
router.get('/receta/editar/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(404).render('error', { errorMessage: 'ID no válida' });

        const recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(req.params.id) });

        if (recipe) {
            // Helpers
            if (recipe.category) recipe[`isCategory${recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1)}`] = true;
            if (recipe.difficulty) recipe[`isDifficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`] = true;

            res.render('AñadirReceta', { recipe, editing: true });
        } else {
            res.status(404).render('error', { errorMessage: 'Receta no encontrada para editar.' });
        }
    } catch (error) {
        console.error("❌ Error al obtener la receta para editar:", error);
        res.status(500).render('error', { errorMessage: 'Error Interno del Servidor.' });
    }
});

/**
 * ACTION: Update Recipe
 */
router.post('/receta/editar/:id', upload.single('recipeImage'), async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;

        if (!ObjectId.isValid(recipeId)) return res.status(400).json({ success: false, message: 'ID no válida.' });

        // Validations
        if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
        }
        if (recipeName.trim()[0] !== recipeName.trim()[0].toUpperCase()) {
            return res.status(400).json({ success: false, message: 'El nombre debe comenzar con mayúscula.' });
        }
        if (description.trim().length < 20 || description.trim().length > 500) {
            return res.status(400).json({ success: false, message: 'Longitud de descripción no válida (20-500 caracteres).' });
        }
        if (isNaN(preparationTime) || parseInt(preparationTime) <= 0) {
            return res.status(400).json({ success: false, message: 'Tiempo no válido.' });
        }

        // Unique Name Check (excluding current)
        const existingRecipe = await db.connection.collection('recipes').findOne({
            name: { $regex: `^${recipeName.trim()}$`, $options: 'i' },
            _id: { $ne: new ObjectId(recipeId) }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `El nombre "${recipeName}" ya está en uso.` });
        }

        const updateData = {
            name: recipeName.trim(),
            description: description.trim(),
            ingredients: ingredients,
            category: category,
            difficulty: difficulty,
            preparation_time: parseInt(preparationTime)
        };

        if (req.file) {
            updateData.image = req.file.filename;
        }

        await db.connection.collection('recipes').updateOne(
            { _id: new ObjectId(recipeId) },
            { $set: updateData }
        );

        res.json({
            success: true,
            message: 'Receta actualizada con éxito.',
            redirectUrl: `/receta/${recipeId}`
        });

    } catch (error) {
        console.error("❌ Error al actualizar la receta:", error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

/**
 * ACTION: Delete Recipe
 */
router.post('/receta/borrar/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;
        if (!ObjectId.isValid(recipeId)) return res.status(400).json({ success: false, message: 'ID no válida' });

        const result = await recipesCollection.deleteOne({ _id: new ObjectId(recipeId) });

        if (result.deletedCount === 1) {
            res.json({ success: true, message: 'Receta eliminada.', redirectUrl: '/' });
        } else {
            res.status(404).json({ success: false, message: 'Receta no encontrada.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

// =================================================================
//  STEP MANAGEMENT ROUTES (Secondary Entity)
// =================================================================

/**
 * ACTION: Add New Step
 */
router.post('/receta/:id/paso/nuevo', async (req, res) => {
    const recipeId = req.params.id;
    try {
        const { stepName, stepDescription } = req.body;

        if (!stepName || !stepDescription) {
            return res.status(400).json({ success: false, message: 'Faltan datos del paso.' });
        }

        const newStep = {
            _id: new ObjectId(),
            name: stepName.trim(),
            description: stepDescription.trim()
        };

        const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) }, { projection: { steps: 1 } });
        newStep.order = (recipe.steps || []).length + 1;

        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) },
            { $push: { steps: newStep } }
        );

        // Return the created step object for dynamic DOM insertion
        res.json({
            success: true,
            message: 'Paso añadido exitosamente.',
            step: newStep,
            recipeId: recipeId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

/**
 * ACTION: Delete Step
 */
router.post('/receta/:id/paso/borrar/:stepId', async (req, res) => {
    const { id, stepId } = req.params;
    try {
        await recipesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $pull: { steps: { _id: new ObjectId(stepId) } } }
        );
        res.json({ success: true, message: 'Paso eliminado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar el paso.' });
    }
});

/**
 * FORM: Edit Step (Fallback for direct URL access, mostly handled inline via AJAX)
 */
router.get('/receta/:id/paso/editar/:stepId', async (req, res) => {
    const { id, stepId } = req.params;
    try {
        const recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(id) });
        if (!recipe) return res.status(404).render('error', { errorMessage: 'Receta no encontrada.' });

        const step = recipe.steps ? recipe.steps.find(s => s._id.toString() === stepId) : null;

        if (!step) return res.status(404).render('error', { errorMessage: 'Paso no encontrado.' });

        res.render('editarPaso', { recipe, step });

    } catch (error) {
        console.error("Error al buscar el paso:", error);
        res.status(500).render('error', { errorMessage: 'Error Interno del Servidor.' });
    }
});

/**
 * ACTION: Update Step (Used by Inline Edit)
 */
router.post('/receta/:id/paso/editar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;
        const { stepName, stepDescription } = req.body;

        if (!stepName || !stepDescription || stepName.trim() === '' || stepDescription.trim() === '') {
            return res.status(400).json({ success: false, message: 'Datos incompletos.' });
        }

        await recipesCollection.updateOne(
            { _id: new ObjectId(id), "steps._id": new ObjectId(stepId) },
            {
                $set: {
                    "steps.$.name": stepName.trim(),
                    "steps.$.description": stepDescription.trim()
                }
            }
        );

        res.json({
            success: true,
            message: 'Paso actualizado exitosamente.',
            step: {
                name: stepName.trim(),
                description: stepDescription.trim()
            }
        });

    } catch (error) {
        console.error("Error al actualizar el paso:", error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

export default router;
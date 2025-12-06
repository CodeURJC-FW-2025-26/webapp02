/* webapp02/src/routes/main.js */

import express from 'express';
import { db } from '../database.js';
import { ObjectId } from 'mongodb';
import upload from '../multerConfig.js';

const router = express.Router();
const PAGE_SIZE = 6; // Number of items per page for pagination/infinite scroll

// Cache for the collection reference
let recipesCollection;

/**
 * Middleware: Database Initialization Check
 * Ensures the database connection is active before processing requests.
 */
router.use((req, res, next) => {
    if (!recipesCollection) {
        recipesCollection = db.connection.collection('recipes');
    }
    next();
});

// =================================================================
//  HELPER FUNCTIONS
// =================================================================

/**
 * Validates recipe input data.
 * @param {object} body - The request body containing form data.
 * @returns {object} - { valid: boolean, message: string|null }
 */
function validateRecipeInput(body) {
    const { recipeName, description, ingredients, category, difficulty, preparationTime } = body;

    if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
        return { valid: false, message: 'Todos los campos son obligatorios.' };
    }

    const nameTrimmed = recipeName.trim();
    if (nameTrimmed.length === 0 || nameTrimmed[0] !== nameTrimmed[0].toUpperCase()) {
        return { valid: false, message: 'El nombre debe comenzar con una letra mayúscula.' };
    }

    const descTrimmed = description.trim();
    if (descTrimmed.length < 20 || descTrimmed.length > 500) {
        return { valid: false, message: 'La descripción debe tener entre 20 y 500 caracteres.' };
    }

    const time = parseInt(preparationTime);
    if (isNaN(time) || time <= 0) {
        return { valid: false, message: 'El tiempo de preparación debe ser un número positivo.' };
    }

    return { valid: true, message: null };
}

// =================================================================
//  GENERAL ROUTES & API
// =================================================================

/**
 * API: Check if a recipe title exists.
 * Used for asynchronous client-side validation.
 */
router.get('/api/check-title', async (req, res) => {
    try {
        const { title, id } = req.query;

        // Regex for case-insensitive exact match
        const query = { name: { $regex: `^${title.trim()}$`, $options: 'i' } };

        // Exclude current ID if we are in "Edit" mode
        if (id && ObjectId.isValid(id)) {
            query._id = { $ne: new ObjectId(id) };
        }

        const existingRecipe = await recipesCollection.findOne(query);
        res.json({ exists: !!existingRecipe });

    } catch (error) {
        console.error("Server Error (Check Title):", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * HOME PAGE (Index)
 * Supports both standard HTML rendering and JSON responses for Infinite Scroll.
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * PAGE_SIZE;

        // Build Search Filter
        const filter = {};
        if (req.query.search) {
            filter.name = { $regex: req.query.search, $options: 'i' };
        }
        if (req.query.category) {
            filter.category = req.query.category;
        }

        // Execute Queries
        const [recipes, totalRecipes] = await Promise.all([
            recipesCollection.find(filter).skip(skip).limit(PAGE_SIZE).toArray(),
            recipesCollection.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalRecipes / PAGE_SIZE);
        const nextPage = page < totalPages ? page + 1 : null;

        // --- JSON Mode (AJAX Infinite Scroll) ---
        if (req.query.format === 'json') {
            return res.json({ recipes, nextPage });
        }

        // --- HTML Mode (Initial Load) ---

        // Determine active category state for UI highlighting
        const categoryStates = {
            all: !req.query.category,
            entrante: req.query.category === 'entrante',
            principal: req.query.category === 'principal',
            postre: req.query.category === 'postre',
            vegano: req.query.category === 'vegano'
        };

        // Generate pagination logic for SEO/Fallback
        const pagesForTemplate = [];
        if (totalPages > 1) {
            // Logic to show limited page numbers (e.g., 1, ... 4, 5, 6 ...)
            const window = 2;
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
                    pagesForTemplate.push({ page: i, isCurrent: i === page, isEllipsis: false });
                } else if (pagesForTemplate.length > 0 && !pagesForTemplate[pagesForTemplate.length - 1].isEllipsis && pagesForTemplate[pagesForTemplate.length - 1].page < i - 1) {
                    pagesForTemplate.push({ isEllipsis: true });
                }
            }
        }

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
            initialNextPage: nextPage
        });

    } catch (error) {
        console.error("Server Error (Get Recipes):", error);
        if (req.query.format === 'json') {
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.status(500).render('error', {
            errorMessage: "No se pudieron cargar las recetas.",
            backUrl: '/',
            backUrlText: 'Volver al inicio'
        });
    }
});

/**
 * GENERIC ERROR PAGE HANDLER
 * Displays errors stored in session (Flash pattern).
 */
router.get('/error', (req, res) => {
    const { errorMessage, backUrl } = req.session;

    // Clear session errors after reading
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
//  RECIPE MANAGEMENT ROUTES (CRUD)
// =================================================================

/**
 * GET: Create Recipe Form
 */
router.get('/receta/nueva', (req, res) => {
    const formData = req.session.formData || {};
    delete req.session.formData; // Clear temp data

    // Helper for selecting dropdowns in the template
    const recipeData = {
        ...formData,
        [`isCategory${(formData.category || '').charAt(0).toUpperCase() + (formData.category || '').slice(1)}`]: true,
        [`isDifficulty${(formData.difficulty || '').charAt(0).toUpperCase() + (formData.difficulty || '').slice(1)}`]: true
    };

    // Map fields to match edit structure
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
 * POST: Create Recipe Logic
 */
router.post('/receta/nueva', upload.single('recipeImage'), async (req, res) => {
    try {
        // 1. Validate Input
        const validation = validateRecipeInput(req.body);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: validation.message });
        }

        const { recipeName } = req.body;

        // 2. Check Duplicate (Double check on server side)
        const existingRecipe = await recipesCollection.findOne({
            name: { $regex: `^${recipeName.trim()}$`, $options: 'i' }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `Ya existe una receta con el nombre "${recipeName}".` });
        }

        // 3. Construct Object
        const newRecipe = {
            name: recipeName.trim(),
            description: req.body.description.trim(),
            ingredients: req.body.ingredients,
            category: req.body.category,
            difficulty: req.body.difficulty,
            preparation_time: parseInt(req.body.preparationTime),
            image: req.file ? req.file.filename : 'logo.jpg', // Default image
            steps: []
        };

        // 4. Insert
        const result = await recipesCollection.insertOne(newRecipe);

        res.json({
            success: true,
            message: `Receta "${newRecipe.name}" creada con éxito.`,
            redirectUrl: `/receta/${result.insertedId}`
        });

    } catch (error) {
        console.error("Server Error (Create Recipe):", error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

/**
 * GET: Recipe Details View
 */
router.get('/receta/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(404).render('error', { errorMessage: 'ID de receta no válida.' });
        }

        const recipe = await recipesCollection.findOne({ _id: new ObjectId(req.params.id) });

        if (!recipe) {
            return res.status(404).render('error', { errorMessage: 'Receta no encontrada.' });
        }

        // Inject recipe_id into steps for template navigation
        if (recipe.steps) {
            recipe.steps.forEach(step => step.recipe_id = recipe._id);
        }

        res.render('detalleReceta', { recipe });

    } catch (error) {
        console.error("Server Error (Get Recipe Detail):", error);
        res.status(500).render('error', { errorMessage: "Error Interno del Servidor." });
    }
});

/**
 * GET: Edit Recipe Form
 */
router.get('/receta/editar/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(404).render('error', { errorMessage: 'ID no válida' });

        const recipe = await recipesCollection.findOne({ _id: new ObjectId(req.params.id) });

        if (!recipe) return res.status(404).render('error', { errorMessage: 'Receta no encontrada.' });

        // Template helpers for Select boxes
        if (recipe.category) recipe[`isCategory${recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1)}`] = true;
        if (recipe.difficulty) recipe[`isDifficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`] = true;

        res.render('AñadirReceta', { recipe, editing: true });

    } catch (error) {
        console.error("Server Error (Edit Form):", error);
        res.status(500).render('error', { errorMessage: 'Error Interno del Servidor.' });
    }
});

/**
 * POST: Update Recipe Logic
 * Handles updates including file uploads and image deletion flag.
 */
router.post('/receta/editar/:id', upload.single('recipeImage'), async (req, res) => {
    try {
        const recipeId = req.params.id;
        if (!ObjectId.isValid(recipeId)) return res.status(400).json({ success: false, message: 'ID no válida.' });

        // 1. Validate Input
        const validation = validateRecipeInput(req.body);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: validation.message });
        }

        // 2. Check Duplicate Name (Exclude self)
        const existingRecipe = await recipesCollection.findOne({
            name: { $regex: `^${req.body.recipeName.trim()}$`, $options: 'i' },
            _id: { $ne: new ObjectId(recipeId) }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `El nombre "${req.body.recipeName}" ya está en uso.` });
        }

        // 3. Prepare Update Data
        const updateData = {
            name: req.body.recipeName.trim(),
            description: req.body.description.trim(),
            ingredients: req.body.ingredients,
            category: req.body.category,
            difficulty: req.body.difficulty,
            preparation_time: parseInt(req.body.preparationTime)
        };

        // --- IMPROVED IMAGE LOGIC ---
        if (req.file) {
            // Case A: New file uploaded -> Replace image
            updateData.image = req.file.filename;
        } else if (req.body.removeImageFlag === "true") {
            // Case B: User requested deletion -> Reset to default
            updateData.image = 'logo.jpg';
        }
        // Case C: No file + Flag false -> Keep existing image (Do nothing)

        // 4. Perform Update
        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) },
            { $set: updateData }
        );

        res.json({
            success: true,
            message: 'Receta actualizada con éxito.',
            redirectUrl: `/receta/${recipeId}`
        });

    } catch (error) {
        console.error("Server Error (Update Recipe):", error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

/**
 * POST: Delete Recipe Logic
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
        console.error("Server Error (Delete Recipe):", error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

// =================================================================
//  STEP MANAGEMENT ROUTES (Secondary Entity)
// =================================================================

/**
 * POST: Add New Step
 */
router.post('/receta/:id/paso/nuevo', async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { stepName, stepDescription } = req.body;

        if (!stepName || !stepDescription) {
            return res.status(400).json({ success: false, message: 'Faltan datos del paso.' });
        }

        const newStep = {
            _id: new ObjectId(),
            name: stepName.trim(),
            description: stepDescription.trim()
        };

        // Calculate Order (Append to end)
        const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) }, { projection: { steps: 1 } });
        newStep.order = (recipe.steps || []).length + 1;

        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) },
            { $push: { steps: newStep } }
        );

        res.json({
            success: true,
            message: 'Paso añadido exitosamente.',
            step: newStep,
            recipeId: recipeId
        });

    } catch (error) {
        console.error("Server Error (Add Step):", error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

/**
 * POST: Delete Step
 */
router.post('/receta/:id/paso/borrar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;

        await recipesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $pull: { steps: { _id: new ObjectId(stepId) } } }
        );

        res.json({ success: true, message: 'Paso eliminado.' });
    } catch (error) {
        console.error("Server Error (Delete Step):", error);
        res.status(500).json({ success: false, message: 'Error al eliminar el paso.' });
    }
});

/**
 * GET: Edit Step Form (Fallback/Direct Access)
 */
router.get('/receta/:id/paso/editar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;
        const recipe = await recipesCollection.findOne({ _id: new ObjectId(id) });

        if (!recipe) return res.status(404).render('error', { errorMessage: 'Receta no encontrada.' });

        const step = recipe.steps ? recipe.steps.find(s => s._id.toString() === stepId) : null;
        if (!step) return res.status(404).render('error', { errorMessage: 'Paso no encontrado.' });

        res.render('editarPaso', { recipe, step });

    } catch (error) {
        console.error("Server Error (Get Step Form):", error);
        res.status(500).render('error', { errorMessage: 'Error Interno del Servidor.' });
    }
});

/**
 * POST: Update Step Logic
 */
router.post('/receta/:id/paso/editar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;
        const { stepName, stepDescription } = req.body;

        if (!stepName?.trim() || !stepDescription?.trim()) {
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
        console.error("Server Error (Update Step):", error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor.' });
    }
});

export default router;
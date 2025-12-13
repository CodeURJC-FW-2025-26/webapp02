/* webapp02/src/routes/main.js */

import express from 'express';
import { db } from '../database.js';
import { ObjectId } from 'mongodb';
import upload from '../multerConfig.js';
import { unlink } from 'fs/promises'; // Module to delete files
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const PAGE_SIZE = 6;

// Cache for the collection reference
let recipesCollection;

// =================================================================
//  LOCALIZATION CONSTANTS (SERVER MESSAGES)
// =================================================================
const SERVER_MESSAGES = {
    VALIDATION: {
        REQUIRED_FIELDS: 'Todos los campos son obligatorios.',
        NAME_CAPITAL: 'El nombre debe comenzar con una letra mayúscula.',
        DESC_LENGTH: 'La descripción debe tener entre 20 y 500 caracteres.',
        TIME_POSITIVE: 'El tiempo de preparación debe ser un número positivo.',
        DUPLICATE_PREFIX: 'Ya existe una receta con el nombre',
        NAME_IN_USE_SUFFIX: 'ya está en uso.'
    },
    SUCCESS: {
        RECIPE_CREATED_SUFFIX: 'creada con éxito.',
        RECIPE_UPDATED: 'Receta actualizada con éxito.',
        RECIPE_DELETED: 'Receta eliminada.',
        STEP_ADDED: 'Paso añadido exitosamente.',
        STEP_DELETED: 'Paso eliminado.',
        STEP_UPDATED: 'Paso actualizado exitosamente.'
    },
    ERRORS: {
        INTERNAL: 'Error Interno del Servidor.',
        LOAD_RECIPES: 'No se pudieron cargar las recetas.',
        INVALID_ID: 'ID de receta no válida.',
        INVALID_ID_SHORT: 'ID no válida.',
        RECIPE_NOT_FOUND: 'Receta no encontrada.',
        STEP_NOT_FOUND: 'Paso no encontrado.',
        MISSING_STEP_DATA: 'Faltan datos del paso.',
        DATA_INCOMPLETE: 'Datos incompletos.',
        DELETE_STEP_ERROR: 'Error al eliminar el paso.'
    },
    UI: {
        BACK_HOME: 'Volver al inicio',
        BACK: 'Volver'
    }
};

/**
 * Middleware: Database Initialization Check
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
 * Helper to physically delete an image from the server.
 * Prevents deleting the default 'logo.jpg'.
 * @param {string} filename 
 */
async function deleteImageFile(filename) {
    if (!filename || filename === 'logo.jpg' || filename === 'vacio.jpg') return; // Protect default image

    try {
        // Construct path: src/routes/../../uploads -> root/uploads
        const filePath = join(__dirname, '../../uploads', filename);
        await unlink(filePath);
        console.log(`[File System] Deleted old image: ${filename}`);
    } catch (error) {
        // Log warning but don't crash app if file is missing
        console.warn(`[File System] Warning: Could not delete image ${filename}: ${error.message}`);
    }
}

/**
 * Validates recipe input data.
 */
function validateRecipeInput(body) {
    const { recipeName, description, ingredients, category, difficulty, preparationTime } = body;

    if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
        return { valid: false, message: SERVER_MESSAGES.VALIDATION.REQUIRED_FIELDS };
    }

    const nameTrimmed = recipeName.trim();
    if (nameTrimmed.length === 0 || nameTrimmed[0] !== nameTrimmed[0].toUpperCase()) {
        return { valid: false, message: SERVER_MESSAGES.VALIDATION.NAME_CAPITAL };
    }

    const descTrimmed = description.trim();
    if (descTrimmed.length < 20 || descTrimmed.length > 500) {
        return { valid: false, message: SERVER_MESSAGES.VALIDATION.DESC_LENGTH };
    }

    const time = parseInt(preparationTime);
    if (isNaN(time) || time <= 0) {
        return { valid: false, message: SERVER_MESSAGES.VALIDATION.TIME_POSITIVE };
    }

    return { valid: true, message: null };
}

// =================================================================
//  GENERAL ROUTES & API
// =================================================================

/**
 * API: Check if a recipe title exists.
 */
router.get('/api/check-title', async (req, res) => {
    try {
        const { title, id } = req.query;
        const query = { name: { $regex: `^${title.trim()}$`, $options: 'i' } };

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
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * PAGE_SIZE;

        const filter = {};
        if (req.query.search) {
            filter.name = { $regex: req.query.search, $options: 'i' };
        }
        if (req.query.category) {
            filter.category = req.query.category;
        }

        const [recipes, totalRecipes] = await Promise.all([
            recipesCollection.find(filter).skip(skip).limit(PAGE_SIZE).toArray(),
            recipesCollection.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalRecipes / PAGE_SIZE);
        const nextPage = page < totalPages ? page + 1 : null;

        if (req.query.format === 'json') {
            return res.json({ recipes, nextPage });
        }

        const categoryStates = {
            all: !req.query.category,
            entrante: req.query.category === 'entrante',
            principal: req.query.category === 'principal',
            postre: req.query.category === 'postre',
            vegano: req.query.category === 'vegano'
        };

        res.render('index', {
            recipes,
            searchQuery: req.query.search,
            categoryQuery: req.query.category,
            categoryStates,
            initialNextPage: nextPage
        });

    } catch (error) {
        console.error("Server Error (Get Recipes):", error);
        if (req.query.format === 'json') {
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.status(500).render('error', {
            errorMessage: SERVER_MESSAGES.ERRORS.LOAD_RECIPES,
            backUrl: '/',
            backUrlText: SERVER_MESSAGES.UI.BACK_HOME
        });
    }
});

/**
 * GENERIC ERROR PAGE HANDLER
 */
router.get('/error', (req, res) => {
    const { errorMessage, backUrl } = req.session;
    delete req.session.errorMessage;
    delete req.session.backUrl;

    if (!errorMessage) return res.redirect('/');

    res.render('error', {
        errorMessage,
        backUrl: backUrl || '/',
        backUrlText: SERVER_MESSAGES.UI.BACK
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
    delete req.session.formData;

    const recipeData = {
        ...formData,
        [`isCategory${(formData.category || '').charAt(0).toUpperCase() + (formData.category || '').slice(1)}`]: true,
        [`isDifficulty${(formData.difficulty || '').charAt(0).toUpperCase() + (formData.difficulty || '').slice(1)}`]: true
    };

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
        const validation = validateRecipeInput(req.body);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: validation.message });
        }

        const { recipeName } = req.body;
        const existingRecipe = await recipesCollection.findOne({
            name: { $regex: `^${recipeName.trim()}$`, $options: 'i' }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `${SERVER_MESSAGES.VALIDATION.DUPLICATE_PREFIX} "${recipeName}".` });
        }

        const newRecipe = {
            name: recipeName.trim(),
            description: req.body.description.trim(),
            ingredients: req.body.ingredients,
            category: req.body.category,
            difficulty: req.body.difficulty,
            preparation_time: parseInt(req.body.preparationTime),
            image: req.file ? req.file.filename : 'vacio.jpg',
            steps: []
        };

        const result = await recipesCollection.insertOne(newRecipe);

        res.json({
            success: true,
            message: `Receta "${newRecipe.name}" ${SERVER_MESSAGES.SUCCESS.RECIPE_CREATED_SUFFIX}`,
            redirectUrl: `/receta/${result.insertedId}`
        });

    } catch (error) {
        console.error("Server Error (Create Recipe):", error);
        res.status(500).json({ success: false, message: SERVER_MESSAGES.ERRORS.INTERNAL });
    }
});

/**
 * GET: Recipe Details View
 */
router.get('/receta/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(404).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.INVALID_ID });
        }

        const recipe = await recipesCollection.findOne({ _id: new ObjectId(req.params.id) });

        if (!recipe) {
            return res.status(404).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.RECIPE_NOT_FOUND });
        }

        if (recipe.steps) {
            recipe.steps.forEach(step => step.recipe_id = recipe._id);
        }

        res.render('detalleReceta', { recipe });

    } catch (error) {
        console.error("Server Error (Get Recipe Detail):", error);
        res.status(500).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.INTERNAL });
    }
});

/**
 * GET: Edit Recipe Form
 */
router.get('/receta/editar/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(404).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.INVALID_ID_SHORT });

        const recipe = await recipesCollection.findOne({ _id: new ObjectId(req.params.id) });

        if (!recipe) return res.status(404).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.RECIPE_NOT_FOUND });

        if (recipe.category) recipe[`isCategory${recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1)}`] = true;
        if (recipe.difficulty) recipe[`isDifficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`] = true;

        res.render('AñadirReceta', { recipe, editing: true });

    } catch (error) {
        console.error("Server Error (Edit Form):", error);
        res.status(500).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.INTERNAL });
    }
});

/**
 * POST: Update Recipe Logic
 * Handles updates including file uploads and deletion of old images.
 */
router.post('/receta/editar/:id', upload.single('recipeImage'), async (req, res) => {
    try {
        const recipeId = req.params.id;
        if (!ObjectId.isValid(recipeId)) return res.status(400).json({ success: false, message: SERVER_MESSAGES.ERRORS.INVALID_ID_SHORT });

        // 1. Fetch current recipe FIRST (to know what the old image was)
        const currentRecipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) });
        if (!currentRecipe) return res.status(404).json({ success: false, message: SERVER_MESSAGES.ERRORS.RECIPE_NOT_FOUND });

        // 2. Validate Input
        const validation = validateRecipeInput(req.body);
        if (!validation.valid) {
            // If an image was uploaded but the form is invalid, it deletes it
            if (req.file) await deleteImageFile(req.file.filename);
            return res.status(400).json({ success: false, message: validation.message });
        }

        // 3. Check Duplicate Name (Exclude self)
        const existingRecipe = await recipesCollection.findOne({
            name: { $regex: `^${req.body.recipeName.trim()}$`, $options: 'i' },
            _id: { $ne: new ObjectId(recipeId) }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `El nombre "${req.body.recipeName}" ${SERVER_MESSAGES.VALIDATION.NAME_IN_USE_SUFFIX}` });
        }

        // 4. Prepare Update Data
        const updateData = {
            name: req.body.recipeName.trim(),
            description: req.body.description.trim(),
            ingredients: req.body.ingredients,
            category: req.body.category,
            difficulty: req.body.difficulty,
            preparation_time: parseInt(req.body.preparationTime)
        };

        // 5. Image Logic & Cleanup
        let oldImageToDelete = null;

        if (req.file) {
            // Case A: New file uploaded -> Replace image & mark old for deletion
            updateData.image = req.file.filename;
            oldImageToDelete = currentRecipe.image;
        } else if (req.body.removeImageFlag === "true") {
            // Case B: User requested deletion -> Reset to default & mark old for deletion
            updateData.image = 'vacio.jpg';
            oldImageToDelete = currentRecipe.image;
        }
        // Case C: No change -> Keep existing image

        // 6. Perform Update
        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) },
            { $set: updateData }
        );

        // 7. Delete old image physically (if exists and is not default)
        if (oldImageToDelete) {
            await deleteImageFile(oldImageToDelete);
        }

        res.json({
            success: true,
            message: SERVER_MESSAGES.SUCCESS.RECIPE_UPDATED,
            redirectUrl: `/receta/${recipeId}`
        });

    } catch (error) {
        console.error("Server Error (Update Recipe):", error);
        res.status(500).json({ success: false, message: SERVER_MESSAGES.ERRORS.INTERNAL });
    }
});

/**
 * POST: Delete Recipe Logic
 * Deletes the recipe from DB and removes the associated image file.
 */
router.post('/receta/borrar/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;
        if (!ObjectId.isValid(recipeId)) return res.status(400).json({ success: false, message: SERVER_MESSAGES.ERRORS.INVALID_ID_SHORT });

        // 1. Find recipe to get image name
        const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) });

        if (recipe) {
            // 2. Delete from DB
            await recipesCollection.deleteOne({ _id: new ObjectId(recipeId) });

            // 3. Delete image from disk
            if (recipe.image) {
                await deleteImageFile(recipe.image);
            }

            res.json({ success: true, message: SERVER_MESSAGES.SUCCESS.RECIPE_DELETED, redirectUrl: '/' });
        } else {
            res.status(404).json({ success: false, message: SERVER_MESSAGES.ERRORS.RECIPE_NOT_FOUND });
        }
    } catch (error) {
        console.error("Server Error (Delete Recipe):", error);
        res.status(500).json({ success: false, message: SERVER_MESSAGES.ERRORS.INTERNAL });
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
            return res.status(400).json({ success: false, message: SERVER_MESSAGES.ERRORS.MISSING_STEP_DATA });
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

        res.json({
            success: true,
            message: SERVER_MESSAGES.SUCCESS.STEP_ADDED,
            step: newStep,
            recipeId: recipeId
        });

    } catch (error) {
        console.error("Server Error (Add Step):", error);
        res.status(500).json({ success: false, message: SERVER_MESSAGES.ERRORS.INTERNAL });
    }
});

/**
 * POST: Delete Step
 */
router.post('/receta/:id/paso/borrar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;

        if (!ObjectId.isValid(id) || !ObjectId.isValid(stepId)){
            return res.status(400).json({ success: false, message: SERVER_MESSAGES.ERRORS.INVALID_ID});
        }

       const result = await recipesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $pull: { steps: { _id: new ObjectId(stepId) } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({success:false, message:SERVER_MESSAGES.ERRORS.STEP_NOT_FOUND});
        }

        res.json({ success: true, message: SERVER_MESSAGES.SUCCESS.STEP_DELETED });
    } catch (error) {
        console.error("Server Error (Delete Step):", error);
        res.status(500).json({ success: false, message: SERVER_MESSAGES.ERRORS.DELETE_STEP_ERROR });
    }
});

/**
 * GET: Edit Step Form (Fallback/Direct Access)
 */
router.get('/receta/:id/paso/editar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;
        const recipe = await recipesCollection.findOne({ _id: new ObjectId(id) });

        if (!recipe) return res.status(404).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.RECIPE_NOT_FOUND });

        const step = recipe.steps ? recipe.steps.find(s => s._id.toString() === stepId) : null;
        if (!step) return res.status(404).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.STEP_NOT_FOUND });

        res.render('editarPaso', { recipe, step });

    } catch (error) {
        console.error("Server Error (Get Step Form):", error);
        res.status(500).render('error', { errorMessage: SERVER_MESSAGES.ERRORS.INTERNAL });
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
            return res.status(400).json({ success: false, message: SERVER_MESSAGES.ERRORS.DATA_INCOMPLETE });
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
            message: SERVER_MESSAGES.SUCCESS.STEP_UPDATED,
            step: {
                name: stepName.trim(),
                description: stepDescription.trim()
            }
        });

    } catch (error) {
        console.error("Server Error (Update Step):", error);
        res.status(500).json({ success: false, message: SERVER_MESSAGES.ERRORS.INTERNAL });
    }
});

export default router;
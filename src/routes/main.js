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
        console.error("Title validation error:", error);
        res.status(500).json({ error: 'Server error' });
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
        console.error("❌ Error fetching recipes:", error);
        if (req.query.format === 'json') {
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.status(500).render('error', {
            errorMessage: "Could not load recipes from server.",
            backUrl: '/',
            backUrlText: 'Back to Home'
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
        backUrlText: 'Go Back'
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
            return res.status(400).json({ success: false, message: 'All fields are mandatory.' });
        }

        if (recipeName.trim()[0] !== recipeName.trim()[0].toUpperCase()) {
            return res.status(400).json({ success: false, message: 'Recipe name must start with an uppercase letter.' });
        }

        if (description.trim().length < 20 || description.trim().length > 500) {
            return res.status(400).json({ success: false, message: 'Description must be between 20 and 500 characters.' });
        }

        if (isNaN(preparationTime) || parseInt(preparationTime) <= 0) {
            return res.status(400).json({ success: false, message: 'Preparation time must be a positive number.' });
        }

        const existingRecipe = await db.connection.collection('recipes').findOne({
            name: { $regex: `^${recipeName.trim()}$`, $options: 'i' }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `A recipe with the name "${recipeName}" already exists.` });
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
            message: `Recipe "${newRecipe.name}" created successfully.`,
            redirectUrl: `/receta/${result.insertedId}`
        });

    } catch (error) {
        console.error("❌ Error creating recipe:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error.' });
    }
});

/**
 * VIEW: Recipe Details
 */
router.get('/receta/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(404).render('error', { errorMessage: 'Invalid Recipe ID.' });
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
            res.status(404).render('error', { errorMessage: 'Recipe not found.' });
        }
    } catch (error) {
        console.error("❌ Error fetching recipe details:", error);
        res.status(500).render('error', { errorMessage: "Internal Server Error." });
    }
});

/**
 * FORM: Edit Recipe
 */
router.get('/receta/editar/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(404).render('error', { errorMessage: 'Invalid ID' });

        const recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(req.params.id) });

        if (recipe) {
            // Helpers
            if (recipe.category) recipe[`isCategory${recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1)}`] = true;
            if (recipe.difficulty) recipe[`isDifficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`] = true;

            res.render('AñadirReceta', { recipe, editing: true });
        } else {
            res.status(404).render('error', { errorMessage: 'Recipe not found for editing.' });
        }
    } catch (error) {
        console.error("❌ Error fetching recipe for edit:", error);
        res.status(500).render('error', { errorMessage: 'Internal Server Error.' });
    }
});

/**
 * ACTION: Update Recipe
 */
router.post('/receta/editar/:id', upload.single('recipeImage'), async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;

        if (!ObjectId.isValid(recipeId)) return res.status(400).json({ success: false, message: 'Invalid ID.' });

        // Validations
        if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
            return res.status(400).json({ success: false, message: 'All fields are mandatory.' });
        }
        if (recipeName.trim()[0] !== recipeName.trim()[0].toUpperCase()) {
            return res.status(400).json({ success: false, message: 'Name must start with uppercase.' });
        }
        if (description.trim().length < 20 || description.trim().length > 500) {
            return res.status(400).json({ success: false, message: 'Description length invalid (20-500 chars).' });
        }
        if (isNaN(preparationTime) || parseInt(preparationTime) <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid time.' });
        }

        // Unique Name Check (excluding current)
        const existingRecipe = await db.connection.collection('recipes').findOne({
            name: { $regex: `^${recipeName.trim()}$`, $options: 'i' },
            _id: { $ne: new ObjectId(recipeId) }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `The name "${recipeName}" is already taken.` });
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
            message: 'Recipe updated successfully.',
            redirectUrl: `/receta/${recipeId}`
        });

    } catch (error) {
        console.error("❌ Error updating recipe:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error.' });
    }
});

/**
 * ACTION: Delete Recipe
 */
router.post('/receta/borrar/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;
        if (!ObjectId.isValid(recipeId)) return res.status(400).json({ success: false, message: 'Invalid ID' });

        const result = await recipesCollection.deleteOne({ _id: new ObjectId(recipeId) });

        if (result.deletedCount === 1) {
            res.json({ success: true, message: 'Recipe deleted.', redirectUrl: '/' });
        } else {
            res.status(404).json({ success: false, message: 'Recipe not found.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error.' });
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
            return res.status(400).json({ success: false, message: 'Missing step data.' });
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
            message: 'Step added successfully.',
            step: newStep,
            recipeId: recipeId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Error.' });
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
        res.json({ success: true, message: 'Step deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting step.' });
    }
});

/**
 * FORM: Edit Step (Fallback for direct URL access, mostly handled inline via AJAX)
 */
router.get('/receta/:id/paso/editar/:stepId', async (req, res) => {
    const { id, stepId } = req.params;
    try {
        const recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(id) });
        if (!recipe) return res.status(404).render('error', { errorMessage: 'Recipe not found.' });

        const step = recipe.steps ? recipe.steps.find(s => s._id.toString() === stepId) : null;

        if (!step) return res.status(404).render('error', { errorMessage: 'Step not found.' });

        res.render('editarPaso', { recipe, step });

    } catch (error) {
        console.error("Error fetching step:", error);
        res.status(500).render('error', { errorMessage: 'Internal Server Error.' });
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
            return res.status(400).json({ success: false, message: 'Incomplete data.' });
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
            message: 'Step updated successfully.',
            step: {
                name: stepName.trim(),
                description: stepDescription.trim()
            }
        });

    } catch (error) {
        console.error("Error updating step:", error);
        res.status(500).json({ success: false, message: 'Internal Error.' });
    }
});

export default router;
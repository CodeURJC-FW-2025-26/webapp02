
import express from 'express';
import { db } from '../database.js';
import { ObjectId } from 'mongodb';
import upload from '../multerConfig.js';

const router = express.Router();

// 1. Declare the variable here, but do not initialize it.
let recipesCollection;

// 2. Add this middleware. It will execute before any other route in this file.
//    It ensures that 'recipesCollection' is available for all routes.
router.use((req, res, next) => {
    // If the recipesCollection variable is not yet defined, initialize it.
    // This will only happen once, on the first request the server receives.
    if (!recipesCollection) {
        recipesCollection = db.connection.collection('recipes');
    }
    next(); // Continue to the requested route (e.g., GET '/', POST '/receta/nueva', etc.)
});

// API: Comprobar si el título ya existe (para validación AJAX)
router.get('/api/check-title', async (req, res) => {
    try {
        const { title, id } = req.query;

        // Buscamos si existe una receta con ese nombre (insensible a mayúsculas/minúsculas)
        // La expresión regular ^...$ asegura que coincida exactamente con todo el texto
        const query = { name: { $regex: `^${title.trim()}$`, $options: 'i' } };

        // Si estamos editando (tenemos ID), excluimos la receta actual de la búsqueda
        if (id) {
            query._id = { $ne: new ObjectId(id) };
        }

        const existingRecipe = await db.connection.collection('recipes').findOne(query);

        // Devolvemos JSON: exists es true si se encontró algo
        res.json({ exists: !!existingRecipe });
    } catch (error) {
        console.error("Error en validación de título:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Route to the homepage with pagination, search, and filter
router.get('/', async (req, res) => {
    try {
        // 1. Configuración de Paginación
        const page = parseInt(req.query.page) || 1; // Página actual, por defecto 1
        const pageSize = 6; // Número de recetas por página (requisito rúbrica)
        const skip = (page - 1) * pageSize;

        // 2. Configuración de Filtros (Búsqueda y Categoría)
        const filter = {};
        const searchQuery = req.query.search;
        const categoryQuery = req.query.category;

        if (searchQuery) {
            // Búsqueda insensible a mayúsculas/minúsculas
            filter.name = { $regex: searchQuery, $options: 'i' };
        }
        if (categoryQuery) {
            filter.category = categoryQuery;
        }

        // Obtenemos las recetas para la página actual aplicando filtros y paginación
        const recipes = await recipesCollection.find(filter)
            .skip(skip)
            .limit(pageSize)
            .toArray();

        // Obtenemos el número total de recetas que coinciden con el filtro
        const totalRecipes = await recipesCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalRecipes / pageSize);

        // --- LÓGICA DE SCROLL INFINITO (JSON) ---
        // Si el cliente (client.js) pide formato JSON, devolvemos solo datos crudos
        if (req.query.format === 'json') {
            return res.json({
                recipes: recipes,
                // Calculamos si hay siguiente página
                nextPage: page < totalPages ? page + 1 : null
            });
        }

        // --- LÓGICA DE RENDERIZADO HTML (Carga normal) ---

        // Generación de botones de paginación (Se mantiene por si falla JS o para SEO)
        const pagesForTemplate = [];
        const window = 2;

        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
                    pagesForTemplate.push({
                        page: i,
                        isCurrent: i === page,
                        isEllipsis: false
                    });
                }
                else if (pagesForTemplate[pagesForTemplate.length - 1].page < i - 1) {
                    if (!pagesForTemplate[pagesForTemplate.length - 1].isEllipsis) {
                        pagesForTemplate.push({ isEllipsis: true });
                    }
                }
            }
        }

        // Objeto para determinar qué botón de categoría está activo
        const categoryStates = {
            all: !categoryQuery,
            entrante: categoryQuery === 'entrante',
            principal: categoryQuery === 'principal',
            postre: categoryQuery === 'postre',
            vegano: categoryQuery === 'vegano'
        };

        // Renderizamos la vista completa
        res.render('index', {
            recipes: recipes,
            currentPage: page,
            totalPages: totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            searchQuery: searchQuery,
            categoryQuery: categoryQuery,
            pagesForTemplate: pagesForTemplate,
            categoryStates: categoryStates,
            // VARIABLE NUEVA: Indica al cliente (JS) cuál es la siguiente página inicial
            initialNextPage: page < totalPages ? page + 1 : null
        });

    } catch (error) {
        console.error("❌ Error al obtener las recetas:", error);
        // Si es una petición JSON (AJAX) devolvemos error JSON
        if (req.query.format === 'json') {
            return res.status(500).json({ error: "Error interno al cargar recetas" });
        }
        // Si es carga normal, mostramos la página de error
        res.status(500).render('error', {
            errorMessage: "No se pudieron cargar las recetas del servidor.",
            backUrl: '/',
            backUrlText: 'Volver a la página principal'
        });
    }
});

// Route to display the error page after a redirection
router.get('/error', (req, res) => {
    const errorMessage = req.session.errorMessage;
    const backUrl = req.session.backUrl;

    // We clear the error data from the session so it is not displayed again
    delete req.session.errorMessage;
    delete req.session.backUrl;
    // Careful! We DO NOT delete req.session.formData yet. We will need it in the next step.

    if (!errorMessage) {
        // If someone accesses /error directly, we send them to the home page
        return res.redirect('/');
    }

    res.render('error', {
        errorMessage: errorMessage,
        backUrl: backUrl || '/', // If there is no back URL, go to the home page
        backUrlText: 'Volver al formulario'
    });
});

// DISPLAYS THE FORM TO CREATE A NEW RECIPE
router.get('/receta/nueva', (req, res) => {
    // Checks if there is form data saved in the session (due to a previous error)
    const formData = req.session.formData;
    delete req.session.formData; // Clears the data after using it (flash message)

    const recipeData = formData ? formData : {}; // Uses session data or an empty object

    // We prepare helpers for the <select>
    if (recipeData.category) {
        recipeData[`isCategory${recipeData.category.charAt(0).toUpperCase() + recipeData.category.slice(1)}`] = true;
    }
    if (recipeData.difficulty) {
        recipeData[`isDifficulty${recipeData.difficulty.charAt(0).toUpperCase() + recipeData.difficulty.slice(1)}`] = true;
    }

    // We rename the properties to match the template (e.g., recipeName -> name)
    const recipe = {
        name: recipeData.recipeName,
        description: recipeData.description,
        ingredients: recipeData.ingredients,
        preparation_time: recipeData.preparationTime,
        ...recipeData // Includes the helpers
    };

    res.render('AñadirReceta', { recipe: recipe });
});

// PROCESS THE SUBMISSION OF THE FORM TO CREATE A NEW RECIPE
// Nota: Hemos quitado el middleware validateRecipe(false) para manejar los errores manualmente con JSON
router.post('/receta/nueva', upload.single('recipeImage'), async (req, res) => {
    try {
        const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;

        // --- 1. VALIDACIONES DEL SERVIDOR (Replica de validateRecipe) ---

        // Campos obligatorios
        if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
        }

        // Mayúscula inicial
        if (recipeName.trim()[0] !== recipeName.trim()[0].toUpperCase()) {
            return res.status(400).json({ success: false, message: 'El nombre de la receta debe empezar con mayúscula.' });
        }

        // Longitud descripción
        if (description.trim().length < 20 || description.trim().length > 500) {
            return res.status(400).json({ success: false, message: 'La descripción debe tener entre 20 y 500 caracteres.' });
        }

        // Tiempo válido
        if (isNaN(preparationTime) || parseInt(preparationTime) <= 0) {
            return res.status(400).json({ success: false, message: 'El tiempo de preparación debe ser un número positivo.' });
        }

        // Nombre único
        const existingRecipe = await db.connection.collection('recipes').findOne({
            name: { $regex: `^${recipeName.trim()}$`, $options: 'i' }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `Ya existe una receta con el nombre "${recipeName}".` });
        }

        // --- 2. CREACIÓN DEL OBJETO ---

        const newRecipe = {
            name: recipeName.trim(),
            description: description.trim(),
            ingredients: ingredients,
            category: category,
            difficulty: difficulty,
            preparation_time: parseInt(preparationTime),
            image: req.file ? req.file.filename : 'logo.jpg', // Guardamos solo el nombre del archivo
            steps: []
        };

        // --- 3. INSERCIÓN EN BASE DE DATOS ---

        const result = await db.connection.collection('recipes').insertOne(newRecipe);

        // --- 4. RESPUESTA JSON ---
        res.json({
            success: true,
            message: `La receta "${newRecipe.name}" ha sido creada con éxito.`,
            redirectUrl: `/receta/${result.insertedId}`
        });

    } catch (error) {
        console.error("❌ Error al crear la receta:", error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor. No se pudo guardar la receta.'
        });
    }
});

router.get('/receta/:id', async (req, res) => {
    try {
        const recipeId = req.params.id; // Obtain the URL ID

        const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) });

        // We retrieve the form data and the error from the session (if they exist)
        const stepFormData = req.session.stepFormData;
        const stepErrorMessage = req.session.stepErrorMessage;

        // We clear the session so that the error is not displayed again on the next reload
        delete req.session.stepFormData;
        delete req.session.stepErrorMessage;

        if (recipe) {
            // We added the recipe ID to each step to make it easy to access in the template.
            if (recipe.steps) {
                recipe.steps.forEach(step => {
                    step.recipe_id = recipe._id;
                });
            }
            // If the recipe is found, we render the detail view
            res.render('detalleReceta', {
                recipe: recipe,
                stepFormData: stepFormData,       // The data to "repopulate" the form
                stepErrorMessage: stepErrorMessage // The error message to display
            });
        } else {
            // If a recipe with that ID is not found, we display a 404 error.
            res.status(404).render('error', { errorMessage: 'Receta no encontrada.' });
        }
    } catch (error) {
        console.error("❌ Error al obtener la receta:", error);
        res.status(500).render('error', {
            errorMessage: "Error interno del servidor.",
            backUrl: '/',
            backUrlText: 'Volver a la página principal'
        });
    }
});

// --- RECIPE EDITING ---
// DISPLAY THE FORM FOR EDITING
router.get('/receta/editar/:id', async (req, res) => {
    try {
        const formData = req.session.formData;
        delete req.session.formData;

        let recipe;
        if (formData) {
            // If we are coming from an error, we use the session data
            recipe = {
                name: formData.recipeName,
                description: formData.description,
                ingredients: formData.ingredients,
                category: formData.category,
                difficulty: formData.difficulty,
                preparation_time: formData.preparationTime,
                _id: req.params.id
            };
        } else {
            // If it's the first visit, we load the data from the DB
            recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(req.params.id) });
        }

        if (recipe) {
            // We add helpers for the <select>
            if (recipe.category) {
                recipe[`isCategory${recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1)}`] = true;
            }
            if (recipe.difficulty) {
                recipe[`isDifficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`] = true;
            }
            res.render('AñadirReceta', { recipe: recipe, editing: true });
        } else {
            res.status(404).render('error', { errorMessage: 'Recipe not found for editing.' });
        }
    } catch (error) {
        console.error("❌ Error al obtener receta para editar:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor.',
            backUrl: '/',
            backUrlText: 'Volver a la página principal'
        });
    }
});

// PROCESS THE SUBMISSION OF THE FORM TO EDIT A RECIPE
// Nota: Hemos quitado el middleware validateRecipe(true)
router.post('/receta/editar/:id', upload.single('recipeImage'), async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;

        if (!ObjectId.isValid(recipeId)) {
            return res.status(400).json({ success: false, message: 'ID de receta inválido.' });
        }

        // --- 1. VALIDACIONES DEL SERVIDOR ---

        if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
        }

        if (recipeName.trim()[0] !== recipeName.trim()[0].toUpperCase()) {
            return res.status(400).json({ success: false, message: 'El nombre debe empezar con mayúscula.' });
        }

        if (description.trim().length < 20 || description.trim().length > 500) {
            return res.status(400).json({ success: false, message: 'La descripción debe tener entre 20 y 500 caracteres.' });
        }

        if (isNaN(preparationTime) || parseInt(preparationTime) <= 0) {
            return res.status(400).json({ success: false, message: 'Tiempo inválido.' });
        }

        // Validación de nombre único (excluyendo la receta actual)
        const existingRecipe = await db.connection.collection('recipes').findOne({
            name: { $regex: `^${recipeName.trim()}$`, $options: 'i' },
            _id: { $ne: new ObjectId(recipeId) }
        });

        if (existingRecipe) {
            return res.status(400).json({ success: false, message: `El nombre "${recipeName}" ya está en uso por otra receta.` });
        }

        // --- 2. ACTUALIZACIÓN ---

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

        // --- 3. RESPUESTA JSON ---
        res.json({
            success: true,
            message: 'Receta actualizada correctamente.',
            redirectUrl: `/receta/${recipeId}`
        });

    } catch (error) {
        console.error("❌ Error al editar la receta:", error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al actualizar la receta.'
        });
    }
});

// PROCESS THE DELETION OF A RECIPE
router.post('/receta/borrar/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;
        if (!ObjectId.isValid(recipeId)) {
            return res.status(400).json({ success: false, message: 'ID inválido' });
        }
        const result = await recipesCollection.deleteOne({ _id: new ObjectId(recipeId) });

        if (result.deletedCount === 1) {
            // Éxito -> JSON
            res.json({ success: true, message: 'Receta eliminada.', redirectUrl: '/' });
        } else {
            res.status(404).json({ success: false, message: 'Receta no encontrada.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error del servidor.' });
    }
});

// PROCESS THE CREATION OF A NEW STEP FOR A RECIPE
router.post('/receta/:id/paso/nuevo', async (req, res) => {
    const recipeId = req.params.id;
    try {
        const { stepName, stepDescription } = req.body;

        if (!stepName || !stepDescription) {
            return res.status(400).json({ success: false, message: 'Faltan datos.' });
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

        // Devolvemos el paso creado para que el cliente lo pinte
        res.json({
            success: true,
            message: 'Paso añadido.',
            step: newStep,  // <-- IMPORTANTE: Devolvemos el objeto paso
            recipeId: recipeId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// PROCESS THE ELIMINATION OF A STEP FROM A RECIPE
router.post('/receta/:id/paso/borrar/:stepId', async (req, res) => {
    const { id, stepId } = req.params;
    try {
        await recipesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $pull: { steps: { _id: new ObjectId(stepId) } } }
        );
        res.json({ success: true, message: 'Paso eliminado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al borrar paso.' });
    }
});

// DISPLAYS THE FORM TO EDIT A STEP
router.get('/receta/:id/paso/editar/:stepId', async (req, res) => {
    const { id, stepId } = req.params; // 1. We get the IDs
    try {
        // 2. We get the context (the parent recipe)
        const recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(id) });
        if (!recipe) {
            return res.status(404).render('error', { errorMessage: 'Receta no encontrada.' });
        }

        // 3. We check if there are "leftover" data from a failed submission
        const formData = req.session.formData;
        delete req.session.formData; // 4. Limpiamos la sesión (¡muy importante!)

        let step; // 5. We declare the variable that will contain the step data

        if (formData && formData._id.toString() === stepId) {
            // 6. CASE A: We come from an error, we use the session data
            step = formData;
        } else {
            // 7. CASE B: It's the first time loading, we use the DB data
            step = recipe.steps.find(s => s._id.toString() === stepId);
        }

        // 8. Final verification that the step exists
        if (!step) {
            return res.status(404).render('error', { errorMessage: 'Paso no encontrado.' });
        }

        // 9. We render the view, now much cleaner
        res.render('editarPaso', {
            recipe, // The context
            step    // The step data (from the session or from the DB)
        });

    } catch (error) {
        console.error("Error al obtener el paso para editar:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor al obtener el paso.',
            backUrl: `/receta/${req.params.id}`, // Used the original ID
            backUrlText: 'Volver a la receta'
        });
    }
});

// PROCESS THE EDITING OF A STEP
router.post('/receta/:id/paso/editar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;
        const { stepName, stepDescription } = req.body;

        // Validación Servidor
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

        // JSON Response
        res.json({
            success: true,
            message: 'Paso actualizado.',
            step: {
                name: stepName.trim(),
                description: stepDescription.trim()
            }
        });

    } catch (error) {
        console.error("Error al editar el paso:", error);
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

export default router;

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

// Middleware for validating recipe data
// Accepts a boolean 'isEditing' to adapt name validation
const validateRecipe = (isEditing = false) => {
    return async (req, res, next) => {
        try {
            const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;
            const backUrl = isEditing ? `/receta/editar/${req.params.id}` : '/receta/nueva';

            // Function to handle the error
            const handleError = (errorMessage) => {
                req.session.formData = req.body; //Save ALL form data
                req.session.errorMessage = errorMessage;
                req.session.backUrl = backUrl; // We save the URL for the "Back" button
                res.redirect('/error'); // We redirect to a generic error route
            };

            // --- START OF CENTRALIZED VALIDATIONS ---

            // Validation 1: All required fields must be present.
            if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
                return handleError('Todos los campos son obligatorios.');
            }

            // Validation 2: The recipe name must start with a capital letter.
            if (recipeName.trim()[0] !== recipeName.trim()[0].toUpperCase()) {
                return handleError('El nombre de la receta debe empezar con mayúscula.');
            }

            // 4. Format: Description between 20 and 500 characters
            if (description.trim().length < 20 || description.trim().length > 500) {
                return handleError('La descripción debe tener entre 20 y 500 caracteres.');
            }

            // Validation 5: The preparation time must be a positive number.
            if (isNaN(preparationTime) || parseInt(preparationTime) <= 0) {
                return handleError('El tiempo de preparación debe ser un número válido y positivo.');
            }

            // Unique name validation (adaptive)
            const query = { name: { $regex: `^${recipeName.trim()}$`, $options: 'i' } };
            if (isEditing) {
                query._id = { $ne: new ObjectId(req.params.id) };
            }
            const existingRecipe = await recipesCollection.findOne(query);
            if (existingRecipe) {
                return handleError(`Ya existe una receta con el nombre "${recipeName}".`);
            }

            // --- END OF VALIDATIONS ---

            // If all validations pass, we continue to the next route handler.
            next();

        } catch (error) {
            console.error("Error en el middleware de validación:", error);
            res.status(500).render('error', { errorMessage: 'Error interno del servidor durante la validación.' });
        }
    };
};

// Route to the homepage with pagination, search, and filter
router.get('/', async (req, res) => {
    try {
        // 1. Pagination Settings
        const page = parseInt(req.query.page) || 1; // Current page, default 1
        const pageSize = 6; // Number of recipes per page (rubric requirement)
        const skip = (page - 1) * pageSize;

        // 2. Filter Settings (Search and Category)
        const filter = {};
        const searchQuery = req.query.search;
        const categoryQuery = req.query.category;

        if (searchQuery) {
            // Case-insensitive name search
            filter.name = { $regex: searchQuery, $options: 'i' };
        }
        if (categoryQuery) {
            filter.category = categoryQuery;
        }

        // We obtain the recipes for the current page by applying filters and pagination.
        const recipes = await recipesCollection.find(filter)
            .skip(skip)
            .limit(pageSize)
            .toArray();

        // We obtain the total number of recipes that match the filter to calculate the pages
        const totalRecipes = await recipesCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalRecipes / pageSize);

        const pagesForTemplate = [];
        const window = 2; // Número de páginas a mostrar alrededor de la página actual

        if (totalPages > 1) {
            // Siempre mostramos la primera página y la última, y un "contexto" de páginas alrededor de la actual.
            for (let i = 1; i <= totalPages; i++) {
                // Condición para mostrar el botón:
                // 1. Es la primera página.
                // 2. Es la última página.
                // 3. Está dentro de la "ventana" alrededor de la página actual.
                if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
                    pagesForTemplate.push({
                        page: i,
                        isCurrent: i === page, // Marcar si es la página actual
                        isEllipsis: false
                    });
                }
                // Añadir puntos suspensivos si hay un salto
                else if (pagesForTemplate[pagesForTemplate.length - 1].page < i - 1) {
                    // Evita añadir puntos suspensivos duplicados
                    if (!pagesForTemplate[pagesForTemplate.length - 1].isEllipsis) {
                        pagesForTemplate.push({ isEllipsis: true });
                    }
                }
            }
        }

        // Object to determine which category button is active
        const categoryStates = {
            all: !categoryQuery, // El botón "Todas" está activo si no hay ninguna categoría en la URL
            entrante: categoryQuery === 'entrante',
            principal: categoryQuery === 'principal',
            postre: categoryQuery === 'postre',
            vegano: categoryQuery === 'vegano'
        };

        // 4. Render the view, passing all the necessary data.
        res.render('index', {
            recipes: recipes,
            currentPage: page,
            totalPages: totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            searchQuery: searchQuery, // To maintain the value in the search engine
            categoryQuery: categoryQuery, // To find out which category is active
            pagesForTemplate: pagesForTemplate, // <--- We add the new array to the render
            categoryStates: categoryStates // <-- Pass the new object to the template
        });

    } catch (error) {
        console.error("❌ Error al obtener las recetas:", error);
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
router.post('/receta/nueva', upload.single('recipeImage'), validateRecipe(false), async (req, res) => {
    try {
        const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;

        const newRecipe = {
            name: recipeName.trim(),
            description: description.trim(),
            ingredients: ingredients,
            category: category,
            difficulty: difficulty,
            preparation_time: parseInt(preparationTime),
            image: req.file ? req.file.filename : 'logo.jpg', // We just save the file name
            steps: []
        };

        const result = await db.connection.collection('recipes').insertOne(newRecipe);

        res.render('confirmacion', {
            message: `La receta "${newRecipe.name}" ha sido creada con éxito.`,
            nextLink: `/receta/${result.insertedId}`,
            nextLinkText: 'Ver la nueva receta'
        });

    } catch (error) {
        console.error("❌ Error al crear la receta:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor. No se pudo guardar la receta.',
            backUrl: '/',
            backUrlText: 'Volver a la página principal'
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
router.post('/receta/editar/:id', upload.single('recipeImage'), validateRecipe(true), async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;

        const updateData = {
            name: recipeName.trim(),
            description: description.trim(),
            ingredients: ingredients,
            category: category,
            difficulty: difficulty,
            preparation_time: parseInt(preparationTime)
        };
        if (req.file) {
            updateData.image = req.file.filename; // We just save the file name
        }

        await db.connection.collection('recipes').updateOne(
            { _id: new ObjectId(recipeId) },
            { $set: updateData }
        );

        res.render('confirmacion', {
            message: 'Receta actualizada correctamente.',
            nextLink: `/receta/${recipeId}`,
            nextLinkText: 'Volver a la receta'
        });

    } catch (error) {
        console.error("❌ Error al editar la receta:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor al actualizar la receta.',
            backUrl: `/receta/${recipeId}`, // Return to the details page if there is a serious error
            backUrlText: 'Volver a la receta'
        });
    }
});



// PROCESS THE CREATION OF A NEW STEP FOR A RECIPE
router.post('/receta/:id/paso/nuevo', async (req, res) => {
    const recipeId = req.params.id;
    try {
        const { stepName, stepDescription } = req.body;

        // Server validation consistent with the recipe form
        if (!stepName || !stepDescription || stepName.trim() === '' || stepDescription.trim() === '') {
            // 1. Save the error message in the session.
            req.session.errorMessage = 'El título y la descripción del paso son obligatorios.';
            // 2. Save the URL to which the user should return.
            req.session.backUrl = `/receta/${recipeId}`;
            // 3. Redirect to the generic error page.
            return res.redirect('/error');
        }

        // We created the object for the new step. We assigned it a unique ID so we could delete/edit it later.
        const newStep = {
            _id: new ObjectId(), // Unique ID for the sub-document
            name: stepName.trim(),
            description: stepDescription.trim()
        };

        // We obtain the current number of steps to assign the 'order'
        const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) }, { projection: { steps: 1 } });
        newStep.order = (recipe.steps || []).length + 1;


        // We use $push to add the new step to the 'steps' array of the correct recipe
        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) },
            { $push: { steps: newStep } }
        );

        // We redirect the user back to the same page so they can see the added step
        // res.redirect(`/receta/${recipeId}`);
        res.render('confirmacion', {
            message: 'El nuevo paso ha sido añadido con éxito.',
            nextLink: `/receta/${recipeId}`,
            nextLinkText: 'Volver a la receta'
        });

    } catch (error) {
        console.error("❌ Error al añadir un nuevo paso:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor al añadir el paso.',
            backUrl: `/receta/${recipeId}`,
            backUrlText: 'Volver a la receta'
        });
    }
});

// PROCESS THE ELIMINATION OF A STEP FROM A RECIPE
router.post('/receta/:id/paso/borrar/:stepId', async (req, res) => {
    const recipeId = req.params.id;
    const stepId = req.params.stepId;
    try {
        // We validated both IDs
        if (!ObjectId.isValid(recipeId) || !ObjectId.isValid(stepId)) {
            return res.status(400).render('error', {
                errorMessage: 'ID de receta o de paso no válido.',
                backUrl: '/',
                backUrlText: 'Volver a la página principal'
            });
        }

        // We use $pull to remove an element from the 'steps' array that matches a criterion
        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) }, // Filter: Find the right recipe
            { $pull: { steps: { _id: new ObjectId(stepId) } } } // Operation: removes from the 'steps' array the object whose '_id' matches
        );

        // res.redirect(`/receta/${recipeId}`);

        res.render('confirmacion', {
            message: 'El paso ha sido eliminado correctamente.',
            nextLink: `/receta/${recipeId}`,
            nextLinkText: 'Volver a la receta'
        });

    } catch (error) {
        console.error("❌ Error al borrar el paso:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor al borrar el paso.',
            backUrl: '/',
            backUrlText: 'Volver a la página principal'
        });
    }
});

// DISPLAYS THE FORM TO EDIT A STEP
router.get('/receta/:id/paso/editar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;

        const stepFormData = req.session.stepFormData;
        const stepErrorMessage = req.session.stepErrorMessage;
        delete req.session.stepFormData;
        delete req.session.stepErrorMessage;

        // We search for the recipe to have its context (name, etc.)
        const recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(id) });
        if (!recipe) {
            return res.status(404).render('error', { errorMessage: 'Recipe not found.' });
        }

        let step;
        // If there is data in the session due to an error, we use it
        if (stepFormData) {
            step = stepFormData;
        } else {
            // If not, we search for the data in the database
            step = recipe.steps.find(s => s._id.toString() === stepId);
        }

        if (!step) {
            return res.status(404).render('error', { errorMessage: 'Step not found.' });
        }

        // We render the view with the correct data and the error message
        res.render('editarPaso', {
            recipe,
            step,
            errorMessage: stepErrorMessage
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

        // Server validations
        if (!stepName || !stepDescription || stepName.trim() === '' || stepDescription.trim() === '') {
            // 1. We save the form data to the session
            req.session.stepFormData = { name: stepName, description: stepDescription, _id: stepId };
            // 2. We save the error message
            req.session.stepErrorMessage = 'El título y la descripción no pueden estar vacíos.';
            // 3. We redirect back TO THE SAME EDIT FORM
            return res.redirect(`/receta/${id}/paso/editar/${stepId}`);
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

        // res.redirect(`/receta/${id}`);
        res.render('confirmacion', {
            message: 'El paso ha sido actualizado con éxito.',
            nextLink: `/receta/${id}`,
            nextLinkText: 'Volver a la receta'
        });

    } catch (error) {
        console.error("Error al editar el paso:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor.',
            backUrl: '/',
            backUrlText: 'Volver a la página principal'
        });
    }
});

export default router;
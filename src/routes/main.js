
import express from 'express';
import { db } from '../database.js';
import { ObjectId } from 'mongodb';
import upload from '../multerConfig.js';

const router = express.Router();

// Middleware para validar los datos de una receta
// Acepta un booleano 'isEditing' para adaptar la validación del nombre
const validateRecipe = (isEditing = false) => {
    return async (req, res, next) => {
        try {
            const { recipeName, description, ingredients, category, difficulty, preparationTime } = req.body;
            const recipesCollection = db.connection.collection('recipes');
            const backUrl = isEditing ? `/receta/editar/${req.params.id}` : '/receta/nueva';
            const backUrlText = isEditing ? 'Volver a editar' : 'Volver al formulario';

            // --- INICIO DE VALIDACIONES CENTRALIZADAS ---

            // Validación 1: Todos los campos obligatorios deben estar presentes.
            if (!recipeName || !description || !ingredients || !category || !difficulty || !preparationTime) {
                return res.status(400).render('error', { errorMessage: 'Todos los campos son obligatorios.', backUrl, backUrlText });
            }

            // Validación 2: El nombre de la receta debe empezar con mayúscula.
            if (recipeName.trim()[0] !== recipeName.trim()[0].toUpperCase()) {
                return res.status(400).render('error', { errorMessage: 'El nombre de la receta debe empezar con mayúscula.', backUrl, backUrlText });
            }

            // 4. Formato: Descripción entre 20 y 500 caracteres
            if (description.trim().length < 20 || description.trim().length > 500) {
                return res.status(400).render('error', { errorMessage: 'La descripción debe tener entre 20 y 500 caracteres.', backUrl, backUrlText });
            }

            // Validación 5: El tiempo de preparación debe ser un número positivo.
            if (isNaN(preparationTime) || parseInt(preparationTime) <= 0) {
                return res.status(400).render('error', { errorMessage: 'El tiempo de preparación debe ser un número válido y positivo.', backUrl, backUrlText });
            }

            // Validación de nombre único (adaptativa)
            const query = { name: { $regex: `^${recipeName.trim()}$`, $options: 'i' } };
            if (isEditing) {
                query._id = { $ne: new ObjectId(req.params.id) };
            }
            const existingRecipe = await recipesCollection.findOne(query);
            if (existingRecipe) {
                const errorMessage = isEditing
                    ? `Ya existe otra receta con el nombre "${recipeName}".`
                    : `Ya existe una receta con el nombre "${recipeName}". Por favor, elige otro nombre.`;
                return res.status(400).render('error', { errorMessage, backUrl, backUrlText });
            }

            // --- FIN DE VALIDACIONES ---

            // Si todas las validaciones pasan, continuamos al siguiente manejador de la ruta.
            next();

        } catch (error) {
            console.error("Error en el middleware de validación:", error);
            res.status(500).render('error', { errorMessage: 'Error interno del servidor durante la validación.' });
        }
    };
};

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
        res.status(500).render('error', {
            errorMessage: "No se pudieron cargar las recetas del servidor.",
            backUrl: '/',
            backUrlText: 'Volver a la página principal'
        });
    }
});

// MUESTRA EL FORMULARIO PARA CREAR UNA NUEVA RECETA
router.get('/receta/nueva', (req, res) => {
    // Pasamos un objeto 'recipe' vacío para que la plantilla no falle
    // al intentar acceder a propiedades como 'recipe.name'.
    // También nos aseguramos de que 'editing' no se pase o sea 'false'.
    res.render('AñadirReceta', { recipe: {} });
});

// PROCESA EL ENVÍO DEL FORMULARIO PARA CREAR UNA NUEVA RECETA
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
            image: req.file ? `/uploads/${req.file.filename}` : '/images/logo.jpg',
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
        const recipeId = req.params.id; // Obtenemos el ID de la URL

        // Buscamos la receta en la base de datos usando su ID
        const recipesCollection = db.connection.collection('recipes');
        const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) });

        if (recipe) {
            // Añadimos el ID de la receta a cada paso para que sea fácil de acceder en la plantilla
            if (recipe.steps) {
                recipe.steps.forEach(step => {
                    step.recipe_id = recipe._id;
                });
            }
            // Si la receta se encuentra, renderizamos la vista de detalle
            res.render('detalleReceta', { recipe: recipe });
        } else {
            // Si no se encuentra una receta con ese ID, mostramos un error 404
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

// --- EDICIÓN DE RECETAS ---
// MUESTRA EL FORMULARIO PARA EDITAR
router.get('/receta/editar/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;
        if (!ObjectId.isValid(recipeId)) {
            return res.status(400).render('error', {
                errorMessage: 'El ID de la receta no es válido.',
                backUrl: '/',
                backUrlText: 'Volver a la página principal'
            });
        }
        const recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(recipeId) });
        if (recipe) {
            res.render('AñadirReceta', { recipe: recipe, editing: true });
        } else {
            res.status(404).render('error', { errorMessage: 'Receta no encontrada para editar.' });
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

// PROCESA EL ENVÍO DEL FORMULARIO PARA EDITAR UNA RECETA
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
            updateData.image = `/uploads/${req.file.filename}`;
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
            backUrl: `/receta/${recipeId}`, // Devolver a la página de detalle si hay un error grave
            backUrlText: 'Volver a la receta'
        });
    }
});

// PROCESA LA ELIMINACIÓN DE UNA RECETA
router.post('/receta/borrar/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;

        if (!ObjectId.isValid(recipeId)) {
            return res.status(400).render('error', {
                errorMessage: 'El ID de la receta no es válido.',
                backUrl: '/',
                backUrlText: 'Volver a la página principal'
            });
        }

        const recipesCollection = db.connection.collection('recipes');
        const result = await recipesCollection.deleteOne({ _id: new ObjectId(recipeId) });

        if (result.deletedCount === 1) {
            // Si se borró 1 documento, mostramos confirmación
            res.render('confirmacion', { message: 'Receta eliminada correctamente.' });
        } else {
            // Si no se borró nada (quizás ya no existía), mostramos error
            res.status(404).render('error', {
                errorMessage: 'No se encontró la receta para eliminar.',
                backUrl: '/',
                backUrlText: 'Volver a la página principal'
            });
        }
    } catch (error) {
        console.error("❌ Error al borrar la receta:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor al eliminar la receta.',
            backUrl: `/receta/${recipeId}`, // Devolver a la página de detalle si hay un error grave
            backUrlText: 'Volver a la receta'
        });
    }
});

// PROCESA LA CREACIÓN DE UN NUEVO PASO PARA UNA RECETA
router.post('/receta/:id/paso/nuevo', async (req, res) => {
    const recipeId = req.params.id;
    try {
        const { stepName, stepDescription } = req.body;

        // Validación simple del servidor
        if (!stepName || !stepDescription) {
            return res.status(400).render('error', {
                errorMessage: 'El título y la descripción del paso son obligatorios.',
                backUrl: `/receta/${recipeId}`,
                backUrlText: 'Volver a la receta'
            });
        }

        const recipesCollection = db.connection.collection('recipes');

        // Creamos el objeto del nuevo paso. Le asignamos un ID propio para poder borrarlo/editarlo después.
        const newStep = {
            _id: new ObjectId(), // ID único para el sub-documento
            name: stepName.trim(),
            description: stepDescription.trim()
        };

        // Obtenemos el número actual de pasos para asignar el 'order'
        const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) }, { projection: { steps: 1 } });
        newStep.order = (recipe.steps || []).length + 1;


        // Usamos $push para añadir el nuevo paso al array 'steps' de la receta correcta
        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) },
            { $push: { steps: newStep } }
        );

        // Redirigimos al usuario de vuelta a la misma página para que vea el paso añadido
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

// PROCESA LA ELIMINACIÓN DE UN PASO DE UNA RECETA
router.post('/receta/:id/paso/borrar/:stepId', async (req, res) => {
    const recipeId = req.params.id;
    const stepId = req.params.stepId;
    try {
        // Validamos ambos IDs
        if (!ObjectId.isValid(recipeId) || !ObjectId.isValid(stepId)) {
            return res.status(400).render('error', {
                errorMessage: 'ID de receta o de paso no válido.',
                backUrl: '/',
                backUrlText: 'Volver a la página principal'
            });
        }

        const recipesCollection = db.connection.collection('recipes');

        // Usamos $pull para eliminar un elemento del array 'steps' que coincida con un criterio
        await recipesCollection.updateOne(
            { _id: new ObjectId(recipeId) }, // Filtro: encuentra la receta correcta
            { $pull: { steps: { _id: new ObjectId(stepId) } } } // Operación: quita del array 'steps' el objeto cuyo '_id' coincida
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

// MUESTRA EL FORMULARIO PARA EDITAR UN PASO
router.get('/receta/:id/paso/editar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;

        if (!ObjectId.isValid(id) || !ObjectId.isValid(stepId)) {
            return res.status(400).render('error', { errorMessage: 'ID de receta o de paso no válido.' });
        }

        // Buscamos la receta que contiene el paso
        const recipe = await db.connection.collection('recipes').findOne({ _id: new ObjectId(id) });

        if (!recipe) {
            return res.status(404).render('error', { errorMessage: 'Receta no encontrada.' });
        }

        // Buscamos el paso específico dentro del array de pasos de la receta
        const step = recipe.steps.find(s => s._id.toString() === stepId);

        if (!step) {
            return res.status(404).render('error', { errorMessage: 'Paso no encontrado.' });
        }

        // Renderizamos una nueva vista para editar el paso
        res.render('editarPaso', { recipe, step });

    } catch (error) {
        console.error("Error al obtener el paso para editar:", error);
        res.status(500).render('error', {
            errorMessage: 'Error interno del servidor al obtener el paso.',
            backUrl: `/receta/${req.params.id}`, // Usamos el ID original
            backUrlText: 'Volver a la receta'
        });
    }
});

// PROCESA LA EDICIÓN DE UN PASO
router.post('/receta/:id/paso/editar/:stepId', async (req, res) => {
    try {
        const { id, stepId } = req.params;
        const { stepName, stepDescription } = req.body;

        // Validaciones del servidor
        if (!stepName || !stepDescription) {
            return res.status(400).render('error', {
                errorMessage: 'El título y la descripción no pueden estar vacíos.',
                backUrl: '/',
                backUrlText: 'Volver a la página principal'
            });
        }

        const recipesCollection = db.connection.collection('recipes');
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
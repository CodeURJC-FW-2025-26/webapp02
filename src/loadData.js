
import { db } from './database.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ObjectId } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function seedDatabase() {
    try {
        const recipesCollection = db.connection.collection('recipes');
        const count = await recipesCollection.countDocuments();

        if (count === 0) {
            console.log("ℹ️ Base de datos vacía. Cargando datos iniciales...");

            // 1. Leer los datos del archivo JSON
            const dataPath = join(__dirname, '../data/recipes.json');
            const recipesData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));

            // 2. Copiar imágenes y ajustar rutas
            const processedRecipes = [];
            for (const recipe of recipesData) {
                const sourceImagePath = join(__dirname, '../data/images', recipe.image);
                const destImagePath = join(__dirname, '../uploads', recipe.image);

                // Copia la imagen desde 'data/images' a 'uploads'
                await fs.copyFile(sourceImagePath, destImagePath);

                if (recipe.steps) {
                    recipe.steps.forEach(step => {
                        step._id = new ObjectId(); // <-- ¡AÑADIMOS EL ID AL PASO!
                    });
                }
                // Actualiza el objeto de la receta para que la ruta de la imagen apunte a 'uploads'
                processedRecipes.push({
                    ...recipe,
                    image: `/uploads/${recipe.image}` // La ruta que usará el HTML
                });
            }

            // 3. Insertar en la base de datos
            await recipesCollection.insertMany(processedRecipes);
            console.log(`✅ ${processedRecipes.length} recetas insertadas y sus imágenes copiadas.`);
        } else {
            console.log("ℹ️ La base de datos ya contiene datos.");
        }
    } catch (error) {
        console.error("❌ Error durante la carga de datos iniciales:", error);
        process.exit(1);
    }
}
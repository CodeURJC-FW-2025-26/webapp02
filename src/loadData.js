
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

            // 1. Read the data from the JSON file
            const dataPath = join(__dirname, '../data/recipes.json');
            const recipesData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));

            // Definimos la ruta a la carpeta de subidas
            const uploadsDir = join(__dirname, '../uploads');

            // Nos aseguramos de que la carpeta de destino exista. 
            // { recursive: true } evita errores si la carpeta ya existe.
            await fs.mkdir(uploadsDir, { recursive: true });

            // 2. Copiar imágenes y ajustar rutas
            const processedRecipes = [];
            for (const recipe of recipesData) {
                const sourceImagePath = join(__dirname, '../data/images', recipe.image);
                const destImagePath = join(__dirname, '../uploads', recipe.image);

                // Copy the image from 'data/images' to 'uploads'
                await fs.copyFile(sourceImagePath, destImagePath);

                if (recipe.steps) {
                    recipe.steps.forEach(step => {
                        step._id = new ObjectId(); // <-- ADDED THE ID TO THE STEP
                    });
                }
                // Update the recipe object so that the image path points to 'uploads'
                processedRecipes.push({
                    ...recipe,
                    image: recipe.image // The route that the HTML will use,  Guardamos solo el nombre del archivo, ej: "pulpo.jpg"  will use
                });
            }

            // 3. Insert into the database
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
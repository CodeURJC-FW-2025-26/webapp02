/* webapp02/src/loadData.js */

import { db } from './database.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ObjectId } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Seeds the database with initial data if the collection is empty.
 * Also copies sample images to the uploads directory.
 */
export async function seedDatabase() {
    try {
        const recipesCollection = db.connection.collection('recipes');
        const count = await recipesCollection.countDocuments();

        if (count === 0) {
            console.log("Database is empty. Seeding initial data...");

            // 1. Read JSON data
            const dataPath = join(__dirname, '../data/recipes.json');
            const recipesData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));

            // 2. Prepare upload directory
            const uploadsDir = join(__dirname, '../uploads');
            await fs.mkdir(uploadsDir, { recursive: true });

            // 3. Process recipes and images
            const processedRecipes = [];
            for (const recipe of recipesData) {
                // Image handling
                const sourceImagePath = join(__dirname, '../data/images', recipe.image);
                const destImagePath = join(__dirname, '../uploads', recipe.image);

                try {
                    await fs.copyFile(sourceImagePath, destImagePath);
                } catch (imgErr) {
                    console.warn(`Warning: Image ${recipe.image} not found in source.`);
                }

                // Generate ObjectIds for sub-entities (Steps)
                if (recipe.steps) {
                    recipe.steps.forEach(step => {
                        step._id = new ObjectId();
                    });
                }

                processedRecipes.push({ ...recipe });
            }

            // 4. Insert into DB
            await recipesCollection.insertMany(processedRecipes);
            console.log(`${processedRecipes.length} recipes inserted successfully.`);
        } else {
            console.log("Database already contains data.");
        }
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    }
}
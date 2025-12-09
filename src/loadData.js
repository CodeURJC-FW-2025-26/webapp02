/* webapp02/src/loadData.js */

import { db } from './database.js';
import { promises as fs, constants } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ObjectId } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Paths configuration
const ASSETS_DIR = join(__dirname, 'assets');
const UPLOADS_DIR = join(__dirname, '../uploads');
const DATA_DIR = join(__dirname, '../data'); // Folder containing recipes.json and specific images
const DEFAULT_IMAGE = 'vacio.jpg';

/**
 * Helper to check if a file exists
 */
async function fileExists(path) {
    try {
        await fs.access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensures the default image (vacio.jpg) exists in the uploads directory.
 * Copies it from src/assets if missing.
 */
async function seedDefaultImage() {
    try {
        const sourcePath = join(ASSETS_DIR, DEFAULT_IMAGE);
        const destPath = join(UPLOADS_DIR, DEFAULT_IMAGE);

        // Check if exists in uploads to avoid overwriting
        if (!(await fileExists(destPath))) {
            // Check if master exists in assets
            if (await fileExists(sourcePath)) {
                await fs.copyFile(sourcePath, destPath);
                console.log(`[Seed] Default image '${DEFAULT_IMAGE}' copied to uploads.`);
            } else {
                console.warn(`[Seed] Warning: Master '${DEFAULT_IMAGE}' not found in assets.`);
            }
        }
    } catch (error) {
        console.error(`[Seed] Error seeding default image: ${error.message}`);
    }
}

/**
 * Main seeding function.
 * 1. Ensures uploads directory and default image exist.
 * 2. Seeds DB with recipes and their specific images if empty.
 */
export async function seedDatabase() {
    try {
        // 1. Prepare upload directory (Always run this)
        await fs.mkdir(UPLOADS_DIR, { recursive: true });

        // 2. Seed the default 'vacio.jpg' image (Always run this)
        await seedDefaultImage();

        // 3. Check DB status
        const recipesCollection = db.connection.collection('recipes');
        const count = await recipesCollection.countDocuments();

        if (count === 0) {
            console.log("Database is empty. Seeding initial data...");

            // Read JSON data from ../data/recipes.json
            const jsonPath = join(DATA_DIR, 'recipes.json');

            // Check if JSON file exists before reading
            if (!(await fileExists(jsonPath))) {
                throw new Error(`recipes.json not found at ${jsonPath}`);
            }

            const recipesData = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
            const processedRecipes = [];

            for (const recipe of recipesData) {
                // Image handling: Copy specific recipe image from ../data/images/ to ../uploads/
                if (recipe.image && recipe.image !== DEFAULT_IMAGE) {
                    const sourceImagePath = join(DATA_DIR, 'images', recipe.image);
                    const destImagePath = join(UPLOADS_DIR, recipe.image);

                    try {
                        // Only copy if source exists
                        if (await fileExists(sourceImagePath)) {
                            await fs.copyFile(sourceImagePath, destImagePath);
                        } else {
                            console.warn(`Warning: Image ${recipe.image} not found in source (data/images).`);
                        }
                    } catch (imgErr) {
                        console.warn(`Error copying image ${recipe.image}: ${imgErr.message}`);
                    }
                }

                // Generate ObjectIds for sub-entities (Steps)
                if (recipe.steps) {
                    recipe.steps.forEach(step => {
                        step._id = new ObjectId();
                    });
                }

                processedRecipes.push({ ...recipe });
            }

            // Insert into DB
            await recipesCollection.insertMany(processedRecipes);
            console.log(`${processedRecipes.length} recipes inserted successfully.`);
        } else {
            console.log("Database already contains data.");
        }
    } catch (error) {
        console.error("Error seeding database:", error);
        // Do not exit process here, just log error so server can still start
    }
}
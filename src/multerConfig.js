/* webapp02/src/multerConfig.js */

import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Storage settings (where and how to save files)
const storage = multer.diskStorage({
    // destination: Defines the folder where the files will be saved
    destination: function (req, file, cb) {
        // We used path.join to create a safe path to the 'uploads' folder
        // The 'uploads' folder must exist in the project root.
        cb(null, join(__dirname, '../uploads'));
    },
    // filename: Defines how the file will be named within the folder
    filename: function (req, file, cb) {
        // To prevent two files with the same name from overwriting each other,
        // Create a unique name by adding the current date and a random number.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

// 2. We created the multer instance with the storage configuration
const upload = multer({ storage: storage });

// 3. We exported the instance to use in our routes
export default upload;
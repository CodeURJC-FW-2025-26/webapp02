/* webapp02/src/multerConfig.js */

import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Storage Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, join(__dirname, '../uploads'));
    },
    filename: function (req, file, cb) {
        // Create unique filename: timestamp + random + original name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Sanitize original name to remove spaces
        const sanitizedName = file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
    }
});

// 2. File Filter (Security: Allow only images)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// 3. Initialize Multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // Limit: 10MB
});

export default upload;
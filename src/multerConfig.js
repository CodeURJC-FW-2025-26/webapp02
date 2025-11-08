import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Configuración de almacenamiento (dónde y cómo guardar los archivos)
const storage = multer.diskStorage({
    // destination: Define la carpeta donde se guardarán los archivos
    destination: function (req, file, cb) {
        // Usamos path.join para crear una ruta segura a la carpeta 'uploads'
        // La carpeta 'uploads' debe existir en la raíz del proyecto.
        cb(null, join(__dirname, '../uploads'));
    },
    // filename: Define cómo se nombrará el archivo dentro de la carpeta
    filename: function (req, file, cb) {
        // Para evitar que dos archivos con el mismo nombre se sobreescriban,
        // creamos un nombre único añadiendo la fecha actual y un número aleatorio.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

// 2. Creamos la instancia de multer con la configuración de almacenamiento
const upload = multer({ storage: storage });

// 3. Exportamos la instancia para usarla en nuestras rutas
export default upload;
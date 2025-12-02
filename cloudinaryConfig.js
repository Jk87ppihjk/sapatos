// cloudinaryConfig.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// Configuração das credenciais a partir do .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuração do armazenamento
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shoe-store-uploads', // Nome da pasta no seu Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }] // Otimização básica opcional
    },
});

// Middleware de upload pronto para uso nas rotas
const upload = multer({ storage: storage });

module.exports = { upload, cloudinary };

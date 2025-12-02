// cloudinaryConfig.js - CORRIGIDO
const cloudinary = require('cloudinary').v2;

// CORREÇÃO AQUI: Importa o pacote inteiro, e a propriedade CloudinaryStorage é acessada.
// Para garantir a compatibilidade com a v2.2.1, usamos essa sintaxe.
const { CloudinaryStorage } = require('multer-storage-cloudinary'); 

const multer = require('multer');
require('dotenv').config();

// Configuração das credenciais a partir do .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// A linha 15 (onde o erro ocorria) agora está correta.
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shoe-store-uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
    },
});

// Middleware de upload pronto para uso nas rotas
const upload = multer({ storage: storage });

module.exports = { upload, cloudinary };

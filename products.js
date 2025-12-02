// products.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { upload } = require('./cloudinaryConfig'); // Importa configuração do multer/cloudinary
const { authenticateToken } = require('./auth'); // Para proteger rotas de criação/edição

// ROTA 1: Listar Produtos (com filtros)
router.get('/', async (req, res) => {
    try {
        const { gender, brand, min_price, max_price, limit, page } = req.query;
        
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        // Filtros Dinâmicos
        if (gender) {
            query += ' AND gender = ?';
            params.push(gender);
        }
        if (brand) {
            query += ' AND brand = ?';
            params.push(brand);
        }
        if (min_price) {
            query += ' AND price >= ?';
            params.push(min_price);
        }
        if (max_price) {
            query += ' AND price <= ?';
            params.push(max_price);
        }

        // Paginação
        const limitVal = parseInt(limit) || 20;
        const pageVal = parseInt(page) || 1;
        const offset = (pageVal - 1) * limitVal;

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limitVal, offset);

        const [products] = await pool.query(query, params);
        
        // Contar total para paginação
        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM products');
        
        res.json({
            data: products,
            meta: {
                total: countResult[0].total,
                page: pageVal,
                limit: limitVal
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar produtos.' });
    }
});

// ROTA 2: Detalhes do Produto
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar detalhes do produto.' });
    }
});

// ROTA 3: Criar Produto (Requer Login + Upload de Imagens)
// Upload aceita: 1 imagem no campo 'main_image' e até 5 no campo 'gallery'
router.post('/', authenticateToken, upload.fields([
    { name: 'main_image', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
]), async (req, res) => {
    try {
        // Os campos de texto vêm em req.body
        const { name, description, price, old_price, brand, gender, sizes, stock } = req.body;
        
        // As imagens vêm em req.files (processadas pelo Cloudinary)
        if (!req.files || !req.files['main_image']) {
            return res.status(400).json({ message: 'A imagem principal é obrigatória.' });
        }

        // URL da imagem principal no Cloudinary
        const mainImageUrl = req.files['main_image'][0].path;

        // URLs da galeria (se houver)
        let galleryUrls = [];
        if (req.files['gallery']) {
            galleryUrls = req.files['gallery'].map(file => file.path);
        }

        // Tratamento do array de tamanhos (vem como string JSON do front, ex: '["39","40"]')
        // Se vier como string simples, convertemos para JSON válido para o MySQL
        let sizesJson = sizes;
        try {
            if (typeof sizes === 'string') {
                JSON.parse(sizes); // Apenas testa se é válido
            } else {
                sizesJson = JSON.stringify(sizes);
            }
        } catch (e) {
            sizesJson = JSON.stringify([]); // Fallback
        }

        const query = `
            INSERT INTO products 
            (name, description, price, old_price, brand, gender, image_url, images_gallery, sizes, stock) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(query, [
            name, 
            description, 
            price, 
            old_price || null, 
            brand, 
            gender || 'Unisex', 
            mainImageUrl, 
            JSON.stringify(galleryUrls), // Salva array de URLs como JSON
            sizesJson, 
            stock || 0
        ]);

        res.status(201).json({ 
            message: 'Produto criado com sucesso!', 
            productId: result.insertId,
            imageUrl: mainImageUrl
        });

    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ message: 'Erro interno ao salvar produto.' });
    }
});

module.exports = router;

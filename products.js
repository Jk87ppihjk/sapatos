// products.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { upload } = require('./cloudinaryConfig'); 
const { authenticateToken, authorizeAdmin } = require('./auth'); 

// Configuração do Multer: 1 imagem principal + até 5 imagens genéricas para a galeria
const productUploadFields = [
    { name: 'main_image', maxCount: 1 },
    { name: 'gallery_images', maxCount: 5 } 
];

// ROTA 1: Listar Produtos (pública)
router.get('/', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products ORDER BY created_at DESC LIMIT 20');
        res.json({ data: products });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar produtos.' });
    }
});

// ROTA 2: Detalhes do Produto (pública)
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

// ROTA 3: Criar Produto (ADMIN) - Suporta Cores Dinâmicas
router.post('/', authenticateToken, authorizeAdmin, upload.fields(productUploadFields), async (req, res) => {
    try {
        const { 
            name, description, price, old_price, brand, gender, sizes, stock, score, 
            gallery_colors // NOVO: Array JSON de cores enviadas pelo Front End
        } = req.body;
        
        // 1. Processamento da Galeria de Imagens por Cor (DINÂMICO)
        const colorImages = {};
        const files = req.files;
        let mainImageUrl = files['main_image'] ? files['main_image'][0].path : null;

        // Tenta parsear o JSON das cores
        let colorsArray = [];
        if (gallery_colors) {
            try {
                // gallery_colors virá como string JSON
                colorsArray = JSON.parse(gallery_colors); 
            } catch (e) {
                console.error("Erro ao parsear gallery_colors:", gallery_colors);
            }
        }
        
        const galleryFiles = files['gallery_images'] || [];

        // Mapeia os arquivos enviados com os nomes das cores dinâmicas
        galleryFiles.forEach((file, index) => {
            const color = colorsArray[index] ? colorsArray[index].trim() : `Cor ${index + 1}`;
            
            // Garante que a cor seja válida (não vazia)
            if (color) {
                colorImages[color] = file.path;
            }
            
            // Define o mainImageUrl se for o primeiro arquivo e não houver um principal
            if (!mainImageUrl && index === 0) {
                mainImageUrl = file.path;
            }
        });

        // 2. Processamento da Pontuação (0 a 100)
        let finalScore = 0;
        if (score !== undefined) {
             finalScore = Math.max(0, Math.min(100, parseInt(score)));
        }

        // 3. Processamento de Tamanhos
        let sizesJson = sizes;
        try {
            if (typeof sizes === 'string') {
                JSON.parse(sizes); 
            } else {
                sizesJson = JSON.stringify(sizes);
            }
        } catch (e) {
            sizesJson = JSON.stringify([]); 
        }

        // 4. Inserção no Banco
        const query = `
            INSERT INTO products 
            (name, description, price, old_price, brand, gender, image_url, images_gallery, sizes, stock, score) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(query, [
            name, 
            description, 
            price, 
            old_price || null, 
            brand, 
            gender || 'Unisex', 
            mainImageUrl, 
            JSON.stringify(colorImages), // JSON: {"Nome da Cor": "url_x", ...}
            sizesJson, 
            stock || 0,
            finalScore
        ]);

        res.status(201).json({ 
            message: 'Produto criado com sucesso!', 
            productId: result.insertId,
            gallery: colorImages
        });

    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ message: 'Erro interno ao salvar produto.' });
    }
});

// ROTA 4: Listar Pedidos (ADMIN)
router.get('/orders', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const [orders] = await pool.query(`
            SELECT 
                o.id, o.total_amount, o.status, o.created_at,
                u.name as user_name, u.email as user_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `);
        
        for (let order of orders) {
            const [items] = await pool.query(`
                SELECT 
                    oi.quantity, oi.price_at_purchase, oi.size, p.name as product_name
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            `, [order.id]);
            order.items = items;
        }

        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar pedidos.' });
    }
});

module.exports = router;

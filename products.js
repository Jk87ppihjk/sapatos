// products.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { upload } = require('./cloudinaryConfig'); 
const { authenticateToken, authorizeAdmin } = require('./auth'); // Importa os middlewares de AUTH

// Configuração do Multer para aceitar 5 arquivos, um para cada cor/foto
const productUploadFields = [
    { name: 'main_image', maxCount: 1 }, // Imagem principal genérica (se necessário)
    { name: 'image_red', maxCount: 1 },
    { name: 'image_blue', maxCount: 1 },
    { name: 'image_black', maxCount: 1 },
    { name: 'image_white', maxCount: 1 },
    { name: 'image_pink', maxCount: 1 } // Total de 6 campos, 5 para cores + 1 principal
];

// ROTA 1: Listar Produtos (pública)
router.get('/', async (req, res) => {
    try {
        // ... (lógica de filtros e paginação existente) ...
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
        
        // Retorna o produto com a galeria de imagens por cor (formato JSON)
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar detalhes do produto.' });
    }
});

// ROTA 3: Criar Produto (ADMIN)
// Protegida por login e autorização ADMIN.
router.post('/', authenticateToken, authorizeAdmin, upload.fields(productUploadFields), async (req, res) => {
    try {
        const { name, description, price, old_price, brand, gender, sizes, stock, score } = req.body;
        
        // 1. Processamento da Galeria de Imagens por Cor (Novo Requisito)
        const colorImages = {};
        const files = req.files;
        let mainImageUrl = files['main_image'] ? files['main_image'][0].path : null;

        const colorMap = {
            'image_red': 'Red',
            'image_blue': 'Blue',
            'image_black': 'Black',
            'image_white': 'White',
            'image_pink': 'Pink'
        };
        
        for (const [fieldName, colorName] of Object.entries(colorMap)) {
            if (files[fieldName] && files[fieldName][0]) {
                const url = files[fieldName][0].path;
                colorImages[colorName] = url;
                
                // Se não houver imagem principal, use a primeira imagem colorida como fallback
                if (!mainImageUrl) {
                    mainImageUrl = url;
                }
            }
        }

        // 2. Processamento da Pontuação (0 a 100)
        let finalScore = 0;
        if (score !== undefined) {
             finalScore = Math.max(0, Math.min(100, parseInt(score)));
        }

        // 3. Processamento de Tamanhos (Assumindo JSON String)
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
            JSON.stringify(colorImages), // JSON: {"Red": "url_red", "Black": "url_black"}
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
        
        // Puxa os itens de cada pedido
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

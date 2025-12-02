const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateToken, authorizeAdmin } = require('./auth');
const { upload } = require('./cloudinaryConfig'); // Importa o configurador de upload (para banner file upload)

// --- BANNERS ---

// LISTAR BANNERS (Público - Usado pelo Front End)
// Rota: GET /api/admin/banners
router.get('/banners', async (req, res) => {
    try {
        // Busca apenas banners marcados como ativos, se houver essa coluna
        const [rows] = await pool.query('SELECT * FROM banners WHERE active = 1 ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CRIAR BANNER (Admin)
// Rota: POST /api/admin/banners
router.post('/banners', authenticateToken, authorizeAdmin, upload.single('banner_image'), async (req, res) => {
    try {
        const { link_url, title } = req.body;
        
        // Verifica se o ficheiro foi anexado e o Cloudinary retornou a URL
        if (!req.file) {
            return res.status(400).json({ message: 'Erro: O ficheiro de imagem do banner é obrigatório.' });
        }
        
        const image_url = req.file.path; // URL final do Cloudinary

        // Insere na base de dados
        // Assumindo que a coluna 'active' existe na tabela 'banners'
        const [result] = await pool.query(
            'INSERT INTO banners (image_url, link_url, title, active) VALUES (?, ?, ?, 1)', 
            [image_url, link_url || null, title || null]
        );
        
        res.status(201).json({ 
            message: 'Banner criado e imagem enviada com sucesso!', 
            bannerId: result.insertId,
            image_url: image_url 
        });

    } catch (error) {
        console.error('Erro ao criar banner:', error);
        res.status(500).json({ error: 'Erro interno ao processar o upload do banner.' });
    }
});

// APAGAR BANNER (Admin)
// Rota: DELETE /api/admin/banners/:id
router.delete('/banners/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM banners WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Banner não encontrado.' });
        }
        
        res.json({ message: 'Banner removido!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- PRODUTOS (ADMIN) ---

// LISTAR TODOS OS PRODUTOS (Admin)
// Rota: GET /api/admin/products?all=true
router.get('/products', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        // Assume que a tabela 'products' tem a coluna 'is_visible' (ou similar)
        const [products] = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json({ data: products });
    } catch (error) {
        console.error('Erro ao buscar todos os produtos (admin):', error);
        res.status(500).json({ message: 'Erro ao buscar produtos.' });
    }
});


// ATUALIZAR VISIBILIDADE DO PRODUTO (Admin)
// Rota: PATCH /api/admin/products/:id/visibility
router.patch('/products/:id/visibility', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_visible } = req.body;
        
        if (is_visible === undefined || (is_visible !== 0 && is_visible !== 1)) {
            return res.status(400).json({ message: 'Status de visibilidade inválido. Use 0 (Oculto) ou 1 (Visível).' });
        }

        // is_visible deve ser um novo campo na tabela 'products' (assumindo que existe)
        const [result] = await pool.query(
            'UPDATE products SET is_visible = ? WHERE id = ?', 
            [is_visible, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        
        res.json({ message: 'Visibilidade do produto atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar visibilidade:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar visibilidade do produto.' });
    }
});

// DELETAR PRODUTO (Admin)
// Rota: DELETE /api/admin/products/:id
router.delete('/products/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        
        res.json({ message: 'Produto removido com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar produto:', error);
        res.status(500).json({ error: 'Erro interno ao deletar produto.' });
    }
});

// --- PEDIDOS (ORDERS) ---

// LISTAR PEDIDOS (Admin)
// Rota: GET /api/admin/orders
router.get('/orders', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        // Busca todos os pedidos (simplificado)
        // A coluna 'status' deve existir na tabela 'orders'
        const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- CUPONS ---

// CRIAR CUPOM (Admin)
router.post('/coupons', authenticateToken, authorizeAdmin, async (req, res) => {
    const { code, discount_percent, expiration_date } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO coupons (code, discount_percent, expiration_date) VALUES (?, ?, ?)', 
            [code.toUpperCase(), discount_percent, expiration_date || null]
        );
        res.status(201).json({ message: 'Cupom criado!', couponId: result.insertId });
    } catch (e) {
        console.error(e);
        // Erro 1062 é DUPLICATE ENTRY
        if (e.code === 'ER_DUP_ENTRY') {
             return res.status(400).json({ message: 'Código de cupom já existe.' });
        }
        res.status(500).json({ message: 'Erro ao criar cupom.' });
    }
});

// Validar Cupom (Público - Usado pelo Front End)
router.post('/coupons/validate', async (req, res) => {
    const { code } = req.body;
    const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ? AND active = 1', [code.toUpperCase()]);
    
    if (rows.length === 0) {
        return res.status(404).json({ valid: false, message: 'Inválido ou inativo.' });
    }
    
    const coupon = rows[0];
    const now = new Date();
    
    if (coupon.expiration_date && new Date(coupon.expiration_date) < now) {
        // Opcional: desativar o cupom expirado no DB aqui
        return res.status(400).json({ valid: false, message: 'Expirado.' });
    }
    
    res.json({ valid: true, discount_percent: coupon.discount_percent, code: coupon.code });
});


module.exports = router;

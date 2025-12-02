const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Middleware para verificar se é Admin
const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ message: 'Acesso negado' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        // if (user.role !== 'admin') return res.status(403).json({ message: 'Requer privilégios de admin' }); // Descomente para reforçar segurança
        req.user = user;
        next();
    });
};

// --- PRODUTOS ---

// CRIAR PRODUTO
router.post('/products', verifyAdmin, async (req, res) => {
    const { name, description, price, old_price, brand, gender, image_url, images_gallery, sizes, stock } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO products (name, description, price, old_price, brand, gender, image_url, images_gallery, sizes, stock) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, description, price, old_price || null, brand, gender, image_url, JSON.stringify(images_gallery || []), JSON.stringify(sizes || []), stock]
        );
        res.json({ message: 'Produto criado!', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// EDITAR PRODUTO (Atualizar Promoção, Preço, etc)
router.put('/products/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, old_price, stock, image_url } = req.body;
    
    // Lógica de Promoção: Se old_price > price, o front mostra "DE x POR y"
    
    try {
        await pool.query(
            `UPDATE products SET name=?, description=?, price=?, old_price=?, stock=?, image_url=? WHERE id=?`,
            [name, description, price, old_price, stock, image_url, id]
        );
        res.json({ message: 'Produto atualizado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// APAGAR PRODUTO
router.delete('/products/:id', verifyAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: 'Produto removido!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- BANNERS ---

// CRIAR BANNER
router.post('/banners', verifyAdmin, async (req, res) => {
    const { image_url, link_url, title } = req.body;
    try {
        await pool.query('INSERT INTO banners (image_url, link_url, title) VALUES (?, ?, ?)', [image_url, link_url, title]);
        res.json({ message: 'Banner criado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// LISTAR BANNERS (Público - para o site usar)
router.get('/banners', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM banners WHERE active = 1');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CUPONS ---

// CRIAR CUPOM
router.post('/coupons', verifyAdmin, async (req, res) => {
    const { code, discount_percent, expiration_date } = req.body;
    try {
        await pool.query('INSERT INTO coupons (code, discount_percent, expiration_date) VALUES (?, ?, ?)', 
        [code.toUpperCase(), discount_percent, expiration_date]);
        res.json({ message: 'Cupom criado!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// VALIDAR CUPOM (Público - usado no carrinho)
router.post('/coupons/validate', async (req, res) => {
    const { code } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ? AND active = 1', [code.toUpperCase()]);
        if (rows.length === 0) return res.status(404).json({ valid: false, message: 'Cupom inválido' });
        
        const coupon = rows[0];
        if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
            return res.status(400).json({ valid: false, message: 'Cupom expirado' });
        }

        res.json({ valid: true, discount_percent: coupon.discount_percent, code: coupon.code });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

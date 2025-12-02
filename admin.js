const express = require('express');
const router = express.Router();
const pool = require('./db');

// Middleware simples para verificar se é Admin (Opcional, mas recomendado)
// Você pode remover isso se quiser testar sem login por enquanto
const isAdmin = async (req, res, next) => {
    // Aqui você validaria o token e se user.role === 'admin'
    // Por enquanto, vamos deixar passar para facilitar seus testes
    next();
};

// ==========================================
// 1. GERENCIAMENTO DE PRODUTOS (Editar, Apagar, Promoção)
// ==========================================

// EDITAR PRODUTO (Atualizar preços, promoção, nome, etc)
router.put('/products/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, old_price, stock, image_url } = req.body;

    // LÓGICA DE PROMOÇÃO:
    // Se você enviar o "old_price" maior que "price", o front-end mostrará como promoção.
    // Ex: price: 100, old_price: 150 -> "De R$150 por R$100"

    try {
        await pool.query(
            `UPDATE products SET 
             name = ?, description = ?, price = ?, old_price = ?, stock = ?, image_url = ?
             WHERE id = ?`,
            [name, description, price, old_price || null, stock, image_url, id]
        );
        res.json({ message: 'Produto atualizado com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
});

// APAGAR PRODUTO
router.delete('/products/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [id]);
        res.json({ message: 'Produto removido com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao apagar produto' });
    }
});


// ==========================================
// 2. GERENCIAMENTO DE BANNERS
// ==========================================

// LISTAR BANNERS (Público - Front-end usa isso)
router.get('/banners', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM banners WHERE active = 1');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar banners' });
    }
});

// CRIAR BANNER (Admin)
router.post('/banners', isAdmin, async (req, res) => {
    const { image_url, link_url, title } = req.body;
    try {
        await pool.query(
            'INSERT INTO banners (image_url, link_url, title) VALUES (?, ?, ?)',
            [image_url, link_url, title]
        );
        res.json({ message: 'Banner adicionado!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar banner' });
    }
});

// APAGAR BANNER (Admin)
router.delete('/banners/:id', isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
        res.json({ message: 'Banner removido!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover banner' });
    }
});


// ==========================================
// 3. GERENCIAMENTO DE CUPONS
// ==========================================

// CRIAR CUPOM (Admin)
router.post('/coupons', isAdmin, async (req, res) => {
    const { code, discount_percent, expiration_date } = req.body;
    // Ex: code="NATAL10", discount_percent=10
    try {
        await pool.query(
            'INSERT INTO coupons (code, discount_percent, expiration_date) VALUES (?, ?, ?)',
            [code.toUpperCase(), discount_percent, expiration_date]
        );
        res.json({ message: 'Cupom criado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Este código de cupom já existe.' });
        }
        res.status(500).json({ error: 'Erro ao criar cupom' });
    }
});

// VALIDAR CUPOM (Público - Usado no Checkout)
router.post('/coupons/validate', async (req, res) => {
    const { code } = req.body;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM coupons WHERE code = ? AND active = 1', 
            [code.toUpperCase()]
        );

        if (rows.length === 0) {
            return res.status(404).json({ valid: false, message: 'Cupom inválido.' });
        }

        const coupon = rows[0];
        
        // Verifica validade
        if (coupon.expiration_date && new Date(coupon.expiration_date) < new Date()) {
            return res.status(400).json({ valid: false, message: 'Cupom expirado.' });
        }

        res.json({ 
            valid: true, 
            discount_percent: coupon.discount_percent,
            code: coupon.code 
        });

    } catch (error) {
        res.status(500).json({ error: 'Erro ao validar cupom' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateToken, authorizeAdmin } = require('./auth');
const { upload } = require('./cloudinaryConfig'); // Importa o configurador de upload (para banner file upload)

// --- BANNERS ---

// LISTAR BANNERS (Público - Usado pelo Front End)
router.get('/banners', async (req, res) => {
    try {
        // Busca apenas banners marcados como ativos, se houver essa coluna
        const [rows] = await pool.query('SELECT * FROM banners WHERE active = 1 ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CRIAR BANNER (Admin) - AGORA COM UPLOAD DE FICHEIRO
// 'banner_image' é o nome do campo <input type="file" name="banner_image"> no HTML
router.post('/banners', authenticateToken, authorizeAdmin, upload.single('banner_image'), async (req, res) => {
    try {
        const { link_url, title } = req.body;
        
        // Verifica se o ficheiro foi anexado e o Cloudinary retornou a URL
        if (!req.file) {
            return res.status(400).json({ message: 'Erro: O ficheiro de imagem do banner é obrigatório.' });
        }
        
        const image_url = req.file.path; // URL final do Cloudinary

        // Insere na base de dados
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

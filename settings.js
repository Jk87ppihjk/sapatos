// settings.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
// CORREÇÃO: Importa os middlewares de autenticação
const { authenticateToken, authorizeAdmin } = require('./auth'); 
const jwt = require('jsonwebtoken'); 

// 1. OBTER CONFIGURAÇÕES (Público - Qualquer um pode ver as cores do site)
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM site_config WHERE id = 1');
        // Se não tiver nada no banco, retorna o padrão
        if (rows.length === 0) {
            return res.json({
                site_name: 'SoleMates',
                primary_color: '#e94c20',
                secondary_color: '#FF69B4',
                bg_light: '#f8f6f6',
                bg_dark: '#1A1A1A'
            });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. ATUALIZAR CONFIGURAÇÕES (Admin - Muda o nome e cores)
router.put('/', authenticateToken, authorizeAdmin, async (req, res) => {
    const { site_name, primary_color, secondary_color, bg_light, bg_dark } = req.body;
    
    try {
        // Atualiza a linha de ID 1
        await pool.query(
            `UPDATE site_config SET 
             site_name = ?, primary_color = ?, secondary_color = ?, bg_light = ?, bg_dark = ? 
             WHERE id = 1`,
            [site_name, primary_color, secondary_color, bg_light, bg_dark]
        );
        res.json({ message: 'Configurações do site atualizadas!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

// settings.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { authenticateToken, authorizeAdmin } = require('./auth');
const jwt = require('jsonwebtoken'); 

// Middleware Admin (simplificado, já que o server.js lida com a autenticação)
const verifyAdmin = (req, res, next) => {
    // ... (Mantém a lógica de verificação) ...
};

// 1. OBTER CONFIGURAÇÕES (Público)
// ... (mantém o GET) ...

// 2. ATUALIZAR CONFIGURAÇÕES (Admin) - INCLUI CORES DE FUNDO
router.put('/', authenticateToken, authorizeAdmin, async (req, res) => {
    // Agora pegamos e usamos todos os 5 campos de tema
    const { site_name, primary_color, secondary_color, bg_light, bg_dark } = req.body;
    
    try {
        await pool.query(
            `UPDATE site_config SET 
             site_name = ?, primary_color = ?, secondary_color = ?, bg_light = ?, bg_dark = ? 
             WHERE id = 1`,
            [site_name, primary_color, secondary_color, bg_light, bg_dark]
        );
        res.json({ message: 'Configurações do site atualizadas, incluindo cores de fundo!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

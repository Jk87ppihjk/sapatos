// auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db'); // Requer o pool de conexões
require('dotenv').config();

// Middleware para verificar o Token JWT (Proteção de rotas)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido ou expirado.' });
        req.user = user; // Salva os dados do usuário (id, email, role)
        next();
    });
}

// Middleware: Checa se o usuário tem a role 'admin'
function authorizeAdmin(req, res, next) {
    // Note: O campo 'role' é garantido no token após a correção do login
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Necessita de permissão administrativa.' });
    }
    next();
}

// ROTA: Login (Inclui role no token)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Email ou senha incorretos.' });
        }

        // Incluir o campo 'role' no token
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role || 'client' }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({ 
            message: 'Login realizado com sucesso!', 
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role || 'client' }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao realizar login.' });
    }
});

// ROTA: Obter Perfil do Usuário (Protegida)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await pool.query('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });

        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar perfil.' });
    }
});

// Exportar todos os middlewares e o router
module.exports = { router, authenticateToken, authorizeAdmin };

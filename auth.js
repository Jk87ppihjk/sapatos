// auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

// Middleware para verificar o Token JWT (Proteção de rotas)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // O formato esperado é "Bearer TOKEN"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido ou expirado.' });
        req.user = user; // Salva os dados do usuário na requisição
        next();
    });
}

// ROTA 1: Cadastro de Usuário
router.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Por favor, preencha todos os campos obrigatórios.' });
    }

    try {
        // Verifica se o usuário já existe
        const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(409).json({ message: 'Email já cadastrado.' });
        }

        // Criptografa a senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insere no banco
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, phone]
        );

        // Gera o token JWT automaticamente após cadastro
        const token = jwt.sign({ id: result.insertId, email: email }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({ 
            message: 'Usuário criado com sucesso!', 
            token,
            user: { id: result.insertId, name, email } 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao registrar usuário.' });
    }
});

// ROTA 2: Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Busca o usuário
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];

        if (!user) {
            return res.status(400).json({ message: 'Email ou senha incorretos.' });
        }

        // Verifica a senha
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Email ou senha incorretos.' });
        }

        // Gera o token
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({ 
            message: 'Login realizado com sucesso!', 
            token,
            user: { id: user.id, name: user.name, email: user.email, phone: user.phone }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao realizar login.' });
    }
});

// ROTA 3: Obter Perfil do Usuário (Protegida)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        // Pega o ID do usuário que foi decodificado pelo middleware
        const userId = req.user.id;
        
        // Busca os dados atualizados no banco (exceto senha)
        const [users] = await pool.query('SELECT id, name, email, phone, created_at FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });

        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar perfil.' });
    }
});

// ROTA 4: Atualizar Senha (Baseado no perfil.html)
router.put('/update-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = users[0];

        // Verifica senha atual
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Senha atual incorreta.' });
        }

        // Hash da nova senha
        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        res.json({ message: 'Senha atualizada com sucesso.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar senha.' });
    }
});

module.exports = { router, authenticateToken };

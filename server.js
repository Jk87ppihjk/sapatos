// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importação da conexão com o banco (executa a criação de tabelas e ALTER TABLE)
// Lembre-se que você deve adicionar as colunas 'role' e 'score' manualmente no db.js
require('./db'); 

// Importação das Rotas
const authRoutes = require('./auth').router; 
const productRoutes = require('./products');
const paymentRoutes = require('./payment');

const app = express();

// --- Middlewares Globais ---

// CORS: Liberado para todas as origens (*)
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parser de JSON (para ler o corpo das requisições)
app.use(express.json());

// Parser de URL Encoded (para formulários padrão)
app.use(express.urlencoded({ extended: true }));

// --- Definição das Rotas da API ---

// Rotas de Autenticação (Login, Cadastro, Perfil)
app.use('/api/auth', authRoutes);

// Rotas de Produtos e Pedidos ADMIN
app.use('/api/products', productRoutes);

// Rotas de Pagamento (Mercado Pago, Webhook)
app.use('/api/payment', paymentRoutes);

// Rota Raiz (Health Check)
app.get('/', (req, res) => {
    res.send('🚀 API SoleMates - ADMIN e Loja está rodando!');
});

// --- Tratamento de Erros Globais ---
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err.stack);
    res.status(500).json({ 
        message: 'Ocorreu um erro interno no servidor.',
        error: err.message
    });
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n---------------------------------------------------`);
    console.log(`✅ Servidor rodando na porta: ${PORT}`);
    console.log(`🌍 CORS: Liberado para todas as origens (*)`);
    console.log(`---------------------------------------------------\n`);
});

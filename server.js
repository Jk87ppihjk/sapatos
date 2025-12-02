// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importação da conexão com o banco (executa a criação de tabelas automaticamente ao iniciar)
require('./db');

// Importação das Rotas
const authRoutes = require('./auth').router; 
const productRoutes = require('./products');
const paymentRoutes = require('./payment');

const app = express();

// --- 1. Configuração do CORS (LIBERADO GERAL) ---
// origin: '*' permite que qualquer domínio acesse sua API.
// Ideal para desenvolvimento ou APIs públicas.
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// --- 2. Middlewares de Parser ---
app.use(express.json()); // Para ler JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // Para ler dados de formulários

// --- 3. Definição das Rotas da API ---

// Rotas de Autenticação (Login, Cadastro, Perfil, Update Senha)
app.use('/api/auth', authRoutes);

// Rotas de Produtos (Listagem, Filtros, Detalhes, Upload)
app.use('/api/products', productRoutes);

// Rotas de Pagamento (Mercado Pago, Checkout Transparente, Webhook)
app.use('/api/payment', paymentRoutes);

// Rota Raiz (Health Check)
app.get('/', (req, res) => {
    res.send('🚀 API SoleMates rodando com CORS liberado para todos!');
});

// --- 4. Tratamento de Erros Globais ---
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err.stack);
    res.status(500).json({ 
        message: 'Ocorreu um erro interno no servidor.',
        error: err.message 
    });
});

// --- 5. Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n---------------------------------------------------`);
    console.log(`✅ Servidor rodando na porta: ${PORT}`);
    console.log(`🌍 CORS: Liberado para todas as origens (*)`);
    console.log(`🔗 Link: http://localhost:${PORT}`);
    console.log(`---------------------------------------------------\n`);
});

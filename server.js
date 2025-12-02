const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANDO ARQUIVOS DA RAIZ (./)
const authRoutes = require('./auth').router;
const productRoutes = require('./products');
const adminRoutes = require('./admin');
const settingsRoutes = require('./settings');
const paymentRoutes = require('./payment');

// DEFININDO ROTAS
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payment', paymentRoutes);

// Rota de Teste
app.get('/', (req, res) => {
    res.send('Servidor rodando (Modo: Flat Structure) 🚀');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Servidor iniciado na porta ${PORT}`);
});

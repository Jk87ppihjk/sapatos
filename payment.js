// payment.js
const express = require('express');
const router = express.Router();
// Importação da SDK oficial v2 do Mercado Pago
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pool = require('./db');
const { authenticateToken } = require('./auth');
require('dotenv').config();

// Configuração do Cliente Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// ROTA 1: Criar Preferência (Checkout Transparente)
// O Front End envia os itens do carrinho e recebe o ID da preferência
router.post('/create_preference', authenticateToken, async (req, res) => {
    try {
        const { items } = req.body;
        const user = req.user; // Obtido do middleware authenticateToken

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'O carrinho está vazio.' });
        }

        // 1. Formata os itens para o padrão do Mercado Pago
        const mpItems = items.map(item => ({
            id: item.id.toString(),
            title: item.title, // Nome do produto
            quantity: Number(item.quantity),
            unit_price: Number(item.price),
            currency_id: 'BRL'
        }));

        // 2. Calcula o total para salvar no banco
        const totalAmount = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 3. Cria a preferência no Mercado Pago
        const preference = new Preference(client);
        
        const result = await preference.create({
            body: {
                items: mpItems,
                payer: {
                    email: user.email,
                    // Se tiver nome no token/banco, pode enviar:
                    // name: user.name 
                },
                back_urls: {
                    success: `${process.env.FRONTEND_URL}/success.html`,
                    failure: `${process.env.FRONTEND_URL}/failure.html`,
                    pending: `${process.env.FRONTEND_URL}/pending.html`
                },
                auto_return: 'approved',
                // URL onde o Mercado Pago vai avisar que o pagamento mudou de status
                notification_url: `${process.env.BACKEND_URL}/api/payment/webhook`
            }
        });

        // 4. Salva o pedido inicial no Banco de Dados (Status: Pending)
        // Isso garante que temos um registro antes mesmo do cliente pagar
        const [orderResult] = await pool.query(
            `INSERT INTO orders (user_id, total_amount, status, preference_id) VALUES (?, ?, 'pending', ?)`,
            [user.id, totalAmount, result.id]
        );

        const orderId = orderResult.insertId;

        // 5. Salva os itens do pedido no banco
        const itemValues = items.map(item => [
            orderId, 
            item.id, 
            item.quantity, 
            item.price, 
            item.size || 'N/A'
        ]);

        await pool.query(
            `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, size) VALUES ?`,
            [itemValues]
        );

        // Retorna o ID da preferência para o Front End renderizar o componente
        res.json({ 
            preferenceId: result.id, 
            orderId: orderId 
        });

    } catch (error) {
        console.error('Erro ao criar preferência MP:', error);
        res.status(500).json({ message: 'Erro ao processar pagamento.' });
    }
});

// ROTA 2: Webhook (Recebe atualizações do Mercado Pago)
// Esta rota é chamada automaticamente pelos servidores do Mercado Pago
router.post('/webhook', async (req, res) => {
    const { type, data } = req.body;
    const queryId = req.query['data.id'] || data?.id; // Tenta pegar o ID do pagamento

    try {
        if (type === 'payment' || req.query.type === 'payment') {
            const payment = new Payment(client);
            
            // Consulta o status atual do pagamento na API do Mercado Pago
            const paymentData = await payment.get({ id: queryId });
            
            const status = paymentData.status; // ex: approved, rejected, pending
            const externalReference = paymentData.external_reference; // Se você usou isso
            
            console.log(`🔔 Webhook recebido. Pagamento ${queryId} está: ${status}`);

            // Atualiza o status no banco de dados baseado no ID do pagamento
            // Como no create_preference salvamos o preference_id, aqui teríamos que 
            // fazer uma lógica para vincular o payment_id ao order_id.
            // Simplificação: Vamos tentar atualizar se tivermos o ID da preferência ou salvar o payment_id agora.
            
            // Nota: Para produção perfeita, recomenda-se salvar o `external_reference` como o ID do pedido na criação da preferência.
            
            // Exemplo genérico de atualização (ajuste conforme lógica de negócio):
            // await pool.query('UPDATE orders SET status = ?, payment_id = ? WHERE preference_id = ...', [status, queryId]);
        }
        
        res.sendStatus(200); // MP exige resposta 200 OK
    } catch (error) {
        console.error('Erro no Webhook:', error);
        res.sendStatus(500);
    }
});

module.exports = router;

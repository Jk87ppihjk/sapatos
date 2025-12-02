// payment.js (COMPLETO E CORRIGIDO PARA CHECKOUT DE CONVIDADO)
const express = require('express');
const router = express.Router();
// Importação da SDK oficial v2 do Mercado Pago
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pool = require('./db');
// const { authenticateToken } = require('./auth'); // Removido para permitir Guest Checkout
require('dotenv').config();

// Configuração do Cliente Mercado Pago
// Certifique-se que MP_ACCESS_TOKEN esteja no seu .env
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// ROTA 1: Criar Preferência (Checkout de Convidado)
// Recebe items, email do comprador e o total final.
router.post('/create_preference', async (req, res) => {
    try {
        // Recebe o carrinho e os dados do comprador (guest)
        const { items, guestEmail, totalAmount, shippingDetails } = req.body;
        
        if (!items || items.length === 0 || !guestEmail || !totalAmount) {
            return res.status(400).json({ message: 'Dados inválidos. Carrinho, email ou total ausentes.' });
        }
        
        // 1. Formata os itens para o padrão do Mercado Pago
        const mpItems = items.map(item => ({
            id: item.id.toString(),
            title: `${item.name} (Tam: ${item.size} / Cor: ${item.color})`, // Nome mais detalhado
            quantity: Number(item.quantity),
            unit_price: Number(item.price),
            currency_id: 'BRL'
        }));
        
        // 2. Prepara dados adicionais para envio
        const externalReference = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`; // ID único para rastreio
        
        // 3. Cria a preferência no Mercado Pago
        const preference = new Preference(client);
        
        const result = await preference.create({
            body: {
                items: mpItems,
                payer: {
                    email: guestEmail,
                    name: shippingDetails.fullName.split(' ')[0], // Nome
                    surname: shippingDetails.fullName.split(' ').slice(1).join(' '), // Sobrenome
                },
                external_reference: externalReference, // Usado para ligar o pagamento ao pedido
                back_urls: {
                    success: `${process.env.FRONTEND_URL}/success.html?order_ref=${externalReference}`,
                    failure: `${process.env.FRONTEND_URL}/failure.html?order_ref=${externalReference}`,
                    pending: `${process.env.FRONTEND_URL}/pending.html?order_ref=${externalReference}`
                },
                auto_return: 'approved',
                notification_url: `${process.env.BACKEND_URL}/api/payment/webhook`
            }
        });
        
        // 4. Salva o pedido inicial no Banco de Dados (Status: Pending)
        // user_id é NULL para convidado
        const [orderResult] = await pool.query(
            `INSERT INTO orders (user_id, total_amount, status, preference_id, external_reference, shipping_details) VALUES (?, ?, 'pending', ?, ?, ?)`,
            [null, totalAmount, result.id, externalReference, JSON.stringify(shippingDetails)]
        );

        const orderId = orderResult.insertId;

        // 5. Salva os itens do pedido no banco
        const itemValues = items.map(item => [
            orderId, 
            item.id, 
            item.quantity, 
            item.price, 
            item.size || 'N/A',
            item.color || 'Padrão'
        ]);

        // Assumindo que a tabela order_items tem as colunas color e size
        await pool.query(
            `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, size, color) VALUES ?`,
            [itemValues]
        );

        // Retorna o ID da preferência para o Front End renderizar o componente
        res.json({ 
            preferenceId: result.id, 
            orderId: orderId,
            externalReference: externalReference
        });

    } catch (error) {
        console.error('Erro ao criar preferência MP:', error);
        res.status(500).json({ message: 'Erro ao processar pagamento.', detail: error.message });
    }
});

// ROTA 2: Webhook (Recebe atualizações do Mercado Pago)
// Webhook precisa ser ajustado para procurar pelo external_reference
router.post('/webhook', async (req, res) => {
    const topic = req.query.topic || req.query.type;
    const queryId = req.query['data.id'] || req.body?.data?.id;

    try {
        if (topic === 'payment' && queryId) {
            const payment = new Payment(client);
            
            const paymentData = await payment.get({ id: Number(queryId) });
            
            const status = paymentData.status; 
            const externalReference = paymentData.external_reference;
            
            console.log(`🔔 Webhook recebido. Pagamento ${queryId} (Ref: ${externalReference}) está: ${status}`);

            // Mapeia o status do MP para o status do seu banco
            let dbStatus = 'pending';
            if (status === 'approved') {
                dbStatus = 'approved';
            } else if (status === 'rejected' || status === 'cancelled') {
                dbStatus = 'rejected';
            }

            // Atualiza o status no banco de dados usando a referência externa
            await pool.query(
                'UPDATE orders SET status = ?, payment_id = ? WHERE external_reference = ?', 
                [dbStatus, queryId, externalReference]
            );

        }
        
        res.sendStatus(200); // MP exige resposta 200 OK
    } catch (error) {
        console.error('Erro no Webhook:', error);
        res.sendStatus(500);
    }
});

module.exports = router;

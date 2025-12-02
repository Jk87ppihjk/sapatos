const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pool = require('./db');
require('dotenv').config();

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Criar Preferência (Checkout)
router.post('/create_preference', async (req, res) => {
    try {
        const { items, guestEmail, totalAmount, shippingDetails } = req.body;

        const mpItems = items.map(item => ({
            id: String(item.id),
            title: `${item.name} (Tam: ${item.size})`,
            quantity: Number(item.quantity),
            unit_price: Number(item.price),
            currency_id: 'BRL'
        }));

        const externalReference = `ORD-${Date.now()}`;

        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: mpItems,
                payer: { email: guestEmail },
                external_reference: externalReference,
                back_urls: {
                    success: `${process.env.FRONTEND_URL}/index.html`,
                    failure: `${process.env.FRONTEND_URL}/index.html`,
                    pending: `${process.env.FRONTEND_URL}/index.html`
                },
                auto_return: 'approved'
            }
        });

        // Salvar pedido inicial
        const [orderResult] = await pool.query(
            `INSERT INTO orders (user_id, total_amount, status, preference_id, external_reference, shipping_details) VALUES (?, ?, 'pending', ?, ?, ?)`,
            [null, totalAmount, result.id, externalReference, JSON.stringify(shippingDetails)]
        );

        // Salvar itens
        const itemValues = items.map(item => [
            orderResult.insertId, item.id, item.quantity, item.price, item.size, item.color || 'N/A'
        ]);
        
        if (itemValues.length > 0) {
             await pool.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, size, color) VALUES ?`,
                [itemValues]
            );
        }

        res.json({ preferenceId: result.id });
    } catch (error) {
        console.error('Erro MP:', error);
        res.status(500).json({ message: 'Erro no pagamento' });
    }
});

module.exports = router;

// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conectado ao MySQL com sucesso.');

        // 1. Tabela de Usuários (Adicionado role para Admin)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                role ENUM('client', 'admin') DEFAULT 'client',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Tabela de Produtos (Adicionado 'score' e 'old_price' para Promoção)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                old_price DECIMAL(10, 2),
                brand VARCHAR(100),
                gender ENUM('Men', 'Women', 'Kids', 'Unisex') DEFAULT 'Unisex',
                image_url VARCHAR(500),
                images_gallery JSON,
                sizes JSON,
                stock INT DEFAULT 0,
                score INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Tabela de Pedidos (Ajustado para Guest Checkout, Mercado Pago e Shipping Details)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                total_amount DECIMAL(10, 2) NOT NULL,
                status ENUM('pending', 'approved', 'rejected', 'shipped') DEFAULT 'pending',
                payment_id VARCHAR(255),
                preference_id VARCHAR(255),
                external_reference VARCHAR(255),
                shipping_details JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // 4. Itens do Pedido (Adicionado 'color' e 'size')
        await connection.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                price_at_purchase DECIMAL(10, 2) NOT NULL,
                size VARCHAR(10),
                color VARCHAR(50),
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `);
        
        // 5. Tabela de Banners
        await connection.query(`
            CREATE TABLE IF NOT EXISTS banners (
                id INT AUTO_INCREMENT PRIMARY KEY,
                image_url VARCHAR(500) NOT NULL,
                link_url VARCHAR(500),
                title VARCHAR(255),
                active TINYINT(1) DEFAULT 1
            )
        `);

        // 6. Tabela de Cupons
        await connection.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                discount_percent INT NOT NULL,
                expiration_date DATE,
                active TINYINT(1) DEFAULT 1
            )
        `);

        // 7. Tabela de Configurações do Site (COM AS NOVAS CORES DE FUNDO)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS site_config (
                id INT NOT NULL DEFAULT 1,
                site_name VARCHAR(255) DEFAULT 'SoleMates',
                primary_color VARCHAR(20) DEFAULT '#e94c20',
                secondary_color VARCHAR(20) DEFAULT '#FF69B4',
                bg_light VARCHAR(20) DEFAULT '#f8f6f6',
                bg_dark VARCHAR(20) DEFAULT '#1A1A1A',
                PRIMARY KEY (id)
            )
        `);

        // 8. Insere configuração padrão se não existir
        await connection.query(`
            INSERT IGNORE INTO site_config (id, site_name, primary_color, secondary_color, bg_light, bg_dark) 
            VALUES (1, 'SoleMates', '#e94c20', '#FF69B4', '#f8f6f6', '#1A1A1A')
        `);

        console.log('✅ Tabelas verificadas/criadas com sucesso.');
        connection.release();
    } catch (error) {
        console.error('❌ Erro ao inicializar o banco de dados:', error);
        process.exit(1);
    }
}

initDatabase();
module.exports = pool;

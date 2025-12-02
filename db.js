// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração da conexão (Pool de conexões para melhor performance)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Função para inicializar o banco de dados e criar tabelas
async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conectado ao MySQL com sucesso.');

        // 1. Tabela de Usuários
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Tabela de Produtos
        await connection.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                old_price DECIMAL(10, 2),
                brand VARCHAR(100),
                gender ENUM('Men', 'Women', 'Kids', 'Unisex') DEFAULT 'Unisex',
                image_url VARCHAR(500), -- URL principal do Cloudinary
                images_gallery JSON,     -- Array de URLs adicionais
                sizes JSON,              -- Ex: ["38", "39", "40"]
                stock INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Tabela de Endereços (Opcional, mas boa prática separar)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS addresses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                full_name VARCHAR(255),
                address_line VARCHAR(255),
                city VARCHAR(100),
                state VARCHAR(100),
                zip_code VARCHAR(20),
                country VARCHAR(100),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 4. Tabela de Pedidos
        await connection.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                total_amount DECIMAL(10, 2) NOT NULL,
                status ENUM('pending', 'approved', 'rejected', 'shipped') DEFAULT 'pending',
                payment_id VARCHAR(255), -- ID do Mercado Pago
                preference_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // 5. Itens do Pedido
        await connection.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                price_at_purchase DECIMAL(10, 2) NOT NULL,
                size VARCHAR(10),
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `);

        console.log('✅ Tabelas verificadas/criadas com sucesso.');
        connection.release();
    } catch (error) {
        console.error('❌ Erro ao inicializar o banco de dados:', error);
        process.exit(1); // Encerra se não conseguir conectar
    }
}

// Executa a inicialização
initDatabase();

module.exports = pool;

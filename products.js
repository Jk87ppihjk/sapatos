// products.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { upload } = require('./cloudinaryConfig'); // Para upload de imagens
const { authenticateToken, authorizeAdmin } = require('./auth'); // Para rotas de admin

// Configuração do Multer: 1 imagem principal + até 5 imagens genéricas para a galeria
const productUploadFields = [
    { name: 'main_image', maxCount: 1 },
    { name: 'gallery_images', maxCount: 5 }
];

// Função auxiliar para processar a galeria de cores e imagens
const processGallery = (galleryImages, galleryColors) => {
    const colorImages = {};
    if (galleryImages && galleryColors) {
        let colors = [];
        try {
            // gallery_colors vem como string JSON do frontend
            colors = JSON.parse(galleryColors); 
        } catch (e) {
            console.error("Erro ao parsear gallery_colors:", galleryColors);
        }

        galleryImages.forEach((file, index) => {
            const color = colors[index] ? colors[index].trim() : `Cor ${index + 1}`;
            if (color) {
                // Salva no formato {"Cor": "url_da_imagem"}
                colorImages[color] = file.path; 
            }
        });
    }
    return JSON.stringify(colorImages);
};


// ----------------------------------------------------------------------
// ROTA 1: Listar Produtos (pública) - AGORA COM FILTRO POR GÊNERO, TAMANHO E MARCA
// ----------------------------------------------------------------------
router.get('/', async (req, res) => {
    // Captura os parâmetros de consulta do URL (gender, search, brand, size)
    const { gender, search, brand, size } = req.query; 

    let query = 'SELECT * FROM products';
    let conditions = [];
    let params = [];

    // 1. Filtro de GÊNERO (Men/Women/Unisex/All)
    if (gender && gender !== 'All') {
        // Se for "Men" ou "Women", inclui produtos específicos E produtos "Unisex"
        if (gender === 'Men' || gender === 'Women') {
            conditions.push('(gender = ? OR gender = "Unisex")');
            params.push(gender);
        } else {
            // Para "Unisex" ou outros casos.
            conditions.push('gender = ?');
            params.push(gender);
        }
    }
    
    // 2. Filtro de PESQUISA (Search - Exemplo simples)
    if (search) {
        conditions.push('(name LIKE ? OR description LIKE ? OR brand LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    // 3. Filtro de MARCA (Brand) - Aceita marcas separadas por vírgula (frontend envia "Nike,Adidas")
    if (brand) {
        const brands = brand.split(',').map(b => b.trim());
        if (brands.length > 0) {
            // Cria uma condição OR para múltiplas marcas
            const brandConditions = brands.map(() => 'brand = ?').join(' OR ');
            conditions.push(`(${brandConditions})`);
            params.push(...brands);
        }
    }
    
    // 4. Filtro de TAMANHO (Size - Requer JSON_CONTAINS para a coluna 'sizes')
    if (size) {
        // JSON_QUOTE garante que o valor seja tratado como string dentro do array JSON
        conditions.push('JSON_CONTAINS(sizes, JSON_QUOTE(?))');
        params.push(size);
    }

    // Constrói a cláusula WHERE
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Ordenação e Limite
    query += ' ORDER BY created_at DESC LIMIT 20';

    try {
        const [products] = await pool.query(query, params);
        res.json({ data: products });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ message: 'Erro ao buscar produtos.' });
    }
});


// ----------------------------------------------------------------------
// ROTA 2: Detalhes do Produto (pública)
// ----------------------------------------------------------------------
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar detalhes do produto:', error);
        res.status(500).json({ message: 'Erro ao buscar detalhes do produto.' });
    }
});


// ----------------------------------------------------------------------
// ROTA 3: Criar Produto (ADMIN) - Suporta Uploads e Gênero
// ----------------------------------------------------------------------
router.post('/', authenticateToken, authorizeAdmin, upload.fields(productUploadFields), async (req, res) => {
    try {
        const { 
            name, description, price, old_price, brand, gender, sizes, stock, score, 
            gallery_colors // Array JSON de nomes de cores (ex: ["Vermelho", "Azul"])
        } = req.body;
        
        // --- Processamento de Arquivos ---
        const files = req.files;
        const mainImageFile = files['main_image'] ? files['main_image'][0] : null;
        const galleryFiles = files['gallery_images'] || [];

        let mainImageUrl = mainImageFile ? mainImageFile.path : null;
        
        // 1. Processamento da Galeria de Imagens por Cor
        const galleryJson = processGallery(galleryFiles, gallery_colors);
        
        // 2. Fallback para Imagem Principal
        if (!mainImageUrl && galleryFiles.length > 0) {
            mainImageUrl = galleryFiles[0].path;
        }

        if (!mainImageUrl) {
            return res.status(400).json({ message: 'Imagem principal ou de galeria é obrigatória.' });
        }

        // 3. Validação de Score
        let finalScore = 0;
        if (score !== undefined) {
             finalScore = Math.max(0, Math.min(100, parseInt(score)));
        }

        // 4. Validação de Tamanhos (Garante que é um JSON válido ou array vazio)
        let sizesJson = sizes || '[]';
        try {
            JSON.parse(sizesJson);
        } catch (e) {
            sizesJson = '[]';
        }

        // 5. Inserção no Banco
        const query = `
            INSERT INTO products 
            (name, description, price, old_price, brand, gender, image_url, images_gallery, sizes, stock, score) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(query, [
            name, 
            description || null, 
            price, 
            old_price || null, 
            brand || null, 
            gender || 'Unisex', // Salva o gênero
            mainImageUrl, 
            galleryJson, // JSON: {"Cor": "url"}
            sizesJson, 
            stock || 0,
            finalScore
        ]);

        res.status(201).json({ 
            message: 'Produto criado com sucesso!', 
            productId: result.insertId,
            main_image_url: mainImageUrl 
        });

    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ message: 'Erro interno ao salvar produto.' });
    }
});

// ROTA 4: Listar Pedidos (A rota para listar pedidos de Admin deve ser mantida no admin.js)
// Sua estrutura original está no admin.js, mantendo a separação.

module.exports = router;

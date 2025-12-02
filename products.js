// products.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { upload } = require('./cloudinaryConfig'); // Para upload de imagens
const { authenticateToken, authorizeAdmin } = require('./auth'); // Para rotas de admin

// Configuração do Multer: 1 imagem principal + até 10 imagens genéricas para a galeria
const productUploadFields = [
    { name: 'main_image', maxCount: 1 },
    { name: 'gallery_images', maxCount: 10 } // LIMITE DE 10 IMAGENS DE GALERIA
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
            // Se o modo for "Produto Único", a cor será "Default" ou "Cor 1", etc.
            const color = colors[index] ? colors[index].trim() : (galleryImages.length === 1 ? 'Default' : `Cor ${index + 1}`);
            if (color) {
                // Salva no formato {"Cor": "url_da_imagem"}
                colorImages[color] = file.path; 
            }
        });
    }
    return JSON.stringify(colorImages);
};


// ----------------------------------------------------------------------
// ROTA 1: Listar Produtos (pública) - SEMPRE FILTRA POR is_visible = 1
// ----------------------------------------------------------------------
router.get('/', async (req, res) => {
    const { gender, search, brand, size } = req.query; 

    let query = 'SELECT * FROM products';
    let conditions = [];
    let params = [];

    // ADICIONADO: Filtro para mostrar apenas produtos visíveis ao público (is_visible = 1)
    conditions.push('is_visible = 1');
    
    // 1. Filtro de GÊNERO (Men/Women/Unisex/All)
    if (gender && gender !== 'All') {
        if (gender === 'Men' || gender === 'Women') {
            conditions.push('(gender = ? OR gender = "Unisex")');
            params.push(gender);
        } else {
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

    // 3. Filtro de MARCA (Brand) - Aceita marcas separadas por vírgula
    if (brand) {
        const brands = brand.split(',').map(b => b.trim()).filter(b => b);
        if (brands.length > 0) {
            const brandConditions = brands.map(() => 'brand = ?').join(' OR ');
            conditions.push(`(${brandConditions})`);
            params.push(...brands);
        }
    }
    
    // 4. Filtro de TAMANHO (Size - Requer JSON_CONTAINS para a coluna 'sizes')
    if (size) {
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
        // Para a rota pública, é bom verificar se o produto está visível
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ? AND is_visible = 1', [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Produto não encontrado ou oculto.' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Erro ao buscar detalhes do produto:', error);
        res.status(500).json({ message: 'Erro ao buscar detalhes do produto.' });
    }
});


// ----------------------------------------------------------------------
// ROTA 3: Criar Produto (ADMIN)
// ----------------------------------------------------------------------
router.post('/', authenticateToken, authorizeAdmin, upload.fields(productUploadFields), async (req, res) => {
    try {
        const { 
            name, description, price, old_price, brand, gender, sizes, stock, score, 
            gallery_colors 
        } = req.body;
        
        // ... (o restante da lógica de processamento de arquivos e validação de POST permanece igual) ...
        const files = req.files;
        const mainImageFile = files['main_image'] ? files['main_image'][0] : null;
        const galleryFiles = files['gallery_images'] || [];

        let mainImageUrl = mainImageFile ? mainImageFile.path : null;
        
        const galleryJson = processGallery(galleryFiles, gallery_colors);
        
        if (!mainImageUrl && galleryFiles.length > 0) {
            mainImageUrl = galleryFiles[0].path;
        }

        if (!mainImageUrl) {
            return res.status(400).json({ message: 'Imagem principal ou de galeria é obrigatória.' });
        }

        let finalScore = 0;
        if (score !== undefined) {
             finalScore = Math.max(0, Math.min(100, parseInt(score)));
        }

        let sizesJson = sizes || '[]';
        try {
            JSON.parse(sizesJson);
        } catch (e) {
            sizesJson = '[]';
        }

        // 5. Inserção no Banco (ADICIONADO is_visible como padrão 1)
        const query = `
            INSERT INTO products 
            (name, description, price, old_price, brand, gender, image_url, images_gallery, sizes, stock, score, is_visible) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;

        const [result] = await pool.query(query, [
            name, description || null, price, old_price || null, brand || null, 
            gender || 'Unisex', mainImageUrl, galleryJson, sizesJson, stock || 0, finalScore
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

// ----------------------------------------------------------------------
// ROTA 4: EDITAR/ATUALIZAR PRODUTO (ADMIN) - PERMITE ATUALIZAÇÃO COMPLETA
// ----------------------------------------------------------------------
router.put('/:id', authenticateToken, authorizeAdmin, upload.fields(productUploadFields), async (req, res) => {
    try {
        const productId = req.params.id;
        const { 
            name, description, price, old_price, brand, gender, sizes, stock, score, 
            gallery_colors, // Nomes das cores (se novas imagens forem enviadas)
            keep_main_image, // Flag para manter a imagem principal existente
            keep_gallery // Flag para manter a galeria existente
        } = req.body;

        const files = req.files;
        const mainImageFile = files && files['main_image'] ? files['main_image'][0] : null;
        const galleryFiles = files && files['gallery_images'] || [];

        let updateFields = { name, description, price, old_price, brand, gender, sizes, stock, score };

        // 1. Lógica de Imagem Principal
        if (mainImageFile) {
            updateFields.image_url = mainImageFile.path;
        } else if (!keep_main_image) {
            // Se não houver arquivo novo e não for para manter a antiga, limpa a imagem (ou use um fallback)
            // No PUT, se não houver arquivo, mantemos a que está no DB.
        }

        // 2. Lógica de Galeria (Esta lógica é complexa e deve sobrescrever a galeria existente se novos arquivos/cores forem enviados)
        if (galleryFiles.length > 0) {
            updateFields.images_gallery = processGallery(galleryFiles, gallery_colors);
        } else if (!keep_gallery) {
            // Se não houver arquivos e for instruído a não manter, limpamos a galeria
            updateFields.images_gallery = '[]';
        }
        
        // 3. Validação/Processamento
        if (sizes) updateFields.sizes = JSON.stringify(JSON.parse(sizes)); else delete updateFields.sizes;
        if (score !== undefined) updateFields.score = Math.max(0, Math.min(100, parseInt(score))); else delete updateFields.score;
        if (gender) updateFields.gender = gender; else delete updateFields.gender;
        
        // Monta a query dinamicamente
        const setClauses = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateFields);

        const query = `UPDATE products SET ${setClauses} WHERE id = ?`;

        const [result] = await pool.query(query, [...values, productId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        res.json({ message: 'Produto atualizado com sucesso!' });

    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ message: 'Erro interno ao atualizar produto.' });
    }
});


// ----------------------------------------------------------------------
// ROTA 5: EXCLUIR PRODUTO (ADMIN)
// ----------------------------------------------------------------------
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        
        // O ideal é excluir as imagens do Cloudinary aqui, usando o 'image_url' e 'images_gallery'
        
        const [result] = await pool.query('DELETE FROM products WHERE id = ?', [productId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        res.json({ message: 'Produto excluído com sucesso!' });

    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        res.status(500).json({ message: 'Erro interno ao excluir produto.' });
    }
});

// ----------------------------------------------------------------------
// ROTA 6: OCULTAR/MOSTRAR VISIBILIDADE (ADMIN) - PATCH
// ----------------------------------------------------------------------
router.patch('/:id/visibility', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const { is_visible } = req.body; // Deve ser 0 (ocultar) ou 1 (mostrar)

        if (is_visible === undefined || (is_visible !== 0 && is_visible !== 1)) {
            return res.status(400).json({ message: 'O campo is_visible deve ser 0 ou 1.' });
        }

        const [result] = await pool.query('UPDATE products SET is_visible = ? WHERE id = ?', [is_visible, productId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        const statusMessage = is_visible === 1 ? 'visível' : 'oculto';
        res.json({ message: `Produto marcado como ${statusMessage} com sucesso!` });

    } catch (error) {
        console.error('Erro ao atualizar visibilidade:', error);
        res.status(500).json({ message: 'Erro interno ao atualizar visibilidade.' });
    }
});

module.exports = router;

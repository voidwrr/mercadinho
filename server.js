const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// 1. Configurações para ler JSON e entregar os ecrãs estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. Conexão com a base de dados
const dbPath = path.join(__dirname, 'mercadinho.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Erro ao conectar no banco:", err.message);
    } else {
        console.log("📦 Conectado ao banco de dados mercadinho.db!");
    }
});

// 3. Rota para BUSCAR os produtos e enviá-los para o ecrã do Caixa
app.get('/api/produtos', (req, res) => {
    db.all("SELECT id, nome, preco_venda AS preco, preco_venda, estoque_minimo AS estoque FROM produtos WHERE ativo = 1", [], (err, rows) => {
        if (err) {
            console.error("❌ Erro no SQL ao buscar produtos:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        res.json(rows);
    });
});

// 4. Rota para CADASTRAR novos produtos a partir do novo ecrã de Gestão
app.post('/api/produtos', (req, res) => {
    const { nome, preco, estoque } = req.body;
    
    const sql = `INSERT INTO produtos (nome, preco_venda, estoque_minimo, ativo) VALUES (?, ?, ?, 1)`;
    
    db.run(sql, [nome, preco, estoque], function(err) {
        if (err) {
            console.error("❌ Erro ao inserir produto:", err.message);
            return res.status(500).json({ erro: "Erro ao salvar no banco." });
        }
        console.log(`✅ Novo produto cadastrado: ${nome}`);
        res.json({ mensagem: "Sucesso!", id: this.lastID });
    });
});

// 5. Rota para registar as vendas e ATUALIZAR O ESTOQUE
app.post('/api/vendas', (req, res) => {
    // O req.body traz os dados que o script.js enviou (subtotal, forma_pagamento, itens, etc.)
    const { itens } = req.body;

    // Se não houver itens, não há nada a descontar
    if (!itens || itens.length === 0) {
        return res.status(400).json({ erro: "O carrinho está vazio." });
    }

    //  loop por cada item que estava no carrinho do cliente
    itens.forEach(item => {
        // Comando SQL para subtrair a quantidade vendida ao estoque atual
        
        const sql = `UPDATE produtos SET estoque_minimo = estoque_minimo - ? WHERE id = ?`;
        
        // Executa o comando passando a quantidade que o cliente comprou e o ID do produto
        db.run(sql, [item.quantidade, item.produto_id], (err) => {
            if (err) {
                console.error(`❌ Erro ao descontar estoque do produto #${item.produto_id}:`, err.message);
            } else {
                console.log(`📉 Estoque atualizado: Vendidas ${item.quantidade} un. do produto #${item.produto_id}`);
            }
        });
    });

    res.json({ mensagem: "Venda registada e stock atualizado com sucesso no backend!" });
});
// Ligar o motor do servidor
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor do Mercadinho rodando LIVRE na porta ${PORT}!`);
    console.log(`👉 Segure CTRL e clique aqui: http://localhost:${PORT}/caixa.html\n`);
});
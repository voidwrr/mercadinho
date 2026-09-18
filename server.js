const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
// 
const PORT = 3001;

const dbPath = path.join(__dirname, 'mercadinho.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Erro ao conectar no banco:", err.message);
    } else {
        console.log("📦 Conectado ao banco de dados mercadinho.db!");
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/produtos', (req, res) => {
    db.all("SELECT id, nome, preco_venda AS preco, preco_venda, estoque FROM produtos WHERE ativo = 1", [], (err, rows) => {
        if (err) {
            console.error("❌ Erro no SQL ao buscar produtos:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        res.json(rows);
    });
});

// Rota para CADASTRAR um novo produto (Estoque)
app.post('/api/produtos', (req, res) => {
    const { nome, preco, estoque } = req.body;
    
    // Ajustado para preco_venda:
    const sql = `INSERT INTO produtos (nome, preco_venda, estoque, ativo) VALUES (?, ?, ?, 1)`;
    
    db.run(sql, [nome, preco, estoque], function(err) {
        if (err) {
            console.error("❌ Erro ao inserir produto:", err.message);
            return res.status(500).json({ erro: "Erro ao salvar no banco." });
        }
        console.log(`✅ Novo produto cadastrado: ${nome}`);
        res.json({ mensagem: "Sucesso!", id: this.lastID });
    });
});
app.post('/api/vendas', (req, res) => {
    res.json({ mensagem: "Venda registrada com sucesso no backend!" });
});

const servidor = app.listen(PORT, () => {
    console.log(`\n🚀 Servidor do Mercadinho rodando LIVRE na porta ${PORT}!`);
    console.log(`👉 Segure CTRL e clique aqui: http://localhost:${PORT}/caixa.html\n`);
});

servidor.on('error', (err) => {
    console.error('\n❌ ERRO NO SERVIDOR: ', err.message);
});
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
    db.all("SELECT * FROM produtos WHERE ativo = 1", [], (err, rows) => {
        if (err) {
            console.error("❌ Erro no SQL ao buscar produtos:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        res.json(rows);
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
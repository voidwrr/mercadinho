const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// 1. Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. Conexão com o banco e ativação de Foreign Keys
const dbPath = path.join(__dirname, 'mercadinho.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Erro ao conectar no banco:", err.message);
    } else {
        console.log("📦 Conectado ao banco de dados mercadinho.db!");
        db.run("PRAGMA foreign_keys = ON;", (err) => {
            if (err) console.error("❌ Erro ao ativar Foreign Keys:", err.message);
        });
    }
});

// ==============================================================================
// ROTAS DE PRODUTOS
// ==============================================================================

// BUSCAR todos os produtos com SALDO ATUAL
app.get('/api/produtos', (req, res) => {
    const sql = `SELECT id, nome, unidade, preco_venda, estoque_minimo, saldo_atual FROM vw_estoque_atual`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("❌ Erro ao buscar produtos:", err.message);
            return res.status(500).json({ erro: "Erro ao buscar produtos." });
        }
        res.json(rows);
    });
});

// CADASTRAR novo produto (E criar entrada inicial no estoque)
app.post('/api/produtos', (req, res) => {
    const { nome, unidade, preco_custo, preco_venda, estoque_minimo, estoque, quantidade, estoque_qtd } = req.body;

    if (!nome) {
        return res.status(400).json({ erro: "Nome do produto é obrigatório." });
    }

    // Aceita qualquer nome de campo para a quantidade inicial vindos do frontend
    const qtdInicial = Number(estoque_qtd || quantidade || estoque || 0);

    const sqlProduto = `
        INSERT INTO produtos (nome, unidade, preco_custo, preco_venda, estoque_minimo) 
        VALUES (?, ?, ?, ?, ?)
    `;
    const params = [nome, unidade || 'un', preco_custo || 0, preco_venda || 0, estoque_minimo || 0];

    db.run(sqlProduto, params, function(err) {
        if (err) {
            console.error("❌ Erro ao inserir produto:", err.message);
            return res.status(500).json({ erro: err.message });
        }

        const produtoId = this.lastID;

        // Se houver quantidade inicial informada, insere na tabela 'estoque'
        if (qtdInicial > 0) {
            const sqlEstoque = `
                INSERT INTO estoque (produto_id, movimentacao, qtd, obs)
                VALUES (?, 'compra', ?, 'Entrada de cadastro inicial')
            `;
            db.run(sqlEstoque, [produtoId, qtdInicial], (errEstoque) => {
                if (errEstoque) {
                    console.error("❌ Erro ao registrar estoque inicial:", errEstoque.message);
                }
                return res.status(201).json({ mensagem: "Produto cadastrado com estoque!", id: produtoId });
            });
        } else {
            res.status(201).json({ mensagem: "Produto cadastrado com sucesso!", id: produtoId });
        }
    });
});

// ATUALIZAR produto existente
app.put('/api/produtos/:id', (req, res) => {
    const { id } = req.params;
    const { nome, unidade, preco_custo, preco_venda, estoque_minimo } = req.body;

    const sql = `
        UPDATE produtos 
        SET nome = ?, unidade = ?, preco_custo = ?, preco_venda = ?, estoque_minimo = ?
        WHERE id = ? AND ativo = 1
    `;
    const params = [nome, unidade, preco_custo, preco_venda, estoque_minimo, id];

    db.run(sql, params, function(err) {
        if (err) {
            console.error("❌ Erro ao atualizar produto:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ erro: "Produto não encontrado ou inativo." });
        }
        res.json({ mensagem: "Produto atualizado com sucesso!" });
    });
});

// DESATIVAR (Soft Delete) produto
app.delete('/api/produtos/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM vw_produtos_ativo WHERE id = ?`;

    db.run(sql, [id], function(err) {
        if (err) {
            console.error("❌ Erro ao deletar produto:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        res.json({ mensagem: "Produto desativado com sucesso!" });
    });
});

// LISTAR produtos com estoque baixo
app.get('/api/produtos/estoque-baixo', (req, res) => {
    const sql = `SELECT * FROM vw_produtos_estoque_baixo`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("❌ Erro ao buscar alerta de estoque:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        res.json(rows);
    });
});

// ==============================================================================
// ROTAS DE VENDAS
// ==============================================================================

// REGISTRAR nova venda
app.post('/api/vendas', (req, res) => {
    const { subtotal, desconto, total, forma_pagamento, itens } = req.body;

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ erro: "O carrinho está vazio." });
    }

    if (!forma_pagamento) {
        return res.status(400).json({ erro: "Forma de pagamento é obrigatória." });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");

        const sqlVenda = `
            INSERT INTO vendas (subtotal, desconto, total, forma_pagamento) 
            VALUES (?, ?, ?, ?)
        `;
        const paramsVenda = [subtotal, desconto || 0, total, forma_pagamento.toLowerCase()];

        db.run(sqlVenda, paramsVenda, function(err) {
            if (err) {
                db.run("ROLLBACK;");
                console.error("❌ Erro ao registrar cabeçalho da venda:", err.message);
                return res.status(500).json({ erro: "Erro ao registrar venda: " + err.message });
            }

            const vendaId = this.lastID;
            const sqlItem = `
                INSERT INTO vendas_itens (venda_id, produto_id, qtd, preco, desconto, total)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            let concluidos = 0;
            let temErro = false;

            itens.forEach((item) => {
                const qtd = Number(item.qtd || item.quantidade || 0);
                const preco = Number(item.preco || item.preco_unitario || 0);
                const itemDesconto = Number(item.desconto || 0);
                const itemTotal = Number(item.subtotal || ((qtd * preco) - itemDesconto));

                db.run(sqlItem, [vendaId, item.produto_id, qtd, preco, itemDesconto, itemTotal], (errItem) => {
                    if (temErro) return;

                    if (errItem) {
                        temErro = true;
                        db.run("ROLLBACK;");
                        console.error("❌ Erro ao inserir item da venda:", errItem.message);
                        return res.status(500).json({ erro: "Erro ao salvar itens da venda." });
                    }

                    concluidos++;

                    if (concluidos === itens.length) {
                        db.run("COMMIT;", (errCommit) => {
                            if (errCommit) {
                                db.run("ROLLBACK;");
                                return res.status(500).json({ erro: "Erro ao finalizar transação." });
                            }
                            console.log(`✅ Venda #${vendaId} registrada com sucesso!`);
                            return res.status(201).json({ mensagem: "Venda concluída!", venda_id: vendaId });
                        });
                    }
                });
            });
        });
    });
});

// CANCELAR / APAGAR venda
app.delete('/api/vendas/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM vendas WHERE id = ?`;

    db.run(sql, [id], function(err) {
        if (err) {
            console.error("❌ Erro ao cancelar venda:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ erro: "Venda não encontrada." });
        }
        res.json({ mensagem: "Venda cancelada e estoque estornado com sucesso!" });
    });
});

// ==============================================================================
// ROTAS DE MOVIMENTAÇÃO DE ESTOQUE E RELATÓRIOS
// ==============================================================================

app.post('/api/estoque/movimentacao', (req, res) => {
    const { produto_id, movimentacao, qtd, obs } = req.body;

    if (!['compra', 'ajuste'].includes(movimentacao)) {
        return res.status(400).json({ erro: "Tipo de movimentação inválido. Use 'compra' ou 'ajuste'." });
    }

    const sql = `
        INSERT INTO estoque (produto_id, movimentacao, qtd, obs)
        VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [produto_id, movimentacao, qtd, obs || 'Ajuste manual'], function(err) {
        if (err) {
            console.error("❌ Erro ao registrar movimentação de estoque:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        res.status(201).json({ mensagem: "Estoque atualizado com sucesso!", id: this.lastID });
    });
});

app.get('/api/relatorios', (req, res) => {
    const sqlResumo = `
        SELECT
            COALESCE(SUM(total), 0) AS faturamento_total,
            COUNT(*) AS total_vendas
        FROM vendas
    `;

    const sqlMaisVendidos = `
        SELECT
            p.nome,
            COALESCE(SUM(vi.qtd), 0) AS total_vendido
        FROM vendas_itens vi
        JOIN produtos p ON p.id = vi.produto_id
        GROUP BY p.id, p.nome
        ORDER BY total_vendido DESC
        LIMIT 5
    `;

    db.get(sqlResumo, [], (err, resumo) => {
        if (err) {
            console.error('❌ Erro ao buscar resumo:', err.message);
            return res.status(500).json({ erro: 'Erro ao buscar resumo de vendas.' });
        }

        db.all(sqlMaisVendidos, [], (err2, produtos) => {
            if (err2) {
                console.error('❌ Erro ao buscar mais vendidos:', err2.message);
                return res.status(500).json({ erro: 'Erro ao buscar produtos mais vendidos.' });
            }

            res.json({
                faturamento_total: Number(resumo?.faturamento_total || 0),
                total_vendas: Number(resumo?.total_vendas || 0),
                produtos_mais_vendidos: (produtos || []).map(item => ({
                    nome: item.nome,
                    total_vendido: Number(item.total_vendido || 0)
                }))
            });
        });
    });
});

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor do Mercadinho rodando na porta ${PORT}!`);
    console.log(`👉 Acesse no navegador: http://localhost:${PORT}/caixa.html\n`);
});
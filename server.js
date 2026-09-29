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
    const busca = String(req.query.busca || '').trim();
    const sql = `
        SELECT id, nome, unidade, preco_venda, estoque_minimo, saldo_atual
        FROM vw_estoque_atual
        WHERE (? = '' OR CAST(id AS TEXT) = ? OR nome LIKE ?)
        ORDER BY nome
    `;
    const termo = `%${busca}%`;

    db.all(sql, [busca, busca, termo], (err, rows) => {
        if (err) {
            console.error("❌ Erro no SQL ao buscar produtos:", err.message);
            return res.status(500).json({ erro: err.message });
        }
        res.json(rows);
    });
});

// 4. Rota para CADASTRAR novos produtos a partir do novo ecrã de Gestão
app.post('/api/produtos', (req, res) => {
    const { nome, unidade, preco_custo, preco_venda, estoque_minimo, estoque, quantidade, estoque_qtd } = req.body;
    const qtdInicial = Number(estoque_qtd ?? quantidade ?? estoque ?? 0);

    if (!nome || !Number.isFinite(qtdInicial) || qtdInicial < 0) {
        return res.status(400).json({ erro: "Nome e quantidade inicial válida são obrigatórios." });
    }

    const sql = `
        INSERT INTO produtos (nome, unidade, preco_custo, preco_venda, estoque_minimo, ativo)
        VALUES (?, ?, ?, ?, ?, 1)
    `;

    db.run(sql, [nome, unidade || 'un', Number(preco_custo || 0), Number(preco_venda || 0), Number(estoque_minimo || 0)], function(err) {
        if (err) {
            console.error("❌ Erro ao inserir produto:", err.message);
            return res.status(500).json({ erro: err.message });
        }

        const produtoId = this.lastID;
        const responder = (erroEstoque) => {
            if (erroEstoque) {
                return res.status(500).json({ erro: erroEstoque.message });
            }
            console.log(`✅ Novo produto cadastrado: ${nome}`);
            res.status(201).json({ mensagem: "Produto cadastrado!", id: produtoId });
        };

        if (qtdInicial === 0) return responder();

        db.run(
            `INSERT INTO estoque (produto_id, movimentacao, qtd, obs) VALUES (?, 'compra', ?, 'Entrada de cadastro inicial')`,
            [produtoId, qtdInicial],
            responder
        );
    });
});

app.delete('/api/produtos/:id', (req, res) => {
    db.run('UPDATE produtos SET ativo = 0, desativado_em = CURRENT_TIMESTAMP WHERE id = ? AND ativo = 1', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ erro: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado ou já desativado.' });
        }
        res.json({ mensagem: 'Produto desativado com sucesso!' });
    });
});

app.get('/api/produtos/desativados', (req, res) => {
    db.all(`
        SELECT id, nome, unidade, desativado_em
        FROM produtos
        WHERE ativo = 0
        ORDER BY CASE WHEN desativado_em IS NULL THEN 1 ELSE 0 END, desativado_em DESC, nome COLLATE NOCASE
        LIMIT 20
    `, [], (err, produtos) => {
        if (err) {
            return res.status(500).json({ erro: err.message });
        }
        res.json(produtos);
    });
});

app.put('/api/produtos/:id/reativar', (req, res) => {
    db.run('UPDATE produtos SET ativo = 1, desativado_em = NULL WHERE id = ? AND ativo = 0', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ erro: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ erro: 'Produto desativado não encontrado.' });
        }
        res.json({ mensagem: 'Produto reativado com sucesso!' });
    });
});

app.get('/api/estoque/analise', (req, res) => {
    const sql = `
        WITH vendas_periodo AS (
            SELECT vi.produto_id, SUM(vi.qtd) AS total_vendido
            FROM vendas_itens vi
            JOIN vendas v ON v.id = vi.venda_id
            WHERE v.data >= datetime('now', '-30 days')
            GROUP BY vi.produto_id
        ), saldos AS (
            SELECT produto_id, SUM(qtd) AS saldo_atual
            FROM estoque
            GROUP BY produto_id
        )
        SELECT p.id, p.nome, p.unidade,
               COALESCE(vp.total_vendido, 0) AS total_vendido,
               COALESCE(s.saldo_atual, 0) AS saldo_atual
        FROM produtos p
        LEFT JOIN vendas_periodo vp ON vp.produto_id = p.id
        LEFT JOIN saldos s ON s.produto_id = p.id
        WHERE p.ativo = 1
        ORDER BY total_vendido ASC, p.nome COLLATE NOCASE
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Erro ao analisar vendas do estoque:', err.message);
            return res.status(500).json({ erro: 'Erro ao analisar vendas do estoque.' });
        }
        const produtos = rows.map(produto => ({
            ...produto,
            total_vendido: Number(produto.total_vendido || 0),
            saldo_atual: Number(produto.saldo_atual || 0)
        }));
        res.json({
            periodo_dias: 30,
            produtos_menos_vendidos: produtos.slice(0, 5),
            produtos_parados: produtos.filter(produto => produto.total_vendido === 0)
        });
    });
});

// 5. Rota para registar as vendas e ATUALIZAR O ESTOQUE
app.post('/api/vendas', (req, res) => {
    const { subtotal, desconto, total, forma_pagamento, itens } = req.body;

    // Se não houver itens, não há nada a descontar
    if (!itens || itens.length === 0) {
        return res.status(400).json({ erro: "O carrinho está vazio." });
    }

    if (!forma_pagamento) {
        return res.status(400).json({ erro: "Forma de pagamento é obrigatória." });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
            `INSERT INTO vendas (subtotal, desconto, total, forma_pagamento) VALUES (?, ?, ?, ?)`,
            [Number(subtotal || 0), Number(desconto || 0), Number(total || subtotal || 0), forma_pagamento],
            function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ erro: err.message });
                }

                const vendaId = this.lastID;
                const sqlItem = `
                    INSERT INTO vendas_itens (venda_id, produto_id, qtd, preco, desconto, total)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                let concluidos = 0;
                let falhou = false;

                itens.forEach(item => {
                    const qtd = Number(item.qtd ?? item.quantidade ?? 0);
                    const preco = Number(item.preco ?? item.preco_unitario ?? 0);
                    const itemDesconto = Number(item.desconto || 0);
                    const itemTotal = Number(item.subtotal ?? ((qtd * preco) - itemDesconto));

                    db.run(sqlItem, [vendaId, item.produto_id, qtd, preco, itemDesconto, itemTotal], errItem => {
                        if (falhou) return;
                        if (errItem) {
                            falhou = true;
                            db.run('ROLLBACK');
                            return res.status(500).json({ erro: errItem.message });
                        }

                        concluidos++;
                        if (concluidos === itens.length) {
                            db.run('COMMIT', errCommit => {
                                if (errCommit) {
                                    return res.status(500).json({ erro: errCommit.message });
                                }
                                res.status(201).json({ mensagem: 'Venda concluída!', venda_id: vendaId });
                            });
                        }
                    });
                });
            }
        );
    });
});

// 6. Rota para relatórios
app.get('/api/relatorios', (req, res) => {
    db.get(`
        SELECT
            COALESCE(SUM(total), 0) AS faturamento_total,
            COUNT(*) AS total_vendas
        FROM vendas
    `, [], (err, resumo) => {
        if (err) {
            console.error('Erro ao buscar resumo:', err.message);
            return res.status(500).json({ erro: 'Erro ao buscar resumo.' });
        }

        db.all(`
            SELECT
                p.nome,
                COALESCE(SUM(vi.qtd), 0) AS total_vendido
            FROM vendas_itens vi
            JOIN produtos p ON p.id = vi.produto_id
            GROUP BY p.id, p.nome
            ORDER BY total_vendido DESC
            LIMIT 5
        `, [], (err2, produtos) => {
            if (err2) {
                console.error('Erro ao buscar produtos mais vendidos:', err2.message);
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

app.get('/api/teste-relatorio', (req, res) => {
    res.json({ ok: true, mensagem: 'rota funcionando' });
});

function iniciarServidor() {
    db.all('PRAGMA table_info(produtos)', [], (err, colunas) => {
        if (err) {
            console.error('Erro ao verificar a estrutura de produtos:', err.message);
            return;
        }

        const iniciarHttp = () => app.listen(PORT, () => {
            console.log(`\n🚀 Servidor do Mercadinho rodando LIVRE na porta ${PORT}!`);
            console.log(`👉 Segure CTRL e clique aqui: http://localhost:${PORT}/caixa.html\n`);
        });

        if (colunas.some(coluna => coluna.name === 'desativado_em')) {
            return iniciarHttp();
        }

        db.run('ALTER TABLE produtos ADD COLUMN desativado_em DATETIME', erro => {
            if (erro) {
                console.error('Erro ao preparar a data de desativação:', erro.message);
                return;
            }
            iniciarHttp();
        });
    });
}

// Ligar o motor do servidor
iniciarServidor();
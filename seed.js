const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const caminhoBanco = path.resolve(__dirname, 'mercadinho.db');
const db = new sqlite3.Database(caminhoBanco);

console.log('🌱 [SEED] A iniciar a configuração do banco mercadinho.db...');

const listaProdutos = [
  { nome: 'Arroz 5kg', codigo_barras: '7891234560011', unidade: 'pct', custo: 18.50, venda: 24.90, min: 10, qtdInicial: 50 },
  { nome: 'Feijão Preto 1kg', codigo_barras: '7891234560028', unidade: 'pct', custo: 6.00, venda: 8.50, min: 15, qtdInicial: 50 },
  { nome: 'Leite Integral 1L', codigo_barras: '7891234560035', unidade: 'lt', custo: 3.80, venda: 5.20, min: 20, qtdInicial: 50 },
  { nome: 'Queijo Mussarela (kg)', codigo_barras: '7891234560042', unidade: 'kg', custo: 28.00, venda: 42.00, min: 3, qtdInicial: 20.5 },
  { nome: 'Refrigerante 2L', codigo_barras: '7891234560059', unidade: 'un', custo: 5.50, venda: 8.50, min: 12, qtdInicial: 50 }
];

function rodarQuery(sql, parametros = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, parametros, function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

async function executarSeed() {
  try {
    console.log('🧹 A limpar estruturas antigas...');
    await rodarQuery('DROP VIEW IF EXISTS vw_estoque_atual');
    await rodarQuery('DROP TABLE IF EXISTS vendas_itens');
    await rodarQuery('DROP TABLE IF EXISTS vendas');
    await rodarQuery('DROP TABLE IF EXISTS estoque');
    await rodarQuery('DROP TABLE IF EXISTS produtos');

    console.log('🛠️ A criar tabelas e views alinhadas com o server.js...');

    await rodarQuery(`
      CREATE TABLE produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        codigo_barras TEXT UNIQUE,
        unidade TEXT DEFAULT 'un',
        preco_custo REAL DEFAULT 0,
        preco_venda REAL DEFAULT 0,
        estoque_minimo REAL DEFAULT 0,
        ativo INTEGER DEFAULT 1
      )
    `);

    await rodarQuery(`
      CREATE TABLE estoque (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_id INTEGER NOT NULL,
        movimentacao TEXT CHECK(movimentacao IN ('compra', 'venda', 'ajuste')),
        qtd REAL NOT NULL,
        obs TEXT,
        data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
      )
    `);

    await rodarQuery(`
      CREATE TABLE vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subtotal REAL NOT NULL,
        desconto REAL DEFAULT 0,
        total REAL NOT NULL,
        forma_pagamento TEXT NOT NULL,
        data_venda DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela corrigida para coincidir exatamente com a rota do server.js
    await rodarQuery(`
      CREATE TABLE vendas_itens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER NOT NULL,
        produto_id INTEGER NOT NULL,
        qtd REAL NOT NULL,
        preco REAL NOT NULL,
        desconto REAL DEFAULT 0,
        total REAL NOT NULL,
        FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
      )
    `);

    await rodarQuery(`
      CREATE VIEW vw_estoque_atual AS
      SELECT 
        p.id,
        p.nome,
        p.codigo_barras,
        p.unidade,
        p.preco_venda,
        p.estoque_minimo,
        COALESCE(SUM(CASE WHEN e.movimentacao IN ('compra', 'ajuste') THEN e.qtd ELSE -e.qtd END), 0) AS saldo_atual
      FROM produtos p
      LEFT JOIN estoque e ON p.id = e.produto_id
      WHERE p.ativo = 1
      GROUP BY p.id
    `);

    console.log('📦 A povoar produtos e estoque inicial...');

    const idsProdutos = [];
    for (const prod of listaProdutos) {
      const id = await rodarQuery(
        `INSERT INTO produtos (nome, codigo_barras, unidade, preco_custo, preco_venda, estoque_minimo) VALUES (?, ?, ?, ?, ?, ?)`,
        [prod.nome, prod.codigo_barras, prod.unidade, prod.custo, prod.venda, prod.min]
      );
      await rodarQuery(
        `INSERT INTO estoque (produto_id, movimentacao, qtd, obs) VALUES (?, 'compra', ?, 'Estoque Inicial')`,
        [id, prod.qtdInicial]
      );
      idsProdutos.push(id);
      console.log(`  ✓ Produto: ${prod.nome} (ID: ${id})`);
    }

    console.log('\n🛒 A inserir vendas de teste...');

    // Venda 1: 1x Arroz + 3x Leite (PIX)
    const v1_id = await rodarQuery(
      `INSERT INTO vendas (subtotal, desconto, total, forma_pagamento) VALUES (40.50, 0, 40.50, 'pix')`
    );
    await rodarQuery(
      `INSERT INTO vendas_itens (venda_id, produto_id, qtd, preco, desconto, total) VALUES (?, ?, 1, 24.90, 0, 24.90)`,
      [v1_id, idsProdutos[0]]
    );
    await rodarQuery(
      `INSERT INTO vendas_itens (venda_id, produto_id, qtd, preco, desconto, total) VALUES (?, ?, 3, 5.20, 0, 15.60)`,
      [v1_id, idsProdutos[2]]
    );
    await rodarQuery(`INSERT INTO estoque (produto_id, movimentacao, qtd, obs) VALUES (?, 'venda', 1, 'Venda #${v1_id}')`, [idsProdutos[0]]);
    await rodarQuery(`INSERT INTO estoque (produto_id, movimentacao, qtd, obs) VALUES (?, 'venda', 3, 'Venda #${v1_id}')`, [idsProdutos[2]]);

    // Venda 2: 1x Queijo + 2x Refrigerante (Cartão)
    const v2_id = await rodarQuery(
      `INSERT INTO vendas (subtotal, desconto, total, forma_pagamento) VALUES (59.00, 2.00, 57.00, 'cartao_credito')`
    );
    await rodarQuery(
      `INSERT INTO vendas_itens (venda_id, produto_id, qtd, preco, desconto, total) VALUES (?, ?, 1, 42.00, 0, 42.00)`,
      [v2_id, idsProdutos[3]]
    );
    await rodarQuery(
      `INSERT INTO vendas_itens (venda_id, produto_id, qtd, preco, desconto, total) VALUES (?, ?, 2, 8.50, 0, 17.00)`,
      [v2_id, idsProdutos[4]]
    );
    await rodarQuery(`INSERT INTO estoque (produto_id, movimentacao, qtd, obs) VALUES (?, 'venda', 1, 'Venda #${v2_id}')`, [idsProdutos[3]]);
    await rodarQuery(`INSERT INTO estoque (produto_id, movimentacao, qtd, obs) VALUES (?, 'venda', 2, 'Venda #${v2_id}')`, [idsProdutos[4]]);

    console.log('✅ Base de dados redefinida e populada com sucesso!');

    db.all('SELECT * FROM vendas', [], (err, rows) => {
      console.log('\n--- Vendas Cadastradas ---');
      console.table(rows);
      db.close();
    });

  } catch (error) {
    console.error('❌ Erro na execução do seed:', error.message);
    db.close();
  }
}

executarSeed();
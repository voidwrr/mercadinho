const { inicializarBanco } = require('./database');

const db = inicializarBanco();

db.serialize(() => {
  console.log('Inserindo produtos e estoque inicial de teste...');

  const listaProdutos = [
    { nome: 'Arroz 5kg', unidade: 'pct', custo: 18.50, venda: 24.90, min: 10, qtdInicial: 50 },
    { nome: 'Feijão Preto 1kg', unidade: 'pct', custo: 6.00, venda: 8.50, min: 15, qtdInicial: 50 },
    { nome: 'Leite Integral 1L', unidade: 'lt', custo: 3.80, venda: 5.20, min: 20, qtdInicial: 50 },
    { nome: 'Queijo Mussarela (kg)', unidade: 'kg', custo: 28.00, venda: 42.00, min: 3, qtdInicial: 20 },
    { nome: 'Refrigerante 2L', unidade: 'un', custo: 5.50, venda: 8.50, min: 12, qtdInicial: 50 }
  ];

  const sqlProduto = `
    INSERT INTO produtos (nome, unidade, preco_custo, preco_venda, estoque_minimo)
    VALUES (?, ?, ?, ?, ?)
  `;

  const sqlEstoque = `
    INSERT INTO estoque (produto_id, movimentacao, qtd, obs)
    VALUES (?, 'compra', ?, 'Entrada inicial de estoque')
  `;

  listaProdutos.forEach((prod) => {
    db.run(sqlProduto, [prod.nome, prod.unidade, prod.custo, prod.venda, prod.min], function(err) {
      if (err) {
        console.error(`❌ Erro ao inserir produto ${prod.nome}:`, err.message);
        return;
      }

      const produtoId = this.lastID;

      db.run(sqlEstoque, [produtoId, prod.qtdInicial], (errEstoque) => {
        if (errEstoque) {
          console.error(`❌ Erro ao inserir estoque para produto ID ${produtoId}:`, errEstoque.message);
        }
      });
    });
  });

  // Aguarda a fila de execução do SQLite terminar antes de consultar a view
  db.all('SELECT * FROM vw_estoque_atual', [], (err, rows) => {
    if (err) {
      console.error('❌ Erro ao consultar a view de estoque:', err.message);
      return;
    }
    console.log('\n✅ Produtos e estoque inicial inseridos com sucesso!');
    console.log('\n--- Saldo Atual dos Produtos (vw_estoque_atual) ---');
    console.table(rows);
  });
});
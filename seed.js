const { inicializarBanco } = require('./database');

const db = inicializarBanco();

db.serialize(() => {
  console.log('Inserindo produtos de teste...');

  const stmt = db.prepare(`
    INSERT INTO produtos (nome, unidade, preco_custo, preco_venda, estoque_minimo)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run('Arroz 5kg', 'pct', 18.50, 24.90, 10);
  stmt.run('Feijão Preto 1kg', 'pct', 6.00, 8.50, 15);
  stmt.run('Leite Integral 1L', 'lt', 3.80, 5.20, 20);
  stmt.run('Queijo Mussarela (kg)', 'kg', 28.00, 42.00, 3);
  stmt.run('Refrigerante 2L', 'un', 5.50, 8.50, 12);

  stmt.finalize(() => {
    console.log('Produtos inseridos!');
    
    // Lista os produtos para confirmar
    db.all('SELECT * FROM produtos', [], (err, rows) => {
      if (err) throw err;
      console.table(rows);
    });
  });
});
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'mercadinho.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Função para abrir a conexão com o banco
function conectar() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Erro ao conectar ao SQLite:', err.message);
    }
  });

  // Habilita suporte a chaves estrangeiras (Foreign Keys)
  db.run('PRAGMA foreign_keys = ON;');

  return db;
}

// Inicializa o banco lendo o schema.sql se o arquivo .db não existir
function inicializarBanco() {
  const dbExiste = fs.existsSync(DB_PATH);
  const db = conectar();

  if (!dbExiste) {
    console.log('Criando arquivo mercadinho.db e aplicando schema.sql...');

    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');

    db.exec(schemaSql, (err) => {
      if (err) {
        console.error('Erro ao executar o schema.sql:', err.message);
      } else {
        console.log('Banco de dados inicializado com sucesso!');
      }
    });
  } else {
    console.log('Banco de dados já existe. Conectado!');

    // Garantia para adicionar a coluna codigo_barras caso a tabela produtos seja antiga
    db.all("PRAGMA table_info(produtos);", (err, rows) => {
      if (err || !rows) {
        console.error('Erro ao verificar a tabela produtos:', err?.message);
        return;
      }

      const criarIndiceCodigo = () => db.run(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras)',
        erroIndice => {
          if (erroIndice) console.error('Erro ao garantir códigos de barras únicos:', erroIndice.message);
        }
      );
      const temCodigoBarras = rows.some(coluna => coluna.name === 'codigo_barras');
      if (temCodigoBarras) return criarIndiceCodigo();

      db.run('ALTER TABLE produtos ADD COLUMN codigo_barras TEXT', erroColuna => {
        if (erroColuna) {
          console.error('Erro ao adicionar a coluna codigo_barras:', erroColuna.message);
          return;
        }
        console.log('Coluna codigo_barras adicionada à tabela produtos com sucesso.');
        criarIndiceCodigo();
      });
    });
  }

  return db;
}

module.exports = { conectar, inicializarBanco };
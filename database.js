const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'mercadinho.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Função para abrir a conexão com o banco
function conectar() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Erro ao conectar ao SQLite:', err.message);
    }
  });
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
  }

  return db;
}

module.exports = { conectar, inicializarBanco };
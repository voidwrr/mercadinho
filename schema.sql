CREATE TABLE "produtos" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL CHECK("unidade" IN ('un', 'cx', 'fd', 'pct', 'kg', 'lt')),
    "preco_custo" REAL DEFAULT 0.0,
    "preco_venda" REAL DEFAULT 0.0,
    "estoque_minimo" REAL DEFAULT 0.0,
    "ativo"  INTEGER DEFAULT 1,
    "criado_em" DATETIME DEFAUlT CURRENT_TIMESTAMP
);

CREATE TABLE "estoque" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "produto_id" INTEGER NOT NULL,
    "venda_id" INTEGER,
    "movimentacao" TEXT CHECK("movimentacao" IN ('compra', 'venda', 'ajuste')),
    "qtd" REAL NOT NULL,
    "obs" TEXT,
    "criado_em" DATETIME DEFAUlT CURRENT_TIMESTAMP,
    FOREIGN KEY "produto_id" REFERENCES ("produtos"."id"),
    FOREIGN KEY "venda_id" REFERENCES ("vendas"."id")
);

CREATE TABLE "vendas" (
    "id" INTEGER,

)
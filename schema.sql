PRAGMA foreign_keys = ON;

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

CREATE TABLE "vendas" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "subtotal" REAL NOT NULL,
    "desconto" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    "forma_pagamento" TEXT NOT NULL CHECK("forma_pagamento" IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito'))
);

CREATE TABLE "estoque" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "produto_id" INTEGER NOT NULL,
    "venda_id" INTEGER,
    "movimentacao" TEXT CHECK("movimentacao" IN ('compra', 'venda', 'ajuste')),
    "qtd" REAL NOT NULL,
    "obs" TEXT,
    "criado_em" DATETIME DEFAUlT CURRENT_TIMESTAMP,
    FOREIGN KEY ("produto_id") REFERENCES "produtos"("id"),
    FOREIGN KEY ("venda_id") REFERENCES "vendas"("id")
);

CREATE TABLE "vendas_itens" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "venda_id" INTEGER NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "qtd" REAL NOT NULL,
    "preco" REAL NOT NULL,
    "desconto" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    FOREIGN KEY ("venda_id") REFERENCES "vendas"("id"),
    FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
);

CREATE VIEW "vw_estoque_atual" AS
SELECT "produtos"."id", "nome", "unidade", "preco_venda", "estoque_minimo", COALESCE(SUM("estoque"."qtd"), 0) AS "saldo_atual"
FROM "produtos"
LEFT JOIN "estoque" ON "produtos"."id" = "estoque"."produto_id"
WHERE "ativo" = 1
GROUP BY "produtos"."id";

CREATE VIEW "vw_produtos_estoque_baixo" AS
SELECT *
FROM "vw_estoque_atual"
WHERE "saldo_atual" <= "estoque_minimo";

CREATE VIEW "vw_produtos_ativo" AS
SELECT "id", "nome", "unidade", "preco_custo", "preco_venda", "estoque_minimo", "criado_em"
FROM "produtos"
WHERE "ativo" = 1;

CREATE TRIGGER "trg_produto_delete"
INSTEAD OF 
DELETE ON "vw_produtos_ativo"
BEGIN
    UPDATE "produtos" 
    SET "ativo" = 0
    WHERE "id" = OLD."id"
END;

CREATE TRIGGER "trg_venda_itens"
AFTER INSERT ON "vendas_itens"
FOR EACH ROW
BEGIN
    INSERT INTO "estoque" ("produto_id", "venda_id", "movimentacao", "qtd", "obs")
    VALUES (NEW."produto_id", NEW."venda_id", 'venda', -NEW."qtd", 'Baixa automatica por venda')
END;
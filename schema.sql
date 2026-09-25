PRAGMA foreign_keys = ON;

CREATE TABLE "produtos" (
    "id" INTEGER PRIMARY KEY,
    "codigo_barras" TEXT UNIQUE,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL CHECK("unidade" IN ('un', 'cx', 'fd', 'pct', 'kg', 'lt')),
    "preco_custo" REAL DEFAULT 0.0,
    "preco_venda" REAL DEFAULT 0.0,
    "estoque_minimo" REAL DEFAULT 0.0,
    "ativo"  INTEGER DEFAULT 1,
    "criado_em" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "vendas" (
    "id" INTEGER PRIMARY KEY,
    "data" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "subtotal" REAL NOT NULL,
    "desconto" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    "forma_pagamento" TEXT NOT NULL CHECK("forma_pagamento" IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito'))
);

CREATE TABLE "estoque" (
    "id" INTEGER PRIMARY KEY,
    "produto_id" INTEGER NOT NULL,
    "venda_id" INTEGER,
    "movimentacao" TEXT CHECK("movimentacao" IN ('compra', 'venda', 'ajuste', 'estorno')),
    "qtd" REAL NOT NULL,
    "obs" TEXT,
    "criado_em" DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("produto_id") REFERENCES "produtos"("id"),
    FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE SET NULL
);

CREATE TABLE "vendas_itens" (
    "id" INTEGER PRIMARY KEY,
    "venda_id" INTEGER NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "qtd" REAL NOT NULL,
    "preco" REAL NOT NULL,
    "desconto" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE CASCADE,
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
SELECT "id", "codigo_barras", "nome", "unidade", "preco_custo", "preco_venda", "estoque_minimo", "criado_em"
FROM "produtos"
WHERE "ativo" = 1;


-- Soft delete
CREATE TRIGGER "trg_produto_delete"
INSTEAD OF 
DELETE ON "vw_produtos_ativo"
BEGIN
    UPDATE "produtos" 
    SET "ativo" = 0
    WHERE "id" = OLD."id";
END;

-- Baixa automática de estoque
CREATE TRIGGER "trg_venda_itens"
AFTER INSERT ON "vendas_itens"
FOR EACH ROW
BEGIN
    INSERT INTO "estoque" ("produto_id", "venda_id", "movimentacao", "qtd", "obs")
    VALUES (NEW."produto_id", NEW."venda_id", 'venda', -NEW."qtd", 'Baixa automatica por venda');
END;

-- Estorno de estoque
CREATE TRIGGER "trg_venda_itens_delete"
AFTER DELETE ON "vendas_itens"
FOR EACH ROW
BEGIN
    INSERT INTO "estoque" ("produto_id", "venda_id", "movimentacao", "qtd", "obs")
    VALUES (OLD."produto_id", OLD."venda_id", 'estorno', OLD."qtd", 'Estorno por remocao do item');
END;

-- Ajuste de estoque
CREATE TRIGGER "trg_venda_itens_update"
AFTER UPDATE OF "qtd" ON "vendas_itens"
FOR EACH ROW
BEGIN
    INSERT INTO "estoque" ("produto_id", "venda_id", "movimentacao", "qtd", "obs")
    VALUES (
        NEW."produto_id", 
        NEW."venda_id", 
        'ajuste', 
        (OLD."qtd" - NEW."qtd"), 
        'Ajuste de quantidade no item da venda'
    );
END;

-- Otimização de consultas
CREATE INDEX "idx_estoque_produto" ON "estoque"("produto_id");
CREATE INDEX "idx_vendas_itens_venda" ON "vendas_itens"("venda_id");
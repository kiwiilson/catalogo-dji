-- schema.sql — D1 (SQLite)
DROP TABLE IF EXISTS relacoes;
DROP TABLE IF EXISTS produtos;

CREATE TABLE produtos (
  codigo      TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  categoria   TEXT,
  descricao   TEXT,
  novo_nome   TEXT,
  imagem_url  TEXT,
  links       TEXT,
  entrou_em   TEXT,   -- data "YYYY-MM-DD" (SQLite não tem tipo date, guarda como texto)
  saiu_em     TEXT
);

CREATE TABLE relacoes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  principal_codigo  TEXT NOT NULL REFERENCES produtos(codigo) ON DELETE CASCADE,
  principal_nome    TEXT,   -- nome do produto principal
  produto_codigo    TEXT NOT NULL REFERENCES produtos(codigo) ON DELETE CASCADE,
  item_nome         TEXT,   -- nome do produto relacionado
  tipo              TEXT CHECK (tipo IN ('obrigatorio','opcional')),
  quantidade        INTEGER,
  UNIQUE (produto_codigo, principal_codigo)
);

CREATE INDEX idx_produtos_categoria ON produtos(categoria);
CREATE INDEX idx_relacoes_principal ON relacoes(principal_codigo);
CREATE INDEX idx_relacoes_produto   ON relacoes(produto_codigo);

UPDATE relacoes
SET item_nome      = (SELECT nome FROM produtos WHERE produtos.codigo = relacoes.produto_codigo),
    principal_nome = (SELECT nome FROM produtos WHERE produtos.codigo = relacoes.principal_codigo);

-- UPDATE -> wrangler d1 execute catalogo-dji --remote --command "UPDATE relacoes SET item_nome = (SELECT nome FROM produtos WHERE produtos.codigo = relacoes.produto_codigo), principal_nome = (SELECT nome FROM produtos WHERE produtos.codigo = relacoes.principal_codigo);"


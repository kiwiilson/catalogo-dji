// gerar-seed.js — converte data/*.json em seed.sql (D1 / SQLite)
const fs = require('fs')
const path = require('path')

const produtos = JSON.parse(fs.readFileSync(path.join('data', 'produtos.json'), 'utf8'))
const relacoes = JSON.parse(fs.readFileSync(path.join('data', 'relacoes.json'), 'utf8'))

// texto -> literal SQLite (dobra aspas simples). Vazio/null -> NULL
function s(v) {
  if (v === null || v === undefined || v === '') return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}
// número -> direto. Vazio/null -> NULL
function n(v) {
  if (v === null || v === undefined || v === '') return 'NULL'
  return String(v)
}

const out = []
out.push('-- seed.sql — gerado automaticamente a partir de data/*.json')
out.push('')
out.push('-- Produtos')
for (const p of produtos) {
  out.push(
    `INSERT OR IGNORE INTO produtos (codigo, nome, categoria, descricao, novo_nome, imagem_url, links, entrou_em, saiu_em) VALUES (` +
    `${s(p.codigo)}, ${s(p.nome)}, ${s(p.categoria)}, ${s(p.descricao)}, ${s(p.novo_nome)}, ${s(p.imagem_url)}, ${s(p.links)}, ${s(p.entrou_em)}, ${s(p.saiu_em)});`
  )
}
out.push('')
out.push('-- Relações')
for (const r of relacoes) {
  out.push(
    `INSERT OR IGNORE INTO relacoes (produto_codigo, principal_codigo, tipo, quantidade) VALUES (` +
    `${s(r.produto_codigo)}, ${s(r.principal_codigo)}, ${s(r.tipo)}, ${n(r.quantidade)});`
  )
}
out.push('')
out.push('-- Preenche os nomes na relacoes a partir dos códigos')
out.push(
  `UPDATE relacoes\n` +
  `SET item_nome      = (SELECT nome FROM produtos WHERE produtos.codigo = relacoes.produto_codigo),\n` +
  `    principal_nome = (SELECT nome FROM produtos WHERE produtos.codigo = relacoes.principal_codigo);`
)

fs.writeFileSync('seed.sql', out.join('\n'))
console.log(`seed.sql gerado: ${produtos.length} produtos, ${relacoes.length} relações.`)
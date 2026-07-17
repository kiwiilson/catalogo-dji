'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import produtosData from '@/data/produtos.json'
import relacoesData from '@/data/relacoes.json'

type Produto = {
  codigo: string
  nome: string
  categoria: string | null
  descricao: string | null
  novo_nome: string | null
  imagem_url: string | null
  links: string | null
  entrou_em: string | null // 1º dia do mês em que entrou (ou null)
  saiu_em: string | null   // 1º dia do mês em que saiu (null = ainda vigente)
}

type ItemRelacionado = {
  tipo: 'obrigatorio' | 'opcional' | null
  quantidade: number | null
  item: Produto
}

// Dados locais: nada disso faz consulta a um banco externo em tempo de execução.
// Pra atualizar o catálogo, edite a fonte, gere os 2 arquivos de novo e faça o deploy.
const TODOS_PRODUTOS = produtosData as Produto[]
const PRODUTOS_POR_CODIGO: Record<string, Produto> = Object.fromEntries(
  TODOS_PRODUTOS.map((p) => [p.codigo, p])
)
type RelacaoBruta = {
  produto_codigo: string
  principal_codigo: string
  tipo: 'obrigatorio' | 'opcional' | null
  quantidade: number | null
}
const TODAS_RELACOES = relacoesData as RelacaoBruta[]

// Código curto no banco (coluna "categoria") -> rótulo exibido no site.
const ROTULOS_CATEGORIAS: Record<string, string> = {
  drone: 'Drone',
  dock: 'Dock',
  terra: 'DJI Terra',
  payloads: 'Payloads',
  fh2: 'FlightHub 2 - Nuvem',
  fh2op: 'FlightHub 2 - On-Premises',
  fh2aio: 'FlightHub 2 - All in One',
  acessorios: 'Acessórios',
  servicos: 'Serviços',
  outros: 'Outros',
  links: 'Links Úteis',
}

// Ordem dos filtros (use os MESMOS códigos do banco).
const ORDEM_CATEGORIAS = [
  'drone', 'dock', 'terra', 'payloads', 'fh2', 'fh2op', 'fh2aio', 'acessorios', 'servicos', 'outros', 'links',
]

// Cor por categoria (paleta inspirada no mapa de soluções DJI).
// Se faltar, cai no cinza padrão.
const CORES_CATEGORIAS: Record<string, string> = {
  drone: '#10B981',
  dock: '#EF4444',
  terra: '#EAB308',
  payloads: '#A78BFA',
  fh2: '#EAB308',
  fh2op: '#EAB308',
  fh2aio: '#EAB308',
  acessorios: '#3B82F6',
  servicos: '#EC4899',
  outros: '#6B7280',
}
function corCategoria(cod: string | null) {
  if (!cod) return '#6B7280'
  return CORES_CATEGORIAS[cod] ?? '#6B7280'
}

const NOVOS = 'Novos na tabela'
const SAIRAM = 'Saíram da tabela'

function rotuloCategoria(cod: string | null) {
  if (!cod) return ''
  return ROTULOS_CATEGORIAS[cod] ?? cod
}

// Um produto pode estar em mais de uma categoria: a coluna "categoria" aceita
// vários códigos separados por vírgula (ex.: "fh2op,fh2aio").
function categoriasDe(p: Produto): string[] {
  return (p.categoria ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
}

// Nome exibido em cada botão de filtro (TODOS/Novos/Saíram passam direto).
function nomeFiltro(c: string) {
  if (c === 'TODOS' || c === NOVOS || c === SAIRAM) return c
  return rotuloCategoria(c)
}

// Primeiro dia do mês atual e do próximo, no formato 'YYYY-MM-DD'.
function limitesMesAtual() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  const fmt = (a: number, m: number) => `${a}-${String(m + 1).padStart(2, '0')}-01`
  return { ini: fmt(ano, mes), fim: mes === 11 ? fmt(ano + 1, 0) : fmt(ano, mes + 1) }
}

// Uma data 'YYYY-MM-DD' cai no mês atual? (comparação de string, sem depender de fuso)
function noMes(data: string | null, ini: string, fim: string) {
  return !!data && data >= ini && data < fim
}

// Aceita 1 link por linha. Formato opcional: "Rótulo | https://...".
function parseLinks(raw: string | null): { label: string; url: string }[] {
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const partes = linha.split('|')
      if (partes.length >= 2) {
        const label = partes[0].trim()
        const url = partes.slice(1).join('|').trim()
        return { label: label || 'Link', url }
      }
      const url = linha
      let label = 'Link'
      try {
        const arquivo = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
        if (arquivo) label = arquivo.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ')
      } catch {}
      return { label, url }
    })
}

// Estilos que dependem de :hover / :focus / @keyframes / scrollbar não dão pra
// fazer via inline style, então vão neste bloco de CSS global.
const CSS = `
.cat-pill { border: none; cursor: pointer; padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: .3px; background: #F3F4F6; color: #6B7280; transition: all .15s ease; }
.cat-pill:hover { background: #E5E7EB; color: #374151; }
.cat-pill.ativo, .cat-pill.ativo:hover { background: #3355FF; color: #fff; }
.cat-card { transition: all .2s ease; }
.cat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,.1); }
.cat-busca { border: 1px solid #ddd; }
.cat-busca:focus { outline: none; border-color: #3355FF; box-shadow: 0 0 0 3px rgba(51,85,255,.1); }
.cat-grid { animation: catFade .25s ease; }
@keyframes catFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
::-webkit-scrollbar-track { background: #F1F5F9; }
`

function Links({
  raw,
  wrapStyle,
  btnStyle,
}: {
  raw: string | null
  wrapStyle: CSSProperties
  btnStyle: CSSProperties
}) {
  const links = parseLinks(raw)
  if (links.length === 0) return null
  return (
    <div style={wrapStyle}>
      {links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" style={btnStyle}>
          {l.label}
        </a>
      ))}
    </div>
  )
}

function SemFoto({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ccc"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

// Etiquetas coloridas de categoria (uma por código da coluna "categoria").
function CategoriaBadges({ produto }: { produto: Produto }) {
  const cats = categoriasDe(produto)
  if (cats.length === 0) return null
  return (
    <div style={s.badgesWrap}>
      {cats.map((c) => {
        const cor = corCategoria(c)
        return (
          <span
            key={c}
            style={{ ...s.catBadge, color: cor, background: cor + '1A', borderColor: cor + '33' }}
          >
            {rotuloCategoria(c).toUpperCase()}
          </span>
        )
      })}
    </div>
  )
}

export default function Home() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('TODOS')
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<Produto | null>(null)

  const { ini, fim } = useMemo(() => limitesMesAtual(), [])

  useEffect(() => {
    setProdutos(TODOS_PRODUTOS)
    setCarregando(false)
  }, [])

  const categorias = useMemo(() => {
    const presentes = Array.from(
      new Set(produtos.flatMap((p) => categoriasDe(p)))
    )
    presentes.sort((a, b) => {
      const ia = ORDEM_CATEGORIAS.indexOf(a)
      const ib = ORDEM_CATEGORIAS.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return ['TODOS', ...presentes, NOVOS, SAIRAM]
  }, [produtos])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    const bateBusca = (p: Produto) =>
      !termo ||
      p.nome.toLowerCase().includes(termo) ||
      p.codigo.toLowerCase().includes(termo) ||
      (p.novo_nome?.toLowerCase().includes(termo) ?? false) ||
      (p.descricao?.toLowerCase().includes(termo) ?? false)

    const ordena = (lista: Produto[]) =>
      [...lista].sort((a, b) =>
        (a.novo_nome || a.nome).localeCompare(b.novo_nome || b.nome, 'pt', {
          sensitivity: 'base',
        })
      )

    return ordena(
      produtos.filter((p) => {
        if (!bateBusca(p)) return false
        if (categoria === NOVOS) return noMes(p.entrou_em, ini, fim)
        if (categoria === SAIRAM) return noMes(p.saiu_em, ini, fim)
        return categoria === 'TODOS' || categoriasDe(p).includes(categoria)
      })
    )
  }, [produtos, busca, categoria, ini, fim])

  return (
    <main className="cat-main" style={s.main}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="cat-cabecalho" style={s.cabecalho}>
        <div>
          <h1 style={s.titulo}>Produtos DJI Enterprise</h1>
          <p style={s.subtitulo}>
            Selecione um produto para ver os itens obrigatórios e opcionais.<br></br>
            <em>Clique na imagem para ampliar. Links abrem em nova aba.</em><br></br>
            <em>Fotos meramente ilustrativas. Verifique as especificações técnicas para maiores detalhes.</em>


          </p>
        </div>
        <img
          src="/logo-dji-intelbras.png"
          alt="DJI Enterprise — Distribuído por Intelbras"
          style={s.logo}
        />
      </header>

      <input
        className="cat-busca"
        style={s.busca}
        placeholder="Buscar por nome, código ou descrição…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="cat-filtros" style={s.filtros}>
        {categorias.map((c) => (
          <button
            key={c}
            className={'cat-pill' + (categoria === c ? ' ativo' : '')}
            onClick={() => setCategoria(c)}
          >
            {nomeFiltro(c).toUpperCase()}
          </button>
        ))}
      </div>

      <p style={s.contagem}>
        Mostrando: <strong>{categoria}</strong> — {filtrados.length} item(s)
      </p>

      {carregando ? (
        <p>Carregando…</p>
      ) : (
        <div className="cat-grid" style={s.grid} key={categoria}>
          {filtrados.map((p) => (
            <button key={p.codigo} className="cat-card" style={s.card} onClick={() => setSelecionado(p)}>
              <div style={s.imgWrap}>
                {noMes(p.saiu_em, ini, fim) ? (
                  <span style={s.badgeSaiu}>SAIU</span>
                ) : noMes(p.entrou_em, ini, fim) ? (
                  <span style={s.badgeNovo}>NOVO</span>
                ) : null}
                {p.imagem_url ? (
                  <img src={p.imagem_url} alt={p.nome} style={s.img} />
                ) : (
                  <SemFoto size={40} />
                )}
              </div>
              <div style={s.cardCorpo}>
                <CategoriaBadges produto={p} />
                <span style={s.cardNome}>{p.novo_nome || p.nome}</span>
                <span style={s.cardCodigo}>{p.codigo}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selecionado && (
        <Detalhe produto={selecionado} onFechar={() => setSelecionado(null)} />
      )}
    </main>
  )
}

function Detalhe({ produto, onFechar }: { produto: Produto; onFechar: () => void }) {
  const [itens, setItens] = useState<ItemRelacionado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [fotoZoom, setFotoZoom] = useState<string | null>(null)

  useEffect(() => {
    setCarregando(true)
    const norm: ItemRelacionado[] = TODAS_RELACOES.filter(
      (r) => r.principal_codigo === produto.codigo
    )
      .map((r) => ({
        tipo: r.tipo,
        quantidade: r.quantidade,
        item: PRODUTOS_POR_CODIGO[r.produto_codigo],
      }))
      .filter((r): r is ItemRelacionado => !!r.item)
    norm.sort((a, b) =>
      (a.item.novo_nome || a.item.nome).localeCompare(
        b.item.novo_nome || b.item.nome,
        'pt',
        { sensitivity: 'base' }
      )
    )
    setItens(norm)
    setCarregando(false)
  }, [produto.codigo])

  const obrigatorios = itens.filter((i) => i.tipo === 'obrigatorio')
  const compativeis = itens.filter((i) => i.tipo !== 'obrigatorio')

  return (
    <>
    <div style={s.overlay} onClick={onFechar}>
      <div className="cat-modal" style={s.modal} onClick={(e) => e.stopPropagation()}>
        <button style={s.fechar} onClick={onFechar}>×</button>
        <div className="cat-modal-header" style={s.modalHeader}>
          {produto.imagem_url ? (
            <img
              src={produto.imagem_url}
              alt={produto.nome}
              style={s.modalImg} 
              onClick={() => setFotoZoom(produto.imagem_url)}
            />
          ) : (
            <div style={s.modalImgVazia}>
              <SemFoto size={40} />
            </div>
          )}
          <div>
            <CategoriaBadges produto={produto} />
            <h2 style={s.modalTitulo}>{produto.novo_nome || produto.nome}</h2>
            <span style={s.cardCodigo}>Código: {produto.codigo}</span>
            {produto.descricao && <p style={s.modalDesc}>{produto.descricao}</p>}
            <Links raw={produto.links} wrapStyle={s.links} btnStyle={s.linkBtn} />
          </div>
        </div>

        {carregando ? (
          <p>Carregando itens…</p>
        ) : (
          <>
            <Secao titulo="Itens obrigatórios" itens={obrigatorios} vazio="Nenhum item obrigatório cadastrado." />
            <Secao titulo="Outros itens compatíveis" itens={compativeis} vazio="Nenhum outro item compatível cadastrado." />
          </>
        )}
      </div>
    </div>
    {fotoZoom && (
      <div style={s.lightbox} onClick={() => setFotoZoom(null)}>
        <img src={fotoZoom} alt={produto.nome} style={s.lightboxImg} />
      </div>
    )}
    </>
  )
}

function Secao({
  titulo,
  itens,
  vazio,
}: {
  titulo: string
  itens: ItemRelacionado[]
  vazio: string
}) {
  return (
    <section style={s.secao}>
      <h3 style={s.secaoTitulo}>{titulo}</h3>
      {itens.length === 0 ? (
        <p style={s.vazio}>{vazio}</p>
      ) : (
        <ul style={s.lista}>
          {itens.map((i) => (
            <li key={i.item.codigo} style={s.itemLinha}>
              <div style={s.itemImgWrap}>
                {i.item.imagem_url ? (
                  <img src={i.item.imagem_url} alt={i.item.nome} style={s.itemImg} />
                ) : (
                  <SemFoto size={20} />
                )}
              </div>
              <div style={s.itemCorpo}>
                <div style={s.itemNome}>
                  {i.item.novo_nome || i.item.nome}
                  {i.quantidade ? <span style={s.qtd}> × {i.quantidade}</span> : null}
                </div>
                <div style={s.itemCodigo}>{i.item.codigo}</div>
                {i.item.descricao && <div style={s.itemDesc}>{i.item.descricao}</div>}
                <Links raw={i.item.links} wrapStyle={s.itemLinks} btnStyle={s.linkBtnSm} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const s: Record<string, CSSProperties> = {
  main: { maxWidth: 1200, margin: '0 auto', padding: '32px 20px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#111' },
  cabecalho: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, marginBottom: 24 },
  logo: { height: 120, width: 'auto', flexShrink: 0 },
  titulo: { fontSize: 32, fontWeight: 700, margin: 0 },
  subtitulo: { color: '#666', marginTop: 4, marginBottom: 0 },
  busca: { width: '100%', padding: '12px 16px', fontSize: 16, borderRadius: 10, marginBottom: 16, boxSizing: 'border-box' },
  filtros: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  contagem: { color: '#666', fontSize: 14, margin: '0 0 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 },
  card: { textAlign: 'left', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden', background: '#fff', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column' },
  imgWrap: { height: 150, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, boxSizing: 'border-box', position: 'relative' },
  img: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  badgeNovo: { position: 'absolute', top: 8, left: 8, background: '#3355FF', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999, letterSpacing: 0.5 },
  badgeSaiu: { position: 'absolute', top: 8, left: 8, background: '#c33', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999, letterSpacing: 0.5 },
  cardCorpo: { padding: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  badgesWrap: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  catBadge: { display: 'inline-flex', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: '2px 7px', borderRadius: 5, border: '1px solid transparent', textTransform: 'uppercase' },
  cardNome: { fontSize: 14, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 36 },
  cardCodigo: { fontSize: 12, color: '#999' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 },
  modal: { background: '#fff', borderRadius: 16, maxWidth: 720, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 28, position: 'relative' },
  fechar: { position: 'absolute', top: 14, right: 16, border: 'none', background: 'transparent', fontSize: 28, lineHeight: 1, cursor: 'pointer', color: '#888' },
  modalHeader: { display: 'flex', gap: 16, marginBottom: 20 },
  modalImg: { width: 120, height: 120, objectFit: 'contain', background: '#fff', borderRadius: 10, cursor: 'zoom-in' },
  modalImgVazia: { width: 120, height: 120, background: '#fafafa', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  modalTitulo: { fontSize: 22, fontWeight: 700, margin: '6px 0 4px' },
  modalDesc: { color: '#555', fontSize: 14, marginTop: 6 },
  links: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  linkBtn: { fontSize: 13, fontWeight: 600, textDecoration: 'none', color: '#3355FF', border: '1px solid #3355FF', borderRadius: 8, padding: '6px 10px' },
  secao: { marginTop: 20 },
  secaoTitulo: { fontSize: 15, fontWeight: 700, borderBottom: '2px solid #f0f0f0', paddingBottom: 6, marginBottom: 10 },
  vazio: { color: '#aaa', fontSize: 14 },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  itemLinha: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  itemCorpo: { flex: 1 },
  itemImgWrap: { width: 48, height: 48, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemImg: { width: '100%', height: '100%', objectFit: 'contain' },
  itemNome: { fontSize: 14, fontWeight: 600 },
  qtd: { color: '#3355FF', fontWeight: 700 },
  itemCodigo: { fontSize: 12, color: '#999' },
  itemDesc: { fontSize: 13, color: '#666', marginTop: 2 },
  itemLinks: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  linkBtnSm: { fontSize: 12, fontWeight: 600, textDecoration: 'none', color: '#3355FF', border: '1px solid #3355FF', borderRadius: 6, padding: '3px 8px' },
  lightbox: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, zIndex: 60, cursor: 'zoom-out' },
  lightboxImg: { maxWidth: '80vw', maxHeight: '80vh', objectFit: 'contain', background: '#fff', borderRadius: 8 },
}

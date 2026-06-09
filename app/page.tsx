'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Produto = {
  codigo: string
  nome: string
  categoria: string | null
  descricao: string | null
  novo_nome: string | null
  imagem_url: string | null
}

type ItemRelacionado = {
  tipo: 'obrigatorio' | 'opcional' | null
  quantidade: number | null
  item: Produto
}

const ORDEM_CATEGORIAS = [
  'Drone', 'Dock', 'FH2', 'Terra', 'Payloads M400', 'Acessórios', 'Serviços', 'Outros',
]

export default function Home() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('TODOS')
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState<Produto | null>(null)

  useEffect(() => {
    supabase
      .from('produtos')
      .select('*')
      .order('nome')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setProdutos(data ?? [])
        setCarregando(false)
      })
  }, [])

  const categorias = useMemo(() => {
    const presentes = Array.from(
      new Set(produtos.map((p) => p.categoria).filter(Boolean))
    ) as string[]
    presentes.sort((a, b) => {
      const ia = ORDEM_CATEGORIAS.indexOf(a)
      const ib = ORDEM_CATEGORIAS.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return ['TODOS', ...presentes]
  }, [produtos])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return produtos
      .filter((p) => {
        const okCat = categoria === 'TODOS' || p.categoria === categoria
        const okBusca =
          !termo ||
          p.nome.toLowerCase().includes(termo) ||
          p.codigo.toLowerCase().includes(termo)
        return okCat && okBusca
      })
      .sort((a, b) =>
        (a.novo_nome || a.nome).localeCompare(b.novo_nome || b.nome, 'pt', {
          sensitivity: 'base',
        })
      )
  }, [produtos, busca, categoria])

  return (
    <main style={s.main}>
      <h1 style={s.titulo}>Catálogo DJI</h1>
      <p style={s.subtitulo}>
        Selecione um produto para ver os itens obrigatórios e opcionais.
      </p>

      <input
        style={s.busca}
        placeholder="Buscar por nome ou código…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div style={s.filtros}>
        {categorias.map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            style={{ ...s.filtroBtn, ...(categoria === c ? s.filtroBtnAtivo : {}) }}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      <p style={s.contagem}>
        Mostrando: <strong>{categoria}</strong> — {filtrados.length} item(s)
      </p>

      {carregando ? (
        <p>Carregando…</p>
      ) : (
        <div style={s.grid}>
          {filtrados.map((p) => (
            <button key={p.codigo} style={s.card} onClick={() => setSelecionado(p)}>
              <div style={s.imgWrap}>
                {p.imagem_url ? (
                  <img src={p.imagem_url} alt={p.nome} style={s.img} />
                ) : (
                  <span style={s.imgPlaceholder}>sem imagem</span>
                )}
              </div>
              <div style={s.cardCorpo}>
                <span style={s.cardCat}>{p.categoria}</span>
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

  useEffect(() => {
    setCarregando(true)
    supabase
      .from('relacoes')
      .select(
        'tipo, quantidade, item:produtos!relacoes_produto_codigo_fkey(codigo, nome, descricao, imagem_url, categoria, novo_nome)'
      )
      .eq('principal_codigo', produto.codigo)
      .then(({ data, error }) => {
        if (error) console.error(error)
        const norm: ItemRelacionado[] = (data ?? [])
          .map((r: any) => ({
            tipo: r.tipo,
            quantidade: r.quantidade,
            item: Array.isArray(r.item) ? r.item[0] : r.item,
          }))
          .filter((r) => r.item)
        norm.sort((a, b) =>
          (a.item.novo_nome || a.item.nome).localeCompare(
            b.item.novo_nome || b.item.nome,
            'pt',
            { sensitivity: 'base' }
          )
        )
        setItens(norm)
        setCarregando(false)
      })
  }, [produto.codigo])

  const obrigatorios = itens.filter((i) => i.tipo === 'obrigatorio')
  const opcionais = itens.filter((i) => i.tipo === 'opcional')
  const outros = itens.filter((i) => i.tipo !== 'obrigatorio' && i.tipo !== 'opcional')

  return (
    <div style={s.overlay} onClick={onFechar}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <button style={s.fechar} onClick={onFechar}>×</button>
        <div style={s.modalHeader}>
          {produto.imagem_url && (
            <img src={produto.imagem_url} alt={produto.nome} style={s.modalImg} />
          )}
          <div>
            <span style={s.cardCat}>{produto.categoria}</span>
            <h2 style={s.modalTitulo}>{produto.novo_nome || produto.nome}</h2>
            <span style={s.cardCodigo}>Código: {produto.codigo}</span>
            {produto.descricao && <p style={s.modalDesc}>{produto.descricao}</p>}
          </div>
        </div>

        {carregando ? (
          <p>Carregando itens…</p>
        ) : (
          <>
            <Secao titulo="Itens obrigatórios" itens={obrigatorios} vazio="Nenhum item obrigatório é necessário para esse item." />
            <Secao titulo="Acessórios opcionais" itens={opcionais} vazio="Nenhum acessório opcional para esse item." />
            {outros.length > 0 && (
              <Secao titulo="Outros itens compatíveis" itens={outros} vazio="" />
            )}
          </>
        )}
      </div>
    </div>
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
                  <span style={s.imgPlaceholderSm}>—</span>
                )}
              </div>
              <div style={s.itemCorpo}>
                <div style={s.itemNome}>
                  {i.item.novo_nome || i.item.nome}
                  {i.quantidade ? <span style={s.qtd}> × {i.quantidade}</span> : null}
                </div>
                <div style={s.itemCodigo}>{i.item.codigo}</div>
                {i.item.descricao && <div style={s.itemDesc}>{i.item.descricao}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const s: Record<string, CSSProperties> = {
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, sans-serif', color: '#000000' },
  titulo: { fontSize: 50, fontWeight: 700, margin: 0 },
  subtitulo: { color: '#171717', marginTop: 4, marginBottom: 24 },
  busca: { width: '100%', padding: '12px 16px', fontSize: 16, border: '1px solid #000', borderRadius: 10, marginBottom: 16, boxSizing: 'border-box' },
  filtros: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filtroBtn: { padding: '8px 14px', fontSize: 13, fontWeight: 600, border: '1px solid #000', borderRadius: 999, background: '#ffffff', color: '#444', cursor: 'pointer' },
  filtroBtnAtivo: { background: '#155dfc', color: '#fff', borderColor: '#155dfc' },
  contagem: { color: '#444', fontSize: 14, margin: '8px 0 20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  card: { textAlign: 'left', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden', background: '#fff', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column' },
  imgWrap: { aspectRatio: '4 / 3', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%', objectFit: 'contain' },
  imgPlaceholder: { color: '#bbb', fontSize: 13 },
  cardCorpo: { padding: 12, display: 'flex', flexDirection: 'column', gap: 4 },
  cardCat: { fontSize: 11, fontWeight: 700, color: '#155dfc', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardNome: { fontSize: 14, fontWeight: 600, lineHeight: 1.3 },
  cardCodigo: { fontSize: 12, color: '#444' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 },
  modal: { background: '#fff', borderRadius: 16, maxWidth: 720, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 28, position: 'relative' },
  fechar: { position: 'absolute', top: 14, right: 16, border: 'none', background: 'transparent', fontSize: 28, lineHeight: 1, cursor: 'pointer', color: '#888' },
  modalHeader: { display: 'flex', gap: 16, marginBottom: 20 },
  modalImg: { width: 120, height: 120, objectFit: 'contain', background: '#f5f5f5', borderRadius: 10 },
  modalTitulo: { fontSize: 22, fontWeight: 700, margin: '4px 0' },
  modalDesc: { color: '#555', fontSize: 14, marginTop: 6 },
  secao: { marginTop: 20 },
  secaoTitulo: { fontSize: 15, fontWeight: 700, borderBottom: '2px solid #f0f0f0', paddingBottom: 6, marginBottom: 10 },
  vazio: { color: '#aaa', fontSize: 14 },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  itemLinha: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  itemCorpo: { flex: 1 },
  itemImgWrap: { width: 48, height: 48, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemImg: { width: '100%', height: '100%', objectFit: 'contain' },
  imgPlaceholderSm: { color: '#ccc', fontSize: 12 },
  itemNome: { fontSize: 14, fontWeight: 600 },
  qtd: { color: '#155dfc', fontWeight: 700 },
  itemCodigo: { fontSize: 12, color: '#999' },
  itemDesc: { fontSize: 13, color: '#666', marginTop: 2 },
}
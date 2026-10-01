import { useId } from 'react'
import { MESES_CURTOS, variacaoPct } from '../../domain/painelCarteira'
import type { FatiaComposicao, Painel, PontoMensal, ProximosProventos } from '../../domain/painelCarteira'
import { BarraComposicao, GraficoArea, GraficoBarras, corDaCategoria } from './Graficos'
import { dataCurta, pct, reais } from './formatar'

function Delta({ valor, texto }: { valor: number; texto: string }) {
  const positivo = valor >= 0
  return (
    <span className={`mc-delta ${positivo ? 'mc-pos' : 'mc-neg'}`}>
      <span aria-hidden="true">{positivo ? '▲' : '▼'}</span> {texto}
    </span>
  )
}

const rotulo = (p: PontoMensal | undefined) => (p ? `${p.rotulo}/${p.mes.slice(2, 4)}` : '')

export function CartaoCarteira({ painel, serie }: { painel: Painel; serie: PontoMensal[] }) {
  const idTitulo = useId()
  const { resumo } = painel
  const temPatrimonio = resumo.patrimonio !== null
  const valorGrande = temPatrimonio ? resumo.patrimonio! : resumo.capitalAplicado
  const temSerie = serie.some((p) => p.valor > 0)
  const primeiro = serie[0]
  const ultimo = serie[serie.length - 1]

  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="mc-titulo">Carteira</h2>
      <div className="mc-rotulo">
        {temPatrimonio ? `Patrimônio em ${dataCurta(resumo.dataPosicao!)}` : 'Total investido'}
      </div>
      <div className="mc-valor">{reais(valorGrande)}</div>
      {!temPatrimonio && <div className="mc-nota">pelo preço que você pagou</div>}

      {resumo.resultado ? (
        <div className="mc-linha-delta">
          <Delta valor={resumo.resultado.valor} texto={`${pct(resumo.resultado.pct)} · ${reais(resumo.resultado.valor)}`} />
          <span className="mc-nota">
            calculado sobre {Math.round(resumo.resultado.cobertura * 100)}% da carteira
          </span>
        </div>
      ) : (
        temPatrimonio && <div className="mc-nota">Sem resultado ainda: faltam preços médios (veja a conferência abaixo).</div>
      )}
      {temPatrimonio && <div className="mc-nota">Investido nos ativos com preço médio conhecido: {reais(resumo.capitalAplicado)}</div>}

      {temSerie ? (
        <>
          <GraficoArea
            pontos={serie}
            ariaLabel={`Total investido, pelo preço pago: de ${reais(primeiro.valor)} em ${rotulo(primeiro)} a ${reais(ultimo.valor)} em ${rotulo(ultimo)}`}
          />
          <div className="mc-legenda">{temPatrimonio ? 'Total investido nos ativos que você tem hoje, mês a mês' : 'Total investido, mês a mês'}</div>
        </>
      ) : (
        <div className="mc-vazio-mini">Importe seus arquivos para ver a evolução.</div>
      )}
    </section>
  )
}

export function CartaoProventos({ serie, proximos }: { serie: PontoMensal[]; proximos: ProximosProventos | null }) {
  const idTitulo = useId()
  const total = serie.reduce((s, p) => s + p.valor, 0)
  const n = serie.length
  // O mês corrente ainda está em andamento: a comparação usa os dois meses fechados anteriores.
  const fechado = serie[n - 2]
  const anterior = serie[n - 3]
  const delta = fechado && anterior ? variacaoPct(fechado.valor, anterior.valor) : null
  const nomeMes = (m: PontoMensal) => MESES_CURTOS[Number(m.mes.slice(5, 7)) - 1]

  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="mc-titulo">Proventos</h2>
      <div className="mc-rotulo">Recebido nos últimos 12 meses</div>
      <div className="mc-valor">{reais(total)}</div>
      {delta !== null && fechado && anterior && (
        <div className="mc-linha-delta">
          <Delta valor={delta} texto={pct(delta)} />
          <span className="mc-nota">{nomeMes(fechado)} vs. {nomeMes(anterior)}</span>
        </div>
      )}
      {total > 0 ? (
        <GraficoBarras
          pontos={serie}
          destaques={2}
          ariaLabel={`Proventos recebidos por mês nos últimos 12 meses, total de ${reais(total)}`}
        />
      ) : (
        <div className="mc-vazio-mini">Ainda sem proventos. Envie o extrato de Movimentação.</div>
      )}
      {proximos && (
        <div className="mc-proximos">
          <div>
            <span className="mc-rotulo">Próximo pagamento</span>
            <div className="mc-destaque">
              {reais(proximos.totalNaData)} <span className="mc-nota">em {dataCurta(proximos.proximaData)} · {proximos.ativosNaData} ativo(s)</span>
            </div>
          </div>
          <div className="mc-nota">
            Anunciado a receber: {reais(proximos.totalAReceber)} em {proximos.ativosAReceber} ativo(s)
          </div>
        </div>
      )}
    </section>
  )
}

export function CartaoComposicao({ fatias }: { fatias: FatiaComposicao[] }) {
  const idTitulo = useId()
  if (!fatias.length) return null
  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="mc-titulo">Composição</h2>
      <div className="mc-rotulo">Por tipo de ativo</div>
      <BarraComposicao fatias={fatias} ariaLabel={`Composição do patrimônio: ${fatias.map((f) => `${f.rotulo} ${f.pct.toFixed(0)}%`).join(', ')}`} />
      <ul className="mc-legenda-lista">
        {fatias.map((f) => (
          <li key={f.categoria}>
            <span className="mc-bolinha" style={{ background: corDaCategoria(f.categoria) }} aria-hidden="true" />
            <span className="mc-leg-nome">{f.rotulo}</span>
            <span className="mc-leg-valor">{reais(f.valor)}</span>
            <span className="mc-leg-pct">{f.pct.toFixed(1).replace('.', ',')}%</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Cartão "de exemplo" mostrado ANTES de a pessoa importar qualquer coisa: o mesmo desenho dos cartões
 * reais, em cinza e tracejado, com a etiqueta "Exemplo" e o valor em "R$ —". Serve para a pessoa ver
 * o que vai ganhar. A forma do gráfico é decorativa e fica escondida de leitores de tela; nenhum
 * número aparece, para ninguém confundir com dado de verdade.
 */
const FORMA_AREA = [8, 10, 9, 13, 15, 14, 19, 22, 21, 26, 29, 33]
const FORMA_BARRAS = [5, 9, 6, 12, 8, 14, 10, 16, 13, 18, 11, 15]
const comoSerie = (valores: number[]): PontoMensal[] => valores.map((valor, i) => ({ mes: `2000-${String(i + 1).padStart(2, '0')}`, rotulo: MESES_CURTOS[i], valor }))

export function CartaoVazio({ titulo, rotulo, tipo }: { titulo: string; rotulo: string; tipo: 'area' | 'barras' | 'composicao' }) {
  const idTitulo = useId()
  return (
    <section className="mc-card mc-cartao-vazio" aria-labelledby={idTitulo}>
      <div className="mc-topo-linha">
        <h2 id={idTitulo} className="mc-titulo">{titulo}</h2>
        <span className="mc-selo neutro">Exemplo</span>
      </div>
      <div className="mc-rotulo">{rotulo}</div>
      <div className="mc-valor">R$ —</div>
      <div className="mc-fantasma" aria-hidden="true">
        {tipo === 'area' && <GraficoArea pontos={comoSerie(FORMA_AREA)} ariaLabel="" decorativo />}
        {tipo === 'barras' && <GraficoBarras pontos={comoSerie(FORMA_BARRAS)} ariaLabel="" destaques={0} decorativo />}
        {tipo === 'composicao' && (
          <BarraComposicao
            ariaLabel=""
            decorativo
            fatias={[
              { categoria: 'outra', rotulo: '', pct: 45 },
              { categoria: 'outra', rotulo: '', pct: 30 },
              { categoria: 'outra', rotulo: '', pct: 25 },
            ].map((f, i) => ({ ...f, categoria: `exemplo${i}` }))}
          />
        )}
      </div>
    </section>
  )
}

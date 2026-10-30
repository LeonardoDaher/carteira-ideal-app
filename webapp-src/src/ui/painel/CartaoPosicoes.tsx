import { useId, useState } from 'react'
import type { ClasseCarteira } from '../../domain/classificadorAtivo'
import type { CategoriaPosicao } from '../../domain/importacao/planilha'
import { agruparPosicoes } from '../../domain/painelCarteira'
import type { LinhaPosicao, OrigemPrecoMedio } from '../../domain/painelCarteira'
import { ChevronDownIcon, PencilIcon } from '../Icon'
import { MiniPizza } from './Graficos'
import { PainelEdicaoAtivo } from './PainelEdicaoAtivo'
import type { AcoesPainel } from './PainelEdicaoAtivo'
import { dataCurta, pct } from './formatar'
import { useValores } from './valoresOcultos'
import { LogoAtivo } from '../LogoAtivo'

const ORIGEM: Record<OrigemPrecoMedio, string> = {
  calculado: 'Calculado pelos seus lançamentos',
  b3: 'Valor aplicado informado pela B3',
  informado: 'Informado por você',
}

function LinhaDoAtivo({ l, onEditar, onVerLancamentos }: { l: LinhaPosicao; onEditar: () => void; onVerLancamentos: (ativo: string) => void }) {
  const { reais, quantidade: quantidadeBR, resultadoPct } = useValores()
  return (
    <li className="mc-posicao">
      <div className="mc-pos-topo">
        <button type="button" className="mc-lapis" aria-label={`Editar ${l.ativo}`} title="Editar" onClick={onEditar}>
          <PencilIcon size={16} />
        </button>
        <strong>
          {/^[A-Z0-9]{4}\d{1,2}$/.test(l.ativo) && <LogoAtivo ticker={l.ativo} tamanho={24} inline />}
          {l.ativo}
        </strong>
        <span className="mc-nota">{quantidadeBR(l.quantidade)} un.</span>
        {l.status === 'faltaSaldoAnterior' && <span className="mc-selo faltaSaldoAnterior">Sem preço médio</span>}
        {l.aguardandoLiquidacao && <span className="mc-selo info">Aguardando liquidação</span>}
        {l.manual && <span className="mc-selo neutro">Digitado por você</span>}
        {!l.manual && (
          <button type="button" className="mc-link-linha" aria-label={`Ver lançamentos de ${l.ativo}`} onClick={() => onVerLancamentos(l.ativo)}>
            Ver lançamentos ›
          </button>
        )}
      </div>
      <div className="mc-pos-numeros">
        <div className="mc-pos-num">
          <span className="mc-nota">Preço médio</span>
          <span>{l.precoMedio !== null ? reais(l.precoMedio) : '—'}</span>
          {l.origemPrecoMedio && l.origemPrecoMedio !== 'calculado' && !l.manual && <span className="mc-nota">{ORIGEM[l.origemPrecoMedio]}</span>}
        </div>
        <div className="mc-pos-num">
          <span className="mc-nota">{l.valorAtual !== null ? 'Valor atual' : 'Custo'}</span>
          <span>{l.valorAtual !== null ? reais(l.valorAtual) : l.custoTotal !== null ? reais(l.custoTotal) : '—'}</span>
        </div>
        <div className="mc-pos-num">
          <span className="mc-nota">Resultado</span>
          {l.resultado !== null ? (
            <span className={l.resultado >= 0 ? 'mc-pos' : 'mc-neg'}>
              {reais(l.resultado)}
              {l.resultadoPct !== null && <small> ({resultadoPct(l.resultadoPct)})</small>}
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
      {l.manual && (l.vencimentoManual || l.taxaManual) && (
        <div className="mc-nota mc-pos-extra">
          {l.vencimentoManual && <span>Vence em {dataCurta(l.vencimentoManual)}</span>}
          {l.vencimentoManual && l.taxaManual && ' · '}
          {l.taxaManual && <span>{l.taxaManual}</span>}
        </div>
      )}
    </li>
  )
}

/**
 * Posições agrupadas como na Área do Investidor da B3 ("Produtos da sua carteira"): um bloco por tipo de
 * ativo, com quantos ativos tem, a fatia da carteira e o valor. Em cada ativo, o lápis abre o painel de
 * edição (preço médio e classe; nos digitados à mão, tudo) e "Ver lançamentos" fica no fim da linha.
 */
export function CartaoPosicoes({
  linhas,
  dataPosicao,
  onDataPosicao,
  classeDe,
  classes,
  acoes,
  onVerLancamentos,
  excluidos = [],
  onRestaurar,
}: {
  linhas: LinhaPosicao[]
  /** Data da Posição da B3 (AAAA-MM-DD), quando há uma. */
  dataPosicao: string | null
  onDataPosicao: (d: string) => void
  /** Classe em vigor de cada ativo (a escolhida ou a detectada). */
  classeDe: (ativo: string) => ClasseCarteira | null
  /** Classes que a pessoa escolheu. */
  classes: Record<string, ClasseCarteira>
  acoes: AcoesPainel
  onVerLancamentos: (ativo: string) => void
  /** Ativos da B3 que a pessoa excluiu da lista. */
  excluidos?: string[]
  onRestaurar?: (ativo: string) => void
}) {
  const idTitulo = useId()
  const { reais } = useValores()
  const [editando, setEditando] = useState<{ ativo: string } | { grupo: { categoria: CategoriaPosicao; rotulo: string } } | 'novo' | null>(null)
  const grupos = agruparPosicoes(linhas)
  const semPreco = linhas.filter((l) => l.status === 'faltaSaldoAnterior').length
  const linhaEditada = editando && editando !== 'novo' && 'ativo' in editando ? linhas.find((l) => l.ativo === editando.ativo) : undefined

  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <div className="mc-topo-linha">
        <h2 id={idTitulo} className="mc-titulo">Posições</h2>
        <button type="button" className="btn btn-secondary mc-btn" onClick={() => setEditando('novo')}>
          Adicionar posição
        </button>
      </div>
      {linhas.length > 0 && (
        <div className="mc-rotulo">
          {linhas.length} ativo(s) em {grupos.length} {grupos.length === 1 ? 'tipo' : 'tipos'}
        </div>
      )}
      {dataPosicao && (
        <div className="mc-form-linha">
          <label htmlFor={`${idTitulo}-data`} className="mc-rotulo-campo">Posição da B3 de {dataCurta(dataPosicao)}</label>
          <input
            id={`${idTitulo}-data`}
            type="date"
            className="mc-campo mc-campo-data"
            aria-label="Data da Posição"
            value={dataPosicao}
            onChange={(e) => e.target.value && onDataPosicao(e.target.value)}
          />
        </div>
      )}
      {semPreco > 0 && <div className="mc-nota">{semPreco} ativo(s) sem preço médio. Toque no lápis do ativo para informar.</div>}

      {linhas.length === 0 && <p className="mc-texto">Nenhuma posição ainda. Importe os extratos da B3 ou adicione uma posição à mão.</p>}

      {excluidos.length > 0 && onRestaurar && (
        <details className="mc-detalhes">
          <summary>{excluidos.length} ativo(s) excluído(s) da lista</summary>
          <ul className="mc-resumos">
            {excluidos.map((a) => (
              <li key={a} className="mc-topo-linha">
                <strong>{a}</strong>
                <button type="button" className="btn btn-ghost mc-btn" aria-label={`Mostrar ${a} de novo`} onClick={() => onRestaurar(a)}>
                  Mostrar de novo
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mc-grupos">
        {grupos.map((g) => (
          <details key={g.chave} className="mc-grupo" open={grupos.length === 1}>
            <summary aria-label={`${g.rotulo}: ${g.ativos} ativo(s)`}>
              <MiniPizza pct={g.pct} categoria={g.chave} />
              <span className="mc-grupo-nome">{g.rotulo}</span>
              <span className="mc-grupo-valor">{g.valor > 0 ? reais(g.valor) : '—'}</span>
              <span className="mc-grupo-info">
                {g.ativos} {g.ativos === 1 ? 'ativo' : 'ativos'}
                {g.valor > 0 && ` · ${pct(g.pct, false)} da carteira`}
              </span>
              <ChevronDownIcon size={18} className="mc-grupo-seta" />
            </summary>
            <ul className="mc-posicoes">
              {g.linhas.map((l) => (
                <LinhaDoAtivo key={l.ativo} l={l} onEditar={() => setEditando({ ativo: l.ativo })} onVerLancamentos={onVerLancamentos} />
              ))}
            </ul>
            {g.chave !== 'recentes' && (
              <div className="mc-grupo-rodape">
                <button
                  type="button"
                  className="btn btn-ghost mc-btn"
                  aria-label={`Adicionar ativo em ${g.rotulo}`}
                  onClick={() => setEditando({ grupo: { categoria: g.chave as CategoriaPosicao, rotulo: g.rotulo } })}
                >
                  + Adicionar ativo
                </button>
              </div>
            )}
          </details>
        ))}
      </div>

      {editando === 'novo' && (
        <PainelEdicaoAtivo classeAtual={null} classeEscolhida={undefined} acoes={acoes} onFechar={() => setEditando(null)} />
      )}
      {editando && editando !== 'novo' && 'grupo' in editando && (
        <PainelEdicaoAtivo key={editando.grupo.categoria} grupo={editando.grupo} classeAtual={null} classeEscolhida={undefined} acoes={acoes} onFechar={() => setEditando(null)} />
      )}
      {linhaEditada && (
        <PainelEdicaoAtivo
          key={linhaEditada.ativo}
          linha={linhaEditada}
          classeAtual={classeDe(linhaEditada.ativo)}
          classeEscolhida={classes[linhaEditada.ativo]}
          acoes={acoes}
          onFechar={() => setEditando(null)}
        />
      )}
    </section>
  )
}

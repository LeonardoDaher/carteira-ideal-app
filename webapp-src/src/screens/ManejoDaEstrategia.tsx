import { useMemo, useState } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import { diasUteis, tipoVencimento, vencimentosDe } from '../domain/opcoes'
import type { AtivoComOpcoes } from '../domain/opcoes'
import { escadaDeStrikes, indiceDoMaisPerto } from '../domain/modelosDeEstrategia'
import { cenariosNoPrimeiroVencimento, desmontar, rolar } from '../domain/rolagem'
import type { Alvo, PernaDaEstrutura } from '../domain/rolagem'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { CampoNumero } from '../ui/CampoNumero'
import { CampoReais } from '../ui/CampoReais'
import { PainelDaPosicao } from './PainelDaPosicao'

const dinheiro = (v: number) => (v < 0 ? `−${reais(-v)}` : reais(v))
const pct = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
const num = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const corDe = (v: number) => (Math.abs(v) < 0.005 ? undefined : v > 0 ? 'var(--mc-pos)' : 'var(--danger)')
const VARIACOES = [-0.1, -0.05, 0, 0.05, 0.1]
const VOLATILIDADE_PADRAO = 0.35

/** Pontos de atenção e saídas usuais, conforme as pernas vendidas da estrutura (texto descritivo, sem indicar operação). */
function orientacoes(pernas: PernaDaEstrutura[], acoes: number): { titulo: string; texto: string }[] {
  const vendidas = pernas.filter((x) => x.perna.lado === 'venda')
  const putVendida = vendidas.some((x) => x.perna.tipo === 'put')
  const callVendida = vendidas.some((x) => x.perna.tipo === 'call')
  const protegida = (tipo: 'call' | 'put') =>
    pernas.some((x) => x.perna.lado === 'compra' && x.perna.tipo === tipo) || (tipo === 'call' && acoes > 0)
  const varios = new Set(pernas.map((x) => x.perna.dias)).size > 1
  const itens: { titulo: string; texto: string }[] = []

  if (putVendida) {
    itens.push({
      titulo: protegida('put') ? 'Se o ativo cair abaixo do strike da put vendida (com proteção)' : 'Se o ativo cair abaixo do strike da put vendida',
      texto: protegida('put')
        ? 'A perda já tem teto, que é a distância entre os strikes menos o crédito recebido. Saídas usuais: deixar vencer (assumindo a perda máxima), encerrar a trava antes, ou rolar a trava inteira para o vencimento seguinte, de preferência recebendo crédito. Rolar não apaga a perda: ela é realizada na hora e o prazo novo traz risco novo.'
        : 'Quem vendeu a put pode ser obrigado a comprar o ativo pelo strike. Saídas usuais: aceitar o exercício (fica com o ativo a um preço efetivo de strike menos prêmio, o ponto de partida da "roda"), recomprar a put e realizar a perda, ou rolar para frente e, se quiser, para um strike menor, de preferência com crédito. Se a rolagem exigir débito, você está pagando para adiar.',
    })
  }
  if (callVendida) {
    itens.push({
      titulo: acoes > 0 ? 'Se o ativo subir acima do strike da call vendida (coberta)' : 'Se o ativo subir acima do strike da call vendida',
      texto:
        acoes > 0
          ? 'As ações podem ser exercidas (vendidas pelo strike): o ganho fica limitado a strike menos o preço de compra mais o prêmio. Saídas usuais: deixar exercer, recomprar a call (realiza a perda na opção, mas mantém as ações) ou rolá-la para cima e para frente, normalmente com débito ou crédito pequeno, para continuar com as ações.'
          : protegida('call')
            ? 'A perda tem teto (distância entre os strikes menos o crédito). Saídas usuais: encerrar a trava, deixar vencer ou rolar a trava inteira para frente.'
            : 'É a situação de maior risco: a perda não tem limite. Saídas usuais: recomprar a call, ou transformá-la em trava comprando uma call de strike maior. Definir antes o preço em que a operação será encerrada é parte do plano.',
    })
  }
  if (varios) {
    itens.push({
      titulo: 'Em estruturas com vencimentos diferentes (THL e diagonais)',
      texto:
        'O ganho vem da perna curta perder valor de tempo mais rápido que a longa. Se o ativo se afastar muito do strike, a THL perde, no máximo, o débito pago. Quando a perna curta vence, dá para vender outra perna curta contra a longa (é a "malha de renda"): cada rolagem recebida reduz o custo da posição.',
    })
  }
  if (!putVendida && !callVendida) {
    itens.push({
      titulo: 'Estrutura só comprada',
      texto: 'O risco é o prêmio pago, e o tempo joga contra: a cada dia útil a opção perde valor de tempo. Saídas usuais: vender antes do vencimento para recuperar o valor que restar, ou rolar para um vencimento mais longo pagando a diferença.',
    })
  }
  itens.push({
    titulo: 'Antes de montar',
    texto: 'Definir por escrito o que dispara o ajuste (preço do ativo, delta da perna vendida, dias até o vencimento) e quanto se aceita perder evita decidir sob pressão. Os números abaixo usam o último preço negociado e um modelo; o preço real de compra e venda na hora pode ser pior.',
  })
  return itens
}

/**
 * Manejo da estrutura montada na aba Estratégias: resultado por cenário no primeiro vencimento, quanto custa desmontar e a
 * rolagem de pernas para outro vencimento ou strike, com a posição que sobra e seu novo ganho e perda máximos.
 */
export function ManejoDaEstrategia({ ativo, pernas, base, precoAtivo, hoje }: {
  ativo: AtivoComOpcoes
  pernas: PernaDaEstrutura[]
  base: { acoes: number; precoAcao: number }
  precoAtivo: number
  hoje: string
}) {
  const primeiro = Math.max(Math.min(...pernas.map((x) => x.perna.dias ?? 0).filter((d) => d > 0), 9999), 1)
  const [preco, setPreco] = useState(precoAtivo)
  const [passados, setPassados] = useState(Math.min(5, primeiro))
  const [alvos, setAlvos] = useState<Record<number, { vencimento: string; codigo: string }>>({})
  const diasPassados = Math.min(Math.max(passados, 0), primeiro)
  const m = useMemo(() => ({ precoHoje: precoAtivo, r: Math.log(1 + jurosPadrao() / 100), sigmaPadrao: VOLATILIDADE_PADRAO }), [precoAtivo])
  const cenario = { preco, diasPassados }
  const vencimentos = useMemo(() => vencimentosDe(ativo.series), [ativo])

  const linhas = useMemo(() => cenariosNoPrimeiroVencimento(pernas, base, m, VARIACOES), [pernas, base, m])
  const desm = useMemo(() => desmontar(pernas, base, cenario, m, primeiro), [pernas, base, cenario.preco, cenario.diasPassados, m, primeiro]) // eslint-disable-line react-hooks/exhaustive-deps

  const diasAte = (v: string) => diasUteis(v, hoje)
  const posteriores = (i: number) => {
    const { perna, serie } = pernas[i]
    return vencimentos.filter((v) => v > serie.vencimento && escadaDeStrikes(ativo.series, perna.tipo, v).length > 0)
  }
  const marcar = (i: number, ligado: boolean) => {
    setAlvos((a) => {
      const proximo = { ...a }
      if (!ligado) {
        delete proximo[i]
        return proximo
      }
      const { perna, serie } = pernas[i]
      const venc = posteriores(i).find((v) => tipoVencimento(v) === 'mensal') ?? posteriores(i)[0]
      if (!venc) return a
      const escada = escadaDeStrikes(ativo.series, perna.tipo, venc)
      proximo[i] = { vencimento: venc, codigo: escada[indiceDoMaisPerto(escada, serie.strike)].codigo }
      return proximo
    })
  }
  const trocarVencimento = (i: number, venc: string) => {
    const { perna, serie } = pernas[i]
    const escada = escadaDeStrikes(ativo.series, perna.tipo, venc)
    if (escada.length) setAlvos((a) => ({ ...a, [i]: { vencimento: venc, codigo: escada[indiceDoMaisPerto(escada, serie.strike)].codigo } }))
  }
  const trocarSerie = (i: number, codigo: string) => setAlvos((a) => ({ ...a, [i]: { ...a[i], codigo } }))

  const alvosCalculados: Alvo[] = Object.entries(alvos).flatMap(([i, a]) => {
    const nova = ativo.series.find((s) => s.codigo === a.codigo)
    return nova ? [{ indice: Number(i), nova }] : []
  })
  const rolagem = useMemo(
    () => (alvosCalculados.length ? rolar(pernas, base, alvosCalculados, cenario, m, diasAte) : null),
    [pernas, base, alvos, cenario.preco, cenario.diasPassados, m], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const dicas = orientacoes(pernas, base.acoes)
  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const

  return (
    <div className="col" style={{ gap: 14 }} data-testid="manejo">
      <div className="col" style={{ gap: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Manejo: ajuste, rolagem e desmontagem</span>
        <span className="muted small justify">
          O que acontece se o mercado for contra e como ficam a rolagem e a desmontagem, com o último preço das séries e o modelo de Black-Scholes
          (volatilidade implícita de cada série). É uma estimativa para comparar caminhos, e não uma recomendação.
        </span>
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700 }}>Cenários no primeiro vencimento</span>
        <div style={{ overflowX: 'auto' }} className="card-outline">
          <table className="tabela-opcoes small" data-testid="cenarios">
            <thead>
              <tr>
                <th scope="col">Ativo</th>
                <th scope="col">Preço</th>
                <th scope="col">Resultado</th>
                <th scope="col">Vendidas exercidas</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.variacao}>
                  <td>{l.variacao === 0 ? 'Parado' : pct(l.variacao)}</td>
                  <td className="num">{num(l.preco)}</td>
                  <td className="num" style={{ color: corDe(l.resultado), fontWeight: 700 }}>{dinheiro(l.resultado)}</td>
                  <td>{l.exercidas.length ? l.exercidas.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="tiny muted justify">
          Resultado da estrutura inteira na data em que vence a perna mais curta (exato com um vencimento só; estimado com vários).
        </span>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700 }}>E se o mercado for contra antes do vencimento?</span>
        <span className="small muted justify">Escolha um cenário: onde o ativo estaria e quantos dias úteis teriam passado.</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Atalhos de preço do cenário">
          {VARIACOES.map((v) => (
            <button key={v} className="chip" onClick={() => setPreco(Math.round(precoAtivo * (1 + v) * 100) / 100)}>
              {v === 0 ? 'Parado' : pct(v)}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 150px' }}><CampoReais rotulo="Preço do ativo no cenário" valor={preco} onMudar={setPreco} /></div>
          <div style={{ flex: '1 1 150px' }}>
            <CampoNumero rotulo="Dias úteis que passam" valor={passados} onMudar={setPassados} sufixo="dias úteis" casas={0} dica={`Vai de 0 até ${primeiro}, o prazo da perna mais curta.`} />
          </div>
        </div>

        <div className="row" style={{ gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 160px' }}>
            <span className="tiny muted">Desmontar tudo agora, neste cenário</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: corDe(desm.total) }} data-testid="desmontar-total">{dinheiro(desm.total)}</span>
          </div>
        </div>
        <div className="tiny muted justify">
          {desm.porPerna.map((x) => `${x.codigo}: vale ${reais(x.valor)} por opção`).join(' · ')}
          {base.acoes > 0 ? ` · ações vendidas a ${reais(preco)}` : ''}
        </div>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700 }}>Rolagem</span>
        <span className="small muted justify">
          Marque as pernas que quer rolar. A antiga é encerrada pelo valor do cenário e a nova é aberta, no mesmo lado e quantidade, com o preço estimado
          no mesmo cenário.
        </span>
        {pernas.map(({ perna, serie }, i) => {
          const marcado = !!alvos[i]
          const alvo = alvos[i]
          const posts = posteriores(i)
          return (
            <div key={serie.codigo} className="card-outline col" style={{ gap: 8 }} role="group" aria-label={`Rolagem de ${serie.codigo}`}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: posts.length ? 'pointer' : 'not-allowed' }}>
                <input type="checkbox" checked={marcado} disabled={posts.length === 0} onChange={(ev) => marcar(i, ev.target.checked)} />
                <span>
                  Rolar <strong>{serie.codigo}</strong>{' '}
                  <span className="muted small">({perna.lado === 'compra' ? 'comprada' : 'vendida'}, strike {num(serie.strike)}, vence {formatarData(serie.vencimento)})</span>
                </span>
              </label>
              {posts.length === 0 && <span className="tiny muted">Não há vencimento posterior com séries do mesmo tipo.</span>}
              {marcado && alvo && (
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <label className="col" style={{ gap: 4, flex: '1 1 180px' }}>
                    <span className="small" style={{ fontWeight: 600 }}>Novo vencimento de {serie.codigo}</span>
                    <select value={alvo.vencimento} onChange={(ev) => trocarVencimento(i, ev.target.value)} aria-label={`Novo vencimento de ${serie.codigo}`}>
                      {posts.map((v) => <option key={v} value={v}>{formatarData(v)} ({diasAte(v)} d.u., {tipoVencimento(v)})</option>)}
                    </select>
                  </label>
                  <label className="col" style={{ gap: 4, flex: '1 1 180px' }}>
                    <span className="small" style={{ fontWeight: 600 }}>Nova série de {serie.codigo}</span>
                    <select value={alvo.codigo} onChange={(ev) => trocarSerie(i, ev.target.value)} aria-label={`Nova série de ${serie.codigo}`}>
                      {escadaDeStrikes(ativo.series, perna.tipo, alvo.vencimento).map((s) => (
                        <option key={s.codigo} value={s.codigo}>{s.codigo}, strike {num(s.strike)}, último {num(s.ultimo)}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )
        })}

        {rolagem && (
          <div className="col" style={{ gap: 10 }} data-testid="resultado-rolagem">
            {rolagem.detalhes.map((d) => (
              <div key={d.de} className="tiny muted justify">
                {d.de} → <strong>{d.para}</strong>: encerrar {dinheiro(d.encerramento)} e abrir {dinheiro(d.abertura)} (preço estimado da nova: {reais(d.precoNovo)}). Líquido da troca:{' '}
                <strong style={{ color: corDe(d.liquido) }}>{d.liquido >= 0 ? `crédito de ${reais(d.liquido)}` : `débito de ${reais(-d.liquido)}`}</strong>.
              </div>
            ))}
            {rolagem.liquido < 0 && (
              <div className="card-outline small justify aviso-atraso" role="note" data-testid="aviso-rolagem-debito">
                <strong>Rolagem com débito.</strong> <span className="muted">Você paga para adiar: a perda do cenário foi realizada e ainda entra dinheiro novo no prazo seguinte. Compare com desmontar.</span>
              </div>
            )}
            {rolagem.diasAteVencer === null ? (
              <div className="card-outline small justify" role="status">Não sobrou nenhuma opção aberta depois da rolagem.</div>
            ) : (
              <PainelDaPosicao
                sufixo="-rolagem"
                posicao={rolagem.posicao}
                precoAtivo={preco}
                dias={rolagem.diasAteVencer}
                titulo="Posição depois da rolagem"
                nota="Prazos contados a partir da data do cenário."
              />
            )}
          </div>
        )}
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700 }}>O que costuma ser feito</span>
        {dicas.map((d) => (
          <div key={d.titulo} className="col" style={{ gap: 2 }}>
            <span className="small" style={{ fontWeight: 600 }}>{d.titulo}</span>
            <span className="small muted justify" style={{ lineHeight: 1.5 }}>{d.texto}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

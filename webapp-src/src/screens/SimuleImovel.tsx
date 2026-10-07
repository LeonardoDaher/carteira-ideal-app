import { useDeferredValue, useMemo, useState } from 'react'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import { dataCurta, porcentagem, reais } from '../domain/mercadoOficial'
import type { SnapshotMercado } from '../domain/mercadoOficial'
import {
  NOMES_CENARIOS,
  TODOS_CAMINHOS,
  inputsDoSnapshot,
  inputsPadrao,
  reaisCompacto,
  simularComparativoImobiliario,
  validarInputs,
} from '../domain/simulaImovel'
import type { ChaveCenario, InputsComparativo, ParVirada, PontoDeVirada, ResultadoComparativo } from '../domain/simulaImovel'
import { CampoNumero } from '../ui/CampoNumero'
import { CampoReais } from '../ui/CampoReais'
import { BlocoAlugar, BlocoAvista, BlocoConsorcio, BlocoFinanciar, ComoLer, ParaOndeFoi, PremissasUsadas, reais0 } from '../ui/DetalheCustos'
import { GraficoPatrimonio } from '../ui/GraficoPatrimonio'
import { VoltarInicio } from '../ui/VoltarInicio'
import type { AppCtx } from '../state/useAppState'

const NOMES_CURTOS: Record<ChaveCenario, string> = { financiamento: 'Financiar', aluguel: 'Alugar', consorcio: 'Consórcio', avista: 'À vista' }

function resolver(entrada: InputsComparativo): { resultado: ResultadoComparativo | null; erros: string[] } {
  const erros = validarInputs(entrada)
  if (erros.length) return { resultado: null, erros }
  return { resultado: simularComparativoImobiliario(entrada), erros: [] }
}

/**
 * Simule Imóvel (D44, D46): compara comprar à vista, financiar, entrar num consórcio ou alugar e investir, e aponta qual das
 * rotas termina com o maior patrimônio líquido depois de N anos. Tela avulsa: não depende do questionário.
 * Conta matemática sobre premissas de taxa; não indica banco, administradora nem produto.
 */
export function SimuleImovel({
  snapshot = SNAPSHOT_MERCADO,
}: {
  /** Recebido como as demais telas; esta tela só volta à landing, então não usa o contexto. */
  ctx?: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job semanal. */
  snapshot?: SnapshotMercado
}) {
  const [entrada, setEntrada] = useState<InputsComparativo>(() => inputsPadrao(inputsDoSnapshot(snapshot)))
  // Deferido: a digitação não espera os ~100 cálculos auxiliares (ponto de virada, contemplação).
  const adiada = useDeferredValue(entrada)
  const { resultado, erros } = useMemo(() => resolver(adiada), [adiada])
  const atualizando = adiada !== entrada

  const mudar = <K extends keyof InputsComparativo>(chave: K, valor: InputsComparativo[K]) => setEntrada((e) => ({ ...e, [chave]: valor }))
  const focus = snapshot.focus
  const cdi = snapshot.indicadores.cdi?.valor
  const custosIniciais = (entrada.valorImovel * entrada.custosIniciaisPct) / 100
  const disponivel = entrada.dinheiroDisponivel ?? entrada.entrada + custosIniciais
  const necessarioAvista = Math.round((entrada.valorImovel + custosIniciais) * 100) / 100
  // Caminhos marcados (D67): sem escolha, todos. O mínimo é dois, porque comparar exige ao menos um contra o outro.
  const marcados = entrada.caminhos ?? TODOS_CAMINHOS
  const alternar = (c: ChaveCenario) => {
    const novo = marcados.includes(c) ? marcados.filter((x) => x !== c) : TODOS_CAMINHOS.filter((x) => x === c || marcados.includes(x))
    if (novo.length < 2) return
    mudar('caminhos', novo.length === TODOS_CAMINHOS.length ? null : novo)
  }
  const avistaMarcado = marcados.includes('avista')
  const semDinheiroParaAvista = disponivel < necessarioAvista - 0.005

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleBens" rotulo="← Simule Bens" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Comprar à vista, financiar, consórcio ou alugar?</h1>
        <div className="muted small justify">
          Informe o imóvel e as taxas e veja qual dos caminhos termina com o <strong>maior patrimônio líquido</strong> depois de
          alguns anos. É uma conta matemática, que compara o dinheiro de bolso de cada caminho nas mesmas condições. Para incluir
          a compra à vista, informe quanto dinheiro você tem hoje.
        </div>
        <a className="small" href="#resultado-imovel" style={{ color: 'var(--accent)' }}>Ir para o resultado ↓</a>
      </div>

      <div className="desk-split">
        <div className="desk-main">
          <form className="imovel-form" onSubmit={(e) => e.preventDefault()} aria-label="Dados da simulação">
            <div className="card-outline col" style={{ gap: 8 }} role="group" aria-label="Quais caminhos comparar?">
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>Quais caminhos comparar?</span>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {TODOS_CAMINHOS.map((c) => {
                  const ligado = marcados.includes(c)
                  const ultimos = ligado && marcados.length <= 2
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`chip ${ligado ? 'selected' : ''}`}
                      aria-pressed={ligado}
                      aria-disabled={ultimos}
                      title={ultimos ? 'É preciso manter pelo menos dois caminhos' : undefined}
                      onClick={() => alternar(c)}
                    >
                      {ligado ? '✓ ' : ''}{NOMES_CENARIOS[c]}
                    </button>
                  )
                })}
                {marcados.length < TODOS_CAMINHOS.length && (
                  <button type="button" className="chip" onClick={() => mudar('caminhos', null)}>Comparar os quatro</button>
                )}
              </div>
              <span className="tiny muted justify" style={{ lineHeight: 1.5 }}>
                Marque dois, três ou os quatro. Para trocar um par (por exemplo, de à vista × consórcio para financiar × consórcio), marque o novo e desmarque o outro.
                O orçamento mensal de referência passa a considerar só os caminhos marcados.
              </span>
              {avistaMarcado && semDinheiroParaAvista && marcados.length === 2 && (
                <div className="col" style={{ gap: 6 }} role="note">
                  <span className="small justify" style={{ lineHeight: 1.5 }}>
                    Para comprar à vista seriam necessários {reais0(necessarioAvista)} e você informou {reais0(disponivel)}. Sem esse dinheiro, esse caminho fica de fora.
                  </span>
                  <div className="row">
                    <button type="button" className="chip" onClick={() => mudar('dinheiroDisponivel', necessarioAvista)}>
                      Usar {reais0(necessarioAvista)} como dinheiro disponível
                    </button>
                  </div>
                </div>
              )}
            </div>

            <details className="card-outline imovel-bloco" open>
              <summary>O imóvel e o prazo</summary>
              <div className="imovel-grade">
                <div className="span2">
                  <CampoReais rotulo="Valor do imóvel" valor={entrada.valorImovel} onMudar={(v) => mudar('valorImovel', v)} />
                </div>
                <div className="span2 col" style={{ gap: 6 }}>
                  <CampoReais
                    rotulo="Dinheiro disponível hoje"
                    valor={disponivel}
                    onMudar={(v) => mudar('dinheiroDisponivel', v > 0 ? v : null)}
                    dica={
                      entrada.dinheiroDisponivel === null
                        ? `Por enquanto, a entrada mais o ITBI e o cartório (${reais0(entrada.entrada)} + ${reais0(custosIniciais)}). Informe tudo o que você tem: a sobra fica aplicada e, se der para pagar o imóvel, entra a rota de comprar à vista.`
                        : `Para comprar à vista seriam necessários ${reais0(necessarioAvista)}: o imóvel (${reais0(entrada.valorImovel)}) mais o ITBI e o cartório (${reais0(custosIniciais)}). A sobra, em qualquer caminho, fica aplicada.`
                    }
                  />
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="chip" onClick={() => mudar('dinheiroDisponivel', necessarioAvista)}>
                      Usar {reais0(necessarioAvista)} (imóvel + ITBI e cartório)
                    </button>
                    {entrada.dinheiroDisponivel !== null && (
                      <button type="button" className="chip" onClick={() => mudar('dinheiroDisponivel', null)}>
                        Só entrada + ITBI
                      </button>
                    )}
                  </div>
                </div>
                <CampoNumero
                  rotulo="ITBI, escritura e registro"
                  valor={entrada.custosIniciaisPct}
                  onMudar={(v) => mudar('custosIniciaisPct', v)}
                  sufixo="%"
                  dica={`${reais0(custosIniciais)} sobre o valor do imóvel, pagos em toda compra. Varia por cidade: confira o seu.`}
                />
                <CampoReais
                  rotulo="Entrada do financiamento"
                  valor={entrada.entrada}
                  onMudar={(v) => mudar('entrada', v)}
                  dica={entrada.valorImovel > 0 ? `${porcentagem((entrada.entrada / entrada.valorImovel) * 100, 0, 1)} do imóvel` : undefined}
                />
                <CampoNumero rotulo="Comparar por quantos anos?" valor={entrada.horizonteAnos} onMudar={(v) => mudar('horizonteAnos', v)} sufixo="anos" casas={0} />
              </div>
            </details>

            <details className="card-outline imovel-bloco" open>
              <summary>Premissas de mercado</summary>
              <div className="imovel-grade">
                <CampoNumero
                  rotulo="Rendimento dos investimentos"
                  valor={entrada.rendimentoAA}
                  onMudar={(v) => mudar('rendimentoAA', v)}
                  sufixo="% ao ano"
                  dica={cdi != null ? `CDI de hoje: ${porcentagem(cdi)}` : undefined}
                />
                <CampoNumero rotulo="Inflação esperada" valor={entrada.inflacaoAA} onMudar={(v) => mudar('inflacaoAA', v)} sufixo="% ao ano" />
                <CampoNumero rotulo="Valorização do imóvel" valor={entrada.valorizacaoImovelAA} onMudar={(v) => mudar('valorizacaoImovelAA', v)} sufixo="% ao ano" />
                <CampoNumero
                  rotulo="Custos de quem é dono"
                  valor={entrada.custosPropriedadeAA}
                  onMudar={(v) => mudar('custosPropriedadeAA', v)}
                  sufixo="% ao ano"
                  dica="Sobre o valor do imóvel: IPTU, condomínio e manutenção"
                />
                <label className="span2 row small" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={entrada.aplicarIR} onChange={(e) => mudar('aplicarIR', e.target.checked)} />
                  <span>
                    A taxa de rendimento é <strong>bruta</strong>: descontar o Imposto de Renda regressivo sobre o ganho dos investimentos.
                  </span>
                </label>
                {focus && (
                  <div className="span2 tiny muted justify" style={{ lineHeight: 1.5 }}>
                    Ponto de partida: projeção de longo prazo do Boletim Focus (coleta de {dataCurta(focus.data)}), com a Selic como
                    rendimento e o IPCA como inflação, valorização e reajustes. Troque pelos números em que você acredita.
                  </div>
                )}
              </div>
            </details>

            <details key={`financiamento-${marcados.includes('financiamento')}`} className="card-outline imovel-bloco" open={marcados.includes('financiamento')}>
              <summary>Financiamento{!marcados.includes('financiamento') && ' (fora da comparação)'}</summary>
              <div className="imovel-grade">
                <CampoNumero rotulo="Juros da proposta (nominal)" valor={entrada.jurosNominalAA} onMudar={(v) => mudar('jurosNominalAA', v)} sufixo="% ao ano" dica="Use a taxa que o banco ofereceu" />
                <CampoNumero rotulo="Prazo" valor={entrada.prazoFinanciamentoAnos} onMudar={(v) => mudar('prazoFinanciamentoAnos', v)} sufixo="anos" casas={0} />
                <div className="span2 col" style={{ gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>Sistema de amortização</span>
                  <div className="row" style={{ gap: 6 }} role="group" aria-label="Sistema de amortização">
                    {(['SAC', 'PRICE'] as const).map((s) => (
                      <button type="button" key={s} className={`chip ${entrada.sistema === s ? 'selected' : ''}`} aria-pressed={entrada.sistema === s} onClick={() => mudar('sistema', s)}>
                        {s === 'SAC' ? 'SAC' : 'Price'}
                      </button>
                    ))}
                  </div>
                  <span className="tiny muted">SAC: parcela começa maior e cai. Price: parcela fixa.</span>
                </div>
                <CampoReais rotulo="Tarifa do banco por mês" valor={entrada.tarifaMensal} onMudar={(v) => mudar('tarifaMensal', v)} />
                <CampoNumero rotulo="Seguro MIP" valor={entrada.mipMensalPct} onMudar={(v) => mudar('mipMensalPct', v)} sufixo="% ao mês" casas={3} dica="Sobre o saldo devedor" />
                <CampoNumero rotulo="Seguro DFI" valor={entrada.dfiMensalPct} onMudar={(v) => mudar('dfiMensalPct', v)} sufixo="% ao mês" casas={3} dica="Sobre o valor do imóvel" />
              </div>
            </details>

            <details key={`aluguel-${marcados.includes('aluguel')}`} className="card-outline imovel-bloco" open={marcados.includes('aluguel')}>
              <summary>Aluguel{!marcados.includes('aluguel') && ' (fora da comparação)'}</summary>
              <div className="imovel-grade">
                <CampoReais rotulo="Aluguel mensal hoje" valor={entrada.aluguelMensal} onMudar={(v) => mudar('aluguelMensal', v)} />
                <CampoNumero rotulo="Reajuste anual" valor={entrada.reajusteAluguelAA} onMudar={(v) => mudar('reajusteAluguelAA', v)} sufixo="% ao ano" dica="IPCA ou IGP-M" />
              </div>
            </details>

            <details key={`consorcio-${marcados.includes('consorcio')}`} className="card-outline imovel-bloco" open={marcados.includes('consorcio')}>
              <summary>Consórcio{!marcados.includes('consorcio') && ' (fora da comparação)'}</summary>
              <div className="imovel-grade">
                <CampoNumero rotulo="Taxa de administração total" valor={entrada.taxaAdmTotalPct} onMudar={(v) => mudar('taxaAdmTotalPct', v)} sufixo="%" dica="Soma de todo o prazo" />
                <CampoNumero rotulo="Fundo de reserva" valor={entrada.fundoReservaPct} onMudar={(v) => mudar('fundoReservaPct', v)} sufixo="%" />
                <CampoNumero rotulo="Prazo do grupo" valor={entrada.prazoConsorcioMeses} onMudar={(v) => mudar('prazoConsorcioMeses', v)} sufixo="meses" casas={0} />
                <CampoNumero rotulo="Reajuste da carta e das parcelas" valor={entrada.reajusteConsorcioAA} onMudar={(v) => mudar('reajusteConsorcioAA', v)} sufixo="% ao ano" dica="INCC ou IPCA" />
                <CampoNumero rotulo="Mês da contemplação" valor={entrada.mesContemplacao} onMudar={(v) => mudar('mesContemplacao', v)} sufixo="º mês" casas={0} dica="Quando você espera ser contemplado" />
                <CampoReais rotulo="Lance com recursos próprios" valor={entrada.lance} onMudar={(v) => mudar('lance', v)} dica="Deixe zerado se não houver" />
                {entrada.lance > 0 && (
                  <div className="span2 col" style={{ gap: 6 }}>
                    <span className="small" style={{ fontWeight: 600 }}>O lance abate</span>
                    <div className="row" style={{ gap: 6 }} role="group" aria-label="Regra do lance">
                      {(['prazo', 'parcela'] as const).map((r) => (
                        <button type="button" key={r} className={`chip ${entrada.regraLance === r ? 'selected' : ''}`} aria-pressed={entrada.regraLance === r} onClick={() => mudar('regraLance', r)}>
                          {r === 'prazo' ? 'O prazo' : 'A parcela'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>

            <label className="card-outline row small" style={{ gap: 8, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={entrada.descontarCustosVenda} onChange={(e) => mudar('descontarCustosVenda', e.target.checked)} />
              <span>
                <strong>Descontar os custos de venda do imóvel</strong> no patrimônio final (corretagem de {porcentagem(entrada.corretagemVendaPct, 0, 1)} e
                15% de Imposto de Renda sobre o ganho de capital, sem considerar isenções).
              </span>
            </label>
          </form>
        </div>

        <div className="desk-side" id="resultado-imovel" aria-busy={atualizando}>
          {erros.length > 0 || !resultado ? (
            <div className="card imovel-aviso-erro col" style={{ gap: 6 }} role="alert">
              <span style={{ fontWeight: 700 }}>Confira os dados para simular.</span>
              {erros.map((e) => (
                <span key={e} className="small muted">{e}</span>
              ))}
            </div>
          ) : (
            <Resultado r={resultado} entrada={adiada} onIncluirAvista={(v) => mudar('dinheiroDisponivel', v)} />
          )}
        </div>
      </div>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>O que este resultado é, e o que não é.</strong> É uma conta matemática: com as taxas e prazos informados, qual das
        rotas deixa o maior patrimônio. Ele <strong>não indica banco, administradora de consórcio nem produto</strong>, e não é
        recomendação de investimento, de financiamento ou de consórcio. As projeções de juros e inflação podem não se confirmar; por
        isso a tela mostra o ponto em que o vencedor muda. Rentabilidade passada não garante rentabilidade futura. Confira as condições
        reais de cada proposta antes de decidir.
      </div>
    </div>
  )
}

const TITULO_CURTO: Record<ChaveCenario, string> = { avista: 'Comprar à vista', financiamento: 'Financiar', consorcio: 'Consórcio', aluguel: 'Alugar' }
const SUJEITO: Record<ChaveCenario, string> = { avista: 'comprar à vista', financiamento: 'financiar', consorcio: 'o consórcio', aluguel: 'alugar e investir' }

/** Uma linha do ponto de virada: a valorização do imóvel em que os dois caminhos empatam, ou quem fica sempre na frente. */
function LinhaVirada({ par, r, pv, valorizacao }: { par: ParVirada; r: ResultadoComparativo; pv: PontoDeVirada; valorizacao: number }) {
  const { a, b, ponto, acima } = par
  const abaixo = acima === a ? b : a
  const titulo = `${TITULO_CURTO[a]} × ${TITULO_CURTO[b].toLowerCase()}`
  const naFrente = r.patrimonioSemCustosVenda[a] >= r.patrimonioSemCustosVenda[b] ? SUJEITO[a] : SUJEITO[b]
  return (
    <div className="small justify" style={{ lineHeight: 1.5 }}>
      {ponto != null ? (
        <>
          <strong>{titulo}:</strong> empatam se o imóvel valorizar {porcentagem(ponto)} ao ano (você supôs {porcentagem(valorizacao)}). Acima disso, {SUJEITO[acima]} leva vantagem; abaixo,{' '}
          {SUJEITO[abaixo]}.
        </>
      ) : (
        <>
          <strong>{titulo}:</strong> entre {pv.intervalo[0]}% e {pv.intervalo[1]}% de valorização ao ano, a ordem entre os dois não muda com as demais premissas: {naFrente} fica sempre à frente.
        </>
      )}
    </div>
  )
}

function Resultado({ r, entrada, onIncluirAvista }: { r: ResultadoComparativo; entrada: InputsComparativo; onIncluirAvista: (valor: number) => void }) {
  const [primeiro, segundo] = r.ranking
  const maior = Math.max(...r.rotas.map((c) => r.cenarios[c].patrimonioFinal), 1)
  const pv = r.pontoDeVirada
  const fimDeVida = r.cenarios

  return (
    <>
      <div className="card imovel-vencedor col" style={{ gap: 10 }} aria-live="polite">
        <span className="tiny muted">No cenário simulado, em {entrada.horizonteAnos} {entrada.horizonteAnos === 1 ? 'ano' : 'anos'}, termina com o maior patrimônio:</span>
        <span className="font-display" style={{ fontWeight: 700, fontSize: 26, color: 'var(--accent)' }}>{r.nomeVencedor}</span>
        <span className="small">
          <strong>{reais(fimDeVida[primeiro].patrimonioFinal)}</strong>, equivalente a {reais(fimDeVida[primeiro].patrimonioFinalHoje)} em dinheiro de hoje.
          Fica {reais(r.vantagemSobreSegundo)} à frente de <strong>{NOMES_CENARIOS[segundo].toLowerCase()}</strong>.
        </span>
        {r.vantagemSobreSegundo < fimDeVida[primeiro].patrimonioFinal * 0.03 && (
          <span className="small" style={{ color: 'var(--imovel-contra)', lineHeight: 1.5 }}>
            A diferença é pequena (menos de 3%): qualquer mudança de premissa pode inverter o resultado.
          </span>
        )}
      </div>

      {!r.avista.disponivel && r.caminhosEscolhidos.includes('avista') && (
        <div className="card-outline col" style={{ gap: 8 }} role="note">
          <span className="small justify" style={{ lineHeight: 1.5 }}>
            <strong>Comprar à vista não entrou na comparação.</strong> Com {reais0(r.capitalInicial)} disponíveis você não paga o imóvel ({reais0(entrada.valorImovel)}) e o ITBI e o
            cartório: seriam necessários {reais0(r.avista.necessario)}, e faltam {reais0(r.avista.falta)}. Informe em "Dinheiro disponível hoje" quanto você tem para incluir essa rota.
          </span>
          <div className="row">
            <button type="button" className="chip" onClick={() => onIncluirAvista(r.avista.necessario)}>
              Incluir comprar à vista (usar {reais0(r.avista.necessario)})
            </button>
          </div>
        </div>
      )}

      <ComoLer r={r} entrada={entrada} />

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Patrimônio líquido final</span>
        <div className="imovel-ranking">
          {r.ranking.map((c, k) => (
            <div key={c} className="col" style={{ gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span className="small" style={{ fontWeight: k === 0 ? 700 : 500 }}>{k + 1}º {NOMES_CENARIOS[c]}</span>
                <span className="small" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{reais(fimDeVida[c].patrimonioFinal)}</span>
              </div>
              <div className="imovel-barra-trilha" aria-hidden="true">
                <div className={`imovel-barra ${c}`} style={{ width: `${Math.max(0, (fimDeVida[c].patrimonioFinal / maior) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <span className="tiny muted justify">
          Valores em R$ do último mês simulado. Imóvel a preço de mercado + investimentos (líquidos de IR) − dívida restante
          {entrada.descontarCustosVenda ? ', já descontados os custos de venda' : '. Sem custos de venda'}.
          Com os custos de venda: {r.rotas.map((c) => `${NOMES_CURTOS[c]} ${reais(r.patrimonioComCustosVenda[c])}`).join('; ')}.
        </span>
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Como o patrimônio evolui</span>
        <GraficoPatrimonio serie={r.serieMensal} rotas={(['aluguel', 'financiamento', 'consorcio', 'avista'] as ChaveCenario[]).filter((c) => r.rotas.includes(c))} />
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <ParaOndeFoi r={r} compacto={reaisCompacto} />
      </div>

      <div className="col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Cada custo e cada taxa, caminho por caminho</span>
        {r.rotas.includes('avista') && <BlocoAvista r={r} entrada={entrada} />}
        {r.rotas.includes('financiamento') && <BlocoFinanciar r={r} entrada={entrada} />}
        {r.rotas.includes('consorcio') && <BlocoConsorcio r={r} entrada={entrada} />}
        {r.rotas.includes('aluguel') && <BlocoAlugar r={r} entrada={entrada} />}
      </div>

      {pv && (
        <div className="card col" style={{ gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Em que ponto o resultado muda?</span>
          {pv.pares.map((par) => (
            <LinhaVirada key={`${par.a}-${par.b}`} par={par} r={r} pv={pv} valorizacao={entrada.valorizacaoImovelAA} />
          ))}

          {r.sensibilidadeContemplacao && r.sensibilidadeContemplacao.length > 0 && (
            <>
              <span style={{ fontWeight: 700, fontSize: 13.5, marginTop: 6 }}>E se a contemplação demorar?</span>
              <div className="tabela-simulacao">
                {r.sensibilidadeContemplacao.map((s) => (
                  <div key={s.mes} className="linha-simulacao">
                    <span>Contemplado no {s.mes}º mês</span>
                    <span className="col" style={{ alignItems: 'flex-end', gap: 1 }}>
                      <span>Consórcio: {reaisCompacto(s.patrimonio)}</span>
                      <span className="tiny muted">vence: {NOMES_CURTOS[s.vencedor]}</span>
                    </span>
                  </div>
                ))}
              </div>
              <span className="tiny muted justify" style={{ lineHeight: 1.5 }}>
                A data da contemplação é a maior incerteza do consórcio: no sorteio ou no lance, ninguém sabe de antemão.
              </span>
            </>
          )}
        </div>
      )}

      {r.avisos.map((a) => (
        <div key={a} className="small" style={{ color: 'var(--imovel-contra)', lineHeight: 1.5 }} role="note">{a}</div>
      ))}

      <PremissasUsadas i={entrada} />

      <details className="card-outline premissas-tesouro">
        <summary style={{ fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Como a conta é feita</summary>
        <div className="col small muted justify" style={{ gap: 8, marginTop: 10, lineHeight: 1.5 }}>
          <span>
            <strong>Mesmo dinheiro em todos os caminhos.</strong> O dinheiro que você tem hoje fica aplicado desde o mês 0, menos o que cada caminho
            gasta na compra: a entrada e o ITBI/cartório no financiamento; o imóvel e o ITBI à vista; nada, para quem aluga e no consórcio até a
            contemplação. Todo mês, o maior desembolso entre os caminhos que você marcou vira o orçamento de referência: quem paga menos investe a diferença. Assim,
            nenhum caminho leva vantagem só por gastar menos.
          </span>
          <span>
            <strong>Financiar.</strong> Tabela SAC ou Price pela taxa nominal ao ano dividida por 12, com seguros (MIP sobre o saldo, DFI sobre o imóvel)
            e tarifa. TR zerada. Patrimônio = imóvel valorizado − saldo devedor + investimentos.
          </span>
          <span>
            <strong>Comprar à vista.</strong> Só entra se o dinheiro disponível cobrir o imóvel e o ITBI/cartório. Você paga tudo no mês 0, não tem dívida, juros nem
            seguros, e paga apenas os custos de quem é dono. Como não há parcela nem aluguel, a mesma verba mensal dos outros caminhos vai para o investimento.
          </span>
          <span>
            <strong>Alugar.</strong> Aluguel reajustado uma vez por ano; o capital inicial e as diferenças mensais ficam aplicados.
          </span>
          <span>
            <strong>Consórcio.</strong> Parcela = carta × (1 + taxa de administração + fundo de reserva) ÷ prazo, corrigida uma vez por ano. Até a
            contemplação você paga parcela e aluguel; no fim desse mês compra o imóvel pelo preço de mercado (a diferença para a carta sai do seu
            dinheiro) e paga ITBI/cartório; depois mora no imóvel e continua pagando a parcela.
          </span>
          <span>
            <strong>Investimentos.</strong> Rendimento efetivo ao ano convertido em mensal; aporte no fim do mês. Com a taxa bruta, o IR regressivo
            incide sobre o ganho na data final (simplificação: todo o dinheiro é tratado com a idade do horizonte).
          </span>
          <span>
            <strong>Não considera:</strong> isenções de ganho de capital, seguro do consórcio, vacância e reformas, FGTS, queda de preço por região,
            mudança da TR e antecipação de parcelas. Em valores de hoje, o patrimônio é deflacionado pela inflação informada.
          </span>
        </div>
      </details>
    </>
  )
}

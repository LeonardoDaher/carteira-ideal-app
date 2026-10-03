import { useDeferredValue, useMemo, useState } from 'react'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import { dataCurta, porcentagem, reais } from '../domain/mercadoOficial'
import type { SnapshotMercado } from '../domain/mercadoOficial'
import {
  NOMES_CENARIOS,
  inputsDoSnapshot,
  inputsPadrao,
  reaisCompacto,
  simularComparativoImobiliario,
  validarInputs,
} from '../domain/simulaImovel'
import type { ChaveCenario, InputsComparativo, ResultadoComparativo } from '../domain/simulaImovel'
import { CampoNumero } from '../ui/CampoNumero'
import { CampoReais } from '../ui/CampoReais'
import { BlocoAlugar, BlocoConsorcio, BlocoFinanciar, ComoLer, ParaOndeFoi, PremissasUsadas } from '../ui/DetalheCustos'
import { GraficoPatrimonio } from '../ui/GraficoPatrimonio'
import { VoltarInicio } from '../ui/VoltarInicio'
import type { AppCtx } from '../state/useAppState'

const CHAVES: ChaveCenario[] = ['financiamento', 'aluguel', 'consorcio']
const NOMES_CURTOS: Record<ChaveCenario, string> = { financiamento: 'Financiar', aluguel: 'Alugar', consorcio: 'Consórcio' }

function resolver(entrada: InputsComparativo): { resultado: ResultadoComparativo | null; erros: string[] } {
  const erros = validarInputs(entrada)
  if (erros.length) return { resultado: null, erros }
  return { resultado: simularComparativoImobiliario(entrada), erros: [] }
}

/**
 * Simule Imóvel (D44): compara financiar, alugar e investir, ou entrar num consórcio, e aponta qual das três
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

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleBens" rotulo="← Simule Bens" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Financiar, alugar ou consórcio?</h1>
        <div className="muted small justify">
          Informe o imóvel e as taxas e veja qual das três rotas termina com o <strong>maior patrimônio líquido</strong> depois de
          alguns anos. É uma conta matemática, que compara o dinheiro de bolso de cada caminho nas mesmas condições.
        </div>
        <a className="small" href="#resultado-imovel" style={{ color: 'var(--accent)' }}>Ir para o resultado ↓</a>
      </div>

      <div className="desk-split">
        <div className="desk-main">
          <form className="imovel-form" onSubmit={(e) => e.preventDefault()} aria-label="Dados da simulação">
            <details className="card-outline imovel-bloco" open>
              <summary>O imóvel e o prazo</summary>
              <div className="imovel-grade">
                <div className="span2">
                  <CampoReais rotulo="Valor do imóvel" valor={entrada.valorImovel} onMudar={(v) => mudar('valorImovel', v)} />
                </div>
                <CampoReais
                  rotulo="Entrada disponível"
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

            <details className="card-outline imovel-bloco" open>
              <summary>Financiamento</summary>
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
                <CampoNumero rotulo="ITBI, escritura e registro" valor={entrada.custosIniciaisPct} onMudar={(v) => mudar('custosIniciaisPct', v)} sufixo="%" dica="Sobre o valor do imóvel" />
                <CampoReais rotulo="Tarifa do banco por mês" valor={entrada.tarifaMensal} onMudar={(v) => mudar('tarifaMensal', v)} />
                <CampoNumero rotulo="Seguro MIP" valor={entrada.mipMensalPct} onMudar={(v) => mudar('mipMensalPct', v)} sufixo="% ao mês" casas={3} dica="Sobre o saldo devedor" />
                <CampoNumero rotulo="Seguro DFI" valor={entrada.dfiMensalPct} onMudar={(v) => mudar('dfiMensalPct', v)} sufixo="% ao mês" casas={3} dica="Sobre o valor do imóvel" />
              </div>
            </details>

            <details className="card-outline imovel-bloco" open>
              <summary>Aluguel</summary>
              <div className="imovel-grade">
                <CampoReais rotulo="Aluguel mensal hoje" valor={entrada.aluguelMensal} onMudar={(v) => mudar('aluguelMensal', v)} />
                <CampoNumero rotulo="Reajuste anual" valor={entrada.reajusteAluguelAA} onMudar={(v) => mudar('reajusteAluguelAA', v)} sufixo="% ao ano" dica="IPCA ou IGP-M" />
              </div>
            </details>

            <details className="card-outline imovel-bloco" open>
              <summary>Consórcio</summary>
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
            <Resultado r={resultado} entrada={adiada} />
          )}
        </div>
      </div>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>O que este resultado é, e o que não é.</strong> É uma conta matemática: com as taxas e prazos informados, qual das três
        rotas deixa o maior patrimônio. Ele <strong>não indica banco, administradora de consórcio nem produto</strong>, e não é
        recomendação de investimento, de financiamento ou de consórcio. As projeções de juros e inflação podem não se confirmar; por
        isso a tela mostra o ponto em que o vencedor muda. Rentabilidade passada não garante rentabilidade futura. Confira as condições
        reais de cada proposta antes de decidir.
      </div>
    </div>
  )
}

function Resultado({ r, entrada }: { r: ResultadoComparativo; entrada: InputsComparativo }) {
  const [primeiro, segundo] = r.ranking
  const maior = Math.max(...CHAVES.map((c) => r.cenarios[c].patrimonioFinal), 1)
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
          Com os custos de venda: {CHAVES.map((c) => `${NOMES_CURTOS[c]} ${reais(r.patrimonioComCustosVenda[c])}`).join('; ')}.
        </span>
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Como o patrimônio evolui</span>
        <GraficoPatrimonio serie={r.serieMensal} />
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <ParaOndeFoi r={r} compacto={reaisCompacto} />
      </div>

      <div className="col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Cada custo e cada taxa, caminho por caminho</span>
        <BlocoFinanciar r={r} entrada={entrada} />
        <BlocoAlugar r={r} entrada={entrada} />
        <BlocoConsorcio r={r} entrada={entrada} />
      </div>

      {pv && (
        <div className="card col" style={{ gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Em que ponto o resultado muda?</span>
          <div className="small justify" style={{ lineHeight: 1.5 }}>
            {pv.financiamentoVsAluguel != null ? (
              <>
                <strong>Financiar × alugar:</strong> empatam se o imóvel valorizar {porcentagem(pv.financiamentoVsAluguel)} ao ano (você supôs{' '}
                {porcentagem(entrada.valorizacaoImovelAA)}). Acima disso, financiar leva vantagem; abaixo, alugar e investir.
              </>
            ) : (
              <>
                <strong>Financiar × alugar:</strong> entre {pv.intervalo[0]}% e {pv.intervalo[1]}% de valorização ao ano, a ordem entre os dois não muda
                com as demais premissas.
              </>
            )}
          </div>
          <div className="small justify" style={{ lineHeight: 1.5 }}>
            {pv.consorcioVsAluguel != null ? (
              <>
                <strong>Consórcio × alugar:</strong> empatam com valorização de {porcentagem(pv.consorcioVsAluguel)} ao ano. Acima, o consórcio leva
                vantagem; abaixo, alugar e investir.
              </>
            ) : (
              <>
                <strong>Consórcio × alugar:</strong> entre {pv.intervalo[0]}% e {pv.intervalo[1]}% de valorização ao ano, a ordem entre os dois não muda.
              </>
            )}
          </div>

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
            <strong>Mesmo dinheiro nos três caminhos.</strong> A entrada e o ITBI/cartório do financiamento ficam aplicados desde o mês 0 para
            quem aluga ou entra no consórcio. Todo mês, o maior desembolso entre os três vira o orçamento de referência: quem paga menos
            investe a diferença. Assim, nenhum caminho leva vantagem só por gastar menos.
          </span>
          <span>
            <strong>Financiar.</strong> Tabela SAC ou Price pela taxa nominal ao ano dividida por 12, com seguros (MIP sobre o saldo, DFI sobre o imóvel)
            e tarifa. TR zerada. Patrimônio = imóvel valorizado − saldo devedor + investimentos.
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

import { useDeferredValue, useMemo, useState } from 'react'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import { dataCurta, porcentagem, reais } from '../domain/mercadoOficial'
import type { SnapshotMercado } from '../domain/mercadoOficial'
import { reaisCompacto } from '../domain/simulaImovel'
import type { PontoMensal } from '../domain/simulaImovel'
import { NOMES_TIPO, TODOS_CAMINHOS_CARRO, custosAquisicaoFinanciamento, nomesRotas, simularComparativoCarro, validarInputsCarro } from '../domain/simulaCarro'
import { aplicarTipoMoto, inputsMotoDoSnapshot, inputsMotoPadrao } from '../domain/simulaMoto'
import type { ChaveCarro, InputsCarro, PontoDeViradaCarro, ResultadoCarro, TipoCarro } from '../domain/simulaCarro'
import { CampoNumero } from '../ui/CampoNumero'
import { CampoReais } from '../ui/CampoReais'
import { reais0 } from '../ui/DetalheCustos'
import { BlocoAvistaMoto, BlocoConsorcioMoto, BlocoFinanciarMoto, BlocoLocacaoMoto, BlocoSemMoto, ComoLerMoto, ParaOndeFoiMoto, PremissasMoto } from '../ui/DetalheCustosMoto'
import { GraficoPatrimonio } from '../ui/GraficoPatrimonio'
import type { ChaveGrafico } from '../ui/GraficoPatrimonio'
import { VoltarInicio } from '../ui/VoltarInicio'
import type { AppCtx } from '../state/useAppState'

const NOMES = nomesRotas('moto')
const NOMES_CURTOS: Record<ChaveCarro, string> = { financiamento: 'Financiar', semCarro: 'Sem moto', consorcio: 'Consórcio', avista: 'À vista', locacao: 'Locação' }
// O gráfico e as barras do imóvel já têm cor e traço por rota; "sem moto" ocupa o lugar do "aluguel" (a linha de quem não compra) e a locação tem estilo próprio.
const ESTILO_ROTA: Record<ChaveCarro, ChaveGrafico> = { financiamento: 'financiamento', semCarro: 'aluguel', consorcio: 'consorcio', avista: 'avista', locacao: 'locacao' }
const NOMES_GRAFICO: Record<ChaveGrafico, string> = { financiamento: 'Financiar', aluguel: 'Sem moto', consorcio: 'Consórcio', avista: 'À vista', locacao: 'Locação' }
const ORDEM_GRAFICO: ChaveGrafico[] = ['aluguel', 'financiamento', 'consorcio', 'avista', 'locacao']

function resolver(entrada: InputsCarro): { resultado: ResultadoCarro | null; erros: string[] } {
  const erros = validarInputsCarro(entrada)
  if (erros.length) return { resultado: null, erros }
  return { resultado: simularComparativoCarro(entrada), erros: [] }
}

/**
 * Simule Moto (D48): compara comprar à vista, financiar, entrar num consórcio ou ficar sem moto, com o mesmo dinheiro,
 * e mostra o custo de mobilidade de cada caminho (destaque) e o patrimônio final, lado a lado. Tela avulsa: não depende do
 * questionário. Conta matemática sobre premissas informadas; não indica banco, administradora, locadora nem produto.
 */
export function SimuleMoto({
  snapshot = SNAPSHOT_MERCADO,
}: {
  /** Recebido como as demais telas; esta tela só volta ao hub, então não usa o contexto. */
  ctx?: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job semanal. */
  snapshot?: SnapshotMercado
}) {
  const [entrada, setEntrada] = useState<InputsCarro>(() => inputsMotoPadrao({ ...inputsMotoDoSnapshot(snapshot), caminhos: TODOS_CAMINHOS_CARRO }))
  // Deferido: a digitação não espera os ~100 cálculos auxiliares (ponto de virada, contemplação).
  const adiada = useDeferredValue(entrada)
  const { resultado, erros } = useMemo(() => resolver(adiada), [adiada])
  const atualizando = adiada !== entrada

  const mudar = <K extends keyof InputsCarro>(chave: K, valor: InputsCarro[K]) => setEntrada((e) => ({ ...e, [chave]: valor }))
  const focus = snapshot.focus
  const cdi = snapshot.indicadores.cdi?.valor
  const aq = custosAquisicaoFinanciamento(entrada)
  const minimo = entrada.entrada + aq.total
  const disponivel = entrada.dinheiroDisponivel ?? minimo
  const necessarioAvista = Math.round((entrada.valorCarro + (entrada.valorCarro * entrada.emplacamentoPct) / 100) * 100) / 100
  // Caminhos marcados (D69). O mínimo é dois, porque comparar exige ao menos um contra o outro.
  const marcados = entrada.caminhos ?? TODOS_CAMINHOS_CARRO
  const alternar = (c: ChaveCarro) => {
    const novo = marcados.includes(c) ? marcados.filter((x) => x !== c) : TODOS_CAMINHOS_CARRO.filter((x) => x === c || marcados.includes(x))
    if (novo.length < 2) return
    mudar('caminhos', novo)
  }
  const avistaMarcado = marcados.includes('avista')
  const semDinheiroParaAvista = disponivel < necessarioAvista - 0.005

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleBens" rotulo="← Simule Bens" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Comprar à vista, financiar, consórcio, alugar ou ficar sem moto?</h1>
        <div className="muted small justify">
          Informe a moto e as taxas e veja quanto cada caminho <strong>custa</strong> e qual termina com o <strong>maior patrimônio</strong> depois de alguns anos. Moto perde valor, então a conta mostra o custo
          de se mover, e não só o patrimônio. É uma conta matemática, que compara o dinheiro de bolso de cada caminho nas mesmas condições. Para incluir a compra à vista, informe quanto dinheiro você tem hoje.
        </div>
        <a className="small" href="#resultado-moto" style={{ color: 'var(--accent)' }}>Ir para o resultado ↓</a>
      </div>

      <div className="desk-split">
        <div className="desk-main">
          <form className="imovel-form" onSubmit={(e) => e.preventDefault()} aria-label="Dados da simulação">
            <div className="card-outline col" style={{ gap: 8 }} role="group" aria-label="Quais caminhos comparar?">
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>Quais caminhos comparar?</span>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {TODOS_CAMINHOS_CARRO.map((c) => {
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
                      {ligado ? '✓ ' : ''}{NOMES[c]}
                    </button>
                  )
                })}
                {marcados.length < TODOS_CAMINHOS_CARRO.length && (
                  <button type="button" className="chip" onClick={() => mudar('caminhos', TODOS_CAMINHOS_CARRO)}>Comparar todos</button>
                )}
              </div>
              <span className="tiny muted justify" style={{ lineHeight: 1.5 }}>
                Marque dois ou mais. Para trocar um par (por exemplo, de locação × consórcio para locação × financiar), marque o novo e desmarque o outro. O orçamento mensal de referência passa a considerar só os caminhos marcados.
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
              <summary>A moto e o prazo</summary>
              <div className="imovel-grade">
                <div className="span2 col" style={{ gap: 6 }}>
                  <span className="small" style={{ fontWeight: 600 }}>Tipo de moto</span>
                  <div className="row" style={{ gap: 6 }} role="group" aria-label="Tipo de moto">
                    {(['zeroKm', 'seminovo'] as TipoCarro[]).map((t) => (
                      <button type="button" key={t} className={`chip ${entrada.tipo === t ? 'selected' : ''}`} aria-pressed={entrada.tipo === t} onClick={() => setEntrada((e) => aplicarTipoMoto(e, t))}>
                        {NOMES_TIPO[t]}
                      </button>
                    ))}
                  </div>
                  <span className="tiny muted">Ao trocar, a depreciação e a manutenção recarregam os valores de partida do tipo; você pode editá-los abaixo.</span>
                </div>
                <div className="span2">
                  <CampoReais rotulo="Valor da moto" valor={entrada.valorCarro} onMudar={(v) => mudar('valorCarro', v)} />
                </div>
                <div className="span2 col" style={{ gap: 6 }}>
                  <CampoReais
                    rotulo="Dinheiro disponível hoje"
                    valor={disponivel}
                    onMudar={(v) => mudar('dinheiroDisponivel', v > 0 ? v : null)}
                    dica={
                      entrada.dinheiroDisponivel === null
                        ? `Por enquanto, a entrada mais o emplacamento, o IOF e o gravame (${reais0(entrada.entrada)} + ${reais0(aq.total)}). Informe tudo o que você tem: a sobra fica aplicada e, se der para pagar a moto, entra a rota de comprar à vista.`
                        : `Para comprar à vista seriam necessários ${reais0(necessarioAvista)}: a moto (${reais0(entrada.valorCarro)}) mais o emplacamento. A sobra, em qualquer caminho, fica aplicada.`
                    }
                  />
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="chip" onClick={() => mudar('dinheiroDisponivel', necessarioAvista)}>
                      Usar {reais0(necessarioAvista)} (moto + emplacamento)
                    </button>
                    {entrada.dinheiroDisponivel !== null && (
                      <button type="button" className="chip" onClick={() => mudar('dinheiroDisponivel', null)}>
                        Só entrada + custos
                      </button>
                    )}
                  </div>
                </div>
                <CampoReais
                  rotulo="Entrada do financiamento"
                  valor={entrada.entrada}
                  onMudar={(v) => mudar('entrada', v)}
                  dica={entrada.valorCarro > 0 ? `${porcentagem((entrada.entrada / entrada.valorCarro) * 100, 0, 1)} da moto` : undefined}
                />
                <CampoNumero rotulo="Comparar por quantos anos?" valor={entrada.horizonteAnos} onMudar={(v) => mudar('horizonteAnos', v)} sufixo="anos" casas={0} />
                <CampoNumero
                  rotulo="Emplacamento e licenciamento"
                  valor={entrada.emplacamentoPct}
                  onMudar={(v) => mudar('emplacamentoPct', v)}
                  sufixo="%"
                  dica={`${reais0((entrada.valorCarro * entrada.emplacamentoPct) / 100)} sobre o valor da moto, pagos em toda compra. Na troca de um seminovo, é a transferência.`}
                />
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
                <label className="span2 row small" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={entrada.aplicarIR} onChange={(e) => mudar('aplicarIR', e.target.checked)} />
                  <span>
                    A taxa de rendimento é <strong>bruta</strong>: descontar o Imposto de Renda regressivo sobre o ganho dos investimentos.
                  </span>
                </label>
                {focus && (
                  <div className="span2 tiny muted justify" style={{ lineHeight: 1.5 }}>
                    Ponto de partida do rendimento e da inflação: projeção de longo prazo do Boletim Focus (coleta de {dataCurta(focus.data)}), com a Selic como rendimento e o IPCA como inflação. Troque pelos números em que você acredita.
                  </div>
                )}
              </div>
            </details>

            <details className="card-outline imovel-bloco" open>
              <summary>Depreciação e custos de dono</summary>
              <div className="imovel-grade">
                <CampoNumero rotulo="Perda de valor no 1º ano" valor={entrada.deprecAno1Pct} onMudar={(v) => mudar('deprecAno1Pct', v)} sufixo="%" dica="Nominal. Moto 0 km perde mais no primeiro ano" />
                <CampoNumero rotulo="Perda de valor por ano, depois" valor={entrada.deprecDemaisPct} onMudar={(v) => mudar('deprecDemaisPct', v)} sufixo="% ao ano" dica="A tabela FIPE do seu modelo é a melhor referência" />
                <CampoNumero rotulo="IPVA" valor={entrada.ipvaPct} onMudar={(v) => mudar('ipvaPct', v)} sufixo="% ao ano" dica="Sobre o valor de mercado. Varia por estado" />
                <CampoNumero rotulo="Seguro da moto" valor={entrada.seguroPct} onMudar={(v) => mudar('seguroPct', v)} sufixo="% ao ano" dica="Sobre o valor de mercado. Costuma ser maior que no carro por causa do risco de roubo. Use a sua cotação" />
                <CampoNumero rotulo="Manutenção e revisões" valor={entrada.manutencaoAA} onMudar={(v) => mudar('manutencaoAA', v)} sufixo="% ao ano" dica="Sobre o preço de compra, no 1º ano de posse" />
                <CampoNumero rotulo="Envelhecimento da manutenção" valor={entrada.envelhecimentoManutencaoAA} onMudar={(v) => mudar('envelhecimentoManutencaoAA', v)} sufixo="% ao ano" dica="Aumento extra, além da inflação" />
                <div className="span2">
                  <CampoReais rotulo="Uso por mês" valor={entrada.usoMensal} onMudar={(v) => mudar('usoMensal', v)} dica="Combustível, estacionamento, pedágio e lavagem, em R$ de hoje. Capacete e equipamentos entram aqui se você os renova" />
                </div>
                <div className="span2 tiny muted justify" style={{ lineHeight: 1.5 }}>
                  Os valores de partida desta seção são <strong>nossos</strong> (premissas de mercado do tipo de moto escolhido), não uma proposta real. Troque pelos seus.
                </div>
              </div>
            </details>

            <details key={`financiamento-${marcados.includes('financiamento')}`} className="card-outline imovel-bloco" open={marcados.includes('financiamento')}>
              <summary>Financiamento{!marcados.includes('financiamento') && ' (fora da comparação)'}</summary>
              <div className="imovel-grade">
                <CampoNumero
                  rotulo="Juros da proposta"
                  valor={entrada.jurosMensalPct}
                  onMudar={(v) => mudar('jurosMensalPct', v)}
                  sufixo="% ao mês"
                  dica="Use a taxa que o banco ofereceu. Tabela Price. Valor de partida nosso; a média do mercado está na série 25471 do Banco Central"
                />
                <CampoNumero rotulo="Prazo" valor={entrada.prazoFinanciamentoMeses} onMudar={(v) => mudar('prazoFinanciamentoMeses', v)} sufixo="meses" casas={0} />
                <CampoNumero rotulo="IOF" valor={entrada.iofPct} onMudar={(v) => mudar('iofPct', v)} sufixo="%" dica="Sobre o valor financiado, pago no início" />
                <CampoReais rotulo="Gravame" valor={entrada.gravame} onMudar={(v) => mudar('gravame', v)} dica="Registro da alienação da moto" />
              </div>
            </details>

            <details key={`consorcio-${marcados.includes('consorcio')}`} className="card-outline imovel-bloco" open={marcados.includes('consorcio')}>
              <summary>Consórcio{!marcados.includes('consorcio') && ' (fora da comparação)'}</summary>
              <div className="imovel-grade">
                <CampoNumero rotulo="Taxa de administração total" valor={entrada.taxaAdmTotalPct} onMudar={(v) => mudar('taxaAdmTotalPct', v)} sufixo="%" dica="Soma de todo o prazo" />
                <CampoNumero rotulo="Fundo de reserva" valor={entrada.fundoReservaPct} onMudar={(v) => mudar('fundoReservaPct', v)} sufixo="%" />
                <CampoNumero rotulo="Prazo do grupo" valor={entrada.prazoConsorcioMeses} onMudar={(v) => mudar('prazoConsorcioMeses', v)} sufixo="meses" casas={0} />
                <CampoNumero rotulo="Reajuste da carta e das parcelas" valor={entrada.reajusteConsorcioAA} onMudar={(v) => mudar('reajusteConsorcioAA', v)} sufixo="% ao ano" dica="Costuma acompanhar o preço da moto nova" />
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

            <details key={`locacao-${marcados.includes('locacao')}`} className="card-outline imovel-bloco" open={marcados.includes('locacao')}>
              <summary>Locação{!marcados.includes('locacao') && ' (fora da comparação)'}</summary>
              <div className="imovel-grade">
                <CampoReais rotulo="Mensalidade da locação" valor={entrada.locacaoMensal} onMudar={(v) => mudar('locacaoMensal', v)} dica="Em R$ de hoje. Já inclui IPVA, seguro e manutenção. Use o valor da proposta" />
                <CampoNumero rotulo="Reajuste anual" valor={entrada.locacaoReajusteAA} onMudar={(v) => mudar('locacaoReajusteAA', v)} sufixo="% ao ano" dica="Da mensalidade e do quilômetro excedente. IPCA ou IGP-M" />
                <CampoReais rotulo="Caução" valor={entrada.locacaoCaucao} onMudar={(v) => mudar('locacaoCaucao', v)} dica="Paga no início e devolvida no fim, sem rendimento" />
                <CampoReais rotulo="Taxa de entrada" valor={entrada.locacaoTaxaEntrada} onMudar={(v) => mudar('locacaoTaxaEntrada', v)} dica="Adesão ou vistoria. Não é devolvida" />
                <CampoNumero rotulo="Quilômetros incluídos por mês" valor={entrada.locacaoKmIncluido} onMudar={(v) => mudar('locacaoKmIncluido', v)} sufixo="km" casas={0} />
                <CampoNumero rotulo="Quilômetros que você roda por mês" valor={entrada.locacaoKmRodado} onMudar={(v) => mudar('locacaoKmRodado', v)} sufixo="km" casas={0} />
                <div className="span2">
                  <CampoReais rotulo="Preço do quilômetro excedente" valor={entrada.locacaoKmExcedente} onMudar={(v) => mudar('locacaoKmExcedente', v)} dica="Cobrado só sobre o que passar do limite, em R$ de hoje" />
                </div>
                <label className="span2 row small" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={entrada.locacaoComprarNoFim} onChange={(e) => mudar('locacaoComprarNoFim', e.target.checked)} />
                  <span>
                    <strong>Comprar a moto no fim do contrato</strong> (último mês da comparação), pelo valor combinado. Desligado, você devolve a moto e não fica com ele.
                  </span>
                </label>
                {entrada.locacaoComprarNoFim && (
                  <div className="span2">
                    <CampoReais rotulo="Valor da compra no fim" valor={entrada.locacaoValorCompra} onMudar={(v) => mudar('locacaoValorCompra', v)} dica="O valor fixado em contrato, em R$ do dia da compra, sem correção" />
                  </div>
                )}
                <div className="span2 tiny muted justify" style={{ lineHeight: 1.5 }}>
                  Os valores de partida desta seção são <strong>nossos</strong> (ordem de grandeza de mercado), não uma proposta real: troque pelos da locadora. O contrato vale por todo o período da comparação, renovado nas mesmas condições; para uma
                  locação de 24 ou 36 meses, ajuste o horizonte. O uso (combustível etc.) continua por sua conta e vem do bloco de custos de dono.
                </div>
              </div>
            </details>

            <details key={`semCarro-${marcados.includes('semCarro')}`} className="card-outline imovel-bloco" open={marcados.includes('semCarro')}>
              <summary>Sem moto{!marcados.includes('semCarro') && ' (fora da comparação)'}</summary>
              <div className="imovel-grade">
                <div className="span2">
                  <CampoReais
                    rotulo="Quanto você gastaria por mês para se mover sem a moto"
                    valor={entrada.mobilidadeMensal}
                    onMudar={(v) => mudar('mobilidadeMensal', v)}
                    dica="Valor total do mês, com tudo incluído: aplicativo, táxi, transporte público e aluguel avulso. Para uma locação mensal com contrato, use o caminho Locação. Reajustado pela inflação"
                  />
                </div>
                <div className="span2 tiny muted justify" style={{ lineHeight: 1.5 }}>
                  É a premissa que mais pesa e a que você conhece melhor. O resultado mostra, mais abaixo, a partir de que valor ter a moto passa a compensar. No consórcio, este gasto também vale até a contemplação.
                </div>
              </div>
            </details>

            <div className="card-outline col" style={{ gap: 8 }}>
              <label className="row small" style={{ gap: 8, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={entrada.descontarCustosVenda} onChange={(e) => mudar('descontarCustosVenda', e.target.checked)} />
                <span>
                  <strong>Descontar o deságio da revenda</strong> no patrimônio final: lojas costumam pagar abaixo do valor de mercado. Ligado, a moto entra pelo valor de mercado menos {porcentagem(entrada.descontoRevendaPct, 0, 1)}.
                </span>
              </label>
              {entrada.descontarCustosVenda && (
                <CampoNumero rotulo="Deságio da revenda" valor={entrada.descontoRevendaPct} onMudar={(v) => mudar('descontoRevendaPct', v)} sufixo="%" />
              )}
            </div>
          </form>
        </div>

        <div className="desk-side" id="resultado-moto" aria-busy={atualizando}>
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
        <strong>O que este resultado é, e o que não é.</strong> É uma conta matemática: com as taxas e prazos informados, quanto cada caminho custa e qual deixa o maior patrimônio. Ele{' '}
        <strong>não indica banco, administradora de consórcio, locadora, aplicativo nem produto</strong>, e não é recomendação de investimento, de financiamento ou de consórcio. Não mede a utilidade de ter uma moto e <strong>não serve para moto de trabalho</strong> (entrega, mototáxi): ela só compara custos e não considera a renda que a moto gera. As projeções de
        juros, inflação e depreciação podem não se confirmar; por isso a tela mostra o ponto em que o resultado muda. Rentabilidade passada não garante rentabilidade futura. Confira as condições reais de cada proposta antes de decidir.
      </div>
    </div>
  )
}

type Dono = 'avista' | 'financiamento' | 'consorcio'
const SUJEITO_VIRADA: Record<Dono, string> = { avista: 'comprar à vista', financiamento: 'financiar', consorcio: 'o consórcio' }
const TITULO_VIRADA: Record<Dono, string> = { avista: 'Comprar à vista', financiamento: 'Financiar', consorcio: 'Consórcio' }

/**
 * Uma linha do ponto de virada: o gasto mensal em que a rota de ter a moto e a alternativa (ficar sem moto ou alugar) empatam, ou quem fica sempre na frente.
 * Contra "sem moto" a variável é o gasto mensal sem moto; contra a locação, a mensalidade da locação.
 */
function LinhaVirada({ quem, contra, r, pv, valorInformado }: { quem: Dono; contra: 'semCarro' | 'locacao'; r: ResultadoCarro; pv: PontoDeViradaCarro; valorInformado: number }) {
  const ponto = contra === 'semCarro' ? pv[quem] : (pv.contraLocacao?.[quem] ?? null)
  const alternativa = contra === 'semCarro' ? 'ficar sem moto' : 'alugar'
  const variavel = contra === 'semCarro' ? 'o seu gasto mensal sem moto' : 'a mensalidade da locação'
  const titulo = `${TITULO_VIRADA[quem]} × ${contra === 'semCarro' ? 'sem moto' : 'locação'}`
  const naFrente = r.patrimonioSemCustosVenda[quem] >= r.patrimonioSemCustosVenda[contra] ? SUJEITO_VIRADA[quem] : alternativa
  return (
    <div className="small justify" style={{ lineHeight: 1.5 }}>
      {ponto != null ? (
        <>
          <strong>{titulo}:</strong> empatam se {variavel} for de {reais0(ponto)} (você informou {reais0(valorInformado)}). Acima disso, {SUJEITO_VIRADA[quem]} termina à frente; abaixo, {alternativa}.
        </>
      ) : (
        <>
          <strong>{titulo}:</strong> entre {reais0(pv.intervalo[0])} e {reais0(pv.intervalo[1])} por mês, a ordem entre os dois não muda com as demais premissas: {naFrente} fica sempre à frente.
        </>
      )}
    </div>
  )
}

function Resultado({ r, entrada, onIncluirAvista }: { r: ResultadoCarro; entrada: InputsCarro; onIncluirAvista: (valor: number) => void }) {
  const [primeiro, segundo] = r.ranking
  const maiorPat = Math.max(...r.rotas.map((c) => r.cenarios[c].patrimonioFinal), 1)
  const maiorCusto = Math.max(...r.rotas.map((c) => Math.abs(r.cenarios[c].custoLiquidoMensal)), 1)
  const pv = r.pontoDeVirada
  const cen = r.cenarios
  const donos = (['avista', 'financiamento', 'consorcio'] as Dono[]).filter((q) => r.rotas.includes(q))
  const temSem = r.rotas.includes('semCarro')
  const temLoc = r.rotas.includes('locacao')
  const serie: (PontoMensal & { locacao: number })[] = useMemo(
    () => r.serieMensal.map((p) => ({ mes: p.mes, avista: p.avista, financiamento: p.financiamento, consorcio: p.consorcio, aluguel: p.semCarro, locacao: p.locacao })),
    [r.serieMensal],
  )

  return (
    <>
      <div className="card imovel-vencedor col" style={{ gap: 10 }} aria-live="polite">
        <span className="tiny muted">No cenário simulado, em {entrada.horizonteAnos} {entrada.horizonteAnos === 1 ? 'ano' : 'anos'}, o caminho de menor custo, que também termina com o maior patrimônio, é:</span>
        <span className="font-display" style={{ fontWeight: 700, fontSize: 26, color: 'var(--accent)' }}>{r.nomeVencedor}</span>
        <span className="small">
          Custo líquido de <strong>{reais(cen[primeiro].custoLiquidoMensal)} por mês</strong> (custo bruto de {reais(cen[primeiro].custoBrutoMensal)} por mês, antes do rendimento do dinheiro). Patrimônio final de{' '}
          <strong>{reais(cen[primeiro].patrimonioFinal)}</strong>, equivalente a {reais(cen[primeiro].patrimonioFinalHoje)} em dinheiro de hoje. Fica {reais(r.vantagemSobreSegundo)} à frente de{' '}
          <strong>{NOMES[segundo].toLowerCase()}</strong>.
        </span>
        {r.vantagemSobreSegundo < cen[primeiro].patrimonioFinal * 0.03 && (
          <span className="small" style={{ color: 'var(--imovel-contra)', lineHeight: 1.5 }}>
            A diferença é pequena (menos de 3%): qualquer mudança de premissa pode inverter o resultado.
          </span>
        )}
      </div>

      {!r.avista.disponivel && r.caminhosEscolhidos.includes('avista') && (
        <div className="card-outline col" style={{ gap: 8 }} role="note">
          <span className="small justify" style={{ lineHeight: 1.5 }}>
            <strong>Comprar à vista não entrou na comparação.</strong> Com {reais0(r.capitalInicial)} disponíveis você não paga a moto ({reais0(entrada.valorCarro)}) e o emplacamento: seriam necessários{' '}
            {reais0(r.avista.necessario)}, e faltam {reais0(r.avista.falta)}. Informe em "Dinheiro disponível hoje" quanto você tem para incluir essa rota.
          </span>
          <div className="row">
            <button type="button" className="chip" onClick={() => onIncluirAvista(r.avista.necessario)}>
              Incluir comprar à vista (usar {reais0(r.avista.necessario)})
            </button>
          </div>
        </div>
      )}

      <ComoLerMoto r={r} entrada={entrada} />

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Custo de mobilidade por mês</span>
        <div className="imovel-ranking">
          {r.ranking.map((c, k) => (
            <div key={c} className="col" style={{ gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span className="small" style={{ fontWeight: k === 0 ? 700 : 500 }}>{k + 1}º {NOMES[c]}</span>
                <span className="small" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{reais(cen[c].custoLiquidoMensal)} por mês</span>
              </div>
              <div className="imovel-barra-trilha" aria-hidden="true">
                <div className={`imovel-barra ${ESTILO_ROTA[c]}`} style={{ width: `${Math.max(0, (Math.max(0, cen[c].custoLiquidoMensal) / maiorCusto) * 100)}%` }} />
              </div>
              <span className="tiny muted">
                Custo bruto: {reais(cen[c].custoBrutoMensal)} por mês · total no período: {reais0(cen[c].custoLiquido)} líquido, {reais0(cen[c].custoBruto)} bruto
              </span>
            </div>
          ))}
        </div>
        <span className="tiny muted justify">
          <strong>Líquido</strong> = o dinheiro que você colocou menos o que sobrou de patrimônio, já descontado o rendimento do dinheiro. <strong>Bruto</strong> = custos que não voltam + perda de valor da moto, antes do rendimento.
          Custo menor = patrimônio maior: é a mesma conta.
        </span>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Patrimônio líquido final</span>
        <div className="imovel-ranking">
          {r.ranking.map((c, k) => (
            <div key={c} className="col" style={{ gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span className="small" style={{ fontWeight: k === 0 ? 700 : 500 }}>{k + 1}º {NOMES[c]}</span>
                <span className="small" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{reais(cen[c].patrimonioFinal)}</span>
              </div>
              <div className="imovel-barra-trilha" aria-hidden="true">
                <div className={`imovel-barra ${ESTILO_ROTA[c]}`} style={{ width: `${Math.max(0, (cen[c].patrimonioFinal / maiorPat) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <span className="tiny muted justify">
          Valores em R$ do último mês simulado. Moto a valor de mercado + investimentos (líquidos de IR) − dívida restante
          {entrada.descontarCustosVenda ? ', já descontado o deságio da revenda' : '. Sem deságio da revenda'}. Com o deságio:{' '}
          {r.rotas.map((c) => `${NOMES_CURTOS[c]} ${reais(r.patrimonioComCustosVenda[c])}`).join('; ')}.
        </span>
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Como o patrimônio evolui</span>
        <GraficoPatrimonio serie={serie} rotas={ORDEM_GRAFICO.filter((g) => r.rotas.some((c) => ESTILO_ROTA[c] === g))} nomes={NOMES_GRAFICO} />
      </div>

      <div className="card col" style={{ gap: 10 }}>
        <ParaOndeFoiMoto r={r} compacto={reaisCompacto} />
      </div>

      <div className="col" style={{ gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Cada custo e cada taxa, caminho por caminho</span>
        {r.rotas.includes('avista') && <BlocoAvistaMoto r={r} entrada={entrada} />}
        {r.rotas.includes('financiamento') && <BlocoFinanciarMoto r={r} entrada={entrada} />}
        {r.rotas.includes('consorcio') && <BlocoConsorcioMoto r={r} entrada={entrada} />}
        {r.rotas.includes('locacao') && <BlocoLocacaoMoto r={r} entrada={entrada} />}
        {r.rotas.includes('semCarro') && <BlocoSemMoto r={r} entrada={entrada} />}
      </div>

      {pv && (donos.length > 0 && (temSem || temLoc) || (r.sensibilidadeContemplacao?.length ?? 0) > 0) && (
        <div className="card col" style={{ gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Em que ponto o resultado muda?</span>
          {temSem && donos.map((q) => <LinhaVirada key={`sem-${q}`} quem={q} contra="semCarro" r={r} pv={pv} valorInformado={entrada.mobilidadeMensal} />)}
          {temLoc && donos.map((q) => <LinhaVirada key={`loc-${q}`} quem={q} contra="locacao" r={r} pv={pv} valorInformado={entrada.locacaoMensal} />)}

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
                A data da contemplação é a maior incerteza do consórcio: no sorteio ou no lance, ninguém sabe de antemão. Quanto mais cedo, menos tempo você paga a mobilidade sem moto junto com a parcela.
              </span>
            </>
          )}
        </div>
      )}

      {r.avisos.map((a) => (
        <div key={a} className="small" style={{ color: 'var(--imovel-contra)', lineHeight: 1.5 }} role="note">{a}</div>
      ))}

      <PremissasMoto i={entrada} />

      <details className="card-outline premissas-tesouro">
        <summary style={{ fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Como a conta é feita</summary>
        <div className="col small muted justify" style={{ gap: 8, marginTop: 10, lineHeight: 1.5 }}>
          <span>
            <strong>Mesmo dinheiro em todos os caminhos.</strong> O dinheiro que você tem hoje fica aplicado desde o mês 0, menos o que cada caminho gasta na compra: a entrada, o emplacamento, o IOF e o gravame no financiamento;
            a moto e o emplacamento à vista; nada, para quem fica sem moto e no consórcio até a contemplação. Todo mês, o maior desembolso entre os caminhos que você marcou vira o orçamento de referência: quem paga menos investe a diferença.
          </span>
          <span>
            <strong>Duas leituras da mesma conta.</strong> Como todos colocam o mesmo dinheiro, custo líquido = dinheiro colocado − patrimônio final. O custo bruto soma os custos que não voltam e a perda de valor da moto, antes do rendimento.
          </span>
          <span>
            <strong>Depreciação.</strong> A moto perde valor em dois trechos: a taxa do 1º ano e a taxa dos anos seguintes, sobre o valor corrente. O patrimônio usa o valor de mercado, com deságio de revenda opcional.
          </span>
          <span>
            <strong>Financiar.</strong> Tabela Price pela taxa mensal informada, com IOF e gravame pagos no início. O CET é resultado (TIR do fluxo do banco), nunca entrada, para não contar o custo duas vezes.
          </span>
          <span>
            <strong>Comprar à vista.</strong> Só entra se o dinheiro disponível cobrir a moto e o emplacamento. Sem dívida nem juros, só os custos de dono.
          </span>
          <span>
            <strong>Consórcio.</strong> Parcela = carta × (1 + taxa de administração + fundo de reserva) ÷ prazo, corrigida uma vez por ano. Até a contemplação você paga parcela e a mobilidade sem moto; no fim desse mês compra a moto
            equivalente pelo preço daquele mês (a diferença para a carta sai do seu dinheiro) e paga o emplacamento; depois tem os custos de dono e continua pagando a parcela.
          </span>
          <span>
            <strong>Locação.</strong> Mensalidade que já inclui IPVA, seguro e manutenção, reajustada uma vez por ano, mais o quilômetro que passar do limite e o uso (combustível etc.), que é por sua conta. A caução sai do dinheiro no início e volta no fim, sem
            rendimento; a taxa de entrada não volta. Com a compra no fim ligada, você paga o valor combinado no último mês, mais a transferência, e o veículo entra no patrimônio pelo valor de mercado.
          </span>
          <span>
            <strong>Sem moto.</strong> O gasto mensal informado, reajustado pela inflação. Quem tem a moto paga o uso por conta própria; esse valor já inclui tudo.
          </span>
          <span>
            <strong>Investimentos.</strong> Rendimento efetivo ao ano convertido em mensal; aporte no fim do mês. Com a taxa bruta, o IR regressivo incide sobre o ganho na data final.
          </span>
          <span>
            <strong>Não considera:</strong> ganho ou prejuízo de capital na venda, multas, IPVA em cota única, benefícios fiscais (como PCD), seguro prestamista, troca de moto no meio do período e a utilidade de ter a moto. Em valores de hoje, o
            patrimônio é deflacionado pela inflação informada.
          </span>
        </div>
      </details>
    </>
  )
}

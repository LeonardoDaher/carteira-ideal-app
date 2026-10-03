import type { ReactNode } from 'react'
import { porcentagem, reais } from '../domain/mercadoOficial'
import { NOMES_CARRO, NOMES_TIPO } from '../domain/simulaCarro'
import type { ChaveCarro, CustosDono, InputsCarro, ResultadoCarro } from '../domain/simulaCarro'
import { reais0 } from './DetalheCustos'

const pct = (v: number) => porcentagem(v, 0, 3)
const anosTexto = (n: number) => `${n} ${n === 1 ? 'ano' : 'anos'}`
const sinalReais = (v: number) => `${v >= 0 ? '+' : '−'} ${reais0(Math.abs(v))}`
const contagem = (r: ResultadoCarro) => (r.rotas.length === 4 ? 'quatro' : 'três')
const soEntradaEAquisicao = (r: ResultadoCarro) =>
  Math.abs(r.capitalInicial - (r.detalhe.financiamento.entrada + r.detalhe.financiamento.emplacamento + r.detalhe.financiamento.iof + r.detalhe.financiamento.gravame)) < 0.01

function Item({ rotulo, valor, tipo, children }: { rotulo: string; valor: number; tipo: 'custo' | 'patrimonio' | 'neutro'; children: ReactNode }) {
  const sinal = tipo === 'custo' ? '− ' : tipo === 'patrimonio' ? '+ ' : ''
  return (
    <div className={`conta-item ${tipo}`}>
      <div className="conta-item-linha">
        <span>{rotulo}</span>
        <span>
          {sinal}
          {reais0(valor)}
        </span>
      </div>
      <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}

function Secao({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="col" style={{ gap: 2, marginTop: 6 }}>
      <span className="conta-secao">{titulo}</span>
      <span className="tiny muted">{subtitulo}</span>
    </div>
  )
}

/** Fecha a conta do caminho numa tabela: o que entrou, o que virou custo, a perda de valor do carro e o que sobrou. */
function Fechamento({ r, chave }: { r: ResultadoCarro; chave: ChaveCarro }) {
  const c = r.detalhe.contabilidade[chave]
  const linhas: [string, string, boolean?][] = [
    ['Dinheiro que você colocou (capital inicial + orçamento mensal)', reais0(c.totalColocado)],
    ['Custos que não voltam', `− ${reais0(c.custos)}`],
  ]
  if (c.valorizacaoCarro) linhas.push(['Perda de valor do carro (depreciação)', `− ${reais0(Math.abs(c.valorizacaoCarro))}`])
  linhas.push(['Rendimento dos investimentos', `+ ${reais0(c.rendimentoBruto)}`])
  linhas.push(['Imposto de Renda sobre o rendimento', `− ${reais0(c.irSobreRendimento)}`])
  if (c.custosDeVenda) linhas.push(['Deságio na revenda do carro', `− ${reais0(c.custosDeVenda)}`])
  linhas.push([`Patrimônio líquido final (${NOMES_CARRO[chave].toLowerCase()})`, reais0(c.patrimonioFinal), true])
  return (
    <div className="tabela-simulacao" role="table" aria-label={`Fechamento da conta: ${NOMES_CARRO[chave]}`}>
      {linhas.map(([rotulo, valor, destaque]) => (
        <div key={rotulo} role="row" className={`linha-simulacao ${destaque ? 'destaque' : ''}`}>
          <span role="rowheader">{rotulo}</span>
          <span role="cell">{valor}</span>
        </div>
      ))}
    </div>
  )
}

const QUEM_DEFINE: Record<ChaveCarro, string> = {
  financiamento: 'pelo financiamento (parcela, IPVA, seguro, manutenção e uso)',
  semCarro: 'pelo gasto de mobilidade sem carro',
  consorcio: 'pelo consórcio, que paga parcela e a mobilidade sem carro ao mesmo tempo até a contemplação',
  avista: 'pela compra à vista',
}

function Investimentos({ r, chave, quem, entrada }: { r: ResultadoCarro; chave: ChaveCarro; quem: string; entrada: InputsCarro }) {
  const v = r.detalhe.investimentos[chave]
  const orc = r.detalhe.orcamentoInicial
  const meses = Math.round(entrada.horizonteAnos * 12)
  const f = r.detalhe.financiamento
  return (
    <>
      <Secao titulo="Investimentos" subtitulo={quem} />
      {v.capitalInicial > 0 && (
        <Item rotulo="Capital inicial aplicado" valor={v.capitalInicial} tipo="neutro">
          {chave === 'avista' ? (
            <>Sobra do seu dinheiro depois de pagar o carro ({reais0(entrada.valorCarro)}) e o emplacamento ({reais0(f.emplacamento)}): fica aplicada desde o primeiro dia.</>
          ) : chave === 'financiamento' ? (
            <>Sobra do seu dinheiro depois de pagar a entrada ({reais0(entrada.entrada)}), o emplacamento, o IOF e o gravame ({reais0(f.emplacamento + f.iof + f.gravame)}): fica aplicada desde o primeiro dia.</>
          ) : soEntradaEAquisicao(r) ? (
            <>É a entrada ({reais0(entrada.entrada)}) mais emplacamento, IOF e gravame ({reais0(f.emplacamento + f.iof + f.gravame)}): o dinheiro que quem financia gasta na compra. Aqui ele não vai para o carro; fica aplicado desde o primeiro dia.</>
          ) : (
            <>É todo o dinheiro que você tem hoje. Quem compra gasta parte dele na aquisição do carro; aqui ele fica aplicado inteiro desde o primeiro dia.</>
          )}
        </Item>
      )}
      <Item rotulo="Aportes mensais" valor={v.aportesMensais} tipo="neutro">
        {v.aportesMensais > 0 ? (
          <>
            Todo mês, o orçamento de referência (a maior despesa entre os caminhos) menos o que este caminho gasta vira investimento. No 1º mês o orçamento é de {reais0(orc.valor)},
            definido {QUEM_DEFINE[orc.definidoPor]}; este caminho gasta {reais0(v.gastoPrimeiroMes)}, então você aplica {reais0(v.primeiroAporte)}. Ao longo de {anosTexto(entrada.horizonteAnos)}, a
            média é de {reais0(v.aportesMensais / meses)} por mês. Não é dinheiro além do seu orçamento: é a parte do que os outros caminhos gastam que aqui fica guardada. Se você não investir essa
            diferença todo mês, o resultado deste caminho cai.
          </>
        ) : (
          <>Este caminho já gasta, todos os meses, o valor do orçamento de referência. Por isso não sobra nada para investir além do capital inicial.</>
        )}
      </Item>
      <Item rotulo="Total aplicado" valor={v.aportado} tipo="neutro">
        Capital inicial + aportes mensais.
        {v.retirado ? ` Já saíram do investimento ${reais0(v.retirado)} (lance, emplacamento e complemento da carta).` : ''}
      </Item>
      <Item rotulo="Rendimento bruto" valor={v.rendimentoBruto} tipo="patrimonio">
        O que o dinheiro aplicado rendeu na taxa que você informou, com juros sobre juros mês a mês.
      </Item>
      <Item rotulo="Imposto de Renda" valor={v.irPago} tipo="custo">
        Tabela regressiva da renda fixa, cobrada sobre o ganho: 22,5% até 6 meses, 20% até 1 ano, 17,5% até 2 anos e 15% acima de 2 anos. Se você marcou que a taxa já é líquida, o imposto é zero.
      </Item>
      <Item rotulo="Saldo dos investimentos, já líquido" valor={v.saldoLiquido} tipo="neutro">
        Aplicado + rendimento − retiradas − Imposto de Renda.
      </Item>
    </>
  )
}

/** IPVA, seguro, manutenção e uso: os custos de quem tem o carro, explicados um a um. */
function ItensDono({ d, entrada }: { d: CustosDono; entrada: InputsCarro }) {
  return (
    <>
      <Item rotulo="IPVA" valor={d.ipva} tipo="custo">
        Imposto estadual anual sobre a propriedade do veículo. Usamos {pct(entrada.ipvaPct)} do valor de mercado do carro no início de cada ano de posse, então ele cai conforme o carro perde valor. A alíquota
        varia por estado e por tipo de veículo: confira a do seu. Na prática o IPVA é pago uma vez por ano (ou em cotas); aqui é diluído por mês.
      </Item>
      <Item rotulo="Seguro do carro" valor={d.seguro} tipo="custo">
        {pct(entrada.seguroPct)} do valor de mercado ao ano, também recalculado a cada ano de posse. O prêmio real depende do seu perfil, do CEP, do modelo e do uso: use o da cotação que você recebeu.
      </Item>
      <Item rotulo="Manutenção e revisões" valor={d.manutencao} tipo="custo">
        {pct(entrada.manutencaoAA)} do preço de compra por ano no primeiro ano de posse, subindo com a inflação ({pct(entrada.inflacaoAA)}) e mais {pct(entrada.envelhecimentoManutencaoAA)} ao ano por causa da idade do carro: carro
        mais velho quebra mais e tem peça mais cara. Inclui revisões, pneus, freios e troca de óleo; não inclui batida nem multa.
      </Item>
      <Item rotulo="Uso (combustível, estacionamento, pedágio)" valor={d.uso} tipo="custo">
        {reais(entrada.usoMensal)} por mês de hoje, reajustados pela inflação. É o que você gasta para rodar. Quem fica sem carro não paga isso à parte: o valor mensal de mobilidade que você informou já inclui tudo.
      </Item>
    </>
  )
}

/** "O que este resultado mostra": define as duas leituras, explica por que o vencedor ganhou e o que o resultado não é. */
export function ComoLerCarro({ r, entrada }: { r: ResultadoCarro; entrada: InputsCarro }) {
  const [primeiro, segundo] = r.ranking
  const a = r.detalhe.contabilidade[primeiro]
  const b = r.detalhe.contabilidade[segundo]
  const liquidoDeIr = (c: typeof a) => c.rendimentoBruto - c.irSobreRendimento
  const nA = NOMES_CARRO[primeiro].toLowerCase()
  const nB = NOMES_CARRO[segundo].toLowerCase()
  const decomposicao: { rotulo: string; detalhe: string; valor: number }[] = [
    { rotulo: 'Custos que não voltam', detalhe: `${nA} pagou ${reais0(a.custos)}; ${nB} pagou ${reais0(b.custos)}`, valor: b.custos - a.custos },
    {
      rotulo: 'Perda de valor do carro',
      detalhe: `${nA}: ${a.valorizacaoCarro ? reais0(Math.abs(a.valorizacaoCarro)) : 'não tem carro'}; ${nB}: ${b.valorizacaoCarro ? reais0(Math.abs(b.valorizacaoCarro)) : 'não tem carro'}`,
      valor: a.valorizacaoCarro - b.valorizacaoCarro,
    },
    { rotulo: 'Rendimento dos investimentos, líquido de IR', detalhe: `${nA}: ${reais0(liquidoDeIr(a))}; ${nB}: ${reais0(liquidoDeIr(b))}`, valor: liquidoDeIr(a) - liquidoDeIr(b) },
  ]
  if (a.custosDeVenda || b.custosDeVenda) {
    decomposicao.push({ rotulo: 'Deságio na revenda', detalhe: `${nA}: ${reais0(a.custosDeVenda)}; ${nB}: ${reais0(b.custosDeVenda)}`, valor: b.custosDeVenda - a.custosDeVenda })
  }
  const maisPesou = decomposicao.reduce((m, l) => (Math.abs(l.valor) > Math.abs(m.valor) ? l : m))
  const meses = Math.round(entrada.horizonteAnos * 12)
  return (
    <div className="card col" style={{ gap: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 14.5 }}>O que este resultado mostra</span>
      <div className="col small justify" style={{ gap: 8, lineHeight: 1.55 }}>
        <span>
          <strong>Custo e patrimônio são a mesma conta vista de dois lados.</strong> Todos os caminhos partem do mesmo dinheiro e gastam o mesmo orçamento. Então o <strong>custo líquido</strong> de cada
          um (o dinheiro que você colocou menos o patrimônio que sobrou) é só o espelho do <strong>patrimônio líquido final</strong>: quem tem o menor custo é quem tem o maior patrimônio. Por isso os dois
          rankings sempre dão a mesma ordem. O custo é a leitura que importa para um bem que perde valor; o patrimônio mostra o que sobra.
        </span>
        <span>
          <strong>Custo líquido por mês</strong> ({reais0(r.cenarios[primeiro].custoLiquido)} em {meses} meses para {nA}) já desconta o que o seu dinheiro rendeu. Ele depende, portanto, de quanto dinheiro você tem
          aplicado: com muito capital, o rendimento cobre parte do custo e o número cai. Para ver o que saiu do bolso sem voltar, olhe o <strong>custo bruto por mês</strong>: custos mais a perda de valor do carro,
          antes do rendimento.
        </span>
        <span>
          <strong>Patrimônio líquido</strong> é o que você teria no último dia se vendesse o carro pelo valor de mercado, pagasse o que ainda deve e resgatasse os investimentos já descontado o Imposto de Renda.
          {entrada.descontarCustosVenda ? ' Aqui já está descontado o deságio da revenda (a loja paga abaixo da tabela).' : ' Aqui não está descontado o deságio da revenda (a opção está desligada).'}
        </span>
        <span>
          <strong>Os {contagem(r)} caminhos usam o mesmo dinheiro.</strong> Todos partem do mesmo capital ({reais0(r.capitalInicial)},{' '}
          {soEntradaEAquisicao(r) ? 'que seria a entrada mais emplacamento, IOF e gravame' : 'o dinheiro que você informou ter hoje'}) e gastam o mesmo orçamento por mês: a maior despesa entre eles, que no
          primeiro mês é de {reais0(r.orcamentoReferencia[0] ?? 0)}. Quem paga menos investe a diferença.
        </span>
        <span>
          <strong>Por que {r.nomeVencedor.toLowerCase()} terminou {reais0(r.vantagemSobreSegundo)} à frente de {nB}.</strong> Sinal de mais: a diferença favorece {r.nomeVencedor.toLowerCase()}; sinal de menos: favorece {nB}.
        </span>
        <div className="tabela-simulacao" role="table" aria-label="Decomposição da vantagem do primeiro colocado">
          {decomposicao.map((l) => (
            <div key={l.rotulo} role="row" className="linha-simulacao">
              <span role="rowheader" style={{ whiteSpace: 'normal', textAlign: 'left' }}>
                {l.rotulo}
                <span className="tiny" style={{ display: 'block' }}>{l.detalhe}</span>
              </span>
              <span role="cell" style={{ color: l.valor >= 0 ? 'var(--imovel-favor)' : 'var(--imovel-contra)' }}>{sinalReais(l.valor)}</span>
            </div>
          ))}
          <div role="row" className="linha-simulacao destaque">
            <span role="rowheader">Vantagem total</span>
            <span role="cell">{reais0(r.vantagemSobreSegundo)}</span>
          </div>
        </div>
        <span>O que mais pesou nessa diferença foi <strong>{maisPesou.rotulo.toLowerCase()}</strong>.</span>
        <span>
          <strong>O que o resultado não é.</strong> Não é uma previsão, e não mede a utilidade de ter um carro (conforto, tempo, trabalho, lazer). Ele só mostra quanto cada caminho custa em dinheiro, com os valores que
          você informou. Se a depreciação, o rendimento ou o seu gasto sem carro forem diferentes, o vencedor pode mudar (veja "Em que ponto o resultado muda?"). Também não considera a aprovação do crédito, nem a
          contemplação garantida no consórcio.
        </span>
      </div>
    </div>
  )
}

/** Visão rápida: as mesmas linhas de fechamento, lado a lado, em valores compactos. */
export function ParaOndeFoiCarro({ r, compacto: compactoBruto }: { r: ResultadoCarro; compacto: (v: number) => string }) {
  const compacto = (v: number) => compactoBruto(v).replace(/R\$\s?/, '')
  const chaves = r.rotas
  const nomes: Record<ChaveCarro, string> = { financiamento: 'Financiar', semCarro: 'Sem carro', consorcio: 'Consórcio', avista: 'À vista' }
  const c = r.detalhe.contabilidade
  const linhas: [string, (k: ChaveCarro) => string, boolean?][] = [
    ['Dinheiro colocado', (k) => compacto(c[k].totalColocado)],
    ['(−) Custos', (k) => compacto(c[k].custos)],
    ['(−) Depreciação', (k) => (c[k].valorizacaoCarro ? compacto(Math.abs(c[k].valorizacaoCarro)) : '—')],
    ['(+) Rendimento', (k) => compacto(c[k].rendimentoBruto)],
    ['(−) IR', (k) => compacto(c[k].irSobreRendimento)],
  ]
  if (chaves.some((k) => c[k].custosDeVenda)) linhas.push(['(−) Revenda', (k) => compacto(c[k].custosDeVenda)])
  linhas.push(['Patrimônio', (k) => compacto(c[k].patrimonioFinal), true])
  return (
    <div className="col" style={{ gap: 8 }}>
      <span style={{ fontWeight: 700, fontSize: 14.5 }}>Para onde foi cada real</span>
      <div className="tabela-comparativo" role="table" aria-label="Para onde foi o dinheiro em cada caminho" style={{ gridTemplateColumns: `minmax(0, ${chaves.length > 3 ? 1.4 : 1.3}fr) repeat(${chaves.length}, minmax(0, 1fr))` }}>
        <span className="cab" role="columnheader" />
        {chaves.map((k) => (
          <span key={k} className="cab" role="columnheader">{nomes[k]}</span>
        ))}
        {linhas.map(([rotulo, valor, destaque]) => (
          <div key={rotulo} role="row" style={{ display: 'contents' }}>
            <span role="rowheader" className={destaque ? 'destaque' : undefined}>{rotulo}</span>
            {chaves.map((k) => (
              <span key={k} role="cell" className={destaque ? 'destaque' : undefined}>{valor(k)}</span>
            ))}
          </div>
        ))}
      </div>
      <span className="tiny muted justify" style={{ lineHeight: 1.5 }}>
        Patrimônio = dinheiro colocado − custos − depreciação do carro + rendimento − IR{chaves.some((k) => c[k].custosDeVenda) ? ' − deságio da revenda' : ''}. Valores em R$ (mil = milhares; mi = milhões).
        A primeira linha é igual em todos: é a prova de que todos gastaram o mesmo. Abaixo, cada custo é explicado.
      </span>
    </div>
  )
}

export function BlocoFinanciarCarro({ r, entrada }: { r: ResultadoCarro; entrada: InputsCarro }) {
  const d = r.detalhe.financiamento
  const c = r.cenarios.financiamento
  const prazo = Math.round(entrada.prazoFinanciamentoMeses)
  const horizonte = Math.round(entrada.horizonteAnos * 12)
  const parcelasQtd = Math.min(prazo, horizonte)
  const jurosAA = (Math.pow(1 + entrada.jurosMensalPct / 100, 12) - 1) * 100
  return (
    <details className="card-outline" open>
      <summary style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Financiar: cada custo e cada taxa</summary>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        <span className="small justify" style={{ lineHeight: 1.5 }}>
          Você paga a entrada de {reais0(d.entrada)}, financia {reais0(r.financiamento.financiado)} e é dono do carro desde o primeiro dia. Em troca, paga juros, IOF e gravame ao financiar e arca com os custos de ter o carro.
          Foram {parcelasQtd} parcelas dentro dos {anosTexto(entrada.horizonteAnos)} simulados{parcelasQtd < horizonte ? ', e depois de quitar a dívida você deixa de pagar parcela e investe essa folga' : ''}.
        </span>

        <Secao titulo="Custos (dinheiro que não volta)" subtitulo={`Total: ${reais0(c.custoTotal)}. A perda de valor do carro (${reais0(c.depreciacao)}) vem à parte, abaixo.`} />
        <Item rotulo="Emplacamento e licenciamento" valor={d.emplacamento} tipo="custo">
          Taxas de registro do veículo no Detran e documentação. Pago uma vez, no início: {pct(entrada.emplacamentoPct)} do valor do carro.
        </Item>
        <Item rotulo="IOF do financiamento" valor={d.iof} tipo="custo">
          Imposto federal sobre operações de crédito, pago no início: {pct(entrada.iofPct)} do valor financiado. Em prazos de 4 anos a conta fica perto de 3% (0,38% fixo mais 0,0082% ao dia por até 365 dias). Confira o do seu contrato.
        </Item>
        <Item rotulo="Gravame" valor={d.gravame} tipo="custo">
          Taxa de registro da alienação fiduciária: o banco fica com o carro "no nome dele" como garantia até você quitar. {reais(entrada.gravame)} nesta simulação; varia por estado.
        </Item>
        <Item rotulo="Juros do financiamento" valor={d.jurosPagos} tipo="custo">
          O preço do dinheiro que o banco emprestou: {pct(entrada.jurosMensalPct)} ao mês, ou {pct(jurosAA)} ao ano. Tabela Price: a parcela é fixa e, no começo, a maior parte dela é juros. Por isso, nas primeiras parcelas, você
          amortiza pouco da dívida.
        </Item>
        <ItensDono d={d.custosDono} entrada={entrada} />

        <Secao titulo="Dinheiro que vira patrimônio" subtitulo="O que você paga e continua sendo seu" />
        <Item rotulo="Entrada" valor={d.entrada} tipo="patrimonio">Parte do carro que já é sua desde o início.</Item>
        <Item rotulo="Dívida amortizada" valor={d.amortizacaoPaga} tipo="patrimonio">
          Parte das parcelas que reduziu o que você deve. Os juros não entram aqui: são custo.
        </Item>
        <Item rotulo="Perda de valor do carro" valor={c.depreciacao} tipo="custo">
          O carro sai de {reais0(entrada.valorCarro)} para {reais0(c.carro)} em {anosTexto(entrada.horizonteAnos)}. É o maior custo de ter um carro e o único que não aparece em nenhum boleto: perde {pct(entrada.deprecAno1Pct)} no
          primeiro ano e {pct(entrada.deprecDemaisPct)} ao ano depois (premissa {NOMES_TIPO[entrada.tipo].toLowerCase()}, nossa e editável).
        </Item>

        <Investimentos r={r} entrada={entrada} chave="financiamento" quem="A diferença entre o orçamento de referência e o que o financiamento custa por mês" />

        <Secao titulo="O que sobra no fim" subtitulo="" />
        <div className="tabela-simulacao">
          <div className="linha-simulacao"><span>Carro a valor de mercado</span><span>{reais0(c.carro)}</span></div>
          <div className="linha-simulacao"><span>Dívida que ainda resta</span><span>− {reais0(c.saldoDevedor)}</span></div>
          <div className="linha-simulacao"><span>Investimentos (líquidos de IR)</span><span>+ {reais0(c.fundoLiquido)}</span></div>
        </div>
        <Fechamento r={r} chave="financiamento" />

        <div className="tiny muted justify" style={{ lineHeight: 1.5, marginTop: 4 }}>
          Parcela: {reais(r.financiamento.primeiraParcela)} por mês, sem seguro prestamista. O <strong>CET</strong> (custo efetivo total) desta simulação é de {porcentagem(r.financiamento.cetAA)} ao ano: ele junta os juros, o IOF e
          o gravame numa taxa só. Ao comparar propostas, compare o CET, não só os juros. Total pago ao banco no período: {reais0(d.parcelasPagas)}.
        </div>
      </div>
    </details>
  )
}

export function BlocoAvistaCarro({ r, entrada }: { r: ResultadoCarro; entrada: InputsCarro }) {
  const d = r.detalhe.avista
  const c = r.cenarios.avista
  return (
    <details className="card-outline" open>
      <summary style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Comprar à vista: cada custo e cada taxa</summary>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        <span className="small justify" style={{ lineHeight: 1.5 }}>
          Você paga o carro inteiro ({reais0(d.valorPago)}) e o emplacamento no primeiro dia e não tem dívida, juros nem parcela. O que sobra do seu dinheiro fica aplicado. O custo escondido é o rendimento que esse
          dinheiro teria dado se não tivesse virado carro.
        </span>
        <Secao titulo="Custos (dinheiro que não volta)" subtitulo={`Total: ${reais0(c.custoTotal)}. A perda de valor do carro (${reais0(c.depreciacao)}) vem à parte, abaixo.`} />
        <Item rotulo="Emplacamento e licenciamento" valor={d.emplacamento} tipo="custo">Pago uma vez, no início: {pct(entrada.emplacamentoPct)} do valor do carro. Não há IOF nem gravame, porque não há financiamento.</Item>
        <ItensDono d={d.custosDono} entrada={entrada} />
        <Secao titulo="Dinheiro que vira patrimônio" subtitulo="O que você paga e continua sendo seu" />
        <Item rotulo="Perda de valor do carro" valor={c.depreciacao} tipo="custo">
          O carro sai de {reais0(entrada.valorCarro)} para {reais0(c.carro)} em {anosTexto(entrada.horizonteAnos)}. Quem paga à vista perde o mesmo em valor que quem financia: a diferença está nos juros que não paga e no rendimento que deixa de ter.
        </Item>
        <Investimentos r={r} entrada={entrada} chave="avista" quem="Sobra do dinheiro e, todo mês, a diferença entre o orçamento de referência e os custos de dono" />
        <Secao titulo="O que sobra no fim" subtitulo="" />
        <div className="tabela-simulacao">
          <div className="linha-simulacao"><span>Carro a valor de mercado</span><span>{reais0(c.carro)}</span></div>
          <div className="linha-simulacao"><span>Investimentos (líquidos de IR)</span><span>+ {reais0(c.fundoLiquido)}</span></div>
        </div>
        <Fechamento r={r} chave="avista" />
      </div>
    </details>
  )
}

export function BlocoConsorcioCarro({ r, entrada }: { r: ResultadoCarro; entrada: InputsCarro }) {
  const d = r.detalhe.consorcio
  const c = r.cenarios.consorcio
  return (
    <details className="card-outline" open>
      <summary style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Consórcio: cada custo e cada taxa</summary>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        <span className="small justify" style={{ lineHeight: 1.5 }}>
          Você paga parcelas todos os meses, mas só recebe a carta de crédito quando for contemplado (no {entrada.mesContemplacao}º mês, nesta simulação). Até lá, continua pagando a mobilidade sem carro. Depois, compra o carro,
          paga o emplacamento e segue pagando a parcela, agora com os custos de ter o carro. O carro só começa a perder valor a partir da contemplação.
        </span>
        <Secao titulo="Custos (dinheiro que não volta)" subtitulo={`Total: ${reais0(c.custoTotal)}. A perda de valor do carro (${reais0(c.depreciacao)}) vem à parte, abaixo.`} />
        <Item rotulo="Taxa de administração" valor={d.taxaAdministracao} tipo="custo">
          O que a administradora cobra pelo grupo: {pct(entrada.taxaAdmTotalPct)} sobre a carta, somados todos os meses do prazo. Inclui a parte já paga e a que ainda está embutida na dívida restante.
        </Item>
        <Item rotulo="Fundo de reserva" valor={d.fundoReserva} tipo="custo">
          {pct(entrada.fundoReservaPct)} sobre a carta, que cobre inadimplência do grupo. Em muitos contratos, o que sobra é devolvido no fim; aqui tratamos como custo, que é a visão conservadora.
        </Item>
        <Item rotulo="Mobilidade sem carro até a contemplação" valor={d.mobilidadeAteContemplacao} tipo="custo">
          Enquanto espera, você se move sem o carro e paga isso do seu bolso, além da parcela: {reais(entrada.mobilidadeMensal)} por mês de hoje, reajustados pela inflação.
        </Item>
        <Item rotulo="Emplacamento e licenciamento" valor={d.emplacamento} tipo="custo">Pago na contemplação, quando o carro é comprado: {pct(entrada.emplacamentoPct)} do preço do carro naquele mês.</Item>
        <Item rotulo="Reajuste das parcelas" valor={d.reajusteDasParcelas} tipo="custo">
          A carta e as parcelas são corrigidas uma vez por ano ({pct(entrada.reajusteConsorcioAA)} ao ano). Depois que a carta é usada, as parcelas seguem subindo, e isso é custo. A parcela vai de {reais(d.parcelaInicial)} a {reais(d.parcelaFinal)}.
        </Item>
        <ItensDono d={d.custosDono} entrada={entrada} />

        <Secao titulo="Dinheiro que vira patrimônio" subtitulo="O que você paga e continua sendo seu" />
        <Item rotulo="Perda de valor do carro" valor={c.depreciacao} tipo="custo">
          Contada só depois da contemplação: o carro de {reais0(r.consorcio.precoCarroNaContemplacao)} (preço do carro equivalente naquele mês) vale {reais0(c.carro)} no fim.
        </Item>
        <Item rotulo={d.complementoCarta >= 0 ? 'Complemento da carta (sai do seu dinheiro)' : 'Sobra da carta (vai para o seu dinheiro)'} valor={Math.abs(d.complementoCarta)} tipo="neutro">
          Na contemplação, o carro custa {reais0(r.consorcio.precoCarroNaContemplacao)} e a carta corrigida vale {reais0(r.consorcio.cartaNaContemplacao)}. A carta é corrigida uma vez por ano e o preço do carro, ao longo do ano: por isso pode faltar ou sobrar um pouco.
          {d.lance > 0 ? ` Lance de ${reais0(d.lance)} pago com recursos próprios.` : ''}
        </Item>
        <Investimentos r={r} entrada={entrada} chave="consorcio" quem="O capital inicial inteiro e, todo mês, a diferença entre o orçamento de referência e o que o consórcio custa" />
        <Secao titulo="O que sobra no fim" subtitulo="" />
        <div className="tabela-simulacao">
          <div className="linha-simulacao"><span>Carro a valor de mercado</span><span>{reais0(c.carro)}</span></div>
          <div className="linha-simulacao"><span>Dívida que ainda resta</span><span>− {reais0(c.saldoDevedor)}</span></div>
          <div className="linha-simulacao"><span>Investimentos (líquidos de IR)</span><span>+ {reais0(c.fundoLiquido)}</span></div>
        </div>
        <Fechamento r={r} chave="consorcio" />
      </div>
    </details>
  )
}

export function BlocoSemCarro({ r, entrada }: { r: ResultadoCarro; entrada: InputsCarro }) {
  const d = r.detalhe.semCarro
  return (
    <details className="card-outline" open>
      <summary style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Sem carro: cada custo e cada taxa</summary>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        <span className="small justify" style={{ lineHeight: 1.5 }}>
          Você não compra carro: se move por assinatura, locação ou aplicativo e investe todo o resto. {soEntradaEAquisicao(r) ? 'O capital que seria a entrada e os custos de aquisição' : 'Todo o dinheiro que você tem hoje'} ({reais0(r.capitalInicial)}) fica
          aplicado desde o primeiro dia, e todo mês você investe a diferença entre o orçamento de referência e o gasto de mobilidade.
        </span>
        <Secao titulo="Custos (dinheiro que não volta)" subtitulo={`Total: ${reais0(r.cenarios.semCarro.custoTotal)}`} />
        <Item rotulo="Mobilidade sem carro" valor={d.mobilidadePaga} tipo="custo">
          Soma de todo o gasto em {anosTexto(entrada.horizonteAnos)}: começa em {reais(d.mobilidadeInicial)} por mês e, reajustado pela inflação ({pct(entrada.inflacaoAA)}), chega a {reais(d.mobilidadeFinal)}. Use o valor TOTAL do seu mês,
          com tudo incluído (assinatura, corridas, locações avulsas, transporte público). Aqui não há IPVA, seguro, manutenção, financiamento nem perda de valor.
        </Item>
        <Investimentos r={r} entrada={entrada} chave="semCarro" quem="É aqui que o patrimônio de quem fica sem carro se forma: não há carro, só investimentos" />
        <Secao titulo="O que sobra no fim" subtitulo="" />
        <Fechamento r={r} chave="semCarro" />
        <div className="tiny muted justify" style={{ lineHeight: 1.5, marginTop: 4 }}>
          O risco deste caminho é outro: ele depende de o rendimento informado ({pct(entrada.rendimentoAA)} ao ano) se confirmar, de você realmente investir a diferença todo mês, e de o seu gasto de mobilidade ficar perto do que você informou.
          Se você andar muito mais do que o previsto, o gasto sobe e o resultado piora.
        </div>
      </div>
    </details>
  )
}

/** Todas as premissas usadas, para a pessoa conferir e saber exatamente o que gerou o resultado. */
export function PremissasCarro({ i }: { i: InputsCarro }) {
  const grupos: [string, [string, string][]][] = [
    [
      'Carro e prazo',
      [
        ['Tipo', NOMES_TIPO[i.tipo]],
        ['Valor do carro', reais0(i.valorCarro)],
        ['Entrada', `${reais0(i.entrada)} (${pct((i.entrada / i.valorCarro) * 100)})`],
        ['Horizonte da comparação', anosTexto(i.horizonteAnos)],
        ['Dinheiro disponível hoje', i.dinheiroDisponivel === null ? 'só a entrada e os custos de aquisição (sem comprar à vista)' : reais0(i.dinheiroDisponivel)],
      ],
    ],
    [
      'Mercado',
      [
        ['Rendimento dos investimentos', `${pct(i.rendimentoAA)} ao ano, ${i.aplicarIR ? 'bruto (com IR regressivo)' : 'já líquido'}`],
        ['Inflação', `${pct(i.inflacaoAA)} ao ano`],
        ['Depreciação', `${pct(i.deprecAno1Pct)} no 1º ano e ${pct(i.deprecDemaisPct)} ao ano depois`],
        ['Deságio na revenda', i.descontarCustosVenda ? `${pct(i.descontoRevendaPct)} abaixo do valor de mercado` : 'não descontado'],
      ],
    ],
    [
      'Custos de dono',
      [
        ['IPVA', `${pct(i.ipvaPct)} do valor de mercado ao ano`],
        ['Seguro', `${pct(i.seguroPct)} do valor de mercado ao ano`],
        ['Manutenção', `${pct(i.manutencaoAA)} do preço de compra no 1º ano, mais inflação e ${pct(i.envelhecimentoManutencaoAA)} ao ano de envelhecimento`],
        ['Uso (combustível etc.)', `${reais(i.usoMensal)} por mês`],
        ['Emplacamento', `${pct(i.emplacamentoPct)} do carro`],
      ],
    ],
    [
      'Financiamento',
      [
        ['Juros', `${pct(i.jurosMensalPct)} ao mês (Price)`],
        ['Prazo', `${i.prazoFinanciamentoMeses} meses`],
        ['IOF e gravame', `${pct(i.iofPct)} do financiado e ${reais(i.gravame)}`],
      ],
    ],
    [
      'Consórcio',
      [
        ['Taxa de administração e fundo de reserva', `${pct(i.taxaAdmTotalPct)} e ${pct(i.fundoReservaPct)} (total ${pct(i.taxaAdmTotalPct + i.fundoReservaPct)})`],
        ['Prazo do grupo', `${i.prazoConsorcioMeses} meses`],
        ['Reajuste da carta e das parcelas', `${pct(i.reajusteConsorcioAA)} ao ano`],
        ['Contemplação', `no ${i.mesContemplacao}º mês`],
        ['Lance', i.lance > 0 ? `${reais0(i.lance)}, abate ${i.regraLance === 'prazo' ? 'o prazo' : 'a parcela'}` : 'sem lance'],
      ],
    ],
    [
      'Sem carro',
      [['Gasto mensal de mobilidade', `${reais(i.mobilidadeMensal)} por mês de hoje, reajustado pela inflação`]],
    ],
  ]
  return (
    <details className="card-outline">
      <summary style={{ fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Todas as premissas desta simulação</summary>
      <div className="col" style={{ gap: 10, marginTop: 10 }}>
        <span className="tiny muted justify" style={{ lineHeight: 1.5 }}>
          Estes são os números que geraram o resultado. Os valores de partida de depreciação, IPVA, seguro, manutenção, uso, IOF, gravame e juros são nossos, não de uma proposta real: troque pelos seus no formulário e o resultado se atualiza.
        </span>
        {grupos.map(([titulo, linhas]) => (
          <div key={titulo} className="col" style={{ gap: 0 }}>
            <span className="conta-secao">{titulo}</span>
            <div className="tabela-simulacao">
              {linhas.map(([rotulo, valor]) => (
                <div key={rotulo} className="linha-simulacao">
                  <span>{rotulo}</span>
                  <span style={{ whiteSpace: 'normal' }}>{valor}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

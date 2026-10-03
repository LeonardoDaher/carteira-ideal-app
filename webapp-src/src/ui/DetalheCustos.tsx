import type { ReactNode } from 'react'
import { porcentagem, reais } from '../domain/mercadoOficial'
import { NOMES_CENARIOS } from '../domain/simulaImovel'
import type { ChaveCenario, InputsComparativo, ResultadoComparativo } from '../domain/simulaImovel'

/** Reais inteiros, sem centavos: "R$ 1.234.567". Nos detalhes, centavos só atrapalham a leitura. */
export const reais0 = (v: number) => reais(Math.round(v)).replace(/,00$/, '')

const sinalReais = (v: number) => `${v >= 0 ? '+' : '−'} ${reais0(Math.abs(v))}`
const pct = (v: number) => porcentagem(v, 0, 3)
const anosTexto = (n: number) => `${n} ${n === 1 ? 'ano' : 'anos'}`

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

/** Fecha a conta do cenário numa linha só: o que entrou, o que virou custo e o que sobrou de patrimônio. */
function Fechamento({ r, chave }: { r: ResultadoComparativo; chave: ChaveCenario }) {
  const c = r.detalhe.contabilidade[chave]
  const linhas: [string, string, boolean?][] = [
    ['Dinheiro que você colocou (capital inicial + orçamento mensal)', reais0(c.totalColocado)],
    ['Custos que não voltam', `− ${reais0(c.custos)}`],
  ]
  if (c.valorizacaoImovel) linhas.push(['Valorização do imóvel', `+ ${reais0(c.valorizacaoImovel)}`])
  linhas.push(['Rendimento dos investimentos', `+ ${reais0(c.rendimentoBruto)}`])
  linhas.push(['Imposto de Renda sobre o rendimento', `− ${reais0(c.irSobreRendimento)}`])
  if (c.custosDeVenda) linhas.push(['Custos de venda do imóvel', `− ${reais0(c.custosDeVenda)}`])
  linhas.push([`Patrimônio líquido final (${NOMES_CENARIOS[chave].toLowerCase()})`, reais0(c.patrimonioFinal), true])
  return (
    <div className="tabela-simulacao" role="table" aria-label={`Fechamento da conta: ${NOMES_CENARIOS[chave]}`}>
      {linhas.map(([rotulo, valor, destaque]) => (
        <div key={rotulo} role="row" className={`linha-simulacao ${destaque ? 'destaque' : ''}`}>
          <span role="rowheader">{rotulo}</span>
          <span role="cell">{valor}</span>
        </div>
      ))}
    </div>
  )
}

function Investimentos({ r, chave, quem }: { r: ResultadoComparativo; chave: ChaveCenario; quem: string }) {
  const v = r.detalhe.investimentos[chave]
  return (
    <>
      <Secao titulo="Investimentos" subtitulo={quem} />
      <Item rotulo="Dinheiro aplicado" valor={v.aportado} tipo="neutro">
        Capital inicial mais os aportes mensais. Em cada mês, o que sobra do orçamento de referência depois de pagar as despesas deste caminho vai para o investimento.
        {v.retirado ? ` Já saíram do investimento ${reais0(v.retirado)}.` : ''}
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

/** "O que este resultado mostra": define patrimônio líquido, explica por que o vencedor ganhou e o que o resultado não é. */
export function ComoLer({ r, entrada }: { r: ResultadoComparativo; entrada: InputsComparativo }) {
  const [primeiro, segundo] = r.ranking
  const a = r.detalhe.contabilidade[primeiro]
  const b = r.detalhe.contabilidade[segundo]
  const liquidoDeIr = (c: typeof a) => c.rendimentoBruto - c.irSobreRendimento
  const nA = NOMES_CENARIOS[primeiro].toLowerCase()
  const nB = NOMES_CENARIOS[segundo].toLowerCase()
  // Cada linha é "quanto isto favoreceu o primeiro colocado" (positivo) ou "o segundo" (negativo). A soma é a vantagem.
  const decomposicao: { rotulo: string; detalhe: string; valor: number }[] = [
    { rotulo: 'Custos que não voltam', detalhe: `${nA} pagou ${reais0(a.custos)}; ${nB} pagou ${reais0(b.custos)}`, valor: b.custos - a.custos },
    {
      rotulo: 'Valorização do imóvel',
      detalhe: `${nA}: ${a.valorizacaoImovel ? reais0(a.valorizacaoImovel) : 'não compra'}; ${nB}: ${b.valorizacaoImovel ? reais0(b.valorizacaoImovel) : 'não compra'}`,
      valor: a.valorizacaoImovel - b.valorizacaoImovel,
    },
    { rotulo: 'Rendimento dos investimentos, líquido de IR', detalhe: `${nA}: ${reais0(liquidoDeIr(a))}; ${nB}: ${reais0(liquidoDeIr(b))}`, valor: liquidoDeIr(a) - liquidoDeIr(b) },
  ]
  if (a.custosDeVenda || b.custosDeVenda) {
    decomposicao.push({ rotulo: 'Custos de venda do imóvel', detalhe: `${nA}: ${reais0(a.custosDeVenda)}; ${nB}: ${reais0(b.custosDeVenda)}`, valor: b.custosDeVenda - a.custosDeVenda })
  }
  const maisPesou = decomposicao.reduce((m, l) => (Math.abs(l.valor) > Math.abs(m.valor) ? l : m))
  return (
    <div className="card col" style={{ gap: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 14.5 }}>O que este resultado mostra</span>
      <div className="col small justify" style={{ gap: 8, lineHeight: 1.55 }}>
        <span>
          <strong>Patrimônio líquido</strong> é o que você teria no último dia da simulação se vendesse o imóvel pelo preço de mercado, pagasse o que ainda deve e
          resgatasse os investimentos já descontado o Imposto de Renda. Não é só o valor do imóvel nem só o que você guardou: é tudo somado, depois de quitar a dívida.
          {entrada.descontarCustosVenda ? ' Aqui já estão descontados a corretagem e o imposto da venda.' : ' Aqui não estão descontados a corretagem e o imposto da venda do imóvel (a opção está desligada).'}
        </span>
        <span>
          <strong>Os três caminhos usam o mesmo dinheiro.</strong> Todos partem do mesmo capital ({reais0(r.capitalInicial)}, que seria a entrada e o ITBI/cartório) e gastam o
          mesmo orçamento por mês: a maior despesa entre os três, que hoje é de {reais0(r.orcamentoReferencia[0] ?? 0)}. Quem paga menos investe a diferença. Por isso a
          diferença no resultado vem só de <em>para onde o dinheiro foi</em>: virou patrimônio ou virou custo.
        </span>
        <span>
          <strong>Por que {r.nomeVencedor.toLowerCase()} terminou {reais0(r.vantagemSobreSegundo)} à frente de {NOMES_CENARIOS[segundo].toLowerCase()}.</strong> Como os dois
          partem do mesmo dinheiro, a vantagem é a soma de poucas diferenças. Sinal de mais: a diferença favorece {r.nomeVencedor.toLowerCase()}; sinal de menos: favorece{' '}
          {NOMES_CENARIOS[segundo].toLowerCase()}.
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
        <span>
          O que mais pesou nessa diferença foi <strong>{maisPesou.rotulo.toLowerCase()}</strong>.
        </span>
        <span>
          <strong>O que o resultado não é.</strong> Não é uma previsão: ele vale para as taxas e prazos que você informou. Se o rendimento, a valorização do imóvel ou a
          data da contemplação forem diferentes, o vencedor pode mudar (veja "Em que ponto o resultado muda?"). Também não considera a aprovação do crédito, nem a
          contemplação garantida no consórcio.
        </span>
      </div>
    </div>
  )
}

/** Visão rápida: as mesmas linhas de fechamento, lado a lado, em valores compactos. */
export function ParaOndeFoi({ r, compacto }: { r: ResultadoComparativo; compacto: (v: number) => string }) {
  const chaves: ChaveCenario[] = ['financiamento', 'aluguel', 'consorcio']
  const nomes: Record<ChaveCenario, string> = { financiamento: 'Financiar', aluguel: 'Alugar', consorcio: 'Consórcio' }
  const c = r.detalhe.contabilidade
  const linhas: [string, (k: ChaveCenario) => string, boolean?][] = [
    ['Dinheiro colocado', (k) => compacto(c[k].totalColocado)],
    ['(−) Custos', (k) => compacto(c[k].custos)],
    ['(+) Valorização', (k) => (c[k].valorizacaoImovel ? compacto(c[k].valorizacaoImovel) : '—')],
    ['(+) Rendimento', (k) => compacto(c[k].rendimentoBruto)],
    ['(−) IR', (k) => compacto(c[k].irSobreRendimento)],
  ]
  if (chaves.some((k) => c[k].custosDeVenda)) linhas.push(['(−) Venda', (k) => compacto(c[k].custosDeVenda)])
  linhas.push(['Patrimônio', (k) => compacto(c[k].patrimonioFinal), true])
  return (
    <div className="col" style={{ gap: 8 }}>
      <span style={{ fontWeight: 700, fontSize: 14.5 }}>Para onde foi cada real</span>
      <div className="tabela-comparativo" role="table" aria-label="Para onde foi o dinheiro em cada caminho">
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
        Patrimônio = dinheiro colocado − custos + valorização do imóvel + rendimento − IR{c.financiamento.custosDeVenda || c.consorcio.custosDeVenda ? ' − custos de venda' : ''}.
        A primeira linha é igual nos três: é a prova de que todos gastaram o mesmo. Abaixo, cada custo é explicado.
      </span>
    </div>
  )
}

export function BlocoFinanciar({ r, entrada }: { r: ResultadoComparativo; entrada: InputsComparativo }) {
  const d = r.detalhe.financiamento
  const c = r.cenarios.financiamento
  const prazo = Math.round(entrada.prazoFinanciamentoAnos * 12)
  const horizonte = Math.round(entrada.horizonteAnos * 12)
  const parcelasQtd = Math.min(prazo, horizonte)
  return (
    <details className="card-outline" open>
      <summary style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Financiar: cada custo e cada taxa</summary>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        <span className="small justify" style={{ lineHeight: 1.5 }}>
          Você paga a entrada de {reais0(d.entrada)}, financia {reais0(r.financiamento.financiado)} e é dono do imóvel desde o primeiro dia. Em troca, paga juros, seguros
          e tarifa ao banco e arca com os custos de ser proprietário. Foram {parcelasQtd} parcelas dentro dos {anosTexto(entrada.horizonteAnos)} simulados
          {parcelasQtd < horizonte ? ', e depois de quitar a dívida você deixa de pagar parcela e investe essa folga' : ''}.
        </span>

        <Secao titulo="Custos (dinheiro que não volta)" subtitulo={`Total: ${reais0(c.custoTotal)}`} />
        <Item rotulo="ITBI, escritura e registro" valor={d.itbiCartorio} tipo="custo">
          Imposto municipal sobre a compra e taxas de cartório. Pago uma vez, no início. Você informou {pct(entrada.custosIniciaisPct)} do valor do imóvel.
        </Item>
        <Item rotulo="Juros do financiamento" valor={d.jurosPagos} tipo="custo">
          O preço do dinheiro que o banco emprestou: taxa nominal de {pct(entrada.jurosNominalAA)} ao ano ({pct(entrada.jurosNominalAA / 12)} ao mês). No SAC, a parcela de
          amortização é fixa e os juros caem junto com a dívida; na Price, a parcela é fixa e os juros pesam mais no começo. Sistema escolhido: {entrada.sistema === 'SAC' ? 'SAC' : 'Price'}.
        </Item>
        <Item rotulo="Seguro MIP (morte e invalidez)" valor={d.seguroMip} tipo="custo">
          Seguro obrigatório que quita a dívida se o comprador morrer ou ficar inválido. Calculado sobre o saldo devedor ({pct(entrada.mipMensalPct)} ao mês), por isso cai com o
          tempo.
        </Item>
        <Item rotulo="Seguro DFI (danos ao imóvel)" valor={d.seguroDfi} tipo="custo">
          Seguro obrigatório contra danos físicos, como incêndio e desabamento. Calculado sobre o valor do imóvel ({pct(entrada.dfiMensalPct)} ao mês).
        </Item>
        <Item rotulo="Tarifa de administração do banco" valor={d.tarifas} tipo="custo">
          Valor fixo cobrado todo mês pela gestão do contrato: {reais(entrada.tarifaMensal)} por mês.
        </Item>
        <Item rotulo="Custos de quem é dono" valor={d.custosPropriedade} tipo="custo">
          IPTU, condomínio e manutenção. Usamos {pct(entrada.custosPropriedadeAA)} do valor do imóvel por ano, reajustado pela inflação.
        </Item>

        <Secao titulo="Dinheiro que vira patrimônio" subtitulo="O que você paga e continua sendo seu" />
        <Item rotulo="Entrada" valor={d.entrada} tipo="patrimonio">
          Parte do imóvel que já é sua desde o início.
        </Item>
        <Item rotulo="Dívida amortizada" valor={d.amortizacaoPaga} tipo="patrimonio">
          Parte das parcelas que reduziu o que você deve. Juros, seguros e tarifa não entram aqui: eles são custo.
        </Item>
        <Item rotulo="Valorização do imóvel" valor={r.detalhe.contabilidade.financiamento.valorizacaoImovel} tipo="patrimonio">
          O imóvel sai de {reais0(entrada.valorImovel)} para {reais0(c.imovel)} em {anosTexto(entrada.horizonteAnos)}, a {pct(entrada.valorizacaoImovelAA)} ao ano. É uma suposição sua, não uma garantia.
        </Item>

        <Investimentos r={r} chave="financiamento" quem="A diferença entre o orçamento de referência e o que o financiamento custa por mês" />

        <Secao titulo="O que sobra no fim" subtitulo="" />
        <div className="tabela-simulacao">
          <div className="linha-simulacao"><span>Imóvel valorizado</span><span>{reais0(c.imovel)}</span></div>
          <div className="linha-simulacao"><span>Dívida que ainda resta</span><span>− {reais0(c.saldoDevedor)}</span></div>
          <div className="linha-simulacao"><span>Investimentos (líquidos de IR)</span><span>+ {reais0(c.fundoLiquido)}</span></div>
        </div>
        <Fechamento r={r} chave="financiamento" />

        <div className="tiny muted justify" style={{ lineHeight: 1.5, marginTop: 4 }}>
          Primeira parcela: {reais(r.financiamento.primeiraParcela)}, já com seguros e tarifa. Última: {reais(r.financiamento.ultimaParcela)}. O <strong>CET</strong> (custo efetivo
          total) desta simulação é de {porcentagem(r.financiamento.cetAA)} ao ano: ele junta juros, seguros e tarifa numa taxa só. Ao comparar propostas, compare o CET, não só os
          juros. Total pago ao banco no período: {reais0(d.parcelasPagas + d.seguroMip + d.seguroDfi + d.tarifas)}. A TR foi considerada zero.
        </div>
      </div>
    </details>
  )
}

export function BlocoAlugar({ r, entrada }: { r: ResultadoComparativo; entrada: InputsComparativo }) {
  const d = r.detalhe.aluguel
  return (
    <details className="card-outline" open>
      <summary style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Alugar e investir: cada custo e cada taxa</summary>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        <span className="small justify" style={{ lineHeight: 1.5 }}>
          Você não compra o imóvel: paga aluguel e investe todo o resto. O capital que seria a entrada e o ITBI/cartório ({reais0(r.capitalInicial)}) fica aplicado desde o primeiro
          dia, e todo mês você investe a diferença entre o orçamento de referência e o aluguel.
        </span>

        <Secao titulo="Custos (dinheiro que não volta)" subtitulo={`Total: ${reais0(r.cenarios.aluguel.custoTotal)}`} />
        <Item rotulo="Aluguel pago" valor={d.aluguelPago} tipo="custo">
          Soma de todos os aluguéis em {anosTexto(entrada.horizonteAnos)}: começa em {reais(d.aluguelInicial)} por mês e, reajustado {pct(entrada.reajusteAluguelAA)} ao ano, chega a{' '}
          {reais(d.aluguelFinal)}. Se o seu aluguel não inclui condomínio ou IPTU, some esses valores ao aluguel informado. Não há juros, seguros nem ITBI neste caminho.
        </Item>

        <Investimentos r={r} chave="aluguel" quem="É aqui que o patrimônio de quem aluga se forma: não há imóvel, só investimentos" />

        <Secao titulo="O que sobra no fim" subtitulo="" />
        <Fechamento r={r} chave="aluguel" />

        <div className="tiny muted justify" style={{ lineHeight: 1.5, marginTop: 4 }}>
          O risco deste caminho é outro: ele depende de o rendimento informado ({pct(entrada.rendimentoAA)} ao ano) se confirmar e de você realmente investir a diferença todo mês, por{' '}
          {anosTexto(entrada.horizonteAnos)}. O aluguel também pode subir mais que o reajuste informado.
        </div>
      </div>
    </details>
  )
}

export function BlocoConsorcio({ r, entrada }: { r: ResultadoComparativo; entrada: InputsComparativo }) {
  const d = r.detalhe.consorcio
  const c = r.cenarios.consorcio
  const comp = d.complementoCarta
  return (
    <details className="card-outline" open>
      <summary style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Consórcio: cada custo e cada taxa</summary>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        <span className="small justify" style={{ lineHeight: 1.5 }}>
          Você paga parcelas todo mês num grupo de {entrada.prazoConsorcioMeses} meses e, no {entrada.mesContemplacao}º mês, é contemplado e usa a carta de crédito para comprar o
          imóvel. Até lá continua pagando aluguel além da parcela; depois, mora no imóvel e segue pagando as parcelas. A data da contemplação é uma suposição: no sorteio ou no
          lance, ninguém sabe de antemão.
        </span>

        <Secao titulo="Custos (dinheiro que não volta)" subtitulo={`Total: ${reais0(c.custoTotal)}`} />
        <Item rotulo="Taxa de administração" valor={d.taxaAdministracao} tipo="custo">
          Cobrada pela administradora: {pct(entrada.taxaAdmTotalPct)} da carta no total do grupo, diluída nas parcelas. Aqui entra o que você já pagou e o que ainda está embutido
          nas parcelas que faltam, porque essa dívida foi descontada do patrimônio.
        </Item>
        <Item rotulo="Fundo de reserva" valor={d.fundoReserva} tipo="custo">
          {pct(entrada.fundoReservaPct)} da carta, cobrado para cobrir a inadimplência do grupo. Em alguns grupos parte dele é devolvida no fim; esta simulação não conta essa devolução.
        </Item>
        <Item rotulo="Aluguel até a contemplação" valor={d.aluguelAteContemplacao} tipo="custo">
          Nos {entrada.mesContemplacao} primeiros meses você paga a parcela do consórcio e o aluguel ao mesmo tempo.
        </Item>
        <Item rotulo="ITBI, escritura e registro" valor={d.itbiCartorio} tipo="custo">
          Também existem no consórcio: são pagos na compra do imóvel, no mês da contemplação, sobre o preço de mercado daquele mês ({reais0(r.consorcio.precoImovelNaContemplacao)}).
        </Item>
        <Item rotulo="Reajuste das parcelas" valor={d.reajusteDasParcelas} tipo="custo">
          Parcelas e carta são corrigidas uma vez por ano ({pct(entrada.reajusteConsorcioAA)}). Depois que a carta é usada, as parcelas continuam subindo: esse acréscimo é custo. A
          parcela vai de {reais(d.parcelaInicial)} a {reais(d.parcelaFinal)}.
        </Item>
        <Item rotulo="Custos de quem é dono" valor={d.custosPropriedade} tipo="custo">
          IPTU, condomínio e manutenção, só depois que você passa a morar no imóvel: {pct(entrada.custosPropriedadeAA)} do valor por ano, reajustado pela inflação.
        </Item>

        <Secao titulo="Dinheiro que vira patrimônio ou abate a dívida" subtitulo="" />
        <Item rotulo={comp > 0 ? 'Complemento da carta' : 'Sobra da carta'} valor={Math.abs(comp)} tipo="neutro">
          No mês da contemplação o imóvel custa {reais0(r.consorcio.precoImovelNaContemplacao)} e a carta corrigida vale {reais0(r.consorcio.cartaNaContemplacao)}.{' '}
          {comp > 0 ? 'A diferença sai do seu investimento, porque o imóvel subiu mais que a carta.' : 'A diferença sobra e vai para o seu investimento.'}
        </Item>
        {d.lance > 0 && (
          <Item rotulo="Lance com recursos próprios" valor={d.lance} tipo="neutro">
            Dinheiro oferecido para antecipar a contemplação. Ele abate a dívida do consórcio ({entrada.regraLance === 'prazo' ? 'reduzindo o prazo' : 'reduzindo a parcela'}), então não é perdido: a taxa de
            administração sobre ele já está contada acima.
          </Item>
        )}
        <Item rotulo="Valorização do imóvel" valor={r.detalhe.contabilidade.consorcio.valorizacaoImovel} tipo="patrimonio">
          Do mês da contemplação até o fim, o imóvel sobe de {reais0(r.consorcio.precoImovelNaContemplacao)} para {reais0(c.imovel)} ({pct(entrada.valorizacaoImovelAA)} ao ano).
        </Item>

        <Investimentos r={r} chave="consorcio" quem="Capital inicial aplicado desde o mês 0, de onde saem o lance, o ITBI e o complemento da carta" />

        <Secao titulo="O que sobra no fim" subtitulo="" />
        <div className="tabela-simulacao">
          <div className="linha-simulacao"><span>Imóvel valorizado</span><span>{reais0(c.imovel)}</span></div>
          <div className="linha-simulacao"><span>Dívida do consórcio que ainda resta</span><span>− {reais0(c.saldoDevedor)}</span></div>
          <div className="linha-simulacao"><span>Investimentos (líquidos de IR)</span><span>+ {reais0(c.fundoLiquido)}</span></div>
        </div>
        <Fechamento r={r} chave="consorcio" />

        <div className="tiny muted justify" style={{ lineHeight: 1.5, marginTop: 4 }}>
          Total pago de parcelas no período: {reais0(d.parcelasPagas)}. Não estão contados seguro de vida do grupo, taxa de transferência de cota, multa por atraso nem possível
          devolução do fundo de reserva.
        </div>
      </div>
    </details>
  )
}

/** Todas as premissas usadas, para a pessoa conferir e saber exatamente o que gerou o resultado. */
export function PremissasUsadas({ i }: { i: InputsComparativo }) {
  const grupos: [string, [string, string][]][] = [
    [
      'Imóvel e prazo',
      [
        ['Valor do imóvel', reais0(i.valorImovel)],
        ['Entrada', `${reais0(i.entrada)} (${pct((i.entrada / i.valorImovel) * 100)})`],
        ['Horizonte da comparação', anosTexto(i.horizonteAnos)],
      ],
    ],
    [
      'Mercado',
      [
        ['Rendimento dos investimentos', `${pct(i.rendimentoAA)} ao ano, ${i.aplicarIR ? 'bruto (com IR regressivo)' : 'já líquido'}`],
        ['Inflação', `${pct(i.inflacaoAA)} ao ano`],
        ['Valorização do imóvel', `${pct(i.valorizacaoImovelAA)} ao ano`],
        ['Custos de quem é dono', `${pct(i.custosPropriedadeAA)} do imóvel por ano`],
        ['Custos de venda', i.descontarCustosVenda ? `corretagem de ${pct(i.corretagemVendaPct)} e 15% de IR sobre o ganho` : 'não descontados'],
      ],
    ],
    [
      'Financiamento',
      [
        ['Juros nominais', `${pct(i.jurosNominalAA)} ao ano`],
        ['Prazo e sistema', `${anosTexto(i.prazoFinanciamentoAnos)}, ${i.sistema === 'SAC' ? 'SAC' : 'Price'}`],
        ['ITBI, escritura e registro', `${pct(i.custosIniciaisPct)} do imóvel`],
        ['Seguros', `MIP ${pct(i.mipMensalPct)} e DFI ${pct(i.dfiMensalPct)} ao mês`],
        ['Tarifa do banco', `${reais(i.tarifaMensal)} por mês`],
      ],
    ],
    [
      'Aluguel',
      [
        ['Aluguel hoje', reais(i.aluguelMensal)],
        ['Reajuste', `${pct(i.reajusteAluguelAA)} ao ano`],
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
  ]
  return (
    <details className="card-outline">
      <summary style={{ fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Todas as premissas desta simulação</summary>
      <div className="col" style={{ gap: 10, marginTop: 10 }}>
        <span className="tiny muted justify" style={{ lineHeight: 1.5 }}>
          Estes são os números que geraram o resultado. Se algum não for o da sua proposta real, troque no formulário e o resultado se atualiza.
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

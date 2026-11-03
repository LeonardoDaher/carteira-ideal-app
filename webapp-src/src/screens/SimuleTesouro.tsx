import { useId, useState } from 'react'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import {
  LEITURA_DA_TAXA,
  dataCurta,
  formatarTaxa,
  porcentagem,
  reais,
  temTesouro,
  titulosAVenda,
} from '../domain/mercadoOficial'
import type { Indexador, SnapshotMercado, TituloTesouro } from '../domain/mercadoOficial'
import { VALORES_PADRAO, lerValor, minimoDeCompra, prazoPorExtenso, premissasDoSnapshot, simulavel, simular } from '../domain/simulaTesouro'
import { CenarioJuros } from '../ui/CenarioJuros'
import { VoltarInicio } from '../ui/VoltarInicio'
import { rolarParaResultado } from '../ui/rolarParaResultado'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import type { AppCtx } from '../state/useAppState'


const FAMILIAS: { familia: string; rotulo: string; indexador: Indexador }[] = [
  { familia: 'Tesouro Selic', rotulo: 'Selic', indexador: 'selic' },
  { familia: 'Tesouro Prefixado', rotulo: 'Prefixado', indexador: 'prefixado' },
  { familia: 'Tesouro IPCA+', rotulo: 'IPCA+', indexador: 'ipca' },
]

export function SimuleTesouro({
  snapshot = SNAPSHOT_MERCADO,
}: {
  /** Recebido como as demais telas; esta tela só volta à landing, então não usa o contexto. */
  ctx: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job semanal. */
  snapshot?: SnapshotMercado
}) {
  const [familia, setFamilia] = useState(FAMILIAS[0].familia)
  const [nomeTitulo, setNomeTitulo] = useState<string | undefined>()
  const [valorPadrao, setValorPadrao] = useState(5_000)
  const [valorLivre, setValorLivre] = useState('')
  const idValor = useId()

  const premissas = premissasDoSnapshot(snapshot)
  const infoFamilia = FAMILIAS.find((f) => f.familia === familia)!
  const daFamilia = temTesouro(snapshot) ? titulosAVenda(snapshot, familia) : []
  const opcoes = daFamilia.filter(simulavel)
  const comCupom = daFamilia.filter((t) => t.cupom === 'semestral')
  const titulo = opcoes.find((t) => t.nome === nomeTitulo) ?? opcoes[0]

  const valor = valorLivre ? lerValor(valorLivre) : valorPadrao
  const selicHoje = snapshot.indicadores.selicMeta?.valor
  const resultado =
    titulo && premissas && selicHoje != null && snapshot.tesouro.dataBase
      ? simular(titulo, valor, { hojeIso: snapshot.tesouro.dataBase, focus: premissas, selicHoje })
      : null
  const abaixoDoMinimo = titulo != null && valor > 0 && valor < minimoDeCompra(titulo)

  function trocarFamilia(f: string) {
    setFamilia(f)
    setNomeTitulo(undefined)
  }

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleAtivos" rotulo="← Simule Ativos" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule o Tesouro Direto</h1>
        <div className="muted small justify">
          Escolha um título e um valor e veja quanto ele rende até o vencimento, já descontados a custódia da B3 e o Imposto de
          Renda.
        </div>
      </div>

      {!temTesouro(snapshot) ? (
        <div className="card col" style={{ gap: 6 }} role="status">
          <span style={{ fontWeight: 700 }}>As taxas do Tesouro ainda não foram carregadas.</span>
          <span className="muted small justify">
            Elas são atualizadas uma vez por semana a partir dos dados oficiais do Tesouro Nacional. Enquanto isso, consulte os
            títulos à venda em tesourodireto.com.br.
          </span>
        </div>
      ) : (
        // No computador: escolha do título e do valor à esquerda, resultado fixo à direita (D20).
        <div className="desk-split">
          <div className="desk-main">
          <div className="col" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 6 }} role="group" aria-label="Tipo de título">
              {FAMILIAS.map((f) => (
                <button key={f.familia} className={`chip ${f.familia === familia ? 'selected' : ''}`} aria-pressed={f.familia === familia} onClick={() => trocarFamilia(f.familia)}>
                  {f.rotulo}
                </button>
              ))}
            </div>
            <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>{LEITURA_DA_TAXA[infoFamilia.indexador]}</div>
          </div>

          {opcoes.length === 0 ? (
            <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="status">
              Nenhum {familia} sem cupom está à venda na última atualização ({dataCurta(snapshot.tesouro.dataBase!)}).
            </div>
          ) : (
            <div className="col" style={{ gap: 6 }} role="group" aria-label={`Títulos ${familia} à venda`}>
              {opcoes.map((t) => (
                <OpcaoTitulo key={t.nome} titulo={t} selecionado={t.nome === titulo?.nome} onEscolher={() => {
                  setNomeTitulo(t.nome)
                  rolarParaResultado('cartao-tesouro', { soNoComputador: true })
                }} />
              ))}
            </div>
          )}

          {comCupom.length > 0 && (
            <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
              Também à venda, com juros semestrais: {comCupom.map((t) => `${t.nome} (${formatarTaxa(t)})`).join('; ')}. Eles ficam fora
              do simulador porque pagam parte do rendimento a cada seis meses, já com IR, e o resultado dependeria de onde esse
              dinheiro fosse reinvestido.
            </div>
          )}

          <div className="col" style={{ gap: 8 }}>
            <label htmlFor={idValor} style={{ fontWeight: 700, fontSize: 13.5 }}>Quanto você quer aplicar?</label>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Valores sugeridos">
              {VALORES_PADRAO.map((v) => {
                const ativo = !valorLivre && v === valorPadrao
                return (
                  <button
                    key={v}
                    className={`chip ${ativo ? 'selected' : ''}`}
                    aria-pressed={ativo}
                    onClick={() => {
                      setValorPadrao(v)
                      setValorLivre('')
                    }}
                  >
                    {reais(v).replace(',00', '')}
                  </button>
                )
              })}
            </div>
            <input
              id={idValor}
              className="input-cotas"
              inputMode="numeric"
              placeholder="Outro valor, ex.: 2500"
              value={valorLivre}
              onChange={(e) => setValorLivre(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>
          </div>

          <div className="desk-side">
          {titulo && (
            <CartaoSimulacao titulo={titulo} resultado={resultado} semPremissas={!premissas} abaixoDoMinimo={abaixoDoMinimo} valor={valor} />
          )}

          {premissas && (
            <details className="card-outline premissas-tesouro">
              <summary style={{ fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Como a conta é feita</summary>
              <div className="col small muted" style={{ gap: 8, marginTop: 10, lineHeight: 1.5 }}>
                <span className="justify">
                  Taxas e preços de compra da manhã de {dataCurta(snapshot.tesouro.dataBase!)} (Tesouro Transparente). Para a inflação e a
                  Selic dos próximos anos, a simulação usa a mediana das projeções do mercado no Boletim Focus do Banco Central, coleta
                  de {dataCurta(premissas.data)}. Depois do último ano projetado, repete o último valor.
                </span>
                <div className="tabela-premissas" role="table" aria-label="Projeções do Boletim Focus">
                  <span role="columnheader">Ano</span>
                  <span role="columnheader">IPCA</span>
                  <span role="columnheader">Selic no fim do ano</span>
                  {Object.keys(premissas.ipca).map((ano) => (
                    <div key={ano} role="row" style={{ display: 'contents' }}>
                      <span role="cell">{ano}</span>
                      <span role="cell">{porcentagem(premissas.ipca[ano])}</span>
                      <span role="cell">{premissas.selic[ano] != null ? porcentagem(premissas.selic[ano]) : '—'}</span>
                    </div>
                  ))}
                </div>
                <span className="justify">
                  Imposto de Renda sobre o ganho, pela tabela regressiva: 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima
                  disso. Taxa de custódia da B3 de 0,20% ao ano, cobrada no vencimento; no Tesouro Selic, só sobre o que passar de R$ 10
                  mil por CPF. A conta usa dias corridos, e o Tesouro usa dias úteis: o valor exato no vencimento pode diferir um pouco.
                </span>
              </div>
            </details>
          )}
          </div>
        </div>
      )}

      <CenarioJuros snapshot={snapshot} aoLadoDaCarteira={false} />

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Simulação, não promessa de retorno.</strong> O Prefixado e o IPCA+ só entregam a taxa contratada para quem leva o
        título até o vencimento: quem vende antes recebe o preço de mercado do dia, que pode ser maior ou menor. No IPCA+ e no Selic,
        o resultado depende da inflação e dos juros que de fato acontecerem. Estar na lista não é indicação de compra: são todos os
        títulos à venda, por vencimento.
      </div>

      <AvisoEducacional />
    </div>
  )
}

function OpcaoTitulo({ titulo, selecionado, onEscolher }: { titulo: TituloTesouro; selecionado: boolean; onEscolher: () => void }) {
  return (
    <button className={`titulo-opcao ${selecionado ? 'selecionado' : ''}`} aria-pressed={selecionado} onClick={onEscolher}>
      <span className="col" style={{ gap: 2, minWidth: 0, textAlign: 'left' }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{titulo.nome}</span>
        <span className="tiny muted">Vence em {dataCurta(titulo.vencimento)}</span>
      </span>
      <span className="font-display taxa-valor">{formatarTaxa(titulo)}</span>
    </button>
  )
}

function CartaoSimulacao({
  titulo,
  resultado,
  semPremissas,
  abaixoDoMinimo,
  valor,
}: {
  titulo: TituloTesouro
  resultado: ReturnType<typeof simular>
  semPremissas: boolean
  abaixoDoMinimo: boolean
  valor: number
}) {
  if (semPremissas) {
    return (
      <div className="card small muted justify" style={{ lineHeight: 1.5 }} role="status">
        A simulação usa as projeções de inflação e juros do Boletim Focus, que ainda não foram carregadas. Volte depois da próxima
        atualização semanal.
      </div>
    )
  }
  if (!resultado) {
    return (
      <div className="card small muted" role="status">
        Digite um valor para simular.
      </div>
    )
  }

  const linhas: [string, string, boolean?][] = [
    ['Você aplica', reais(resultado.aplicado)],
    ['Valor bruto no vencimento', reais(resultado.bruto)],
    ['Custódia da B3', resultado.custodia > 0 ? `− ${reais(resultado.custodia)}` : 'isento'],
    [`Imposto de Renda (${porcentagem(resultado.aliquotaIr, 1).replace(',0%', '%')})`, `− ${reais(resultado.ir)}`],
    ['Você recebe', reais(resultado.liquido), true],
  ]

  return (
    <div id="cartao-tesouro" className="card col" style={{ gap: 14, scrollMarginTop: 12 }} aria-live="polite">
      <div className="col" style={{ gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{titulo.nome}</span>
        <span className="tiny muted">
          Vence em {dataCurta(titulo.vencimento)}, daqui a {prazoPorExtenso(resultado.dias)}
        </span>
      </div>

      <div className="col" style={{ gap: 2 }}>
        <span className="tiny muted">No vencimento, você recebe cerca de</span>
        <span className="font-display" style={{ fontWeight: 700, fontSize: 26, color: 'var(--accent)' }}>{reais(resultado.liquido)}</span>
        <span className="small muted">
          equivalente a <strong style={{ color: 'var(--text)' }}>{reais(resultado.liquidoHoje)}</strong> em dinheiro de hoje
        </span>
      </div>

      <div className="tabela-simulacao">
        {linhas.map(([rotulo, texto, destaque]) => (
          <div key={rotulo} className={`linha-simulacao ${destaque ? 'destaque' : ''}`}>
            <span>{rotulo}</span>
            <span>{texto}</span>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div className="col caixa-numero">
          <span className="tiny muted">Rentabilidade líquida</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{porcentagem(resultado.liquidoAoAno)}</span>
          <span className="tiny muted">ao ano</span>
        </div>
        <div className="col caixa-numero">
          <span className="tiny muted">Acima da inflação</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{porcentagem(resultado.ganhoRealAoAno)}</span>
          <span className="tiny muted">ao ano, estimado</span>
        </div>
      </div>

      {abaixoDoMinimo && (
        <div className="small justify" style={{ color: 'var(--warning)', lineHeight: 1.5 }} role="note">
          {reais(valor)} fica abaixo do mínimo de compra deste título ({reais(minimoDeCompra(titulo))}: 1% do preço, com piso de R$ 30).
        </div>
      )}
      {titulo.indexador === 'selic' && resultado.aplicado > 10_000 && (
        <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
          A custódia considera que este é o seu único Tesouro Selic: a isenção de R$ 10 mil vale por CPF, somando todos.
        </div>
      )}
    </div>
  )
}

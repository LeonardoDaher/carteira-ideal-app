import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import {
  DIAS_PARA_AVISO_DEFASAGEM,
  dataCurta,
  diasDesde,
  mesAno,
  porcentagem,
  temIndicadores,
  vigenteDesde,
} from '../domain/mercadoOficial'
import type { SnapshotMercado } from '../domain/mercadoOficial'
import { BarChartIcon } from './Icon'
import { GraficoJuros } from './GraficoJuros'

const SNAPSHOT_PADRAO = SNAPSHOT_MERCADO

/**
 * Cenário de juros e inflação (Banco Central), com o gráfico histórico. Aparece nas telas
 * de detalhe das classes de renda fixa. É contexto, não sinal: a carteira de referência
 * não muda conforme esses números.
 */
export function CenarioJuros({
  snapshot = SNAPSHOT_PADRAO,
  hoje = new Date(),
  aoLadoDaCarteira = true,
}: {
  snapshot?: SnapshotMercado
  hoje?: Date
  /** Nas telas da carteira, lembra que a alocação não reage a esses números. */
  aoLadoDaCarteira?: boolean
}) {
  if (!temIndicadores(snapshot)) return null
  const { selicMeta, cdi, ipca12m, dolarPtax } = snapshot.indicadores
  const juroReal = snapshot.derivados.jurosReaisExPost?.valor
  const desde = vigenteDesde(snapshot.historico?.selicMeta)
  const defasado = selicMeta != null && diasDesde(selicMeta.data, hoje) > DIAS_PARA_AVISO_DEFASAGEM

  const itens = [
    selicMeta && { rotulo: 'Selic meta', valor: porcentagem(selicMeta.valor), nota: desde ? `desde ${dataCurta(desde)}` : 'ao ano' },
    cdi && { rotulo: 'CDI', valor: porcentagem(cdi.valor), nota: 'ao ano' },
    ipca12m && { rotulo: 'IPCA 12 meses', valor: porcentagem(ipca12m.valor), nota: `até ${mesAno(ipca12m.data)}` },
    juroReal != null && { rotulo: 'Juro real', valor: porcentagem(juroReal), nota: 'Selic menos IPCA' },
    dolarPtax && { rotulo: 'Dólar PTAX', valor: dolarPtax.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 }), nota: dataCurta(dolarPtax.data) },
  ].filter(Boolean) as { rotulo: string; valor: string; nota: string }[]

  const temHistorico = (snapshot.historico?.selicMeta?.pontos.length ?? 0) > 1

  return (
    <section className="col" style={{ gap: 8 }} aria-labelledby="titulo-cenario-juros">
      <div id="titulo-cenario-juros" className="row" style={{ gap: 6, fontWeight: 700, fontSize: 13.5 }}>
        <BarChartIcon size={15} /> Juros e inflação no Brasil
      </div>

      <div className="card col" style={{ gap: 14 }}>
        <dl className="cenario-grade">
          {itens.map((item) => (
            <div key={item.rotulo} className="cenario-item">
              <dt className="tiny muted">{item.rotulo}</dt>
              <dd className="font-display cenario-valor">{item.valor}</dd>
              <dd className="tiny muted">{item.nota}</dd>
            </div>
          ))}
        </dl>

        {temHistorico && (
          <>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <GraficoJuros selic={snapshot.historico!.selicMeta!} ipca={snapshot.historico?.ipca12m} />
          </>
        )}
      </div>

      {defasado && (
        <div className="tiny justify" style={{ color: 'var(--warning)', lineHeight: 1.5 }}>
          Dados de {dataCurta(selicMeta!.data)}. A atualização semanal pode ter falhado; confira os valores no site do Banco Central.
        </div>
      )}
      <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
        Fonte: Banco Central do Brasil (SGS). O juro real aqui é a Selic meta descontada da inflação dos últimos 12 meses: um
        termômetro do momento, não uma previsão de retorno.{aoLadoDaCarteira && ' A carteira de referência não muda conforme esses números.'}
      </div>
    </section>
  )
}

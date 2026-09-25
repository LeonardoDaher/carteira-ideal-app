import dadosMercado from '../data/mercadoOficial.json'
import {
  DIAS_PARA_AVISO_DEFASAGEM,
  LEITURA_DA_TAXA,
  dataCurta,
  diasDesde,
  formatarTaxa,
  reais,
  temTesouro,
  titulosAVenda,
} from '../domain/mercadoOficial'
import type { Indexador, SnapshotMercado } from '../domain/mercadoOficial'
import { TargetIcon } from './Icon'

const SNAPSHOT_PADRAO = dadosMercado as SnapshotMercado

/**
 * Títulos à venda de uma família do Tesouro Direto na última data-base publicada, em ordem
 * de vencimento. A ordem nunca é por maior taxa, para a lista não soar como indicação.
 */
export function TaxasTesouroHoje({
  familia,
  indexador,
  snapshot = SNAPSHOT_PADRAO,
  hoje = new Date(),
}: {
  familia: string
  indexador: Indexador
  snapshot?: SnapshotMercado
  hoje?: Date
}) {
  const titulos = temTesouro(snapshot) ? titulosAVenda(snapshot, familia) : []
  const dataBase = snapshot.tesouro.dataBase

  return (
    <section className="col" style={{ gap: 8 }} aria-labelledby="titulo-taxas-tesouro">
      <div id="titulo-taxas-tesouro" className="row" style={{ gap: 6, fontWeight: 700, fontSize: 13.5 }}>
        <TargetIcon size={15} /> Taxas de hoje: {familia}
      </div>

      {titulos.length === 0 ? (
        <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }}>
          As taxas de {familia} ainda não foram carregadas. Consulte os títulos à venda em tesourodireto.com.br.
        </div>
      ) : (
        <>
          <div className="card col" style={{ gap: 0, padding: '6px 16px' }}>
            {titulos.map((t) => (
              <div key={t.nome} className="taxa-linha">
                <div className="col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{t.nome}</span>
                  <span className="tiny muted">Vence em {dataCurta(t.vencimento)}</span>
                </div>
                <div className="col" style={{ gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
                  <span className="font-display taxa-valor">{formatarTaxa(t)}</span>
                  {t.puCompra != null && <span className="tiny muted">{reais(t.puCompra)} por título</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>{LEITURA_DA_TAXA[indexador]}</div>
          {dataBase && diasDesde(dataBase, hoje) > DIAS_PARA_AVISO_DEFASAGEM && (
            <div className="tiny justify" style={{ color: 'var(--warning)', lineHeight: 1.5 }}>
              Estas taxas são de {dataCurta(dataBase)} e podem estar desatualizadas. Confira no site do Tesouro Direto antes de decidir.
            </div>
          )}
          <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
            Taxas e preços de compra da manhã de {dataCurta(dataBase!)} (fonte: Tesouro Transparente). Todos os títulos à venda,
            em ordem de vencimento; a lista não é indicação de compra. A taxa muda ao longo do dia, e vale a do momento da compra.
          </div>
        </>
      )}
    </section>
  )
}

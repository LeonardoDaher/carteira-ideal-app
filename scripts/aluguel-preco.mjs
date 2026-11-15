// Junta o aluguel (empréstimo de ações) de um dia com o preço e o volume do mesmo período, para o card "Aluguel × preço" da aba
// "Dados de mercado" do Simule Ações. Para cada ação acrescenta ao emprestimoAtivos.json:
//   capital       fração do capital total da empresa que está alugada (saldo em quantidade ÷ ações de todas as classes)
//   diasDeVolume  quantos dias do volume financeiro médio (21 pregões até a data) o saldo alugado equivale
//   var20         variação do preço nos 20 pregões que TERMINAM na data do aluguel (não até hoje: o aluguel é uma foto daquele dia)
// e no cabeçalho: janela { de, ate, ibov20 } com a variação do Ibovespa na mesma janela.
// Só lê arquivos que o app já tem; não acessa a internet.
// Uso: node scripts/aluguel-preco.mjs   (reprocessa o emprestimoAtivos.json atual)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DADOS = resolve(RAIZ, 'webapp-src/public/dados')
export const JANELA = 20
export const JANELA_VOLUME = 21

/** Total de ações de cada empresa (todas as classes), por prefixo de 4 letras do código (PETR3 e PETR4 são a mesma empresa). */
export function acoesPorEmpresa(fundamentos) {
  const mapa = new Map()
  for (const e of Object.values(fundamentos.empresas ?? {})) {
    const classes = e.acoes?.classes
    if (!Array.isArray(classes)) continue
    const total = classes.reduce((s, c) => s + (Number(c.quantidade) || 0), 0)
    if (total > 0) mapa.set(String(e.ticker).slice(0, 4), total)
  }
  return mapa
}

/** Último fechamento não nulo até o índice `i` (pregões sem negócio vêm como null). */
function fechamentoAte(serie, i) {
  for (let k = i; k >= 0; k--) if (serie[k] && serie[k][0] != null) return serie[k][0]
  return null
}

/** Preço e volume de uma ação na janela que termina em `data`. As séries são alinhadas pela direita com `pregoes`. */
export function precoEVolume(series, ticker, data) {
  const serie = series.ativos?.[ticker]
  const idxData = series.pregoes.indexOf(data)
  if (!serie || idxData < 0) return null
  const deslocamento = series.pregoes.length - serie.length
  const i = idxData - deslocamento
  if (i < JANELA || i >= serie.length) return null
  const fim = fechamentoAte(serie, i)
  const ini = fechamentoAte(serie, i - JANELA)
  if (!fim || !ini) return null
  const vols = serie.slice(Math.max(0, i - JANELA_VOLUME + 1), i + 1).map((p) => (p && Number.isFinite(p[3]) ? p[3] : 0))
  const volumeMedio = vols.reduce((s, v) => s + v, 0) / JANELA_VOLUME // R$ mil por pregão
  return { var20: fim / ini - 1, volumeMedio }
}

/** Variação do Ibovespa nos 20 pregões que terminam em `data`. */
export function ibovNaJanela(barras, data) {
  const i = barras.findIndex((b) => b[0] === data)
  if (i < JANELA) return null
  return { var20: barras[i][4] / barras[i - JANELA][4] - 1, de: barras[i - JANELA][0] }
}

export function enriquecer(snapshot, { fundamentos, series, ibov }) {
  const data = snapshot.dataReferencia
  const acoes = acoesPorEmpresa(fundamentos)
  const janelaIbov = data ? ibovNaJanela(ibov.barras, data) : null
  const registros = snapshot.registros.map((r) => {
    const pv = data ? precoEVolume(series, r.ticker, data) : null
    const total = acoes.get(r.ticker.slice(0, 4))
    return {
      ...r,
      capital: total && r.saldoQuantidade ? +(r.saldoQuantidade / total).toFixed(5) : null,
      diasDeVolume: pv && pv.volumeMedio > 0 ? +(r.saldoFinanceiro / 1000 / pv.volumeMedio).toFixed(2) : null,
      var20: pv ? +pv.var20.toFixed(4) : null,
    }
  })
  return { ...snapshot, janela: janelaIbov ? { de: janelaIbov.de, ate: data, ibov20: +janelaIbov.var20.toFixed(4) } : null, registros }
}

function lerJson(caminho) {
  return JSON.parse(readFileSync(caminho, 'utf8'))
}

export function reprocessar() {
  const arquivo = resolve(DADOS, 'emprestimoAtivos.json')
  const snapshot = lerJson(arquivo)
  if (!snapshot.dataReferencia || !snapshot.registros?.length) { console.log('Aluguel vazio: nada a enriquecer.'); return null }
  const novo = enriquecer(snapshot, {
    fundamentos: lerJson(resolve(DADOS, 'fundamentos.json')),
    series: lerJson(resolve(DADOS, 'acoes-series.json')),
    ibov: lerJson(resolve(DADOS, 'indices-historico/IBOV.json')),
  })
  writeFileSync(arquivo, JSON.stringify(novo, null, 1) + '\n')
  const com = novo.registros.filter((r) => r.var20 != null && r.capital != null && r.diasDeVolume != null).length
  console.log(`Aluguel × preço: ${com} de ${novo.registros.length} ações com preço, volume e capital; janela ${novo.janela ? `${novo.janela.de} a ${novo.janela.ate}, Ibovespa ${(novo.janela.ibov20 * 100).toFixed(1)}%` : 'sem Ibovespa'}.`)
  return novo
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) reprocessar()

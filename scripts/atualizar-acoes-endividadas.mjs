// "Top 15 empresas mais endividadas" (D94): job com trilha de auditoria, no desenho da D89 (diário, auditoria completa mensal).
//
//   node scripts/atualizar-acoes-endividadas.mjs                 execução diária (grava a pasta de auditoria só na primeira do mês)
//   node scripts/atualizar-acoes-endividadas.mjs --completa      força a auditoria completa
//   node scripts/atualizar-acoes-endividadas.mjs --verificar=ultima   refaz o cálculo da última auditoria completa
//
// SEM REDE. Parte dos mesmos insumos da triagem de ações baratas (demonstrações da CVM congeladas na última auditoria completa
// dela, em auditoria/acoes-baratas/) e troca só o preço do dia (historico/acoes.json), que entra no valor de mercado, na liquidez e nas
// verificações de capital. Dívida líquida, EBITDA e a razão vêm dos balanços e não se mexem de um dia para o outro.
//   - Primeira execução do mês (ou parâmetros, código de cálculo ou insumos de origem mudaram, ou --completa): grava
//     auditoria/acoes-endividadas/<data>/ (manifesto com sha256, insumos congelados, as duas configs, memória de cálculo, CSVs).
//   - Demais dias úteis: reaproveita os insumos congelados da pasta do mês, recalcula e CONFERE de forma independente em memória
//     (relê insumos e configs, refaz o cálculo, compara os hashes) e publica sem pasta nova.
// PUBLICAÇÃO: só leva a lista ao app se config/acoes-endividadas.json → publicacao.aprovadoPeloResponsavel === true E a trava de
// sanidade passar. Acesso ABERTO (sem código): webapp-src/src/data/acoesEndividadas.json traz tudo.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { atualizarPrecosDosInsumos, mesclarDesdobramentos } from './atualizar-acoes-baratas.mjs'
import { calcularEndividadas, canonico, hashDoResultado, sha256, verificarSanidade } from './acoes-endividadas-calculo.mjs'
import { conferirEmMemoria, decidirModo, lerAuditoriaCompleta } from './auditoria-diaria.mjs'
import { executarCli, verificar } from './acoes-endividadas-verificar.mjs'

export { verificar }

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ESQUEMA = 1
const PASTA = 'acoes-endividadas'
export const ARQUIVO_APP = path.join('webapp-src', 'src', 'data', 'acoesEndividadas.json')

const lerJson = (arquivo) => JSON.parse(fs.readFileSync(arquivo, 'utf8'))
const gravarJson = (arquivo, obj) => fs.writeFileSync(arquivo, JSON.stringify(obj, null, 2) + '\n')
const gravarGz = (arquivo, obj) => fs.writeFileSync(arquivo, zlib.gzipSync(JSON.stringify(obj), { level: 9 }))
const lerGz = (arquivo) => JSON.parse(zlib.gunzipSync(fs.readFileSync(arquivo)).toString('utf8'))
const hashArquivo = (caminho) => crypto.createHash('sha256').update(fs.readFileSync(caminho)).digest('hex')

/** Hash do código que decide o resultado: o desta lista + a leitura contábil das ações baratas, da qual ela depende. */
export const hashDoCodigo = (raiz) => sha256(hashArquivo(path.join(raiz, 'scripts', 'acoes-endividadas-calculo.mjs')) + hashArquivo(path.join(raiz, 'scripts', 'acoes-baratas-calculo.mjs')))

// ---------------------------------------------------------------------------------------
// CSVs e LEIA-ME
// ---------------------------------------------------------------------------------------

const csvNum = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','))
const csvTxt = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`
const csv = (cabecalho, linhas) => '﻿' + [cabecalho.join(';'), ...linhas.map((l) => l.join(';'))].join('\r\n') + '\r\n'
const COLUNAS_ITEM = ['posicao', 'ticker', 'nome', 'setor', 'cotacao', 'data_cotacao', 'DL/EBITDA', 'divida_liquida_R$', 'divida_bruta_R$', 'caixa_R$', 'ebitda_R$', 'ebit_aj_12m_R$', 'cobertura_juros', 'pl_controladores_R$', 'mktcap_R$', 'alertas', 'demonstracao', 'data_base', 'link_documento']
const linhaItem = (r) => [r.posicao ?? '', r.ticker, csvTxt(r.nome), csvTxt(r.setor), csvNum(r.cotacao), r.dataCotacao, csvNum(r.dlEbitda), csvNum(r.dividaLiquida), csvNum(r.dividaBruta), csvNum(r.caixa), csvNum(r.ebitda), csvNum(r.ebitAjustado), csvNum(r.coberturaJuros), csvNum(r.plControladores), csvNum(r.mktcap), csvTxt((r.alertas ?? []).join(',')), r.demonstracao.doc, r.demonstracao.dtRefer, csvTxt(r.demonstracao.linkDoc)]
export const csvRanking = (lista) => csv(COLUNAS_ITEM, lista.map(linhaItem))
export const csvExclusoes = (resultado) => csv(['ticker', 'nome', 'setor', 'etapa', 'codigo', 'motivo'], resultado.exclusoes.map((e) => [e.ticker, csvTxt(e.nome), csvTxt(e.setor), e.etapa, e.codigo, csvTxt(e.motivo)]))

function leiaMe(pasta, versao, dataPrecos) {
  return `# Auditoria: Top 15 empresas mais endividadas

Execução com preços de **${dataPrecos}** · metodologia **v${versao}**. Sem rede: parte das demonstrações da CVM congeladas na auditoria das ações baratas.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| \`manifesto.json\` | Origem dos insumos (a pasta das ações baratas), hashes das configs, dos insumos, do resultado e do código de cálculo |
| \`config.json\` | Parâmetros próprios desta lista |
| \`config-base.json\` | Cópia exata do config das ações baratas (universo, liquidez e leitura contábil) |
| \`insumos.json.gz\` | Demonstrações da CVM usadas (conta, versão, período, link do documento) e o preço de cada empresa |
| \`resultado.json\` | Ranking, lista sem EBITDA positivo, etapas e exclusões (o que o hash do resultado cobre) |
| \`memoria-de-calculo.json.gz\` | Para cada empresa: cada conta da CVM, cada fórmula e cada número |
| \`ranking.csv\`, \`sem-ebitda-positivo.csv\`, \`exclusoes.csv\` | As mesmas informações, abertas em planilha |

## Como refazer o cálculo e conferir

\`\`\`
node scripts/acoes-endividadas-verificar.mjs ${pasta}
\`\`\`

O comando recalcula o resultado só com \`insumos.json.gz\` + as duas configs e compara com o hash do manifesto. Sem internet.
`
}

// ---------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------

export function executar({ raiz = RAIZ_PADRAO, hoje = null, log = console.log, diaria = false, forcarCompleta = false, agora = new Date() } = {}) {
  const cfg = lerJson(path.join(raiz, 'config', 'acoes-endividadas.json'))
  const base = lerJson(path.join(raiz, 'config', 'acoes-baratas.json'))
  const configAcoes = lerJson(path.join(raiz, 'config', 'acoes.json'))
  const historico = lerJson(path.join(raiz, 'historico', 'acoes.json'))
  if (!historico.pregoes?.length) throw new Error('historico/acoes.json vazio: rode antes a carga inicial de Ações.')
  const dataExecucao = hoje ?? agora.toISOString().slice(0, 10)
  const origem = lerAuditoriaCompleta(raiz, 'acoes-baratas')
  if (!origem.ultima) throw new Error('Sem auditoria completa das ações baratas: rode antes "Atualizar Top 15 Ações Baratas".')
  log(`Empresas mais endividadas: preços de ${historico.pregoes.at(-1)} · insumos de origem em ${origem.ultima.pasta} · execução em ${dataExecucao}`)

  const proprio = lerAuditoriaCompleta(raiz, PASTA)
  const decisao = diaria
    ? decidirModo({ ultima: proprio.ultima, manifesto: proprio.manifesto, hoje: dataExecucao, hashConfig: sha256(canonico({ endividadas: cfg, base })), calculoSha256: hashDoCodigo(raiz), forcarCompleta, origemAtual: origem.ultima.pasta })
    : { modo: 'completa', motivo: 'sem modo diário' }
  let pastaInsumos = origem.ultima.pasta
  let congelados = null
  if (decisao.modo === 'diaria') {
    try { congelados = lerGz(path.join(raiz, proprio.ultima.pasta, 'insumos.json.gz')); pastaInsumos = proprio.ultima.pasta } catch { congelados = null }
  }
  const ehDiaria = decisao.modo === 'diaria' && congelados !== null
  if (!ehDiaria) congelados = lerGz(path.join(raiz, origem.ultima.pasta, 'insumos.json.gz'))
  log(`Auditoria: ${ehDiaria ? 'diária (recalcula e confere, sem pasta nova)' : 'COMPLETA'} · ${ehDiaria ? decisao.motivo : decisao.modo === 'diaria' ? 'não foi possível reaproveitar os insumos congelados' : decisao.motivo}`)

  const configPrecos = { ...configAcoes, desdobramentos: mesclarDesdobramentos(configAcoes.desdobramentos, base.desdobramentos) }
  const insumos = atualizarPrecosDosInsumos({ congelados, historico, configAcoes: configPrecos, cfg: base })
  const fontes = [
    { papel: ehDiaria ? 'Insumos congelados da última auditoria completa desta lista' : 'Insumos congelados da auditoria completa das ações baratas (demonstrações da CVM)', url: `${pastaInsumos}/insumos.json.gz (neste repositório)`, sha256: hashArquivo(path.join(raiz, pastaInsumos, 'insumos.json.gz')) },
    { papel: 'Histórico de preços da B3 (Boletim BVBG.086)', url: 'historico/acoes.json (neste repositório)', ultimoPregao: historico.pregoes.at(-1) },
  ]
  return concluir({ raiz, cfg, base, insumos, fontes, log, agora, dataExecucao, origemInsumos: origem.ultima.pasta, diaria: ehDiaria ? { pasta: proprio.ultima.pasta } : null })
}

/** Calcula, confere, grava a auditoria (execução completa) e o arquivo do app. Separado para os testes alimentarem insumos prontos. */
export function concluir({ raiz, cfg, base, insumos, fontes = [], log = console.log, agora = new Date(), dataExecucao = null, origemInsumos = null, diaria = null }) {
  const dia = dataExecucao ?? agora.toISOString().slice(0, 10)
  const cfgTotal = { endividadas: cfg, base }
  const { resultado, memoria } = calcularEndividadas(insumos, cfg, base)
  const hashes = { config: sha256(canonico(cfgTotal)), insumos: sha256(canonico(insumos)), resultado: hashDoResultado(resultado), memoria: sha256(canonico(memoria)) }
  const publicado = cfg.publicacao.aprovadoPeloResponsavel === true

  const rel = (diaria ? diaria.pasta : path.join('auditoria', PASTA, dia)).replace(/\\/g, '/')
  const pasta = path.join(raiz, rel)
  let manifesto
  if (diaria) {
    const problemas = conferirEmMemoria({ calcular: (ins, c) => calcularEndividadas(ins, c.endividadas, c.base), canonico, sha256, hashDoResultado, insumos, cfg: cfgTotal, hashes })
    if (problemas.length) throw new Error(`Conferência independente falhou: ${problemas.join('; ')}. Nada foi publicado.`)
    log('Conferência independente: OK (insumos e configs relidos, cálculo refeito do zero, hash do resultado confere).')
    manifesto = { geradoEm: agora.toISOString(), hashes }
  } else {
    fs.mkdirSync(pasta, { recursive: true })
    gravarGz(path.join(pasta, 'insumos.json.gz'), insumos)
    gravarJson(path.join(pasta, 'config.json'), cfg)
    gravarJson(path.join(pasta, 'config-base.json'), base)
    gravarJson(path.join(pasta, 'resultado.json'), resultado)
    gravarGz(path.join(pasta, 'memoria-de-calculo.json.gz'), memoria)
    fs.writeFileSync(path.join(pasta, 'ranking.csv'), csvRanking(resultado.ranking))
    fs.writeFileSync(path.join(pasta, 'sem-ebitda-positivo.csv'), csvRanking(resultado.semEbitdaPositivo))
    fs.writeFileSync(path.join(pasta, 'exclusoes.csv'), csvExclusoes(resultado))
    fs.writeFileSync(path.join(pasta, 'LEIA-ME.md'), leiaMe(rel, cfg.versaoMetodologia, insumos.dataPrecos))
    const arquivosHash = {}
    for (const a of ['insumos.json.gz', 'config.json', 'config-base.json', 'resultado.json', 'memoria-de-calculo.json.gz', 'ranking.csv', 'sem-ebitda-positivo.csv', 'exclusoes.csv']) arquivosHash[a] = hashArquivo(path.join(pasta, a))
    manifesto = {
      esquema: ESQUEMA,
      versaoMetodologia: cfg.versaoMetodologia,
      geradoEm: agora.toISOString(),
      dataExecucao: dia,
      dataPrecos: insumos.dataPrecos,
      dataCorte: insumos.dataCorte,
      origemInsumos,
      ambiente: { node: process.version, plataforma: process.platform, commit: process.env.GITHUB_SHA ?? null, execucao: process.env.GITHUB_RUN_ID ?? null },
      codigo: { calculoSha256: hashDoCodigo(raiz), endividadasSha256: hashArquivo(path.join(raiz, 'scripts', 'acoes-endividadas-calculo.mjs')), baseSha256: hashArquivo(path.join(raiz, 'scripts', 'acoes-baratas-calculo.mjs')) },
      hashes: { ...hashes, arquivos: arquivosHash },
      fontes,
      contagens: { universo: resultado.universo, avaliadas: resultado.avaliadas, noRanking: resultado.ranking.length, semEbitdaPositivo: resultado.semEbitdaPositivo.length, exclusoes: resultado.exclusoes.length, etapas: resultado.etapas },
      publicadoNoApp: publicado,
    }
    gravarJson(path.join(pasta, 'manifesto.json'), manifesto)
    gravarJson(path.join(raiz, 'auditoria', PASTA, 'ultima.json'), { pasta: rel, dataExecucao: dia, dataPrecos: insumos.dataPrecos, hashResultado: hashes.resultado, versaoMetodologia: cfg.versaoMetodologia })
  }

  const topo = resultado.ranking.slice(0, cfg.tamanhoDaLista).map((r) => `${r.ticker} ${r.dlEbitda.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`).join(' · ')
  log(`Universo ${resultado.universo} → ${resultado.avaliadas} avaliadas, ${resultado.ranking.length} no ranking, ${resultado.semEbitdaPositivo.length} sem EBITDA positivo, ${resultado.exclusoes.length} fora. Top ${cfg.tamanhoDaLista}: ${topo}`)

  if (publicado) {
    const problemas = verificarSanidade(resultado, cfg)
    if (problemas.length) throw new Error(`Publicação barrada pela trava de sanidade: ${problemas.join('; ')}. ${diaria ? 'Nenhuma pasta foi gravada' : `A auditoria desta execução foi gravada em ${rel} para diagnóstico`}; o app não foi alterado.`)
  }

  const snapshot = montarSnapshotApp({ resultado, cfg, base, manifesto, pasta: rel, publicado, dataExecucao: dia, modo: diaria ? 'diaria' : 'completa' })
  fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data'), { recursive: true })
  gravarJson(path.join(raiz, ARQUIVO_APP), snapshot)
  log(publicado ? 'App: lista PUBLICADA (acesso aberto).' : `App: lista NÃO publicada (aprovadoPeloResponsavel = false).${diaria ? '' : ' A auditoria completa foi gravada.'}`)
  return { resultado, hashes, pasta, publicado, modo: diaria ? 'diaria' : 'completa' }
}

/** Remove, em qualquer nível, as chaves que começam com "_" (notas internas do config). */
export function semNotas(valor) {
  if (Array.isArray(valor)) return valor.map(semNotas)
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, semNotas(v)]))
  return valor
}

/** O que o app lê. Sem aprovação do responsável, vai só o cabeçalho (o app mostra "em validação"). */
export function montarSnapshotApp({ resultado, cfg, base, manifesto, pasta, publicado, dataExecucao, modo }) {
  const topo = resultado.ranking.slice(0, cfg.tamanhoDaLista)
  const restante = resultado.ranking.slice(cfg.tamanhoDaLista).map((r) => ({ ticker: r.ticker, nome: r.nome, setor: r.setor, posicao: r.posicao, dlEbitda: r.dlEbitda }))
  return {
    publicado,
    versaoMetodologia: cfg.versaoMetodologia,
    geradoEm: manifesto.geradoEm,
    dataExecucao,
    dataPrecos: resultado.dataPrecos,
    dataCorte: resultado.dataCorte,
    pastaAuditoria: pasta,
    hashResultado: manifesto.hashes.resultado,
    hashInsumos: manifesto.hashes.insumos,
    hashConfig: manifesto.hashes.config,
    modoAuditoria: modo,
    auditoriaCompletaEm: path.posix.basename(pasta),
    tamanhoDaLista: cfg.tamanhoDaLista,
    universo: resultado.universo,
    avaliadas: resultado.avaliadas,
    aviso: cfg.publicacao.aviso ?? cfg.publicacao.avisoProposto ?? null,
    parametros: {
      indicador: cfg.criterio.indicador,
      liquidezMinimaDiariaReais: base.filtros.liquidezMinimaDiariaReais,
      sessoesLiquidez: base.filtros.sessoesLiquidez,
      idadeMaximaDemonstracaoDias: base.filtros.idadeMaximaDemonstracaoDias,
      setoresExcluidos: base.universo.setoresExcluidos,
    },
    contagens: { ranking: resultado.ranking.length, semEbitdaPositivo: resultado.semEbitdaPositivo.length, exclusoes: resultado.exclusoes.length },
    etapas: publicado ? resultado.etapas : [],
    ranking: publicado ? topo : [],
    restante: publicado ? restante : [],
    semEbitdaPositivo: publicado ? resultado.semEbitdaPositivo : [],
    exclusoes: publicado ? resultado.exclusoes : [],
  }
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    if (process.argv.some((x) => x.startsWith('--verificar'))) process.exit(executarCli('ultima'))
    // Diário por padrão (D89): grava a pasta de auditoria só na primeira execução do mês; --completa força a pasta.
    executar({ hoje: process.argv.find((x) => x.startsWith('--data='))?.slice(7) ?? null, diaria: true, forcarCompleta: process.argv.includes('--completa') })
    process.exit(executarCli('ultima'))
  } catch (e) {
    console.error(`ERRO: ${e.message}`)
    process.exit(1)
  }
}

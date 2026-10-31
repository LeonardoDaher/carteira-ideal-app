// Capital regulatório dos bancos, lido do IF.data do Banco Central (serviço OData "IFDATA" do Olinda).
//
//   - `IfDataCadastro(AnoMes)`: instituições do trimestre, com o CNPJ (raiz de 8 dígitos) da líder e o código do conglomerado prudencial.
//   - `IfDataValores(AnoMes, TipoInstituicao, Relatorio)`: valores de um relatório. TipoInstituicao 1 = conglomerado prudencial;
//     relatório 5 = "Informações de Capital" (índices de Basileia, capital principal, nível I e razão de alavancagem).
// Os nomes dos parâmetros precisam ser exatamente os da assinatura (@AnoMes, @TipoInstituicao, @Relatorio): qualquer outro nome dá erro 500.
// Este módulo só baixa e lê as respostas validando o formato; a ligação com as empresas fica em atualizar-balancos.mjs.

const BASE = 'https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata'
const CABECALHO = { 'user-agent': 'Mozilla/5.0 (carteira-ideal; balancos)' }

const aspas = (valor) => `'${String(valor).replace(/'/g, "''")}'`
const filtroOu = (campo, valores) => valores.map((v) => `${campo} eq ${aspas(v)}`).join(' or ')

export const urlCadastro = (anoMes, cnpjsRaiz) => `${BASE}/IfDataCadastro(AnoMes=@AnoMes)?@AnoMes=${anoMes}&$format=json&$filter=${encodeURIComponent(filtroOu('CnpjInstituicaoLider', cnpjsRaiz))}`
export const urlCapital = (anoMes, codigos) =>
  `${BASE}/IfDataValores(AnoMes=@AnoMes,TipoInstituicao=@TipoInstituicao,Relatorio=@Relatorio)?@AnoMes=${anoMes}&@TipoInstituicao=1&@Relatorio='5'&$format=json&$filter=${encodeURIComponent(filtroOu('CodInst', codigos))}`

/** "AAAA-MM-DD" (fim de trimestre) → AAAAMM do IF.data. */
export const anoMesDoPeriodo = (periodo) => Number(periodo.slice(0, 4) + periodo.slice(5, 7))

/** Raiz do CNPJ (8 dígitos) a partir do CNPJ completo, com ou sem pontuação. */
export const raizDoCnpj = (cnpj) => {
  const d = String(cnpj ?? '').replace(/\D/g, '')
  return d.length >= 8 ? d.slice(0, 8) : null
}

/**
 * Cadastro → { raizDoCnpj: código do conglomerado prudencial }. Quando a líder aparece em mais de um conglomerado, vale o mais frequente
 * (instituições do mesmo grupo repetem o código). Ignora linhas sem código prudencial.
 */
export function lerCadastro(json) {
  const linhas = Array.isArray(json?.value) ? json.value : null
  if (!linhas) return null
  const contagem = new Map()
  for (const l of linhas) {
    const raiz = String(l.CnpjInstituicaoLider ?? '').replace(/\D/g, '').slice(0, 8)
    const codigo = l.CodConglomeradoPrudencial
    if (raiz.length !== 8 || !codigo) continue
    const porCodigo = contagem.get(raiz) ?? new Map()
    porCodigo.set(codigo, (porCodigo.get(codigo) ?? 0) + 1)
    contagem.set(raiz, porCodigo)
  }
  const saida = {}
  for (const [raiz, porCodigo] of contagem) saida[raiz] = [...porCodigo.entries()].sort((a, b) => b[1] - a[1])[0][0]
  return saida
}

const semEspacos = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim()

const COLUNAS_CAPITAL = [
  ['basileia', /^Índice de Basileia\b/i],
  ['capitalPrincipal', /^Índice de Capital Principal\b/i],
  ['nivel1', /^Índice de Capital Nível I\b/i],
  ['razaoAlavancagem', /^Razão de Alavancagem\b/i],
]

/**
 * Relatório de capital → { [codInst]: { basileia, capitalPrincipal, nivel1, razaoAlavancagem } } (frações: 0,148 = 14,8%). Campo ausente
 * é null. Índice fora de (0, 1,5) é descartado como lixo. Devolve null se o formato não for o esperado.
 */
export function lerCapital(json) {
  const linhas = Array.isArray(json?.value) ? json.value : null
  if (!linhas) return null
  const saida = {}
  for (const l of linhas) {
    const nome = semEspacos(l.NomeColuna)
    const alvo = COLUNAS_CAPITAL.find(([, re]) => re.test(nome))
    if (!alvo || !l.CodInst) continue
    const v = typeof l.Saldo === 'number' ? l.Saldo : null
    const ok = v != null && Number.isFinite(v) && v > 0 && v < 1.5
    saida[l.CodInst] ??= { basileia: null, capitalPrincipal: null, nivel1: null, razaoAlavancagem: null }
    if (ok) saida[l.CodInst][alvo[0]] = v
  }
  return saida
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

async function pedirJson(endereco, { fetchImpl, tentativas = 3, pausaMs = 1500 }) {
  let ultimo
  for (let t = 1; t <= tentativas; t++) {
    try {
      const resp = await fetchImpl(endereco, { headers: CABECALHO })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      return JSON.parse((await resp.text()).replace(/^\/\*[\s\S]*?\*\/\s*/, ''))
    } catch (e) {
      ultimo = e
      if (t < tentativas) await pausa(pausaMs)
    }
  }
  throw ultimo
}

/** Conglomerados prudenciais das raízes de CNPJ, pelo cadastro do trimestre. */
export async function baixarCadastro(anoMes, raizes, { fetchImpl = fetch } = {}) {
  return lerCadastro(await pedirJson(urlCadastro(anoMes, raizes), { fetchImpl }))
}

/** Capital dos conglomerados no trimestre. Trimestre ainda não publicado devolve {}. */
export async function baixarCapital(anoMes, codigos, { fetchImpl = fetch } = {}) {
  return lerCapital(await pedirJson(urlCapital(anoMes, codigos), { fetchImpl })) ?? {}
}

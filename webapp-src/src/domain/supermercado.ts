/**
 * Meu Mês Supermercado (D74): lista de compras com categorias. A pessoa escreve (ou dita, pelo
 * teclado do celular) o que precisa comprar, o app separa em itens, sugere uma categoria para
 * cada um e ela vai ticando no mercado. Sem IA e sem rede: tudo é regra simples e fica no
 * aparelho (localStorage), como o resto do Meu Mês.
 */

export type CategoriaId =
  | 'hortifruti'
  | 'acougue'
  | 'padaria'
  | 'frios'
  | 'mercearia'
  | 'bebidas'
  | 'congelados'
  | 'limpeza'
  | 'higiene'
  | 'pet'
  | 'outros'

/** Na ordem em que a maioria dos mercados organiza os corredores. */
export const CATEGORIAS: readonly { id: CategoriaId; nome: string; emoji: string }[] = [
  { id: 'hortifruti', nome: 'Hortifruti', emoji: '🥬' },
  { id: 'acougue', nome: 'Açougue e peixaria', emoji: '🥩' },
  { id: 'padaria', nome: 'Padaria', emoji: '🥖' },
  { id: 'frios', nome: 'Frios e laticínios', emoji: '🧀' },
  { id: 'mercearia', nome: 'Mercearia', emoji: '🍚' },
  { id: 'bebidas', nome: 'Bebidas', emoji: '🥤' },
  { id: 'congelados', nome: 'Congelados', emoji: '🧊' },
  { id: 'limpeza', nome: 'Limpeza', emoji: '🧽' },
  { id: 'higiene', nome: 'Higiene e beleza', emoji: '🧴' },
  { id: 'pet', nome: 'Pet', emoji: '🐾' },
  { id: 'outros', nome: 'Outros', emoji: '🛒' },
]

const IDS_CATEGORIAS = new Set<string>(CATEGORIAS.map((c) => c.id))

export function categoriaPorId(id: CategoriaId) {
  return CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS[CATEGORIAS.length - 1]
}

export interface ItemDeCompra {
  id: string
  /** Nome como a pessoa escreveu, com a primeira letra maiúscula. */
  nome: string
  /** "2 litros", "3 kg", "12"... Vazio quando a pessoa não disse. */
  quantidade: string
  categoria: CategoriaId
  comprado: boolean
}

export interface ListaDeCompras {
  itens: ItemDeCompra[]
}

export const LISTA_VAZIA: ListaDeCompras = { itens: [] }

// ---------------------------------------------------------------- texto

/** Minúsculas e sem acento: "Pão de Açúcar" → "pao de acucar". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const NUMEROS_POR_EXTENSO: Record<string, string> = {
  um: '1', uma: '1', dois: '2', duas: '2', tres: '3', quatro: '4', cinco: '5', seis: '6',
  sete: '7', oito: '8', nove: '9', dez: '10', meia: '1/2', meio: '1/2',
}

const UNIDADES = [
  'kg', 'kilo', 'kilos', 'quilo', 'quilos', 'g', 'gr', 'grama', 'gramas',
  'l', 'lt', 'litro', 'litros', 'ml',
  'un', 'und', 'unid', 'unidade', 'unidades',
  'pacote', 'pacotes', 'pct', 'caixa', 'caixas', 'cx', 'lata', 'latas',
  'garrafa', 'garrafas', 'saco', 'sacos', 'frasco', 'frascos', 'pote', 'potes',
  'duzia', 'duzias', 'maco', 'macos', 'bandeja', 'bandejas', 'fardo', 'fardos',
]

function primeiraMaiuscula(texto: string) {
  return texto ? texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1) : texto
}

/**
 * Separa a quantidade do nome. "2 litros de leite" → { quantidade: "2 litros", nome: "leite" };
 * "12 ovos" → { quantidade: "12", nome: "ovos" }; "arroz" → { quantidade: "", nome: "arroz" }.
 */
export function separarQuantidade(bruto: string): { quantidade: string; nome: string } {
  const texto = bruto.trim().replace(/\s+/g, ' ')
  const partes = texto.split(' ')
  if (partes.length < 2) return { quantidade: '', nome: texto }

  const primeira = normalizar(partes[0]).replace(',', '.')
  const numero = /^\d+([.]\d+)?$/.test(primeira) ? partes[0] : NUMEROS_POR_EXTENSO[primeira] ? NUMEROS_POR_EXTENSO[primeira] : ''
  if (!numero) return { quantidade: '', nome: texto }

  let resto = partes.slice(1)
  let quantidade = numero.replace('.', ',')
  // "2kg" colado já é tratado abaixo; aqui é "2 kg" ou "2 litros".
  if (resto.length > 1 && UNIDADES.includes(normalizar(resto[0]))) {
    quantidade = `${quantidade} ${resto[0]}`
    resto = resto.slice(1)
  }
  if (resto.length > 1 && normalizar(resto[0]) === 'de') resto = resto.slice(1)
  return { quantidade, nome: resto.join(' ') }
}

/** "2kg de carne" (número colado na unidade) vira "2 kg de carne" antes de separar. */
function descolarUnidade(texto: string): string {
  return texto.replace(/^(\d+(?:[.,]\d+)?)([a-zA-Z]+)\b/, (casa, n: string, u: string) =>
    UNIDADES.includes(normalizar(u)) ? `${n} ${u}` : casa,
  )
}

/**
 * Quebra o que a pessoa escreveu em itens: vírgula, ponto e vírgula, quebra de linha, " e " e " + ".
 * Tira marcadores ("-", "•", "1.") do começo de cada linha.
 */
export function quebrarEmItens(texto: string): string[] {
  // "2,5 kg" é um número, não dois itens: troca a vírgula decimal antes de separar.
  return texto
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(/[\n\r;,]+|\s+\+\s+|\s+e\s+/i)
    .map((p) => p.replace(/^\s*(?:[-–—•*·]+|\d+[.)])\s+/, '').trim())
    .filter((p) => p.length > 0)
}

// ---------------------------------------------------------------- categorias

/**
 * Palavras que identificam cada categoria. Comparação sem acento e por palavra inteira, ignorando
 * o plural simples ("tomates" casa com "tomate"). A primeira categoria que casar vence, então
 * as expressões mais específicas ("leite de coco", "papel higienico") ficam antes das genéricas.
 */
const PALAVRAS: readonly { categoria: CategoriaId; chaves: readonly string[] }[] = [
  { categoria: 'pet', chaves: ['racao', 'petisco', 'areia de gato', 'areia higienica', 'sache', 'coleira', 'tapete higienico'] },
  {
    categoria: 'limpeza',
    chaves: [
      'sabao em po', 'sabao em barra', 'sabao liquido', 'detergente', 'desinfetante', 'agua sanitaria', 'cloro', 'amaciante',
      'alvejante', 'multiuso', 'limpa vidro', 'limpador', 'esponja', 'saco de lixo', 'sacos de lixo', 'lixo', 'vassoura', 'rodo',
      'pano de chao', 'pano de prato', 'papel aluminio', 'filme plastico', 'papel toalha', 'lava loucas', 'inseticida',
      'desengordurante', 'palha de aco', 'luva', 'fosforo', 'vela', 'guardanapo', 'lenco de papel',
    ],
  },
  {
    categoria: 'higiene',
    chaves: [
      'papel higienico', 'shampoo', 'xampu', 'condicionador', 'sabonete', 'pasta de dente', 'creme dental', 'escova de dente',
      'fio dental', 'enxaguante', 'desodorante', 'absorvente', 'fralda', 'lenco umedecido', 'hidratante', 'protetor solar',
      'algodao', 'cotonete', 'aparelho de barbear', 'lamina de barbear', 'acetona', 'esmalte', 'cotonetes', 'creme de pentear',
    ],
  },
  { categoria: 'congelados', chaves: ['congelado', 'pizza congelada', 'sorvete', 'hamburguer', 'nuggets', 'lasanha congelada', 'polpa de fruta', 'acai', 'empanado', 'batata congelada', 'gelo', 'picole'] },
  {
    categoria: 'bebidas',
    chaves: [
      'agua mineral', 'agua com gas', 'agua de coco', 'refrigerante', 'suco', 'cerveja', 'vinho', 'cha gelado', 'energetico',
      'isotonico', 'guarana', 'coca cola', 'coca', 'pepsi', 'fanta', 'sprite', 'whisky', 'vodka', 'cachaca', 'espumante', 'agua',
      'leite de coco', 'refresco',
    ],
  },
  { categoria: 'acougue', chaves: ['carne', 'frango', 'peito de frango', 'coxa', 'sobrecoxa', 'file', 'bife', 'patinho', 'acem', 'alcatra', 'picanha', 'maminha', 'costela', 'linguica', 'salsicha', 'carne moida', 'bacon', 'peixe', 'tilapia', 'salmao', 'sardinha', 'camarao', 'bacalhau', 'porco', 'lombo', 'pernil', 'hamburguer de carne', 'figado', 'coracao', 'asa', 'cupim', 'fraldinha', 'contra file', 'atum fresco'] },
  { categoria: 'padaria', chaves: ['pao', 'pao frances', 'pao de forma', 'bisnaguinha', 'bolo', 'rosca', 'baguete', 'croissant', 'sonho', 'torrada', 'broa', 'pao de queijo', 'bolacha de padaria', 'biscoito de polvilho', 'cuca', 'massa de pastel', 'pao integral'] },
  { categoria: 'frios', chaves: ['leite', 'queijo', 'mussarela', 'muçarela', 'presunto', 'requeijao', 'manteiga', 'margarina', 'iogurte', 'creme de leite', 'leite condensado', 'nata', 'ricota', 'cream cheese', 'peito de peru', 'mortadela', 'salame', 'lombo canadense', 'ovos', 'ovo', 'danone', 'coalhada', 'cottage', 'parmesao', 'gorgonzola', 'queijo ralado'] },
  {
    categoria: 'hortifruti',
    chaves: [
      'alface', 'tomate', 'cebola', 'alho', 'batata', 'cenoura', 'abobora', 'abobrinha', 'berinjela', 'pepino', 'pimentao', 'brocolis',
      'couve', 'repolho', 'rucula', 'espinafre', 'cheiro verde', 'salsinha', 'cebolinha', 'coentro', 'hortela', 'manjericao', 'beterraba',
      'mandioca', 'aipim', 'inhame', 'batata doce', 'chuchu', 'quiabo', 'jilo', 'vagem', 'milho verde', 'gengibre', 'limao', 'laranja',
      'banana', 'maca', 'pera', 'uva', 'mamao', 'melancia', 'melao', 'abacaxi', 'abacate', 'morango', 'manga', 'maracuja', 'kiwi', 'goiaba',
      'tangerina', 'mexerica', 'ameixa', 'pessego', 'cebola roxa', 'ervilha fresca', 'rabanete', 'acelga', 'agriao', 'fruta', 'frutas',
      'verdura', 'verduras', 'legume', 'legumes', 'coco', 'caqui', 'figo', 'limao siciliano', 'alho poro', 'folhas',
    ],
  },
  {
    categoria: 'mercearia',
    chaves: [
      'arroz', 'feijao', 'macarrao', 'espaguete', 'massa', 'farinha', 'fuba', 'acucar', 'sal', 'oleo', 'azeite', 'vinagre', 'cafe',
      'achocolatado', 'biscoito', 'bolacha', 'cereal', 'aveia', 'granola', 'molho de tomate', 'extrato de tomate', 'catchup', 'ketchup',
      'maionese', 'mostarda', 'milho', 'ervilha', 'atum', 'sardinha em lata', 'lentilha', 'grao de bico', 'soja', 'tapioca', 'goma',
      'chocolate', 'bombom', 'gelatina', 'pudim', 'mel', 'geleia', 'amendoim', 'castanha', 'pao de mel', 'temperos', 'tempero',
      'pimenta', 'oregano', 'colorau', 'cominho', 'louro', 'canela', 'fermento', 'cha', 'leite em po', 'adocante', 'sopa', 'macarrao instantaneo',
      'miojo', 'polvilho', 'farofa', 'pipoca', 'salgadinho', 'batata palha', 'azeitona', 'palmito', 'cogumelo', 'proteina de soja',
      'cafe em po', 'cafe soluvel', 'capsula', 'barra de cereal', 'torrada integral', 'wafer', 'recheado',
    ],
  },
]

/** "tomates" → "tomate"; "paes" → "pae" não importa, só precisa casar com a mesma regra dos dois lados. */
function singular(palavra: string): string {
  if (palavra.length > 3 && palavra.endsWith('oes')) return palavra.slice(0, -3) + 'ao'
  if (palavra.length > 3 && palavra.endsWith('aes')) return palavra.slice(0, -3) + 'ao'
  if (palavra.length > 3 && palavra.endsWith('s')) return palavra.slice(0, -1)
  return palavra
}

function tokens(texto: string): string[] {
  return normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean).map(singular)
}

const CHAVES_TOKENIZADAS = PALAVRAS.map((p) => ({
  categoria: p.categoria,
  chaves: p.chaves.map((c) => tokens(c)).filter((t) => t.length > 0),
}))

function contemSequencia(alvo: string[], chave: string[]) {
  for (let i = 0; i + chave.length <= alvo.length; i++) {
    if (chave.every((t, j) => alvo[i + j] === t)) return true
  }
  return false
}

/**
 * Sugere a categoria pelo nome. Frases com mais palavras na chave vencem as de uma palavra só
 * ("leite de coco" é bebida, "leite" é laticínio). Sem pista, cai em "Outros".
 */
export function sugerirCategoria(nome: string): CategoriaId {
  const alvo = tokens(nome)
  let melhor: { categoria: CategoriaId; tamanho: number } | null = null
  for (const { categoria, chaves } of CHAVES_TOKENIZADAS) {
    for (const chave of chaves) {
      if (contemSequencia(alvo, chave) && (!melhor || chave.length > melhor.tamanho)) {
        melhor = { categoria, tamanho: chave.length }
      }
    }
  }
  return melhor?.categoria ?? 'outros'
}

// ---------------------------------------------------------------- itens grudados

/** Palavras que ligam duas partes de um mesmo produto: o que vem depois delas não começa item novo. */
const CONECTORES = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'para', 'pra', 'ao', 'no', 'na'])

/** Palavras que qualificam o item anterior ("arroz integral", "biscoito recheado"): nunca abrem item novo. */
const MODIFICADORES = new Set([
  'integral', 'recheado', 'light', 'zero', 'diet', 'desnatado', 'semidesnatado', 'natural', 'tradicional',
  'congelado', 'ralado', 'moido', 'empanado', 'gelado', 'fresco', 'picado', 'fatiado', 'sache', 'po',
])

/**
 * "queijo mussarela" é um produto só, embora as duas palavras sejam do dicionário. Para cada
 * palavra-cabeça, as que a completam sem abrir item novo.
 */
const COMPLETAM: Record<string, ReadonlySet<string>> = {
  queijo: new Set(['mussarela', 'mucarela', 'parmesao', 'gorgonzola', 'ricota', 'cottage', 'ralado']),
  suco: new Set(['laranja', 'uva', 'maracuja', 'limao', 'abacaxi', 'manga', 'morango', 'goiaba']),
  refrigerante: new Set(['coca', 'guarana', 'pepsi', 'fanta', 'sprite']),
  molho: new Set(['tomate']),
  biscoito: new Set(['chocolate', 'recheado']),
  bolacha: new Set(['chocolate', 'recheado']),
  sorvete: new Set(['chocolate', 'morango', 'coco', 'uva', 'limao']),
  iogurte: new Set(['morango', 'coco', 'uva', 'natural']),
  bolo: new Set(['cenoura', 'chocolate', 'laranja', 'milho']),
  farinha: new Set(['mandioca', 'milho']),
  agua: new Set(['coco']),
  leite: new Set(['coco']),
  fruta: new Set(['morango']),
}

const TODAS_AS_CHAVES: readonly string[][] = CHAVES_TOKENIZADAS.flatMap((c) => c.chaves)

const ehNumero = (palavra: string) =>
  /^\d+(?:[.,]\d+)?$/.test(palavra) || Object.prototype.hasOwnProperty.call(NUMEROS_POR_EXTENSO, palavra)

/**
 * O ditado do teclado costuma entregar "arroz feijão leite ovos" sem nenhuma vírgula. Aqui o
 * pedaço é cortado onde começa um produto do dicionário, sem abrir mão do que não se conhece:
 *  - palavra desconhecida gruda no item anterior ("arroz parboilizado");
 *  - depois de "de", "com", "sem"... a parte continua o mesmo item ("suco de laranja");
 *  - qualificativos ("integral", "ralado") e pares como "queijo mussarela" não abrem item novo;
 *  - se o texto começa por quantidade ("2 leite 3 ovos", "2 kg arroz 1 kg feijão"), cada número
 *    seguido de palavra abre um item novo.
 * Sem separação possível, devolve o pedaço como veio.
 */
export function separarItensGrudados(pedaco: string): string[] {
  const original = pedaco.trim()
  // "2kg" colado em qualquer ponto vira "2 kg".
  const palavras = original
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((p) => {
      const m = /^(\d+(?:[.,]\d+)?)([a-zA-Z]+)$/.exec(p)
      return m && UNIDADES.includes(normalizar(m[2])) ? [m[1], m[2]] : [p]
    })
  if (palavras.length < 2) return original ? [original] : []

  const cruas = palavras.map((p) => normalizar(p))
  const formas = cruas.map((p) => singular(p.replace(/[^a-z0-9]/g, '')))
  const comeca = ehNumero(cruas[0])
  const ehQuantidade = (i: number) => {
    const c = cruas[i]
    return ehNumero(c) || UNIDADES.includes(c) || c === 'de'
  }

  const buscar = (i: number): string[] | null => {
    let melhor: string[] | null = null
    for (const chave of TODAS_AS_CHAVES) {
      if (chave.length > formas.length - i) continue
      if ((!melhor || chave.length > melhor.length) && chave.every((t, j) => formas[i + j] === t)) melhor = chave
    }
    return melhor
  }

  const grupos: string[][] = []
  let atual: number[] = []
  let ultimaChave: string[] | null = null

  let i = 0
  while (i < palavras.length) {
    const chave = buscar(i)
    if (chave) {
      const primeira = chave[0]
      let abre = atual.length > 0 && ultimaChave !== null
      if (abre && CONECTORES.has(formas[i - 1])) abre = false
      if (abre && MODIFICADORES.has(primeira)) abre = false
      if (abre && ultimaChave && COMPLETAM[ultimaChave.join(' ')]?.has(primeira)) abre = false
      if (abre) {
        grupos.push(atual.map((k) => palavras[k]))
        atual = []
      }
      for (let k = 0; k < chave.length; k++) atual.push(i + k)
      ultimaChave = chave
      i += chave.length
      continue
    }
    if (comeca && ehNumero(cruas[i]) && atual.some((k) => !ehQuantidade(k))) {
      // só abre item novo se, depois do número (e da unidade, e do "de"), ainda vier palavra.
      let j = i + 1
      if (j < palavras.length && UNIDADES.includes(cruas[j])) j++
      if (j < palavras.length && cruas[j] === 'de') j++
      if (j < palavras.length) {
        grupos.push(atual.map((k) => palavras[k]))
        atual = []
        ultimaChave = null
      }
    }
    atual.push(i)
    i += 1
  }
  if (atual.length > 0) grupos.push(atual.map((k) => palavras[k]))

  const textos = grupos.map((g) => g.join(' ')).filter((t) => t.length > 0)
  return textos.length > 1 ? textos : [original]
}

/** "leite 2 litros" → { quantidade: "2 litros", nome: "leite" } (quantidade depois do nome). */
function quantidadeNoFinal(nome: string): { quantidade: string; nome: string } | null {
  const m = /^(.*\S)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)$/.exec(nome)
  if (!m || !UNIDADES.includes(normalizar(m[3]))) return null
  return { quantidade: `${m[2].replace('.', ',')} ${m[3]}`, nome: m[1] }
}

// ---------------------------------------------------------------- lista

export function novoIdItem(): string {
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Transforma o texto digitado em itens prontos (sem id repetido, sem verificar a lista atual). */
export function interpretarTexto(texto: string, gerarId: () => string = novoIdItem): ItemDeCompra[] {
  return quebrarEmItens(texto).flatMap(separarItensGrudados).map((pedaco) => {
    const lido = separarQuantidade(descolarUnidade(pedaco))
    const final = lido.quantidade ? null : quantidadeNoFinal(lido.nome)
    const quantidade = final ? final.quantidade : lido.quantidade
    const nome = final ? final.nome : lido.nome
    const limpo = nome.replace(/[.!?]+$/, '').trim() || pedaco.trim()
    return {
      id: gerarId(),
      nome: primeiraMaiuscula(limpo),
      quantidade,
      categoria: sugerirCategoria(limpo),
      comprado: false,
    }
  })
}

/** Chave para achar o mesmo item escrito de formas diferentes ("Leite", "leite ", "LEITE"). */
function chaveDoItem(nome: string) {
  return tokens(nome).join(' ')
}

/**
 * Junta os itens novos à lista. Um item que já está na lista e ainda não foi comprado não se
 * repete (a quantidade nova só é aproveitada se o antigo não tinha). Quem já foi comprado volta
 * como item novo, porque é uma nova compra.
 */
export function adicionarItens(
  lista: ListaDeCompras,
  novos: ItemDeCompra[],
): { lista: ListaDeCompras; adicionados: number; repetidos: string[] } {
  const itens = [...lista.itens]
  const repetidos: string[] = []
  let adicionados = 0
  for (const novo of novos) {
    const chave = chaveDoItem(novo.nome)
    const indice = itens.findIndex((i) => !i.comprado && chaveDoItem(i.nome) === chave)
    if (indice >= 0) {
      repetidos.push(itens[indice].nome)
      if (!itens[indice].quantidade && novo.quantidade) itens[indice] = { ...itens[indice], quantidade: novo.quantidade }
      continue
    }
    itens.push(novo)
    adicionados += 1
  }
  return { lista: { itens }, adicionados, repetidos }
}

export function alternarComprado(lista: ListaDeCompras, id: string): ListaDeCompras {
  return { itens: lista.itens.map((i) => (i.id === id ? { ...i, comprado: !i.comprado } : i)) }
}

export function mudarCategoria(lista: ListaDeCompras, id: string, categoria: CategoriaId): ListaDeCompras {
  return { itens: lista.itens.map((i) => (i.id === id ? { ...i, categoria } : i)) }
}

export interface EdicaoDeItem {
  nome: string
  quantidade: string
  categoria: CategoriaId
}

/**
 * Edita um item (D75). O áudio do teclado costuma juntar vários itens num só ("arroz feijão leite")
 * ou errar a escrita; por isso, se o nome editado tiver separadores (vírgula, " e ", quebra de linha),
 * o primeiro pedaço fica no lugar do item e os outros viram itens novos logo abaixo, cada um com a
 * categoria sugerida. O primeiro pedaço usa a quantidade e a categoria escolhidas na edição; se a
 * quantidade ficou vazia, vale a que estiver escrita no nome ("2 litros de leite"). Nome vazio não muda nada.
 */
export function editarItem(
  lista: ListaDeCompras,
  id: string,
  dados: EdicaoDeItem,
  gerarId: () => string = novoIdItem,
): ListaDeCompras {
  const indice = lista.itens.findIndex((i) => i.id === id)
  if (indice < 0) return lista
  const pedacos = interpretarTexto(dados.nome, gerarId)
  if (pedacos.length === 0) return lista
  const original = lista.itens[indice]
  const quantidadeEditada = dados.quantidade.trim().replace(/\s+/g, ' ')
  const [primeiro, ...extras] = pedacos
  // Ao separar um item grudado, o primeiro pedaço também ganha a categoria sugerida, a menos que
  // a pessoa tenha escolhido outra categoria na edição (a do item grudado quase sempre está errada).
  const categoria = extras.length > 0 && dados.categoria === original.categoria ? primeiro.categoria : dados.categoria
  const editado: ItemDeCompra = {
    ...original,
    nome: primeiro.nome.slice(0, 80),
    quantidade: (quantidadeEditada || primeiro.quantidade).slice(0, 30),
    categoria,
  }
  const itens = [...lista.itens]
  itens.splice(indice, 1, editado, ...extras.map((e) => ({ ...e, nome: e.nome.slice(0, 80) })))
  return { itens }
}

export function removerItem(lista: ListaDeCompras, id: string): ListaDeCompras {
  return { itens: lista.itens.filter((i) => i.id !== id) }
}

export function limparComprados(lista: ListaDeCompras): ListaDeCompras {
  return { itens: lista.itens.filter((i) => !i.comprado) }
}

/** Desmarca tudo, para reaproveitar a lista na próxima ida ao mercado. */
export function desmarcarTodos(lista: ListaDeCompras): ListaDeCompras {
  return { itens: lista.itens.map((i) => ({ ...i, comprado: false })) }
}

export function resumoDaLista(lista: ListaDeCompras): { total: number; comprados: number; faltam: number } {
  const comprados = lista.itens.filter((i) => i.comprado).length
  return { total: lista.itens.length, comprados, faltam: lista.itens.length - comprados }
}

export interface GrupoDaLista {
  categoria: (typeof CATEGORIAS)[number]
  itens: ItemDeCompra[]
}

/**
 * Agrupa por categoria, na ordem dos corredores, só as que têm itens. Dentro de cada uma, o que
 * falta comprar vem primeiro e o que já está no carrinho vai para o fim (a ordem em que foram
 * escritos se mantém dentro de cada metade).
 */
export function agruparPorCategoria(lista: ListaDeCompras): GrupoDaLista[] {
  return CATEGORIAS.map((categoria) => {
    const daCategoria = lista.itens.filter((i) => i.categoria === categoria.id)
    return {
      categoria,
      itens: [...daCategoria.filter((i) => !i.comprado), ...daCategoria.filter((i) => i.comprado)],
    }
  }).filter((g) => g.itens.length > 0)
}

// ---------------------------------------------------------------- compartilhar

/**
 * Texto da lista para mandar por WhatsApp (D76): só o que AINDA FALTA comprar (itens não ticados),
 * por categoria, na ordem dos corredores. Devolve vazio quando nada falta.
 */
export function textoParaCompartilhar(lista: ListaDeCompras): string {
  const faltam = { itens: lista.itens.filter((i) => !i.comprado) }
  const grupos = agruparPorCategoria(faltam)
  if (grupos.length === 0) return ''
  const blocos = grupos.map(({ categoria, itens }) => {
    const linhas = itens.map((i) => (i.quantidade ? `• ${i.nome}, ${i.quantidade}` : `• ${i.nome}`))
    return `${categoria.emoji} ${categoria.nome}\n${linhas.join('\n')}`
  })
  return `🛒 Lista de compras\n\n${blocos.join('\n\n')}`
}

/** Link do WhatsApp com a lista pronta; a pessoa escolhe o contato lá. Vazio quando nada falta. */
export function linkDoWhatsApp(lista: ListaDeCompras): string {
  const texto = textoParaCompartilhar(lista)
  return texto ? `https://wa.me/?text=${encodeURIComponent(texto)}` : ''
}

// ---------------------------------------------------------------- validação

/** Aceita só o que tem a forma certa; o resto do que estiver gravado é descartado sem travar o app. */
export function validarLista(bruto: unknown): ListaDeCompras {
  if (typeof bruto !== 'object' || bruto === null) return LISTA_VAZIA
  const itensBrutos = (bruto as { itens?: unknown }).itens
  if (!Array.isArray(itensBrutos)) return LISTA_VAZIA
  const vistos = new Set<string>()
  const itens: ItemDeCompra[] = []
  for (const candidato of itensBrutos) {
    if (typeof candidato !== 'object' || candidato === null) continue
    const c = candidato as Record<string, unknown>
    if (typeof c.id !== 'string' || !c.id || vistos.has(c.id)) continue
    if (typeof c.nome !== 'string' || !c.nome.trim()) continue
    vistos.add(c.id)
    itens.push({
      id: c.id,
      nome: c.nome.slice(0, 80),
      quantidade: typeof c.quantidade === 'string' ? c.quantidade.slice(0, 30) : '',
      categoria: typeof c.categoria === 'string' && IDS_CATEGORIAS.has(c.categoria) ? (c.categoria as CategoriaId) : 'outros',
      comprado: c.comprado === true,
    })
    if (itens.length >= 300) break
  }
  return { itens }
}

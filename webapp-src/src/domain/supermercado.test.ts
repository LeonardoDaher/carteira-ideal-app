import { describe, expect, it } from 'vitest'
import {
  CATEGORIAS,
  adicionarItens,
  agruparPorCategoria,
  alternarComprado,
  desmarcarTodos,
  interpretarTexto,
  limparComprados,
  mudarCategoria,
  quebrarEmItens,
  removerItem,
  resumoDaLista,
  separarQuantidade,
  sugerirCategoria,
  validarLista,
} from './supermercado'
import type { ListaDeCompras } from './supermercado'

let contador = 0
const id = () => `t${++contador}`
const itens = (texto: string) => interpretarTexto(texto, id)

describe('quebrarEmItens', () => {
  it('separa por vírgula, ponto e vírgula, quebra de linha, "e" e "+"', () => {
    expect(quebrarEmItens('arroz, feijão; café\nleite e pão + ovos')).toEqual(['arroz', 'feijão', 'café', 'leite', 'pão', 'ovos'])
  })

  it('tira marcadores e numeração do começo da linha', () => {
    expect(quebrarEmItens('- arroz\n• feijão\n* café\n1. leite\n2) pão')).toEqual(['arroz', 'feijão', 'café', 'leite', 'pão'])
  })

  it('não quebra a vírgula decimal nem palavras que contêm "e"', () => {
    expect(quebrarEmItens('2,5 kg de carne, queijo e presunto')).toEqual(['2.5 kg de carne', 'queijo', 'presunto'])
    expect(quebrarEmItens('sorvete')).toEqual(['sorvete'])
    expect(quebrarEmItens('Pé de alface')).toEqual(['Pé de alface'])
  })

  it('ignora pedaços vazios e espaços sobrando', () => {
    expect(quebrarEmItens('  arroz ,, ,  feijão  \n\n')).toEqual(['arroz', 'feijão'])
    expect(quebrarEmItens('   ')).toEqual([])
  })
})

describe('separarQuantidade', () => {
  it('lê número + unidade + "de"', () => {
    expect(separarQuantidade('2 litros de leite')).toEqual({ quantidade: '2 litros', nome: 'leite' })
    expect(separarQuantidade('3 kg de frango')).toEqual({ quantidade: '3 kg', nome: 'frango' })
    expect(separarQuantidade('1 pacote macarrão')).toEqual({ quantidade: '1 pacote', nome: 'macarrão' })
  })

  it('lê número sem unidade e números por extenso', () => {
    expect(separarQuantidade('12 ovos')).toEqual({ quantidade: '12', nome: 'ovos' })
    expect(separarQuantidade('duas caixas de leite')).toEqual({ quantidade: '2 caixas', nome: 'leite' })
    expect(separarQuantidade('meia dúzia de ovos')).toEqual({ quantidade: '1/2 dúzia', nome: 'ovos' })
    expect(separarQuantidade('um pão')).toEqual({ quantidade: '1', nome: 'pão' })
  })

  it('sem quantidade, devolve só o nome', () => {
    expect(separarQuantidade('arroz integral')).toEqual({ quantidade: '', nome: 'arroz integral' })
    expect(separarQuantidade('arroz')).toEqual({ quantidade: '', nome: 'arroz' })
  })

  it('mostra a vírgula decimal em português', () => {
    expect(separarQuantidade('2.5 kg de carne')).toEqual({ quantidade: '2,5 kg', nome: 'carne' })
  })
})

describe('sugerirCategoria', () => {
  const casos: [string, string][] = [
    ['tomate', 'hortifruti'],
    ['Tomates', 'hortifruti'],
    ['banana prata', 'hortifruti'],
    ['frango', 'acougue'],
    ['peito de frango', 'acougue'],
    ['carne moída', 'acougue'],
    ['pão francês', 'padaria'],
    ['pão de queijo', 'padaria'],
    ['leite', 'frios'],
    ['queijo mussarela', 'frios'],
    ['ovos', 'frios'],
    ['iogurte natural', 'frios'],
    ['arroz', 'mercearia'],
    ['feijão carioca', 'mercearia'],
    ['macarrão', 'mercearia'],
    ['molho de tomate', 'mercearia'],
    ['café', 'mercearia'],
    ['leite em pó', 'mercearia'],
    ['refrigerante', 'bebidas'],
    ['água mineral', 'bebidas'],
    ['leite de coco', 'bebidas'],
    ['cerveja', 'bebidas'],
    ['sorvete', 'congelados'],
    ['sabão em pó', 'limpeza'],
    ['detergente', 'limpeza'],
    ['água sanitária', 'limpeza'],
    ['papel higiênico', 'higiene'],
    ['shampoo', 'higiene'],
    ['pasta de dente', 'higiene'],
    ['ração para cachorro', 'pet'],
  ]
  for (const [nome, esperada] of casos) {
    it(`"${nome}" → ${esperada}`, () => {
      expect(sugerirCategoria(nome)).toBe(esperada)
    })
  }

  it('sem pista, cai em Outros', () => {
    expect(sugerirCategoria('pilha AA')).toBe('outros')
    expect(sugerirCategoria('')).toBe('outros')
  })

  it('a expressão mais longa vence a palavra solta', () => {
    expect(sugerirCategoria('leite de coco')).not.toBe(sugerirCategoria('leite'))
    expect(sugerirCategoria('pão de queijo')).not.toBe(sugerirCategoria('queijo'))
  })
})

describe('interpretarTexto', () => {
  it('monta os itens com nome em maiúscula, quantidade, categoria e não comprado', () => {
    const lista = itens('arroz, 2 litros de leite, 3kg de frango e sabão em pó')
    expect(lista.map((i) => [i.nome, i.quantidade, i.categoria, i.comprado])).toEqual([
      ['Arroz', '', 'mercearia', false],
      ['Leite', '2 litros', 'frios', false],
      ['Frango', '3 kg', 'acougue', false],
      ['Sabão em pó', '', 'limpeza', false],
    ])
    expect(new Set(lista.map((i) => i.id)).size).toBe(4)
  })

  it('texto vazio não gera item', () => {
    expect(itens('')).toEqual([])
    expect(itens(' , ; ')).toEqual([])
  })
})

describe('lista', () => {
  const base = (): ListaDeCompras => adicionarItens({ itens: [] }, itens('arroz, leite, tomate, sabão em pó')).lista

  it('não repete item que ainda não foi comprado, mesmo escrito diferente', () => {
    const r = adicionarItens(base(), itens('LEITE, tomates, pão'))
    expect(r.adicionados).toBe(1)
    expect(r.repetidos).toEqual(['Leite', 'Tomate'])
    expect(r.lista.itens).toHaveLength(5)
  })

  it('aproveita a quantidade nova quando o item repetido não tinha', () => {
    const r = adicionarItens(base(), itens('2 litros de leite'))
    expect(r.lista.itens.find((i) => i.nome === 'Leite')?.quantidade).toBe('2 litros')
  })

  it('item já comprado volta como item novo (é outra compra)', () => {
    const l = base()
    const leite = l.itens.find((i) => i.nome === 'Leite')!
    const comprado = alternarComprado(l, leite.id)
    const r = adicionarItens(comprado, itens('leite'))
    expect(r.adicionados).toBe(1)
    expect(r.lista.itens.filter((i) => i.nome === 'Leite')).toHaveLength(2)
  })

  it('alternar tica e destica sem mexer nos outros', () => {
    const l = base()
    const alvo = l.itens[1]
    const a = alternarComprado(l, alvo.id)
    expect(a.itens.filter((i) => i.comprado).map((i) => i.id)).toEqual([alvo.id])
    expect(alternarComprado(a, alvo.id).itens.every((i) => !i.comprado)).toBe(true)
  })

  it('muda a categoria de um item só', () => {
    const l = base()
    const alvo = l.itens[0]
    const m = mudarCategoria(l, alvo.id, 'bebidas')
    expect(m.itens[0].categoria).toBe('bebidas')
    expect(m.itens.slice(1)).toEqual(l.itens.slice(1))
  })

  it('remove um item, limpa os comprados e desmarca tudo', () => {
    const l = base()
    expect(removerItem(l, l.itens[0].id).itens).toHaveLength(3)
    const duas = alternarComprado(alternarComprado(l, l.itens[0].id), l.itens[1].id)
    expect(limparComprados(duas).itens).toHaveLength(2)
    expect(limparComprados(duas).itens.every((i) => !i.comprado)).toBe(true)
    expect(desmarcarTodos(duas).itens).toHaveLength(4)
    expect(desmarcarTodos(duas).itens.every((i) => !i.comprado)).toBe(true)
  })

  it('resumo conta total, comprados e o que falta', () => {
    const l = alternarComprado(base(), base().itens[0].id)
    // base() gera ids novos a cada chamada; usa a própria lista para ticar
    const b = base()
    const t = alternarComprado(b, b.itens[0].id)
    expect(resumoDaLista(t)).toEqual({ total: 4, comprados: 1, faltam: 3 })
    expect(resumoDaLista(l).total).toBe(4)
    expect(resumoDaLista({ itens: [] })).toEqual({ total: 0, comprados: 0, faltam: 0 })
  })
})

describe('agruparPorCategoria', () => {
  it('só mostra categorias com itens, na ordem dos corredores', () => {
    const l = adicionarItens({ itens: [] }, itens('sabão em pó, arroz, tomate, frango')).lista
    expect(agruparPorCategoria(l).map((g) => g.categoria.id)).toEqual(['hortifruti', 'acougue', 'mercearia', 'limpeza'])
    expect(agruparPorCategoria({ itens: [] })).toEqual([])
  })

  it('dentro da categoria, o que falta vem antes do que já foi comprado', () => {
    const l = adicionarItens({ itens: [] }, itens('arroz, feijão, café, macarrão')).lista
    const feijao = l.itens.find((i) => i.nome === 'Feijão')!
    const arroz = l.itens.find((i) => i.nome === 'Arroz')!
    const t = alternarComprado(alternarComprado(l, arroz.id), feijao.id)
    expect(agruparPorCategoria(t)[0].itens.map((i) => i.nome)).toEqual(['Café', 'Macarrão', 'Arroz', 'Feijão'])
  })

  it('cada item aparece uma única vez', () => {
    const l = adicionarItens({ itens: [] }, itens('arroz, tomate, frango, pão, leite, sabão em pó, shampoo, cerveja, sorvete, ração, pilha')).lista
    const total = agruparPorCategoria(l).reduce((s, g) => s + g.itens.length, 0)
    expect(total).toBe(l.itens.length)
    expect(CATEGORIAS.map((c) => c.id)).toHaveLength(new Set(CATEGORIAS.map((c) => c.id)).size)
  })
})

describe('validarLista', () => {
  it('aceita uma lista boa', () => {
    const l = adicionarItens({ itens: [] }, itens('arroz, leite')).lista
    expect(validarLista(JSON.parse(JSON.stringify(l)))).toEqual(l)
  })

  it('descarta lixo sem travar', () => {
    expect(validarLista(null)).toEqual({ itens: [] })
    expect(validarLista('texto')).toEqual({ itens: [] })
    expect(validarLista({})).toEqual({ itens: [] })
    expect(validarLista({ itens: 'x' })).toEqual({ itens: [] })
  })

  it('descarta item sem id ou sem nome, repete id e corrige categoria inválida', () => {
    const r = validarLista({
      itens: [
        { id: 'a', nome: 'Arroz', quantidade: '1', categoria: 'mercearia', comprado: true },
        { id: 'a', nome: 'Repetido', categoria: 'mercearia' },
        { nome: 'Sem id' },
        { id: 'b', nome: '   ' },
        { id: 'c', nome: 'Pilha', categoria: 'inexistente', comprado: 'sim', quantidade: 5 },
        7,
        null,
      ],
    })
    expect(r.itens).toEqual([
      { id: 'a', nome: 'Arroz', quantidade: '1', categoria: 'mercearia', comprado: true },
      { id: 'c', nome: 'Pilha', quantidade: '', categoria: 'outros', comprado: false },
    ])
  })

  it('limita o tamanho da lista e dos textos', () => {
    const muitos = Array.from({ length: 400 }, (_, i) => ({ id: `i${i}`, nome: 'x'.repeat(200), quantidade: 'y'.repeat(100) }))
    const r = validarLista({ itens: muitos })
    expect(r.itens).toHaveLength(300)
    expect(r.itens[0].nome).toHaveLength(80)
    expect(r.itens[0].quantidade).toHaveLength(30)
  })
})

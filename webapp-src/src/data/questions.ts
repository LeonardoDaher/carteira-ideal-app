import type { Pergunta } from '../domain/types'

/**
 * As 7 perguntas do questionário de suitability. Cada opção tem peso 1 (a) a 4 (d),
 * somado pelo motor (ver domain/engine.ts) para chegar ao perfil base. Além do score,
 * cada pergunta carrega um significado próprio usado nas travas de segurança
 * (prazo, reserva de emergência, patrimônio, experiência e liquidez).
 */
export const PERGUNTAS: Pergunta[] = [
  {
    id: 'objetivo',
    titulo: 'Qual é o principal motivo para você investir agora?',
    ajuda: 'Não existe resposta certa — isso só ajuda a entender o seu momento.',
    opcoes: [
      { letra: 'a', texto: 'Ter uma reserva de segurança para emergências' },
      { letra: 'b', texto: 'Juntar para comprar um bem em breve (carro, viagem, casa)' },
      { letra: 'c', texto: 'Fazer meu patrimônio crescer ao longo dos anos' },
      { letra: 'd', texto: 'Construir uma aposentadoria tranquila no longo prazo' },
    ],
  },
  {
    id: 'prazo',
    titulo: 'Em quanto tempo você pretende usar esse dinheiro?',
    ajuda: 'Pense no prazo em que você realmente não vai precisar tocar nesse valor.',
    opcoes: [
      { letra: 'a', texto: 'Até 1 ano' },
      { letra: 'b', texto: 'De 1 a 3 anos' },
      { letra: 'c', texto: 'De 3 a 5 anos' },
      { letra: 'd', texto: 'Mais de 5 anos' },
    ],
  },
  {
    id: 'tolerancia',
    titulo: 'Se seus investimentos caíssem 15% em um mês, o que você faria?',
    ajuda: 'Seja honesto — imagine a situação acontecendo de verdade.',
    opcoes: [
      { letra: 'a', texto: 'Venderia tudo imediatamente para não perder mais' },
      { letra: 'b', texto: 'Ficaria desconfortável, mas esperaria se recuperar' },
      { letra: 'c', texto: 'Manteria a posição, entendo que é volatilidade normal' },
      { letra: 'd', texto: 'Aproveitaria a queda para comprar mais' },
    ],
  },
  {
    id: 'reserva',
    titulo: 'Você já tem uma reserva de emergência separada?',
    ajuda: 'O ideal é ter de 3 a 6 meses das suas despesas guardado em algo líquido.',
    opcoes: [
      { letra: 'a', texto: 'Não tenho nenhuma reserva ainda' },
      { letra: 'b', texto: 'Tenho uma reserva pequena, cobre menos de 3 meses' },
      { letra: 'c', texto: 'Tenho quase o ideal, entre 3 e 6 meses' },
      { letra: 'd', texto: 'Sim, tenho reserva completa e sobra dinheiro além dela' },
    ],
  },
  {
    id: 'patrimonio',
    titulo: 'Quanto você tem disponível para investir agora?',
    ajuda: 'Considere apenas o valor livre, fora a sua reserva de emergência.',
    opcoes: [
      { letra: 'a', texto: 'Até R$ 5 mil' },
      { letra: 'b', texto: 'De R$ 5 mil a R$ 50 mil' },
      { letra: 'c', texto: 'De R$ 50 mil a R$ 500 mil' },
      { letra: 'd', texto: 'Acima de R$ 500 mil' },
    ],
  },
  {
    id: 'experiencia',
    titulo: 'Qual sua experiência com investimentos?',
    ajuda: 'Isso ajuda a dosar o quanto de risco faz sentido para você agora.',
    opcoes: [
      { letra: 'a', texto: 'Nenhuma, nunca investi fora da poupança' },
      { letra: 'b', texto: 'Já usei Tesouro Direto, CDB ou fundos simples' },
      { letra: 'c', texto: 'Já investi em ações ou fundos imobiliários algumas vezes' },
      { letra: 'd', texto: 'Sou experiente, opero ações e fundos com frequência' },
    ],
  },
  {
    id: 'reacao',
    titulo: 'Notícias de crise ou queda na bolsa afetam suas decisões?',
    ajuda: 'Pense em como você reagiu (ou reagiria) numa crise econômica.',
    opcoes: [
      { letra: 'a', texto: 'Sim, fico ansioso e talvez precise sacar o dinheiro de repente' },
      { letra: 'b', texto: 'Fico incomodado, mas não costumo agir por impulso' },
      { letra: 'c', texto: 'Entendo que faz parte, esse dinheiro não será tocado tão cedo' },
      { letra: 'd', texto: 'Sigo o plano com tranquilidade, é dinheiro de longo prazo' },
    ],
  },
]

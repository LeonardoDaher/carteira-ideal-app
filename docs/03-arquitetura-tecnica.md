# 3. Arquitetura técnica

## Visão em uma imagem

```
Navegador do usuário                              Vercel
┌────────────────────────────────┐        ┌───────────────────────────────────┐
│ /            landing (HTML/CSS/JS) │        │ Site estático (dist-site/)          │
│ /app/        app React (1 arquivo) │◄───────│   landing + app compilado            │
│                                    │        │                                     │
│  telas + textos das perguntas      │  POST  │ Função serverless                    │
│  fetch('/api/recomendacao') ───────┼───────►│   api/recomendacao.ts                │
│                                    │  JSON  │     └─ engine.ts (matrizes, veto,    │
│  mostra só o resultado  ◄──────────┼────────│         calibradores, travas)        │
└────────────────────────────────┘        └───────────────────────────────────┘
```

O navegador conhece as **perguntas** (precisa exibi-las) e recebe o **resultado**. Ele nunca recebe as **regras** que transformam uma coisa na outra.

## Estrutura de pastas

```
/
├── index.html, style.css, script.js   Landing "link na bio"
├── assets/                            Logo, fundos, fontes, og-image, PDF do livro
├── api/
│   ├── recomendacao.ts                POST /api/recomendacao (serverless)
│   └── _validacao.ts                  Valida o JSON recebido (o "_" impede a Vercel de expor como rota)
├── webapp-src/                        Código-fonte do app
│   ├── index.html, vite.config.ts     Entrada do Vite (gera 1 arquivo HTML via vite-plugin-singlefile)
│   └── src/
│       ├── App.tsx                    Roteia entre as 12 telas
│       ├── screens/                   Uma tela por arquivo (ver jornada do cliente)
│       ├── ui/                        Componentes visuais (barra de abas, gráfico, aviso educacional)
│       ├── state/useAppState.ts       Estado global, navegação, persistência e chamada da API
│       ├── data/
│       │   ├── questions.ts           7 perguntas de suitability
│       │   ├── perguntasArquitetura.ts 7 perguntas de Arquitetura Patrimonial
│       │   ├── assets.ts              As 11 classes de ativos
│       │   ├── trilhas.ts             Trilhas, tópicos, aulas (vídeo do YouTube e/ou texto)
│       │   ├── linksOficiais.ts       Links oficiais do roteiro de negociação e da trilha "Sair das dívidas"
│       │   ├── analises/, recomendacoes.ts, carteiraVisual.ts  Textos e agrupamentos de exibição
│       │   ├── storage.ts             Leitura/gravação no localStorage (questionário e Meu Mês)
│       │   └── apiRecomendacao.ts     Cliente HTTP da API
│       └── domain/
│           ├── engine.ts              O MOTOR (só é empacotado pela API, nunca pelo app)
│           ├── orcamento.ts           Meu Mês (D21): contas, cofrinhos, cartão e potes; roda no navegador, dados só no aparelho
│           ├── recuperacao.ts         Meu Mês, Etapa 3: dívidas, dívida cara e plano de quitação (avalanche x bola de neve)
│           ├── ponteQuestionario.ts   Meu Mês, Etapa 4: sugestão dos Pilares 1 e 2 a partir do orçamento
│           └── types.ts               Tipos compartilhados entre app e API
├── scripts/build-site.mjs             Monta dist-site/ = landing + app compilado em /app
├── vercel.json                        buildCommand e outputDirectory
├── package.json, package-lock.json    Dependências únicas do projeto todo
└── docs/                              Documentação
```

## Contrato da API

`POST /api/recomendacao`, corpo JSON:

```json
{
  "respostas": { "objetivo": "c", "prazo": "c", "tolerancia": "b", "reserva": "c",
                 "patrimonio": "b", "experiencia": "b", "reacao": "b" },
  "dados": { "idade": 30 },
  "respostasArquitetura": { "capacidadeFinanceira": "b", "passivoDividas": "b",
                            "janelaLiquidez": "c", "comportamentoEstresse": "b",
                            "dependenciaRenda": "c", "capitalHumano": "b",
                            "eficienciaFiscal": "a" }
}
```

- `respostas`: letras `a` a `d`, obrigatórias.
- `respostasArquitetura`: letras `a` a `c`, opcional (sem ela, o motor usa a matriz de fallback).
- Respostas: `200` com o resultado (`perfilFinalCarteira`, `carteira` em %, `alertas`, `vetoAplicado`, `capacidadeReal`...), `400` para dados inválidos, `405` para método diferente de POST, `500` para erro interno.

## Aba "Simule FII" (dados mensais)

```
GitHub Actions (dia 20 de cada mês)
  scripts/atualizar-rendimentos-fii.mjs
    ├─ config/fiis-ifix.json ............ os 10 destaques do IFIX (conferidos na B3)
    │                                     + parâmetros da lista ampla ("outrosFundos")
    ├─ CVM Dados Abertos (zip do ano) ... todos os FIIs do informe; rendimento estimado
    │                                     por cota: analisa 6 meses, publica 1 (o mais
    │                                     recente típico pela mediana)
    └─ brapi (plano gratuito) ........... cotação, 1 fundo por requisição, com pausa e
                                          teto por execução
  → grava webapp-src/src/data/rendimentosFii.json (destaques, fundos, indisponiveis)
  → commit → Vercel republica
App: screens/SimuleFii.tsx lê o JSON estático (busca e cálculos em domain/rendaFii.ts)
```

O navegador do cliente nunca chama a CVM nem a brapi, e a chave da brapi fica só nos GitHub Secrets. Detalhes e salvaguardas: decisões D9, D10, D12 e D13 no [Registro de decisões](07-registro-de-decisoes.md).

## Decisões técnicas relevantes

- **Por que o motor ficou em `webapp-src/src/domain/` e não dentro de `api/`?** Para os testes automatizados do motor (`engine.test.ts`, 26 testes) continuarem funcionando sem alteração. O app não importa mais esse arquivo; só a API importa. O build do app foi verificado: nenhum trecho do motor aparece em `dist-site/app/index.html`.
- **Cálculo assíncrono.** `useAppState.ts` dispara a chamada quando as respostas ficam completas e descarta respostas antigas se o usuário mudar algo no meio (proteção contra *race condition*). A tela "Processando" espera a resposta real (mínimo de 1,9 s de animação) e mostra "Tentar novamente" se a rede falhar.
- **Meu Mês (D21).** Estado próprio em `state/useOrcamento.ts`, chave `carteiraideal.orcamento` (versão 1), separada do questionário. Salário, contas e dívidas nunca vão para a API. Tela em `screens/MeuMes.tsx`; os blocos do Modo Recuperação (Etapa 3) ficam em `screens/MeuMesRecuperacao.tsx`, e o campo de valor em reais, usado pelos dois, em `ui/CampoReais.tsx`. `recuperacao.ts` não importa nada de `orcamento.ts` (só o contrário), para não haver ciclo de imports.
- **Ponte Meu Mês ↔ questionário (D21, Etapa 4).** `domain/ponteQuestionario.ts` transforma o orçamento em sugestões dos Pilares 1 e 2 (letra + motivo), usando `sugestaoPilar1` e `sugestaoPilar2`. `state/useSugestoesMeuMes.ts` lê a chave `carteiraideal.orcamento` uma vez, só leitura, pela mesma função `orcamentoSalvo` do `useOrcamento.ts`, e a tela `QuestionarioArquitetura.tsx` mostra a sugestão sem marcar nada. O orçamento continua fora da API: só vai a letra que a pessoa escolher. No resultado, `ui/PonteMeuMes.tsx` aparece só com [A] no Pilar 2 ou no Pilar 1.
- **Conta paga no cartão.** `Conta.cartaoDesde` (só mensais): `contaNoCartao` e `contasNoCartao` em `orcamento.ts`. `gastoNoCartao` = `comprasNoCartao` + contas no cartão; `parcelasFuturas` usa as compras e as parcelas já assumidas das contas anuais. Conta anual no cartão: `Conta.cartaoAnual`, `parcelaAnualNoMes`, `anuaisNoCartao`, `coberturaDoCofrinho` (parte da fatura paga pelo cofrinho), `coberturaDaConta` (parte de uma conta), `gastoNoTeto` (tudo o que sai do salário na fatura: das anuais, só a parte que o cofrinho não cobre), `parcelamentoPodeTerComecado`, `inicioDaAnualNoCartao`, `quandoApareceNoCartao` e `jurosDoParcelamento`. Conta x dívida (evitar contar a parcela duas vezes): `pareceDivida`, `temDividaComParcelaFixa` e `contasEmDobroComDividas`, só para avisos na tela. Compras à vista do mês de uma vez: `acertarPeloTotal`, `aVistaLancadasNoMes`, `totalInformado`, `idTotalDoMes` e `ehTotalDoMes` (o que passa das compras à vista já anotadas vira uma compra à vista de id `total-AAAA-MM`; parcelados ficam fora). Parcelamento que já estava em andamento ao chegar no app: `compraEmAndamento` ("parcela k de n na fatura deste mês" vira uma compra de k meses atrás). Conta de todo mês no cartão parecida com compra parcelada: `compraParecidaComConta` e `contasEmDobroComCompras`, só para avisos. Compra parcelada com juros: `parcelamentoComJuros` (total, custo, taxa ao mês, trava de total abaixo do preço); `Compra.valorAVista` opcional guarda o preço quando há juros. Reserva acima da mini-reserva com dívida cara: `excedenteDaReserva` (sugestão em avalanche e juros evitados) e `usarExcedenteDaReserva` (baixa reserva e saldos).
- **Aulas em texto.** `AulaTrilha` ganhou `texto`, `links` e `acao` (opcionais). Aula com texto conta como disponível (`aulaDisponivel`) mesmo sem `youtubeId`; com os dois, o vídeo vem primeiro e o texto abaixo.
- **Estado no aparelho.** Respostas e progresso ficam no `localStorage` do navegador (chave `carteiraideal.estado`, versão 2). A landing lê essa chave para trocar o botão para "Ver minha carteira de referência". A API **não grava nada**.
- **App em arquivo único.** Mantido o `vite-plugin-singlefile` para preservar a estrutura já usada pela landing (`./app/`).

## Qualidade

| Comando | O que verifica | Situação |
|---|---|---|
| `npm run typecheck` | Tipos do app e da API juntos | ✅ sem erros |
| `npm run test` | 97 testes do app (motor, estado, questionário, visual, tratamento de erro, Simule FII com lista por setor e busca, Aprender com curso e livro) + 42 do script mensal da CVM | ✅ 97/97 e 42/42 |
| `npm run build` | Build de produção completo | ✅ |
| Jornada ponta a ponta | Navegador real, servidor local com a API verdadeira, todas as telas | ✅ sem erros de JavaScript |

Lacuna conhecida: a API em si (`api/`) foi testada manualmente (casos 200, 400, 405 e veto), mas ainda não tem testes automatizados. Ver [Próximos passos](06-proximos-passos.md).

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
│       │   ├── trilhas.ts             Trilhas, tópicos, aulas e IDs de vídeo do YouTube
│       │   ├── analises/, recomendacoes.ts, carteiraVisual.ts  Textos e agrupamentos de exibição
│       │   ├── storage.ts             Leitura/gravação no localStorage
│       │   └── apiRecomendacao.ts     Cliente HTTP da API
│       └── domain/
│           ├── engine.ts              O MOTOR (só é empacotado pela API, nunca pelo app)
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

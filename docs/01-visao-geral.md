# 1. Visão geral

## O que é

O **Carteira Ideal** é uma ferramenta educacional, gratuita e mobile-first, divulgada pelo perfil **@acarteiraideal** no Instagram. Em cerca de 3 minutos, a pessoa responde 14 perguntas e recebe:

- um dos **9 Perfis-Mãe de Carteira** (por exemplo, "5. Moderado Renda (Equilíbrio)");
- uma **carteira de referência** em percentuais, distribuída entre **11 classes de ativos**;
- um **simulador** que converte esses percentuais em reais;
- **trilhas de aprendizagem** em vídeo sobre cada classe de ativo e sobre diversificação.

## O diferencial

Suitability de corretora mede a *intenção* do investidor (quanto risco ele diz tolerar). O Carteira Ideal cruza essa intenção com a **Arquitetura Patrimonial**, que mede a *realidade* da vida financeira dele: reserva, dívidas, gastos planejados, comportamento em crises, dependência de renda, estabilidade profissional e situação fiscal/sucessória. Três dessas perguntas têm **poder de veto**: uma resposta crítica leva o perfil patrimonial para Defensivo, independentemente do que o suitability disse.

Resumo: **Suitability (intenção) + Arquitetura Patrimonial (realidade) = carteira de referência realizável.**

## Os componentes

| Componente | Onde fica | Função |
|---|---|---|
| Landing "link na bio" | `index.html`, `style.css`, `script.js`, `assets/` | Porta de entrada vinda do Instagram: botão para o app, curso de Candlesticks, livro infantil bônus, contato |
| App | `webapp-src/` (publicado em `/app`) | Questionário, resultado, carteira, simulador e trilhas |
| Motor de decisão | `webapp-src/src/domain/engine.ts`, executado por `api/recomendacao.ts` | Calcula perfil e carteira no servidor, sem expor a metodologia |
| Documentação | `docs/` | Esta pasta |

## Posicionamento e cuidados regulatórios

Todo o conteúdo é apresentado como **exemplo educacional, não recomendação de investimento**, com avisos explícitos na landing, no onboarding e nas telas de resultado, carteira e simulador. Ver os cuidados regulatórios em [Próximos passos](06-proximos-passos.md#3-regulatório-e-privacidade).

## Estágio atual (setembro/2026)

- App completo e funcional: 14 perguntas, 9 Perfis-Mãe, 11 classes, simulador, 2 trilhas com 15 aulas em vídeo.
- Motor migrado para o servidor (API protegida), com 52 testes automatizados passando.
- **Ainda não publicado** no endereço definitivo. A versão antiga no GitHub Pages foi desativada ao tornar o repositório antigo privado. Nenhum link foi divulgado no Instagram ainda.

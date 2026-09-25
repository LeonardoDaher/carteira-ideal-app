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
| Landing "link na bio" | `index.html`, `style.css`, `script.js`, `assets/` | Porta de entrada vinda do Instagram: botão para o app, atalhos diretos para Simule FII e Aprender, contato |
| App | `webapp-src/` (publicado em `/app`) | Questionário, resultado, carteira, simulador, Simule FII e trilhas |
| Dados mensais de FIIs | `scripts/atualizar-rendimentos-fii.mjs`, `.github/workflows/`, `config/fiis-ifix.json` | Todo dia 20, busca rendimentos na CVM e cotações na brapi de todos os FIIs listados e publica um arquivo estático para a aba Simule FII |
| Motor de decisão | `webapp-src/src/domain/engine.ts`, executado por `api/recomendacao.ts` | Calcula perfil e carteira no servidor, sem expor a metodologia |
| Documentação | `docs/` | Esta pasta |

## Posicionamento e cuidados regulatórios

Todo o conteúdo é apresentado como **exemplo educacional, não recomendação de investimento**, com avisos explícitos na landing, no onboarding e nas telas de resultado, carteira e simulador. Ver os cuidados regulatórios em [Próximos passos](06-proximos-passos.md#3-regulatório-e-privacidade).

## Estágio atual (setembro/2026)

- App completo e funcional: 14 perguntas, 9 Perfis-Mãe, 11 classes, simulador, aba **Simule FII** (renda estimada a partir do último rendimento; lista por setor dos FIIs com liquidez acima de R$ 1 milhão por dia e busca para os demais) e 2 trilhas com 15 aulas em vídeo.
- Motor migrado para o servidor (API protegida). 97 testes automatizados do app e 42 do script mensal de FIIs passando.
- Dados da aba Simule FII atualizados automaticamente todo mês, sem custo (CVM + brapi gratuito), no ar desde 24/09/2026 com os 10 fundos.
- **No ar em produção**, em `https://carteiraideal.app.br/`, repositório privado `carteira-ideal-app` no GitHub conectado à Vercel com deploy automático.
- **Link já na bio do Instagram**, testado tocando dentro do próprio app do Instagram, jornada completa até o resultado.
- Prévia de compartilhamento (WhatsApp/LinkedIn) testada e correta.
- Pendente: decisão sobre domínio próprio (ver [Próximos passos](06-proximos-passos.md#1-lançamento-fazer-agora)).

# 08 — Métricas de uso (como contar quem usa o app)

Objetivo: provar uso real para parceiros (bancos/corretoras) e fundações de pesquisa,
sem coletar dado pessoal e mantendo custo zero enquanto o projeto não for comercial.

## O que é medido
| Evento | Quando dispara |
|---|---|
| `visita` | 1x por sessão, ao abrir o app |
| `questionario_iniciado` | ao confirmar a idade |
| `suitability_concluido` | ao terminar as 7 perguntas de suitability |
| `arquitetura_concluida` | ao terminar as 7 de Arquitetura Patrimonial |
| `recomendacao_gerada` | ao chegar no resultado (com perfil-mãe, prazo, capacidade real e veto) |
| `recomendacao_erro` | falha ao calcular |
| `tela_vista` | 1x por sessão em Aprender, Simule*, Meu Mês, Carteira, Simulador |
| `app_instalado` | quando o navegador avisa que o app foi adicionado à tela inicial |
| `alerta_ativado` | quando a pessoa liga os avisos de preço-teto |

**Retenção (D136).** Na `visita`, o app envia também a *coorte*: o dia (AAAA-MM-DD, Brasília) da primeira visita daquele navegador, guardado no próprio aparelho. O painel mostra quantas pessoas de cada coorte voltaram em até 7 e em até 30 dias (só coortes cujo prazo já fechou entram no percentual) e quantas pessoas distintas abriram cada tela. Navegadores que já usavam o app antes dessa versão entram como coorte do dia em que abrirem a versão nova; quem limpa os dados do navegador volta como pessoa nova.

Origem/parceiro: abra o app com `?ref=nome-do-parceiro` (ex.: `carteiraideal.app.br/app/?ref=bancoxyz`).
Todos os eventos daquela pessoa passam a carregar a origem.

## Privacidade (LGPD)
- Não grava IP, nome, e-mail, CPF, idade, valores nem respostas individuais.
- O visitante é um código aleatório do navegador; a contagem de pessoas distintas usa
  HyperLogLog (não guarda quem é).
- Respeita "Não rastrear" e Global Privacy Control do navegador.
- Antes de divulgar, publicar uma política de privacidade citando a coleta anônima (revisão jurídica recomendada).

## Configuração (uma vez, gratuita)
1. Vercel → projeto → **Storage/Marketplace** → criar um banco **Upstash Redis** (plano Free) e conectar ao projeto.
   Ele cria sozinho `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_*`).
2. Vercel → Settings → Environment Variables → criar `METRICAS_TOKEN` com uma senha longa e aleatória.
3. Vercel → **Analytics** → ativar o Web Analytics (o script já está no `index.html`).
4. Fazer o deploy. Sem o passo 1, as métricas próprias ficam desligadas e o app funciona normalmente.

## Ler os números
```
curl -H "Authorization: Bearer $METRICAS_TOKEN" "https://carteiraideal.app.br/api/metricas?dias=30"
```
Devolve: visitantes únicos no período, recomendações geradas, funil (pessoas por etapa),
taxa de conclusão, usuários ativos por mês (MAU), distribuição dos 9 Perfis-Mãe / prazo /
capacidade real / veto, retenção em 7 e 30 dias (`retencao`), pessoas distintas por tela (`pessoasPorTela`) e o detalhe por dia.

## Limites
- Vercel Hobby é para uso não comercial; ao fechar parceria paga, migrar para Pro.
- Bloqueadores de anúncio podem esconder uma pequena parte dos acessos: os números são um piso confiável.

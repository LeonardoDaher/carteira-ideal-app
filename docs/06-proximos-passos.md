# 6. Próximos passos

Organizados por prioridade. Os itens do bloco 1 são necessários para lançar; os demais podem vir depois do lançamento.

## 1. Lançamento (fazer agora)

- [x] Criar o repositório privado `carteira-ideal-app` e subir os arquivos ([5.1 A](05-publicacao-e-operacao.md#passo-a--subir-os-arquivos-para-um-repositório-privado-no-github)).
- [x] Conectar à Vercel e publicar ([5.1 B](05-publicacao-e-operacao.md#passo-b--publicar-na-vercel)).
- [x] Testar a jornada completa no celular, incluindo um vídeo.
- [x] Domínio próprio registrado e conectado: `carteiraideal.app.br` (ver decisão D8 no [Registro de decisões](07-registro-de-decisoes.md)). O endereço `carteira-ideal-app.vercel.app` continua ativo, mas não é mais divulgado.
- [x] Atualizar `og:image` e `og:url` no `index.html` para o endereço definitivo (`https://carteiraideal.app.br/`).
- [x] Testar a prévia do link colando o endereço numa conversa do WhatsApp.
- [x] Colocar o link na bio do Instagram — testado tocando dentro do próprio app do Instagram.
- [ ] Decidir o destino do repositório antigo `Carteira-Ideal` (já privado): manter como arquivo histórico ou apagar.

## 2. Proteção da metodologia

A mudança para a API tirou a metodologia do código visível. Ainda assim, vale conhecer os limites:

- [ ] **Limitar a frequência de chamadas à API.** Como a API devolve a carteira completa para qualquer combinação de respostas, alguém muito determinado poderia chamar a API milhares de vezes com combinações diferentes e tentar reconstruir as matrizes. Limitar chamadas por IP (regras de firewall da Vercel ou um serviço como o Upstash Rate Limit) torna isso muito mais lento e caro. Não impede por completo, mas eleva bastante o esforço.
- [ ] **Restringir `ALLOWED_ORIGIN`** ao domínio definitivo (variável de ambiente na Vercel). Impede outros sites de usarem sua API pelo navegador dos visitantes deles.
- [ ] **Registro de programa de computador no INPI.** Cria prova de autoria e data do código, útil caso alguém copie a ferramenta.
- [ ] **Termos de uso** proibindo cópia, engenharia reversa e uso automatizado da API.

## 3. Regulatório e privacidade

- [ ] **Revisão jurídica do enquadramento.** A ferramenta gera uma carteira a partir de dados pessoais do investidor. Mesmo com todos os avisos de "exemplo educacional", vale um parecer de advogado especializado em mercado de capitais sobre a fronteira com a atividade de consultoria de valores mobiliários (Resolução CVM 19/2021) e a relação com as regras de suitability (Resolução CVM 30/2021), antes de escalar a divulgação ou monetizar.
- [ ] **LGPD.** Hoje as respostas ficam só no aparelho do usuário e a API não grava nada, o que simplifica muito. Se entrar captação de e-mail, analytics ou histórico em servidor, será preciso política de privacidade, consentimento e definição de tempo de guarda.
- [ ] **Plano da Vercel.** O plano gratuito (Hobby) é para uso não comercial. Se o projeto passar a gerar receita diretamente (assinatura, venda de relatório), migrar para o plano Pro.

## 4. Governança da metodologia (visão de consultoria)

- [ ] **Revisão periódica das carteiras-modelo.** As 9 carteiras são fixas e não reagem ao cenário (nível da Selic, curva de juros, câmbio). Desde a D15, o job semanal traz Selic, IPCA, juro real, dólar e Focus para `mercadoOficial.json`: os números da revisão já estão à mão. Sugestão: revisão semestral documentada, com data e justificativa no [Registro de decisões](07-registro-de-decisoes.md), e o número da versão da metodologia exibido na tela de resultado.
- [ ] **Graduar o veto.** Hoje um, dois ou três pilares duros em [A] têm o mesmo efeito. Avaliar se três vetos simultâneos deveriam gerar uma orientação mais forte (por exemplo, priorizar quitar dívidas e montar reserva antes de investir).
- [ ] **Coerência com o enquadramento educacional.** Revisar textos como "Como um consultor CEA/CNPI analisa" para garantir que continuem soando educativos e não como recomendação individual.

## 5. Produto

- [ ] **Captação de contatos** no resultado (ex.: "receba sua carteira por e-mail"), depois de resolver o item de LGPD.
- [ ] **Métricas de uso** (Vercel Web Analytics, que não usa cookies): quantos começam, quantos terminam, onde desistem.
- [ ] **Resultado compartilhável** (imagem para stories do Instagram com o nome do Perfil-Mãe, sem percentuais), como motor de divulgação orgânica.
- [ ] **Exportar o resultado em PDF.**
- [ ] **Novas trilhas** (a estrutura de `trilhas.ts` já suporta trilhas "em construção").

## 6. Técnico

- [ ] **Testes automatizados da API** (`api/recomendacao.ts`): casos 200, 400, 405 e veto, hoje verificados só manualmente.
- [ ] **Verificação automática a cada envio** (GitHub Actions rodando `typecheck` e `test`), para uma alteração errada no motor não chegar ao ar. O GitHub Actions já está em uso pelo job mensal de FIIs, então falta só criar este segundo workflow.
- [ ] **Monitoramento de erros** da API (logs da Vercel ou um serviço como o Sentry).
- [ ] **Links pendentes:** o `script.js` da landing avisa no console sobre links marcados como pendentes (`data-todo`). Hoje não há nenhum, mas o mecanismo continua ativo para os próximos.

## 7. Aba "Simule FII" (decisão D9)

- [x] **Lista dos 10 fundos** revisada (CPTS11 substituído por GGRC11) e `"conferidoNaB3": true` (24/09/2026).
- [x] **Chave gratuita da brapi** criada, testada com o GGRC11 no painel da brapi e cadastrada como secret `BRAPI_TOKEN`.
- [x] **Variáveis `COMMIT_AUTOR_NOME` e `COMMIT_AUTOR_EMAIL`** cadastradas: os deploys automáticos saem na Vercel como Ready.
- [x] **Primeira execução** (24/09/2026): 10 fundos publicados, depois de fixar o CNPJ do TRXF11 (ver D9).
- [x] **Validação da estimativa** (24/09/2026): último mês próximo do anunciado (GGRC11 −2%, MXRF11 −6%, TRXF11 ~0%), mas meses de emissão e de fechamento de semestre distorcidos em até 57%. Média retirada da tela e trava por mediana adotada (D10).
- [ ] **Conferência mensal por amostragem:** após cada execução, comparar 2 fundos com o valor anunciado. Se as diferenças passarem de 10% com frequência, reavaliar a troca da fonte pela bolsai Pro (D10).
- [ ] **XPML11:** conferir se o 0,8576 repetido em jun, jul e ago corresponde ao anunciado pelo fundo.
- [ ] **Acompanhar a primeira execução automática** em 20/10/2026 (primeira no Ubuntu 24.04 fixo e com as ações v5).
- [ ] **Repetir a conferência do IFIX** em janeiro, maio e setembro (seção 5.6 da operação).
- [x] **Busca livre de qualquer FII** (decisão D12): feita sem função nova na Vercel, ampliando o job mensal para todos os FIIs do informe da CVM.
- [ ] **Cota da brapi:** conferir no painel a cota mensal vigente do plano gratuito e ajustar `outrosFundos.maxRequisicoesBrapi` em `config/fiis-ifix.json` se for preciso.
- [ ] **Primeira execução com a lista ampla:** ler no log a contagem de fundos publicados, indisponíveis e com baixa confiança, e conferir 2 fundos pequenos por amostragem além dos destaques.
- [ ] **Lista por liquidez e setor (D13), primeira execução:** conferir quantos fundos entraram, se os setores declarados à CVM fazem sentido (corrigir em `setores`) e se o volume médio de 2 ou 3 fundos bate com um site de cotações.
- [ ] **Nova captura** de `docs/jornada/17-simule-fii.jpg` mostrando a busca e a lista por setor, depois da primeira execução.

## 8. Dados oficiais e aba "Simule Tesouro" (decisões D15 a D17)

- [x] **Job semanal** de dados oficiais (Banco Central, Focus, Tesouro Transparente), sem custo e sem secret.
- [x] **Primeira execução** (25/09/2026): Selic 13,75%, IPCA 12m 4,22%, Focus de 18/09, 58 títulos. Corrigidos a Selic com data futura e a instabilidade do SGS.
- [x] **Aba Simule Tesouro** no ar, com simulador (IR, custódia, valor em dinheiro de hoje), taxas de hoje e gráfico de juros desde 1999.
- [x] **Build com dados reais** corrigido (conversão do JSON via `unknown` em `data/snapshotMercado.ts`).
- [x] **Textos do Tesouro revisados** com a lista real de títulos e TRPL4 → ISAE4 (D17).
- [ ] **Comparar uma simulação** com o simulador oficial do Tesouro Direto (mesmo título e valor). Diferença de poucos por cento é esperada.
- [ ] **Proteção do job:** rodar `npm run build` no próprio job antes do commit, para dados novos nunca quebrarem o site.
- [ ] **Rotina semanal:** olhar as linhas `[conteudo]` do log; se aparecerem, revisar os textos (D17).
- [ ] **Nova captura** `docs/jornada/18-simule-tesouro.jpg`.
- [ ] **Avaliar incluir o Tesouro Renda+ e o Educa+** no simulador (hoje fora: fluxo de renda mensal e regras próprias de custódia).

## 9. Aba "Simule BDR" (decisão D19)

- [x] **Job diário** (dias úteis, 19h de Brasília), 35 BDRs de ações e 5 de ETF por volume médio de 21 pregões, busca com todos os demais.
- [x] **Tela** com lista por setor, busca, simulação de compra e avisos de IR e câmbio.
- [ ] **Primeira execução:** ler no log as linhas `[revisar]`, `[setor]` e `[categoria]` e ajustar `config/bdrs.json`; conferir o volume médio de 2 ou 3 BDRs num site de cotações.
- [ ] **Grupos dos BDRs de ETF:** completar `gruposEtf` conforme os ETFs que entrarem na lista.
- [ ] **Nova captura** `docs/jornada/19-simule-bdr.jpg`.
- [ ] **Próximas frentes, uma por vez, cada uma em sua conversa:** ETFs da B3, criptomoedas e ações da B3.

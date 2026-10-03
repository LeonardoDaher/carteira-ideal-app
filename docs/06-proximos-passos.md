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
- [x] Repositório antigo `Carteira-Ideal`: tornado privado e GitHub Pages desligado em 28/09/2026 (D26). Apagar depois é opcional.

## 1B. SEO (D26)

- [x] **Etapa 0:** repositório antigo privado, Pages desligado.
- [ ] **Etapa 0:** verificar o domínio no Google Search Console e enviar o sitemap (docs/05, seção 5.10). Se a zona DNS do Registro.br ainda estiver "em transição", esperar; alternativa: verificação por tag HTML.
- [x] **Etapas 1 e 2:** robots.txt, sitemap.xml, canonical, metadados do app, fontes locais, redirecionamento do `.vercel.app`, página inicial com h1 ("Seu perfil de investidor vai além do teste da corretora"), conteúdo e dados estruturados.
- [x] **Etapa 3:** 28 páginas estáticas geradas no build (ferramentas, guias de ativos, aulas de "Sair das dívidas" e, com dados, "Taxas do Tesouro Direto hoje"), com o sitemap atualizado (docs/05, seção 5.11).
- [ ] Depois da publicação: conferir no Search Console se as páginas novas foram descobertas e, em 2 a 4 semanas, quais são indexadas. As 9 aulas têm 160 a 215 palavras; se ficarem de fora, ampliar ou juntar numa página longa.
- [ ] **Conferir com o responsável:** o texto dos guias e da aula "Dívida cara x dívida barata" (a frase do Pilar 2 fica só no app) e a regra da taxa de custódia (texto do guia do Tesouro Selic diz que a isenção de R$ 10 mil soma todos os títulos; o simulador aplica só ao Tesouro Selic).
- [x] **Etapa 4:** páginas `/sobre/` e `/metodologia-e-fontes/`, autor com nome e formação (Administração e Direito) em todas as páginas, título "Como analisar este ativo" no app (D26).
- [ ] **Conferir com o responsável:** nome (`AUTOR` em `scripts/gerar-paginas.mjs` e `founder` no `index.html`), redação sobre a CVM na página Sobre e se quer incluir registro na OAB.
- [ ] **Opcional:** profissional certificado (CFP, CEA ou CNPI) revisar os guias e assinar "revisado por".
- [ ] **Etapa 5:** páginas por código de negociação (depois dos termos de uso da B3).
- [ ] Avaliar, antes das Etapas 3 a 5, se indexar as análises publicamente entra no gatilho de parecer independente da D22.

## 1A. Meu Mês (D21), uma etapa por conversa

- [x] **Etapa 1:** motor do orçamento com testes e tela Meu Mês (contas, cofrinhos das contas anuais, os três potes, cópia de segurança). Aberta por `./app/?tela=meuMes` (botão na landing desde a Etapa 4).
- [x] **Etapa 2:** cartão de crédito com teto mensal próprio, semáforo, compras à vista e parceladas, e fatura entrando no mês seguinte.
- [x] **Etapa 3:** Modo Recuperação completo (plano de quitação avalanche x bola de neve, pote Quitar, mini-reserva, pacto de não parcelar, roteiro de negociação).
- [ ] **Taxas de referência das dívidas** (`TIPOS_DE_DIVIDA` em `domain/recuperacao.ts`: rotativo 14%, fatura parcelada 9%, cheque especial 8%, empréstimo pessoal 6% ao mês): revisar a cada seis meses com as médias do Banco Central, registrando no docs/07. Alternativa futura: trazer as séries de taxa média do SGS pelo job semanal de mercado.
- [ ] **Links do roteiro de negociação** (Registrato, Serasa Limpa Nome, consumidor.gov.br, Lei 14.181/2021): conferir no ar depois da publicação e a cada revisão semestral.
- [x] **Parecer jurídico:** análise interna do responsável, sem objeção (D22), incluindo o roteiro de negociação, o plano de quitação, a trilha "Sair das dívidas" e a sugestão dos Pilares 1 e 2.
- [x] **Etapa 4:** sugestão das respostas dos Pilares 1 e 2 no questionário, cartão "Antes de investir" no resultado, botão na landing, trilha "Sair das dívidas" (9 aulas em texto) no Aprender e briefing do Instagram.
- [ ] **Publicações do Instagram:** levar `briefing-instagram-meu-mes.md` (fora do repositório, no pacote) para o projeto "Publicações do Carteira Ideal", que aplica a identidade visual.
- [ ] **Vídeos da trilha "Sair das dívidas"** (em produção desde 26/09/2026): gravar os 9 Shorts a partir de `3-material-de-apoio/Roteiro-aulas-Sair-das-dividas.docx` (fora do repositório, no pacote; mesmo conteúdo da seção 4 do briefing, uma aula por página) e preencher `youtubeId` em `data/trilhas.ts` (o texto continua abaixo do vídeo).
- [ ] **Revisão semestral do conteúdo da trilha:** limite de juros do rotativo (Lei 14.690/2023), portabilidade de crédito, exemplo de 8% ao mês e a comparação com a Selic citada na aula 1.
- [ ] **Nova captura** `docs/jornada/20-meu-mes.jpg` e da sugestão no Pilar 1.

## 2. Proteção da metodologia

A mudança para a API tirou a metodologia do código visível. Ainda assim, vale conhecer os limites:

- [ ] **Limitar a frequência de chamadas à API.** Como a API devolve a carteira completa para qualquer combinação de respostas, alguém muito determinado poderia chamar a API milhares de vezes com combinações diferentes e tentar reconstruir as matrizes. Limitar chamadas por IP (regras de firewall da Vercel ou um serviço como o Upstash Rate Limit) torna isso muito mais lento e caro. Não impede por completo, mas eleva bastante o esforço.
- [ ] **Restringir `ALLOWED_ORIGIN`** ao domínio definitivo (variável de ambiente na Vercel). Impede outros sites de usarem sua API pelo navegador dos visitantes deles.
- [ ] **Registro de programa de computador no INPI.** Cria prova de autoria e data do código, útil caso alguém copie a ferramenta.
- [ ] **Termos de uso** proibindo cópia, engenharia reversa e uso automatizado da API.

## 3. Regulatório e privacidade

- [x] **Revisão jurídica do enquadramento.** Análise jurídica interna, feita pelo responsável (advogado), sobre a fronteira com a consultoria de valores mobiliários (Resolução CVM 19/2021) e a relação com as regras de suitability (Resolução CVM 30/2021): **sem objeção** (D22).
- [ ] **Parecer independente** de especialista em mercado de capitais: não é bloqueio hoje, mas fazer antes de monetizar, de divulgação paga em escala ou de telas que mudem a natureza do conteúdo (ranking de ativos, recomendação individual).
- [x] **LGPD: não se aplica no modelo atual** (D22). As respostas e o Meu Mês ficam só no aparelho, a API não grava nada, não há captação de e-mail, e o pedido para seguir no Instagram não coleta dado (liberação do livro por confiança). **Reabrir** se entrar captação de contato, histórico em servidor ou analytics.
- [x] **Plano da Vercel: Hobby mantido** (D22). O projeto é gratuito e, sem o link do curso da Udemy, o site não divulga produto pago nem tem link de afiliado. **Migrar para o Pro** se entrar anúncio, link de afiliado, venda, doação com contrapartida ou pagamento a quem produz o site.

## 4. Governança da metodologia (visão de consultoria)

- [ ] **Revisão periódica das carteiras-modelo.** As 9 carteiras são fixas e não reagem ao cenário (nível da Selic, curva de juros, câmbio). Desde a D15, o job semanal traz Selic, IPCA, juro real, dólar e Focus para `mercadoOficial.json`: os números da revisão já estão à mão. Sugestão: revisão semestral documentada, com data e justificativa no [Registro de decisões](07-registro-de-decisoes.md), e o número da versão da metodologia exibido na tela de resultado.
- [ ] **Graduar o veto.** Hoje um, dois ou três pilares duros em [A] têm o mesmo efeito. Avaliar se três vetos simultâneos deveriam gerar uma orientação mais forte (por exemplo, priorizar quitar dívidas e montar reserva antes de investir). Com a Etapa 3 da D21, essa orientação já existe no Meu Mês (Modo Recuperação), e desde a Etapa 4 o resultado aponta para ele quando o Pilar 2 (ou o Pilar 1) vem como [A]. O motor continua igual; graduar o veto no `engine.ts` segue em aberto.
- [ ] **Coerência com o enquadramento educacional.** Revisar textos como "Como analisar este ativo" (título trocado na D26; antes citava CEA/CNPI) para garantir que continuem soando educativos e não como recomendação individual.

## 5. Produto

- [x] ~~**Captação de contatos** no resultado~~: descartada (D22). O projeto pede só para seguir o @acarteiraideal.
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

- [x] **Job diário** (dias úteis, 22h30 de Brasília desde a D24), 35 BDRs de ações e 5 de ETF por volume médio de 21 pregões, busca com todos os demais.
- [x] **Migração para o Boletim de Preços da B3 (D24)**, com a brapi só para nome, setor e proporção, teto de 80 requisições por mês.
- [ ] **Carga inicial de BDRs** (Actions > "Carga inicial de BDRs", 260 pregões) logo depois de subir os arquivos da D24; ler as linhas `[desdobramento]` e ajustar `minimoBdrsNegociadosNoBoletim` pelo número típico do log.
- [ ] **Próxima economia de cota:** migrar a cotação e o volume do job de FIIs para o boletim (o teto dele, 800, é o que mais pesa no plano de 1.000).
- [x] **Tela** com lista por setor, busca, simulação de compra e avisos de IR e câmbio.
- [ ] **Primeira execução:** ler no log as linhas `[revisar]`, `[setor]` e `[categoria]` e ajustar `config/bdrs.json`; conferir o volume médio de 2 ou 3 BDRs num site de cotações.
- [ ] **Grupos dos BDRs de ETF:** completar `gruposEtf` conforme os ETFs que entrarem na lista.
- [ ] **Nova captura** `docs/jornada/19-simule-bdr.jpg`.
- [ ] **Próximas frentes, uma por vez, cada uma em sua conversa:** ETFs da B3, criptomoedas e ações da B3.
## 10. Financiar, alugar ou consórcio (decisão D44)

- [x] **Motor** (`domain/simulaImovel.ts`), **tela** (`SimuleImovel`, `?tela=simuleImovel`), cartão na landing e **página de SEO** `/financiar-alugar-ou-consorcio/`.
- [x] **Explicação completa de custos e taxas** no resultado, com a contabilidade fechada por teste.
- [ ] **Conferir os valores de partida** contra propostas reais antes de divulgar: juros do financiamento (10,5%), MIP (0,03%) e DFI (0,012%) ao mês, tarifa (R$ 25), ITBI e cartório (4%), custos de dono (1% ao ano), taxa de administração (15%) e fundo de reserva (1%) do consórcio, prazo do grupo (200 meses) e contemplação (36º mês). São nossos, não de mercado.
- [ ] **Revisão do texto de aviso** ("conta matemática, não indica banco nem consórcio, não é recomendação") pelo responsável certificado, na tela, na página de SEO e na Metodologia.
- [ ] **Testar com 3 ou 4 propostas reais** (um banco, uma administradora) e comparar a parcela e o CET da simulação com os da proposta. Diferença de poucos por cento é esperada (TR zerada, seguros aproximados).
- [ ] **Avaliar incluir:** isenção de ganho de capital do imóvel único, devolução do fundo de reserva no fim do grupo, FGTS na entrada e a TR no financiamento.
- [ ] **Nova captura** `docs/jornada/20-financiar-alugar-consorcio.jpg`.
- [ ] **Search Console:** pedir a indexação da nova página depois do deploy.

## 11. Simule Bens: à vista, carro e moto (decisões D45 em diante)

- [x] **Hub Simule Bens** (D45) com Imóvel ativo e Carro e Moto "em breve".
- [ ] **D46, comprar à vista no imóvel:** quarta rota, com a pergunta nova "quanto você tem disponível hoje" (quem financia, entra no consórcio ou aluga aplica a sobra). Mexe no motor já publicado: testes de conservação e reconciliação precisam cobrir a rota nova. Depois, trocar o título do cartão da landing para "Comprar à vista, financiar, consórcio ou alugar?".
- [ ] **Caso "não tenho o dinheiro todo":** "juntar e comprar depois", com aporte mensal. Fica para depois da D46.
- [ ] **Carro:** depreciação (não linear), IPVA, seguro, manutenção, IOF e gravame, financiamento em Price e juros próprios, índice do consórcio, e a rota "alugar" como locação ou assinatura (o carro não tem um aluguel óbvio, como o imóvel tem). Fonte sugerida para o valor de partida da taxa: série de taxa média de financiamento de veículos do Banco Central (a confirmar).
- [ ] **Moto:** reaproveita o motor do carro com outros valores de partida; decidir se moto de trabalho (renda gerada pelo bem) é caso à parte.
- [ ] **Cada bem novo:** página de SEO, registro de decisão, testes e **revisão do texto de aviso pelo responsável certificado**.

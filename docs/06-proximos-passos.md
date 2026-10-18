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

- [x] **Limitar a frequência de chamadas à API (D58):** 60 chamadas por IP a cada 15 minutos em `api/recomendacao.ts` (`api/_limite.ts`), só com hash do IP por 15 minutos, falha aberta. Acompanhar a primeira semana: se aparecer reclamação de "Muitas consultas em pouco tempo" em rede compartilhada, subir `MAX_CHAMADAS`. Motivo original: como a API devolve a carteira completa para qualquer combinação de respostas, alguém muito determinado poderia chamar a API milhares de vezes com combinações diferentes e tentar reconstruir as matrizes. Limitar chamadas por IP (regras de firewall da Vercel ou um serviço como o Upstash Rate Limit) torna isso muito mais lento e caro. Não impede por completo, mas eleva bastante o esforço.
- [x] **Restringir `ALLOWED_ORIGIN` (D85):** o padrão passou a ser o domínio definitivo no próprio código (a variável é opcional); origem estranha recebe 403. No mesmo pacote: limite no `/api/evento`, token do painel em tempo constante com limite de tentativas e cabeçalhos de segurança.
- [x] **CSP (D86 e D87):** bloqueando desde 13/10/2026 e com scripts inline só por hash.
- [x] **Vercel (complemento da D85, 14/10/2026):** regra de limite da API (120 por minuto por IP, testada no ar) e Bot Protection em `Log`.
- [ ] **Bot Protection: decidir `Challenge`** depois de cerca de 7 dias de `Log` (olhar a tela Firewall; não ligar se aparecerem Googlebot ou o navegador do Instagram).
- [x] **2FA (responsável, 14/10/2026):** ativado. Conferir que cobre GitHub, Registro.br, Vercel, Upstash, e-mail e Instagram, e que os códigos de recuperação estão guardados fora do computador.
- [x] **Ruleset da `main` (14/10/2026): criado, mas não aplicado no plano gratuito** (GitHub exige conta paga em repositório privado; a API responde 403). A `main` **não** está protegida contra exclusão e force push; vale sozinho ao migrar para o GitHub Pro. Não tornar o repositório público (tem `dados-privados/`).
- [x] **Dependabot (responsável, 14/10/2026):** alertas de vulnerabilidade, alertas de malware e atualizações de segurança ligados; atualizações de versão e agrupadas desligadas de propósito. Os pull requests que ele abrir passam pelo workflow "Verificar" antes de você mesclar.
- [x] **Testes automáticos de `/api/recomendacao` (D88):** 200, contrato da resposta, veto, 405, 400, 429 e CORS. **Falta:** teste do caminho 500 (erro interno do motor) e das funções do Top 15 além do acesso por código. Spend Management só existe no plano Pro (D22).
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

- [x] **Hub Simule Bens** (D45) com os três bens no ar: Imóvel (D44), Carro (D47) e Moto (D48).
- [x] **D46, comprar à vista no imóvel:** quarta rota, com o campo "Dinheiro disponível hoje"; título da landing atualizado. Regressão comprovada contra o motor da D45.
- [ ] **Conferir com uso real:** o resultado do à vista depende de a pessoa investir a diferença mensal; ver se a explicação da tela basta para o cliente entender isso.
- [ ] **Caso "não tenho o dinheiro todo":** "juntar e comprar depois", com aporte mensal até chegar ao valor do imóvel. Hoje a tela só avisa quanto falta.
- [x] **Carro (D47):** à vista, financiar (Price), consórcio e ficar sem carro; custo de mobilidade e patrimônio final lado a lado; depreciação em dois trechos; 0 km e seminovo; ponto de virada em "gasto mensal sem carro". Página de SEO `/carro-a-vista-financiar-consorcio-ou-sem-carro/`.
- [ ] **Carro, pendências:** (1) trazer o valor mais recente da série 25471 do Banco Central (juros médios de aquisição de veículos, PF, % ao mês) para o valor de partida dos juros, hoje "nosso"; (2) validar depreciação, IPVA, seguro, manutenção e uso de partida contra a tabela FIPE e cotações reais; (3) rota "juntar e comprar depois"; (4) troca de carro no meio de horizontes longos; (5) revisão do texto de aviso pelo responsável certificado.
- [x] **Moto (D48):** primeira versão para moto de **uso pessoal**, reaproveitando o motor do carro (campo `bem`), com valores de partida próprios e página de SEO `/moto-a-vista-financiar-consorcio-ou-sem-moto/`.
- [ ] **Moto de trabalho** (entrega, mototáxi): o bem gera renda e a pergunta muda para "quanto a moto se paga". Exige fluxo de receita no motor; decidir se entra e como. Até lá, a página de SEO e a tela dizem que o escopo é uso pessoal.
- [ ] **Moto e carro, pendências comuns:** validar valores de partida (depreciação, IPVA, seguro, manutenção, uso, juros) contra a tabela FIPE e cotações reais; os de moto são ainda menos fundamentados que os do carro.
- [ ] **Cada bem novo:** página de SEO, registro de decisão, testes e **revisão do texto de aviso pelo responsável certificado**.

## 12. FIIs baratos, Tijolo e Papel (decisão D59)

- [x] **Job com trilha de auditoria** (`scripts/atualizar-fii-baratos.mjs`, workflow "Atualizar FIIs Baratos", dia 21 de cada mês), cálculo puro, verificação independente e testes. **Não publica nada no app.**
- [ ] **Primeira execução no GitHub** (Actions → "Atualizar FIIs Baratos" → Run workflow): conferir que termina em ✅, que a verificação passa e que o Top 15 de tijolo e o de papel batem com o da D59 (a cotação do job de FIIs de 25/09 deve ser a mesma; se o job de FIIs rodou de novo, os números mudam um pouco).
- [x] **Conferir a lista "a conferir"** (D60): os 6 fundos da primeira execução foram conferidos no Investidor10; BRCR11 e OUJP11 liberados em `conferencia`; MFII11, BBIG11 e TRBL11 ficam de fora (rendimento cortado ou com pagamento extra); TGAR11 aguarda decisão do responsável (fundo de desenvolvimento).
- [ ] **A cada execução:** abrir `a-conferir.csv`, conferir os fundos novos numa fonte pública e registrá-los em `config/fii-baratos.json → conferencia` (a conferência vale 90 dias; reconferir os vencidos).
- [ ] **Antes de olhar o ranking:** rodar "Atualizar rendimentos de FIIs" para renovar as cotações (hoje as do job têm de 12 dias; fundos subiram 8% a 12% em 12 dias). Preço diário continua pendente.
- [x] **BBIG11, valor patrimonial por cota** (D60): decidido manter o do informe da CVM (R$ 9,74); o site usa as cotas em circulação (R$ 10,72, provável recompra). Limitação registrada em `docs/10`, seção 10, item 13.
- [ ] **Conferir por amostragem** 2 ou 3 fundos do topo de cada grupo (cotação, P/VP, rendimento do mês) contra uma fonte pública; roteiro em `docs/10`, seção 8.
- [ ] **Decisões do responsável antes de qualquer publicação:** enquadramento regulatório (mesma conversa da D22; ranking de FII pede o parecer independente antes de divulgar em escala) e **preço diário** (hoje a cotação é a do job mensal de FIIs).
- [ ] **Vacância e inadimplência:** trazer dos informes trimestral e anual da CVM (hoje só a rentabilidade patrimonial de 12 meses serve de indicador indireto).
- [ ] **Revisar os limiares** (liquidez, patrimônio, cotistas, alavancagem, P/VP mínimo, queda patrimonial, DY máximo e os dois alertas) depois de duas ou três competências: hoje vêm de uma única observação (2026-08).
- [ ] **Se for publicar:** tela, código de acesso e página de metodologia seguem o desenho do Top 15 de ações (D50); texto de aviso revisado pelo responsável certificado.
- [ ] **Liquidez pela mediana (D61):** rodar 'Atualizar rendimentos de FIIs' e depois 'Atualizar FIIs Baratos'; no log, conferir 'Liquidez: mediana em N fundos'. Ver quais fundos saíram (SAPI11 e BROF11 devem sair) (feito na D62: mínimo único de R$ 300 mil nos dois grupos; conferir na próxima execução quais fundos voltam, em especial TRBL11, RCRB11, RZAT11 e BROF11).
- [ ] **Preço diário dos FIIs (D63):** (1) rodar uma vez "Carga inicial de FIIs (preço diário)" (60 pregões); (2) conferir que "Atualizar preço diário dos FIIs" roda sozinho de segunda a sexta às 22h15; (3) rodar "Atualizar FIIs Baratos" e ver no log `Preço: diário da B3 em N fundos`. Depois de algumas semanas sem falha, ligar `dados.precoDiarioObrigatorio` (junto com a aprovação para publicar).
- [ ] **Enquadramento dos FIIs (D63):** revisar `publicacao.enquadramento` e o `avisoProposto` em `config/fii-baratos.json`; decidir o parecer independente da D22 antes de divulgar em escala. Só então mudar `aprovadoPeloResponsavel`.
- [ ] **RZAT11:** observar o rendimento irregular quando o informe de setembro entrar (hoje razão de 0,85, limite de 0,75).
- [ ] **Se for publicar a tela dos FIIs:** seguir o desenho do Top 15 de ações (D50), com o aviso lido de `publicacao.avisoProposto`.
- [ ] **Preço diário dos FIIs (D64):** conferir nos próximos dias úteis que "Atualizar preço diário dos FIIs" roda sozinho (22h15) e que os 3 fundos completados pela brapi (CVBI11, MALL11, BBPO11) continuam recebendo pregão novo. Descobrir por que a B3 não os traz no boletim.
- [ ] **Acesso do assistente ao GitHub (D64):** revisar se mantém; para revogar, `gh auth logout` ou github.com/settings/applications.
- [x] **Código dos FIIs (D65/D66):** `TOP15_FIIS_CODIGOS` criada na Vercel pelo responsável e Redeploy feito; conferido em 09/10/2026 na produção que `POST /api/top15-fiis` responde 401 "Código inválido ou vencido" (e não 503 "fechada") a um código falso.
- [ ] **Top 15 FIIs publicado (D65/D66):** abrir a lista com o código verdadeiro (Simule FII, aba "Top 15 mais baratos"); se o código das ações ainda for o de teste, trocar também `TOP15_CODIGOS` (`npm run codigo-top15 -- --classe acoes`), antes de divulgar os códigos no Instagram; decidir sobre o parecer independente (D22); dia 21 conferir a execução automática de "Atualizar FIIs Baratos" e a validade (90 dias) das conferências manuais.
- [x] **Top 15 atualizados todo dia útil (D89, 15/10/2026):** ações baratas, FIIs baratos, mais negociados, BDRs com desconto e maiores pesos do IFIX e do Ibovespa recalculam com o preço do dia; a pasta de auditoria completa só é gravada na primeira execução do mês, e nos outros dias o cálculo é conferido de forma independente em memória antes de publicar. **Conferir depois do envio:** a primeira execução automática de cada job (log `Auditoria: diária` ou `COMPLETA`, e o commit "dados: ..." com os arquivos do app), e que a data "Pregões até" nas telas avança todo dia útil.
- [ ] **Top 15 empresas mais endividadas (D94, 17/10/2026):** construído, testado e **publicado em 17/10/2026** (aprovado pelo responsável, v1.1.0). Falta: (1) conferir por amostragem 2 ou 3 empresas do topo contra as demonstrações da CVM (roteiro de docs/09, seção 9.2; contas 2.01.04, 2.02.01, 1.01.01, 1.01.02, 3.05, 7.04.01); (2) conferir no ar a aba "Top 15 mais endividadas" (Simule Ações) e a execução automática do workflow "Atualizar Top 15 Empresas Endividadas"; (3) o divulgador mensal (D91) já inclui esta lista, no post 4 (D95); (4) decidir se a lista "sem EBITDA positivo" fica à parte (como está) ou entra na ordem. Metodologia em `docs/12`.
- [ ] **Divulgação mensal (D91, com o post 4 das empresas mais endividadas desde a D95):** conferir no dia 2 de cada mês que o workflow "Gerar divulgação mensal" criou `divulgacao/AAAA-MM/` com os quatro posts e definir a instrução do código nos textos (entre colchetes).
- [ ] **Top 15 do IFIX e do Ibovespa (D72):** publicados em 08/10/2026, abertos e sem código (`aprovadoPeloResponsavel` true em `config/top15-ifix.json` e `config/top15-ibov.json`). Desde a D89 rodam todo dia útil: a carteira da B3 é a única etapa que depende da rede; se a B3 falhar, os outros rankings são publicados e o job termina com erro (e-mail do GitHub).
- [ ] **Top 15 FIIs, ações e BDRs mais negociados (D71):** publicados em 08/10/2026, abertos e sem código (`aprovadoPeloResponsavel` true em `config/top15-fiis.json`, `top15-acoes.json` e `top15-bdrs-negociados.json`); dia 22 conferir a execução automática.
- [x] **Código dos BDRs (D70):** `TOP15_BDRS_CODIGOS` criada na Vercel pelo responsável e Redeploy feito; conferido em 09/10/2026 na produção que `POST /api/top15-bdrs` responde 401 "Código inválido ou vencido" (e não 503 "fechada") a um código falso. Falta só abrir a lista com o código verdadeiro na aba "Top 15 maior desconto" do Simule BDR e divulgar o código no Instagram `@acarteiraideal`.
- [ ] **Desdobramentos dos BDRs "a conferir" (D70):** confirmar NFLX34, BKNG34 e os outros olhando os avisos de evento corporativo da B3 e registrar em `config/bdrs.json → desdobramentos` (formato no `_leia` do arquivo). Sem isso, eles ficam fora do ranking; dia 22 conferir a execução automática.
- [ ] **Motor de perfis revisado (D73):** rever os parâmetros de produto que o assistente escolheu: tetos de risco por suitability (`TETO_RISCO_SUITABILITY`: Conservador 10/20/30%, Moderado 35/45/55%), faixas de capacidade (baixa 6 a 9, média 10 a 14, alta 15 a 18) e a idade do aviso de sucessão (`IDADE_ALERTA_SUCESSAO` = 50). Levar o desenho novo (capacidade = vetor, suitability = teto) ao parecer independente da D22. Decidir se renomeia o perfil 3 "Conservador Acúmulo", que sai com carteira bem conservadora por causa do teto.
- [x] **Textos do site sobre o Meu Mês (D77):** página inicial, FAQ, página `/meu-mes/` e atalho do manifest agora citam a aba Supermercado.
- [ ] **Conferir no ar (depois da publicação):** a página de Privacidade (parágrafos novos da lista de compras e do WhatsApp), a página inicial e `/meu-mes/`.
- [ ] **Meu Mês Supermercado (D74 a D76):** testar no celular, depois que a Vercel publicar: ditado do teclado e botão de editar (✎, que separa por vírgula), ticar no mercado, "Enviar o que falta pelo WhatsApp" (conferir a mensagem e que o item ticado fica de fora) e layout dos botões. Se o ditado continuar ruim, avaliar o botão "Organizar com IA" (função nova na Vercel, chave de API, limite por pessoa e aviso de privacidade; o texto sairia do aparelho).
- [x] **Separador do ditado sem vírgulas (D79):** feito sem IA; testar no celular se o ditado real separa bem. Se os limites da D79 pesarem, avaliar o botão "Organizar com IA" (custo estimado de centavos; exige função na Vercel, chave, limite por pessoa e aviso de privacidade).
- [ ] **Sincronizar a lista entre pessoas (ideia, não iniciada):** hoje a lista fica só no aparelho e o WhatsApp é um envio único; compartilhar a mesma lista em tempo real exigiria conta e servidor.
- [ ] **Veto e carteiras (D78), decisões do responsável:** (a) **feito na D82:** qualquer veto limita o prazo ao médio (20% em risco, e não 30%); (b) **feito na D84:** passivo em dólar saiu da opção [A] do Pilar 2 (foi para a [B]); (c) unificar reserva e reação (suitability x Pilares 1 e 4), o que muda 14 para 12 ou 13 perguntas e o texto do site; (d) **feito na D83:** o P3 pergunta quanto será sacado (pergunta de complemento, só para quem marcou [A]). O teste de propriedade já existe (D80); as que sobram: (c), mais o nome do perfil 3, a opção C do piso e decidir se a dívida em dólar deve continuar ligando o Modo Recuperação do Meu Mês.
- [x] **Teste de propriedade do motor e verificação a cada envio (D80):** feitos; o motor viola a propriedade em ~1% dos casos (máx. 8 pontos); correção proposta na D80 aguarda decisão.
- [ ] **Painel de métricas (D78):** conferir no ar que o painel soma "(Falso Arrojado)" e "(Quase Arrojado)" na mesma barra.

## 13. Simule Opções (decisões D96 a D108)

- [x] **Séries reais da B3** com modelo americana/europeia, gregas, volatilidade implícita, filtros de vencimento e strike, e compra/venda de call e put montadas na própria tabela (D96, D103).
- [x] **Top 15 prêmios** (D97) e **cruzamento com ações baratas e endividadas** (D98).
- [x] **Tendência** (D99, D108), **Gráficos** (D100 a D102), **Roda** (D107) e **Estratégias** com THL, diagonais, rolagem e manejo (D103 a D106).
- [ ] **Primeiras semanas de uso:** conferir se o job diário de opções ("Atualizar opções") roda todo dia útil e se os números do app batem com o que o responsável vê na corretora (preço de último negócio, strikes, vencimentos).
- [ ] **Comparar as estimativas com o mercado:** confrontar o prêmio estimado da call da roda e o resultado das THL e diagonais com preços reais dos dias seguintes, para saber se o modelo (Black-Scholes, sem dividendos) é razoável ou enviesado.
- [x] **Acompanhar uma posição que a pessoa já tem (D112):** aba "Minha posição". Falta: (1) o responsável testar com uma posição real, quando tiver, e conferir se o reconhecimento da estrutura e as saídas fazem sentido; (2) histórico da posição (hoje só há o preço do último pregão; não guardamos a evolução dia a dia); (3) aviso quando a série vencer ou sair da lista.
- [ ] **Página pública de SEO** (como as de FII, ETF e BDR) para o Simule Opções, se o responsável quiser atrair buscas.
- [ ] **Coluna F.M. (formador de mercado):** sem fonte oficial gratuita encontrada.
- [ ] **Camada de linguagem natural** sobre o motor da Tendência: exigiria servidor, chave e custo; depende de decisão.
- [x] **Passo a passo por objetivo (D113)** no início da aba Estratégias.
- [x] **Glossário do Simule Opções (D114):** 30 termos em linguagem simples, com busca e exemplos numéricos. Falta: (1) o responsável ler e dizer quais termos ou explicações ficaram difíceis ou faltam; (2) revisar o restante dos textos das abas (Séries, Top 15, Tendência, Roda, Manejo e Minha posição) com o mesmo critério, se o glossário não bastar.

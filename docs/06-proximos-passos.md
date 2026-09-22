# 6. Próximos passos

Organizados por prioridade. Os itens do bloco 1 são necessários para lançar; os demais podem vir depois do lançamento.

## 1. Lançamento (fazer agora)

- [ ] Criar o repositório privado `carteira-ideal-app` e subir os arquivos ([5.1 A](05-publicacao-e-operacao.md#passo-a--subir-os-arquivos-para-um-repositório-privado-no-github)).
- [ ] Conectar à Vercel e publicar ([5.1 B](05-publicacao-e-operacao.md#passo-b--publicar-na-vercel)).
- [ ] Testar a jornada completa no celular, incluindo um vídeo.
- [ ] Decidir o endereço definitivo: `*.vercel.app` gratuito ou domínio próprio (ex.: `carteiraideal.com.br`, registrado no Registro.br e apontado para a Vercel em *Settings → Domains*). Domínio próprio passa mais credibilidade e não muda se um dia a hospedagem mudar.
- [ ] Atualizar `og:image` e `og:url` no `index.html` para o endereço definitivo.
- [ ] Testar a prévia do link colando o endereço numa conversa do WhatsApp.
- [ ] Colocar o link na bio do Instagram.
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

- [ ] **Revisão periódica das carteiras-modelo.** As 9 carteiras são fixas e não reagem ao cenário (nível da Selic, curva de juros, câmbio). Sugestão: revisão semestral documentada, com data e justificativa no [Registro de decisões](07-registro-de-decisoes.md), e o número da versão da metodologia exibido na tela de resultado.
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
- [ ] **Verificação automática a cada envio** (GitHub Actions rodando `typecheck` e `test`), para uma alteração errada no motor não chegar ao ar.
- [ ] **Monitoramento de erros** da API (logs da Vercel ou um serviço como o Sentry).
- [ ] **Links pendentes:** o `script.js` da landing avisa no console sobre links marcados como pendentes (`data-todo`). Hoje não há nenhum, mas o mecanismo continua ativo para os próximos.

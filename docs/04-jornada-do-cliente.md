# 4. Jornada do cliente

Capturas feitas em 22/09/2026 num navegador real, em tela de celular (390 × 844), com o site rodando localmente **junto com a API verdadeira**. O perfil de exemplo resultou em **"5. Moderado Renda (Equilíbrio)"**. Nas telas que rolam, a imagem mostra a parte de cima.

```
Instagram (bio) → Landing → Onboarding → Idade → 7 perguntas de Suitability
→ 7 perguntas de Arquitetura Patrimonial → Processando (chamada à API) → Resultado
→ abas: Perfil · Carteira (→ Detalhe do ativo) · Simular · Aprender (→ Trilha → Aula)
```

---

## Etapa 1 · Chegada

### 1.1 Landing "link na bio" (`/`)
<img src="jornada/01-landing-link-na-bio.jpg" width="260" align="right">

Primeira tela para quem toca no link da bio do Instagram.

- **Botão amarelo**: "Descobrir meu perfil e carteira de referência" → abre o app. Para quem já respondeu neste aparelho, vira "Ver minha carteira de referência" e abre direto no resultado.
- **Curso de Candlesticks** (Udemy, link de afiliado).
- **Educação Financeira Infantil**: livro em PDF liberado para quem segue o perfil (por confiança, sem verificação).
- **Falar comigo por e-mail**, ícones de Instagram e YouTube, alternância de tema claro/escuro.

<br clear="all">

### 1.2 Onboarding do app (`/app/`)
<img src="jornada/02-app-onboarding.jpg" width="260" align="right">

Explica a promessa em três pontos: 14 perguntas (7 de suitability e 7 de Arquitetura Patrimonial), 1 dos 9 Perfis-Mãe e carteira de referência em % com simulador em reais. Traz o **aviso educacional** completo antes de qualquer pergunta.

<br clear="all">

### 1.3 Idade
<img src="jornada/03-idade.jpg" width="260" align="right">

Controle deslizante de 18 a 90 anos. A idade alimenta a trava "mais de 60 anos com objetivo de aposentadoria rebaixa 1 nível de risco".

<br clear="all">

---

## Etapa 2 · Questionário (14 perguntas)

### 2.1 Suitability, perguntas 1 a 7
<img src="jornada/04-suitability-pergunta-1.jpg" width="200" align="right"><img src="jornada/05-suitability-pergunta-7.jpg" width="200" align="right">

Uma pergunta por tela, com barra de progresso ("Pergunta 1 de 7"). Tocar numa opção já avança; "Voltar" permite corrigir. Temas: objetivo, prazo, tolerância a queda, reserva de emergência, patrimônio disponível, experiência e reação a notícias de crise.

<br clear="all">

### 2.2 Arquitetura Patrimonial, perguntas 8 a 14
<img src="jornada/06-arquitetura-pergunta-1.jpg" width="170" align="right"><img src="jornada/07-arquitetura-pergunta-4.jpg" width="170" align="right"><img src="jornada/08-arquitetura-pergunta-7.jpg" width="170" align="right">

Mesmo formato, com o nome do pilar abaixo do título (ex.: "Pilar 1 de 7 — Capacidade Financeira de Risco (restrição dura)"). Os pilares 1 a 3 são restrições duras (veto); os pilares 4 a 7 são calibradores suaves. Textos completos em [Metodologia](02-metodologia.md#4-menu-de-respostas-objetivas).

<br clear="all">

---

## Etapa 3 · Cálculo

### 3.1 Processando
<img src="jornada/09-processando.jpg" width="260" align="right">

Animação em três etapas ("Calculando seu score de risco", "Aplicando travas de segurança", "Montando sua carteira sugerida"). **É aqui que o app chama a API** e espera a resposta real, com duração mínima de 1,9 s. Se não houver internet ou a API falhar, a tela mostra "Não conseguimos calcular sua carteira agora" com os botões **Tentar novamente** e **Voltar**.

<br clear="all">

---

## Etapa 4 · Resultado e exploração (barra de abas)

### 4.1 Aba Perfil (resultado)
<img src="jornada/10-resultado-perfil.jpg" width="260" align="right">

Mostra o **Perfil-Mãe de Carteira**, a linha "Suitability · Capacidade real · score", um texto explicando o perfil, o **gráfico de rosca** da carteira de referência com a lista de classes, a seção "Por que esse exemplo?" (com os alertas do motor, como sugestão de PGBL/VGBL ou aviso de veto) e o botão **Refazer o questionário**.

<br clear="all">

### 4.2 Aba Carteira e Detalhe do ativo
<img src="jornada/11-carteira-explicada.jpg" width="200" align="right"><img src="jornada/12-detalhe-do-ativo.jpg" width="200" align="right">

"Carteira de referência, explicada": cada classe com percentual e descrição. Tocar numa classe abre o **detalhe**: peso na carteira, contexto, divisão interna (ex.: Tesouro IPCA+ / Prefixado / Selic), exemplo por objetivo, diversificação por segmento e a seção "Como um consultor CEA/CNPI analisa".

<br clear="all">

### 4.3 Aba Simular
<img src="jornada/13-simulador.jpg" width="260" align="right">

Controle deslizante de R$ 100 a R$ 100 mil. A carteira de referência é convertida em reais por classe, com aviso educacional no final.

<br clear="all">

### 4.4 Aba Aprender, Trilha e Aula
<img src="jornada/14-aprender-trilhas.jpg" width="170" align="right"><img src="jornada/15-trilha.jpg" width="170" align="right"><img src="jornada/16-aula.jpg" width="170" align="right">

Duas trilhas: **Conhecendo os ativos** (5 tópicos, 11 aulas) e **O poder da diversificação** (4 tópicos, 4 aulas). Cada aula tem vídeo do YouTube incorporado, descrição e botão "Próxima aula".

> Na captura da aula, o quadro do vídeo aparece com a mensagem "Host not in allowlist". Isso é uma limitação do ambiente onde as capturas foram feitas, que bloqueia o YouTube. No site publicado o vídeo carrega normalmente.

<br clear="all">

---

## Comportamentos que não aparecem nas imagens

- **Retomada:** o progresso fica salvo no aparelho. Quem fecha no meio volta de onde parou.
- **Sem a Arquitetura Patrimonial:** o motor aceita só as 7 respostas de suitability e usa a matriz de fallback (seção 5.4 da metodologia). O fluxo atual sempre coleta as 14.
- **Refazer o questionário** apaga os dados do aparelho e volta ao onboarding.

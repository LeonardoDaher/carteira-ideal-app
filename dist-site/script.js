var THEME_COLORS = { dark: "#0a0d13", light: "#f6f7fb" };

function applyTheme(isLight) {
  var button = document.querySelector("#switch button");
  var meta = document.querySelector('meta[name="theme-color"]');

  if (button) button.setAttribute("aria-pressed", String(isLight));
  if (meta) meta.setAttribute("content", isLight ? THEME_COLORS.light : THEME_COLORS.dark);
}

function toggleMode() {
  var html = document.documentElement;
  var isLight = html.classList.toggle("light");

  applyTheme(isLight);

  try {
    localStorage.setItem("theme", isLight ? "light" : "dark");
  } catch (e) {
    /* modo privado / storage bloqueado: segue sem salvar */
  }
}

// O botão não usa onclick inline (a política de segurança não permite): o clique é ligado aqui (D87).
(function () {
  var button = document.querySelector("#switch button");
  if (button) button.addEventListener("click", toggleMode);
})();

// Sincroniza o botão e a cor da barra do navegador com o tema já aplicado no <head>
applyTheme(document.documentElement.classList.contains("light"));

// Aviso de desenvolvimento: links ainda sem endereço definitivo
(function () {
  var pending = document.querySelectorAll('a[href="#"][data-todo]');
  if (!pending.length || !window.console) return;
  var names = [];
  Array.prototype.forEach.call(pending, function (a) {
    var n = a.getAttribute("data-todo");
    if (names.indexOf(n) === -1) names.push(n);
  });
  console.warn("[Carteira Ideal] Links pendentes em index.html: " + names.join(", "));
})();

/* Quem já respondeu o questionário: o app (mesmo endereço, pasta /app) guarda o progresso no
   navegador. Se já existe uma carteira pronta neste aparelho, o botão principal passa a dizer
   "Ver minha carteira de referência". O texto original do HTML continua valendo para os demais
   casos, inclusive se o armazenamento estiver bloqueado.

   ATENÇÃO: CHAVE e VERSAO precisam acompanhar CHAVE_ARMAZENAMENTO e VERSAO_ARMAZENAMENTO em
   webapp-src/src/state/useAppState.ts. Se o app mudar a versão, o progresso antigo deixa de valer
   (o app o descarta) e a landing volta ao texto original, de propósito. */
(function () {
  var CHAVE = "carteiraideal.estado";
  var VERSAO = 2;
  // Aprender, Trilha, Aula e Simule FII hoje abrem sem questionário e não são mais salvas como
  // "última tela" (ver TELAS_AVULSAS em useAppState.ts). Continuam na lista só por causa de
  // estados salvos por versões anteriores, em que elas existiam apenas depois do resultado.
  var TELAS_COM_RESULTADO = ["resultado", "carteira", "simulador", "detalheAtivo", "aprender", "trilha", "aprenderVideo", "simuleFii"];

  try {
    var bruto = localStorage.getItem(CHAVE);
    if (!bruto) return;
    var salvo = JSON.parse(bruto);
    if (!salvo || salvo.versao !== VERSAO || TELAS_COM_RESULTADO.indexOf(salvo.screen) === -1) return;
    // Só vale como "carteira pronta" se as 7 respostas de suitability estão salvas. Só a tela salva
    // não basta: quem tocou numa aba sem ter respondido nada ficava com "resultado" gravado.
    // 7 = PERGUNTAS.length em webapp-src/src/data/questions.ts.
    if (!salvo.respostas || Object.keys(salvo.respostas).length < 7) return;

    var cta = document.querySelector("a.cta");
    var titulo = document.querySelector("a.cta .cta-title");
    var sub = document.querySelector("a.cta .cta-sub");
    if (titulo) titulo.textContent = "Ver minha carteira de referência";
    if (sub) sub.textContent = "Suas respostas estão salvas neste aparelho";
    // ?tela=resultado avisa o app para abrir direto no resultado, em vez de continuar de
    // onde o usuário parou (ex: no meio de uma trilha de aprendizagem) — ver useAppState.ts
    if (cta) cta.setAttribute("href", "./app/?tela=resultado");
  } catch (e) {
    /* armazenamento bloqueado ou dado inválido: mantém o texto original */
  }
})();

/* O botão do livro "Os Três Potes de Clara" (com a liberação por confiança) saiu daqui: agora
   fica no fim da tela Aprender do app (webapp-src/src/ui/MateriaisExtras.tsx), que usa a mesma
   chave carteiraideal.livroLiberado. O link do curso de Candlesticks foi retirado do site (D22). */

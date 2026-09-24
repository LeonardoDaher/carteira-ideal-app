/** Link de volta para a landing (raiz do site), usado nas telas que a landing abre direto
 * (Aprender e Simule FII). O app é publicado em /app/, então "../" leva à raiz. */
export function VoltarInicio() {
  return (
    <a className="voltar-inicio" href="../">
      ← Início
    </a>
  )
}

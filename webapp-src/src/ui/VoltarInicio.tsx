import { Marca } from './Marca'

/** Topo das telas que a landing abre direto (Aprender e Simule Tesouro/FII/BDR): a logo do
 * Carteira Ideal e, ao lado, o link "← Início" de volta para a landing. O app é publicado
 * em /app/, então "../" leva à raiz do site. */
export function VoltarInicio() {
  return (
    <div className="topo-pagina">
      <Marca />
      <a className="voltar-inicio" href="../">
        ← Início
      </a>
    </div>
  )
}

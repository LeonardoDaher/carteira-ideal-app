import { Marca } from './Marca'

/** Topo das telas que a landing abre direto (Aprender, Meu Mês, Meus Ativos e o hub Simule Ativos): a logo
 * do Carteira Ideal e, ao lado, o link "← Início" de volta para a landing. O app é publicado
 * em /app/, então "../" leva à raiz do site.
 *
 * Os simuladores (FII, Tesouro, BDR, ETF) são abertos pelo hub Simule Ativos (D37), então voltam
 * para ele: passam `href` e `rotulo`. */
export function VoltarInicio({ href = '../', rotulo = '← Início' }: { href?: string; rotulo?: string }) {
  return (
    <div className="topo-pagina">
      <Marca />
      <a className="voltar-inicio" href={href}>
        {rotulo}
      </a>
    </div>
  )
}

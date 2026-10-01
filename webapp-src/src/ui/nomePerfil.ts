/**
 * Remove o número de ordem na frente do nome do Perfil Final da Carteira, para exibição
 * (ex.: "9. Arrojado Pleno / Global" vira "Arrojado Pleno / Global"). O número continua existindo no
 * dado interno (PerfilFinalCarteira) e só não aparece na tela. Compartilhado pelas telas que mostram
 * o perfil, para o nome ser sempre igual em todas.
 */
export function semNumero(nomePerfil: string): string {
  return nomePerfil.replace(/^\d+\.\s*/, '')
}

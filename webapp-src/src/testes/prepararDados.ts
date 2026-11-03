import { CHAVES_DE_DADOS, definirDados } from '../data/arquivosMercado'

// Em produção os JSON de mercado são baixados sob demanda. Nos testes, entram do disco antes de cada arquivo de teste, e as telas
// aparecem como sempre apareceram. O teste de carregamento (arquivosMercado.test.tsx) limpa o registro de propósito.
const arquivos = import.meta.glob<{ default: unknown }>('../data/*.json', { eager: true })

for (const chave of CHAVES_DE_DADOS) {
  const modulo = arquivos[`../data/${chave}.json`]
  if (!modulo) throw new Error(`Falta src/data/${chave}.json para os testes`)
  definirDados(chave, modulo.default)
}

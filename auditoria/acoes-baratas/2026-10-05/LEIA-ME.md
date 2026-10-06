# Auditoria da triagem "Top 15 ações mais baratas"

Execução com preços de **2026-10-05** · metodologia **v1.0.6**.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `manifesto.json` | Origem de cada dado (URL + sha256), hashes da config, dos insumos, do resultado e do código de cálculo |
| `config.json` | Cópia exata dos parâmetros usados |
| `insumos.json.gz` | Cada linha das demonstrações da CVM (conta, versão, período, link do documento) e cada preço usados |
| `resultado.json` | Ranking, etapas e exclusões (o que o hash do resultado cobre) |
| `memoria-de-calculo.json.gz` | Para cada empresa: cada fórmula com cada número e a conta da CVM de origem |
| `ranking.csv`, `exclusoes.csv` | Mesmas informações, abertas em planilha |
| `mapeamento-ticker-cnpj.csv` | Qual CNPJ foi associado a cada código, e por quê |

## Como refazer o cálculo e conferir

```
node scripts/acoes-baratas-verificar.mjs auditoria/acoes-baratas/2026-10-05
```

O comando recalcula o resultado só com `insumos.json.gz` + `config.json` e compara com o hash do manifesto.
Sem internet. Se o hash bater, o ranking publicado é exatamente o que a metodologia produz com aqueles insumos.

## Como conferir os insumos contra a fonte

1. Escolha uma empresa em `ranking.csv` e abra o `link_documento` (documento original na CVM).
2. Em `memoria-de-calculo.json.gz`, localize o ticker: cada componente traz conta (CD_CONTA), descrição, período, versão e valor.
3. Compare com a demonstração do documento. Um roteiro de conferência manual está em `docs/09-metodologia-acoes-baratas.md`.

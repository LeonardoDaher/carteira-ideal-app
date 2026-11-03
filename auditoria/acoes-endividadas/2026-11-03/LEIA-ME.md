# Auditoria: Top 15 empresas mais endividadas

Execução com preços de **2026-10-30** · metodologia **v1.1.0**. Sem rede: parte das demonstrações da CVM congeladas na auditoria das ações baratas.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `manifesto.json` | Origem dos insumos (a pasta das ações baratas), hashes das configs, dos insumos, do resultado e do código de cálculo |
| `config.json` | Parâmetros próprios desta lista |
| `config-base.json` | Cópia exata do config das ações baratas (universo, liquidez e leitura contábil) |
| `insumos.json.gz` | Demonstrações da CVM usadas (conta, versão, período, link do documento) e o preço de cada empresa |
| `resultado.json` | Ranking, lista sem EBITDA positivo, etapas e exclusões (o que o hash do resultado cobre) |
| `memoria-de-calculo.json.gz` | Para cada empresa: cada conta da CVM, cada fórmula e cada número |
| `ranking.csv`, `sem-ebitda-positivo.csv`, `exclusoes.csv` | As mesmas informações, abertas em planilha |

## Como refazer o cálculo e conferir

```
node scripts/acoes-endividadas-verificar.mjs auditoria/acoes-endividadas/2026-11-03
```

O comando recalcula o resultado só com `insumos.json.gz` + as duas configs e compara com o hash do manifesto. Sem internet.

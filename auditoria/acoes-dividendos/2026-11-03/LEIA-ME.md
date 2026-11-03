# Auditoria: Top 15 ações pagadoras de dividendos

Execução com preços de **2026-10-30** · metodologia **v1.1.0**. Os proventos vêm da API pública da B3 (aba "Proventos em dinheiro" de cada empresa).

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `manifesto.json` | Origem dos insumos, hashes da config, dos insumos, do resultado e do código de cálculo |
| `config.json` | Parâmetros desta lista |
| `insumos.json.gz` | Proventos de cada empresa como a B3 publicou (classe, tipo, valor por ação, data com) e o preço de fechamento usado |
| `resultado.json` | Ranking, etapas e exclusões (o que o hash do resultado cobre) |
| `memoria-de-calculo.json.gz` | Para cada empresa: os proventos que entraram na soma e os que ficaram de fora |
| `ranking.csv`, `proventos.csv`, `exclusoes.csv` | As mesmas informações, abertas em planilha |

## Como refazer o cálculo e conferir

```
node scripts/acoes-dividendos-verificar.mjs auditoria/acoes-dividendos/2026-11-03
```

O comando recalcula o resultado só com `insumos.json.gz` + `config.json` e compara com o hash do manifesto. Sem internet. Ele não prova que os insumos reproduzem a B3: para isso, compare um código com a página de proventos da empresa em b3.com.br.

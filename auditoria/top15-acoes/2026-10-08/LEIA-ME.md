# Auditoria: ações mais negociadas (auditoria/top15-acoes/2026-10-08)

Execução com preços até o pregão de **2026-10-07** · metodologia **v1.1.0**. Fonte: Boletim de Preços da B3 (BVBG.086), guardado em `historico/acoes.json`.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `manifesto.json` | Origem dos dados, hashes da config, dos insumos, do resultado e do código de cálculo |
| `config.json` | Cópia exata dos parâmetros usados |
| `insumos.json.gz` | Séries de fechamento, mínima, máxima e volume por ativo, exatamente como entraram no cálculo |
| `resultado.json` | O ranking, os alertas e as exclusões (o que o hash do resultado cobre) |
| `memoria-de-calculo.json.gz` | Para cada ativo da lista: a fórmula, a janela de pregões e o volume de cada dia |
| `*.csv` | As mesmas informações, abertas em planilha |

## Como refazer o cálculo e conferir

```
node scripts/top15-mercado-verificar.mjs auditoria/top15-acoes/2026-10-08
```

O comando recalcula o resultado só com `insumos.json.gz` + `config.json` e compara com o hash do manifesto. Sem internet. Roteiro completo: `docs/11-metodologia-top15-etfs-bdrs.md`.

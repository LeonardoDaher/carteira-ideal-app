# Auditoria da triagem "FIIs baratos" (Tijolo e Papel)

Execução com cotações de **2026-10-07** · Informe Mensal da CVM de **2026-08** · metodologia **v1.3.0**.

**Esta triagem NÃO está publicada no app.** É uma trilha de auditoria para o responsável revisar (ver `config/fii-baratos.json → publicacao`).

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `manifesto.json` | Origem de cada dado (URL + sha256), hashes da config, dos insumos, do resultado e do código de cálculo |
| `config.json` | Cópia exata dos parâmetros usados |
| `insumos.json.gz` | Cada linha do Informe Mensal usada (por fundo e competência) e cada cotação |
| `resultado.json` | Rankings, lista "a conferir", etapas e exclusões (o que o hash do resultado cobre) |
| `memoria-de-calculo.json.gz` | Para cada fundo: classificação, série de 12 meses, cada fórmula com seus números |
| `ranking-tijolo.csv`, `ranking-papel.csv`, `a-conferir.csv`, `exclusoes.csv` | Mesmas informações, abertas em planilha |

## Como refazer o cálculo e conferir

```
node scripts/fii-baratos-verificar.mjs auditoria/fii-baratos/2026-10-07
```

O comando recalcula o resultado só com `insumos.json.gz` + `config.json` e compara com o hash do manifesto. Sem internet.

## Como conferir os insumos contra a fonte

Em `memoria-de-calculo.json.gz`, localize o ticker: cada competência traz o DY, o valor patrimonial da cota e a rentabilidade patrimonial como estavam no arquivo `inf_mensal_fii_complemento_AAAA.csv` da CVM (sha256 do zip no manifesto). A composição do ativo vem de `inf_mensal_fii_ativo_passivo_AAAA.csv`. Roteiro completo: `docs/10-metodologia-fii-baratos.md`.

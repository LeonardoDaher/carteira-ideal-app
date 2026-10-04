# Conferência manual — Top 15 ações mais baratas

Copie este arquivo para `conferencia-AAAA-MM-DD.md` na pasta da execução auditada e preencha. Roteiro: `docs/09-metodologia-acoes-baratas.md`, seção 9.2.

- **Execução auditada (pasta):** `auditoria/acoes-baratas/AAAA-MM-DD`
- **Hash do resultado (manifesto):** 
- **`npm run verificar-acoes-baratas`:** ☐ OK ☐ FALHOU (anexar saída)
- **Conferido por / data:** 

## Amostra (mínimo 5 empresas: setores diferentes; 1 com ON e PN; 1 com minoritários; 1 cujo último documento é ITR)

| Ticker | Documento (DFP/ITR, data-base) | EBIT 12m (3.05) | FCO 12m (6.01) | PL (2.03) | Caixa (1.01.01+1.01.02) | Dívida (2.01.04+2.02.01) | Valor de mercado | Rendimentos recalculados (PL/VM, FCO/EV, EBIT/EV) | Confere? |
|---|---|---|---|---|---|---|---|---|---|
| | | memória: ___ · fonte: ___ | memória: ___ · fonte: ___ | memória: ___ · fonte: ___ | memória: ___ · fonte: ___ | memória: ___ · fonte: ___ | memória: ___ · fonte: ___ | planilha: ___ · ranking.csv: ___ | ☐ |
| | | | | | | | | | ☐ |
| | | | | | | | | | ☐ |
| | | | | | | | | | ☐ |
| | | | | | | | | | ☐ |

## Exclusões revisadas (`exclusoes.csv`)

Anote casos suspeitos (empresa conhecida e saudável excluída por dados incompletos, balanço que não fecha, capital implausível ou salto de preço) e a providência (corrigir `config/acoes-baratas-cnpj.json`, confirmar desdobramento em `config/acoes.json`, ou registrar como limitação).

| Ticker | Código da exclusão | Providência |
|---|---|---|
| | | |

## Divergências encontradas

(descreva cada uma: conta, valor na memória, valor na fonte, causa provável)

## Conclusão

☐ Sem divergências relevantes ☐ Divergências corrigidas e execução repetida ☐ Divergências impeditivas (não publicar)

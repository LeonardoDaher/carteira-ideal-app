#!/usr/bin/env python3
"""Gera os zips de teste em scripts/fixtures/cvm/ no MESMO layout dos arquivos abertos da CVM
(ISO-8859-1, separador ';', ESCALA_MOEDA, ORDEM_EXERC ÚLTIMO/PENÚLTIMO). Dados 100% fictícios.
Valores abaixo em R$ MILHÕES; o arquivo grava em MIL (milhões × 1000), como a CVM.
Cenário ALFA S.A. (calculado à mão no teste): ver scripts/acoes-baratas.test.mjs."""
import zipfile, os
AQUI = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cvm')
ALFA = '11.111.111/0001-11'; BETA = '22.222.222/0001-22'

def csv(cab, linhas): return ('\r\n'.join([';'.join(cab)] + [';'.join(str(c) for c in l) for l in linhas]) + '\r\n').encode('latin-1')
def mil(mi): return f'{mi*1000:.2f}'

CAB_BP = 'CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA'.split(';')
CAB_FL = 'CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA'.split(';')
CAB_MAIN = 'CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC'.split(';')
CAB_CAP = 'CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;QT_ACAO_ORDIN_CAP_INTEGR;QT_ACAO_PREF_CAP_INTEGR;QT_ACAO_TOTAL_CAP_INTEGR;QT_ACAO_ORDIN_TESOURO;QT_ACAO_PREF_TESOURO;QT_ACAO_TOTAL_TESOURO'.split(';')

def fl(cnpj, ref, ver, grupo, ordem, ini, fim, cd, ds, mi, moeda='REAL', escala='MIL'):
    v = mil(mi) if escala == 'MIL' else f'{mi*1e6:.2f}'
    return [cnpj, ref, ver, 'EMPRESA', '000001', grupo, moeda, escala, ordem, ini, fim, cd, ds, v, 'S']
def bp(cnpj, ref, ver, grupo, ordem, fim, cd, ds, mi):
    return [cnpj, ref, ver, 'EMPRESA', '000001', grupo, 'REAL', 'MIL', ordem, fim, cd, ds, mil(mi), 'S']

# ----------------------------- DFP 2025 -----------------------------
def dfp():
    R, V = '2025-12-31', 2   # versão vigente = 2 (a 1 está errada de propósito)
    dre = []
    D = lambda ver, cd, ds, mi, c=ALFA: fl(c, R, ver, 'DF Consolidado - Demonstração do Resultado', 'ÚLTIMO', '2025-01-01', R, cd, ds, mi)
    dre += [D(1, '3.05', 'Resultado Antes do Resultado Financeiro e dos Tributos', 9999)]  # versão antiga: tem que ser ignorada
    for cd, ds, mi in [('3.01','Receita de Venda de Bens e/ou Serviços',10000),('3.04.04','Outras Receitas Operacionais',100),('3.04.05','Outras Despesas Operacionais',-50),
                       ('3.04.06','Resultado de Equivalência Patrimonial',200),('3.05','Resultado Antes do Resultado Financeiro e dos Tributos',1500),
                       ('3.06','Resultado Financeiro',-300),('3.06.02','Despesas Financeiras',-400),('3.07','Resultado Antes dos Tributos sobre o Lucro',1200),
                       ('3.11','Lucro/Prejuízo Consolidado do Período',900),('3.11.01','Atribuído a Sócios da Empresa Controladora',850)]:
        dre.append(D(V, cd, ds, mi))
    dre.append(D(V, '3.05', 'Resultado Antes do Resultado Financeiro e dos Tributos', 1111, BETA))   # outra empresa
    dre.append(fl(ALFA, R, V, 'DF Consolidado - Demonstração do Resultado', 'ÚLTIMO', '2025-01-01', R, '3.01', 'Receita', 5, moeda='DÓLAR'))  # moeda errada: descartar
    dre_ind = [fl(ALFA, R, V, 'DF Individual - Demonstração do Resultado', 'ÚLTIMO', '2025-01-01', R, '3.05', 'Resultado Antes do Resultado Financeiro e dos Tributos', 777)]
    dfc = [fl(ALFA, R, V, 'DF Consolidado - Demonstração do Fluxo de Caixa (Método Indireto)', 'ÚLTIMO', '2025-01-01', R, '6.01', 'Caixa Líquido Atividades Operacionais', 1400)]
    dva = [fl(ALFA, R, V, 'DF Consolidado - Demonstração de Valor Adicionado', 'ÚLTIMO', '2025-01-01', R, '7.04.01', 'Depreciação, Amortização e Exaustão', -400)]  # DVA: retenções com sinal NEGATIVO, como na CVM
    main = [[ALFA, R, 1, 'ALFA S.A.', '000001', 'DFP', '1001', '2026-02-20', 'https://exemplo.cvm/doc?id=1001'],
            [ALFA, R, V, 'ALFA S.A.', '000001', 'DFP', '1002', '2026-03-10', 'https://exemplo.cvm/doc?id=1002'],
            [BETA, R, 1, 'BETA S.A.', '000002', 'DFP', '2001', '2026-03-12', 'https://exemplo.cvm/doc?id=2001']]
    cap = [[ALFA, R, V, 'ALFA S.A.', 500000000, 500000000, 1000000000, 10000000, 0, 10000000]]
    return {'dfp_cia_aberta_2025.csv': csv(CAB_MAIN, main), 'dfp_cia_aberta_DRE_con_2025.csv': csv(CAB_FL, dre), 'dfp_cia_aberta_DRE_ind_2025.csv': csv(CAB_FL, dre_ind),
            'dfp_cia_aberta_DFC_MI_con_2025.csv': csv(CAB_FL, dfc), 'dfp_cia_aberta_DVA_con_2025.csv': csv(CAB_FL, dva),
            'dfp_cia_aberta_BPA_con_2025.csv': csv(CAB_BP, []), 'dfp_cia_aberta_BPP_con_2025.csv': csv(CAB_BP, []), 'dfp_cia_aberta_composicao_capital_2025.csv': csv(CAB_CAP, cap)}

# ----------------------------- ITR 2026 (2º tri) -----------------------------
def itr():
    R, V = '2026-06-30', 1
    G = 'DF Consolidado - Demonstração do Resultado'
    dre = []
    def y(cd, ds, atual, anterior, tri_atual, tri_ant):
        dre.append(fl(ALFA, R, V, G, 'ÚLTIMO', '2026-01-01', R, cd, ds, atual))
        dre.append(fl(ALFA, R, V, G, 'ÚLTIMO', '2026-04-01', R, cd, ds, tri_atual))        # trimestre isolado: ignorar
        dre.append(fl(ALFA, R, V, G, 'PENÚLTIMO', '2025-01-01', '2025-06-30', cd, ds, anterior))
        dre.append(fl(ALFA, R, V, G, 'PENÚLTIMO', '2025-04-01', '2025-06-30', cd, ds, tri_ant))
    y('3.01','Receita de Venda de Bens e/ou Serviços',5500,4800,2800,2400)
    y('3.04.04','Outras Receitas Operacionais',60,40,30,20)
    y('3.04.05','Outras Despesas Operacionais',-30,-20,-15,-10)
    y('3.04.06','Resultado de Equivalência Patrimonial',120,90,60,45)
    y('3.05','Resultado Antes do Resultado Financeiro e dos Tributos',900,700,450,340)
    y('3.06','Resultado Financeiro',-160,-150,-80,-75)
    y('3.06.02','Despesas Financeiras',-200,-180,-100,-90)
    y('3.07','Resultado Antes dos Tributos sobre o Lucro',740,550,370,265)
    y('3.11','Lucro/Prejuízo Consolidado do Período',560,400,280,200)
    y('3.11.01','Atribuído a Sócios da Empresa Controladora',530,380,265,190)
    GF = 'DF Consolidado - Demonstração do Fluxo de Caixa (Método Indireto)'
    dfc = [fl(ALFA, R, V, GF, 'ÚLTIMO', '2026-01-01', R, '6.01', 'Caixa Líquido Atividades Operacionais', 800), fl(ALFA, R, V, GF, 'PENÚLTIMO', '2025-01-01', '2025-06-30', '6.01', 'Caixa Líquido Atividades Operacionais', 650)]
    GV = 'DF Consolidado - Demonstração de Valor Adicionado'
    dva = [fl(ALFA, R, V, GV, 'ÚLTIMO', '2026-01-01', R, '7.04.01', 'Depreciação, Amortização e Exaustão', -210), fl(ALFA, R, V, GV, 'PENÚLTIMO', '2025-01-01', '2025-06-30', '7.04.01', 'Depreciação, Amortização e Exaustão', -190)]
    A, P = 'DF Consolidado - Balanço Patrimonial Ativo', 'DF Consolidado - Balanço Patrimonial Passivo'
    bpa = [bp(ALFA,R,V,A,'ÚLTIMO',R,'1','Ativo Total',20000), bp(ALFA,R,V,A,'ÚLTIMO',R,'1.01.01','Caixa e Equivalentes de Caixa',1000), bp(ALFA,R,V,A,'ÚLTIMO',R,'1.01.02','Aplicações Financeiras',500)]
    bpp = [bp(ALFA,R,V,P,'ÚLTIMO',R,'2','Passivo Total',20000), bp(ALFA,R,V,P,'ÚLTIMO',R,'2.01.04','Empréstimos e Financiamentos',700),
           bp(ALFA,R,V,P,'ÚLTIMO',R,'2.02.01','Empréstimos e Financiamentos',3300), bp(ALFA,R,V,P,'ÚLTIMO',R,'2.03','Patrimônio Líquido Consolidado',9000),
           bp(ALFA,R,V,P,'ÚLTIMO',R,'2.03.09','Participação dos Acionistas Não Controladores',400)]
    main = [[ALFA,'2026-03-31',1,'ALFA S.A.','000001','ITR','3001','2026-05-10','https://exemplo.cvm/doc?id=3001'],
            [ALFA,R,V,'ALFA S.A.','000001','ITR','3002','2026-08-12','https://exemplo.cvm/doc?id=3002']]
    cap = [[ALFA, R, V, 'ALFA S.A.', 500000000, 500000000, 1000000000, 10000000, 0, 10000000]]
    return {'itr_cia_aberta_2026.csv': csv(CAB_MAIN, main), 'itr_cia_aberta_DRE_con_2026.csv': csv(CAB_FL, dre), 'itr_cia_aberta_DFC_MI_con_2026.csv': csv(CAB_FL, dfc),
            'itr_cia_aberta_DVA_con_2026.csv': csv(CAB_FL, dva), 'itr_cia_aberta_BPA_con_2026.csv': csv(CAB_BP, bpa), 'itr_cia_aberta_BPP_con_2026.csv': csv(CAB_BP, bpp),
            'itr_cia_aberta_composicao_capital_2026.csv': csv(CAB_CAP, cap)}


# ----------------------------- DFP históricas (consistência de 5 exercícios) -----------------------------
# ALFA: lucro dos controladores / FCO por exercício (R$ milhões). 2022 teve prejuízo.
HIST = {2021: (700, 900), 2022: (-150, 300), 2023: (800, 1000), 2024: (820, 1200)}
def dfp_hist(ano, lucro, fco):
    R = f'{ano}-12-31'
    G = 'DF Consolidado - Demonstração do Resultado'
    dre = [fl(ALFA, R, 1, G, 'ÚLTIMO', f'{ano}-01-01', R, '3.11', 'Lucro/Prejuízo Consolidado do Período', lucro + 50),
           fl(ALFA, R, 1, G, 'ÚLTIMO', f'{ano}-01-01', R, '3.11.01', 'Atribuído a Sócios da Empresa Controladora', lucro),
           fl(ALFA, R, 1, G, 'PENÚLTIMO', f'{ano-1}-01-01', f'{ano-1}-12-31', '3.11.01', 'Atribuído a Sócios da Empresa Controladora', 99999)]  # comparativo: tem que ser ignorado
    dfc = [fl(ALFA, R, 1, 'DF Consolidado - Demonstração do Fluxo de Caixa (Método Indireto)', 'ÚLTIMO', f'{ano}-01-01', R, '6.01', 'Caixa Líquido Atividades Operacionais', fco)]
    main = [[ALFA, R, 1, 'ALFA S.A.', '000001', 'DFP', str(5000 + ano), f'{ano+1}-03-15', f'https://exemplo.cvm/doc?id={5000+ano}']]
    return {f'dfp_cia_aberta_{ano}.csv': csv(CAB_MAIN, main), f'dfp_cia_aberta_DRE_con_{ano}.csv': csv(CAB_FL, dre), f'dfp_cia_aberta_DFC_MI_con_{ano}.csv': csv(CAB_FL, dfc)}

def fca():
    cab = 'CNPJ_Companhia;Nome_Empresarial;Versao;ID_Documento;Valor_Mobiliario;Sigla_Classe_Acao_Preferencial;Classe_Acao_Preferencial;Codigo_Negociacao;Composicao_BDR_Units;Mercado;Sigla_Entidade_Administradora;Entidade_Administradora;Data_Inicio_Negociacao;Data_Fim_Negociacao;Segmento;Data_Inicio_Listagem;Data_Fim_Listagem'.split(';')
    L = lambda cnpj, nome, cod, fim='': [cnpj, nome, 1, 9, 'Ações Ordinárias', '', '', cod, '', 'Bolsa', 'B3', 'B3', '2010-01-01', fim, 'Novo Mercado', '2010-01-01', '']
    linhas = [L(ALFA,'ALFA S.A.','ALFA3'), L(ALFA,'ALFA S.A.','ALFA4'), L(BETA,'BETA S.A.','BETA3'),
              L('33.333.333/0001-33','GAMA ANTIGA','GAMA3','2015-01-01'), L('44.444.444/0001-44','GAMA NOVA','GAMA3'),
              L('55.555.555/0001-55','AMBI A','AMBI3'), L('66.666.666/0001-66','AMBI B','AMBI3')]
    return {'fca_cia_aberta_valor_mobiliario_2026.csv': csv(cab, linhas)}

def fca_2025():
    # FCA do ano anterior: traz DELT3 (que o de 2026 NÃO traz) e o CNPJ ANTIGO da GAMA3, que não pode voltar por cima do novo
    cab = 'CNPJ_Companhia;Nome_Empresarial;Versao;ID_Documento;Valor_Mobiliario;Sigla_Classe_Acao_Preferencial;Classe_Acao_Preferencial;Codigo_Negociacao;Composicao_BDR_Units;Mercado;Sigla_Entidade_Administradora;Entidade_Administradora;Data_Inicio_Negociacao;Data_Fim_Negociacao;Segmento;Data_Inicio_Listagem;Data_Fim_Listagem'.split(';')
    L = lambda cnpj, nome, cod, fim='': [cnpj, nome, 1, 8, 'Ações Ordinárias', '', '', cod, '', 'Bolsa', 'B3', 'B3', '2010-01-01', fim, 'Novo Mercado', '2010-01-01', '']
    linhas = [L('77.777.777/0001-77', 'DELTA S.A.', 'DELT3'), L('33.333.333/0001-33', 'GAMA ANTIGA', 'GAMA3'), L(ALFA, 'ALFA S.A.', 'ALFA3')]
    return {'fca_cia_aberta_valor_mobiliario_2025.csv': csv(cab, linhas)}

def zipar(nome, arquivos):
    with zipfile.ZipFile(os.path.join(AQUI, nome), 'w', zipfile.ZIP_DEFLATED) as z:
        for n, b in arquivos.items(): z.writestr(n, b)

os.makedirs(AQUI, exist_ok=True)
for _a, (_l, _f) in HIST.items(): zipar(f'dfp_cia_aberta_{_a}.zip', dfp_hist(_a, _l, _f))
zipar('dfp_cia_aberta_2025.zip', dfp()); zipar('itr_cia_aberta_2026.zip', itr()); zipar('fca_cia_aberta_2026.zip', fca()); zipar('fca_cia_aberta_2025.zip', fca_2025())
print('fixtures geradas em', AQUI)

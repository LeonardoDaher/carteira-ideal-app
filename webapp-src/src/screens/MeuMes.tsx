import { useEffect, useId, useRef, useState } from 'react'
import { CampoReais } from '../ui/CampoReais'
import {
  CONTAS_SUGERIDAS,
  NOMES_DOS_MESES,
  centavos,
  chaveMes,
  parcelamentoComJuros,
  compraParecidaComConta,
  contasEmDobroComCompras,
  compraEmAndamento,
  ehTotalDoMes,
  aVistaLancadasNoMes,
  totalInformado,
  contasEmDobroComDividas,
  pareceDivida,
  temDividaComParcelaFixa,
  inicioDaAnualNoCartao,
  quandoApareceNoCartao,
  parcelamentoPodeTerComecado,
  vencimentoAnterior,
  anuaisNoCartao,
  anualParcelada,
  comprasDoMes,
  gastoNoTeto,
  jurosDoParcelamento,
  MAX_PARCELAS_ANUAL,
  contasNoCartao,
  gastoNoCartao,
  gerarCopia,
  itensDoMes,
  lerCopia,
  mesPorExtenso,
  mesesDeReserva,
  metaMiniReserva,
  modoRecuperacaoAtivo,
  parcelaNoMes,
  parceladasDesdeOPacto,
  recuperacaoDe,
  parcelasFuturas,
  resumoDoMes,
  semaforoDoCartao,
  somarMeses,
  tetoSugerido,
} from '../domain/orcamento'
import type { Compra, Conta, ItemDoMes, Orcamento, ResumoDoMes, Semaforo, TipoConta } from '../domain/orcamento'
import { reais } from '../domain/mercadoOficial'
import { useOrcamento } from '../state/useOrcamento'
import { VoltarInicio } from '../ui/VoltarInicio'
import { encontrarTrilha, totalDeAulas } from '../data/trilhas'
import { NOME_ARQUIVO_MANUAL_MEU_MES, RESUMO_MANUAL_MEU_MES, TITULO_MANUAL_MEU_MES, URL_MANUAL_MEU_MES } from '../data/manualMeuMes'
import { MinhasDividas, PactoNaoParcelar, PainelRecuperacao, PlanoDeQuitacao, RoteiroNegociacao } from './MeuMesRecuperacao'
import type { AppCtx } from '../state/useAppState'

const TRILHA_SAIR_DAS_DIVIDAS = encontrarTrilha('sair-das-dividas')
const AULAS_SAIR_DAS_DIVIDAS = TRILHA_SAIR_DAS_DIVIDAS ? totalDeAulas(TRILHA_SAIR_DAS_DIVIDAS) : 0

/**
 * Meu Mês (D21, Etapa 1): o papel das contas do mês, no celular. A pessoa cadastra as contas
 * uma vez e, a cada salário, vai ticando. As contas anuais (IPVA, IPTU, seguro) viram
 * cofrinhos mensais. O que sobra vai para os Três Potes de Clara: Guardar, Fazer Crescer e
 * Gastar. Tudo fica no aparelho; nada vai para a API.
 *
 * Etapa 2: cartão de crédito. Etapa 3: Modo Recuperação (dívidas, plano de quitação, pote
 * Quitar, mini-reserva, pacto de não parcelar e roteiro de negociação), em MeuMesRecuperacao.tsx.
 */
export function MeuMes({
  ctx,
  hoje = new Date(),
}: {
  /** Recebido como as demais telas; esta tela tem estado próprio (useOrcamento). O ctx só é
   * usado para abrir a trilha "Sair das dívidas". */
  ctx: AppCtx
  /** Permite fixar a data nos testes. */
  hoje?: Date
}) {
  const est = useOrcamento()
  const [mes, setMes] = useState(() => chaveMes(hoje))
  // "Editar" na lista do mês abre a conta no formulário de Minhas contas (ajuste após a Etapa 4).
  const [pedidoEdicao, setPedidoEdicao] = useState<{ id: string; vez: number } | null>(null)
  const editarConta = (id: string) => setPedidoEdicao((p) => ({ id, vez: (p?.vez ?? 0) + 1 }))

  if (!est.hidratado) return <div className="screen" />

  const { orcamento } = est
  const primeiraVez = orcamento.salario === 0 && orcamento.contas.length === 0
  const recuperacao = modoRecuperacaoAtivo(orcamento)
  const mesDeHoje = chaveMes(hoje)

  return (
    <div className="screen">
      <VoltarInicio />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Meu mês</h1>
        {/* Texto de abertura maior (ajuste de 26/09/2026): em 12px, apagado, passava despercebido. */}
        <div className="muted justify mm-abertura">
          Anote suas contas uma vez. Quando o salário cair, é só ir ticando, e você sabe exatamente quanto sobra para guardar,
          investir e gastar.
        </div>
      </div>

      {primeiraVez ? (
        <Comecar onSalario={est.setSalario} onRestaurar={est.substituir} />
      ) : (
        <div className="desk-split">
          <div className="desk-main">
            <NavegarMes mes={mes} onMudar={setMes} mesDeHoje={mesDeHoje} />
            {recuperacao && <PainelRecuperacao orcamento={orcamento} onDesligar={() => est.setLigadoManual(false)} onAtualizar={est.substituir} />}
            <ContasDoMes orcamento={orcamento} mes={mes} onTicar={est.ticar} onEditar={editarConta} />
            {/* Cadastro das contas logo abaixo da lista do mês, antes do cartão (ajuste após a Etapa 4). */}
            <MinhasContas
              contas={orcamento.contas}
              emDobro={contasEmDobroComDividas(orcamento).map((c) => c.id)}
              emDobroCompras={contasEmDobroComCompras(orcamento, mesDeHoje)}
              compraParecida={(nome, valor) => compraParecidaComConta(orcamento, nome, valor, mesDeHoje)}
              temDividaParcelada={temDividaComParcelaFixa(orcamento)}
              mesDeHoje={mesDeHoje}
              pactoAtivo={!!recuperacaoDe(orcamento).pactoDesde}
              pedidoEdicao={pedidoEdicao}
              onAdicionar={est.adicionarConta}
              onEditar={est.editarConta}
              onRemover={est.removerConta}
            />
            <MinhasDividas
              orcamento={orcamento}
              onAdicionar={est.adicionarDivida}
              onEditar={est.editarDivida}
              onRemover={est.removerDivida}
              onLigar={() => est.setLigadoManual(true)}
            />
            <PlanoDeQuitacao
              orcamento={orcamento}
              mesDeHoje={mesDeHoje}
              onQuitar={(v) => est.setPotes({ quitar: v })}
              onMetodo={est.setMetodo}
            />
            <CartaoDoMes
              orcamento={orcamento}
              mes={mes}
              mesDeHoje={mesDeHoje}
              onTeto={est.setTeto}
              onAdicionar={est.adicionarCompra}
              onEditar={est.editarCompra}
              onAcertarTotal={est.acertarTotal}
              onRemover={est.removerCompra}
              onPacto={est.setPacto}
            />
          </div>
          <div className="desk-side">
            <CaminhoDoSalario resumo={resumoDoMes(orcamento, mes)} mes={mes} onSalario={est.setSalario} />
            <Potes orcamento={orcamento} onPotes={est.setPotes} onReserva={est.setReserva} />
            {(recuperacao || recuperacaoDe(orcamento).dividas.length > 0) && (
              <>
                <RoteiroNegociacao />
                {/* D21, Etapa 4: as aulas curtas que explicam cada regra do Modo Recuperação. */}
                <button className="card-outline col mm-trilha" onClick={() => ctx.abrirTrilha('sair-das-dividas')}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                    <span aria-hidden="true">🎓 </span>Trilha Sair das dívidas
                  </span>
                  <span className="muted small">{AULAS_SAIR_DAS_DIVIDAS} aulas curtas: juros, plano de quitação, pacto de não parcelar e negociação.</span>
                </button>
              </>
            )}
            <LinkManual />
            <CopiaDeSeguranca orcamento={orcamento} hoje={hoje} onRestaurar={est.substituir} onApagar={est.apagarTudo} />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- primeira vez

function Comecar({ onSalario, onRestaurar }: { onSalario: (v: number) => void; onRestaurar: (o: Orcamento) => void }) {
  const [valor, setValor] = useState(0)
  return (
    <>
    <div className="card col" style={{ gap: 12 }}>
      <span style={{ fontWeight: 700 }}>Comece pelo salário</span>
      <span className="muted small justify">
        Quanto cai na sua conta todo mês, já descontados INSS e Imposto de Renda. Se a renda varia, use a de um mês fraco:
        é melhor sobrar do que faltar.
      </span>
      <CampoReais rotulo="Salário líquido" valor={valor} onMudar={setValor} />
      <button className="btn btn-primary" disabled={valor <= 0} onClick={() => onSalario(valor)}>
        Continuar
      </button>
      <span className="tiny muted justify">Seus dados ficam só neste aparelho. Nada é enviado para a internet.</span>
    </div>
    <RestaurarCopiaInicial onRestaurar={onRestaurar} />
    <LinkManual />
    </>
  )
}

/** Link para baixar o Manual de Utilização do Meu Mês (D35). Aparece na primeira tela e na tela completa. */
function LinkManual() {
  return (
    <a
      className="card-outline col mm-trilha"
      href={URL_MANUAL_MEU_MES}
      download={NOME_ARQUIVO_MANUAL_MEU_MES}
      style={{ textDecoration: 'none' }}
    >
      <span style={{ fontWeight: 700, fontSize: 13.5 }}>
        <span aria-hidden="true">📘 </span>
        {TITULO_MANUAL_MEU_MES}
      </span>
      <span className="muted small">{RESUMO_MANUAL_MEU_MES}</span>
    </a>
  )
}

/**
 * Primeira tela (D34): quem trocou de celular ou limpou o navegador já tem uma cópia salva e não
 * precisa digitar um salário de mentira só para chegar ao botão "Restaurar cópia".
 */
function RestaurarCopiaInicial({ onRestaurar }: { onRestaurar: (o: Orcamento) => void }) {
  const [aviso, setAviso] = useState<string | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  async function restaurar(arquivo: File | undefined) {
    if (!arquivo) return
    const lido = lerCopia(await arquivo.text())
    if (arquivoRef.current) arquivoRef.current.value = ''
    if (!lido) {
      setAviso('Este arquivo não é uma cópia do Meu Mês. Nada foi alterado.')
      return
    }
    if (!window.confirm('Restaurar a cópia substitui tudo o que está neste aparelho. Continuar?')) return
    onRestaurar(lido)
  }

  return (
    <div className="card-outline col small" style={{ gap: 10 }}>
      <span style={{ fontWeight: 700 }}>Já usa o Meu Mês em outro aparelho?</span>
      <span className="muted justify">
        Se você salvou uma cópia de segurança, restaure aqui: suas contas, cofrinhos, cartão e dívidas voltam de uma vez.
      </span>
      <button className="btn btn-outline" onClick={() => arquivoRef.current?.click()}>
        Restaurar cópia
      </button>
      <input
        ref={arquivoRef}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="arquivo-copia"
        onChange={(e) => restaurar(e.target.files?.[0])}
      />
      {aviso && (
        <span role="status" className="justify">
          {aviso}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- navegação entre meses

function NavegarMes({ mes, onMudar, mesDeHoje }: { mes: string; onMudar: (m: string) => void; mesDeHoje: string }) {
  return (
    <div className="mm-mes-nav" role="group" aria-label="Mês">
      <button className="icon-btn" aria-label="Mês anterior" onClick={() => onMudar(somarMeses(mes, -1))}>
        ‹
      </button>
      <div className="col" style={{ alignItems: 'center', gap: 2 }}>
        <span className="font-display mm-mes-nome">{mesPorExtenso(mes)}</span>
        {mes !== mesDeHoje && (
          <button className="tiny muted mm-link" onClick={() => onMudar(mesDeHoje)}>
            voltar para o mês atual
          </button>
        )}
      </div>
      <button className="icon-btn" aria-label="Próximo mês" onClick={() => onMudar(somarMeses(mes, 1))}>
        ›
      </button>
    </div>
  )
}

/** "2026-10" → "outubro" */
function nomeDoMes(mes: string) {
  return NOMES_DOS_MESES[Number(mes.slice(5)) - 1]
}

// ---------------------------------------------------------------- checklist

function descricaoItem(item: ItemDoMes, mes: string): string | null {
  if (item.origem === 'fatura') {
    const base = `Compras de ${nomeDoMes(somarMeses(mes, -1))} no cartão.`
    const cobertura = item.cobertura ?? 0
    return cobertura > 0 ? `${base} ${reais(cobertura)} sai do cofrinho das contas do ano, e não do salário.` : base
  }
  if (item.origem === 'divida') {
    const { minimo, extra } = item.divida!
    return extra > 0 ? `Mínima ${reais(minimo)} + ${reais(extra)} do pote Quitar.` : 'Parcela mínima.'
  }
  const { conta } = item
  if (conta.tipo !== 'anual' || !conta.mesVencimento) return null
  const guardado = item.guardadoAntes > 0 ? ` ${reais(item.guardadoAntes)} já no cofrinho.` : ''
  const noCartao = conta.cartaoAnual?.parcelas === 1
  const mesDaFatura = NOMES_DOS_MESES[conta.mesVencimento % 12]
  if (item.venceNesteMes && noCartao)
    return `Vence este mês, no cartão à vista: complete o cofrinho, que paga a fatura de ${mesDaFatura}.${guardado}`
  if (item.venceNesteMes) return `Vence este mês: ${reais(conta.valor)}.${guardado}`
  const sufixo = noCartao ? ' Vai no cartão à vista.' : ''
  return `Cofrinho para ${NOMES_DOS_MESES[conta.mesVencimento - 1]} (${reais(conta.valor)}).${guardado}${sufixo}`
}

function ContasDoMes({
  orcamento,
  mes,
  onTicar,
  onEditar,
}: {
  orcamento: Orcamento
  mes: string
  onTicar: (mes: string, id: string, valor: number) => void
  onEditar: (contaId: string) => void
}) {
  const itens = itensDoMes(orcamento, mes)
  const resumo = resumoDoMes(orcamento, mes)
  const mensais = itens.filter((i) => i.origem === 'conta' && i.conta.tipo === 'mensal')
  const anuais = itens.filter((i) => i.conta.tipo === 'anual')
  const fatura = itens.filter((i) => i.origem === 'fatura')
  const dividas = itens.filter((i) => i.origem === 'divida')
  const pagasNoCartao = contasNoCartao(orcamento, mes).filter((c) => !itens.some((i) => i.conta.id === c.id))
  const anuaisParceladas = orcamento.contas.filter(
    (c) => anualParcelada(c) && mes >= c.cartaoAnual!.desde && !itens.some((i) => i.conta.id === c.id),
  )

  if (itens.length === 0 && pagasNoCartao.length === 0 && anuaisParceladas.length === 0) {
    return (
      <div className="card col" style={{ gap: 6 }}>
        <span style={{ fontWeight: 700 }}>Nenhuma conta ainda</span>
        <span className="muted small justify">
          Cadastre abaixo todas as contas do mês e também as do ano, como IPVA, IPTU e seguro. As anuais viram um cofrinho mensal
          para não pegarem você de surpresa.
        </span>
      </div>
    )
  }

  const tudoPago = resumo.itensTicados === resumo.totalItens
  const progresso = resumo.totalItens > 0 ? (resumo.itensTicados / resumo.totalItens) * 100 : 100
  return (
    <div className="card col" style={{ gap: 12 }}>
      <div className="row-between" style={{ alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 700 }}>Contas do mês</span>
        <span className="small muted" aria-live="polite">
          {resumo.itensTicados} de {resumo.totalItens}
        </span>
      </div>
      <div className="mm-progresso" aria-hidden="true">
        <div style={{ width: `${progresso}%` }} />
      </div>

      {mensais.length > 0 && <ListaDeItens titulo="Todo mês" cor="seg-contas" itens={mensais} mes={mes} onTicar={onTicar} onEditar={onEditar} />}
      {anuais.length > 0 && (
        <ListaDeItens titulo="Cofrinhos das contas do ano" cor="seg-cofrinhos" itens={anuais} mes={mes} onTicar={onTicar} onEditar={onEditar} />
      )}
      {pagasNoCartao.length > 0 && (
        <span className="tiny muted justify">
          {pagasNoCartao.length === 1 ? `${pagasNoCartao[0].nome} é paga` : `${pagasNoCartao.map((c) => c.nome).join(', ')} são pagas`} no cartão:
          {pagasNoCartao.length === 1 ? ' entra' : ' entram'} no gasto do cartão deste mês e na fatura do mês seguinte.
        </span>
      )}
      {anuaisParceladas.map((c) => (
        <span key={c.id} className="tiny muted justify">
          {c.nome} vai parcelada no cartão ({c.cartaoAnual!.parcelas}x de {reais(c.cartaoAnual!.total / c.cartaoAnual!.parcelas)}): sem
          cofrinho, as parcelas entram nas faturas a partir de {NOMES_DOS_MESES[(c.mesVencimento ?? 1) % 12]}.
        </span>
      ))}
      {fatura.length > 0 && <ListaDeItens titulo="Cartão de crédito" cor="seg-cartao" itens={fatura} mes={mes} onTicar={onTicar} />}
      {dividas.length > 0 && <ListaDeItens titulo="Dívidas (plano de quitação)" cor="seg-dividas" itens={dividas} mes={mes} onTicar={onTicar} />}

      <div className="row-between mm-rodape-lista">
        <span className="small">{tudoPago ? 'Tudo pago neste mês.' : 'Ainda falta pagar'}</span>
        {!tudoPago && <span className="font-display" style={{ fontWeight: 700 }}>{reais(resumo.falta)}</span>}
      </div>
    </div>
  )
}

function ListaDeItens({
  titulo,
  cor,
  itens,
  mes,
  onTicar,
  onEditar,
}: {
  titulo: string
  /**
   * Classe da bolinha correspondente em "Para onde vai o salário" (seg-contas, seg-cofrinhos,
   * seg-cartao, seg-dividas): o título do grupo vira uma caixinha nessa cor, no mesmo esquema de
   * "Minhas dívidas" (ajuste de 26/09/2026).
   */
  cor: string
  itens: ItemDoMes[]
  mes: string
  onTicar: (mes: string, id: string, valor: number) => void
  /** Só para as contas cadastradas: fatura e dívidas se editam nos próprios blocos. */
  onEditar?: (contaId: string) => void
}) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className={`mm-titulo-cor mm-titulo-cor-pequeno ${cor}`}>{titulo}</span>
      <ul className="mm-lista">
        {itens.map((item) => {
          const desc = descricaoItem(item, mes)
          return (
            <li key={item.conta.id} className="mm-linha">
              <label className={`mm-item grow ${item.ticado ? 'ticado' : ''}`}>
                <input
                  type="checkbox"
                  className="mm-check"
                  checked={item.ticado}
                  onChange={() => onTicar(mes, item.conta.id, item.valorDoMes)}
                />
                <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="mm-item-nome">{item.conta.nome}</span>
                  {desc && <span className="tiny muted">{desc}</span>}
                </span>
                <span className="mm-item-valor">{reais(item.valorDoMes)}</span>
              </label>
              {onEditar && item.origem === 'conta' && (
                <button className="mm-link small mm-editar" aria-label={`Editar ${item.conta.nome}`} onClick={() => onEditar(item.conta.id)}>
                  Editar
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- caminho do salário

const MENSAGEM_SITUACAO: Record<ResumoDoMes['situacao'], string> = {
  folga: 'As contas e os potes cabem no salário.',
  apertado: 'As contas cabem, mas não sobra o bastante para os potes que você planejou. Diminua Guardar ou Fazer Crescer, ou corte alguma conta.',
  negativo: 'As contas passam do salário. Antes de qualquer pote, é preciso cortar despesas ou aumentar a renda. Não cubra a diferença com cartão ou cheque especial.',
}

/** No Modo Recuperação, o terceiro pote é o Quitar, e o caminho para o mês negativo é negociar. */
const MENSAGEM_SITUACAO_RECUPERACAO: Record<ResumoDoMes['situacao'], string> = {
  folga: 'As contas, as parcelas e os potes cabem no salário.',
  apertado: 'As contas cabem, mas não sobra o bastante para os potes. Diminua o pote Quitar ou o Guardar até o Gastar ficar positivo: um plano que falta dinheiro para comer não dura.',
  negativo: 'As contas e as parcelas mínimas passam do salário. Não cubra a diferença com cartão ou cheque especial: corte despesas e renegocie as dívidas (veja o roteiro de negociação).',
}

function CaminhoDoSalario({ resumo, mes, onSalario }: { resumo: ResumoDoMes; mes: string; onSalario: (v: number) => void }) {
  const r = resumo
  const base = Math.max(r.salario, r.comprometido + r.guardar + r.crescer + r.quitar, 1)
  const segmentos = [
    { classe: 'seg-contas', valor: r.contasMensais },
    { classe: 'seg-cofrinhos', valor: r.cofrinhos },
    { classe: 'seg-cartao', valor: r.fatura },
    { classe: 'seg-dividas', valor: r.dividas },
    { classe: 'pote-guardar', valor: r.guardar },
    { classe: 'pote-crescer', valor: r.crescer },
    { classe: 'pote-quitar', valor: r.quitar },
    { classe: 'pote-gastar', valor: Math.max(0, r.gastar) },
  ]
  const linhas: { rotulo: string; valor: number; classe: string; sinal: string }[] = [
    { rotulo: 'Contas do mês', valor: r.contasMensais, classe: 'seg-contas', sinal: '−' },
    { rotulo: 'Cofrinhos das contas do ano', valor: r.cofrinhos, classe: 'seg-cofrinhos', sinal: '−' },
    ...(r.fatura > 0 ? [{ rotulo: 'Fatura do cartão', valor: r.fatura, classe: 'seg-cartao', sinal: '−' }] : []),
    ...(r.dividas > 0 ? [{ rotulo: 'Parcelas mínimas das dívidas', valor: r.dividas, classe: 'seg-dividas', sinal: '−' }] : []),
    { rotulo: 'Guardar (reserva)', valor: r.guardar, classe: 'pote-guardar', sinal: '−' },
    r.recuperacao
      ? { rotulo: 'Quitar (a mais nas dívidas)', valor: r.quitar, classe: 'pote-quitar', sinal: '−' }
      : { rotulo: 'Fazer Crescer (investir)', valor: r.crescer, classe: 'pote-crescer', sinal: '−' },
  ]
  const mensagens = r.recuperacao ? MENSAGEM_SITUACAO_RECUPERACAO : MENSAGEM_SITUACAO
  return (
    <div className="card col" style={{ gap: 12 }}>
      <span style={{ fontWeight: 700 }}>Para onde vai o salário de {nomeDoMes(mes)}</span>
      <CampoReais rotulo="Salário líquido" valor={r.salario} onMudar={onSalario} />

      <div className="mm-barra" aria-hidden="true">
        {segmentos.map((s) =>
          s.valor > 0 ? <div key={s.classe} className={s.classe} style={{ width: `${(s.valor / base) * 100}%` }} /> : null,
        )}
      </div>

      <div className="col" style={{ gap: 6 }}>
        {linhas.map((l) => (
          <div key={l.rotulo} className="row-between small">
            <span className="row" style={{ gap: 8 }}>
              <span className={`mm-bolinha ${l.classe}`} aria-hidden="true" />
              {l.rotulo}
            </span>
            <span>
              {l.sinal} {reais(l.valor)}
            </span>
          </div>
        ))}
        <div className="row-between mm-total">
          <span className="row" style={{ gap: 8 }}>
            <span className="mm-bolinha pote-gastar" aria-hidden="true" />
            <span style={{ fontWeight: 700 }}>Gastar no dia a dia</span>
          </span>
          <span className={`font-display ${r.gastar < 0 ? 'mm-negativo' : ''}`} style={{ fontWeight: 700 }}>
            {reais(r.gastar)}
          </span>
        </div>
      </div>

      <div className={`small justify mm-situacao mm-situacao-${r.situacao}`} role="status">
        {mensagens[r.situacao]}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- cartão de crédito

function mensagemSemaforo(sem: Semaforo, gasto: number, teto: number, proximoMes: string): string {
  const resta = teto - gasto
  switch (sem) {
    case 'sem-teto':
      return 'Defina um teto para acompanhar o cartão.'
    case 'verde':
      return `Dentro do teto. Ainda cabem ${reais(resta)} este mês.`
    case 'amarelo':
      return resta > 0 ? `Atenção: faltam só ${reais(resta)} para o teto.` : 'Você chegou ao teto. A partir daqui, só no débito ou no dinheiro.'
    case 'vermelho':
      return `Você passou do teto em ${reais(-resta)}. Essa diferença vai apertar o salário de ${proximoMes}: pare de usar o cartão este mês.`
  }
}

function CartaoDoMes({
  orcamento,
  mes,
  mesDeHoje,
  onTeto,
  onAdicionar,
  onEditar,
  onAcertarTotal,
  onRemover,
  onPacto,
}: {
  orcamento: Orcamento
  mes: string
  mesDeHoje: string
  onTeto: (v: number) => void
  onAdicionar: (c: Omit<Compra, 'id'>) => void
  onEditar: (id: string, c: Omit<Compra, 'id'>) => void
  onAcertarTotal: (mes: string, total: number) => void
  onRemover: (id: string) => void
  onPacto: (mes: string | null) => void
}) {
  const { teto } = orcamento.cartao
  // O teto e o semáforo olham tudo o que vai sair do salário na fatura: compras, parcelas, contas
  // mensais e as parcelas das contas do ano. Só o que o cofrinho já guardou fica fora (ajuste de
  // 26/09/2026: antes, a conta do ano parcelada não aparecia no teto).
  const gasto = gastoNoTeto(orcamento, mes)
  const anuais = anuaisNoCartao(orcamento, mes)
  const doCofrinho = centavos(gastoNoCartao(orcamento, mes) - gasto)
  const sem = semaforoDoCartao(gasto, teto)
  const compras = comprasDoMes(orcamento, mes)
  const contasCartao = contasNoCartao(orcamento, mes)
  const futuras = parcelasFuturas(orcamento, mes)
  const sugerido = tetoSugerido(orcamento)
  const proximoMes = nomeDoMes(somarMeses(mes, 1))

  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState(0)
  // Forma de pagamento (ajuste de 26/09/2026): à vista, parcelado sem juros (o app divide o valor)
  // ou parcelado com juros (a pessoa informa o valor de cada parcela).
  const [forma, setForma] = useState<FormaDaCompra>('avista')
  const [nParcelas, setNParcelas] = useState(2)
  const [valorParcela, setValorParcela] = useState(0)
  const [versaoForm, setVersaoForm] = useState(0)
  // Pacto de não parcelar (Etapa 3): parcelar exige um passo a mais, confirmado na hora.
  const [quebrandoPacto, setQuebrandoPacto] = useState(false)
  // Edição de compra (ajuste de 26/09/2026), no mesmo padrão de Minhas contas.
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const descricaoRef = useRef<HTMLInputElement>(null)
  const idDescricao = useId()
  const idParcelas = useId()
  const recuperacao = modoRecuperacaoAtivo(orcamento)
  const { pactoDesde } = recuperacaoDe(orcamento)
  const compraEditada = editandoId ? orcamento.cartao.compras.find((c) => c.id === editandoId) : undefined
  // Corrigir uma compra que já era parcelada não é parcelar de novo: o pacto não trava a edição dela.
  const parcelamentoLiberado = !pactoDesde || quebrandoPacto || (compraEditada?.parcelas ?? 1) > 1
  // A compra editada continua no mês em que foi feita; as parcelas seguem a partir dele.
  const mesDaCompra = compraEditada?.mes ?? mes
  const formaEfetiva: FormaDaCompra = parcelamentoLiberado ? forma : 'avista'
  const parcelas = formaEfetiva === 'avista' ? 1 : nParcelas
  const juros = parcelamentoComJuros(valor, valorParcela, nParcelas)
  const comJuros = formaEfetiva === 'comJuros'
  const valido =
    descricao.trim().length > 0 && valor > 0 && (!comJuros || (valorParcela > 0 && !juros.abaixo))
  // Total que vai para o cartão: com juros, parcela × vezes; senão, o valor da compra.
  const totalDaCompra = comJuros ? Math.max(juros.total, valor) : valor
  const parcelaPrevista =
    parcelas > 1 ? parcelaNoMes({ id: '', descricao, valor: totalDaCompra, mes: mesDaCompra, parcelas }, mesDaCompra) : 0

  function limpar() {
    setDescricao('')
    setValor(0)
    setForma('avista')
    setNParcelas(2)
    setValorParcela(0)
    setQuebrandoPacto(false)
    setEditandoId(null)
    setVersaoForm((v) => v + 1)
  }

  // Lançamento pelo total (ajuste de 26/09/2026).
  const totalDoMes = totalInformado(orcamento, mes)
  const [totalAberto, setTotalAberto] = useState(false)
  const mesPassado = somarMeses(mes, -1)
  const totalMesPassado = totalInformado(orcamento, mesPassado)
  const [comecandoAberto, setComecandoAberto] = useState(false)
  const totalRef = useRef<HTMLDivElement>(null)

  function lancar() {
    if (!valido) return
    const dados: Omit<Compra, 'id'> = { descricao: descricao.trim(), valor: totalDaCompra, mes: mesDaCompra, parcelas }
    if (comJuros && totalDaCompra > valor) dados.valorAVista = valor
    if (compraEditada) onEditar(compraEditada.id, dados)
    else onAdicionar(dados)
    // Com as compras à vista lançadas de uma vez, uma compra à vista anotada depois já faz parte
    // desse total: sai do lançamento de uma vez, e o total continua o mesmo (ou cresce, se passar
    // dele). Compra parcelada não mexe no total à vista.
    if (totalDoMes != null) onAcertarTotal(mes, totalDoMes)
    limpar()
  }

  function abrirTotal() {
    setTotalAberto(true)
    totalRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  /** Abre a compra no formulário e leva a pessoa até ele (o formulário fica abaixo da lista). */
  function abrirParaEditar(compra: Compra) {
    setDescricao(compra.descricao)
    const comJurosGravado = compra.parcelas > 1 && compra.valorAVista != null && compra.valorAVista < compra.valor
    setValor(comJurosGravado ? compra.valorAVista! : compra.valor)
    setForma(compra.parcelas <= 1 ? 'avista' : comJurosGravado ? 'comJuros' : 'semJuros')
    setNParcelas(compra.parcelas > 1 ? compra.parcelas : 2)
    setValorParcela(comJurosGravado ? centavos(compra.valor / compra.parcelas) : 0)
    setQuebrandoPacto(false)
    setEditandoId(compra.id)
    setVersaoForm((v) => v + 1)
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    descricaoRef.current?.focus({ preventScroll: true })
  }

  function quebrarPacto() {
    const aviso =
      'Parcelar quebra o seu pacto de não parcelar: é dívida nova com o salário dos próximos meses. ' +
      'Se não cabe à vista, a regra do pacto é não comprar agora. Parcelar mesmo assim?'
    if (window.confirm(aviso)) setQuebrandoPacto(true)
  }

  const uso = teto > 0 ? Math.min(gasto / teto, 1) : 0

  return (
    <div className="card col" style={{ gap: 12 }}>
      <span className="mm-titulo-cor seg-cartao">Cartão de crédito</span>

      {teto > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <div className="row-between small">
            <span className="muted">Gasto em {nomeDoMes(mes)}</span>
            <span style={{ fontWeight: 600 }}>
              {reais(gasto)} <span className="muted">de {reais(teto)}</span>
            </span>
          </div>
          <div className={`mm-semaforo mm-semaforo-${sem}`} aria-hidden="true">
            <div style={{ width: `${uso * 100}%` }} />
          </div>
        </div>
      )}
      {doCofrinho > 0 && (
        <div className="small muted">
          + {reais(doCofrinho)} de contas do ano pagos pelo cofrinho, fora do teto. Total na fatura de {proximoMes}:{' '}
          {reais(gastoNoCartao(orcamento, mes))}.
        </div>
      )}
      <div className={`small justify mm-situacao mm-cartao-${sem}`} role="status">
        {mensagemSemaforo(sem, gasto, teto, proximoMes)}
      </div>

      <CampoReais
        rotulo="Seu teto por mês"
        valor={teto}
        onMudar={onTeto}
        dica="Não é o limite do banco: é quanto você decide gastar. O cartão é pago com o salário do mês seguinte."
      />
      {/* Só sugere quando ainda não há teto ou quando o teto passa do que cabe: um teto mais
          prudente que o sugerido é uma boa escolha e não merece aviso. */}
      {sugerido != null && (teto === 0 || teto > sugerido) && (
        <div className="small justify">
          {teto > sugerido
            ? `Esse teto passa do que sobra no seu mês. O que cabe é até ${reais(sugerido)}.`
            : `Pelo seu orçamento, cabem até ${reais(sugerido)} por mês.`}{' '}
          <button className="mm-link" onClick={() => onTeto(sugerido)}>
            Usar {reais(sugerido)}
          </button>
        </div>
      )}

      {(compras.length > 0 || contasCartao.length > 0 || anuais.length > 0) && (
        <div className="col" style={{ gap: 2 }}>
          <span className="tiny muted" style={{ fontWeight: 600 }}>
            No cartão em {nomeDoMes(mes)} (fatura de {proximoMes})
          </span>
          <ul className="mm-lista">
            {/* Contas pagas no cartão (ajuste após a Etapa 4): editadas em Minhas contas. */}
            {anuais.map((a) => (
              <li key={`anual-${a.conta.id}`} className="mm-conta">
                <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="mm-item-nome">{a.conta.nome}</span>
                  <span className="tiny muted">
                    {a.conta.cartaoAnual!.parcelas > 1
                      ? `Conta do ano, parcela ${a.parcela} de ${a.conta.cartaoAnual!.parcelas} (total ${reais(a.conta.cartaoAnual!.total)})`
                      : 'Conta do ano, à vista: o cofrinho paga esta parte da fatura'}
                  </span>
                </span>
                <span className="mm-item-valor">{reais(a.valor)}</span>
              </li>
            ))}
            {contasCartao.map((c) => (
              <li key={`conta-${c.id}`} className="mm-conta">
                <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="mm-item-nome">{c.nome}</span>
                  <span className="tiny muted">Conta de todo mês</span>
                </span>
                <span className="mm-item-valor">{reais(c.valor)}</span>
              </li>
            ))}
            {compras.map(({ compra, parcela, valor: v }) => (
              <li key={compra.id} className="mm-conta">
                <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="mm-item-nome">{compra.descricao}</span>
                  <span className="tiny muted">
                    {ehTotalDoMes(compra)
                      ? totalDoMes != null && totalDoMes > compra.valor
                        ? `À vista, lançadas de uma vez (total à vista do mês: ${reais(totalDoMes)})`
                        : 'À vista, lançadas de uma vez'
                      : compra.parcelas > 1
                        ? `Parcela ${parcela} de ${compra.parcelas} (total ${reais(compra.valor)}${compra.valorAVista != null ? ', com juros' : ''})`
                        : 'À vista'}
                  </span>
                </span>
                <span className="mm-item-valor">{reais(v)}</span>
                <button
                  className="mm-link small"
                  aria-label={`Editar ${compra.descricao}`}
                  onClick={() => (ehTotalDoMes(compra) ? abrirTotal() : abrirParaEditar(compra))}
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(recuperacao || pactoDesde) && (
        <PactoNaoParcelar
          pactoDesde={pactoDesde}
          parceladas={parceladasDesdeOPacto(orcamento).length}
          mesDeHoje={mesDeHoje}
          onPacto={(m) => {
            setQuebrandoPacto(false)
            setForma('avista')
            onPacto(m)
          }}
        />
      )}

      <div ref={totalRef}>
        <Caixa
          titulo={`Compras à vista de ${nomeDoMes(mes)}, de uma vez`}
          resumo={totalDoMes != null ? `${reais(totalDoMes)} lançados à vista neste mês.` : 'Para não anotar uma por uma.'}
          aberto={totalAberto}
          onAbrir={setTotalAberto}
        >
          <TotalDoMes
            key={`${mes}-${totalDoMes ?? 'sem'}`}
            mes={mes}
            totalAtual={totalDoMes}
            jaLancado={aVistaLancadasNoMes(orcamento, mes)}
            recuperacao={recuperacao}
            onAcertar={(t) => {
              onAcertarTotal(mes, t)
              setTotalAberto(false)
            }}
            onFechar={() => setTotalAberto(false)}
          />
        </Caixa>
      </div>

      {/* Começando agora no app (ajuste de 26/09/2026): a fatura que se paga agora traz o que
          passou no cartão no mês passado, que ainda não está no app. Fica sempre no mês atual,
          fechada, com uma linha dizendo para que serve. */}
      {mes === mesDeHoje && (
        <Caixa
          titulo="Começando agora no app?"
          resumo={`Traga o que vem na fatura de ${nomeDoMes(mes)}: compras à vista de ${nomeDoMes(mesPassado)} e parcelamentos que você já estava pagando.`}
          aberto={comecandoAberto}
          onAbrir={setComecandoAberto}
        >
          <span className="small muted justify">
            A fatura de {nomeDoMes(mes)} traz o que passou no cartão em {nomeDoMes(mesPassado)}. Parcelas de contas do ano (IPVA,
            seguro) vêm de Minhas contas: lá, marque "Sim, já estou pagando". Contas de todo mês no cartão entram a partir do mês
            do cadastro: some a de {nomeDoMes(mesPassado)} no total à vista abaixo.
          </span>
          <div className="mm-caixa-secao">
            <span className="small" style={{ fontWeight: 700 }}>
              1. Compras à vista de {nomeDoMes(mesPassado)}
              {totalMesPassado != null && <span className="muted" style={{ fontWeight: 400 }}> · {reais(totalMesPassado)} lançados</span>}
            </span>
            <TotalDoMes
              key={`${mesPassado}-${totalMesPassado ?? 'sem'}`}
              mes={mesPassado}
              totalAtual={totalMesPassado}
              jaLancado={aVistaLancadasNoMes(orcamento, mesPassado)}
              recuperacao={false}
              contexto={`Elas entram na fatura de ${nomeDoMes(mes)}, que você paga agora, e aparecem em Contas do mês.`}
              onAcertar={(t) => onAcertarTotal(mesPassado, t)}
              onFechar={() => setComecandoAberto(false)}
            />
          </div>
          <div className="mm-caixa-secao">
            <span className="small" style={{ fontWeight: 700 }}>2. Parcelamentos que você já estava pagando</span>
            <ParcelamentoEmAndamento
              mesDeHoje={mes}
              onLancar={onAdicionar}
            />
          </div>
        </Caixa>
      )}

      <div className="col mm-form" style={{ gap: 10 }} ref={formRef}>
        <span className="small" style={{ fontWeight: 700 }}>
          {compraEditada ? `Editar compra: ${compraEditada.descricao}` : `Lançar compra em ${nomeDoMes(mes)}`}
        </span>
        {compraEditada && compraEditada.mes !== mes && (
          <span className="tiny muted justify">
            Compra feita em {mesPorExtenso(compraEditada.mes)}: continua nesse mês, e as parcelas seguem a partir dele.
          </span>
        )}
        <label htmlFor={idDescricao} className="small" style={{ fontWeight: 600 }}>
          O que foi
        </label>
        <input
          id={idDescricao}
          ref={descricaoRef}
          className="input-cotas"
          value={descricao}
          maxLength={40}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <CampoReais
          key={versaoForm}
          rotulo="Valor da compra"
          valor={valor}
          onMudar={setValor}
          dica={comJuros ? 'O preço à vista, sem os juros.' : undefined}
        />
        <div className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>Forma de pagamento</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Forma de pagamento">
            {FORMAS_DA_COMPRA.filter((f) => parcelamentoLiberado || f.id === 'avista').map((f) => (
              <button
                key={f.id}
                className={`chip ${formaEfetiva === f.id ? 'selected' : ''}`}
                aria-pressed={formaEfetiva === f.id}
                onClick={() => setForma(f.id)}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>
        {!parcelamentoLiberado && (
          <div className="tiny muted justify">
            Pelo seu pacto, só à vista.{' '}
            <button className="mm-link tiny" onClick={quebrarPacto}>
              Quebrar o pacto nesta compra
            </button>
          </div>
        )}
        {formaEfetiva !== 'avista' && (
          <label htmlFor={idParcelas} className="col" style={{ gap: 4 }}>
            <span className="small" style={{ fontWeight: 600 }}>Número de parcelas</span>
            <select id={idParcelas} className="input-cotas" value={nParcelas} onChange={(e) => setNParcelas(Number(e.target.value))}>
              {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </label>
        )}
        {comJuros && (
          <>
            <CampoReais
              key={`parcela-${versaoForm}`}
              rotulo="Valor de cada parcela"
              valor={valorParcela}
              onMudar={setValorParcela}
              dica="Está na maquininha, no site ou na simulação do cartão, já com os juros."
            />
            {valorParcela > 0 && (
              <div className="small" role="status" style={{ fontWeight: 600 }}>
                {nParcelas}x de {reais(valorParcela)} = {reais(juros.total)} no total
              </div>
            )}
            {valor > 0 && valorParcela > 0 &&
              (juros.abaixo ? (
                <div className="small justify mm-situacao mm-cartao-vermelho" role="alert">
                  {reais(juros.total)} no total é menos que o preço da compra ({reais(valor)}). Confira: aqui vai o valor de cada
                  parcela, e em "Valor da compra", o preço à vista.
                </div>
              ) : juros.semJuros ? (
                <div className="small justify mm-situacao mm-cartao-amarelo" role="status">
                  O total é igual ao preço: é parcelado sem juros. Pode escolher "Parcelado sem juros" acima.
                </div>
              ) : (
                <div className="small justify mm-situacao mm-cartao-amarelo" role="status">
                  Você paga {reais(juros.aMais)} a mais ({juros.percentual.toLocaleString('pt-BR')}% sobre o preço)
                  {juros.aoMes != null ? `, cerca de ${juros.aoMes.toLocaleString('pt-BR')}% ao mês` : ''}.
                  {juros.aoMes != null && juros.aoMes >= 3 && ' É juro de dívida cara, acima de 3% ao mês.'}
                  {recuperacao && ' No Modo Recuperação, é dívida nova com juros enquanto você ainda paga as caras: se der, junte e compre à vista.'}
                </div>
              ))}
          </>
        )}
        {formaEfetiva !== 'avista' && valor > 0 && (!comJuros || valorParcela > 0) && (
          <span className="small justify mm-alerta-parcela" role="note">
            {quebrandoPacto ? 'Esta compra quebra o seu pacto. ' : recuperacao && !comJuros ? 'No Modo Recuperação, parcelar é fazer dívida nova. ' : ''}
            Parcelar compromete os próximos {parcelas - 1} {parcelas === 2 ? 'mês' : 'meses'}: cerca de {reais(parcelaPrevista)} por
            mês até {mesPorExtenso(somarMeses(mesDaCompra, parcelas - 1))}, somados a tudo o que você comprar depois.
          </span>
        )}
        <button className="btn btn-primary" disabled={!valido} onClick={lancar}>
          {compraEditada ? 'Salvar alterações' : 'Lançar compra'}
        </button>
        {compraEditada && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-outline" onClick={limpar}>
              Cancelar
            </button>
            <button
              className="btn btn-outline mm-perigo"
              onClick={() => {
                const aviso =
                  compraEditada.parcelas > 1
                    ? `Remover "${compraEditada.descricao}" e todas as ${compraEditada.parcelas} parcelas?`
                    : `Remover "${compraEditada.descricao}"?`
                if (window.confirm(aviso)) {
                  onRemover(compraEditada.id)
                  limpar()
                }
              }}
            >
              Remover
            </button>
          </div>
        )}
      </div>

      <AvisoContaEmDobroComCompra pares={contasEmDobroComCompras(orcamento, mesDeHoje)} />

      {futuras.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <span className="tiny muted" style={{ fontWeight: 600 }}>
            Parcelas que você já assumiu
          </span>
          {futuras.map((f) => (
            <div key={f.mes} className="row-between small">
              <span>{mesPorExtenso(f.mes)}</span>
              <span>{reais(f.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Caixa simples que abre e fecha (ajuste de 26/09/2026). */
function Caixa({
  titulo,
  resumo,
  aberto,
  onAbrir,
  children,
}: {
  titulo: string
  /** Linha curta mostrada com a caixa fechada (ex.: o total já lançado). */
  resumo?: string
  aberto: boolean
  onAbrir: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className="mm-caixa">
      <button className="mm-caixa-titulo" aria-expanded={aberto} onClick={() => onAbrir(!aberto)}>
        <span>{titulo}</span>
        <span aria-hidden="true">{aberto ? '−' : '+'}</span>
      </button>
      {!aberto && resumo && <span className="small muted">{resumo}</span>}
      {aberto && children}
    </div>
  )
}

/**
 * Compras à vista de um mês lançadas de uma vez (ajuste de 26/09/2026). Parceladas e contas no
 * cartão não entram aqui: são lançadas em separado. As compras à vista já anotadas uma a uma fazem
 * parte do total e são descontadas.
 */
function TotalDoMes({
  mes,
  totalAtual,
  jaLancado,
  recuperacao,
  contexto,
  onAcertar,
  onFechar,
}: {
  mes: string
  totalAtual: number | null
  /** Compras à vista do mês já lançadas uma a uma. */
  jaLancado: number
  recuperacao: boolean
  /** Frase extra no topo (ex.: em que fatura essas compras entram). */
  contexto?: string
  onAcertar: (total: number) => void
  onFechar: () => void
}) {
  const [total, setTotal] = useState(totalAtual ?? 0)
  const diferenca = centavos(total - jaLancado)
  const abaixo = total > 0 && diferenca < 0
  return (
    <div className="col" style={{ gap: 10 }}>
      <span className="small muted justify">
        {contexto && `${contexto} `}Some tudo o que você comprou à vista no cartão em {nomeDoMes(mes)} e digite aqui, sem anotar
        uma por uma.
        {jaLancado > 0 && ` As compras à vista que você já anotou (${reais(jaLancado)}) fazem parte desse total e são descontadas.`}
      </span>
      <span className="small justify mm-alerta-parcela" role="note">
        Parcelado fica de fora: compra parcelada, lance em "Lançar compra", com o número de vezes; conta do ano ou de todo mês no
        cartão, em Minhas contas. Assim os próximos meses já contam as parcelas.
      </span>
      <CampoReais rotulo={`Total à vista no cartão em ${nomeDoMes(mes)}`} valor={total} onMudar={setTotal} />
      {abaixo ? (
        <div className="small justify mm-situacao mm-cartao-vermelho" role="alert">
          {reais(total)} é menos do que as compras à vista que você já anotou em {nomeDoMes(mes)} ({reais(jaLancado)}). Confira o
          total, ou edite as compras anotadas.
        </div>
      ) : (
        total > 0 &&
        jaLancado > 0 && (
          <div className="small" role="status" style={{ fontWeight: 600 }}>
            {diferenca > 0 ? `${reais(diferenca)} entram como compras à vista do mês.` : 'Tudo já está anotado: nada a acrescentar.'}
          </div>
        )
      )}
      {recuperacao && (
        <span className="tiny muted justify">No Modo Recuperação, anotar compra por compra ajuda a frear antes de chegar ao teto.</span>
      )}
      <button className="btn btn-primary" disabled={total <= 0 || abaixo} onClick={() => onAcertar(total)}>
        {totalAtual != null ? 'Atualizar total à vista' : 'Lançar total à vista'}
      </button>
      {totalAtual != null ? (
        <button
          className="btn btn-outline"
          onClick={() => {
            if (window.confirm(`Tirar o total à vista de ${nomeDoMes(mes)} e voltar a anotar compra por compra? As compras anotadas continuam.`)) {
              onAcertar(0)
              onFechar()
            }
          }}
        >
          Voltar a anotar uma por uma
        </button>
      ) : (
        <button className="btn btn-outline" onClick={onFechar}>
          Cancelar
        </button>
      )}
    </div>
  )
}

/**
 * Parcelamento no cartão que a pessoa já estava pagando ao chegar no app (ajuste de 26/09/2026).
 * Ela informa o que vê na fatura deste mês ("parcela 4 de 10"), e o app calcula sozinho o mês da
 * compra: as parcelas que faltam caem nos meses certos.
 */
function ParcelamentoEmAndamento({
  mesDeHoje,
  onLancar,
}: {
  mesDeHoje: string
  onLancar: (c: Omit<Compra, 'id'>) => void
}) {
  const [descricao, setDescricao] = useState('')
  const [valorParcela, setValorParcela] = useState(0)
  const [parcelas, setParcelas] = useState(10)
  const [atual, setAtual] = useState(1)
  const [versao, setVersao] = useState(0)
  const [ultimo, setUltimo] = useState<string | null>(null)
  const idDescricao = useId()
  const idParcelas = useId()
  const idAtual = useId()
  const atualValida = Math.min(atual, parcelas)
  const valido = descricao.trim().length > 0 && valorParcela > 0
  const compra = compraEmAndamento(descricao.trim(), valorParcela, parcelas, atualValida, mesDeHoje)
  const fatura = nomeDoMes(mesDeHoje)
  const ultimaFatura = mesPorExtenso(somarMeses(mesDeHoje, parcelas - atualValida))

  function lancar() {
    if (!valido) return
    onLancar(compra)
    setUltimo(`"${compra.descricao}" lançado: parcela ${atualValida} de ${parcelas} na fatura de ${fatura}.`)
    setDescricao('')
    setValorParcela(0)
    setParcelas(10)
    setAtual(1)
    setVersao((v) => v + 1)
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <span className="small muted justify">
        Olhe a fatura de {fatura}: cada compra parcelada aparece como "04/10", por exemplo. Lance uma por vez, e as parcelas que
        faltam entram sozinhas nos próximos meses.
      </span>
      <label htmlFor={idDescricao} className="small" style={{ fontWeight: 600 }}>
        Compra parcelada
      </label>
      <input
        id={idDescricao}
        className="input-cotas"
        value={descricao}
        maxLength={40}
        placeholder="Ex.: Geladeira"
        onChange={(e) => setDescricao(e.target.value)}
      />
      <CampoReais key={`parcela-andamento-${versao}`} rotulo="Valor de cada parcela" valor={valorParcela} onMudar={setValorParcela} />
      <div className="row" style={{ gap: 8 }}>
        <label htmlFor={idAtual} className="col grow" style={{ gap: 4 }}>
          <span className="small" style={{ fontWeight: 600 }}>Parcela na fatura de {fatura}</span>
          <select id={idAtual} className="input-cotas" value={atualValida} onChange={(e) => setAtual(Number(e.target.value))}>
            {Array.from({ length: parcelas }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={idParcelas} className="col grow" style={{ gap: 4 }}>
          <span className="small" style={{ fontWeight: 600 }}>De quantas</span>
          <select id={idParcelas} className="input-cotas" value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
            {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {valorParcela > 0 && (
        <div className="small justify mm-situacao" role="note">
          Parcela {atualValida} de {parcelas} na fatura de {fatura}
          {atualValida < parcelas ? `; a última vem na fatura de ${ultimaFatura}` : ', a última'}. Compra de{' '}
          {mesPorExtenso(compra.mes)}, total de {reais(compra.valor)}.
        </div>
      )}
      <button className="btn btn-primary" disabled={!valido} onClick={lancar}>
        Lançar parcelamento
      </button>
      {ultimo && (
        <span className="small" role="status" style={{ fontWeight: 600 }}>
          {ultimo} Pode lançar o próximo.
        </span>
      )}
    </div>
  )
}

/**
 * Aviso de conta em dobro com uma compra parcelada no cartão (ajuste de 26/09/2026). Aparece em
 * Minhas contas e no cartão, para ser visto de qualquer um dos lados.
 */
function AvisoContaEmDobroComCompra({ pares }: { pares: { conta: Conta; compra: Compra }[] }) {
  if (pares.length === 0) return null
  return (
    <div className="small justify mm-situacao mm-cartao-amarelo" role="status">
      {pares.map(({ conta, compra }) => (
        <p key={conta.id} style={{ margin: 0 }}>
          "{conta.nome}" ({reais(conta.valor)} todo mês no cartão, em Minhas contas) parece a parcela da compra "{compra.descricao}"
          ({compra.parcelas}x de {reais(parcelaNoMes(compra, compra.mes))}) lançada no cartão.
        </p>
      ))}
      <p style={{ margin: '6px 0 0' }}>
        A parcela já entra na fatura. Se for a mesma coisa, remova de Minhas contas (Editar e depois Remover): senão ela conta duas
        vezes e continua sendo cobrada depois da última parcela.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- potes e reserva

function Potes({
  orcamento,
  onPotes,
  onReserva,
}: {
  orcamento: Orcamento
  onPotes: (p: Partial<Orcamento['potes']>) => void
  onReserva: (v: number) => void
}) {
  const meses = mesesDeReserva(orcamento)
  const recuperacao = modoRecuperacaoAtivo(orcamento)
  let leitura: string | null = null
  if (recuperacao) {
    // No Modo Recuperação, a régua é a mini-reserva, e não os 3 meses.
    const meta = metaMiniReserva(orcamento)
    leitura =
      orcamento.reserva < meta
        ? `Primeira fase do Modo Recuperação: mini-reserva de ${reais(meta)}. Faltam ${reais(meta - orcamento.reserva)}. Priorize o pote Guardar até chegar lá.`
        : `Mini-reserva pronta (${reais(meta)}). Agora o foco é o pote Quitar; o Guardar pode ficar pequeno até as dívidas caras acabarem.`
  } else if (meses != null && orcamento.reserva > 0) {
    leitura =
      meses < 3
        ? `Sua reserva paga ${meses.toLocaleString('pt-BR')} ${meses === 1 ? 'mês' : 'meses'} de contas. O primeiro objetivo é chegar a 3 meses: enquanto isso, priorize o pote Guardar.`
        : `Sua reserva paga ${meses.toLocaleString('pt-BR')} meses de contas. Com 3 meses ou mais, o pote Fazer Crescer pode ganhar espaço.`
  } else if (meses != null) {
    leitura = 'Sem reserva, qualquer imprevisto vira dívida. Comece pelo pote Guardar, mesmo que com pouco.'
  }

  return (
    <div className="card col" style={{ gap: 12 }}>
      <span style={{ fontWeight: 700 }}>Os potes do mês</span>
      <span className="muted small justify">
        Separe primeiro, gaste depois. O que você puser em Guardar e {recuperacao ? 'Quitar' : 'Fazer Crescer'} sai do salário junto com as
        contas; o que sobrar é o pote Gastar.
      </span>
      <CampoReais rotulo="🔵 Guardar, para a reserva de emergência" valor={orcamento.potes.guardar} onMudar={(v) => onPotes({ guardar: v })} />
      {recuperacao ? (
        <div className="small justify mm-pausado" role="note">
          🟡 Fazer Crescer está pausado no Modo Recuperação
          {orcamento.potes.crescer > 0 ? ` (os ${reais(orcamento.potes.crescer)} planejados voltam quando as dívidas caras acabarem)` : ''}.
          No lugar dele entra o 🔴 pote Quitar, que você ajusta no Plano de quitação.
        </div>
      ) : (
        <CampoReais rotulo="🟡 Fazer Crescer, para investir" valor={orcamento.potes.crescer} onMudar={(v) => onPotes({ crescer: v })} />
      )}
      <CampoReais rotulo="Quanto você já tem de reserva hoje" valor={orcamento.reserva} onMudar={onReserva} />
      {leitura && <span className="small justify">{leitura}</span>}
    </div>
  )
}

// ---------------------------------------------------------------- cadastro de contas

type PagamentoAnual = 'boleto' | 'avista' | 'parcelado'
type Rascunho = {
  nome: string
  valor: number
  tipo: TipoConta
  mesVencimento: number
  /** Conta mensal paga no cartão. */
  noCartao: boolean
  /** Conta anual: boleto/Pix, cartão à vista ou cartão parcelado (ajuste após a Etapa 4). */
  pagamentoAnual: PagamentoAnual
  parcelas: number
  /**
   * Valor de cada parcela no cartão, com juros e taxas (parcelado). 0 = ainda não informado.
   * Ajuste de 26/09/2026: antes o campo pedia o total, e a pessoa digitava a parcela (120 virava
   * 12x de 10). O total gravado é parcela × vezes.
   */
  parcelaCartao: number
  /**
   * Conta do ano no cartão cujo último vencimento já passou: a pessoa já está pagando esse
   * parcelamento (true) ou ele começa no próximo vencimento (false, o padrão). Ajuste de 26/09/2026.
   */
  jaComecou: boolean
}
const RASCUNHO_VAZIO: Rascunho = {
  nome: '',
  valor: 0,
  tipo: 'mensal',
  mesVencimento: 1,
  noCartao: false,
  pagamentoAnual: 'boleto',
  parcelas: 10,
  parcelaCartao: 0,
  jaComecou: false,
}

const ROTULO_PAGAMENTO_ANUAL: Record<PagamentoAnual, string> = {
  boleto: 'Boleto ou Pix',
  avista: 'Cartão à vista',
  parcelado: 'Cartão parcelado',
}

function rascunhoDaConta(c: Conta): Rascunho {
  const ca = c.cartaoAnual
  return {
    ...RASCUNHO_VAZIO,
    nome: c.nome,
    valor: c.valor,
    tipo: c.tipo,
    mesVencimento: c.mesVencimento ?? 1,
    noCartao: !!c.cartaoDesde,
    pagamentoAnual: !ca ? 'boleto' : ca.parcelas > 1 ? 'parcelado' : 'avista',
    parcelas: ca && ca.parcelas > 1 ? ca.parcelas : 10,
    parcelaCartao: ca && ca.parcelas > 1 ? centavos(ca.total / ca.parcelas) : 0,
    // Já começou quando o início gravado é um vencimento (e não o mês do cadastro).
    jaComecou: !!ca && vencimentoAnterior(c, ca.desde) === ca.desde,
  }
}

/** Texto do custo do parcelamento: quanto a mais, em % do valor e ao mês. */
function custoDoParcelamento(valor: number, total: number, parcelas: number): string {
  if (total <= valor) {
    // Ajuste de 26/09/2026: seguro e matrícula costumam sair em 10x ou 12x sem juros de verdade; a
    // mensagem confirma e lembra do desconto à vista, que é o custo escondido do sem juros.
    return (
      `Sem juros: ${parcelas}x de ${reais(centavos(total / parcelas))}, o mesmo valor da conta, só dividido. ` +
      'Pergunte se há desconto para pagar à vista: se houver, o parcelado sem juros sai mais caro. ' +
      'Em imposto (IPVA, IPTU) no cartão, confira também a taxa de serviço, que costuma vir embutida.'
    )
  }
  const aMais = total - valor
  const pct = Math.round((aMais / valor) * 1000) / 10
  const aoMes = jurosDoParcelamento(valor, total, parcelas)
  return (
    `Parcelando em ${parcelas}x, você paga ${reais(aMais)} a mais (${pct.toLocaleString('pt-BR')}% sobre o valor)` +
    (aoMes ? `, cerca de ${aoMes.toLocaleString('pt-BR')}% ao mês.` : '.')
  )
}
const menorMes = (a: string, b: string) => (a < b ? a : b)

/** Formas de pagamento de uma compra no cartão (ajuste de 26/09/2026). */
type FormaDaCompra = 'avista' | 'semJuros' | 'comJuros'
const FORMAS_DA_COMPRA: { id: FormaDaCompra; rotulo: string }[] = [
  { id: 'avista', rotulo: 'À vista' },
  { id: 'semJuros', rotulo: 'Parcelado sem juros' },
  { id: 'comJuros', rotulo: 'Parcelado com juros' },
]

/** Quantas sugestões aparecem antes de "Ver mais sugestões". */
const SUGESTOES_VISIVEIS = 6

function MinhasContas({
  contas,
  emDobro,
  emDobroCompras,
  compraParecida,
  temDividaParcelada,
  mesDeHoje,
  pactoAtivo,
  pedidoEdicao,
  onAdicionar,
  onEditar,
  onRemover,
}: {
  contas: Conta[]
  /** Contas mensais que parecem a mesma parcela de uma dívida de Minhas dívidas (ajuste de 26/09/2026). */
  emDobro: string[]
  /** Contas de todo mês no cartão que parecem a parcela de uma compra parcelada (ajuste de 26/09/2026). */
  emDobroCompras: { conta: Conta; compra: Compra }[]
  /** Compra parcelada em andamento parecida com a conta do formulário (mesmo valor ou nome). */
  compraParecida: (nome: string, valor: number) => Compra | null
  /** Há financiamento, empréstimo, consignado ou outra dívida de parcela fixa em Minhas dívidas. */
  temDividaParcelada: boolean
  mesDeHoje: string
  /** Pacto de não parcelar (Modo Recuperação): parcelar conta do ano pede confirmação. */
  pactoAtivo: boolean
  /** "Editar" tocado na lista do mês: abre essa conta aqui. `vez` muda a cada toque. */
  pedidoEdicao: { id: string; vez: number } | null
  onAdicionar: (c: Omit<Conta, 'id'>) => void
  onEditar: (id: string, c: Omit<Conta, 'id'>) => void
  onRemover: (id: string) => void
}) {
  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  // Muda a cada conta carregada para edição, para o campo de valor reiniciar com o valor dela.
  const [versaoForm, setVersaoForm] = useState(0)
  const [todasSugestoes, setTodasSugestoes] = useState(false)
  const idNome = useId()
  const idMes = useId()
  const idParcelas = useId()
  const formRef = useRef<HTMLDivElement>(null)
  const nomeRef = useRef<HTMLInputElement>(null)

  const parcelado = rascunho.tipo === 'anual' && rascunho.pagamentoAnual === 'parcelado'
  const totalParcelado = centavos(rascunho.parcelaCartao * rascunho.parcelas)
  // O cartão não cobra menos que a conta: total abaixo do valor é quase sempre a parcela digitada
  // no lugar errado. A folga de 1 centavo por parcela cobre o arredondamento (1.000 em 3x de 333,33).
  const totalAbaixoDaConta = parcelado && rascunho.parcelaCartao > 0 && totalParcelado < rascunho.valor - rascunho.parcelas * 0.01
  const valido =
    rascunho.nome.trim().length > 0 && rascunho.valor > 0 && (!parcelado || (rascunho.parcelaCartao > 0 && !totalAbaixoDaConta))
  const nomesUsados = new Set(contas.map((c) => c.nome.toLowerCase()))
  const sugestoes = CONTAS_SUGERIDAS.filter((s) => !nomesUsados.has(s.nome.toLowerCase()))
  const sugestoesVisiveis = todasSugestoes ? sugestoes : sugestoes.slice(0, SUGESTOES_VISIVEIS)
  const contaEditada = editandoId ? contas.find((c) => c.id === editandoId) : undefined

  function carregar(r: Rascunho, id: string | null) {
    setRascunho(r)
    setEditandoId(id)
    setVersaoForm((v) => v + 1)
  }

  /** Abre a conta no formulário e leva a pessoa até ele (o formulário fica abaixo da lista). */
  function abrirParaEditar(c: Conta) {
    carregar(rascunhoDaConta(c), c.id)
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    nomeRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!pedidoEdicao) return
    const c = contas.find((x) => x.id === pedidoEdicao.id)
    if (c) abrirParaEditar(c)
    // Só reage a um novo pedido; `contas` muda a cada tique e não deve reabrir o formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoEdicao])

  function salvar() {
    if (!valido) return
    let conta: Omit<Conta, 'id'>
    if (rascunho.tipo === 'anual') {
      conta = { nome: rascunho.nome.trim(), valor: rascunho.valor, tipo: 'anual', mesVencimento: rascunho.mesVencimento }
      if (rascunho.pagamentoAnual !== 'boleto') {
        if (
          parcelado &&
          pactoAtivo &&
          !window.confirm('Parcelar quebra o seu pacto de não parcelar: é dívida nova com o salário dos próximos meses. Parcelar mesmo assim?')
        )
          return
        const parcelas = parcelado ? rascunho.parcelas : 1
        const anterior = contaEditada?.cartaoAnual
        // Mesmo jeito de pagar: mantém o mês de início. Mudou: vale a partir deste mês, e os meses
        // anteriores continuam como eram.
        const mesmoJeito = anterior && anterior.parcelas > 1 === parcelas > 1
        conta.cartaoAnual = {
          parcelas,
          total: parcelado ? Math.max(totalParcelado, rascunho.valor) : rascunho.valor,
          // Parcelamento que começou num vencimento recente e ainda tem fatura: começa nele, para as
          // parcelas que faltam aparecerem já. Editar uma conta antiga corrige o início dela.
          desde: menorMes(
            mesmoJeito ? anterior.desde : mesDeHoje,
            inicioDaAnualNoCartao(rascunho.mesVencimento, parcelas, mesDeHoje, rascunho.jaComecou),
          ),
        }
      }
    } else {
      conta = { nome: rascunho.nome.trim(), valor: rascunho.valor, tipo: 'mensal' }
      // Quem já pagava no cartão mantém o mês de início; quem passa agora começa neste mês.
      if (rascunho.noCartao) conta.cartaoDesde = contaEditada?.cartaoDesde ?? mesDeHoje
    }
    if (editandoId) onEditar(editandoId, conta)
    else onAdicionar(conta)
    carregar(RASCUNHO_VAZIO, null)
  }

  return (
    <div className="card col" style={{ gap: 12 }}>
      <span className="mm-titulo-cor seg-contas">Minhas contas</span>

      {contas.length > 0 && (
        <ul className="mm-lista">
          {contas.map((c) => (
            <li key={c.id} className="mm-conta">
              <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                <span className="mm-item-nome">{c.nome}</span>
                <span className="tiny muted">
                  {c.tipo === 'anual'
                    ? `Anual, vence em ${NOMES_DOS_MESES[(c.mesVencimento ?? 1) - 1]}${
                        !c.cartaoAnual
                          ? ''
                          : c.cartaoAnual.parcelas > 1
                            ? `, no cartão em ${c.cartaoAnual.parcelas}x (total ${reais(c.cartaoAnual.total)})` +
                              // Gravada antes do ajuste de 26/09/2026 com a parcela no lugar do total.
                              (c.cartaoAnual.total < c.valor - c.cartaoAnual.parcelas * 0.01
                                ? '. Total menor que a conta: toque em Editar e confira o valor da parcela'
                                : '')
                            : ', no cartão à vista'
                      }`
                    : c.cartaoDesde
                      ? 'Todo mês, no cartão de crédito'
                      : 'Todo mês'}
                </span>
              </span>
              <span className="mm-item-valor">{reais(c.valor)}</span>
              <button className="mm-link small" aria-label={`Editar ${c.nome}`} onClick={() => abrirParaEditar(c)}>
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
      {emDobro.length > 0 && (
        <div className="small justify mm-situacao mm-cartao-amarelo" role="status">
          {contas
            .filter((c) => emDobro.includes(c.id))
            .map((c) => `"${c.nome}"`)
            .join(', ')}{' '}
          {emDobro.length > 1 ? 'parecem' : 'parece'} a parcela de uma dívida que já está em Minhas dívidas. A parcela da dívida já
          sai junto com as contas do mês: se for a mesma, toque em Editar e remova daqui, senão ela conta duas vezes.
        </div>
      )}
      <AvisoContaEmDobroComCompra pares={emDobroCompras} />

      <div className="col mm-form" style={{ gap: 10 }} ref={formRef}>
        <span className="small" style={{ fontWeight: 700 }}>{editandoId ? `Editar conta: ${contaEditada?.nome ?? ''}` : 'Adicionar conta'}</span>

        {/* O nome vem primeiro, com exemplos: qualquer conta pode ser cadastrada, e as sugestões
            são só atalhos (antes, a lista de sugestões vinha antes do campo e parecia obrigatória). */}
        <label htmlFor={idNome} className="col" style={{ gap: 4 }}>
          <span className="small" style={{ fontWeight: 600 }}>Nome da conta</span>
          <input
            id={idNome}
            ref={nomeRef}
            className="input-cotas"
            value={rascunho.nome}
            maxLength={40}
            placeholder="Ex.: Academia, Diarista, Pensão, Streaming"
            onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
          />
        </label>
        {rascunho.tipo === 'mensal' && pareceDivida(rascunho.nome) && (
          <span className="small justify mm-alerta-parcela" role="note">
            {temDividaParcelada
              ? 'Você já tem financiamento ou empréstimo em Minhas dívidas, logo abaixo. A parcela de lá já sai junto com as contas do mês: se for a mesma, não cadastre aqui, senão ela conta duas vezes.'
              : 'Financiamento, empréstimo e consignado ficam melhor em Minhas dívidas, logo abaixo: lá entram o saldo, os juros e a parcela, que sai junto com as contas do mês. Cadastre num lugar só, para não contar duas vezes.'}
          </span>
        )}

        {!editandoId && sugestoes.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <span className="tiny muted">Ou toque num atalho para preencher o nome:</span>
            <div className="mm-sugestoes">
              {sugestoesVisiveis.map((s) => (
                <button
                  key={s.nome}
                  className="mm-sugestao"
                  onClick={() =>
                    carregar({ ...RASCUNHO_VAZIO, nome: s.nome, tipo: s.tipo, mesVencimento: s.mesVencimento ?? 1, valor: rascunho.valor }, null)
                  }
                >
                  {s.nome}
                </button>
              ))}
              {sugestoes.length > SUGESTOES_VISIVEIS && (
                <button className="mm-link small" onClick={() => setTodasSugestoes((v) => !v)}>
                  {todasSugestoes ? 'Menos atalhos' : `Mais ${sugestoes.length - SUGESTOES_VISIVEIS} atalhos`}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="row" style={{ gap: 6 }} role="group" aria-label="Frequência">
          {(['mensal', 'anual'] as const).map((t) => (
            <button
              key={t}
              className={`chip ${rascunho.tipo === t ? 'selected' : ''}`}
              aria-pressed={rascunho.tipo === t}
              onClick={() => setRascunho({ ...rascunho, tipo: t })}
            >
              {t === 'mensal' ? 'Todo mês' : 'Uma vez por ano'}
            </button>
          ))}
        </div>

        <CampoReais
          key={versaoForm}
          rotulo={rascunho.tipo === 'anual' ? 'Valor total no ano' : 'Valor por mês'}
          valor={rascunho.valor}
          onMudar={(v) => setRascunho((r) => ({ ...r, valor: v }))}
          dica={rascunho.tipo === 'mensal' ? 'Conta que varia, como luz ou mercado: use a média dos últimos meses.' : undefined}
        />

        {rascunho.tipo === 'mensal' && (
          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Como você paga</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Como você paga">
              {([false, true] as const).map((cartao) => (
                <button
                  key={String(cartao)}
                  className={`chip ${rascunho.noCartao === cartao ? 'selected' : ''}`}
                  aria-pressed={rascunho.noCartao === cartao}
                  onClick={() => setRascunho({ ...rascunho, noCartao: cartao })}
                >
                  {cartao ? 'Cartão de crédito' : 'Boleto, Pix ou débito'}
                </button>
              ))}
            </div>
            {rascunho.noCartao && (
              <span className="tiny muted justify">
                A conta sai da lista do mês e entra no gasto do cartão, contando para o seu teto. Ela é paga na fatura do mês
                seguinte, junto com as compras. Compra parcelada (geladeira, TV) não vai aqui: lance no cartão, com o número de
                vezes, para o app saber quando ela acaba.
              </span>
            )}
            {rascunho.noCartao &&
              (() => {
                const compra = compraParecida(rascunho.nome, rascunho.valor)
                return (
                  compra && (
                    <span className="small justify mm-alerta-parcela" role="note">
                      Parece a compra "{compra.descricao}" ({compra.parcelas}x de {reais(parcelaNoMes(compra, compra.mes))}), que já
                      está parcelada no cartão e entra na fatura todo mês. Se for a mesma, não cadastre aqui, senão ela conta duas
                      vezes.
                    </span>
                  )
                )
              })()}
          </div>
        )}

        {rascunho.tipo === 'anual' && (
          <label htmlFor={idMes} className="col" style={{ gap: 4 }}>
            <span className="small" style={{ fontWeight: 600 }}>Mês do vencimento</span>
            <select
              id={idMes}
              className="input-cotas"
              value={rascunho.mesVencimento}
              onChange={(e) => setRascunho({ ...rascunho, mesVencimento: Number(e.target.value) })}
            >
              {NOMES_DOS_MESES.map((n, i) => (
                <option key={n} value={i + 1}>
                  {n}
                </option>
              ))}
            </select>
            <span className="tiny muted">No boleto em várias vezes? Use o mês da primeira parcela.</span>
          </label>
        )}

        {rascunho.tipo === 'anual' && (
          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Como você paga</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Como você paga a conta do ano">
              {(['boleto', 'avista', 'parcelado'] as const).map((forma) => (
                <button
                  key={forma}
                  className={`chip ${rascunho.pagamentoAnual === forma ? 'selected' : ''}`}
                  aria-pressed={rascunho.pagamentoAnual === forma}
                  onClick={() => setRascunho({ ...rascunho, pagamentoAnual: forma })}
                >
                  {ROTULO_PAGAMENTO_ANUAL[forma]}
                </button>
              ))}
            </div>
            {rascunho.pagamentoAnual === 'avista' && (
              <span className="tiny muted justify">
                O cofrinho continua todo mês. No vencimento, a conta vai para o cartão, e no mês seguinte o dinheiro do cofrinho paga
                essa parte da fatura: não sai do salário duas vezes.
              </span>
            )}
            {parcelado && (
              <div className="col" style={{ gap: 8 }}>
                <label htmlFor={idParcelas} className="col" style={{ gap: 4 }}>
                  <span className="small" style={{ fontWeight: 600 }}>Em quantas vezes</span>
                  <select
                    id={idParcelas}
                    className="input-cotas"
                    value={rascunho.parcelas}
                    onChange={(e) => setRascunho({ ...rascunho, parcelas: Number(e.target.value) })}
                  >
                    {Array.from({ length: MAX_PARCELAS_ANUAL - 1 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </select>
                </label>
                <CampoReais
                  key={`parcela-${versaoForm}`}
                  rotulo="Valor de cada parcela no cartão"
                  valor={rascunho.parcelaCartao}
                  onMudar={(v) => setRascunho((r) => ({ ...r, parcelaCartao: v }))}
                  dica="Está na simulação do parcelamento, já com juros e taxas."
                />
                {rascunho.parcelaCartao > 0 && (
                  <div className="small" role="status" style={{ fontWeight: 600 }}>
                    {rascunho.parcelas}x de {reais(rascunho.parcelaCartao)} = {reais(totalParcelado)} no total
                  </div>
                )}
                {totalAbaixoDaConta ? (
                  <div className="small justify mm-situacao mm-cartao-vermelho" role="alert">
                    {reais(totalParcelado)} no total é menos que o valor da conta ({reais(rascunho.valor)}), e o cartão não cobra menos
                    que a conta. Confira: aqui vai o valor de cada parcela, e em "Valor total no ano", o valor da conta inteira.
                  </div>
                ) : (
                  rascunho.valor > 0 &&
                  rascunho.parcelaCartao > 0 && (
                    <div className="small justify mm-situacao mm-cartao-amarelo" role="status">
                      {custoDoParcelamento(rascunho.valor, totalParcelado, rascunho.parcelas)}
                    </div>
                  )
                )}
                {parcelamentoPodeTerComecado(rascunho.mesVencimento, rascunho.parcelas, mesDeHoje) && (
                  <div className="col" style={{ gap: 6 }}>
                    <span className="small" style={{ fontWeight: 600 }}>
                      Você já está pagando o parcelamento de {NOMES_DOS_MESES[rascunho.mesVencimento - 1].toLowerCase()}?
                    </span>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Parcelamento já começou">
                      {([true, false] as const).map((sim) => (
                        <button
                          key={String(sim)}
                          className={`chip ${rascunho.jaComecou === sim ? 'selected' : ''}`}
                          aria-pressed={rascunho.jaComecou === sim}
                          onClick={() => setRascunho({ ...rascunho, jaComecou: sim })}
                        >
                          {sim ? 'Sim, já estou pagando' : 'Não, é o próximo'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="small justify mm-situacao" role="note">
                  {quandoApareceNoCartao(rascunho.mesVencimento, rascunho.parcelas, mesDeHoje, rascunho.jaComecou)}
                </div>
                <span className="tiny muted justify">
                  Antes de parcelar no cartão, veja se a prefeitura ou a Secretaria da Fazenda oferece desconto à vista ou
                  parcelamento sem juros no boleto: costuma sair mais barato. Parcelado, a conta não tem cofrinho: as parcelas entram
                  nas faturas a partir do mês seguinte ao vencimento.
                </span>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-primary" disabled={!valido} onClick={salvar}>
          {editandoId ? 'Salvar alterações' : 'Adicionar conta'}
        </button>
        {editandoId && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-outline" onClick={() => carregar(RASCUNHO_VAZIO, null)}>
              Cancelar
            </button>
            <button
              className="btn btn-outline mm-perigo"
              onClick={() => {
                if (window.confirm(`Remover "${rascunho.nome}" e todos os tiques dela?`)) {
                  onRemover(editandoId)
                  carregar(RASCUNHO_VAZIO, null)
                }
              }}
            >
              Remover
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- cópia de segurança

function CopiaDeSeguranca({
  orcamento,
  hoje,
  onRestaurar,
  onApagar,
}: {
  orcamento: Orcamento
  hoje: Date
  onRestaurar: (o: Orcamento) => void
  onApagar: () => void
}) {
  const [aviso, setAviso] = useState<string | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  function salvar() {
    const blob = new Blob([gerarCopia(orcamento, new Date())], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meu-mes-${chaveMes(hoje)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setAviso('Cópia salva. Guarde o arquivo num lugar seguro, como seu e-mail ou Google Drive.')
  }

  async function restaurar(arquivo: File | undefined) {
    if (!arquivo) return
    const lido = lerCopia(await arquivo.text())
    if (arquivoRef.current) arquivoRef.current.value = ''
    if (!lido) {
      setAviso('Este arquivo não é uma cópia do Meu Mês. Nada foi alterado.')
      return
    }
    if (!window.confirm('Restaurar a cópia substitui tudo o que está neste aparelho. Continuar?')) return
    onRestaurar(lido)
    setAviso('Cópia restaurada.')
  }

  return (
    <div className="card-outline col small" style={{ gap: 10 }}>
      <span style={{ fontWeight: 700 }}>Seus dados ficam só neste aparelho</span>
      <span className="muted justify">
        Nada é enviado para a internet. Por isso, se você trocar de celular ou limpar o navegador, os dados se perdem. Salve uma
        cópia de vez em quando.
      </span>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-outline" onClick={salvar}>
          Salvar cópia
        </button>
        <button className="btn btn-outline" onClick={() => arquivoRef.current?.click()}>
          Restaurar cópia
        </button>
      </div>
      <input
        ref={arquivoRef}
        type="file"
        accept="application/json,.json"
        hidden
        data-testid="arquivo-copia"
        onChange={(e) => restaurar(e.target.files?.[0])}
      />
      {aviso && (
        <span role="status" className="justify">
          {aviso}
        </span>
      )}
      <button
        className="mm-apagar-tudo"
        onClick={() => {
          if (window.confirm('Apagar salário, contas e todos os tiques deste aparelho? Não dá para desfazer.')) onApagar()
        }}
      >
        Apagar tudo e começar de novo
      </button>
    </div>
  )
}

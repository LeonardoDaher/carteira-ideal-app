import { useId, useMemo, useState } from 'react'
import { CATALOGO_ATIVOS } from '../../data/catalogoAtivos'
import { ATIVOS } from '../../data/assets'
import { carteiraParaExibicao } from '../../data/carteiraVisual'
import { agruparTesouroDireto, CLASSES_ESCOLHA, classificarPosicoes, ehClasseValida, ROTULO_CLASSE, valoresPorClasse } from '../../domain/classesDaCarteira'
import type { AtivoClassificado } from '../../domain/classesDaCarteira'
import { compararComReferencia, distribuirAporte } from '../../domain/carteiraAtual'
import type { LinhaClasse } from '../../domain/carteiraAtual'
import type { ClasseCarteira } from '../../domain/classificadorAtivo'
import { lerNumero } from '../../domain/importacao/celulas'
import type { Painel } from '../../domain/painelCarteira'
import type { AtivoKey, ResultadoRecomendacao } from '../../domain/types'
import { semNumero } from '../nomePerfil'
import { dataCurta, pct } from './formatar'
import { useValores } from './valoresOcultos'

interface Props {
  resultado: ResultadoRecomendacao | null | undefined
  /** A pessoa já respondeu o questionário e a carteira sugerida está sendo calculada. */
  pendente: boolean
  erro: string | null | undefined
  onTentarNovamente?: () => void
  onResponderQuestionario?: () => void
  painel: Painel
  classes: Record<string, ClasseCarteira>
  onEscolherClasse: (ativo: string, classe: ClasseCarteira | null) => void
}

const pp = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`
const rotuloDaClasse = (c: ClasseCarteira) => (c === 'foraDaRegua' ? 'Fora da carteira sugerida' : ATIVOS[c as AtivoKey].label)
const corDaClasse = (c: ClasseCarteira) => (c === 'foraDaRegua' ? 'var(--text-muted)' : ATIVOS[c as AtivoKey].cor)

function SeletorDeClasse({ ativo, valor, onEscolher }: { ativo: string; valor: ClasseCarteira | ''; onEscolher: (c: ClasseCarteira | null) => void }) {
  return (
    <select
      className="mc-campo mc-seletor"
      aria-label={`Classe de ${ativo}`}
      value={valor}
      onChange={(e) => onEscolher(ehClasseValida(e.target.value) ? e.target.value : null)}
    >
      {valor === '' && <option value="">Escolher a classe…</option>}
      {CLASSES_ESCOLHA.map((c) => (
        <option key={c} value={c}>{ROTULO_CLASSE[c]}</option>
      ))}
    </select>
  )
}

function Linha({ l }: { l: LinhaClasse }) {
  const { reais } = useValores()
  const dentro = l.situacao === 'dentro'
  const faltando = l.difPp < 0
  const rotulo = rotuloDaClasse(l.classe)
  return (
    <li className="mc-comp-linha">
      <div className="mc-comp-topo">
        <strong>{rotulo}</strong>
        <span className={`mc-chip-situacao ${dentro ? 'dentro' : faltando ? 'abaixo' : 'acima'}`}>
          {dentro ? 'Dentro do alvo' : faltando ? `Abaixo ${pp(Math.abs(l.difPp))}` : `Acima +${pp(l.difPp)}`}
        </span>
      </div>
      <div className="mc-trilha" aria-hidden="true">
        <span className="mc-preench" style={{ width: `${Math.min(100, l.pctAtual)}%`, minWidth: l.pctAtual > 0 ? 3 : 0, background: corDaClasse(l.classe) }} />
        {l.pctReferencia > 0 && <span className="mc-marca" style={{ left: `${Math.min(100, l.pctReferencia)}%` }} />}
      </div>
      <div className="mc-comp-numeros">
        <span>Você: <strong>{pct(l.pctAtual, false)}</strong>{l.valor > 0 && <> ({reais(l.valor)})</>}</span>
        {l.classe === 'foraDaRegua' ? (
          <span className="mc-nota">A carteira sugerida não tem essa classe</span>
        ) : (
          <span>Sugerida: <strong>{pct(l.pctReferencia, false)}</strong></span>
        )}
      </div>
      {!dentro && (
        <div className="mc-nota">
          {l.classe === 'foraDaRegua' ? `${reais(l.valor)} estão fora das classes da carteira sugerida.` : faltando ? `Faltam ${reais(Math.abs(l.difReais))} para chegar na sugerida.` : `Passam ${reais(l.difReais)} da sugerida.`}
        </div>
      )}
    </li>
  )
}

function Aporte({ valores, referencia }: { valores: Partial<Record<ClasseCarteira, number>>; referencia: Record<string, number | undefined> }) {
  const { reais } = useValores()
  const id = useId()
  const [texto, setTexto] = useState('')
  const valor = lerNumero(texto)
  const partes = useMemo(() => (valor && valor > 0 ? distribuirAporte(valores, referencia, valor) : []), [valor, valores, referencia])

  return (
    <div className="mc-aporte">
      <label htmlFor={id} className="mc-rotulo-campo">Quanto você vai aportar? (R$)</label>
      <input id={id} className="mc-campo mc-campo-curto" inputMode="decimal" placeholder="1.000,00" value={texto} onChange={(e) => setTexto(e.target.value)} />
      {partes.length > 0 && (
        <>
          <ul className="mc-aporte-lista" aria-label="Distribuição do aporte">
            {partes.map((p) => (
              <li key={p.classe}>
                <span>{ATIVOS[p.classe].label}</span>
                <strong>{reais(p.valor)}</strong>
              </li>
            ))}
          </ul>
          <div className="mc-nota">Distribui só o dinheiro novo entre as classes abaixo do alvo. Não manda vender nada.</div>
        </>
      )}
    </div>
  )
}

export function CartaoComparacao({ resultado, pendente, erro, onTentarNovamente, onResponderQuestionario, painel, classes, onEscolherClasse }: Props) {
  const { reais } = useValores()
  const idTitulo = useId()
  const classificados = useMemo(() => classificarPosicoes(painel.linhas, CATALOGO_ATIVOS, classes), [painel.linhas, classes])
  const { valores, pendentes, valorPendente } = useMemo(() => valoresPorClasse(classificados), [classificados])
  const valoresExibicao = useMemo(() => agruparTesouroDireto(valores), [valores])
  const referencia = useMemo(() => (resultado ? carteiraParaExibicao(resultado.carteira) : null), [resultado])
  const comparativo = useMemo(() => (referencia ? compararComReferencia(valoresExibicao, referencia) : null), [valoresExibicao, referencia])

  const titulo = <h2 id={idTitulo} className="mc-titulo">Comparar com a carteira sugerida</h2>

  if (!resultado) {
    if (erro) {
      return (
        <section className="mc-card" aria-labelledby={idTitulo}>
          {titulo}
          <div role="alert" className="mc-erro">Não conseguimos calcular a carteira sugerida agora. {erro}</div>
          <div className="mc-acoes">
            <button type="button" className="btn btn-secondary mc-btn" onClick={onTentarNovamente}>Tentar novamente</button>
          </div>
        </section>
      )
    }
    if (pendente) {
      return (
        <section className="mc-card" aria-labelledby={idTitulo}>
          {titulo}
          <div role="status" aria-live="polite" className="mc-texto">Montando a sua carteira sugerida…</div>
        </section>
      )
    }
    return (
      <section className="mc-card" aria-labelledby={idTitulo}>
        {titulo}
        <p className="mc-texto">
          Responda o questionário (menos de 3 minutos) para ver o que está acima ou abaixo da carteira de referência do seu perfil. <strong>É opcional.</strong>
        </p>
        <div className="mc-acoes">
          <button type="button" className="btn btn-primary mc-btn" onClick={onResponderQuestionario}>Responder o questionário</button>
        </div>
      </section>
    )
  }

  if (!classificados.length || !comparativo) {
    return (
      <section className="mc-card" aria-labelledby={idTitulo}>
        {titulo}
        <p className="mc-texto">Importe os seus ativos (de preferência a Posição da B3) para comparar com a carteira sugerida.</p>
      </section>
    )
  }

  const perfil = resultado.perfilFinalCarteira ?? resultado.perfilPatrimonial ?? resultado.perfilFinal
  const linhas = [...comparativo.linhas].sort((a, b) => Math.abs(b.difPp) - Math.abs(a.difPp))
  const aderencia = comparativo.aderencia
  const aConfirmar = classificados.filter((c) => c.classe !== null && c.precisaConfirmar)

  return (
    <section className="mc-card mc-comparacao" aria-labelledby={idTitulo}>
      {titulo}
      <div className="mc-rotulo">Carteira sugerida para o perfil <strong>{semNumero(perfil)}</strong></div>

      {aderencia !== null && (
        <div className="mc-aderencia">
          <div className="mc-valor">{Math.round(aderencia)}%</div>
          <div className="mc-nota">de aderência à carteira sugerida</div>
          <div className="mc-barra-progresso" role="img" aria-label={`Aderência de ${Math.round(aderencia)}% à carteira sugerida`}>
            <span style={{ width: `${Math.max(0, Math.min(100, aderencia))}%`, background: 'var(--mc-ouro)' }} />
          </div>
        </div>
      )}
      <div className="mc-nota">
        {painel.resumo.patrimonio !== null && painel.resumo.dataPosicao
          ? `Valores de ${dataCurta(painel.resumo.dataPosicao)} (Posição da B3).`
          : 'Valores a preço de custo. Importe a Posição para usar valores atuais.'}
      </div>

      {pendentes.length > 0 && (
        <div className="mc-aviso-caixa" role="group" aria-label="Ativos sem classe">
          <strong>{pendentes.length} ativo(s), somando {reais(valorPendente)}, ficaram de fora</strong>
          <div className="mc-nota">Não deu para identificar a classe. Escolha abaixo para incluí-los.</div>
          <ul className="mc-pendentes-classe">
            {pendentes.map((p) => (
              <li key={p.ativo}>
                <span><strong>{p.ativo}</strong> <span className="mc-nota">{reais(p.valor)}</span></span>
                <SeletorDeClasse ativo={p.ativo} valor="" onEscolher={(c) => onEscolherClasse(p.ativo, c)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mc-comp-lista" aria-label="Comparação por classe">
        {linhas.map((l) => (
          <Linha key={l.classe} l={l} />
        ))}
      </ul>

      <Aporte valores={valoresExibicao} referencia={referencia as Record<string, number | undefined>} />

      <details className="mc-detalhes">
        <summary>
          Como classificamos os seus ativos ({classificados.length}){aConfirmar.length > 0 && ` · ${aConfirmar.length} para confirmar`}
        </summary>
        <ul className="mc-classif">
          {classificados.map((c: AtivoClassificado) => (
            <li key={c.ativo}>
              <div>
                <strong>{c.ativo}</strong> <span className="mc-nota">{reais(c.valor)}</span>
                {c.precisaConfirmar && c.classe !== null && <span className="mc-selo faltaSaldoAnterior">Confirme</span>}
                <div className="mc-nota">{c.motivo}</div>
              </div>
              <div className="mc-classif-acao">
                <SeletorDeClasse ativo={c.ativo} valor={c.classe ?? ''} onEscolher={(x) => onEscolherClasse(c.ativo, x)} />
                {c.precisaConfirmar && c.classe !== null && (
                  <button type="button" className="btn btn-ghost mc-btn" aria-label={`Confirmar ${ROTULO_CLASSE[c.classe]} para ${c.ativo}`} onClick={() => onEscolherClasse(c.ativo, c.classe)}>
                    Confirmar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mc-nota">CDB e LCI: lance à mão e escolha a classe aqui.</div>
      </details>

      <div className="mc-nota" role="note">
        Exemplo educacional, não é recomendação de investimento. Seus ativos nunca saem deste aparelho.
      </div>
    </section>
  )
}

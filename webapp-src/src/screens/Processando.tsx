import { useEffect, useState } from 'react'
import { LoaderIcon } from '../ui/Icon'
import type { AppCtx } from '../state/useAppState'

const ETAPAS = ['Calculando seu score de risco...', 'Aplicando travas de segurança...', 'Montando sua carteira sugerida...']

// Tempo mínimo (ms) em que a animação fica visível, mesmo se a API responder rapidíssimo —
// evita um "piscar" de tela que pareceria um bug. Se a API demorar mais que isso (rede
// lenta), a tela simplesmente continua mostrando a última etapa até a resposta chegar.
const DURACAO_MINIMA_MS = 1900

export function Processando({ ctx }: { ctx: AppCtx }) {
  const [etapa, setEtapa] = useState(0)
  const [tempoMinimoPassou, setTempoMinimoPassou] = useState(false)

  useEffect(() => {
    const intervalo = setInterval(() => {
      setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1))
    }, 550)
    const timeout = setTimeout(() => setTempoMinimoPassou(true), DURACAO_MINIMA_MS)
    return () => {
      clearInterval(intervalo)
      clearTimeout(timeout)
    }
  }, [])

  // Avança para o resultado só quando: (1) o tempo mínimo de animação já passou, E
  // (2) a API já respondeu (resultado pronto). Isso conecta a UX ao estado real da
  // requisição em vez de um timer fixo que fingia estar calculando.
  useEffect(() => {
    if (tempoMinimoPassou && !ctx.carregandoResultado && ctx.resultado) {
      ctx.finalizarProcessamento()
    }
  }, [tempoMinimoPassou, ctx.carregandoResultado, ctx.resultado, ctx])

  if (ctx.erroResultado) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ fontWeight: 700 }}>Não conseguimos calcular sua carteira agora</div>
        <div className="muted small">{ctx.erroResultado}</div>
        <button className="btn btn-primary" onClick={ctx.tentarCalcularNovamente}>
          Tentar novamente
        </button>
        <button className="btn btn-outline" onClick={() => ctx.setScreen('questionarioArquitetura')}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', gap: 20 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
        }}
      >
        <span style={{ display: 'inline-flex', animation: 'spin 1.1s linear infinite' }}>
          <LoaderIcon size={30} />
        </span>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div className="col" style={{ alignItems: 'center', gap: 6, textAlign: 'center' }}>
        <div style={{ fontWeight: 700 }}>Analisando suas respostas</div>
        <div className="muted small">{ETAPAS[etapa]}</div>
      </div>

      <div className="progressbar" style={{ width: '70%' }}>
        <div style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }} />
      </div>
    </div>
  )
}

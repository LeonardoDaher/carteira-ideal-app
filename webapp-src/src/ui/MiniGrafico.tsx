const W = 320
const L = 6
const R = 34

/**
 * Gráfico pequeno de uma série (IFR, histograma do MACD, receita por ano...). Linha ou barras, com linhas de referência opcionais
 * (ex.: 30 e 70 no IFR). Cores pelo sinal nas barras. `rotulo` descreve o gráfico para leitores de tela.
 */
export function MiniGrafico({
  valores, tipo = 'linha', referencias = [], altura = 56, rotulo, casas = 1, positivoVerde = true,
}: {
  valores: (number | null)[]
  tipo?: 'linha' | 'barras'
  referencias?: number[]
  altura?: number
  rotulo: string
  casas?: number
  positivoVerde?: boolean
}) {
  const validos = valores.filter((v): v is number => v !== null && Number.isFinite(v))
  if (validos.length < 2) return <div className="tiny muted" role="img" aria-label={`${rotulo}: dados insuficientes`}>Dados insuficientes</div>
  const topo = 4
  const base = altura - 4
  const minimoBruto = Math.min(...validos, ...referencias, ...(tipo === 'barras' ? [0] : []))
  const maximoBruto = Math.max(...validos, ...referencias, ...(tipo === 'barras' ? [0] : []))
  const folga = (maximoBruto - minimoBruto || 1) * 0.08
  const min = minimoBruto - folga
  const max = maximoBruto + folga
  const n = valores.length
  const largura = (W - L - R) / n
  const x = (i: number) => L + largura * (i + 0.5)
  const y = (v: number) => topo + ((max - v) / (max - min || 1)) * (base - topo)
  const caminho = valores.map((v, i) => (v === null ? '' : `${i === 0 || valores[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).join('')
  const ultimo = [...valores].reverse().find((v) => v !== null) as number
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

  return (
    <svg viewBox={`0 0 ${W} ${altura}`} role="img" aria-label={`${rotulo}: último valor ${fmt(ultimo)}, mínimo ${fmt(minimoBruto)} e máximo ${fmt(maximoBruto)}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {referencias.map((r) => (
        <g key={r}>
          <line x1={L} x2={W - R} y1={y(r)} y2={y(r)} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={W - R + 3} y={y(r) + 3} style={{ fill: 'var(--text-muted)', fontSize: 9 }}>{fmt(r)}</text>
        </g>
      ))}
      {tipo === 'barras' ? (
        <>
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth={1} />
          {valores.map((v, i) =>
            v === null ? null : (
              <rect key={i} x={x(i) - largura * 0.35} y={Math.min(y(v), y(0))} width={Math.max(1, largura * 0.7)} height={Math.max(1, Math.abs(y(v) - y(0)))} fill={positivoVerde ? (v >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--accent)'} opacity={0.8} />
            ),
          )}
        </>
      ) : (
        <path d={caminho} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinejoin="round" />
      )}
      <text x={W - R + 3} y={Math.min(Math.max(y(ultimo) + 3, 10), altura - 2)} style={{ fill: 'var(--text)', fontSize: 9.5, fontWeight: 700 }}>{fmt(ultimo)}</text>
    </svg>
  )
}

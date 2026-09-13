/**
 * Sparkline SVG — mini gráfico de barras para visualizar tendencia semanal
 */
export default function Sparkline({ data = [], color = '#06B6D4', height = 28, width = 60 }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data, 1);
  const barW = (width - (data.length - 1) * 2) / data.length;

  return (
    <svg
      width={width}
      height={height}
      className="sparkline"
      aria-hidden="true"
    >
      {data.map((val, i) => {
        const barH = Math.max(2, (val / max) * (height - 4));
        const x = i * (barW + 2);
        const y = height - barH;
        return (
          <rect
            key={i}
            x={x} y={y}
            width={barW} height={barH}
            rx={1.5}
            fill={val > 0 ? color : 'rgba(255,255,255,0.08)'}
            opacity={val > 0 ? 0.85 : 1}
          />
        );
      })}
    </svg>
  );
}

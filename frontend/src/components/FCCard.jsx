export default function FCCard({ player }) {
  if (!player) return null;

  const rating = Math.min(
    99,
    Math.round(60 + (player.total_goles ?? 0) * 3 + (player.total_asistencias ?? 0) * 2 + (player.total_atajadas ?? 0) * 1.5)
  );

  const initials = `${player.nombre?.[0] ?? ''}${player.apellido?.[0] ?? ''}`;

  const imgSrc = player.imagen_url
    ? player.imagen_url.startsWith('/')
      ? `http://localhost:3001${player.imagen_url}`
      : player.imagen_url
    : null;

  return (
    <div className="fc-card-wrapper">
      <div className="fc-card">
        <div className="fc-shimmer" />

        {/* Top — rating + badge */}
        <div className="fc-top">
          <div className="fc-rating-block">
            <span className="fc-rating">{rating}</span>
            <span className="fc-pos">{player.posicion}</span>
          </div>
          <div className="fc-badge">
            <span style={{ fontSize: '1rem' }}>★</span>
            <span className="fc-badge-week">SEM {player.semana}</span>
          </div>
        </div>

        {/* Photo */}
        <div className="fc-img-frame">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={`${player.nombre} ${player.apellido}`}
              className="fc-img"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="fc-img-placeholder"
            style={{ display: imgSrc ? 'none' : 'flex' }}
          >
            <span className="fc-avatar">{initials}</span>
          </div>
        </div>

        {/* Name */}
        <div className="fc-name-block">
          <span className="fc-firstname">{player.nombre}</span>
          <span className="fc-lastname">{player.apellido}</span>
        </div>

        <div className="fc-divider" />

        {/* Stats */}
        <div className="fc-stats">
          <div className="fc-stat">
            <span className="fc-stat-val">{player.total_goles ?? 0}</span>
            <span className="fc-stat-label">GOL</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-val">{player.total_asistencias ?? 0}</span>
            <span className="fc-stat-label">AST</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-val">{player.total_atajadas ?? 0}</span>
            <span className="fc-stat-label">ATA</span>
          </div>
        </div>

        {/* Highlight phrase */}
        {player.destacado && (
          <div className="fc-destacado">"{player.destacado}"</div>
        )}

        <div className="fc-bottom-glow" />
      </div>
    </div>
  );
}

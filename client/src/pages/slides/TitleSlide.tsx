const base = import.meta.env.BASE_URL;

export default function TitleSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <img
        src={`${base}slides/hero-constellation.png`}
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        alt="Constellation network visualization"
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(11,22,40,0.85) 0%, rgba(11,22,40,0.5) 50%, rgba(0,212,255,0.15) 100%)' }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: '8vw', paddingRight: '8vw' }}>
        <div style={{ marginBottom: '2vh' }}>
          <div style={{ width: '6vw', height: '0.4vh', backgroundColor: '#00D4FF', marginBottom: '3vh' }} />
        </div>
        <h1
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '6.5vw',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: '#FFFFFF',
            marginBottom: '2vh',
          }}
        >
          Constellation
        </h1>
        <p
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '2vw',
            fontWeight: 300,
            letterSpacing: '0.15em',
            color: '#00D4FF',
            textTransform: 'uppercase',
            marginBottom: '4vh',
          }}
        >
          by Synozur
        </p>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '1.8vw',
            fontWeight: 400,
            lineHeight: 1.5,
            color: '#C8D6E5',
            maxWidth: '50vw',
          }}
        >
          The Synozur Consulting Delivery Platform
        </p>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '1.4vw',
            fontWeight: 300,
            color: '#8B9DC3',
            marginTop: '2vh',
          }}
        >
          Estimate. Deliver. Invoice. All in one place.
        </p>
      </div>
      <div className="absolute" style={{ bottom: '5vh', right: '8vw' }}>
        <div style={{ width: '8vw', height: '0.3vh', backgroundColor: '#00D4FF', opacity: 0.5 }} />
      </div>
    </div>
  );
}

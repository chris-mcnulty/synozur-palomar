export default function ClosingSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(0,212,255,0.1) 0%, transparent 60%)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(0,212,255,0.05) 100%)' }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingLeft: '10vw', paddingRight: '10vw' }}>
        <div style={{ width: '8vw', height: '0.4vh', background: 'linear-gradient(to right, transparent, #00D4FF, transparent)', marginBottom: '5vh' }} />
        <h2
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '5.5vw',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: '3vh',
          }}
        >
          Constellation
        </h2>
        <p
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '1.8vw',
            fontWeight: 300,
            letterSpacing: '0.2em',
            color: '#00D4FF',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: '5vh',
          }}
        >
          by Synozur
        </p>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '2vw',
            fontWeight: 400,
            color: '#C8D6E5',
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: '50vw',
            marginBottom: '6vh',
          }}
        >
          Stop managing projects in spreadsheets. Start delivering with Constellation.
        </p>
        <div className="flex" style={{ gap: '6vw', marginBottom: '6vh' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5vw', fontWeight: 500, color: '#FFFFFF' }}>synozur.com</p>
          </div>
          <div style={{ width: '0.1vw', backgroundColor: 'rgba(0,212,255,0.3)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5vw', fontWeight: 500, color: '#FFFFFF' }}>hello@synozur.com</p>
          </div>
        </div>
        <div style={{ width: '8vw', height: '0.4vh', background: 'linear-gradient(to right, transparent, #00D4FF, transparent)' }} />
      </div>
      <div className="absolute" style={{ bottom: '4vh', left: '50%', transform: 'translateX(-50%)' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.2vw', fontWeight: 300, color: '#8B9DC3', opacity: 0.6 }}>
          The Synozur Consulting Delivery Platform
        </p>
      </div>
    </div>
  );
}

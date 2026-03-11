export default function EstimateScopeSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 80%, rgba(0,212,255,0.06) 0%, transparent 50%)' }} />
      <div className="absolute inset-0 flex" style={{ paddingLeft: '8vw', paddingRight: '8vw', paddingTop: '8vh', paddingBottom: '8vh' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: '4vw' }}>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '1.4vw',
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: '#00D4FF',
              textTransform: 'uppercase',
              marginBottom: '2vh',
            }}
          >
            Estimate & Scope
          </p>
          <h2
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '3.5vw',
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#FFFFFF',
              marginBottom: '4vh',
            }}
          >
            Win work with precision pricing
          </h2>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '1.5vw',
              fontWeight: 400,
              color: '#8B9DC3',
              lineHeight: 1.6,
              marginBottom: '4vh',
            }}
          >
            Build detailed estimates with role-based rates, phase structures, and automated calculations that flow directly into project delivery.
          </p>
          <div style={{ display: 'flex', gap: '4vw' }}>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '3vw', fontWeight: 800, color: '#00D4FF' }}>90%</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3' }}>Faster estimates</p>
            </div>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '3vw', fontWeight: 800, color: '#00D4FF' }}>0</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3' }}>Pricing errors</p>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2vh' }}>
          <div style={{ padding: '2.5vh 2vw', borderRadius: '0.8vw', backgroundColor: 'rgba(27,42,74,0.5)', borderLeft: '0.2vw solid #00D4FF' }}>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.8vh' }}>
              Role-Based Rate Cards
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>
              Define rates by role, seniority, and engagement type with automatic margin calculation
            </p>
          </div>
          <div style={{ padding: '2.5vh 2vw', borderRadius: '0.8vw', backgroundColor: 'rgba(27,42,74,0.5)', borderLeft: '0.2vw solid #00D4FF' }}>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.8vh' }}>
              Phase & Task Breakdown
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>
              Structure work into phases with granular task-level effort and cost estimates
            </p>
          </div>
          <div style={{ padding: '2.5vh 2vw', borderRadius: '0.8vw', backgroundColor: 'rgba(27,42,74,0.5)', borderLeft: '0.2vw solid #00D4FF' }}>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.8vh' }}>
              Estimate-to-Project Flow
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>
              Convert approved estimates into active projects with budget baselines intact
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

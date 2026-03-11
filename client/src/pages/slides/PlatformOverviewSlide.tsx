export default function PlatformOverviewSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 30%, rgba(0,212,255,0.08) 0%, transparent 60%)' }} />
      <div className="absolute" style={{ top: 0, right: 0, width: '40vw', height: '100vh', background: 'linear-gradient(135deg, rgba(0,212,255,0.05) 0%, transparent 100%)' }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: '8vw', paddingRight: '8vw' }}>
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
          Platform Overview
        </p>
        <h2
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '4vw',
            fontWeight: 700,
            lineHeight: 1.1,
            color: '#FFFFFF',
            marginBottom: '5vh',
          }}
        >
          One platform, entire lifecycle
        </h2>
        <div className="flex" style={{ gap: '2vw' }}>
          <div style={{ flex: 1, padding: '3vh 2vw', borderRadius: '1vw', backgroundColor: 'rgba(27,42,74,0.6)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <div style={{ width: '4vw', height: '4vw', borderRadius: '50%', backgroundColor: 'rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2vh' }}>
              <span style={{ fontSize: '2vw', color: '#00D4FF' }}>1</span>
            </div>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>Estimate</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.5 }}>Build detailed scopes with role-based rates and automated pricing</p>
          </div>
          <div style={{ flex: 1, padding: '3vh 2vw', borderRadius: '1vw', backgroundColor: 'rgba(27,42,74,0.6)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <div style={{ width: '4vw', height: '4vw', borderRadius: '50%', backgroundColor: 'rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2vh' }}>
              <span style={{ fontSize: '2vw', color: '#00D4FF' }}>2</span>
            </div>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>Deliver</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.5 }}>Track time, manage tasks, and monitor real-time project health</p>
          </div>
          <div style={{ flex: 1, padding: '3vh 2vw', borderRadius: '1vw', backgroundColor: 'rgba(27,42,74,0.6)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <div style={{ width: '4vw', height: '4vw', borderRadius: '50%', backgroundColor: 'rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2vh' }}>
              <span style={{ fontSize: '2vw', color: '#00D4FF' }}>3</span>
            </div>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>Invoice</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.5 }}>Generate accurate invoices from actuals with one-click billing</p>
          </div>
          <div style={{ flex: 1, padding: '3vh 2vw', borderRadius: '1vw', backgroundColor: 'rgba(27,42,74,0.6)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <div style={{ width: '4vw', height: '4vw', borderRadius: '50%', backgroundColor: 'rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2vh' }}>
              <span style={{ fontSize: '2vw', color: '#00D4FF' }}>4</span>
            </div>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>Analyze</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.5 }}>AI-powered insights across portfolio, revenue, and utilization</p>
          </div>
        </div>
      </div>
      <div className="absolute" style={{ bottom: '5vh', left: '8vw' }}>
        <div style={{ width: '20vw', height: '0.2vh', background: 'linear-gradient(to right, #00D4FF, transparent)' }} />
      </div>
    </div>
  );
}

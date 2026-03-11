const base = import.meta.env.BASE_URL;

export default function ProblemSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <img
        src={`${base}slides/problem-chaos.png`}
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover opacity-40"
        alt="Chaotic office environment"
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(11,22,40,0.95) 0%, rgba(11,22,40,0.85) 55%, rgba(11,22,40,0.6) 100%)' }} />
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
          The Problem
        </p>
        <h2
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '4.5vw',
            fontWeight: 700,
            lineHeight: 1.1,
            color: '#FFFFFF',
            marginBottom: '5vh',
            maxWidth: '55vw',
          }}
        >
          Consulting firms run on chaos
        </h2>
        <div className="flex" style={{ gap: '3vw', maxWidth: '75vw' }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: '3vw', height: '0.3vh', backgroundColor: '#00D4FF', marginBottom: '2vh' }} />
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>
              Scattered Spreadsheets
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4vw', fontWeight: 400, color: '#8B9DC3', lineHeight: 1.5 }}>
              Estimates in Excel, time in one tool, expenses in another, invoices in a fourth
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ width: '3vw', height: '0.3vh', backgroundColor: '#00D4FF', marginBottom: '2vh' }} />
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>
              Revenue Leakage
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4vw', fontWeight: 400, color: '#8B9DC3', lineHeight: 1.5 }}>
              Unbilled hours, missed expenses, and manual errors cost firms 5-15% of revenue
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ width: '3vw', height: '0.3vh', backgroundColor: '#00D4FF', marginBottom: '2vh' }} />
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>
              Zero Visibility
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4vw', fontWeight: 400, color: '#8B9DC3', lineHeight: 1.5 }}>
              No single view of project health, budget burn, or team utilization
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

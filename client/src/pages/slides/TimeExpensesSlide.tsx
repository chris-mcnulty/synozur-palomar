export default function TimeExpensesSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.06) 0%, transparent 50%)' }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: '8vw', paddingRight: '8vw' }}>
        <div className="flex" style={{ gap: '6vw' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
              Time, Expenses & Approvals
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
              Capture every billable dollar
            </h2>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '1.5vw',
                fontWeight: 400,
                color: '#8B9DC3',
                lineHeight: 1.6,
              }}
            >
              Frictionless time and expense tracking with built-in approval workflows ensures nothing falls through the cracks.
            </p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2.5vh' }}>
            <div className="flex" style={{ alignItems: 'flex-start', gap: '1.5vw' }}>
              <div style={{ width: '3.5vw', height: '3.5vw', borderRadius: '0.6vw', backgroundColor: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '1.6vw', color: '#00D4FF', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>T</span>
              </div>
              <div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5vh' }}>Daily Time Entry</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>Log hours against project tasks with role-rate auto-calculation</p>
              </div>
            </div>
            <div className="flex" style={{ alignItems: 'flex-start', gap: '1.5vw' }}>
              <div style={{ width: '3.5vw', height: '3.5vw', borderRadius: '0.6vw', backgroundColor: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '1.6vw', color: '#00D4FF', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>E</span>
              </div>
              <div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5vh' }}>Receipt-Based Expenses</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>Upload receipts with AI-powered data extraction and categorization</p>
              </div>
            </div>
            <div className="flex" style={{ alignItems: 'flex-start', gap: '1.5vw' }}>
              <div style={{ width: '3.5vw', height: '3.5vw', borderRadius: '0.6vw', backgroundColor: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '1.6vw', color: '#00D4FF', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>A</span>
              </div>
              <div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5vh' }}>Multi-Level Approvals</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>Configurable approval chains for time, expenses, and reimbursements</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute" style={{ bottom: '4vh', left: '8vw', right: '8vw', height: '0.15vh', background: 'linear-gradient(to right, rgba(0,212,255,0.3), transparent 50%, rgba(0,212,255,0.3))' }} />
    </div>
  );
}

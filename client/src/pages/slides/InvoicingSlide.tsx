export default function InvoicingSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(200deg, rgba(0,212,255,0.05) 0%, transparent 40%)' }} />
      <div className="absolute inset-0 flex flex-col" style={{ paddingLeft: '8vw', paddingRight: '8vw', paddingTop: '10vh' }}>
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
          Automated Invoicing
        </p>
        <h2
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '4vw',
            fontWeight: 700,
            lineHeight: 1.1,
            color: '#FFFFFF',
            marginBottom: '2vh',
          }}
        >
          From timesheet to invoice in seconds
        </h2>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '1.5vw',
            fontWeight: 400,
            color: '#8B9DC3',
            lineHeight: 1.5,
            marginBottom: '5vh',
            maxWidth: '55vw',
          }}
        >
          Automatically generate accurate invoices from approved time and expenses with complete audit trails.
        </p>
        <div className="flex" style={{ gap: '2vw', flex: 1, maxHeight: '45vh' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '3vh 2vw', borderRadius: '1vw', backgroundColor: 'rgba(27,42,74,0.4)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '8vw', fontWeight: 800, color: '#00D4FF', lineHeight: 1, opacity: 0.9 }}>1</p>
            </div>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>Batch Selection</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>Select approved time and expenses for billing period</p>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '3vh 2vw', borderRadius: '1vw', backgroundColor: 'rgba(27,42,74,0.4)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '8vw', fontWeight: 800, color: '#00D4FF', lineHeight: 1, opacity: 0.9 }}>2</p>
            </div>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>Auto-Generate</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>PDF invoices created with line-item detail and branding</p>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '3vh 2vw', borderRadius: '1vw', backgroundColor: 'rgba(27,42,74,0.4)', border: '1px solid rgba(0,212,255,0.1)' }}>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '8vw', fontWeight: 800, color: '#00D4FF', lineHeight: 1, opacity: 0.9 }}>3</p>
            </div>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 600, color: '#FFFFFF', marginBottom: '1vh' }}>Deliver & Track</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#8B9DC3', lineHeight: 1.4 }}>Email delivery with payment tracking and revenue reporting</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const base = import.meta.env.BASE_URL;

export default function AIIntegrationSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <img
        src={`${base}slides/ai-integration.png`}
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
        alt="AI neural network visualization"
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(11,22,40,0.9) 0%, rgba(11,22,40,0.7) 50%, rgba(11,22,40,0.95) 100%)' }} />
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
          AI + Microsoft 365
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
          Intelligent by design
        </h2>
        <div className="flex" style={{ gap: '4vw' }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '3vh' }}>
              <div style={{ width: '5vw', height: '0.3vh', backgroundColor: '#00D4FF', marginBottom: '2.5vh' }} />
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '1.5vh' }}>AI-Powered Insights</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4vw', color: '#C8D6E5', lineHeight: 1.5 }}>
                Natural language queries across your entire project portfolio powered by OpenAI
              </p>
            </div>
            <div>
              <div style={{ width: '5vw', height: '0.3vh', backgroundColor: '#00D4FF', marginBottom: '2.5vh' }} />
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '1.5vh' }}>Smart Receipt Processing</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4vw', color: '#C8D6E5', lineHeight: 1.5 }}>
                AI extracts vendor, amount, and category from uploaded receipt images automatically
              </p>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '3vh' }}>
              <div style={{ width: '5vw', height: '0.3vh', backgroundColor: '#00D4FF', marginBottom: '2.5vh' }} />
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '1.5vh' }}>Outlook Integration</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4vw', color: '#C8D6E5', lineHeight: 1.5 }}>
                Email notifications and invoice delivery through your existing Microsoft 365 tenant
              </p>
            </div>
            <div>
              <div style={{ width: '5vw', height: '0.3vh', backgroundColor: '#00D4FF', marginBottom: '2.5vh' }} />
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '1.5vh' }}>SharePoint Storage</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4vw', color: '#C8D6E5', lineHeight: 1.5 }}>
                Documents, receipts, and invoices stored securely in your SharePoint environment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

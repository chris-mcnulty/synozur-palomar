export default function ProjectDeliverySlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(0,212,255,0.04) 0%, transparent 40%, rgba(0,212,255,0.03) 100%)' }} />
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
          Project Delivery
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
          Deliver with confidence
        </h2>
        <div className="flex" style={{ gap: '3vw' }}>
          <div style={{ flex: 1 }}>
            <div style={{ padding: '3vh 2vw', borderRadius: '1vw', background: 'linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(27,42,74,0.5) 100%)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '1.5vh' }}>
                Real-Time Dashboards
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#C8D6E5', lineHeight: 1.5 }}>
                Live budget burn, schedule variance, and resource utilization at a glance
              </p>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ padding: '3vh 2vw', borderRadius: '1vw', background: 'linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(27,42,74,0.5) 100%)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '1.5vh' }}>
                Portfolio Timeline
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#C8D6E5', lineHeight: 1.5 }}>
                Cross-project Gantt views with milestone tracking and dependency management
              </p>
            </div>
          </div>
        </div>
        <div className="flex" style={{ gap: '3vw', marginTop: '2.5vh' }}>
          <div style={{ flex: 1 }}>
            <div style={{ padding: '3vh 2vw', borderRadius: '1vw', background: 'linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(27,42,74,0.5) 100%)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '1.5vh' }}>
                RAIDD Log
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#C8D6E5', lineHeight: 1.5 }}>
                Track risks, actions, issues, decisions, and dependencies across every engagement
              </p>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ padding: '3vh 2vw', borderRadius: '1vw', background: 'linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(27,42,74,0.5) 100%)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '1.5vh' }}>
                Resource Management
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3vw', color: '#C8D6E5', lineHeight: 1.5 }}>
                Staff projects optimally with cross-project resource allocation and capacity planning
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

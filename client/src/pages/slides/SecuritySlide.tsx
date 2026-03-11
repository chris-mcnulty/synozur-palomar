export default function SecuritySlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor: '#0B1628' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,212,255,0.04) 0%, transparent 60%)' }} />
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingLeft: '8vw', paddingRight: '8vw' }}>
        <div className="flex" style={{ gap: '6vw', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
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
              Security & Multi-Tenancy
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
              Enterprise-grade, from day one
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
              Built for consulting firms that need data isolation, SSO, and compliance without compromise.
            </p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.8vh' }}>
            <div className="flex" style={{ alignItems: 'center', gap: '1.5vw', padding: '2vh 2vw', borderRadius: '0.8vw', backgroundColor: 'rgba(27,42,74,0.4)', border: '1px solid rgba(0,212,255,0.12)' }}>
              <div style={{ width: '3vw', height: '3vw', borderRadius: '50%', background: 'linear-gradient(135deg, #00D4FF, #0088CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#FFFFFF', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.3vw' }}>S</span>
              </div>
              <div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF' }}>Microsoft Entra SSO</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.2vw', color: '#8B9DC3' }}>SAML/OIDC single sign-on with your Azure AD tenant</p>
              </div>
            </div>
            <div className="flex" style={{ alignItems: 'center', gap: '1.5vw', padding: '2vh 2vw', borderRadius: '0.8vw', backgroundColor: 'rgba(27,42,74,0.4)', border: '1px solid rgba(0,212,255,0.12)' }}>
              <div style={{ width: '3vw', height: '3vw', borderRadius: '50%', background: 'linear-gradient(135deg, #00D4FF, #0088CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#FFFFFF', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.3vw' }}>M</span>
              </div>
              <div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF' }}>Full Data Isolation</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.2vw', color: '#8B9DC3' }}>Each tenant's data is completely isolated at the database level</p>
              </div>
            </div>
            <div className="flex" style={{ alignItems: 'center', gap: '1.5vw', padding: '2vh 2vw', borderRadius: '0.8vw', backgroundColor: 'rgba(27,42,74,0.4)', border: '1px solid rgba(0,212,255,0.12)' }}>
              <div style={{ width: '3vw', height: '3vw', borderRadius: '50%', background: 'linear-gradient(135deg, #00D4FF, #0088CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#FFFFFF', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.3vw' }}>R</span>
              </div>
              <div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF' }}>Role-Based Access</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.2vw', color: '#8B9DC3' }}>Granular permissions from platform admin to team member</p>
              </div>
            </div>
            <div className="flex" style={{ alignItems: 'center', gap: '1.5vw', padding: '2vh 2vw', borderRadius: '0.8vw', backgroundColor: 'rgba(27,42,74,0.4)', border: '1px solid rgba(0,212,255,0.12)' }}>
              <div style={{ width: '3vw', height: '3vw', borderRadius: '50%', background: 'linear-gradient(135deg, #00D4FF, #0088CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#FFFFFF', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.3vw' }}>P</span>
              </div>
              <div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4vw', fontWeight: 600, color: '#FFFFFF' }}>Platform Administration</p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.2vw', color: '#8B9DC3' }}>Centralized management of tenants, plans, and usage</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

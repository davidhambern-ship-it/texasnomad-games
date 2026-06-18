import React from "react";
import { Link } from "react-router-dom";

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#050308', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>

      {/* TNG Brand Header */}
      <Link to="/welcome" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 24, textDecoration: 'none' }}>
        <img
          src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/1954440a1_logoimage-3-nobg.png"
          alt="TexasNomad"
          style={{ width: 52, height: 52, objectFit: 'contain', filter: 'drop-shadow(0 0 14px rgba(188,19,254,0.7))' }}
        />
        <span style={{ fontFamily: "'Teko', sans-serif", fontSize: 22, color: '#BC13FE', letterSpacing: '0.3em', textShadow: '0 0 20px rgba(188,19,254,0.5)' }}>
          TEXASNOMAD<span style={{ color: '#FFD700' }}>GAMES</span>
        </span>
      </Link>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 440, borderRadius: 20, border: '2px solid rgba(188,19,254,0.3)', background: 'rgba(10,3,24,0.95)', boxShadow: '0 0 60px rgba(188,19,254,0.15), 0 24px 60px rgba(0,0,0,0.8)', padding: '32px 28px' }}>

        {/* Title block */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14, background: 'rgba(188,19,254,0.15)', border: '2px solid rgba(188,19,254,0.4)', marginBottom: 14 }}>
            <Icon style={{ width: 22, height: 22, color: '#BC13FE' }} aria-hidden="true" />
          </div>
          <h1 style={{ fontFamily: "'Teko', sans-serif", fontSize: 30, color: 'white', letterSpacing: '0.1em', margin: 0 }}>{title}</h1>
          {subtitle && <div style={{ marginTop: 10 }}>{typeof subtitle === 'string'
            ? <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{subtitle}</p>
            : subtitle
          }</div>}
        </div>

        {children}
      </div>

      {/* Footer */}
      {footer && (
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: "'Inter', sans-serif" }}>
          {footer}
        </p>
      )}
    </div>
  );
}
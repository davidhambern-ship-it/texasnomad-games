import React from "react";

const GAME_THEMES = {
  bff:          { title: "BFF",                subtitle: "BIGO Family Feud",               accent: "#ffd700", marquee: "linear-gradient(90deg,#31005a,#8b2eff,#31005a)" },
  squarebiz:    { title: "Square Biz!",         subtitle: "Trivia Tic-Tac-Toe",             accent: "#ff5f1f", marquee: "linear-gradient(90deg,#18051f,#ff5f1f,#18051f)" },
  spades:       { title: "TexasNomad Spades",   subtitle: "Cut, Bid, and Bag",              accent: "#00d084", marquee: "linear-gradient(90deg,#031b13,#064b35,#031b13)" },
  hangman:      { title: "Hangman",             subtitle: "Western Word Guess",             accent: "#c07a2c", marquee: "linear-gradient(90deg,#241207,#6c3b12,#241207)" },
  wordsearch:   { title: "Nomadic Word Search", subtitle: "Find It Before Time Runs Out",   accent: "#bc13fe", marquee: "linear-gradient(90deg,#12051f,#39125a,#12051f)" },
  hiddenobject: { title: "See That!",           subtitle: "Hidden Object Arcade",           accent: "#ffffff", marquee: "linear-gradient(90deg,#12051f,#39125a,#12051f)" },
};

const BUTTON_COLORS = {
  "":          { bg: "radial-gradient(circle at 32% 25%,#fff,#ff5f1f 20%,#9c2800 72%)", shadow: "0 10px 0 #4b1200,0 0 22px rgba(255,95,31,.7)" },
  secondary:   { bg: "radial-gradient(circle at 32% 25%,#fff,#bc13fe 22%,#4d0870 72%)", shadow: "0 10px 0 #260238,0 0 22px rgba(188,19,254,.7)" },
  success:     { bg: "radial-gradient(circle at 32% 25%,#fff,#00d084 22%,#006b45 72%)", shadow: "0 10px 0 #003b26,0 0 22px rgba(0,208,132,.7)" },
};

export default function ArcadeMachine({ game = "bff", children, controls = [], status = "READY", roomCode = "" }) {
  const theme = GAME_THEMES[game] || GAME_THEMES.bff;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at top,rgba(188,19,254,.25),transparent 35%),linear-gradient(180deg,#05020c,#090614 55%,#020106)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "28px 12px", color: "white",
    }}>
      <div style={{
        width: "min(1180px,100%)", borderRadius: "34px 34px 24px 24px",
        background: "linear-gradient(135deg,rgba(255,255,255,.12),transparent 18%),linear-gradient(180deg,#221034,#12091f 45%,#07030d)",
        border: `5px solid ${theme.accent}`,
        boxShadow: `0 0 35px ${theme.accent}80,0 0 65px rgba(188,19,254,.35),inset 0 0 45px rgba(255,255,255,.08)`,
        overflow: "hidden", position: "relative",
      }}>

        {/* Marquee */}
        <div style={{
          position: "relative", textAlign: "center", padding: "24px 16px 18px",
          background: theme.marquee, borderBottom: "4px solid #00d084",
          boxShadow: "inset 0 -10px 30px rgba(0,0,0,.45)",
        }}>
          <h1 style={{
            margin: 0, fontSize: "clamp(2.2rem,5vw,5rem)", letterSpacing: 3,
            textTransform: "uppercase", color: "#fff",
            textShadow: "0 0 8px #fff,0 0 18px #bc13fe,0 0 32px #ff5f1f",
          }}>{theme.title}</h1>
          <p style={{ margin: "6px 0 0", color: "#ffd9c7", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>
            {theme.subtitle}
          </p>
        </div>

        {/* Body */}
        <div style={{
          display: "grid", gridTemplateColumns: "90px 1fr 90px", gap: 12, padding: "24px 20px 18px",
          background: "radial-gradient(circle at center,rgba(0,208,132,.12),transparent 45%),linear-gradient(180deg,#0b0613,#150a22)",
        }}>
          {/* Side art */}
          <div style={{
            borderRadius: 18,
            background: "linear-gradient(180deg,rgba(255,95,31,.35),rgba(188,19,254,.22)),repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 8px,transparent 8px 16px)",
            border: "2px solid rgba(255,255,255,.18)", boxShadow: "inset 0 0 18px rgba(0,0,0,.6)",
          }} />

          {/* Monitor */}
          <div style={{
            padding: 18, borderRadius: 30,
            background: "linear-gradient(145deg,#040306,#292333 35%,#050306 70%)",
            border: "6px solid #111", boxShadow: "inset 0 0 24px rgba(255,255,255,.12),0 0 30px rgba(0,0,0,.8)",
          }}>
            <div style={{
              position: "relative", borderRadius: 24, overflow: "hidden", background: "#020305",
              minHeight: 560, border: "3px solid rgba(255,255,255,.16)",
              boxShadow: "inset 0 0 60px rgba(0,0,0,.9),inset 0 0 24px rgba(0,208,132,.18)",
            }}>
              {/* Screen reflection */}
              <div style={{
                pointerEvents: "none", position: "absolute", inset: 0, zIndex: 5,
                background: "linear-gradient(120deg,rgba(255,255,255,.22),transparent 26%),radial-gradient(circle at 70% 12%,rgba(255,255,255,.16),transparent 18%)",
                mixBlendMode: "screen",
              }} />
              {/* Scanlines */}
              <div style={{
                pointerEvents: "none", position: "absolute", inset: 0, zIndex: 6, opacity: .42,
                background: "repeating-linear-gradient(to bottom,rgba(255,255,255,.035) 0px,rgba(255,255,255,.035) 1px,transparent 1px,transparent 5px)",
              }} />
              {/* Vignette */}
              <div style={{
                pointerEvents: "none", position: "absolute", inset: 0, zIndex: 7, borderRadius: 24,
                boxShadow: "inset 0 0 90px rgba(0,0,0,.95)",
              }} />
              {/* Game content */}
              <div style={{ position: "relative", zIndex: 2, minHeight: 560, padding: 18 }}>
                {children}
              </div>
            </div>
          </div>

          {/* Side art right */}
          <div style={{
            borderRadius: 18,
            background: "linear-gradient(180deg,rgba(255,95,31,.35),rgba(188,19,254,.22)),repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 8px,transparent 8px 16px)",
            border: "2px solid rgba(255,255,255,.18)", boxShadow: "inset 0 0 18px rgba(0,0,0,.6)",
          }} />
        </div>

        {/* Controller deck */}
        <div style={{
          display: "grid", gridTemplateColumns: "190px 1fr 420px", alignItems: "center",
          gap: 22, padding: "24px 26px 28px",
          background: "linear-gradient(180deg,#271335,#14091d)",
          borderTop: "5px solid #ff5f1f", boxShadow: "inset 0 18px 35px rgba(255,255,255,.06)",
        }}>
          {/* Joystick */}
          <div style={{ position: "relative", height: 150, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            <div style={{
              position: "absolute", bottom: 42, width: 22, height: 76, borderRadius: 14,
              background: "linear-gradient(90deg,#111,#777,#111)", transform: "rotate(-10deg)",
              transformOrigin: "bottom center", zIndex: 2,
            }} />
            <div style={{
              position: "absolute", bottom: 105, width: 58, height: 58, borderRadius: "50%",
              background: "radial-gradient(circle at 30% 25%,#fff,#ff5f1f 26%,#b83200 70%)",
              border: "3px solid rgba(255,255,255,.45)", boxShadow: "0 0 20px rgba(255,95,31,.8)", zIndex: 3,
            }} />
            <div style={{
              width: 112, height: 42, borderRadius: "50%",
              background: "linear-gradient(180deg,#0a0a0d,#2a2630)",
              border: "4px solid #00d084", boxShadow: "0 0 18px rgba(0,208,132,.45)",
            }} />
            <span style={{ position: "absolute", bottom: -14, fontSize: ".65rem", opacity: .5, letterSpacing: 1 }}>DISPLAY JOYSTICK</span>
          </div>

          {/* Info */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{
              width: 62, height: 92, borderRadius: 10, position: "relative",
              background: "linear-gradient(180deg,#060606,#242424)", border: "3px solid #777",
            }}>
              <div style={{
                position: "absolute", top: 18, left: 14, width: 34, height: 8,
                borderRadius: 8, background: "#111", border: "1px solid #aaa",
              }} />
            </div>
            <div style={{
              padding: "10px 16px", borderRadius: 999, background: "rgba(0,0,0,.45)",
              border: "2px solid rgba(255,255,255,.18)", color: "#00d084",
              fontWeight: 900, letterSpacing: 1, boxShadow: "inset 0 0 12px rgba(0,208,132,.2)",
            }}>{status}</div>
            {roomCode && (
              <div style={{
                padding: "10px 16px", borderRadius: 999, background: "rgba(0,0,0,.45)",
                border: "2px solid rgba(255,255,255,.18)", color: "#00d084",
                fontWeight: 900, letterSpacing: 1, boxShadow: "inset 0 0 12px rgba(0,208,132,.2)",
              }}>ROOM {roomCode}</div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {controls.map((btn, i) => {
              const colors = BUTTON_COLORS[btn.variant || ""] || BUTTON_COLORS[""];
              return (
                <button key={i} onClick={btn.onClick} disabled={btn.disabled} style={{
                  width: 104, height: 104, borderRadius: "50%",
                  border: "5px solid rgba(255,255,255,.35)",
                  background: colors.bg, color: "white", fontWeight: 900, fontSize: ".9rem",
                  textShadow: "0 2px 3px rgba(0,0,0,.7)", boxShadow: colors.shadow,
                  cursor: btn.disabled ? "not-allowed" : "pointer",
                  opacity: btn.disabled ? .45 : 1,
                  filter: btn.disabled ? "grayscale(1)" : "none",
                  transition: "transform .12s ease,box-shadow .12s ease",
                }}>{btn.label}</button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center", padding: 14, background: "#050207",
          borderTop: "2px solid rgba(255,255,255,.12)", color: "#fff", fontWeight: 900, letterSpacing: 3,
        }}>
          TEXASNOMAD GAMES
        </div>
      </div>
    </div>
  );
}
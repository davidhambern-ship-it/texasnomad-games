.arcade-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(188, 19, 254, 0.25), transparent 35%),
    linear-gradient(180deg, #05020c, #090614 55%, #020106);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 28px 12px;
  color: white;
}

.arcade-cabinet {
  width: min(1180px, 100%);
  border-radius: 34px 34px 24px 24px;
  background:
    linear-gradient(135deg, rgba(255,255,255,.12), transparent 18%),
    linear-gradient(180deg, #221034, #12091f 45%, #07030d);
  border: 5px solid #ff5f1f;
  box-shadow:
    0 0 35px rgba(255, 95, 31, .5),
    0 0 65px rgba(188, 19, 254, .35),
    inset 0 0 45px rgba(255,255,255,.08);
  overflow: hidden;
  position: relative;
}

.arcade-marquee {
  position: relative;
  text-align: center;
  padding: 24px 16px 18px;
  background:
    linear-gradient(90deg, #12051f, #39125a, #12051f);
  border-bottom: 4px solid #00d084;
  box-shadow: inset 0 -10px 30px rgba(0,0,0,.45);
}

.arcade-marquee h1 {
  margin: 0;
  font-size: clamp(2.2rem, 5vw, 5rem);
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #fff;
  text-shadow:
    0 0 8px #fff,
    0 0 18px #bc13fe,
    0 0 32px #ff5f1f;
}

.arcade-marquee p {
  margin: 6px 0 0;
  color: #ffd9c7;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-weight: 700;
}

.arcade-body {
  display: grid;
  grid-template-columns: 90px 1fr 90px;
  gap: 12px;
  padding: 24px 20px 18px;
  background:
    radial-gradient(circle at center, rgba(0,208,132,.12), transparent 45%),
    linear-gradient(180deg, #0b0613, #150a22);
}

.side-art {
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255,95,31,.35), rgba(188,19,254,.22)),
    repeating-linear-gradient(
      45deg,
      rgba(255,255,255,.08) 0 8px,
      transparent 8px 16px
    );
  border: 2px solid rgba(255,255,255,.18);
  box-shadow: inset 0 0 18px rgba(0,0,0,.6);
}

.arcade-monitor-frame {
  padding: 18px;
  border-radius: 30px;
  background:
    linear-gradient(145deg, #040306, #292333 35%, #050306 70%);
  border: 6px solid #111;
  box-shadow:
    inset 0 0 24px rgba(255,255,255,.12),
    0 0 30px rgba(0,0,0,.8);
}

.monitor-glass {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background: #020305;
  min-height: 560px;
  border: 3px solid rgba(255,255,255,.16);
  box-shadow:
    inset 0 0 60px rgba(0,0,0,.9),
    inset 0 0 24px rgba(0,208,132,.18);
}

.game-screen {
  position: relative;
  z-index: 2;
  min-height: 560px;
  padding: 18px;
}

.screen-reflection {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 5;
  background:
    linear-gradient(120deg, rgba(255,255,255,.22), transparent 26%),
    radial-gradient(circle at 70% 12%, rgba(255,255,255,.16), transparent 18%);
  mix-blend-mode: screen;
}

.scanlines {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 6;
  background: repeating-linear-gradient(
    to bottom,
    rgba(255,255,255,.035) 0px,
    rgba(255,255,255,.035) 1px,
    transparent 1px,
    transparent 5px
  );
  opacity: .42;
}

.monitor-glass::after {
  content: "";
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 7;
  box-shadow: inset 0 0 90px rgba(0,0,0,.95);
  border-radius: 24px;
}

.controller-deck {
  display: grid;
  grid-template-columns: 190px 1fr 420px;
  align-items: center;
  gap: 22px;
  padding: 24px 26px 28px;
  background:
    linear-gradient(180deg, #271335, #14091d),
    radial-gradient(circle at center, rgba(255,95,31,.18), transparent 55%);
  border-top: 5px solid #ff5f1f;
  box-shadow: inset 0 18px 35px rgba(255,255,255,.06);
}

.joystick-wrap {
  position: relative;
  height: 150px;
  display: flex;
  justify-content: center;
  align-items: end;
}

.joystick-base {
  width: 112px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(180deg, #0a0a0d, #2a2630);
  border: 4px solid #00d084;
  box-shadow: 0 0 18px rgba(0,208,132,.45);
}

.joystick-stick {
  position: absolute;
  bottom: 42px;
  width: 22px;
  height: 76px;
  border-radius: 14px;
  background: linear-gradient(90deg, #111, #777, #111);
  transform: rotate(-10deg);
  transform-origin: bottom center;
  z-index: 2;
}

.joystick-ball {
  position: absolute;
  bottom: 105px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, #fff, #ff5f1f 26%, #b83200 70%);
  border: 3px solid rgba(255,255,255,.45);
  box-shadow: 0 0 20px rgba(255,95,31,.8);
  z-index: 3;
}

.joystick-wrap span {
  position: absolute;
  bottom: -14px;
  font-size: .65rem;
  opacity: .5;
  letter-spacing: 1px;
}

.deck-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.coin-slot {
  width: 62px;
  height: 92px;
  border-radius: 10px;
  background: linear-gradient(180deg, #060606, #242424);
  border: 3px solid #777;
  position: relative;
}

.coin-slot::before {
  content: "";
  position: absolute;
  top: 18px;
  left: 14px;
  width: 34px;
  height: 8px;
  border-radius: 8px;
  background: #111;
  border: 1px solid #aaa;
}

.status-light,
.room-code {
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(0,0,0,.45);
  border: 2px solid rgba(255,255,255,.18);
  color: #00d084;
  font-weight: 900;
  letter-spacing: 1px;
  box-shadow: inset 0 0 12px rgba(0,208,132,.2);
}

.arcade-buttons {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.arcade-button {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  border: 5px solid rgba(255,255,255,.35);
  background:
    radial-gradient(circle at 32% 25%, #fff, #ff5f1f 20%, #9c2800 72%);
  color: white;
  font-weight: 1000;
  font-size: .9rem;
  text-shadow: 0 2px 3px rgba(0,0,0,.7);
  box-shadow:
    0 10px 0 #4b1200,
    0 0 22px rgba(255,95,31,.7);
  cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease;
}

.arcade-button:hover {
  transform: translateY(-3px);
}

.arcade-button:active {
  transform: translateY(8px);
  box-shadow:
    0 2px 0 #4b1200,
    0 0 18px rgba(255,95,31,.7);
}

.arcade-button.secondary {
  background:
    radial-gradient(circle at 32% 25%, #fff, #bc13fe 22%, #4d0870 72%);
  box-shadow:
    0 10px 0 #260238,
    0 0 22px rgba(188,19,254,.7);
}

.arcade-button.success {
  background:
    radial-gradient(circle at 32% 25%, #fff, #00d084 22%, #006b45 72%);
  box-shadow:
    0 10px 0 #003b26,
    0 0 22px rgba(0,208,132,.7);
}

.arcade-button:disabled {
  opacity: .45;
  cursor: not-allowed;
  filter: grayscale(1);
}

.cabinet-footer {
  text-align: center;
  padding: 14px;
  background: #050207;
  border-top: 2px solid rgba(255,255,255,.12);
  color: #fff;
  font-weight: 900;
  letter-spacing: 3px;
}

.theme-bff .arcade-cabinet {
  border-color: #ffd700;
}

.theme-bff .arcade-marquee {
  background: linear-gradient(90deg, #31005a, #8b2eff, #31005a);
}

.theme-squarebiz .arcade-cabinet {
  border-color: #ff5f1f;
}

.theme-squarebiz .arcade-marquee {
  background: linear-gradient(90deg, #18051f, #ff5f1f, #18051f);
}

.theme-spades .arcade-cabinet {
  border-color: #00d084;
}

.theme-spades .arcade-marquee {
  background: linear-gradient(90deg, #031b13, #064b35, #031b13);
}

.theme-hangman .arcade-cabinet {
  border-color: #c07a2c;
}

.theme-hangman .arcade-marquee {
  background: linear-gradient(90deg, #241207, #6c3b12, #241207);
}

.theme-wordsearch .arcade-cabinet {
  border-color: #bc13fe;
}

.theme-hiddenobject .arcade-cabinet {
  border-color: #ffffff;
}

@media (max-width: 900px) {
  .arcade-body {
    grid-template-columns: 1fr;
  }

  .side-art {
    display: none;
  }

  .controller-deck {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .arcade-buttons {
    justify-content: center;
  }

  .arcade-button {
    width: 82px;
    height: 82px;
    font-size: .72rem;
  }

  .monitor-glass,
  .game-screen {
    min-height: 420px;
  }
}
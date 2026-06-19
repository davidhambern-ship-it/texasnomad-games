import React from "react";
import "./ArcadeMachine.css";

const GAME_THEMES = {
  bff: {
    title: "BFF",
    subtitle: "BIGO Family Feud",
    className: "theme-bff",
  },
  squarebiz: {
    title: "Square Biz!",
    subtitle: "Trivia Tic-Tac-Toe",
    className: "theme-squarebiz",
  },
  spades: {
    title: "TexasNomad Spades",
    subtitle: "Cut, Bid, and Bag",
    className: "theme-spades",
  },
  hangman: {
    title: "Hangman",
    subtitle: "Western Word Guess",
    className: "theme-hangman",
  },
  wordsearch: {
    title: "Nomadic Word Search",
    subtitle: "Find It Before Time Runs Out",
    className: "theme-wordsearch",
  },
  hiddenobject: {
    title: "See That!",
    subtitle: "Hidden Object Arcade",
    className: "theme-hiddenobject",
  },
};

export default function ArcadeMachine({
  game = "bff",
  children,
  controls = [],
  status = "READY",
  roomCode = "",
}) {
  const theme = GAME_THEMES[game] || GAME_THEMES.bff;

  return (
    <div className={`arcade-page ${theme.className}`}>
      <div className="arcade-cabinet">
        <div className="arcade-marquee">
          <div className="marquee-glow" />
          <h1>{theme.title}</h1>
          <p>{theme.subtitle}</p>
        </div>

        <div className="arcade-body">
          <div className="side-art side-art-left" />

          <div className="arcade-monitor-frame">
            <div className="monitor-glass">
              <div className="screen-reflection" />
              <div className="scanlines" />
              <div className="game-screen">
                {children}
              </div>
            </div>
          </div>

          <div className="side-art side-art-right" />
        </div>

        <div className="controller-deck">
          <div className="joystick-wrap">
            <div className="joystick-stick" />
            <div className="joystick-ball" />
            <div className="joystick-base" />
            <span>DISPLAY JOYSTICK</span>
          </div>

          <div className="deck-info">
            <div className="coin-slot" />
            <div className="status-light">{status}</div>
            {roomCode && <div className="room-code">ROOM {roomCode}</div>}
          </div>

          <div className="arcade-buttons">
            {controls.map((button, index) => (
              <button
                key={index}
                className={`arcade-button ${button.variant || ""}`}
                onClick={button.onClick}
                disabled={button.disabled}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cabinet-footer">
          TEXASNOMAD GAMES
        </div>
      </div>
    </div>
  );
}
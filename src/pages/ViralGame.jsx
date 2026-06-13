import React from 'react';
import { motion } from 'framer-motion';
import { Code, Rocket, Clock } from 'lucide-react';

export default function ViralGame() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8"
      style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="mb-8"
        >
          <Rocket className="w-24 h-24 mx-auto" style={{ color: '#BC13FE' }} />
        </motion.div>

        <h1 
          className="text-5xl md:text-6xl font-bold mb-4"
          style={{
            fontFamily: "'Monoton', cursive",
            background: 'linear-gradient(135deg, #BC13FE, #FF5F1F, #FFD700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          VIRAL!
        </h1>

        <div className="flex items-center justify-center gap-3 mb-6">
          <Clock className="w-6 h-6" style={{ color: '#FF5F1F' }} />
          <span 
            className="text-2xl md:text-3xl font-bold uppercase tracking-widest"
            style={{ fontFamily: "'Press Start 2P', monospace", color: '#FFD700' }}
          >
            In Development
          </span>
        </div>

        <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
          We're crafting something epic! This game is currently in development and will be available soon.
          Stay tuned for updates!
        </p>

        <div 
          className="inline-flex items-center gap-3 px-6 py-4 rounded-xl border-2"
          style={{
            borderColor: '#BC13FE40',
            background: 'rgba(188, 19, 254, 0.1)',
            boxShadow: '0 0 30px rgba(188, 19, 254, 0.2)',
          }}
        >
          <Code className="w-5 h-5" style={{ color: '#BC13FE' }} />
          <span className="text-sm text-white/70">Coming Soon to TexasNomad Arcade</span>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 max-w-md mx-auto">
          {[
            { icon: '🎲', label: 'Board Game' },
            { icon: '👥', label: 'Multiplayer' },
            { icon: '🏆', label: 'Competitive' },
          ].map((feature, idx) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.2 }}
              className="text-center p-4 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="text-xs text-white/50 uppercase tracking-wider">{feature.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
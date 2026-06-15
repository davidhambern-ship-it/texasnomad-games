// Dense, cluttered saloon scene designed to make hidden objects hard to find
export default function SaloonBackground() {
  return (
    <svg
      width="100%" height="100%"
      viewBox="0 0 900 600"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <radialGradient id="skyGrad" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#2a1508" />
          <stop offset="100%" stopColor="#080504" />
        </radialGradient>
        <pattern id="woodH" patternUnits="userSpaceOnUse" width="60" height="18">
          <rect width="60" height="18" fill="#3a1a08" />
          <line x1="0" y1="0" x2="60" y2="0" stroke="#4a2810" strokeWidth="1" opacity="0.6" />
          <line x1="0" y1="17" x2="60" y2="17" stroke="#2a1006" strokeWidth="1" opacity="0.4" />
        </pattern>
        <pattern id="woodV" patternUnits="userSpaceOnUse" width="22" height="60">
          <rect width="22" height="60" fill="#3d1c0a" />
          <line x1="0" y1="0" x2="0" y2="60" stroke="#4a2210" strokeWidth="1" opacity="0.5" />
          <line x1="21" y1="0" x2="21" y2="60" stroke="#2a1008" strokeWidth="0.5" opacity="0.3" />
        </pattern>
        <pattern id="brick" patternUnits="userSpaceOnUse" width="40" height="20">
          <rect width="40" height="20" fill="#4a2218" />
          <rect x="0" y="0" width="38" height="9" fill="#5a2a1e" rx="1"/>
          <rect x="20" y="11" width="18" height="9" fill="#5a2a1e" rx="1"/>
          <rect x="0" y="11" width="18" height="9" fill="#5a2a1e" rx="1"/>
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="softBlur"><feGaussianBlur stdDeviation="1.5"/></filter>
        <linearGradient id="counterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a3c18"/><stop offset="100%" stopColor="#3d1c0a"/>
        </linearGradient>
        <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1a0c"/><stop offset="100%" stopColor="#0e0905"/>
        </linearGradient>
        <linearGradient id="shadowFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)"/><stop offset="100%" stopColor="rgba(0,0,0,0.6)"/>
        </linearGradient>
      </defs>

      {/* Base layers */}
      <rect width="900" height="600" fill="url(#skyGrad)" />
      <rect x="0" y="0" width="900" height="390" fill="url(#brick)" opacity="0.8"/>
      <rect x="0" y="0" width="900" height="390" fill="url(#woodV)" opacity="0.25"/>
      <rect x="0" y="0" width="900" height="55" fill="#1a0c06"/>
      {[0,180,360,540,720].map((x,i)=>(
        <rect key={i} x={x} y="0" width="28" height="400" fill="#0e0703" opacity="0.55"/>
      ))}
      {[30,80,130].map((y,i)=>(
        <rect key={i} x="0" y={y} width="900" height="10" fill="#0e0703" opacity="0.4"/>
      ))}

      {/* Left bookcase */}
      <rect x="0" y="55" width="175" height="340" fill="#2a1208" stroke="#3d1c0a" strokeWidth="2"/>
      {[115,175,235,295,355].map((y,i)=>(
        <rect key={i} x="0" y={y} width="175" height="8" fill="#4a2210"/>
      ))}
      {[8,22,34,46,58,72,86,98,112,124,138,150].map((x,i)=>(
        <rect key={i} x={x} y={62} width={10+i%4*2} height={46}
          fill={['#8B1a1a','#1a4a8B','#1a8B2a','#8B6a1a','#6a1a8B','#8B3a1a'][i%6]} opacity="0.9"/>
      ))}
      {[5,18,32,45,57,70,84,96,110,122,136,150,162].map((x,i)=>(
        <rect key={i} x={x} y={122} width={9+i%3*3} height={44}
          fill={['#4a2a8B','#8B4a1a','#2a8B4a','#8B8B1a','#1a8B8B'][i%5]} opacity="0.85"/>
      ))}
      <text x="10" y="228" fontSize="14">🏺</text><text x="40" y="228" fontSize="12">🔑</text>
      <text x="62" y="228" fontSize="16">🦴</text><text x="88" y="226" fontSize="12">📜</text>
      <text x="108" y="226" fontSize="14">🧲</text><text x="130" y="228" fontSize="12">🪶</text>
      <text x="150" y="228" fontSize="14">⚙️</text>
      <text x="8"  y="288" fontSize="13">🧴</text><text x="30" y="290" fontSize="11">🔩</text>
      <text x="50" y="288" fontSize="14">🕯️</text><text x="76" y="290" fontSize="12">🪤</text>
      <text x="98" y="288" fontSize="13">🔮</text><text x="122" y="290" fontSize="11">🥃</text>
      <text x="142" y="288" fontSize="13">🪙</text><text x="158" y="290" fontSize="11">📌</text>

      {/* Right bookcase */}
      <rect x="725" y="55" width="175" height="340" fill="#2a1208" stroke="#3d1c0a" strokeWidth="2"/>
      {[115,175,235,295,355].map((y,i)=>(
        <rect key={i} x="725" y={y} width="175" height="8" fill="#4a2210"/>
      ))}
      {[730,744,758,770,782,796,810,822,836,848,862,876].map((x,i)=>(
        <rect key={i} x={x} y={62} width={10+i%3*3} height={46}
          fill={['#8B2a2a','#2a5a8B','#2a8B5a','#8B7a2a','#7a2a8B'][i%5]} opacity="0.88"/>
      ))}
      {[728,742,756,769,782,796,809,822,836,849,862,875].map((x,i)=>(
        <rect key={i} x={x} y={122} width={10+i%4*2} height={44}
          fill={['#5a3a8B','#8B5a2a','#3a8B5a','#8B8B2a','#2a8B8B','#8B2a5a'][i%6]} opacity="0.85"/>
      ))}
      <text x="730" y="228" fontSize="13">🗝️</text><text x="752" y="228" fontSize="14">🪬</text>
      <text x="774" y="226" fontSize="12">📿</text><text x="796" y="228" fontSize="14">🧿</text>
      <text x="818" y="226" fontSize="12">🔭</text><text x="840" y="228" fontSize="13">🧪</text>
      <text x="862" y="226" fontSize="12">⚗️</text>
      <text x="730" y="288" fontSize="12">🥾</text><text x="750" y="290" fontSize="13">🪓</text>
      <text x="772" y="288" fontSize="11">🔫</text><text x="793" y="290" fontSize="14">💣</text>
      <text x="816" y="288" fontSize="12">🧨</text><text x="838" y="290" fontSize="11">🪝</text>
      <text x="858" y="288" fontSize="13">🗡️</text>

      {/* Center bar back wall */}
      <rect x="280" y="55" width="340" height="180" rx="6" fill="#1a1030" stroke="#8B6914" strokeWidth="4"/>
      <rect x="288" y="63" width="324" height="164" rx="4" fill="#0d0a1a"/>
      <rect x="280" y="55" width="340" height="180" rx="6" fill="none" stroke="#FFD700" strokeWidth="1.5" opacity="0.4"/>
      <text x="450" y="140" textAnchor="middle" fill="#8B6914" fontSize="16" fontFamily="serif" opacity="0.5">TEXASNOMAD</text>
      <text x="450" y="162" textAnchor="middle" fill="#BC13FE" fontSize="11" fontFamily="serif" opacity="0.4" filter="url(#glow)">✦ SALOON ✦</text>

      {/* Bar shelves */}
      <rect x="175" y="248" width="550" height="12" rx="2" fill="#4a2210"/>
      <rect x="175" y="308" width="550" height="12" rx="2" fill="#4a2210"/>
      <rect x="175" y="368" width="550" height="12" rx="2" fill="#4a2210"/>

      {/* Bottles tier 1 */}
      {[185,202,219,236,255,272,289,306,325,342,358,374,392,408,424,440,458,474,490,508,524,540,558,574,590,608,622,638,652,668,684,700].map((x,i)=>(
        <g key={i}>
          <rect x={x} y={208+i%3*2} width={13} height={38+i%4*3} rx={3}
            fill={['#8B1540','#154a8B','#1a7a30','#8B6a08','#6a158B','#8B3808','#087a6a','#8B1515'][i%8]}
            opacity={0.75+i%3*0.08}/>
          <rect x={x+3} y={204+i%3*2} width={7} height={6} rx={2} fill="#444" opacity="0.9"/>
        </g>
      ))}

      {/* Bottles tier 2 */}
      {[182,198,215,232,250,266,282,299,317,334,350,367,384,401,418,435,452,469,487,504,520,537,554,571,588,605,622,639,657,674,690,708].map((x,i)=>(
        <g key={i}>
          {i%4===0
            ? <><ellipse cx={x+7} cy={279} rx={9} ry={5} fill="#5a3010" opacity="0.8"/><rect x={x} y={268} width={14} height={28} rx={3} fill="#3a1a08" opacity="0.9"/><rect x={x+12} y={274} width={5} height={8} rx={2} fill="#3a1a08" opacity="0.8"/></>
            : <><rect x={x} y={270+i%2*4} width={13} height={36+i%3*2} rx={3}
                fill={['#6a2a0a','#0a3a6a','#0a6a2a','#6a5a08','#4a0a6a','#6a2808','#0a5a4a','#6a0808'][i%8]}
                opacity={0.72+i%4*0.06}/><rect x={x+3} y={266+i%2*4} width={7} height={6} rx={2} fill="#444" opacity="0.8"/></>
          }
        </g>
      ))}

      {/* Bottles tier 3 */}
      {[185,204,222,240,258,276,294,314,332,350,368,386,404,422,440,458,476,495,513,530,548,566,584,602,620,638,657,675,693,711].map((x,i)=>(
        <g key={i}>
          {i%3===0
            ? <><ellipse cx={x+8} cy={340} rx={10} ry={5} fill="#3a1a08" opacity="0.7"/><rect x={x} y={328} width={16} height={22} rx={5} fill={['#8B8B1a','#1a6a8B','#8B1a4a'][i%3]} opacity="0.8"/></>
            : <><rect x={x} y={326+i%2*2} width={14} height={30+i%3*3} rx={2}
                fill={['#7a1a30','#1a4a7a','#1a7a28','#7a6008','#5a1a7a'][i%5]}
                opacity={0.7+i%3*0.09}/><rect x={x+4} y={322+i%2*2} width={6} height={5} rx={2} fill="#555" opacity="0.8"/></>
          }
        </g>
      ))}

      {/* Bar counter */}
      <rect x="0" y="378" width="900" height="42" fill="url(#counterGrad)"/>
      <rect x="0" y="378" width="900" height="5" fill="#9a4c20"/>
      <rect x="0" y="415" width="900" height="5" fill="#2a1008"/>
      <text x="20" y="404" fontSize="14">🥃</text><text x="44" y="404" fontSize="13">🍺</text>
      <text x="68" y="405" fontSize="12">📋</text><text x="90" y="402" fontSize="14">🪙</text>
      <text x="114" y="404" fontSize="11">🎴</text><text x="136" y="405" fontSize="13">🥃</text>
      <text x="158" y="402" fontSize="12">🔑</text>
      <text x="740" y="404" fontSize="13">📰</text><text x="764" y="405" fontSize="12">🖊️</text>
      <text x="786" y="403" fontSize="14">🥃</text><text x="808" y="404" fontSize="13">🍺</text>
      <text x="832" y="402" fontSize="12">🎲</text><text x="855" y="404" fontSize="13">💰</text>
      <text x="878" y="405" fontSize="11">🪙</text>
      {[55,155,260,365,470,575,680,785].map((x,i)=>(
        <g key={i}>
          <ellipse cx={x+18} cy={376} rx={20} ry={6} fill="#2a1008" opacity="0.5"/>
          <circle cx={x+18} cy={370} r={20} fill="#4a2210" stroke="#6a3218" strokeWidth="2"/>
          <rect x={x+15} y={370} width={6} height={50} fill="#2a1008"/>
          <ellipse cx={x+18} cy={420} rx={14} ry={5} fill="#2a1008" opacity="0.6"/>
        </g>
      ))}

      {/* Floor */}
      <rect x="0" y="420" width="900" height="180" fill="url(#floorGrad)"/>
      {[437,454,471,488,505,522,539,556,573,590].map((y,i)=>(
        <line key={i} x1="0" y1={y} x2="900" y2={y} stroke="#3d1c0a" strokeWidth="1.5" opacity="0.5"/>
      ))}
      {[80,160,240,320,420,520,620,720,820].map((x,i)=>(
        <line key={i} x1={x} y1="420" x2={x+30} y2="600" stroke="#3d1c0a" strokeWidth="1" opacity="0.25"/>
      ))}
      <rect x="0" y="420" width="900" height="30" fill="url(#shadowFade)" opacity="0.7"/>

      {/* Left crate pile */}
      <rect x="0" y="430" width="90" height="80" rx="4" fill="#4a2810" stroke="#6a3a18" strokeWidth="2"/>
      <rect x="5" y="435" width="80" height="70" rx="2" fill="#3a2008" stroke="#5a3010" strokeWidth="1"/>
      <line x1="45" y1="430" x2="45" y2="510" stroke="#5a3010" strokeWidth="2"/>
      <line x1="0" y1="470" x2="90" y2="470" stroke="#5a3010" strokeWidth="2"/>
      <rect x="0" y="510" width="70" height="60" rx="3" fill="#3a2010" stroke="#5a3010" strokeWidth="2"/>
      <line x1="35" y1="510" x2="35" y2="570" stroke="#5a3010" strokeWidth="1.5"/>
      <line x1="0" y1="540" x2="70" y2="540" stroke="#5a3010" strokeWidth="1.5"/>
      <rect x="70" y="480" width="55" height="50" rx="3" fill="#4a2810" stroke="#5a3010" strokeWidth="1.5"/>
      <line x1="97" y1="480" x2="97" y2="530" stroke="#5a3010" strokeWidth="1.5"/>
      <line x1="70" y1="505" x2="125" y2="505" stroke="#5a3010" strokeWidth="1.5"/>
      <text x="5"  y="440" fontSize="16">🛢️</text><text x="50" y="436" fontSize="14">⛏️</text>
      <text x="92" y="476" fontSize="13">🪣</text><text x="2"  y="525" fontSize="12">🧲</text>
      <text x="35" y="548" fontSize="14">🔨</text><text x="72" y="544" fontSize="12">🪜</text>
      <text x="8"  y="575" fontSize="13">👜</text><text x="35" y="580" fontSize="11">🪢</text>
      <text x="60" y="576" fontSize="12">🧶</text><text x="85" y="572" fontSize="10">📦</text>

      {/* Right crate pile */}
      <rect x="810" y="428" width="90" height="85" rx="4" fill="#4a2810" stroke="#6a3a18" strokeWidth="2"/>
      <rect x="815" y="433" width="80" height="75" rx="2" fill="#3a2008" stroke="#5a3010" strokeWidth="1"/>
      <line x1="855" y1="428" x2="855" y2="513" stroke="#5a3010" strokeWidth="2"/>
      <line x1="810" y1="471" x2="900" y2="471" stroke="#5a3010" strokeWidth="2"/>
      <rect x="830" y="513" width="70" height="57" rx="3" fill="#3a2010" stroke="#5a3010" strokeWidth="2"/>
      <line x1="865" y1="513" x2="865" y2="570" stroke="#5a3010" strokeWidth="1.5"/>
      <line x1="830" y1="542" x2="900" y2="542" stroke="#5a3010" strokeWidth="1.5"/>
      <rect x="805" y="478" width="50" height="50" rx="3" fill="#4a2810" stroke="#5a3010" strokeWidth="1.5"/>
      <line x1="830" y1="478" x2="830" y2="528" stroke="#5a3010" strokeWidth="1.5"/>
      <line x1="805" y1="503" x2="855" y2="503" stroke="#5a3010" strokeWidth="1.5"/>
      <text x="812" y="448" fontSize="16">🪵</text><text x="858" y="444" fontSize="14">⚙️</text>
      <text x="806" y="494" fontSize="13">🎒</text><text x="832" y="527" fontSize="12">🪤</text>
      <text x="858" y="530" fontSize="11">🔩</text><text x="814" y="558" fontSize="13">🧰</text>
      <text x="838" y="562" fontSize="12">🪛</text><text x="865" y="556" fontSize="14">🔧</text>
      <text x="878" y="530" fontSize="11">📎</text>

      {/* Tables */}
      <ellipse cx="210" cy="492" rx="95" ry="30" fill="#3a1e0a" stroke="#5a2c12" strokeWidth="2"/>
      <rect x="195" y="490" width="30" height="65" fill="#2a1208"/>
      <text x="138" y="486" fontSize="13">🍺</text><text x="160" y="482" fontSize="12">🃏</text>
      <text x="182" y="479" fontSize="11">🃏</text><text x="200" y="484" fontSize="13">🥃</text>
      <text x="222" y="480" fontSize="11">🎲</text><text x="244" y="483" fontSize="14">🎲</text>
      <text x="264" y="481" fontSize="12">🍺</text><text x="154" y="500" fontSize="11">🪙</text>
      <text x="174" y="498" fontSize="10">📋</text><text x="230" y="497" fontSize="11">🪙</text>

      <ellipse cx="690" cy="492" rx="95" ry="30" fill="#3a1e0a" stroke="#5a2c12" strokeWidth="2"/>
      <rect x="675" y="490" width="30" height="65" fill="#2a1208"/>
      <text x="618" y="486" fontSize="12">🎴</text><text x="640" y="482" fontSize="13">🎴</text>
      <text x="660" y="480" fontSize="11">🥃</text><text x="680" y="484" fontSize="12">🍺</text>
      <text x="702" y="480" fontSize="13">🎲</text><text x="724" y="483" fontSize="11">🥃</text>
      <text x="746" y="481" fontSize="12">🃏</text><text x="634" y="499" fontSize="10">💰</text>
      <text x="656" y="498" fontSize="11">🪙</text><text x="714" y="498" fontSize="10">📋</text>

      <ellipse cx="450" cy="545" rx="120" ry="35" fill="#3a1e0a" stroke="#5a2c12" strokeWidth="2"/>
      <rect x="435" y="543" width="30" height="57" fill="#2a1208"/>
      <text x="358" y="540" fontSize="12">🍺</text><text x="380" y="536" fontSize="11">🃏</text>
      <text x="400" y="540" fontSize="13">🃏</text><text x="422" y="537" fontSize="10">🎲</text>
      <text x="444" y="540" fontSize="12">🥃</text><text x="466" y="537" fontSize="11">🎲</text>
      <text x="490" y="539" fontSize="13">🍺</text><text x="512" y="537" fontSize="10">🪙</text>
      <text x="372" y="556" fontSize="10">📜</text><text x="396" y="555" fontSize="11">🔑</text>
      <text x="474" y="556" fontSize="10">💰</text><text x="498" y="555" fontSize="11">🃏</text>

      {/* Floor debris */}
      <text x="130" y="458" fontSize="11">🪙</text><text x="155" y="472" fontSize="10">📎</text>
      <text x="178" y="465" fontSize="12">🃏</text><text x="200" y="558" fontSize="11">🪙</text>
      <text x="224" y="568" fontSize="10">📜</text><text x="248" y="552" fontSize="12">🎴</text>
      <text x="290" y="475" fontSize="10">🔩</text><text x="318" y="483" fontSize="11">🪙</text>
      <text x="345" y="470" fontSize="10">📌</text><text x="360" y="568" fontSize="11">🪙</text>
      <text x="385" y="580" fontSize="10">🎴</text><text x="410" y="572" fontSize="12">🃏</text>
      <text x="500" y="590" fontSize="10">🪙</text><text x="525" y="577" fontSize="11">📎</text>
      <text x="548" y="582" fontSize="10">🔩</text><text x="570" y="468" fontSize="11">🪙</text>
      <text x="595" y="478" fontSize="10">📌</text><text x="615" y="470" fontSize="12">🃏</text>
      <text x="640" y="560" fontSize="10">🪙</text><text x="662" y="572" fontSize="11">🎲</text>
      <text x="685" y="558" fontSize="10">📜</text><text x="730" y="458" fontSize="11">🔑</text>
      <text x="754" y="472" fontSize="10">🪙</text><text x="778" y="465" fontSize="12">🃏</text>

      {/* Wanted posters */}
      <g transform="rotate(-4,100,130)">
        <rect x="18" y="62" width="82" height="106" rx="3" fill="#c4944a"/>
        <rect x="22" y="66" width="74" height="98" rx="2" fill="#b4843a"/>
        <text x="59" y="82" textAnchor="middle" fill="#3d1c0a" fontSize="8" fontWeight="bold">WANTED</text>
        <circle cx="59" cy="112" r="22" fill="#8B4513" opacity="0.8"/>
        <text x="59" y="118" textAnchor="middle" fontSize="18">🤠</text>
        <text x="59" y="142" textAnchor="middle" fill="#3d1c0a" fontSize="6">DEAD OR ALIVE</text>
        <text x="59" y="152" textAnchor="middle" fill="#3d1c0a" fontSize="5">$500 REWARD</text>
      </g>
      <g transform="rotate(6,145,125)">
        <rect x="100" y="68" width="74" height="100" rx="3" fill="#d4aa70"/>
        <rect x="104" y="72" width="66" height="92" rx="2" fill="#c49a50"/>
        <text x="137" y="87" textAnchor="middle" fill="#3d1c0a" fontSize="7" fontWeight="bold">WANTED</text>
        <circle cx="137" cy="115" r="20" fill="#8B4513" opacity="0.7"/>
        <text x="137" y="121" textAnchor="middle" fontSize="16">👤</text>
        <text x="137" y="144" textAnchor="middle" fill="#3d1c0a" fontSize="5">$750 REWARD</text>
      </g>
      <g transform="rotate(-3,810,125)">
        <rect x="762" y="64" width="80" height="105" rx="3" fill="#c49a50"/>
        <rect x="766" y="68" width="72" height="97" rx="2" fill="#b48a40"/>
        <text x="802" y="82" textAnchor="middle" fill="#3d1c0a" fontSize="8" fontWeight="bold">WANTED</text>
        <circle cx="802" cy="112" r="22" fill="#8B4513" opacity="0.8"/>
        <text x="802" y="118" textAnchor="middle" fontSize="18">🦄</text>
        <text x="802" y="142" textAnchor="middle" fill="#3d1c0a" fontSize="6">DEAD OR ALIVE</text>
        <text x="802" y="152" textAnchor="middle" fill="#3d1c0a" fontSize="5">$1000 REWARD</text>
      </g>
      <g transform="rotate(5,860,130)">
        <rect x="840" y="62" width="58" height="88" rx="3" fill="#d4aa70" opacity="0.8"/>
        <rect x="844" y="66" width="50" height="80" rx="2" fill="#c49a50"/>
        <text x="869" y="79" textAnchor="middle" fill="#3d1c0a" fontSize="7" fontWeight="bold">WANTED</text>
        <circle cx="869" cy="105" r="18" fill="#8B4513" opacity="0.7"/>
        <text x="869" y="111" textAnchor="middle" fontSize="14">🤖</text>
        <text x="869" y="133" textAnchor="middle" fill="#3d1c0a" fontSize="5">$250 REWARD</text>
      </g>

      {/* Hanging lanterns */}
      {[100,280,450,620,800].map((x,i)=>(
        <g key={i} filter="url(#glow)">
          <line x1={x} y1="0" x2={x} y2={40+i%3*5} stroke="#555" strokeWidth="2"/>
          <line x1={x-8} y1={42+i%3*5} x2={x+8} y2={42+i%3*5} stroke="#666" strokeWidth="2"/>
          <ellipse cx={x} cy={58+i%3*5} rx={12} ry={18} fill="#FF5F1F" opacity={0.7+i%3*0.08}/>
          <ellipse cx={x} cy={58+i%3*5} rx={8} ry={13} fill="#FFD700" opacity="0.85"/>
          <circle cx={x} cy={58+i%3*5} r={4} fill="white" opacity="0.9"/>
          <ellipse cx={x} cy={58+i%3*5} rx={32} ry={30} fill="#FF5F1F" opacity="0.06"/>
        </g>
      ))}

      {/* Light cones */}
      {[100,280,450,620,800].map((x,i)=>(
        <polygon key={i} points={`${x},65 ${x-60},300 ${x+60},300`} fill="#FFD700" opacity="0.07"/>
      ))}

      {/* Neon sign */}
      <rect x="300" y="10" width="300" height="44" rx="6" fill="rgba(0,0,0,0.6)" stroke="#BC13FE" strokeWidth="2" opacity="0.7" filter="url(#glow)"/>
      <text x="450" y="38" textAnchor="middle" fill="#BC13FE" fontSize="20" fontFamily="'Rye', serif" filter="url(#glow)" opacity="0.9">SEE THAT! SALOON</text>

      {/* Fireplace */}
      <rect x="176" y="62" width="104" height="186" rx="4" fill="#1e0e06" stroke="#3a1a08" strokeWidth="2"/>
      <rect x="184" y="70" width="88" height="170" rx="2" fill="#160a04"/>
      <rect x="194" y="180" width="68" height="60" rx="4" fill="#0a0604"/>
      <ellipse cx="228" cy="222" rx="22" ry="18" fill="#8B2500" opacity="0.7"/>
      <ellipse cx="228" cy="215" rx="15" ry="12" fill="#cc4400" opacity="0.8"/>
      <ellipse cx="228" cy="210" rx="10" ry="8" fill="#FF6600" opacity="0.9"/>
      <ellipse cx="228" cy="207" rx="6" ry="6" fill="#FFcc00" opacity="0.8"/>
      <rect x="178" y="172" width="100" height="10" rx="2" fill="#5a2c12"/>
      <text x="182" y="170" fontSize="13">🕯️</text><text x="200" y="170" fontSize="11">🖼️</text>
      <text x="218" y="170" fontSize="12">🏆</text><text x="238" y="170" fontSize="11">🕯️</text>
      <text x="256" y="170" fontSize="12">🗡️</text>

      {/* Gun racks */}
      <rect x="0" y="360" width="175" height="65" fill="#1e0e06" stroke="#3a1a08" strokeWidth="1"/>
      <rect x="5" y="375" width="165" height="5" rx="1" fill="#4a2210"/>
      <rect x="5" y="398" width="165" height="5" rx="1" fill="#4a2210"/>
      <text x="8"  y="393" fontSize="14">🔫</text><text x="34" y="393" fontSize="14">🔫</text>
      <text x="60" y="393" fontSize="13">🪃</text><text x="85" y="393" fontSize="14">🔫</text>
      <text x="110" y="393" fontSize="12">⚔️</text><text x="135" y="393" fontSize="13">🔫</text>
      <text x="158" y="393" fontSize="11">🗡️</text>
      <text x="12" y="412" fontSize="11">🎩</text><text x="42" y="414" fontSize="10">🪖</text>
      <text x="70" y="412" fontSize="12">🎩</text><text x="98" y="413" fontSize="11">🧢</text>
      <text x="125" y="412" fontSize="10">🎩</text><text x="150" y="414" fontSize="11">🪖</text>

      <rect x="725" y="360" width="175" height="65" fill="#1e0e06" stroke="#3a1a08" strokeWidth="1"/>
      <rect x="730" y="375" width="165" height="5" rx="1" fill="#4a2210"/>
      <rect x="730" y="398" width="165" height="5" rx="1" fill="#4a2210"/>
      <text x="733" y="393" fontSize="14">🔫</text><text x="758" y="393" fontSize="13">🪃</text>
      <text x="782" y="393" fontSize="14">🔫</text><text x="806" y="393" fontSize="12">⚔️</text>
      <text x="830" y="393" fontSize="14">🔫</text><text x="855" y="393" fontSize="11">🗡️</text>
      <text x="878" y="393" fontSize="13">🔫</text>
      <text x="735" y="414" fontSize="11">🎩</text><text x="762" y="412" fontSize="12">🎩</text>
      <text x="790" y="413" fontSize="10">🧢</text><text x="815" y="412" fontSize="11">🪖</text>
      <text x="840" y="414" fontSize="10">🎩</text><text x="866" y="412" fontSize="12">🎩</text>

      {/* Dark corner overlays — creates harder-to-search shadows */}
      <rect x="0" y="55" width="80" height="340" fill="rgba(0,0,0,0.35)"/>
      <rect x="820" y="55" width="80" height="340" fill="rgba(0,0,0,0.35)"/>
      <rect x="0" y="420" width="130" height="180" fill="rgba(0,0,0,0.3)"/>
      <rect x="770" y="420" width="130" height="180" fill="rgba(0,0,0,0.3)"/>
      {/* Under-table darkness */}
      <ellipse cx="210" cy="530" rx="90" ry="18" fill="rgba(0,0,0,0.4)"/>
      <ellipse cx="690" cy="530" rx="90" ry="18" fill="rgba(0,0,0,0.4)"/>
      <ellipse cx="450" cy="580" rx="110" ry="18" fill="rgba(0,0,0,0.4)"/>

      {/* Atmospheric haze */}
      {[60,200,380,560,740,860].map((x,i)=>(
        <ellipse key={i} cx={x} cy={200+i*20} rx={40+i*5} ry={15} fill="#8B6914" opacity="0.04"/>
      ))}
    </svg>
  );
}
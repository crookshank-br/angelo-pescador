/* ================================================================
   ANGELO PESCADOR — Canvas Edition
   Renderização Canvas 2D · Física verlet de corda · Partículas
   Economia rebalanceada · Bestiário expandido (25 espécies)
   ================================================================ */

(() => {
'use strict';

// Detecta touch/coarse pointer uma vez no boot (tablet + celular)
const IS_COARSE = window.matchMedia('(pointer: coarse)').matches;
// Acessibilidade: usuário pediu menos movimento no SO
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Vibração háptica (só mobile; falha silenciosa onde não suportado)
function vibrate(pattern) {
    if (!IS_COARSE || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) {}
}

// Wake Lock: impede a tela de apagar durante a pescaria no celular
let wakeLock = null;
async function requestWakeLock() {
    if (!IS_COARSE || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wakeLock !== null) requestWakeLock();
});

// =================================================================
// CONSTANTES
// =================================================================
const SAVE_KEY            = 'angeloPescadorSave_v4';
const SESSION_BASE_MS     = 8000;
const SPAWN_BASE_MS       = 1800;
const HOOK_BASE_RADIUS    = 30;       // px
const HOOK_SPEED          = 0.035;    // % por ms (mais lento, exige pontaria)
const HOOK_INITIAL_DEPTH  = 50;       // % da água
const HOOK_DESCENT_MS     = 600;      // tempo do anzol descer
const ROPE_SEGMENTS       = 26;
const MAX_FISH_ON_SCREEN  = 14;
const COOLDOWN_MS         = 2000;     // 2s pra animação acabar
const OFFLINE_CAP_MINUTES = 480;      // teto de 8h de pesca offline da rede

// =================================================================
// ZONAS
// =================================================================
const ZONES = [
    { id: 0, name: 'Costa Rasa',    minDepth: 0,    maxDepth: 15,   requiredMotor: 0  },
    { id: 1, name: 'Arrecifes',     minDepth: 15,   maxDepth: 60,   requiredMotor: 3  },
    { id: 2, name: 'Mar Aberto',    minDepth: 60,   maxDepth: 250,  requiredMotor: 7  },
    { id: 3, name: 'Fossa Abissal', minDepth: 250,  maxDepth: 1200, requiredMotor: 12 },
];

// =================================================================
// BESTIÁRIO (25 espécies, com tamanhos distintos)
// =================================================================
const FISH = [
    // ── COSTA RASA ── pequenos e baratos
    { name: 'Sardinha',          emoji: '🐟', baseValue: 2,      rarity: 'common',    zones: [0],       weight: 60,  speed: 1.3, size: 26 },
    { name: 'Peixinho-Dourado',  emoji: '🐠', baseValue: 5,      rarity: 'common',    zones: [0],       weight: 45,  speed: 1.1, size: 28 },
    { name: 'Lambari',           emoji: '🐟', baseValue: 9,      rarity: 'common',    zones: [0],       weight: 38,  speed: 1.6, size: 24 },
    { name: 'Caranguejo',        emoji: '🦀', baseValue: 22,     rarity: 'uncommon',  zones: [0, 1],    weight: 16,  speed: 0.6, size: 32 },
    { name: 'Cavalinha',         emoji: '🐟', baseValue: 30,     rarity: 'uncommon',  zones: [0, 1],    weight: 22,  speed: 1.4, size: 30 },
    { name: 'Robalo',            emoji: '🐡', baseValue: 50,     rarity: 'uncommon',  zones: [0, 1],    weight: 12,  speed: 0.9, size: 34 },
    { name: 'Peixe-Espelho',     emoji: '🐟', baseValue: 90,     rarity: 'rare',      zones: [0, 1],    weight: 5,   speed: 1.2, size: 32 },

    // ── ARRECIFES ── coloridos, médio porte
    { name: 'Peixe-Palhaço',     emoji: '🐠', baseValue: 80,     rarity: 'uncommon',  zones: [1],       weight: 32,  speed: 1.0, size: 32 },
    { name: 'Peixe-Cirurgião',   emoji: '🐠', baseValue: 130,    rarity: 'uncommon',  zones: [1],       weight: 26,  speed: 1.2, size: 34 },
    { name: 'Garoupa',           emoji: '🐟', baseValue: 220,    rarity: 'uncommon',  zones: [1, 2],    weight: 18,  speed: 0.85, size: 38 },
    { name: 'Baiacu',            emoji: '🐡', baseValue: 480,    rarity: 'rare',      zones: [1, 2],    weight: 9,   speed: 0.7, size: 40 },
    { name: 'Lagosta',           emoji: '🦞', baseValue: 750,    rarity: 'rare',      zones: [1, 2],    weight: 6,   speed: 0.5, size: 42 },
    { name: 'Polvo',             emoji: '🐙', baseValue: 1200,   rarity: 'rare',      zones: [1, 2],    weight: 4,   speed: 0.6, size: 44 },

    // ── MAR ABERTO ── grandes e velozes
    { name: 'Bonito',            emoji: '🐟', baseValue: 900,    rarity: 'rare',      zones: [2],       weight: 28,  speed: 1.6, size: 38 },
    { name: 'Atum Gigante',      emoji: '🐟', baseValue: 1700,   rarity: 'rare',      zones: [2],       weight: 20,  speed: 1.5, size: 48 },
    { name: 'Golfinho',          emoji: '🐬', baseValue: 3200,   rarity: 'epic',      zones: [2],       weight: 11,  speed: 1.7, size: 50 },
    { name: 'Espadarte',         emoji: '🗡️', baseValue: 5000,   rarity: 'epic',      zones: [2, 3],    weight: 7,   speed: 1.9, size: 52 },
    { name: 'Tartaruga Marinha', emoji: '🐢', baseValue: 8000,   rarity: 'epic',      zones: [2],       weight: 4,   speed: 0.5, size: 56 },
    { name: 'Tubarão Branco',    emoji: '🦈', baseValue: 14000,  rarity: 'epic',      zones: [2, 3],    weight: 3,   speed: 1.8, size: 62 },

    // ── FOSSA ABISSAL ── criaturas exóticas e raríssimas (valores /2 vs original)
    { name: 'Peixe-Lanterna',    emoji: '🐟', baseValue: 5000,   rarity: 'rare',      zones: [3],       weight: 22,  speed: 1.0, size: 36 },
    { name: 'Lula Colossal',     emoji: '🦑', baseValue: 11000,  rarity: 'epic',      zones: [3],       weight: 9,   speed: 1.0, size: 58 },
    { name: 'Kraken',            emoji: '🐙', baseValue: 22000,  rarity: 'epic',      zones: [3],       weight: 5,   speed: 0.8, size: 64 },
    { name: 'Peixe-Dragão',      emoji: '🐉', baseValue: 37000,  rarity: 'legendary', zones: [3],       weight: 2.5, speed: 1.6, size: 66, bossHp: 2 },
    { name: 'Tubarão-Fantasma',  emoji: '🦈', baseValue: 65000,  rarity: 'legendary', zones: [3],       weight: 1.2, speed: 2.0, size: 72, bossHp: 3 },
    { name: 'Baleia Azul',       emoji: '🐋', baseValue: 160000, rarity: 'legendary', zones: [3],       weight: 0.3, speed: 0.7, size: 92, bossHp: 4 },
];

// =================================================================
// MELHORIAS
// Progressão alvo ~1h: Costa(0-8min) → Arrecifes(8-20) →
//   Mar Aberto(20-35) → Fossa(35-55) → Prestígio(55-60)
// Motor  mais barato: Arrecifes $950 · Mar $6.4k · Fossa $51.5k
// Hook/Net/Value mais caros para encher ~20min na Fossa
// Batiscafo: exclusivo Motor 12, total ~$1.5M
// =================================================================
const UPGRADES = [
    {
        id: 'rod', name: 'Vara Reforçada', icon: '🎣',
        desc: '+0.25s de duração por sessão de pesca',
        baseCost: 20, costMultiplier: 1.22, maxLevel: 20,
        // total ~$2.7k — maxado ainda na Costa Rasa
    },
    {
        id: 'bait', name: 'Isca Especial', icon: '🐛',
        desc: 'Peixes aparecem mais rápido e raros mais frequentes',
        baseCost: 120, costMultiplier: 1.25, maxLevel: 20,
        // total ~$20k — maxado até o Mar Aberto
    },
    {
        id: 'motor', name: 'Motor do Barco', icon: '⚙️',
        desc: 'Desbloqueia águas mais profundas',
        baseCost: 500, costMultiplier: 1.80, maxLevel: 12,
        // Arrecifes $3k · Mar $37.6k · Fossa $722k (mult íngreme = gate real por zona)
    },
    {
        id: 'hook', name: 'Anzol Largo', icon: '⚓',
        desc: '+8% área de captura · +3% chance de multi-captura',
        baseCost: 1200, costMultiplier: 1.26, maxLevel: 18,
        // era 800/1.28/15 → total ~$290k (últimos níveis na Fossa)
    },
    {
        id: 'net', name: 'Rede de Pesca', icon: '🕸️',
        desc: 'Pesca passiva: 0.10 peixe/min por nível',
        baseCost: 2500, costMultiplier: 1.28, maxLevel: 25,
        // era 1500/1.30/25 → total ~$4.4M (principal sink da Fossa)
    },
    {
        id: 'value', name: 'Mercado Premium', icon: '💰',
        desc: '+4% no valor de venda dos peixes',
        baseCost: 3000, costMultiplier: 1.28, maxLevel: 22,
        // era 2500/1.30/20 → total ~$2.5M
    },
    {
        id: 'abyss', name: 'Batiscafo Abissal', icon: '🔭',
        desc: '+10% no valor de todos os peixes por nível',
        baseCost: 50000, costMultiplier: 1.55, maxLevel: 8,
        requiredMotor: 12,
        // exclusivo da Fossa · total ~$2.3M · último nível $855k
    },
];

// =================================================================
// SONS — Web Audio API sintético (zero dependências)
// =================================================================
const SFX = (() => {
    let ac = null;
    let muted = localStorage.getItem('angeloPescadorMuted') === '1';
    let ambNodes = null;
    function ctx() {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume();
        return ac;
    }
    // Ruído filtrado + LFO lento = som de ondas do mar (100% sintetizado)
    function startAmbience() {
        if (muted || ambNodes) return;
        try {
            const c = ctx();
            const len = c.sampleRate * 4;
            const buf = c.createBuffer(1, len, c.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
            const src = c.createBufferSource();
            src.buffer = buf; src.loop = true;
            const filter = c.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 380; filter.Q.value = 0.4;
            const gain = c.createGain();
            gain.gain.value = 0.016;
            const lfo = c.createOscillator();
            const lfoGain = c.createGain();
            lfo.frequency.value = 0.11; lfoGain.gain.value = 0.011;
            lfo.connect(lfoGain); lfoGain.connect(gain.gain);
            src.connect(filter); filter.connect(gain); gain.connect(c.destination);
            src.start(); lfo.start();
            ambNodes = { src, lfo };
        } catch (e) {}
    }
    function stopAmbience() {
        if (!ambNodes) return;
        try { ambNodes.src.stop(); ambNodes.lfo.stop(); } catch (e) {}
        ambNodes = null;
    }
    function tone(freq, type, dur, vol = 0.28, startDetune = 0, endDetune = 0) {
        if (muted) return;
        try {
            const c = ctx();
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.connect(gain); gain.connect(c.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, c.currentTime);
            osc.detune.setValueAtTime(startDetune, c.currentTime);
            osc.detune.linearRampToValueAtTime(endDetune, c.currentTime + dur);
            gain.gain.setValueAtTime(vol, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
            osc.start(c.currentTime); osc.stop(c.currentTime + dur);
        } catch (e) {}
    }
    function delay(fn, ms) { setTimeout(fn, ms); }
    return {
        get muted() { return muted; },
        toggleMute() {
            muted = !muted;
            localStorage.setItem('angeloPescadorMuted', muted ? '1' : '0');
            if (muted) { stopAmbience(); if (ac) { try { ac.suspend(); } catch (e) {} } }
            else startAmbience();
            return muted;
        },
        // Suspende/retoma o AudioContext (poupa bateria com a aba oculta)
        suspend() { if (ac && ac.state === 'running') { try { ac.suspend(); } catch (e) {} } },
        resume()  { if (ac && ac.state === 'suspended' && !muted) { try { ac.resume(); } catch (e) {} } },
        ambience() { startAmbience(); },
        splash() {
            tone(200, 'sine', 0.25, 0.12, 0, -400);
            tone(110, 'sine', 0.35, 0.08, 0, -200);
        },
        catch(rarity) {
            if (rarity === 'legendary') {
                tone(523, 'sine', 0.12, 0.35);
                delay(() => tone(659, 'sine', 0.12, 0.35), 130);
                delay(() => tone(784, 'sine', 0.15, 0.4), 260);
                delay(() => tone(1047, 'sine', 0.5, 0.45), 400);
                delay(() => tone(1318, 'sine', 0.4, 0.4), 600);
            } else if (rarity === 'epic') {
                tone(392, 'sine', 0.1, 0.28);
                delay(() => tone(523, 'sine', 0.12, 0.28), 110);
                delay(() => tone(659, 'sine', 0.3, 0.32), 220);
            } else if (rarity === 'rare') {
                tone(330, 'triangle', 0.1, 0.22);
                delay(() => tone(440, 'triangle', 0.22, 0.22), 90);
            } else if (rarity === 'uncommon') {
                tone(277, 'triangle', 0.12, 0.18);
                delay(() => tone(349, 'triangle', 0.15, 0.18), 80);
            } else {
                tone(220, 'triangle', 0.12, 0.15, 0, 100);
            }
        },
        upgrade() {
            tone(440, 'sine', 0.08, 0.18);
            delay(() => tone(554, 'sine', 0.08, 0.18), 70);
            delay(() => tone(659, 'sine', 0.18, 0.22), 140);
            delay(() => tone(880, 'sine', 0.12, 0.18), 260);
        },
        chest() {
            tone(660, 'sine', 0.08, 0.28);
            delay(() => tone(880, 'sine', 0.08, 0.28), 90);
            delay(() => tone(1046, 'sine', 0.22, 0.32), 180);
        },
        combo(n) {
            const freqs = [330, 392, 440, 494, 554, 622, 698, 784];
            const f = freqs[Math.min(n - 2, freqs.length - 1)];
            tone(f, 'sine', 0.18, 0.2 + Math.min(n * 0.025, 0.15));
        },
        boss() {
            tone(150, 'sawtooth', 0.3, 0.3, 0, -300);
            tone(75,  'square',   0.4, 0.18);
        },
        zone() {
            tone(196, 'sine', 0.15, 0.12, 0, 200);
            delay(() => tone(247, 'sine', 0.15, 0.12, 0, 200), 120);
            delay(() => tone(294, 'sine', 0.25, 0.15, 0, 200), 240);
        },
        pause(on) {
            tone(on ? 220 : 330, 'sine', 0.1, 0.12);
        },
        tab() {
            tone(880, 'sine', 0.04, 0.06);
        },
        offline() {
            tone(523, 'sine', 0.1, 0.18);
            delay(() => tone(659, 'sine', 0.12, 0.18), 100);
            delay(() => tone(784, 'sine', 0.18, 0.22), 200);
        },
    };
})();

// =================================================================
// TOUCH — joystick virtual para mobile
// =================================================================
const touchState = {
    active: false,
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
    radius: 60,
};

function setupTouch() {
    const cv = document.getElementById('gameCanvas');
    cv.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const r = cv.getBoundingClientRect();
        const scaleX = cw / r.width;
        const scaleY = ch / r.height;
        touchState.active = true;
        touchState.startX   = (t.clientX - r.left) * scaleX;
        touchState.startY   = (t.clientY - r.top)  * scaleY;
        touchState.currentX = touchState.startX;
        touchState.currentY = touchState.startY;
        if (!rt.fishingActive) startFishing();
    }, { passive: false });

    cv.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const r = cv.getBoundingClientRect();
        const scaleX = cw / r.width;
        const scaleY = ch / r.height;
        touchState.currentX = (t.clientX - r.left) * scaleX;
        touchState.currentY = (t.clientY - r.top)  * scaleY;
        const dx = touchState.currentX - touchState.startX;
        const dy = touchState.currentY - touchState.startY;
        const dead = 10;
        rt.keyState.left  = dx < -dead;
        rt.keyState.right = dx >  dead;
        rt.keyState.up    = dy < -dead;
        rt.keyState.down  = dy >  dead;
    }, { passive: false });

    cv.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchState.active = false;
        rt.keyState.left = rt.keyState.right = rt.keyState.up = rt.keyState.down = false;
    }, { passive: false });
}

function drawJoystick() {
    if (!touchState.active || !rt.fishingActive) return;
    const { startX: sx, startY: sy, currentX: cx, currentY: cy, radius } = touchState;
    const dx  = cx - sx, dy = cy - sy;
    const dist = Math.min(radius, Math.hypot(dx, dy));
    const ang  = Math.atan2(dy, dx);
    const tx   = sx + Math.cos(ang) * dist;
    const ty   = sy + Math.sin(ang) * dist;
    ctx.save();
    ctx.globalAlpha = 0.75;
    // base
    ctx.fillStyle   = 'rgba(255,255,255,0.1)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // seta de direção
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    [0, 90, 180, 270].forEach(deg => {
        const rad = deg * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(rad) * (radius * 0.45), sy + Math.sin(rad) * (radius * 0.45));
        ctx.lineTo(sx + Math.cos(rad) * (radius * 0.85), sy + Math.sin(rad) * (radius * 0.85));
        ctx.stroke();
    });
    // thumb
    ctx.fillStyle   = 'rgba(0, 212, 255, 0.6)';
    ctx.strokeStyle = 'rgba(0, 212, 255, 1)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(tx, ty, 24, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

const RARITY_GLOW = {
    common:    null,
    uncommon:  'rgba(173, 216, 230, 0.45)',
    rare:      'rgba(78, 205, 196, 0.75)',
    epic:      'rgba(187, 134, 252, 0.9)',
    legendary: 'rgba(255, 179, 71, 1)',
};
const RARITY_SCORE = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

// =================================================================
// CORES DOS PEIXES (cada espécie com paleta única: body, dark, belly, fin, accent)
// =================================================================
const FISH_COLORS = [
    // ── COSTA RASA ── tons quentes e costeiros
    ['#7EC8E3','#3A7CA5','#C5E8F7','#F0A050','#B8E2F2'],
    ['#FFB347','#CC8030','#FFD699','#FF8C42','#FFE0B2'],
    ['#90C7D9','#5A8A9C','#B8DCE8','#7AB0C4','#D0EAF2'],
    ['#D2691E','#8B4513','#E8A87C','#A0522D','#F0C8A8'],
    ['#6B8E9E','#4A6A7A','#A8C4D4','#8FA8B8','#C8DDE8'],
    ['#7BA87C','#3A6A3B','#A8C8A8','#5A8A5B','#C8E0C8'],
    ['#E0F0FF','#7AAACC','#FFFFFF','#B0D8E8','#F8FBFF'],   // Peixe-Espelho — prata reflexivo
    // ── ARRECIFES ── vibrantes e tropicais
    ['#FF6B35','#CC3300','#FFA07A','#FF4500','#FFC8B0'],
    ['#4169E1','#2A4AAA','#87CEEB','#1E90FF','#B0D4F0'],
    ['#4A6A5A','#2A4A3A','#8BAA9A','#6B8A7A','#B0C8B8'],
    ['#FFD700','#CC8800','#FFEB3B','#FFA500','#FFF0A0'],
    ['#DC143C','#8B0000','#FF6B6B','#B22222','#FFA0A0'],
    ['#8B4513','#5C3010','#D2B48C','#A0522D','#E0C8A8'],
    // ── MAR ABERTO ── cores oceânicas poderosas
    ['#4A7FB5','#2A5080','#B0D0F0','#7AAAD5','#D0E4F8'],
    ['#2A4A7A','#1A3050','#8AAACA','#4A6A9A','#B0C8E0'],
    ['#3A6A9A','#204060','#B0D0F0','#7AAAD5','#D0E4F8'],
    ['#C0C0C0','#808080','#F0F0F0','#E0E0E0','#FFFFFF'],
    ['#4A6A3A','#2A4A1A','#8AAA7A','#6A8A5A','#B0C8A0'],
    ['#3A3A3A','#1A1A1A','#9A9A9A','#6A6A6A','#C0C0C0'],
    // ── FOSSA ABISSAL ── bioluminescentes e sombrias
    ['#004466','#002233','#44AADD','#0077AA','#88CCEE'],
    ['#661144','#440022','#CC6699','#993366','#EE88BB'],
    ['#551133','#330011','#BB6688','#883355','#DD99AA'],
    ['#003355','#001122','#4499DD','#1166AA','#88BBEE'],
    ['#1A1A2E','#0A0A1E','#6A6A8E','#3A3A5E','#9A9ABA'],
    ['#1A2A4A','#0A1A2A','#6A8AB0','#3A5A8A','#9AB0D0'],
];

// =================================================================
// ESTADO PERSISTIDO + RUNTIME
// =================================================================
let state = {
    money: 0, totalFish: 0, currentZone: 0,
    upgrades: { rod: 0, bait: 0, motor: 0, hook: 0, net: 0, value: 0, abyss: 0 },
    lastSave: Date.now(),
    achievements: {},
    _speciesCaught: {},
    _legendaryCaught: false,
    // Prestígio
    pearls: 0,
    totalEarned: 0,        // dinheiro acumulado vitalício (não decrementa em compras)
    pearlBonuses: { value: 0, spawn: 0, multi: 0 },  // upgrades comprados com pérolas
    // Stats
    _biggestCatch: null,
    _maxCombo: 0,
    _playTime: 0,
    // Missões diárias
    quests: { date: '', list: [] },
    // Itens consumíveis
    consumables: { extraBait: 0, magnify: 0, chronometer: 0 },
};

const rt = {
    fishingActive: false,
    sessionEndTime: 0,
    sessionDuration: SESSION_BASE_MS,
    cooldownEndTime: 0,
    hookX: 50, hookY: 0,
    hookDescending: false,
    activeFish: [],
    particles: [],
    bubbles: [],
    rope: null,
    floatTexts: [],
    cameraShake: 0,
    cheerUntil: 0,      // até quando o Angelo comemora a captura
    time: 0,
    keyState: { left: false, right: false, up: false, down: false },
    passiveAccumulator: 0,
    nextSpawnTime: 0,
    nextBubbleTime: 0,
    seaweed: [],
    ambientParticles: [],
    nextAmbientTime: 0,
    chests: [],
    nextChestTime: 0,
    combo: 0,
    lastCatchTime: 0,
    comboDisplayTimer: 0,
    comboX: 0, comboY: 0,
    trails: [],
    paused: false,
    zoneTransition: 0,
    netLogAccum: { count: 0, value: 0, timer: 0 },
    eventActive: null,
    nextEventCheck: 0,
};

// =================================================================
// HELPERS DE ECONOMIA
// =================================================================
function calcCost(up, lvl) { return Math.floor(up.baseCost * Math.pow(up.costMultiplier, lvl)); }
function getSessionDuration() {
    let dur = SESSION_BASE_MS + state.upgrades.rod * 250;
    if (rt.consumableActive?.type === 'chronometer') dur *= 1.5;
    return dur;
}
function getSpawnInterval()  {
    const reduction = Math.pow(0.95, state.upgrades.bait);
    let interval = SPAWN_BASE_MS * reduction;
    if (rt.eventActive && rt.eventActive.type === 'cardume') interval *= 0.4;
    if (rt.consumableActive?.type === 'extraBait') interval *= 0.5;
    return Math.max(450, interval);
}

function consumableFiltersFish(fish) {
    if (rt.consumableActive?.type === 'magnify' && fish.rarity === 'common') return false;
    return true;
}
function getHookRadius()     { return HOOK_BASE_RADIUS * (1 + state.upgrades.hook * 0.08); }
function getMultiCatchChance() {
    // Anzol Sortudo (pérola): +3% de chance de captura múltipla por nível
    const luck = (state.pearlBonuses?.multi || 0) * 0.03;
    return Math.min(0.65, 0.01 + state.upgrades.hook * 0.035 + state.upgrades.bait * 0.010 + luck);
}
function getMaxExtras()        { return 1 + Math.floor(state.upgrades.hook / 8); }
function getBaitRarityBonus()  { return Math.min(0.35, state.upgrades.bait * 0.025); }
function getValueMultiplier()  {
    return (1 + state.upgrades.value * 0.04)
         * (1 + (state.upgrades.abyss || 0) * 0.10)
         * getPearlValueMult();
}
function getPassiveRate()      { return state.upgrades.net * 0.10 * (1 + (state.pearlBonuses?.spawn || 0) * 0.05); }
function isZoneUnlocked(id)    { return state.upgrades.motor >= ZONES[id].requiredMotor; }

// === PRESTÍGIO (PÉROLAS) ===
function getPearlValueMult()   { return 1 + (state.pearlBonuses?.value || 0) * 0.05; }   // +5% por pérola gasta em valor
function calcPearlsAvailable() {
    // 1 pérola a cada $500.000 ganhos vitalícios
    const earned = state.totalEarned || 0;
    return Math.floor(Math.sqrt(earned / 500000));
}
function calcPearlsToGain() {
    const total = calcPearlsAvailable();
    return Math.max(0, total - (state.pearls + sumPearlBonuses()));
}
function sumPearlBonuses() {
    const b = state.pearlBonuses || {};
    return (b.value || 0) + (b.spawn || 0) + (b.multi || 0);
}

function fmtMoney(n) {
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3)  return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + Math.floor(n).toLocaleString('pt-BR');
}

function rollFish(zoneId) {
    let pool = FISH.filter(f => f.zones.includes(zoneId));
    pool = pool.filter(eventFiltersFish);
    pool = pool.filter(consumableFiltersFish);
    if (!pool.length) return null;
    const bonus = getBaitRarityBonus();
    const weighted = pool.map(f => ({ fish: f, w: f.weight * (1 + bonus * RARITY_SCORE[f.rarity]) }));
    const total = weighted.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const e of weighted) {
        r -= e.w;
        if (r <= 0) return e.fish;
    }
    return weighted[weighted.length - 1].fish;
}

function sellFish(f) {
    const v = Math.floor(f.baseValue * getValueMultiplier() * getEventValueMult());
    state.money += v;
    state.totalEarned = (state.totalEarned || 0) + v;
    state.totalFish += 1;
    // Atualiza progresso de missões
    questProgress('catch_any', 1);
    questProgress('catch_' + f.rarity, 1);
    if (f.rarity === 'rare' || f.rarity === 'epic' || f.rarity === 'legendary') {
        questProgress('catch_rare', 1);
    }
    if (f.zones.includes(3)) questProgress('catch_abyss', 1);
    questProgress('earn', v);
    // Tracking de espécies e lendários
    if (!state._speciesCaught) state._speciesCaught = {};
    const isNew = !state._speciesCaught[f.name];   // verificar ANTES de setar
    state._speciesCaught[f.name] = true;
    if (f.rarity === 'legendary') state._legendaryCaught = true;
    // Tracking de maior captura
    if (!state._biggestCatch || v > state._biggestCatch.value) {
        state._biggestCatch = { name: f.name, emoji: f.emoji, value: v, when: Date.now() };
    }
    if (isNew) {
        setTimeout(updateCompendium, 0);
        showNewSpeciesToast(f);
        notifyTab('dex');
    }
    return v;
}

// =================================================================
// CANVAS
// =================================================================
const canvas = document.getElementById('gameCanvas');
// 'let' porque o pipeline de pós-processamento redireciona o desenho para
// camadas offscreen por alguns instantes do frame (ver renderScene).
let ctx = canvas.getContext('2d', { alpha: false });   // perf: sem alpha (canvas sempre cheio)
const ctxScreen = ctx;                                  // referência fixa ao canvas visível

// ctx.filter (blur nativo) não existe em browsers antigos — degrada sem quebrar
const HAS_CTX_FILTER = typeof ctx.filter === 'string';
let cw = 0, ch = 0;

// Cache de elementos DOM acessados em hot paths
const DOM = {};
function cacheDOM() {
    DOM.castButton    = document.getElementById('castButton');
    DOM.castProgress  = document.getElementById('castProgress');
    DOM.cooldownRing  = document.getElementById('cooldownRing');
    DOM.money         = document.getElementById('money');
    DOM.totalFish     = document.getElementById('totalFish');
    DOM.passiveIncome = document.getElementById('passiveIncome');
    DOM.currentZone   = document.getElementById('currentZone');
    DOM.currentDepth  = document.getElementById('currentDepth');
    DOM.fishingLog    = document.getElementById('fishingLog');
    DOM.catchShowcase = document.getElementById('catchShowcase');
}

// Escala de render efetiva. Em telas densas o custo dos passes de
// pós-processamento é proporcional ao número de pixels, e a arte é cartoon —
// acima de ~1.25x no tablet o ganho visual não paga o custo.
let renderDpr = 1;

function computeRenderDpr(rect) {
    const cap = IS_COARSE ? 1.25 : 2;
    let dpr = Math.min(cap, window.devicePixelRatio || 1);
    const px = rect.width * rect.height * dpr * dpr;
    const MAX_PX = 1.6e6;                      // teto absoluto de pixels por frame
    if (px > MAX_PX) dpr *= Math.sqrt(MAX_PX / px);
    return Math.max(0.8, dpr);
}

function resizeCanvas() {
    const r = canvas.parentElement.getBoundingClientRect();
    renderDpr = computeRenderDpr(r);
    canvas.width  = Math.round(r.width  * renderDpr);
    canvas.height = Math.round(r.height * renderDpr);
    ctx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
    cw = r.width;
    ch = r.height;
    rt.fx = null;                              // camadas offscreen viram lixo no resize
    fishSprites = null;                        // sprites assados em outro dpr tambem
}

function waterY()       { return ch * 0.22; }
function waterHeight()  { return ch - waterY() - 110; } // -110 reserva área dos controles
function boatPos() {
    // Deriva lateral lenta — adiciona vida ao barco
    const drift = Math.sin(rt.time * 0.00015) * cw * 0.04 + Math.sin(rt.time * 0.00037) * cw * 0.015;
    return { x: cw * 0.5 + drift, y: waterY() - 12 };
}
// Escala do barco conforme a altura da cena — mantém a vara dentro do céu
function boatScale() { return Math.max(0.55, Math.min(1, (ch * 0.22 - 14) / 92)); }

// Métricas compartilhadas entre o desenho do barco e a ponta da vara
function boatMetrics(t) {
    const b = boatPos();
    return {
        x: b.x,
        y: b.y + Math.sin(t * 0.001) * 3,
        tilt: Math.sin(t * 0.001) * 0.04,
        s: boatScale(),
    };
}

// Converte um ponto local do barco para coordenadas de tela
function boatLocalToWorld(lx, ly, t) {
    const m = boatMetrics(t);
    const c = Math.cos(m.tilt), sn = Math.sin(m.tilt);
    return { x: m.x + (lx * c - ly * sn) * m.s,
             y: m.y + (lx * sn + ly * c) * m.s };
}

const ROD_TIP_LOCAL = { x: 62, y: -82 };
function rodTipPos(t) {
    const sway = Math.sin(t * 0.0021) * 2.5;
    return boatLocalToWorld(ROD_TIP_LOCAL.x + sway, ROD_TIP_LOCAL.y, t);
}
function hookPxPos() {
    return { x: (rt.hookX / 100) * cw,
             y: waterY() + (rt.hookY / 100) * waterHeight() };
}

// =================================================================
// CORDA — Verlet integration (corda flexível com gravidade)
// =================================================================
function initRope() {
    rt.rope = { segments: [] };
    const start = rodTipPos(0);
    for (let i = 0; i < ROPE_SEGMENTS; i++) {
        rt.rope.segments.push({ x: start.x, y: start.y, ox: start.x, oy: start.y });
    }
}

function updateRope() {
    if (!rt.rope) initRope();
    const segs = rt.rope.segments;
    const tip = rodTipPos(rt.time);
    const hp  = hookPxPos();
    const dist = Math.hypot(hp.x - tip.x, hp.y - tip.y);
    const segLen = Math.max(2, dist / (segs.length - 1)) + 0.6;

    // Integração de Verlet
    const damp = 0.95;
    const grav = 0.18;
    for (let i = 1; i < segs.length - 1; i++) {
        const s = segs[i];
        const vx = (s.x - s.ox) * damp;
        const vy = (s.y - s.oy) * damp + grav;
        s.ox = s.x; s.oy = s.y;
        s.x += vx; s.y += vy;
    }

    // Pin endpoints
    segs[0].x = tip.x; segs[0].y = tip.y;
    segs[segs.length - 1].x = hp.x;
    segs[segs.length - 1].y = hp.y;

    // Restrições de distância (várias iterações para estabilidade)
    for (let it = 0; it < 8; it++) {
        for (let i = 0; i < segs.length - 1; i++) {
            const a = segs[i], b = segs[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.0001;
            const diff = (d - segLen) / d;
            const mx = dx * diff * 0.5, my = dy * diff * 0.5;
            if (i !== 0)               { a.x += mx; a.y += my; }
            if (i !== segs.length - 2) { b.x -= mx; b.y -= my; }
        }
        segs[0].x = tip.x; segs[0].y = tip.y;
        segs[segs.length - 1].x = hp.x;
        segs[segs.length - 1].y = hp.y;
    }
}

function drawRope() {
    if (!rt.rope) return;
    const segs = rt.rope.segments;
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 250, 255, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(segs[0].x, segs[0].y);
    for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i].x, segs[i].y);
    ctx.stroke();
    ctx.restore();
}

// =================================================================
// CÉU · SOL · NUVENS
// =================================================================
function drawSky(t) {
    const g = ctx.createLinearGradient(0, 0, 0, waterY());
    // Coloração suave dependente da zona (mais escura no abissal)
    const zoneId = state.currentZone;
    const skyTop = ['#FFD8A8', '#FFB87A', '#7B91B5', '#1A2A45'][zoneId];
    const skyMid = ['#9CD9F0', '#84C5E8', '#5570A0', '#0F1F38'][zoneId];
    const skyBot = ['#5DADE2', '#4A92C4', '#2D4870', '#0A1525'][zoneId];
    g.addColorStop(0,    skyTop);
    g.addColorStop(0.55, skyMid);
    g.addColorStop(1,    skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, waterY());

    // Estrelas no céu da Fossa Abissal — campo fixo pré-renderizado (1 drawImage
    // em vez de 100 arcos por frame) + um punhado piscando por cima
    if (state.currentZone === 3) {
        const skyH = Math.max(1, Math.round(waterY()));
        if (!rt.starField || rt.starField.w !== Math.round(cw) || rt.starField.h !== skyH) {
            const off = document.createElement('canvas');
            off.width = Math.round(cw); off.height = skyH;
            const og = off.getContext('2d');
            for (let i = 12; i < 100; i++) {
                const sx = (i * 137.5 + 42) % cw;
                const sy = (i * 97.3 + 13) % (skyH * 0.85);
                og.fillStyle = `rgba(255, 255, 255, ${0.25 + (i % 4) * 0.12})`;
                og.beginPath();
                og.arc(sx, sy, 0.5 + (i % 3) * 0.5, 0, Math.PI * 2);
                og.fill();
            }
            rt.starField = { w: Math.round(cw), h: skyH, canvas: off };
        }
        ctx.drawImage(rt.starField.canvas, 0, 0);
        for (let i = 0; i < 12; i++) {
            const sx = (i * 137.5 + 42) % cw;
            const sy = (i * 97.3 + 13) % (skyH * 0.85);
            const twinkle = 0.4 + 0.6 * Math.sin(t * 0.0012 + i * 2.7);
            ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.6})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 0.5 + (i % 3) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        // Lua pálida
        const mx = cw * 0.2, my = waterY() * 0.2;
        const moonGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 30);
        moonGrad.addColorStop(0, 'rgba(220, 230, 255, 0.9)');
        moonGrad.addColorStop(0.7, 'rgba(180, 200, 240, 0.6)');
        moonGrad.addColorStop(1, 'rgba(180, 200, 240, 0)');
        ctx.fillStyle = moonGrad;
        ctx.beginPath();
        ctx.arc(mx, my, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200, 215, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(mx, my, 16, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Posição do sol — compartilhada com o brilho refletido na água
function sunPos() { return { x: cw * 0.82, y: waterY() * 0.34, r: Math.max(22, waterY() * 0.19) }; }

function drawSun(t) {
    const { x: sx, y: sy, r } = sunPos();
    const pulse = 1 + Math.sin(t * 0.001) * 0.05;

    // Raios divergentes (bem sutis, giram devagar)
    if (!REDUCED_MOTION) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.00006);
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const len = r * (4.2 + Math.sin(t * 0.0012 + i) * 0.9);
            const rg = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
            rg.addColorStop(0, 'rgba(255, 236, 170, 0.16)');
            rg.addColorStop(1, 'rgba(255, 220, 140, 0)');
            ctx.fillStyle = rg;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a - 0.10) * len, Math.sin(a - 0.10) * len);
            ctx.lineTo(Math.cos(a + 0.10) * len, Math.sin(a + 0.10) * len);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    // Halo
    const halo = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 5);
    halo.addColorStop(0,   'rgba(255, 243, 195, 0.48)');
    halo.addColorStop(0.35,'rgba(255, 224, 150, 0.20)');
    halo.addColorStop(1,   'rgba(255, 200, 100, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 5, 0, Math.PI * 2);
    ctx.fill();

    // Disco
    const disc = ctx.createRadialGradient(sx - r * 0.25, sy - r * 0.25, 0, sx, sy, r);
    disc.addColorStop(0,   '#FFFEF0');
    disc.addColorStop(0.45,'#FFE79A');
    disc.addColorStop(1,   '#FFB454');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sx, sy, r * pulse, 0, Math.PI * 2);
    ctx.fill();
}

const CLOUD_PUFFS = [
    [0, 0, 0.40], [0.30, -0.14, 0.47], [0.62, -0.03, 0.43],
    [0.90, 0.07, 0.30], [0.16, 0.11, 0.29], [0.48, 0.13, 0.30],
];

// Paleta das nuvens por zona: [sombra, corpo, realce] — escurece no fundo do mar
const CLOUD_TONES = [
    ['#BFD3E8', '#FFFFFF', '#FFF8E4'],
    ['#B4C9E0', '#FAFCFF', '#FFF3DC'],
    ['#7D93B0', '#C9D8E8', '#DCE6F2'],
    ['#1E2C45', '#37476A', '#4A5C82'],
];

function drawCloud(x, y, size, alpha = 0.85) {
    const [shade, body, hi] = CLOUD_TONES[state.currentZone];
    ctx.save();
    ctx.globalAlpha = alpha;

    // Base sombreada (tom frio) — dá volume
    ctx.fillStyle = shade;
    ctx.beginPath();
    for (const [ux, uy, ur] of CLOUD_PUFFS) {
        ctx.moveTo(x + ux * size + ur * size, y + uy * size + size * 0.11);
        ctx.arc(x + ux * size, y + uy * size + size * 0.11, ur * size, 0, Math.PI * 2);
    }
    ctx.fill();

    // Corpo
    ctx.fillStyle = body;
    ctx.beginPath();
    for (const [ux, uy, ur] of CLOUD_PUFFS) {
        ctx.moveTo(x + ux * size + ur * size, y + uy * size);
        ctx.arc(x + ux * size, y + uy * size, ur * size, 0, Math.PI * 2);
    }
    ctx.fill();

    // Realce no topo (lado do sol / da lua)
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = hi;
    ctx.beginPath();
    for (const [ux, uy, ur] of CLOUD_PUFFS.slice(0, 3)) {
        ctx.moveTo(x + ux * size + ur * size * 0.66, y + uy * size - ur * size * 0.26);
        ctx.arc(x + ux * size, y + uy * size - ur * size * 0.26, ur * size * 0.66, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
}

// Pássaros em V — só nas zonas de céu claro
function drawBirds(t) {
    const wy = waterY();
    ctx.save();
    ctx.strokeStyle = 'rgba(60, 70, 90, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
        const bx = ((i * 260 + t * 0.016) % (cw + 200)) - 100;
        const by = wy * (0.14 + i * 0.09) + Math.sin(t * 0.0011 + i * 2) * 5;
        const flap = Math.sin(t * 0.009 + i * 1.9) * 3;
        const sz = 5 + (i % 2) * 2;
        ctx.beginPath();
        ctx.moveTo(bx - sz, by - flap);
        ctx.quadraticCurveTo(bx - sz * 0.4, by + 1.5, bx, by);
        ctx.quadraticCurveTo(bx + sz * 0.4, by + 1.5, bx + sz, by - flap);
        ctx.stroke();
    }
    ctx.restore();
}

function drawClouds(t) {
    const w = cw + 320;
    const wy = waterY();
    // Camada distante (menor, mais lenta, desbotada) — dá paralaxe
    drawCloud(((60  + t * 0.0016) % w) - 160, wy * 0.62, 62,  0.42);
    drawCloud(((520 + t * 0.0022) % w) - 160, wy * 0.72, 48,  0.36);
    // Camada da frente
    drawCloud(((100 + t * 0.005)  % w) - 160, wy * 0.30, 82,  0.92);
    drawCloud(((430 + t * 0.0035) % w) - 160, wy * 0.50, 104, 0.82);
    drawCloud(((780 + t * 0.0058) % w) - 160, wy * 0.19, 58,  0.95);
    if (state.currentZone <= 1) drawBirds(t);
}

// =================================================================
// SUPERFÍCIE DA ÁGUA · CÁUSTICAS · FOG
// =================================================================
function drawWater(t) {
    const wy = waterY();
    const palette = [
        ['#3FA3D9', '#1A4F7A'],   // Costa
        ['#1F6FA8', '#0B3D5E'],   // Arrecifes
        ['#0F4A78', '#04203C'],   // Mar Aberto
        ['#062444', '#020610'],   // Abissal
    ];
    const [c1, c2] = palette[state.currentZone];
    const wg = ctx.createLinearGradient(0, wy, 0, ch);
    wg.addColorStop(0, c1);
    wg.addColorStop(1, c2);
    ctx.fillStyle = wg;
    ctx.fillRect(0, wy, cw, ch - wy);

    // Perfil da onda (3 senoides compostas) — reutilizado nas camadas
    const wave = (x) => Math.sin(x * 0.018 + t * 0.0025) * 3
                      + Math.sin(x * 0.045 + t * 0.0040) * 1.6
                      + Math.sin(x * 0.008 - t * 0.0015) * 2.2;

    ctx.save();

    // Caminho de brilho do sol na água (só onde há sol)
    if (state.currentZone < 3) {
        const sp = sunPos();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 40; i++) {
            const p = (i % 20) / 19;
            const row = Math.floor(i / 20);
            const gy = wy + 4 + p * p * (ch - wy) * 0.5 + row * 7;
            const spread = 12 + p * 130;                       // o caminho abre pra baixo
            const jitter = Math.sin(i * 12.9898) * 0.5 + Math.sin(t * 0.0018 + i * 2.3) * 0.5;
            const gx = sp.x + jitter * spread;
            const gw = (10 + p * 30) * (0.45 + 0.55 * Math.abs(Math.sin(t * 0.004 + i * 1.7)));
            const a = (0.15 - p * 0.12) * [1, 0.6, 0.28][state.currentZone];
            if (a <= 0) continue;
            ctx.fillStyle = `rgba(255, 244, 200, ${a})`;
            ctx.beginPath();
            ctx.ellipse(gx, gy, gw, 1.3 + p * 1.8, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // Faixa clara logo abaixo da superfície (luz entrando)
    const shallow = ctx.createLinearGradient(0, wy, 0, wy + 70);
    shallow.addColorStop(0, `rgba(255, 255, 255, ${[0.22, 0.16, 0.10, 0.04][state.currentZone]})`);
    shallow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shallow;
    ctx.fillRect(0, wy, cw, 70);

    // Espuma sob a linha d'água
    ctx.beginPath();
    ctx.moveTo(0, wy - 6);
    for (let x = 0; x <= cw; x += 4) ctx.lineTo(x, wy + wave(x) + 6);
    ctx.lineTo(cw, wy - 6);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, wy - 4, 0, wy + 10);
    fg.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    fg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = fg;
    ctx.fill();

    // Linha da onda principal
    ctx.beginPath();
    for (let x = 0; x <= cw; x += 4) {
        const y = wy + wave(x);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Cristas de brilho pontilhadas correndo na superfície
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 16; i++) {
        const x = ((i * 137 + t * 0.02) % (cw + 60)) - 30;
        const y = wy + wave(x) - 1;
        const len = 4 + 7 * Math.abs(Math.sin(t * 0.003 + i * 1.1));
        ctx.fillRect(x, y, len, 1.3);
    }
    ctx.restore();
}

function drawCaustics(t) {
    const wy = waterY();
    const zone = state.currentZone;
    ctx.save();
    if (zone < 3) {
        ctx.globalCompositeOperation = 'screen';
        const numRays = zone === 0 ? 8 : 6;
        for (let i = 0; i < numRays; i++) {
            const baseX = (i / numRays) * cw + Math.sin(t * 0.0008 + i * 1.3) * 50;
            const x1 = baseX;
            const y1 = wy;
            const x2 = baseX + Math.cos(t * 0.0005 + i * 1.7) * (zone === 0 ? 40 : 20);
            const y2 = wy + (zone === 0 ? 350 : 200);
            const g = ctx.createLinearGradient(x1, y1, x2, y2);
            const baseIntensity = [0.12, 0.07, 0.03, 0][zone];
            g.addColorStop(0, `rgba(255, 255, 220, ${baseIntensity})`);
            g.addColorStop(1, 'rgba(255, 255, 220, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(x1 - (zone === 0 ? 16 : 8), y1);
            ctx.lineTo(x1 + (zone === 0 ? 16 : 8), y1);
            ctx.lineTo(x2 + (zone === 0 ? 40 : 20), y2);
            ctx.lineTo(x2 - (zone === 0 ? 40 : 20), y2);
            ctx.closePath();
            ctx.fill();
        }

        // Rede de cáusticas ondulando logo abaixo da superfície
        const bands = zone === 0 ? 7 : 5;
        const bandAlpha = [0.10, 0.065, 0.03][zone];
        ctx.lineCap = 'round';
        for (let b = 0; b < bands; b++) {
            const by = wy + 16 + b * 22;
            const ph = t * 0.0016 + b * 1.9;
            ctx.strokeStyle = `rgba(220, 255, 245, ${bandAlpha * (1 - b / bands)})`;
            ctx.lineWidth = 2.4 - b * 0.2;
            ctx.beginPath();
            for (let x = 0; x <= cw; x += 12) {
                const y = by + Math.sin(x * 0.021 + ph) * 7 + Math.sin(x * 0.052 + ph * 1.7) * 3.5;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }
    ctx.restore();
}

// Silhuetas distantes ao fundo — dá profundidade sem custar quase nada
function drawBackdrop(t) {
    const wy = waterY();
    const bottom = wy + waterHeight();
    const zone = state.currentZone;
    const tints = ['rgba(18, 78, 122, 0.35)', 'rgba(10, 58, 96, 0.40)',
                   'rgba(6, 38, 66, 0.45)',  'rgba(3, 14, 28, 0.55)'];

    // Profundidade de campo: o que está longe sai de foco
    if (HAS_CTX_FILTER) ctx.filter = 'blur(3px)';

    for (let layer = 0; layer < 2; layer++) {
        const drift = Math.sin(t * 0.00008 + layer) * 18;
        const h = (layer === 0 ? 130 : 78);
        const freq = layer === 0 ? 0.0042 : 0.0075;
        ctx.fillStyle = tints[zone];
        ctx.globalAlpha = layer === 0 ? 0.55 : 0.85;
        ctx.beginPath();
        ctx.moveTo(0, bottom);
        for (let x = 0; x <= cw; x += 14) {
            const y = bottom - h * (0.45 + 0.55 * Math.abs(Math.sin((x + drift) * freq + layer * 2.1)))
                             - Math.sin((x + drift) * freq * 3.1) * 12;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(cw, bottom);
        ctx.closePath();
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (HAS_CTX_FILTER) ctx.filter = 'none';
}

function drawDepthFog() {
    const wy = waterY();
    const opacity = [0.0, 0.18, 0.4, 0.7][state.currentZone];
    if (opacity === 0) return;
    const g = ctx.createLinearGradient(0, wy, 0, ch);
    g.addColorStop(0, 'rgba(2, 8, 20, 0)');
    g.addColorStop(1, `rgba(2, 8, 20, ${opacity})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, wy, cw, ch - wy);
}

// =================================================================
// TERRENO SUBMERSO (fundo, pedras, corais)
// =================================================================
function drawTerrain(t) {
    const wy = waterY();
    const wh = waterHeight();
    const bottom = wy + wh;
    const zone = state.currentZone;
    const floorH = 60;

    // Faixa de areia/fundo
    const sandColors = [
        ['#D4B896', '#C2A67A', '#A68A5C'],  // Costa
        ['#B89B72', '#A08060', '#7A6040'],  // Arrecifes
        ['#3A4A5A', '#2A3A4A', '#1A2A3A'],  // Mar Aberto
        ['#0A1525', '#050D18', '#020610'],  // Abissal
    ];
    const [top, mid, bot] = sandColors[zone];
    const fg = ctx.createLinearGradient(0, bottom - floorH, 0, bottom);
    fg.addColorStop(0, top);
    fg.addColorStop(0.5, mid);
    fg.addColorStop(1, bot);
    ctx.fillStyle = fg;
    ctx.beginPath();
    // A borda inferior vai ate ch, nao ate `bottom`: waterHeight() reserva 110px
    // para a area dos controles, e parar em `bottom` deixava a areia flutuando
    // com agua lisa embaixo.
    ctx.moveTo(0, ch);
    for (let x = 0; x <= cw; x += 20) {
        const h = bottom - floorH + Math.sin(x * 0.015 + t * 0.0003) * 8
                + Math.sin(x * 0.04) * 4;
        ctx.lineTo(x, h);
    }
    ctx.lineTo(cw, ch);
    ctx.closePath();
    ctx.fill();

    // Detalhes por zona
    if (zone === 0) {
        // Conchas e pedrinhas
        for (let i = 0; i < 12; i++) {
            const sx = (i * 137.5 + 42) % cw;
            const sy = bottom - 18 - (i % 5) * 6;
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (zone === 1) {
        // Corais ramificados + corais-cérebro
        const hues = [340, 25, 190, 285, 12, 205, 320, 45];
        for (let i = 0; i < 8; i++) {
            const cx = (i * 173.3 + 90) % cw;
            const base = bottom - 14 - (i % 3) * 4;
            const hue = hues[i];
            const sway = Math.sin(t * 0.0012 + i) * 2;

            if (i % 3 === 2) {
                // Coral-cérebro: cúpula com sulcos
                ctx.fillStyle = `hsla(${hue}, 55%, 46%, 0.75)`;
                ctx.beginPath();
                ctx.ellipse(cx, base, 13, 9, 0, Math.PI, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `hsla(${hue}, 50%, 30%, 0.5)`;
                ctx.lineWidth = 1;
                for (let k = -1; k <= 1; k++) {
                    ctx.beginPath();
                    ctx.arc(cx + k * 5, base + 1, 4, Math.PI * 1.1, Math.PI * 1.9);
                    ctx.stroke();
                }
            } else {
                // Coral de galhos: tronco + 2 níveis de ramos
                ctx.strokeStyle = `hsla(${hue}, 62%, 50%, 0.8)`;
                ctx.lineCap = 'round';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(cx, base);
                ctx.lineTo(cx + sway * 0.4, base - 16);
                ctx.stroke();
                ctx.lineWidth = 2.6;
                for (const dir of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(cx + sway * 0.2, base - 9);
                    ctx.lineTo(cx + dir * 8 + sway, base - 20);
                    ctx.stroke();
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    ctx.moveTo(cx + dir * 6 + sway * 0.8, base - 17);
                    ctx.lineTo(cx + dir * 11 + sway * 1.2, base - 27);
                    ctx.stroke();
                    ctx.lineWidth = 2.6;
                }
                // pontinhas claras
                ctx.fillStyle = `hsla(${hue}, 75%, 70%, 0.7)`;
                for (const [px, py] of [[cx + sway * 0.4, base - 16], [cx - 11 + sway * 1.2, base - 27], [cx + 11 + sway * 1.2, base - 27]]) {
                    ctx.beginPath();
                    ctx.arc(px, py, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    } else if (zone === 2) {
        // Pedras escuras
        for (let i = 0; i < 6; i++) {
            const rx = (i * 211 + 50) % cw;
            const ry = bottom - 22;
            ctx.fillStyle = 'rgba(40,50,60,0.6)';
            ctx.beginPath();
            ctx.ellipse(rx + Math.sin(i*3)*8, ry, 12 + (i%3)*8, 6 + (i%2)*4, 0, 0, Math.PI*2);
            ctx.fill();
        }
    } else if (zone === 3) {
        // Fontes termais (partículas subindo)
        for (let i = 0; i < 4; i++) {
            const vx = cw * (0.2 + i * 0.2);
            const vy = bottom - 40;
            for (let p = 0; p < 6; p++) {
                const px = vx + Math.sin(t * 0.003 + i * 2 + p * 0.8) * 12;
                const py = vy - p * 18 + Math.sin(t * 0.004 + p) * 4;
                const a = 0.15 + 0.15 * Math.sin(t * 0.005 + p);
                ctx.fillStyle = `rgba(180, 100, 80, ${a})`;
                ctx.beginPath();
                ctx.arc(px, py, 2 + Math.abs(Math.sin(t * 0.007 + i * 1.3 + p * 2.1)), 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// =================================================================
// PEIXES (renderização canvas com glow por raridade e size próprio)
// =================================================================
function spawnFish() {
    if (rt.activeFish.length >= MAX_FISH_ON_SCREEN) return;
    const fishType = rollFish(state.currentZone);
    if (!fishType) return;
    const wy = waterY();
    const wh = waterHeight();
    const lane = wy + wh * (0.12 + Math.random() * 0.78);
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -60 : cw + 60;
    // Velocidade agressiva + multiplicador por raridade (raros viram desafio real).
    // Variação leve por instância (±15%) pra não ficar previsível.
    const rarityMult = { common: 1.0, uncommon: 1.15, rare: 1.35, epic: 1.6, legendary: 1.9 };
    const variance = 0.85 + Math.random() * 0.3;
    const mobileFactor = IS_COARSE ? 0.70 : 1.0;   // −30% em touch: dá tempo de reagir
    const baseSpeed = (220 + fishType.speed * 170) * (rarityMult[fishType.rarity] || 1) * variance * mobileFactor;
    const vx = (fromLeft ? 1 : -1) * baseSpeed;

    rt.activeFish.push({
        fish: fishType,
        fishIdx: FISH.indexOf(fishType),    // cache do index pra evitar O(n) por frame
        x, y: lane,
        vx,
        flipped: !fromLeft,
        bobPhase: Math.random() * Math.PI * 2,
        rotation: 0,
        bossHp: fishType.bossHp || 0,
        bossMaxHp: fishType.bossHp || 0,
    });
    // Insere ordenado por size (peixes menores atrás) — evita sort por frame
    rt.activeFish.sort((a, b) => a.fish.size - b.fish.size);
}

function updateFish(delta) {
    const dt = delta * 0.001;
    for (let i = rt.activeFish.length - 1; i >= 0; i--) {
        const f = rt.activeFish[i];
        f.x += f.vx * dt;
        f.bobPhase += delta * 0.005;
        f.y += Math.sin(f.bobPhase) * 0.18;
        f.rotation = Math.sin(f.bobPhase) * 0.06 * (f.flipped ? -1 : 1);

        // Trilhas bioluminescentes (zona abissal, peixes raros+)
        if (state.currentZone === 3 && f.fish.rarity !== 'common') {
            f._trailAcc = (f._trailAcc || 0) + delta;
            if (f._trailAcc > 60) {
                f._trailAcc = 0;
                rt.trails.push({
                    x: f.x - (f.flipped ? -1 : 1) * f.fish.size * 0.3,
                    y: f.y,
                    life: 900, maxLife: 900,
                    color: f.fish.rarity === 'legendary' ? 'rgba(255,179,71,0.7)' :
                           f.fish.rarity === 'epic'      ? 'rgba(187,134,252,0.55)' :
                                                            'rgba(78,205,196,0.4)',
                    size: 1.5 + Math.random() * 3,
                });
            }
        }

        // Peixes raros+ fogem do anzol
        if (rt.fishingActive && !rt.hookDescending && f.fish.rarity !== 'common') {
            const hp = hookPxPos();
            const ddx = hp.x - f.x, ddy = hp.y - f.y;
            const distSq = ddx * ddx + ddy * ddy;
            if (distSq < 40000) {                            // 200² = 40000
                const dist = Math.sqrt(distSq);
                const intensity = (1 - dist / 200) * (f.fish.rarity === 'legendary' ? 2.5 : f.fish.rarity === 'epic' ? 1.8 : 1.2);
                f.vx *= (1 + intensity * dt);
                const maxSpeed = (280 + f.fish.speed * 180) * 2.8 * (IS_COARSE ? 0.70 : 1.0);
                if (Math.abs(f.vx) > maxSpeed) f.vx = Math.sign(f.vx) * maxSpeed;
            }
        }

        // Colisão com anzol (respeita invulnerabilidade de chefão entre golpes)
        if (rt.fishingActive && !rt.hookDescending && !(f.invulnUntil && rt.time < f.invulnUntil)) {
            const hp = hookPxPos();
            const dx = hp.x - f.x;
            const dy = hp.y - f.y;
            const r = getHookRadius();
            if (dx * dx + dy * dy < r * r) {
                const caught = catchFishInteractive(f);
                if (caught) {
                    rt.activeFish.splice(i, 1);
                }
                continue;   // chefão que sobreviveu continua na tela para o próximo golpe
            }
        }
        if (f.x < -100 || f.x > cw + 100) {
            rt.activeFish.splice(i, 1);
            // Peixe escapou sem ser capturado → combo quebra
            if (rt.fishingActive) rt.combo = 0;
        }
    }
}

// =================================================================
// PEIXES — arte pré-renderizada (bake) + blit por frame
//
// Desenhar o peixe forma por forma a cada frame limitava o detalhe: são até
// 14 peixes na tela, 60x por segundo. Renderizando cada espécie uma vez em
// canvas offscreen (um ciclo completo de batida da cauda), o detalhe passa a
// ser pago uma vez só. Isso libera escamas, iridescência, raios de nadadeira
// e o glow de raridade — inclusive shadowBlur, a operação mais cara do
// canvas — sem nenhum custo por frame.
// =================================================================

const FISH_SPRITE_FRAMES = 6;      // ciclo da cauda; acima disso não se percebe
let fishSprites = null;            // cache lazy, por espécie

function fishGeom(s) {
    return { L: s * 0.56, H: s * 0.15, tail: s * 0.21 };
}

// Sobra no sprite para o glow de raridade, que também vai assado
function fishSpritePad(rarity) {
    if (rarity === 'legendary') return 30;
    if (rarity === 'epic')      return 20;
    return 6;
}

// Silhueta do corpo: focinho → dorso → ventre
function fishBodyPath(L, H) {
    ctx.beginPath();
    ctx.moveTo(L * 0.52, 0);
    ctx.bezierCurveTo(L * 0.30, -H * 1.00, -L * 0.10, -H * 1.02, -L * 0.48, -H * 0.28);
    ctx.lineTo(-L * 0.50, H * 0.28);
    ctx.bezierCurveTo(-L * 0.10, H * 1.02, L * 0.30, H * 1.00, L * 0.52, 0);
    ctx.closePath();
}

// Membrana de nadadeira com raios — o que faz a nadadeira parecer nadadeira
// em vez de um triângulo colorido.
function finRays(ax, ay, bx, by, cx, cy, n, alpha) {
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + alpha + ')';
    ctx.lineWidth = 0.7;
    for (let i = 1; i < n; i++) {
        const p = i / n;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        const ex = bx + (cx - bx) * p;
        const ey = by + (cy - by) * p;
        // 0.78: para antes da borda — raio encostando na ponta vaza da membrana
        ctx.lineTo(ax + (ex - ax) * 0.78, ay + (ey - ay) * 0.78);
        ctx.stroke();
    }
}

// Arte completa de uma espécie, na origem, para um instante da batida.
// Nada aqui depende de rt.time: tudo vem de `beat`.
function drawFishArt(idx, beat) {
    const fish = FISH[idx];
    const s = fish.size;
    const col = FISH_COLORS[idx] || ['#9BC4DC', '#5E86A0', '#CFE6F2', '#7FA8C0', '#B8E2F2'];
    const main = col[0], dark = col[1], lite = col[2], fin = col[3], accent = col[4];
    const g = fishGeom(s);
    const L = g.L, H = g.H, tail = g.tail;

    // ── SOMBRA PROJETADA ────────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(0, H + 5, L * 0.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── CAUDA ───────────────────────────────────────────────────
    ctx.save();
    ctx.translate(-L * 0.48, 0);
    ctx.rotate(beat * 0.30);
    const tg = ctx.createLinearGradient(0, 0, -tail, 0);
    tg.addColorStop(0, lite);
    tg.addColorStop(0.45, fin);
    tg.addColorStop(1, main);
    ctx.fillStyle = tg;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-tail * 0.52, -H * 0.55, -tail, -H * 1.20);
    ctx.quadraticCurveTo(-tail * 0.60, -H * 0.34, -tail * 0.52, 0);
    ctx.quadraticCurveTo(-tail * 0.60,  H * 0.34, -tail,  H * 1.20);
    ctx.quadraticCurveTo(-tail * 0.52,  H * 0.55, 2, 0);
    ctx.closePath();
    ctx.fill();
    finRays(0, 0, -tail, -H * 1.15, -tail * 0.52, 0, 4, 0.30);
    finRays(0, 0, -tail,  H * 1.15, -tail * 0.52, 0, 4, 0.30);
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── DORSAL ──────────────────────────────────────────────────
    ctx.fillStyle = fin;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(-L * 0.26, -H * 0.72);
    ctx.quadraticCurveTo(-L * 0.08, -H * (1.42 + beat * 0.10), L * 0.10, -H * 0.92);
    ctx.quadraticCurveTo(-L * 0.06, -H * 1.00, -L * 0.26, -H * 0.72);
    ctx.closePath();
    ctx.fill();
    finRays(-L * 0.20, -H * 0.78, -L * 0.06, -H * 1.32, L * 0.08, -H * 0.90, 4, 0.32);

    // ── ANAL ────────────────────────────────────────────────────
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(-L * 0.32, H * 0.62);
    ctx.quadraticCurveTo(-L * 0.20, H * (1.18 - beat * 0.08), -L * 0.08, H * 0.78);
    ctx.quadraticCurveTo(-L * 0.20, H * 0.88, -L * 0.32, H * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── CORPO ───────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, -H * 1.1, 0, H * 1.1);
    bg.addColorStop(0,    lite);
    bg.addColorStop(0.42, main);
    bg.addColorStop(1,    dark);
    ctx.fillStyle = bg;
    fishBodyPath(L, H);
    ctx.fill();

    // Tudo daqui pra baixo fica confinado ao corpo
    ctx.save();
    fishBodyPath(L, H);
    ctx.clip();

    // Escamas: fileiras alternadas de arcos, com sombra embaixo e luz em cima
    const colW = Math.max(2.2, L * 0.095);
    const rowH = Math.max(2.0, H * 0.40);
    for (let r = -3; r <= 3; r++) {
        for (let c = -6; c <= 4; c++) {
            const sx = c * colW + (Math.abs(r % 2) ? colW * 0.5 : 0);
            const sy = r * rowH;
            ctx.strokeStyle = 'rgba(0, 18, 34, 0.13)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(sx, sy, colW * 0.62, Math.PI * 0.12, Math.PI * 0.88);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
            ctx.beginPath();
            ctx.arc(sx, sy - 0.7, colW * 0.62, Math.PI * 0.18, Math.PI * 0.82);
            ctx.stroke();
        }
    }

    // Barriga clara
    const belly = ctx.createLinearGradient(0, H * 0.10, 0, H * 1.1);
    belly.addColorStop(0, 'rgba(255,255,255,0)');
    belly.addColorStop(1, 'rgba(255,255,255,0.42)');
    ctx.fillStyle = belly;
    ctx.fillRect(-L, 0, L * 2, H * 1.2);

    // Oclusão no ventre — separa a barriga do fundo
    const ao = ctx.createLinearGradient(0, H * 0.55, 0, H * 1.15);
    ao.addColorStop(0, 'rgba(0, 20, 40, 0)');
    ao.addColorStop(1, 'rgba(0, 20, 40, 0.30)');
    ctx.fillStyle = ao;
    ctx.fillRect(-L, H * 0.5, L * 2, H * 0.7);

    // Iridescência: sheen frio→quente atravessando o corpo
    const irid = ctx.createLinearGradient(-L * 0.5, -H, L * 0.5, H);
    irid.addColorStop(0,    'rgba(120, 225, 255, 0.16)');
    irid.addColorStop(0.45, 'rgba(255, 255, 255, 0.04)');
    irid.addColorStop(0.75, 'rgba(255, 150, 220, 0.13)');
    irid.addColorStop(1,    'rgba(150, 255, 210, 0.10)');
    ctx.fillStyle = irid;
    ctx.fillRect(-L, -H * 1.2, L * 2, H * 2.4);

    // Listras (em parte das espécies)
    if (accent && idx % 3 !== 2) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1.2, s * 0.030);
        ctx.globalAlpha = 0.26;
        for (let si = 0; si < 3; si++) {
            const ox = -L * 0.22 + si * L * 0.17;
            ctx.beginPath();
            ctx.moveTo(ox - L * 0.05, -H * 1.1);
            ctx.quadraticCurveTo(ox + L * 0.03, 0, ox - L * 0.05, H * 1.1);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // Luz de topo (rim light no dorso)
    const rim = ctx.createLinearGradient(0, -H * 1.05, 0, -H * 0.35);
    rim.addColorStop(0, 'rgba(255,255,255,0.42)');
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rim;
    ctx.fillRect(-L, -H * 1.1, L * 2, H * 0.8);

    // Brilho especular
    ctx.fillStyle = 'rgba(255,255,255,0.26)';
    ctx.beginPath();
    ctx.ellipse(L * 0.04, -H * 0.60, L * 0.24, H * 0.15, -0.07, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();   // fim do clip do corpo

    // ── PEITORAL (por cima do corpo) ────────────────────────────
    ctx.fillStyle = fin;
    ctx.globalAlpha = 0.72;
    ctx.save();
    ctx.translate(L * 0.16, H * 0.28);
    ctx.rotate(0.30 + beat * 0.18);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-L * 0.07, H * 0.24, -L * 0.14, H * 0.56);
    ctx.quadraticCurveTo(-L * 0.04, H * 0.24, 0, 0);
    ctx.closePath();
    ctx.fill();
    finRays(0, 0, -L * 0.14, H * 0.54, -L * 0.02, H * 0.10, 3, 0.34);
    ctx.restore();
    ctx.globalAlpha = 1;

    // ── OPÉRCULO (tampa da guelra) ──────────────────────────────
    ctx.strokeStyle = 'rgba(0, 30, 50, 0.30)';
    ctx.lineWidth = Math.max(0.8, s * 0.010);
    ctx.beginPath();
    ctx.moveTo(L * 0.24, -H * 0.66);
    ctx.quadraticCurveTo(L * 0.15, 0, L * 0.24, H * 0.62);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(0.6, s * 0.007);
    ctx.beginPath();
    ctx.moveTo(L * 0.26, -H * 0.62);
    ctx.quadraticCurveTo(L * 0.17, 0, L * 0.26, H * 0.58);
    ctx.stroke();

    // ── BOCA ────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0, 25, 45, 0.45)';
    ctx.lineWidth = Math.max(0.7, s * 0.009);
    ctx.beginPath();
    ctx.moveTo(L * 0.50, H * 0.04);
    ctx.quadraticCurveTo(L * 0.44, H * 0.16, L * 0.38, H * 0.13);
    ctx.stroke();

    // ── CONTORNO ────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0, 22, 40, 0.30)';
    ctx.lineWidth = Math.max(0.8, s * 0.012);
    fishBodyPath(L, H);
    ctx.stroke();

    // ── OLHO ────────────────────────────────────────────────────
    const eyeR = Math.max(1.3, H * 0.24);
    const ex = L * 0.30, ey = -H * 0.16;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();
    const iris = ctx.createRadialGradient(ex + eyeR * 0.1, ey - eyeR * 0.1, eyeR * 0.1,
                                          ex + eyeR * 0.1, ey, eyeR * 0.62);
    iris.addColorStop(0, '#4A6E8A');
    iris.addColorStop(1, '#10202E');
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(ex + eyeR * 0.12, ey + eyeR * 0.08, eyeR * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0A121C';
    ctx.beginPath();
    ctx.arc(ex + eyeR * 0.12, ey + eyeR * 0.08, eyeR * 0.30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + eyeR * 0.30, ey - eyeR * 0.36, eyeR * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,20,40,0.30)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.stroke();

    // ── GLOW DE RARIDADE (assado: zero shadowBlur por frame) ────
    const glow = RARITY_GLOW[fish.rarity];
    if (glow) {
        ctx.save();
        if (fish.rarity === 'legendary' || fish.rarity === 'epic') {
            ctx.shadowColor = glow;
            ctx.shadowBlur = fish.rarity === 'legendary' ? 22 : 14;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 1.4;
        } else {
            ctx.globalAlpha = fish.rarity === 'rare' ? 0.55 : 0.35;
            ctx.lineWidth = fish.rarity === 'rare' ? 1.6 : 1.0;
        }
        ctx.strokeStyle = glow;
        fishBodyPath(L, H);
        ctx.stroke();
        ctx.restore();
    }
}

// Assa um ciclo de animação da espécie em canvas offscreen
function bakeFishSprite(idx) {
    const fish = FISH[idx];
    const s = fish.size;
    const pad = fishSpritePad(fish.rarity);
    const g = fishGeom(s);

    const left   = g.L * 0.48 + g.tail + pad;   // ponta da cauda
    const right  = g.L * 0.52 + pad;            // focinho
    const top    = s * 0.28 + pad;
    const bottom = s * 0.28 + pad + 8;          // sobra da sombra projetada

    const w = Math.ceil(left + right);
    const h = Math.ceil(top + bottom);
    const dpr = renderDpr;
    const frames = [];

    for (let i = 0; i < FISH_SPRITE_FRAMES; i++) {
        const c = document.createElement('canvas');
        c.width  = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
        const prev = ctx;
        ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(left, top);
        try {
            drawFishArt(idx, Math.sin((i / FISH_SPRITE_FRAMES) * Math.PI * 2));
        } finally {
            ctx = prev;
        }
        frames.push(c);
    }

    return { frames: frames, w: w, h: h, ox: left, oy: top, dpr: dpr };
}

function fishSpriteFor(idx) {
    if (!fishSprites) fishSprites = {};
    const cached = fishSprites[idx];
    if (cached && cached.dpr === renderDpr) return cached;
    const sp = bakeFishSprite(idx);
    fishSprites[idx] = sp;
    return sp;
}

// Marcadores de raridade: [glifo, px, r, g, b, velocidade, base, amplitude, altura]
const RARITY_MARK = {
    legendary: ['⭐', 14, 255, 179,  71, 0.008, 0.50, 0.50, 2.0],
    epic:      ['✦', 11, 187, 134, 252, 0.006, 0.40, 0.40, 1.8],
    rare:      ['♦',  9,  78, 205, 196, 0.005, 0.30, 0.30, 1.6],
    uncommon:  ['·',  8, 173, 216, 230, 0.004, 0.25, 0.20, 1.5],
};

function drawFish(f) {
    const idx = f.fishIdx != null ? f.fishIdx : FISH.indexOf(f.fish);
    if (idx < 0) return;
    const g = fishGeom(f.fish.size);
    const L = g.L, H = g.H;

    // Quadro do ciclo de batida — mesma fase de antes, agora quantizada
    const phase = (rt.time * 0.011 + (f.bobPhase || 0)) / (Math.PI * 2);
    const frameIdx = ((Math.floor(phase * FISH_SPRITE_FRAMES) % FISH_SPRITE_FRAMES)
                      + FISH_SPRITE_FRAMES) % FISH_SPRITE_FRAMES;

    const sp = fishSpriteFor(idx);

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    if (f.flipped) ctx.scale(-1, 1);

    ctx.drawImage(sp.frames[frameIdx], -sp.ox, -sp.oy, sp.w, sp.h);

    // ── SOBREPOSIÇÕES DINÂMICAS (dependem do estado, não dá pra assar) ──

    // Barra de vida do chefão
    if (f.bossHp > 0 && f.bossMaxHp > 0) {
        const bw = L * 0.7, bh = Math.max(3, H * 0.28);
        const ratio = f.bossHp / f.bossMaxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-bw / 2, -H * 1.3, bw, bh);
        const barGrad = ctx.createLinearGradient(-bw / 2, 0, -bw / 2 + bw * ratio, 0);
        barGrad.addColorStop(0, '#ff4444');
        barGrad.addColorStop(1, '#ffb347');
        ctx.fillStyle = barGrad;
        ctx.fillRect(-bw / 2 + 1, -H * 1.3 + 1, (bw - 2) * ratio, bh - 2);
    }

    // Indicador de raridade (pisca, então fica fora do sprite)
    const mark = RARITY_MARK[f.fish.rarity];
    if (mark) {
        const shimmer = mark[6] + mark[7] * Math.sin(rt.time * mark[5]);
        ctx.fillStyle = 'rgba(' + mark[2] + ', ' + mark[3] + ', ' + mark[4] + ', ' + shimmer + ')';
        ctx.font = mark[1] + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mark[0], 0, -H * mark[8]);
    }

    ctx.restore();
}

// =================================================================
// ANZOL
// =================================================================
function drawHook(t) {
    const hp = hookPxPos();
    ctx.save();
    ctx.translate(hp.x, hp.y);

    // Halo de captura (sutil, mostra a área real)
    if (rt.fishingActive) {
        const r = getHookRadius();
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0,   'rgba(0, 212, 255, 0.18)');
        g.addColorStop(0.7, 'rgba(0, 212, 255, 0.05)');
        g.addColorStop(1,   'rgba(0, 212, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const sway = Math.sin(t * 0.003) * 0.12;
    ctx.rotate(sway);

    // Isca brilhante logo abaixo do olhal
    const pulse = 0.6 + 0.4 * Math.sin(t * 0.006);
    ctx.fillStyle = `rgba(255, 190, 90, ${0.65 + pulse * 0.3})`;
    ctx.shadowColor = 'rgba(255, 170, 60, 0.8)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(1.5, -2, 3.4, 5.2, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Metal do anzol
    const metal = ctx.createLinearGradient(-8, -16, 8, 12);
    metal.addColorStop(0,    '#F2F6FA');
    metal.addColorStop(0.35, '#B9C6D2');
    metal.addColorStop(0.7,  '#7C8B99');
    metal.addColorStop(1,    '#D8E2EA');

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 3);
    ctx.quadraticCurveTo(0, 12, -6.5, 11);
    ctx.quadraticCurveTo(-11, 10, -10, 2.5);
    ctx.stroke();

    ctx.strokeStyle = metal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 3);
    ctx.quadraticCurveTo(0, 12, -6.5, 11);
    ctx.quadraticCurveTo(-11, 10, -10, 2.5);
    ctx.stroke();

    // Farpa
    ctx.beginPath();
    ctx.moveTo(-10, 2.5);
    ctx.lineTo(-6.5, 6.5);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Olhal
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -15.5, 3, Math.PI * 0.15, Math.PI * 1.95);
    ctx.stroke();

    // Reflexo
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1.2, -10);
    ctx.lineTo(-1.2, 0);
    ctx.stroke();

    ctx.restore();
}

// =================================================================
// BARCO + PESCADOR "ANGELO" (100% canvas, estilo cartoon)
// =================================================================

// Retângulo arredondado com fallback (roundRect é recente em alguns browsers)
function rrect(x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
}

const HULL_W = 196, HULL_H = 44;

// Linha de borda (sheer): popa e proa levantadas, meio rebaixado
function hullTopEdge(W, H) {
    ctx.moveTo(-W / 2, -H / 2 - 7);
    ctx.quadraticCurveTo(-W / 4, -H / 2 + 4, 0, -H / 2 + 4);
    ctx.quadraticCurveTo( W / 4, -H / 2 + 4, W / 2, -H / 2 - 13);
}

// Silhueta do casco (proa à direita, popa à esquerda)
function hullPath(W, H) {
    ctx.beginPath();
    hullTopEdge(W, H);
    ctx.quadraticCurveTo(W / 2 + 4, -H / 2 + 18, W / 2 - 30, H / 2);
    ctx.lineTo(-W / 2 + 26, H / 2);
    ctx.quadraticCurveTo(-W / 2 - 10, -H / 2 + 12, -W / 2, -H / 2 - 7);
    ctx.closePath();
}

// Cabelo cacheado — massa base + cachos sobrepostos + brilho quente
function drawCurlyHair(hx, hy, rx, ry, t) {
    ctx.fillStyle = '#231913';
    ctx.beginPath();
    ctx.ellipse(hx, hy, rx * 1.06, ry * 0.86, 0, Math.PI * 0.94, Math.PI * 2.08);
    ctx.fill();

    // Costeletas — descem pelas laterais até a altura da orelha
    ctx.beginPath();
    ctx.ellipse(hx - rx * 0.94, hy + ry * 0.30, rx * 0.20, ry * 0.34, 0, 0, Math.PI * 2);
    ctx.ellipse(hx + rx * 0.94, hy + ry * 0.30, rx * 0.20, ry * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    const curls = [
        [-1.02, -0.10, 0.28], [-0.92, -0.48, 0.33], [-0.62, -0.78, 0.36],
        [-0.22, -0.92, 0.37], [ 0.20, -0.92, 0.35], [ 0.57, -0.80, 0.33],
        [ 0.87, -0.50, 0.30], [ 1.00, -0.12, 0.25],
        [-0.48, -0.44, 0.25], [ 0.08, -0.52, 0.26], [ 0.54, -0.38, 0.23],
        [-0.96,  0.22, 0.20], [ 0.97,  0.20, 0.19],
    ];
    for (let i = 0; i < curls.length; i++) {
        const [ux, uy, ur] = curls[i];
        const wob = Math.sin(t * 0.0016 + i * 1.7) * 0.7;
        ctx.fillStyle = i % 3 === 0 ? '#33241C' : '#231913';
        ctx.beginPath();
        ctx.arc(hx + ux * rx + wob, hy + uy * ry + wob * 0.5, ur * rx, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#7A5540';
    for (const [ux, uy, ur] of [[-0.72, -0.70, 0.17], [-0.34, -0.86, 0.15], [0.06, -0.87, 0.12]]) {
        ctx.beginPath();
        ctx.arc(hx + ux * rx, hy + uy * ry, ur * rx, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// O Angelo. Origem = quadril; y cresce pra baixo. Olha pra direita (pro mar).
function drawAngelo(t, cheer) {
    const SKIN      = '#E9BA8C';
    const SKIN_DARK = '#CF9865';
    const SHIRT     = '#9CA2A8';
    const SHIRT_SH  = '#7C838B';
    const SHORTS    = '#2E6FD1';
    const SHORTS_SH = '#1F4C9C';

    // Respiração + pulinho ao comemorar
    const breathe = Math.sin(t * 0.0022) * 0.8;
    const hop     = cheer ? Math.abs(Math.sin(t * 0.014)) * 3.5 : 0;
    ctx.save();
    ctx.translate(0, breathe - hop);

    // ── PERNAS + SANDÁLIAS ──────────────────────────────────────
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const lx of [-6, 6]) {
        ctx.beginPath();
        ctx.moveTo(lx, 8);
        ctx.lineTo(lx * 0.9, 28);
        ctx.stroke();
    }
    ctx.fillStyle = '#2B3A55';
    for (const lx of [-6, 6]) {
        rrect(lx * 0.9 - 6, 27, 13, 5, 2.5);
        ctx.fill();
    }

    // ── BERMUDA DE TUBARÃO ──────────────────────────────────────
    const sg = ctx.createLinearGradient(0, -3, 0, 15);
    sg.addColorStop(0, SHORTS);
    sg.addColorStop(1, SHORTS_SH);
    ctx.fillStyle = sg;
    rrect(-12, -3, 24, 18, 5); ctx.fill();
    // fenda entre as pernas
    ctx.fillStyle = SHORTS_SH;
    ctx.beginPath();
    ctx.moveTo(-1.5, 15); ctx.lineTo(0, 6); ctx.lineTo(1.5, 15);
    ctx.closePath(); ctx.fill();
    // estampa: tubaroezinhos
    ctx.fillStyle = 'rgba(190, 226, 255, 0.85)';
    for (const [sx, sy, sc] of [[-7, 2, 1], [4, 5, 0.85], [-3, 9, 0.75]]) {
        ctx.save();
        ctx.translate(sx, sy); ctx.scale(sc, sc);
        ctx.beginPath();                        // corpinho
        ctx.moveTo(-4, 0); ctx.quadraticCurveTo(0, -2.2, 4, 0);
        ctx.quadraticCurveTo(0, 2.2, -4, 0);
        ctx.fill();
        ctx.beginPath();                        // barbatana
        ctx.moveTo(0, -1.4); ctx.lineTo(1.4, -3.6); ctx.lineTo(2.2, -1.2);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    // ── BRAÇO DE TRÁS (atrás da camiseta) — pega baixa na vara ──
    ctx.strokeStyle = SKIN_DARK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-4, -22);
    ctx.quadraticCurveTo(8, -25, 19.5, -28.3);
    ctx.stroke();

    // ── CAMISETA CINZA ──────────────────────────────────────────
    const tg = ctx.createLinearGradient(0, -26, 0, 0);
    tg.addColorStop(0, '#ADB3B9');
    tg.addColorStop(1, SHIRT_SH);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-13, -24);
    ctx.quadraticCurveTo(0, -28, 13, -24);
    ctx.lineTo(12, 0);
    ctx.quadraticCurveTo(0, 3, -12, 0);
    ctx.closePath();
    ctx.fill();
    // mangas
    ctx.fillStyle = SHIRT;
    rrect(-17, -24, 8, 11, 3.5); ctx.fill();
    rrect(  9, -24, 8, 11, 3.5); ctx.fill();
    // dobra da barra + gola
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-11, -4); ctx.quadraticCurveTo(0, -1.5, 11, -4); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,66,72,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -26, 5.5, 0.25, Math.PI - 0.25); ctx.stroke();

    // ── PESCOÇO + CABEÇA ────────────────────────────────────────
    const headY = -42, headRX = 13, headRY = 14;
    const nod = cheer ? -2 : Math.sin(t * 0.0012) * 0.8;

    ctx.fillStyle = SKIN_DARK;
    rrect(-4, -31, 8, 7, 3); ctx.fill();

    ctx.save();
    ctx.translate(0, nod);

    // orelhas
    ctx.fillStyle = SKIN_DARK;
    ctx.beginPath();
    ctx.ellipse(-headRX + 1, headY + 3, 3.2, 4, 0, 0, Math.PI * 2);
    ctx.ellipse( headRX - 1, headY + 3, 3.2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // rosto
    const fg = ctx.createRadialGradient(-3, headY - 4, 2, 0, headY, headRX * 1.3);
    fg.addColorStop(0, '#F6D4AF');
    fg.addColorStop(1, SKIN);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(0, headY, headRX, headRY, 0, 0, Math.PI * 2);
    ctx.fill();

    drawCurlyHair(0, headY - 11, headRX, headRY, t);

    // bochechas
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = '#E8836B';
    ctx.beginPath();
    ctx.ellipse(-7.5, headY + 4.5, 3.6, 2.4, 0, 0, Math.PI * 2);
    ctx.ellipse( 7.5, headY + 4.5, 3.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // olhos (com piscada periódica)
    const blinkCycle = (t % 4200) / 4200;
    const blink = blinkCycle > 0.965 ? 0.12 : 1;
    for (const ex of [-5, 5.5]) {
        const ey = headY - 1;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.scale(1, blink);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 4.0, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4A2C18';                       // íris castanha
        ctx.beginPath(); ctx.arc(0.7, 0.3, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#140C06';
        ctx.beginPath(); ctx.arc(0.7, 0.3, 1.25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(-0.5, -1.3, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // sobrancelhas
    ctx.strokeStyle = '#2A1E17';
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, headY - 5.4); ctx.quadraticCurveTo(-5, headY - 7.2, -2, headY - 5.8);
    ctx.moveTo( 2.5, headY - 5.8); ctx.quadraticCurveTo(5.5, headY - 7.2, 8.5, headY - 5.4);
    ctx.stroke();

    // narizinho
    ctx.strokeStyle = SKIN_DARK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(1.5, headY + 3.5, 1.8, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();

    // boca
    if (cheer) {
        ctx.fillStyle = '#7A2B2B';
        ctx.beginPath();
        ctx.ellipse(0.5, headY + 8, 4.2, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        rrect(-3.4, headY + 5.2, 7.8, 1.8, 0.8); ctx.fill();
    } else {
        ctx.strokeStyle = '#8A4A34';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0.5, headY + 5.5, 4, 0.22, Math.PI - 0.22);
        ctx.stroke();
    }

    ctx.restore();  // cabeça

    // ── BRAÇO DA FRENTE (pega baixa, junto ao molinete) ─────────
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, -21);
    ctx.quadraticCurveTo(20, -27, 31.6, -36.9);
    ctx.stroke();

    ctx.restore();
    return breathe - hop;   // deslocamento vertical, p/ as mãos acompanharem
}

// Mãos: desenhadas por cima da vara pra parecer que ela está mesmo segura
function drawAngeloHands(dy) {
    ctx.save();
    ctx.translate(-26, -14 + dy);
    ctx.fillStyle = '#CF9865';
    ctx.beginPath(); ctx.arc(19.5, -28.3, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E9BA8C';
    ctx.beginPath(); ctx.arc(31.6, -36.9, 3.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawBoat(t) {
    const m = boatMetrics(t);
    const cheer = rt.cheerUntil > rt.time;

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.tilt);
    ctx.scale(m.s, m.s);

    // ── SOMBRA / RASTRO NA ÁGUA ─────────────────────────────────
    ctx.fillStyle = 'rgba(4, 20, 38, 0.30)';
    ctx.beginPath();
    ctx.ellipse(0, HULL_H / 2 + 2, HULL_W * 0.52, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // espuma na linha d'água (bolhinhas ao redor do casco)
    for (let i = 0; i < 14; i++) {
        const p = i / 13;
        const fx = -HULL_W * 0.52 + p * HULL_W * 1.04;
        const edge = 1 - Math.abs(p - 0.5) * 1.6;          // mais espuma nas pontas
        const fy = HULL_H / 2 - 6 + Math.sin(t * 0.004 + i * 1.4) * 2;
        const fr = (1.4 + (1 - edge) * 3.2) * (0.7 + 0.3 * Math.sin(t * 0.005 + i));
        ctx.fillStyle = `rgba(255,255,255,${0.16 + (1 - edge) * 0.30})`;
        ctx.beginPath();
        ctx.ellipse(fx, fy, fr * 1.8, fr, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── CASCO (silhueta cheia) ──────────────────────────────────
    const hg = ctx.createLinearGradient(0, -HULL_H / 2, 0, HULL_H / 2);
    hg.addColorStop(0,    '#C87F4A');
    hg.addColorStop(0.35, '#9A5527');
    hg.addColorStop(1,    '#4A2511');
    hullPath(HULL_W, HULL_H);
    ctx.fillStyle = hg;
    ctx.fill();

    // interior sombreado (o barco é aberto — dá pra ver o Angelo dentro)
    ctx.save();
    hullPath(HULL_W, HULL_H);
    ctx.clip();
    ctx.fillStyle = '#5C3218';
    ctx.fillRect(-HULL_W, -HULL_H / 2, HULL_W * 2, HULL_H / 2 - 2);
    ctx.restore();

    // ── ANGELO (dentro do barco) ────────────────────────────────
    ctx.save();
    ctx.translate(-26, -14);
    const angeloDy = drawAngelo(t, cheer);
    ctx.restore();

    // ── PAREDE DA FRENTE DO CASCO (cobre os pés) ────────────────
    ctx.save();
    hullPath(HULL_W, HULL_H);
    ctx.clip();
    const fw = ctx.createLinearGradient(0, -2, 0, HULL_H / 2);
    fw.addColorStop(0,   '#B7713F');
    fw.addColorStop(0.5, '#8B4A22');
    fw.addColorStop(1,   '#48240F');
    ctx.fillStyle = fw;
    ctx.fillRect(-HULL_W, -2, HULL_W * 2, HULL_H);
    // tábuas
    ctx.strokeStyle = 'rgba(40, 18, 6, 0.30)';
    ctx.lineWidth = 1;
    for (const ly of [5, 12, 18]) {
        ctx.beginPath();
        ctx.moveTo(-HULL_W / 2, ly); ctx.lineTo(HULL_W / 2, ly); ctx.stroke();
    }
    // veios verticais
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.10)';
    for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 22, -2); ctx.lineTo(i * 22 + 2, HULL_H / 2); ctx.stroke();
    }
    ctx.restore();

    // ── BORDA (amurada) — acompanha a curva da linha de borda ───
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#E9BC92';
    ctx.lineWidth = 6;
    ctx.beginPath(); hullTopEdge(HULL_W, HULL_H); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 240, 220, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); hullTopEdge(HULL_W, HULL_H); ctx.stroke();

    // banco / trave interna
    ctx.save();
    hullPath(HULL_W, HULL_H); ctx.clip();
    ctx.fillStyle = '#D9A273';
    rrect(-HULL_W / 2 + 8, -5, HULL_W - 46, 5, 2.5); ctx.fill();
    ctx.strokeStyle = 'rgba(90, 45, 15, 0.45)';
    ctx.lineWidth = 1;
    rrect(-HULL_W / 2 + 8, -5, HULL_W - 46, 5, 2.5); ctx.stroke();
    ctx.restore();

    // ── FAIXA DECORATIVA + NOME ─────────────────────────────────
    ctx.save();
    hullPath(HULL_W, HULL_H); ctx.clip();
    ctx.fillStyle = '#E23B3B';
    ctx.fillRect(-HULL_W / 2, 3, HULL_W, 4.5);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ANGELO', -16, 14);
    ctx.restore();

    // ── BALDINHO COM PEIXE ──────────────────────────────────────
    ctx.save();
    ctx.translate(46, -HULL_H / 2 + 2);
    ctx.fillStyle = '#4FA3D1';
    ctx.beginPath();
    ctx.moveTo(-8, -12); ctx.lineTo(8, -12); ctx.lineTo(6, 0); ctx.lineTo(-6, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2E7BA6';
    rrect(-9, -14, 18, 3, 1.5); ctx.fill();
    ctx.strokeStyle = '#9BD4EE';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -14, 7, Math.PI, Math.PI * 2); ctx.stroke();
    // rabinho de peixe pra fora
    ctx.fillStyle = '#F2A03D';
    ctx.beginPath();
    ctx.moveTo(2, -14); ctx.lineTo(9, -20); ctx.lineTo(9, -13);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // ── MASTRO + BANDEIRINHA ────────────────────────────────────
    const mastX = -HULL_W / 2 + 24;
    ctx.strokeStyle = '#6B4227';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mastX, -HULL_H / 2 + 2);
    ctx.lineTo(mastX, -HULL_H / 2 - 52);
    ctx.stroke();
    ctx.fillStyle = '#F2C744';
    ctx.beginPath();
    ctx.moveTo(mastX, -HULL_H / 2 - 52);
    for (let i = 0; i <= 6; i++) {
        const p = i / 6;
        ctx.lineTo(mastX + p * 26, -HULL_H / 2 - 52 + Math.sin(t * 0.006 + p * 4) * 3 * p + p * 2);
    }
    for (let i = 6; i >= 0; i--) {
        const p = i / 6;
        ctx.lineTo(mastX + p * 26, -HULL_H / 2 - 40 + Math.sin(t * 0.006 + p * 4) * 3 * p - p * 2);
    }
    ctx.closePath();
    ctx.fill();

    // ── VARA DE PESCA (afunilada, com passadores e molinete) ────
    // Curva da vara: base no quadril, controle no meio, ponta = ROD_TIP_LOCAL
    const rodBase = { x: -22, y: -30 };
    const rodTip  = { x: ROD_TIP_LOCAL.x + Math.sin(t * 0.0021) * 2.5, y: ROD_TIP_LOCAL.y };
    const rodCtl  = { x: 16, y: -62 };

    const rodStroke = () => {
        ctx.beginPath();
        ctx.moveTo(rodBase.x, rodBase.y);
        ctx.quadraticCurveTo(rodCtl.x, rodCtl.y, rodTip.x, rodTip.y);
        ctx.stroke();
    };
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3B2412'; ctx.lineWidth = 4;   rodStroke();
    ctx.strokeStyle = '#A8703C'; ctx.lineWidth = 2;   rodStroke();

    // cabo emborrachado + molinete, logo abaixo da pega de baixo
    ctx.strokeStyle = '#3E2B1C';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(rodBase.x, rodBase.y);
    ctx.lineTo(-13.5, -38.5);
    ctx.stroke();
    // molinete compacto, pendurado sob a vara
    ctx.fillStyle = '#CDD4DB';
    ctx.beginPath();
    ctx.arc(-13, -34.5, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#77828D';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#77828D';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-13, -34.5);
    ctx.lineTo(-17.5, -32.5);
    ctx.stroke();

    // mãos por cima da vara
    drawAngeloHands(angeloDy);

    // ponta brilhante
    ctx.fillStyle = '#FFE9A8';
    ctx.shadowColor = 'rgba(255, 220, 120, 0.85)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(rodTip.x, rodTip.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── ESTRELINHAS DE COMEMORAÇÃO ──────────────────────────────
    if (cheer && !REDUCED_MOTION) {
        const k = (rt.cheerUntil - rt.time) / 1200;
        ctx.globalAlpha = Math.max(0, Math.min(1, k));
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < 4; i++) {
            const a = t * 0.004 + i * 1.57;
            ctx.fillText('✨', -26 + Math.cos(a) * 26, -60 + Math.sin(a) * 12);
        }
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

// =================================================================
// PÓS-PROCESSAMENTO — óptica da água (refração · bloom · color grade)
// Tudo em canvas 2D puro, sem dependências.
// =================================================================

// Camadas offscreen reaproveitadas entre frames (recriadas só no resize)
function getFxLayer(name, scale = 1) {
    if (!rt.fx) rt.fx = {};
    const dpr = renderDpr;
    const w = Math.max(1, Math.round(cw * scale * dpr));
    const h = Math.max(1, Math.round(ch * scale * dpr));
    let L = rt.fx[name];
    if (!L || L.w !== w || L.h !== h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        L = { w, h, dpr, scale, canvas: c, ctx: c.getContext('2d') };
        rt.fx[name] = L;
    }
    // Mesma escala lógica do canvas principal: as funções de desenho não mudam
    L.ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    return L;
}

// Desenha `fn` numa camada offscreen limpa em vez de na tela
function drawToLayer(layer, fn) {
    const prev = ctx;
    layer.ctx.save();
    layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    layer.ctx.clearRect(0, 0, layer.w, layer.h);
    layer.ctx.restore();
    ctx = layer.ctx;
    try { fn(); } finally { ctx = prev; }
}

// QUALIDADE ADAPTATIVA — o custo dos passes é proporcional aos pixels, e não dá
// pra saber de antemão o que o aparelho aguenta. Em vez de chutar, mede: se o
// frame estourar o orçamento de forma sustentada, derruba um nível (bloom sai
// primeiro, refração depois); se sobrar folga por bastante tempo, volta a subir.
const FX_FULL = 2, FX_NO_BLOOM = 1, FX_MINIMO = 0;
const fxQ = { level: FX_FULL, slow: 0, fast: 0 };

function updateFxQuality(delta) {
    // delta já vem limitado a 50ms no gameLoop, então trocas de aba não contam
    if (delta > 21) { fxQ.slow++; fxQ.fast = 0; }
    else if (delta < 15) { fxQ.fast++; fxQ.slow = 0; }

    if (fxQ.slow >= 45 && fxQ.level > FX_MINIMO) {        // ~0.75s ruim → desce
        fxQ.level--; fxQ.slow = 0; fxQ.fast = 0;
    } else if (fxQ.fast >= 900 && fxQ.level < FX_FULL) {  // ~15s folgado → sobe
        fxQ.level++; fxQ.slow = 0; fxQ.fast = 0;
    }
}
// REFRAÇÃO: recola a cena submersa em fatias horizontais deslocadas por
// senoides. É o que faz a água "ondular" de verdade sobre tudo que está
// dentro dela. Amplitude pequena (<3px) pra não atrapalhar a mira do anzol.
function blitRefracted(layer, t) {
    const wy = waterY();
    const dpr = layer.dpr;

    if (REDUCED_MOTION || fxQ.level <= FX_MINIMO) {
        ctx.drawImage(layer.canvas, 0, 0, layer.w, layer.h, 0, 0, cw, ch);
        return;
    }

    // Acima da linha d'água não há distorção (céu/barco ficam nítidos)
    if (wy > 0) {
        ctx.drawImage(layer.canvas, 0, 0, layer.w, Math.round(wy * dpr),
                                    0, 0, cw, wy);
    }

    const sliceH = IS_COARSE ? 8 : 4;    // fatias maiores no tablet: menos draw calls
    const amp = 2.6;
    const OVER = 5;                       // sobra lateral pra não abrir fresta na borda

    for (let y = wy; y < ch; y += sliceH) {
        const h = Math.min(sliceH, ch - y);
        const depth = (y - wy) / Math.max(1, ch - wy);
        // A ondulação nasce na superfície e se acalma no fundo
        const a = amp * (1 - depth * 0.55);
        const dx = Math.sin(y * 0.045 + t * 0.0016) * a
                 + Math.sin(y * 0.110 - t * 0.0027) * a * 0.45;
        ctx.drawImage(layer.canvas,
            0, Math.round(y * dpr), layer.w, Math.max(1, Math.round(h * dpr)),
            dx - OVER, y, cw + OVER * 2, h);
    }
}

// BLOOM: destaca as altas luzes (sol, lendários, bioluminescência).
// O "threshold" é aproximado multiplicando a cena por ela mesma — isso
// esmaga os tons médios e preserva o que já era claro.
function applyBloom() {
    if (!HAS_CTX_FILTER || REDUCED_MOTION || fxQ.level < FX_FULL) return;
    const B = getFxLayer('bloom', 0.25);
    const bc = B.ctx;

    bc.save();
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.globalCompositeOperation = 'source-over';
    bc.filter = 'none';
    bc.clearRect(0, 0, B.w, B.h);
    bc.drawImage(canvas, 0, 0, B.w, B.h);
    bc.globalCompositeOperation = 'multiply';
    bc.drawImage(B.canvas, 0, 0);          // ² → corta os médios
    bc.drawImage(B.canvas, 0, 0);          // ⁴ → só sobram as altas luzes
    bc.restore();

    ctx.save();
    ctx.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);   // sem camera shake: alinha com o que foi capturado
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.48;   // acima disso a agua perde contraste
    ctx.filter = 'blur(7px)';
    ctx.drawImage(B.canvas, 0, 0, B.w, B.h, 0, 0, cw, ch);
    ctx.filter = 'none';
    ctx.restore();
}

// COLOR GRADING: unifica a paleta de cada zona (quente na costa, frio no fundo)
// Tinta por zona. Alphas baixos porque 'source-over' e uma lavagem chapada —
// mais forte que 'overlay' na mesma opacidade.
const ZONE_GRADE = [
    'rgba(255, 186, 104, 0.055)',   // Costa: sol quente
    'rgba(255, 162, 86,  0.045)',   // Arrecifes
    'rgba(44, 110, 186,  0.060)',   // Mar Aberto: esfria
    'rgba(24, 56, 130,   0.090)',   // Fossa: azul profundo
];

function applyColorGrade() {
    ctx.save();
    ctx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);   // cobre a tela toda, sem sobrar borda no shake
    // 'source-over' em vez de 'overlay': mesmo efeito de tinta a baixa opacidade
    // por ~1/5 do custo (medido em 1125x1920: 0.97ms vs 4.66ms)
    ctx.fillStyle = ZONE_GRADE[state.currentZone];
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
}

// =================================================================
// BOLHAS
// =================================================================
function spawnBubble() {
    // Bolhas variam por zona (abissal: mais escassas, lentas, escuras)
    const z = state.currentZone;
    const speedMod = [1.0, 1.0, 0.85, 0.55][z];
    const sizeMod  = [1.0, 1.05, 1.1, 1.25][z];
    const opMod    = [1.0, 0.95, 0.8, 0.65][z];
    rt.bubbles.push({
        x: Math.random() * cw,
        y: ch,
        size: (3 + Math.random() * 6) * sizeMod,
        speed: (28 + Math.random() * 50) * speedMod,
        wobble: Math.random() * Math.PI * 2,
        opacity: (0.25 + Math.random() * 0.4) * opMod,
    });
}

function updateBubbles(delta) {
    const dt = delta * 0.001;
    for (let i = rt.bubbles.length - 1; i >= 0; i--) {
        const b = rt.bubbles[i];
        b.y -= b.speed * dt;
        b.wobble += delta * 0.003;
        b.x += Math.sin(b.wobble) * 0.4;
        if (b.y < waterY() - 5) rt.bubbles.splice(i, 1);
    }
}

function drawBubbles() {
    ctx.save();
    for (const b of rt.bubbles) {
        ctx.fillStyle = `rgba(220, 240, 255, ${b.opacity * 0.4})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.85})`;
        ctx.beginPath();
        ctx.arc(b.x - b.size * 0.32, b.y - b.size * 0.32, b.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// =================================================================
// PARTÍCULAS — sparkles e splash
// =================================================================
function emitSparkles(x, y, color, count) {
    if (REDUCED_MOTION) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 200;
        rt.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 90,
            life: 700 + Math.random() * 500,
            maxLife: 1200,
            size: 2 + Math.random() * 3,
            color,
            type: 'sparkle',
            grav: 220,
        });
    }
}

function emitSplash(x, y) {
    for (let i = 0; i < 16; i++) {
        const angle = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 0.85;
        const speed = 90 + Math.random() * 130;
        rt.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 500 + Math.random() * 250,
            maxLife: 750,
            size: 2 + Math.random() * 3,
            color: 'rgba(255, 255, 255, 1)',
            type: 'splash',
            grav: 420,
        });
    }
}

function updateParticles(delta) {
    const dt = delta * 0.001;
    for (let i = rt.particles.length - 1; i >= 0; i--) {
        const p = rt.particles[i];
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.vy += p.grav * dt;
        p.life -= delta;
        if (p.life <= 0) rt.particles.splice(i, 1);
    }
}

function drawParticles() {
    ctx.save();
    for (const p of rt.particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.type === 'sparkle') {
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// =================================================================
// ALGAS MARINHAS (animadas com seno)
// =================================================================
function initSeaweed() {
    rt.seaweed = [];
    // Por zona: vegetação diferente
    // 0=verdes vibrantes / 1=corais coloridos / 2=algas escuras / 3=tubos bioluminescentes
    const z = state.currentZone;
    const count = z === 3 ? 4 : 6 + Math.floor(Math.random() * 5);
    const hueRanges = [
        { base: 110, spread: 50  },  // costa - verde
        { base: 320, spread: 60  },  // arrecifes - magenta/roxo (corais)
        { base: 180, spread: 30  },  // mar aberto - verde-azulado escuro
        { base: 200, spread: 80  },  // abissal - ciano/azul bioluminescente
    ];
    const hr = hueRanges[z];
    for (let i = 0; i < count; i++) {
        const h = (z === 3 ? 60 : 80) + Math.random() * 180;
        rt.seaweed.push({
            x: Math.random() * cw,
            h,
            segs: 5 + Math.floor(Math.random() * 3),
            phase: Math.random() * Math.PI * 2,
            speed: 0.0008 + Math.random() * 0.0015,
            thick: 3 + Math.random() * 3,
            hue: hr.base + Math.random() * hr.spread,
            biolum: z === 3,    // brilha na fossa
        });
    }
}

function drawSeaweed(t) {
    const wy = waterY();
    const wh = waterHeight();
    const bottom = wy + wh;
    const z = state.currentZone;
    for (const alga of rt.seaweed) {
        const segH = alga.h / alga.segs;
        ctx.save();
        if (alga.biolum) {
            const glow = 0.4 + 0.3 * Math.sin(t * 0.002 + alga.phase);
            ctx.shadowColor = `hsla(${alga.hue}, 80%, 65%, ${glow})`;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = `hsla(${alga.hue}, 70%, ${30 + Math.sin(alga.phase) * 10}%, 0.8)`;
        } else if (z === 1) {
            // Arrecifes: corais coloridos visíveis (lightness alto)
            ctx.strokeStyle = `hsla(${alga.hue}, ${65 + Math.sin(alga.phase) * 10}%, ${42 + Math.sin(alga.phase * 0.7) * 8}%, 0.85)`;
        } else {
            ctx.strokeStyle = `hsla(${alga.hue}, ${45 + Math.sin(alga.phase) * 15}%, ${28 + Math.sin(alga.phase * 0.7) * 8}%, 0.75)`;
        }
        ctx.lineWidth = alga.thick;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(alga.x, bottom);
        for (let s = 1; s <= alga.segs; s++) {
            const sy = bottom - s * segH;
            const sway = Math.sin(t * alga.speed + alga.phase + s * 0.5) * (s / alga.segs) * 18;
            ctx.lineTo(alga.x + sway, sy);
        }
        ctx.stroke();

        ctx.strokeStyle = `hsla(${alga.hue + 20}, 30%, 25%, 0.4)`;
        ctx.lineWidth = alga.thick * 0.5;
        ctx.beginPath();
        ctx.moveTo(alga.x + 3, bottom);
        for (let s = 1; s <= alga.segs; s++) {
            const sy = bottom - s * segH;
            const sway = Math.sin(t * alga.speed + alga.phase + s * 0.5 + 0.3) * (s / alga.segs) * 14 + 3;
            ctx.lineTo(alga.x + sway, sy);
        }
        ctx.stroke();
        ctx.restore();
    }
}

// =================================================================
// PARTÍCULAS AMBIENTES (plâncton / detritos flutuando)
// =================================================================
function spawnAmbientParticle() {
    rt.ambientParticles.push({
        x: Math.random() * cw,
        y: waterY() + Math.random() * waterHeight(),
        vx: -10 + Math.random() * 20,
        vy: -3 + Math.random() * 6,
        size: 1 + Math.random() * 2.5,
        life: 4000 + Math.random() * 6000,
        maxLife: 10000,
        alpha: 0.15 + Math.random() * 0.35,
        hue: 160 + Math.random() * 80,
    });
}

function updateAmbient(delta) {
    const dt = delta * 0.001;
    for (let i = rt.ambientParticles.length - 1; i >= 0; i--) {
        const p = rt.ambientParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= delta;
        if (p.life <= 0 || p.x < -20 || p.x > cw + 20) rt.ambientParticles.splice(i, 1);
    }
}

function drawAmbient() {
    ctx.save();
    for (const p of rt.ambientParticles) {
        const a = Math.min(p.alpha, p.life / p.maxLife * p.alpha);
        ctx.fillStyle = `hsla(${p.hue}, 60%, 70%, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// =================================================================
// TRILHAS BIOLUMINESCENTES (zona abissal)
// =================================================================
function updateTrails(delta) {
    for (let i = rt.trails.length - 1; i >= 0; i--) {
        rt.trails[i].life -= delta;
        if (rt.trails[i].life <= 0) rt.trails.splice(i, 1);
    }
}

function drawTrails() {
    for (const t of rt.trails) {
        const a = Math.max(0, t.life / t.maxLife);
        ctx.fillStyle = t.color.replace(/[\d.]+\)$/, (a * 0.7) + ')');
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.size * a, 0, Math.PI * 2);
        ctx.fill();
    }
}

// =================================================================
// BAÚS DO TESOURO
// =================================================================
function spawnChest() {
    const wy = waterY();
    const wh = waterHeight();
    rt.chests.push({
        x: 40 + Math.random() * (cw - 80),
        y: wy + Math.random() * wh * 0.6,
        bobPhase: Math.random() * Math.PI * 2,
        life: 8000 + Math.random() * 4000,
        glow: 0,
    });
}

function updateChests(delta) {
    const dt = delta * 0.001;
    for (let i = rt.chests.length - 1; i >= 0; i--) {
        const c = rt.chests[i];
        c.bobPhase += delta * 0.002;
        c.y += Math.sin(c.bobPhase) * 0.25;
        c.life -= delta;
        c.glow = 0.6 + 0.4 * Math.sin(rt.time * 0.004);

        if (rt.fishingActive && !rt.hookDescending) {
            const hp = hookPxPos();
            const dx = hp.x - c.x;
            const dy = hp.y - c.y;
            if (dx * dx + dy * dy < 900) {
                // Baú = jackpot ~10× média de um peixe na zona
                // Zona 0: $30-150 · Zona 1: $480-2400 · Zona 2: $4.8k-24k · Zona 3: $75k-375k
                const zoneChestMult = [1, 16, 160, 2500][state.currentZone] ?? 1;
                const valor = Math.floor((30 + Math.random() * 120) * zoneChestMult * (1 + state.upgrades.bait * 0.05));
                state.money += valor;
                state.totalEarned = (state.totalEarned || 0) + valor;   // conta para prestígio
                questProgress('earn', valor);
                emitSparkles(c.x, c.y, '#ffd700', 25);
                pushFloatText(c.x, c.y - 20, '+' + fmtMoney(valor), '#ffd700', 20);
                vibrate([30, 50, 40]);
                rt.cameraShake = 5;
                rt.cheerUntil = rt.time + 1200;
                SFX.chest();
                addLog(`🎁 Baú do tesouro! +${fmtMoney(valor)}`);
                showBigCatch({ name: 'Baú do Tesouro', emoji: '🎁', rarity: 'rare', size: 0 },
                    valor, 1);
                rt.chests.splice(i, 1);
                continue;
            }
        }

        if (c.life <= 0) rt.chests.splice(i, 1);
    }
}

function drawChests(t) {
    for (const c of rt.chests) {
        ctx.save();
        ctx.translate(c.x, c.y);

        // Brilho dourado pulsante
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 36);
        g.addColorStop(0, `rgba(255, 215, 0, ${c.glow * 0.25})`);
        g.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.fill();

        // Corpo do baú
        ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-16, -10, 32, 20);
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(-14, -8, 28, 16);

        // Tampa
        ctx.fillStyle = '#6B3410';
        ctx.beginPath();
        ctx.moveTo(-18, -10);
        ctx.lineTo(0, -18);
        ctx.lineTo(18, -10);
        ctx.closePath();
        ctx.fill();

        // Fechadura
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.7)';
        ctx.shadowBlur = 6;
        ctx.fillRect(-3, -3, 6, 6);
        ctx.fillRect(-1, -7, 2, 4);

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// =================================================================
// LÓGICA DE PESCA
// =================================================================
function startFishing() {
    const now = performance.now();
    if (rt.fishingActive || now < rt.cooldownEndTime) return;
    rt.fishingActive = true;
    rt.sessionDuration = getSessionDuration();
    rt.sessionEndTime = now + rt.sessionDuration;
    rt.nextSpawnTime = now + 250;
    rt.hookX = 50;
    rt.hookY = 0;
    rt.hookDescending = true;
    DOM.castButton.classList.remove('cooldown');   // garante limpeza
    DOM.castButton.classList.add('fishing');
    DOM.castProgress.style.width = '0%';
    addLogOnce('🎣 Anzol lançado! Use WASD para mover.');
    // Splash inicial na superfície
    emitSplash(cw * 0.5, waterY() + 4);
    SFX.splash();
    SFX.ambience();        // inicia som de ondas (1º gesto do usuário libera o AudioContext)
    requestWakeLock();     // tela não apaga no celular durante a sessão
}

function endFishing() {
    rt.fishingActive = false;
    rt.cooldownEndTime = performance.now() + COOLDOWN_MS;
    rt.activeFish.length = 0;
    DOM.castButton.classList.remove('fishing');
    DOM.castButton.classList.add('cooldown');
    DOM.castProgress.style.width = '0%';
    rt.combo = 0;
    // Consumíveis duram apenas uma sessão
    rt.consumableActive = null;
    updateConsumables();
}

function tickCooldown(now) {
    if (!DOM.castButton) return;
    if (now < rt.cooldownEndTime) {
        const elapsed = COOLDOWN_MS - (rt.cooldownEndTime - now);
        const pct = Math.max(0, Math.min(100, (elapsed / COOLDOWN_MS) * 100));
        DOM.castProgress.style.width = pct + '%';
    } else if (DOM.castButton.classList.contains('cooldown')) {
        DOM.castButton.classList.remove('cooldown');
        DOM.castProgress.style.width = '0%';
    }
}

// Texto flutuante de dinheiro no ponto da captura (juice barato)
function pushFloatText(x, y, text, color, size = 16) {
    rt.floatTexts.push({ x, y, text, color, size, life: 1400, maxLife: 1400 });
    if (rt.floatTexts.length > 10) rt.floatTexts.shift();
}
function updateFloatTexts(delta) {
    for (let i = rt.floatTexts.length - 1; i >= 0; i--) {
        const t = rt.floatTexts[i];
        t.life -= delta;
        t.y -= delta * 0.045;
        if (t.life <= 0) rt.floatTexts.splice(i, 1);
    }
}
function drawFloatTexts() {
    if (!rt.floatTexts.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of rt.floatTexts) {
        ctx.globalAlpha = Math.min(1, t.life / (t.maxLife * 0.4));
        ctx.font = `800 ${t.size}px 'Segoe UI', sans-serif`;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
}

// Retorna true se o peixe foi fisgado (deve ser removido);
// false se era um chefão que sobreviveu ao golpe (continua na tela).
function catchFishInteractive(fish) {
    // Peixes chefões (lendários): múltiplos golpes necessários
    if (fish.bossHp > 0) {
        fish.bossHp--;
        const hp = hookPxPos();
        if (fish.bossHp > 0) {
            // Foge acelerando e fica imune por um instante — o jogador precisa
            // re-alcançá-lo para o próximo golpe (senão seria drenado num frame).
            // Clampa a velocidade pra não ficar impossível nos golpes finais.
            const bossMaxSpeed = (280 + fish.fish.speed * 180) * 2.8 * (IS_COARSE ? 0.70 : 1.0);
            const fleeSpeed = Math.min(Math.abs(fish.vx) * 1.6, bossMaxSpeed);
            fish.vx = Math.sign(fish.vx || 1) * fleeSpeed;
            fish.invulnUntil = rt.time + 450;
            emitSparkles(hp.x, hp.y, '#ff0000', 25);
            pushFloatText(fish.x, fish.y - 24, `${fish.bossHp} golpe${fish.bossHp>1?'s':''}!`, '#ff5555', 15);
            rt.cameraShake = 10;
            vibrate(20);
            SFX.boss();
            addLog(`💢 ${fish.fish.name} se debate! ${fish.bossHp} golpe${fish.bossHp>1?'s':''} restante${fish.bossHp>1?'s':''}.`);
            return false;
        }
        // Último golpe — bônus de chefão
        emitSparkles(hp.x, hp.y, '#ffb347', 50);
        rt.cameraShake = 16;
        SFX.boss();
    }

    const chance = getMultiCatchChance();
    let count = 1;
    const maxExtras = getMaxExtras();
    while (count <= maxExtras && Math.random() < chance) count++;

    // Sistema de combo: capturas rápidas em sequência
    const now = performance.now();
    if (now - rt.lastCatchTime < 2500 && rt.combo > 0) {
        rt.combo++;
    } else {
        rt.combo = 1;
    }
    rt.lastCatchTime = now;
    if (rt.combo > (state._maxCombo || 0)) state._maxCombo = rt.combo;
    const comboMult = 1 + (rt.combo - 1) * 0.12;  // era 0.20; x10 = ×2.08 em vez de ×2.8
    // As missões de raridade são contabilizadas dentro de sellFish (uma vez por peixe
    // efetivamente vendido). Não repetir aqui — evita contagem em dobro.

    let total = 0;
    for (let i = 0; i < count; i++) total += sellFish(fish.fish);
    // O bônus de combo precisa ser CREDITADO (sellFish só somou o valor bruto ao dinheiro).
    const withCombo   = Math.floor(total * comboMult);
    const comboBonus  = withCombo - total;
    if (comboBonus > 0) {
        state.money      += comboBonus;
        state.totalEarned = (state.totalEarned || 0) + comboBonus;
        questProgress('earn', comboBonus);
    }
    total = withCombo;

    SFX.catch(fish.fish.rarity);
    if (rt.combo > 1) SFX.combo(rt.combo);
    showBigCatch(fish.fish, total, count);
    if (fish.fish.rarity === 'legendary') showLegendaryAnimation(fish.fish, total);
    const comboStr = rt.combo > 1 ? ` 🔥 Combo x${rt.combo}` : '';
    addLog(`${fish.fish.emoji} ${fish.fish.name} ×${count} (+${fmtMoney(total)})${comboStr}`);

    // Display visual do combo
    if (rt.combo > 1) {
        rt.comboDisplayTimer = 1800;
        const hp = hookPxPos();
        rt.comboX = hp.x;
        rt.comboY = hp.y - 40;
    }

    const hp = hookPxPos();
    const color = fish.fish.rarity === 'legendary' ? '#ffb347'
               : fish.fish.rarity === 'epic'      ? '#bb86fc'
               : fish.fish.rarity === 'rare'      ? '#4ecdc4'
               : '#ffd700';
    const partCount = fish.fish.rarity === 'legendary' ? 40
                    : fish.fish.rarity === 'epic'      ? 28
                    : fish.fish.rarity === 'rare'      ? 18
                    : 12;
    emitSparkles(hp.x, hp.y, color, partCount);
    pushFloatText(hp.x, hp.y - 26, '+' + fmtMoney(total), color,
        fish.fish.rarity === 'legendary' ? 24 : fish.fish.rarity === 'epic' ? 20 : 16);

    // Vibração háptica por raridade (mobile)
    if (fish.fish.rarity === 'legendary')      vibrate([40, 60, 40, 60, 90]);
    else if (fish.fish.rarity === 'epic')      vibrate([30, 40, 30]);
    else if (fish.fish.rarity === 'rare')      vibrate(30);
    else                                       vibrate(12);

    // Camera shake conforme raridade
    if (fish.fish.rarity === 'legendary') rt.cameraShake = 14;
    else if (fish.fish.rarity === 'epic') rt.cameraShake = 7;
    else if (count >= 3)                   rt.cameraShake = 4;

    rt.cheerUntil = rt.time + 1200;   // Angelo comemora a fisgada
    return true;   // fisgado com sucesso → caller remove o peixe
}

function tickFishing(now, delta) {
    if (!rt.fishingActive) return;

    if (rt.hookDescending) {
        // Descida em HOOK_DESCENT_MS com easing suave
        rt.hookY += delta * (HOOK_INITIAL_DEPTH / HOOK_DESCENT_MS);
        if (rt.hookY >= HOOK_INITIAL_DEPTH) {
            rt.hookY = HOOK_INITIAL_DEPTH;
            rt.hookDescending = false;
        }
    } else {
        if (rt.keyState.up)   rt.hookY = Math.max(2,  rt.hookY - delta * HOOK_SPEED);
        if (rt.keyState.down) rt.hookY = Math.min(98, rt.hookY + delta * HOOK_SPEED);
    }
    const hookSpeed = HOOK_SPEED * getEventHookMult();
    if (rt.keyState.left)  rt.hookX = Math.max(2,  rt.hookX - delta * hookSpeed);
    if (rt.keyState.right) rt.hookX = Math.min(98, rt.hookX + delta * hookSpeed);

    if (now >= rt.nextSpawnTime) {
        spawnFish();
        rt.nextSpawnTime = now + getSpawnInterval();
    }

    // Spawn de baús do tesouro (raro)
    if (now >= rt.nextChestTime) {
        if (Math.random() < 0.35) spawnChest();
        rt.nextChestTime = now + 8000 + Math.random() * 12000;
    }

    const remaining = rt.sessionEndTime - now;
    const progress = Math.max(0, Math.min(1, 1 - remaining / rt.sessionDuration));
    DOM.castProgress.style.width = (progress * 100) + '%';

    if (now >= rt.sessionEndTime) endFishing();
}

function tickPassive(delta) {
    const rate = getPassiveRate();
    if (rate <= 0) return;
    rt.passiveAccumulator += (rate / 60000) * delta;
    while (rt.passiveAccumulator >= 1) {
        rt.passiveAccumulator -= 1;
        // Rede pesca na MELHOR zona desbloqueada (não na atual)
        const f = rollFish(bestUnlockedZone());
        if (f) {
            const v = sellFish(f);
            rt.netLogAccum.count++;
            rt.netLogAccum.value += v;
        }
    }
    // Logar agrupado: a cada 5 peixes ou a cada 20s
    rt.netLogAccum.timer += delta;
    const flush = rt.netLogAccum.count >= 5 || (rt.netLogAccum.count > 0 && rt.netLogAccum.timer >= 20000);
    if (flush) {
        const { count, value } = rt.netLogAccum;
        if (count === 1) addLog(`🕸️ Rede: 1 peixe capturado (+${fmtMoney(value)})`);
        else             addLog(`🕸️ Rede: ${count} peixes capturados (+${fmtMoney(value)})`);
        rt.netLogAccum = { count: 0, value: 0, timer: 0 };
    }
}

// =================================================================
// UI — cards criados UMA vez, atualizados in-place (corrige clique)
// =================================================================
const upgradeRefs = {};
const zoneRefs = {};

function createUpgradeCards() {
    const list = document.getElementById('upgradesList');
    list.innerHTML = '';
    UPGRADES.forEach(up => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.innerHTML = `
            <div class="upgrade-info">
                <div class="upgrade-name">
                    <span class="upgrade-icon">${up.icon}</span>
                    <span>${up.name}</span>
                    <span class="upgrade-level">Lv 0</span>
                </div>
                <div class="upgrade-desc">${up.desc}</div>
            </div>
            <button class="upgrade-buy-btn" type="button">
                <span class="upgrade-cost-label">COMPRAR</span>
                <span class="upgrade-cost">$0</span>
            </button>
        `;
        const btn = card.querySelector('button');
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            buyUpgrade(up.id);
        });
        list.appendChild(card);
        upgradeRefs[up.id] = {
            card,
            level: card.querySelector('.upgrade-level'),
            cost:  card.querySelector('.upgrade-cost'),
            costLabel: card.querySelector('.upgrade-cost-label'),
            btn,
        };
    });
}

function updateUpgradeCards() {
    UPGRADES.forEach(up => {
        const r = upgradeRefs[up.id];
        if (!r) return;
        const lvl = state.upgrades[up.id] ?? 0;
        const maxed = lvl >= up.maxLevel;
        const locked = up.requiredMotor && state.upgrades.motor < up.requiredMotor;
        const cost = calcCost(up, lvl);
        const can = state.money >= cost;
        r.level.textContent = `Lv ${lvl}${maxed ? ' MAX' : ''}`;
        if (locked) {
            r.cost.textContent = '—';
            r.costLabel.textContent = `🔒 Motor ${up.requiredMotor}`;
        } else {
            r.cost.textContent  = maxed ? '—' : fmtMoney(cost);
            r.costLabel.textContent = maxed ? 'MÁXIMO' : 'COMPRAR';
        }
        const shouldDisable = locked || !can || maxed;
        if (r.btn.disabled !== shouldDisable) r.btn.disabled = shouldDisable;
    });
}

function createZoneCards() {
    const grid = document.getElementById('zonesGrid');
    grid.innerHTML = '';
    ZONES.forEach(zone => {
        const btn = document.createElement('button');
        btn.className = 'zone-card';
        btn.type = 'button';
        // Preview de até 4 espécies características da zona
        const previewFish = FISH.filter(f => f.zones.includes(zone.id))
            .sort((a, b) => RARITY_SCORE[b.rarity] - RARITY_SCORE[a.rarity])
            .slice(0, 4)
            .map(f => f.emoji)
            .join(' ');
        btn.innerHTML = `
            <span class="zone-card-name">${zone.name}</span>
            <span class="zone-card-depth">${zone.minDepth}-${zone.maxDepth}m</span>
            <span class="zone-card-preview">${previewFish}</span>
            <span class="zone-lock"></span>
        `;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isZoneUnlocked(zone.id) || rt.fishingActive) return;
            state.currentZone = zone.id;
            rt.activeFish.length = 0;     // limpa peixes da zona anterior
            rt.trails.length = 0;
            rt.chests.length = 0;
            initSeaweed();
            rt.zoneTransition = 1.0;
            SFX.zone();
            updateZoneCards();
            updateStats();
            updateCompendium();
        });
        grid.appendChild(btn);
        zoneRefs[zone.id] = { card: btn, lock: btn.querySelector('.zone-lock') };
    });
}

function updateZoneCards() {
    ZONES.forEach(zone => {
        const r = zoneRefs[zone.id];
        if (!r) return;
        const unlocked = isZoneUnlocked(zone.id);
        const active = zone.id === state.currentZone;
        r.card.classList.toggle('active', active);
        if (r.card.disabled !== !unlocked) r.card.disabled = !unlocked;
        const newLock = unlocked ? '' : `🔒 Motor Lv.${zone.requiredMotor}`;
        if (r.lock.textContent !== newLock) r.lock.textContent = newLock;
    });
}

function buyUpgrade(id) {
    const up = UPGRADES.find(u => u.id === id);
    if (!up) return;
    const lvl = state.upgrades[id] ?? 0;
    if (lvl >= up.maxLevel) return;
    if (up.requiredMotor && state.upgrades.motor < up.requiredMotor) return;
    const cost = calcCost(up, lvl);
    if (state.money < cost) return;
    state.money -= cost;
    state.upgrades[id] = lvl + 1;
    SFX.upgrade();
    addLog(`✅ ${up.icon} ${up.name} → Lv ${lvl + 1}`);
    updateUpgradeCards();
    updateZoneCards();
    updateStats();
}

const RARITY_LABEL = {
    common: 'Comum', uncommon: 'Incomum', rare: 'RARO',
    epic: 'ÉPICO', legendary: 'LENDÁRIO',
};

function showBigCatch(fishType, totalValue, count) {
    const sc = DOM.catchShowcase || document.getElementById('catchShowcase');
    if (!sc) return;
    const card = document.createElement('div');
    card.className = `big-catch-card rarity-${fishType.rarity}`;
    const showRarity = fishType.rarity !== 'common';
    card.innerHTML = `
        <div class="fish-big">${fishType.emoji}</div>
        <div class="info">
            ${showRarity ? `<div class="fish-rarity-tag rarity-tag-${fishType.rarity}">${RARITY_LABEL[fishType.rarity]}</div>` : ''}
            <div class="fish-name">${fishType.name}</div>
            <div class="fish-value">+${fmtMoney(totalValue)}</div>
        </div>
        ${count > 1 ? `<div class="fish-count-badge">×${count}</div>` : ''}
    `;
    sc.prepend(card);
    const dur = fishType.rarity === 'legendary' ? 4900 : 3300;
    setTimeout(() => card.remove(), dur);
    const maxCards = IS_COARSE ? 2 : 4;   // touch: menos cards pra não tapar o canvas
    while (sc.children.length > maxCards) sc.lastChild.remove();
}

function showNewSpeciesToast(fish) {
    const t = document.createElement('div');
    t.className = 'new-species-toast';
    t.innerHTML = `
        <span class="new-species-emoji">${fish.emoji}</span>
        <div>
            <strong>🆕 Nova espécie!</strong>
            <span>${fish.name}</span>
        </div>
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// Momento épico em tela cheia ao fisgar um lendário ⭐
let legendaryAnimBusy = false;
function showLegendaryAnimation(fish, value) {
    if (legendaryAnimBusy) return;        // evita empilhar se vierem 2 seguidos
    legendaryAnimBusy = true;

    const reduced = REDUCED_MOTION;
    const dur = reduced ? 1400 : 2600;

    const ov = document.createElement('div');
    ov.className = 'legendary-anim' + (reduced ? ' reduced' : '');

    // Chuva de brilhos (só quando movimento não está reduzido)
    let sparkles = '';
    if (!reduced) {
        for (let i = 0; i < 14; i++) {
            const left = Math.round(6 + Math.random() * 88);
            const delay = (Math.random() * 0.6).toFixed(2);
            const dm = (0.9 + Math.random() * 1.1).toFixed(2);
            const em = ['✨', '⭐', '🌟'][i % 3];
            sparkles += `<span class="la-spark" style="left:${left}%;animation-delay:${delay}s;animation-duration:${dm}s">${em}</span>`;
        }
    }

    ov.innerHTML = `
        <div class="la-rays" aria-hidden="true"></div>
        <div class="la-burst" aria-hidden="true"></div>
        ${sparkles}
        <div class="la-center">
            <div class="la-banner">✦ LENDÁRIO! ✦</div>
            <div class="la-fish">${fish.emoji}</div>
            <div class="la-name">${fish.name}</div>
            <div class="la-value">+${fmtMoney(value)}</div>
        </div>
    `;
    document.body.appendChild(ov);

    // Bônus sensorial
    vibrate([50, 60, 50, 60, 120]);
    if (!reduced) rt.cameraShake = 18;

    setTimeout(() => {
        ov.classList.add('leaving');
        setTimeout(() => { ov.remove(); legendaryAnimBusy = false; }, 400);
    }, dur);
}

function addLog(text) {
    const log = DOM.fishingLog || document.getElementById('fishingLog');
    if (!log) return;
    const li = document.createElement('li');
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 25) log.lastChild.remove();
}

// Suprime mensagens duplicadas em sequência (ex: "Anzol lançado!" várias vezes)
let _lastLogText = '';
let _lastLogCount = 0;
function addLogOnce(text) {
    const log = DOM.fishingLog || document.getElementById('fishingLog');
    if (!log) return;
    if (text === _lastLogText && log.firstChild) {
        _lastLogCount++;
        log.firstChild.textContent = `${text} (×${_lastLogCount + 1})`;
        return;
    }
    _lastLogText = text;
    _lastLogCount = 0;
    addLog(text);
}

function updateStats() {
    if (!DOM.money) return;
    const newMoney = fmtMoney(state.money);
    if (DOM.money.textContent !== newMoney) {
        DOM.money.textContent = newMoney;
        DOM.money.parentElement?.classList.remove('money-tick');
        // reflow força reinício da animação
        void DOM.money.offsetWidth;
        DOM.money.parentElement?.classList.add('money-tick');
    }
    DOM.totalFish.textContent = state.totalFish.toLocaleString('pt-BR');

    // Pesca passiva no melhor zona desbloqueada para cálculo de lucro
    const rate = getPassiveRate();
    if (rate > 0) {
        const bestZone = bestUnlockedZone();
        const pool = FISH.filter(f => f.zones.includes(bestZone));
        const tw = pool.reduce((s, f) => s + f.weight, 0);
        const avg = pool.reduce((s, f) => s + f.baseValue * f.weight, 0) / (tw || 1);
        DOM.passiveIncome.textContent = fmtMoney(rate * avg * getValueMultiplier()); // getPearlValueMult já está dentro de getValueMultiplier
    } else {
        DOM.passiveIncome.textContent = '— rede';
    }
    DOM.currentZone.textContent = ZONES[state.currentZone].name;
    DOM.currentDepth.textContent = ZONES[state.currentZone].maxDepth;
}

function bestUnlockedZone() {
    let best = 0;
    for (let i = ZONES.length - 1; i >= 0; i--) {
        if (isZoneUnlocked(i)) { best = i; break; }
    }
    return best;
}

// =================================================================
// CONQUISTAS
// =================================================================
const ACHIEVEMENTS = [
    { id: 'first_catch',  name: 'Primeira Pescaria',   desc: 'Capture seu primeiro peixe',       check: () => state.totalFish >= 1,     reward: 50 },
    { id: 'catch_50',     name: 'Pescador Dedicado',   desc: 'Capture 50 peixes',                check: () => state.totalFish >= 50,    reward: 500 },
    { id: 'catch_500',    name: 'Mestre Pescador',     desc: 'Capture 500 peixes',               check: () => state.totalFish >= 500,   reward: 5000 },
    { id: 'first_legend', name: 'Lenda Viva',          desc: 'Capture um peixe lendário',         check: () => state._legendaryCaught,   reward: 15000 },
    { id: 'all_zones',    name: 'Explorador dos Mares',desc: 'Desbloqueie todas as zonas',        check: () => state.upgrades.motor >= 12, reward: 20000 },
    { id: 'rich_10k',     name: 'Pequena Fortuna',     desc: 'Acumule $10.000',                  check: () => state.money >= 10000,     reward: 1000 },
    { id: 'rich_1m',      name: 'Magnata do Mar',      desc: 'Acumule $1.000.000',               check: () => state.money >= 1000000,   reward: 75000 },
    { id: 'all_zone0',    name: 'Costa Completa',      desc: 'Capture todas as espécies da Costa',check: () => zoneComplete(0),          reward: 2000 },
    { id: 'all_zone3',    name: 'Senhor do Abismo',    desc: 'Capture todas as espécies do Abissal',check: () => zoneComplete(3),         reward: 100000 },
    { id: 'first_pearl',  name: 'Renascido',           desc: 'Faça seu primeiro Prestígio',       check: () => (state.pearls || 0) >= 1, reward: 5000 },
    { id: 'pearls_5',     name: 'Colecionador',        desc: 'Acumule 5 Pérolas',                 check: () => (state.pearls || 0) >= 5, reward: 25000 },
    { id: 'big_combo',    name: 'Maestro do Combo',    desc: 'Faça um combo x10',                 check: () => (state._maxCombo || 0) >= 10, reward: 8000 },
];

function zoneComplete(z) {
    const species = FISH.filter(f => f.zones.includes(z));
    return species.every(f => (state._speciesCaught || {})[f.name]);
}

function checkAchievements() {
    let awarded = false;
    for (const a of ACHIEVEMENTS) {
        if (state.achievements[a.id]) continue;
        if (a.check()) {
            state.achievements[a.id] = Date.now();
            state.money += a.reward;
            showAchievementToast(a);
            addLog(`🏆 Conquista: ${a.name} (+${fmtMoney(a.reward)})`);
            awarded = true;
        }
    }
    return awarded;
}

// Toasts empilhados (não se sobrepõem)
const _achStack = [];
function showAchievementToast(a) {
    const t = document.createElement('div');
    t.className = 'achievement-toast';
    t.innerHTML = `<span class="ach-icon">🏆</span><div><strong>${a.name}</strong><span>${a.desc}</span></div>`;
    document.body.appendChild(t);
    _achStack.push(t);
    repositionAchStack();
    setTimeout(() => {
        t.classList.add('exiting');
        setTimeout(() => {
            t.remove();
            const idx = _achStack.indexOf(t);
            if (idx >= 0) _achStack.splice(idx, 1);
            repositionAchStack();
        }, 400);
    }, 4000);
}
function repositionAchStack() {
    _achStack.forEach((el, i) => {
        el.style.top = (20 + i * 78) + 'px';
    });
}

// =================================================================
// COMPÊNDIO DE ESPÉCIES
// =================================================================
let _compFilter = 'all';   // 'all' | 'caught' | 'missing'

function buildCompendium() {
    const grid = document.getElementById('compendiumGrid');
    if (!grid) return;
    grid.innerHTML = '';
    FISH.forEach((f, i) => {
        const caught = (state._speciesCaught || {})[f.name];
        const cell = document.createElement('div');
        cell.className = 'comp-cell' + (caught ? ' comp-caught' : '');
        cell.dataset.index = i;
        cell.dataset.caught = caught ? '1' : '0';
        cell.title = caught ? `${f.name} · ${RARITY_LABEL[f.rarity]} · ${fmtMoney(f.baseValue)}` : '???';
        cell.innerHTML = `
            <span class="comp-emoji">${caught ? f.emoji : '❓'}</span>
            <span class="comp-rarity comp-rarity-${f.rarity}"></span>
            <span class="comp-name">${caught ? f.name : '???'}</span>
            ${caught ? `<span class="comp-value">${fmtMoney(f.baseValue)}</span>` : ''}
        `;
        grid.appendChild(cell);
    });
    applyCompFilter();
    const caught = Object.keys(state._speciesCaught || {}).length;
    const total = FISH.length;
    const counter = document.getElementById('compendiumCount');
    if (counter) counter.textContent = `${caught} / ${total} espécies`;
}

function applyCompFilter() {
    const grid = document.getElementById('compendiumGrid');
    if (!grid) return;
    grid.querySelectorAll('.comp-cell').forEach(cell => {
        const c = cell.dataset.caught === '1';
        if (_compFilter === 'all')          cell.style.display = '';
        else if (_compFilter === 'caught')  cell.style.display = c ? '' : 'none';
        else if (_compFilter === 'missing') cell.style.display = c ? 'none' : '';
    });
}

function setCompFilter(f) {
    _compFilter = f;
    document.querySelectorAll('.comp-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === f);
    });
    applyCompFilter();
}

function updateCompendium() {
    const grid = document.getElementById('compendiumGrid');
    if (!grid) return;
    const cells = grid.querySelectorAll('.comp-cell');
    cells.forEach((cell, i) => {
        const f = FISH[i];
        if (!f) return;
        const caught = (state._speciesCaught || {})[f.name];
        const em = cell.querySelector('.comp-emoji');
        const nm = cell.querySelector('.comp-name');
        const vl = cell.querySelector('.comp-value');
        if (em) em.textContent = caught ? f.emoji : '❓';
        if (nm) nm.textContent = caught ? f.name : '???';
        cell.classList.toggle('comp-caught', !!caught);
        if (caught && !vl) {
            const sp = document.createElement('span');
            sp.className = 'comp-value';
            sp.textContent = fmtMoney(f.baseValue);
            cell.appendChild(sp);
        }
    });
    const counter = document.getElementById('compendiumCount');
    if (counter) {
        const caught = Object.keys(state._speciesCaught || {}).length;
        counter.textContent = `${caught} / ${FISH.length} espécies`;
    }
}

// =================================================================
// LOJA DE CONSUMÍVEIS
// =================================================================
const CONSUMABLES = [
    {
        id: 'extraBait', name: 'Isca Extra', icon: '🐛', cost: 800,
        short: 'Spawn 2× rápido',
        desc: 'Peixes aparecem 2× mais rápido durante a próxima sessão de pesca.',
    },
    {
        id: 'magnify', name: 'Lupa', icon: '🔍', cost: 4000,
        short: 'Sem peixes comuns',
        desc: 'Na próxima sessão, peixes comuns são bloqueados — só aparecem incomuns, raros, épicos e lendários.',
    },
    {
        id: 'chronometer', name: 'Cronômetro', icon: '⏱️', cost: 10000,
        short: 'Sessão +50% longa',
        desc: 'A próxima sessão de pesca dura 50% mais tempo, dando mais oportunidades de captura.',
    },
];

function buildConsumables() {
    const list = document.getElementById('consumablesList');
    if (!list) return;
    list.innerHTML = '';
    CONSUMABLES.forEach(c => {
        const card = document.createElement('div');
        card.className = 'consumable-card';
        card.title = c.desc;     // tooltip nativo no hover desktop / long-press mobile
        card.innerHTML = `
            <span class="cons-icon" aria-hidden="true">${c.icon}</span>
            <span class="cons-name">${c.name}</span>
            <span class="cons-effect">${c.short}</span>
            <span class="cons-count">×<span data-cons-count="${c.id}">0</span> em estoque</span>
            <button class="cons-buy-btn" data-cons-buy="${c.id}" aria-label="Comprar ${c.name} por ${fmtMoney(c.cost)} — ${c.desc}">
                💰 ${fmtMoney(c.cost)}
            </button>
            <button class="cons-use-btn" data-cons-use="${c.id}" aria-label="Usar ${c.name}">USAR</button>
        `;
        list.appendChild(card);
    });
    list.addEventListener('click', (e) => {
        const buyId = e.target.dataset?.consBuy;
        const useId = e.target.dataset?.consUse;
        if (buyId) buyConsumable(buyId);
        if (useId) useConsumable(useId);
    });
    updateConsumables();
}

function updateConsumables() {
    CONSUMABLES.forEach(c => {
        const stock = state.consumables?.[c.id] ?? 0;
        const cnt = document.querySelector(`[data-cons-count="${c.id}"]`);
        if (cnt) cnt.textContent = stock;
        const buy = document.querySelector(`[data-cons-buy="${c.id}"]`);
        if (buy) buy.disabled = state.money < c.cost;
        const use = document.querySelector(`[data-cons-use="${c.id}"]`);
        if (use) {
            use.disabled = stock <= 0 || rt.fishingActive;
            use.dataset.stock = String(stock);   // mostra badge no canto se estoque > 0
        }
    });
}

function buyConsumable(id) {
    const c = CONSUMABLES.find(x => x.id === id);
    if (!c || state.money < c.cost) return;
    state.money -= c.cost;
    if (!state.consumables) state.consumables = {};
    state.consumables[id] = (state.consumables[id] || 0) + 1;
    SFX.upgrade();
    addLog(`🛒 Comprou ${c.icon} ${c.name}`);
    updateConsumables();
    updateStats();
}

function useConsumable(id) {
    if (rt.fishingActive) return;
    if ((state.consumables?.[id] || 0) <= 0) return;
    state.consumables[id]--;
    if (id === 'extraBait')   rt.consumableActive = { type: 'extraBait',   uses: 1 };
    if (id === 'magnify')     rt.consumableActive = { type: 'magnify',     uses: 1 };
    if (id === 'chronometer') rt.consumableActive = { type: 'chronometer', uses: 1 };
    SFX.upgrade();
    addLog(`✨ Item ativado para a próxima sessão!`);
    updateConsumables();
}

// =================================================================
// TROFEUS / ESTATÍSTICAS
// =================================================================
function openTrophiesModal() {
    const grid = document.getElementById('trophiesGrid');
    if (!grid) return;
    const trophies = [
        { icon: '💰', label: 'Total ganho',     value: fmtMoney(state.totalEarned || 0) },
        { icon: '🐟', label: 'Peixes capturados', value: (state.totalFish || 0).toLocaleString('pt-BR') },
        { icon: '🦪', label: 'Pérolas',          value: state.pearls || 0 },
        { icon: '🔥', label: 'Maior combo',      value: 'x' + (state._maxCombo || 0) },
        { icon: '🎯', label: 'Maior captura',    value: state._biggestCatch ? `${state._biggestCatch.emoji} ${fmtMoney(state._biggestCatch.value)}` : '—' },
        { icon: '📚', label: 'Espécies',         value: `${Object.keys(state._speciesCaught || {}).length} / ${FISH.length}` },
        { icon: '🏆', label: 'Conquistas',       value: `${Object.keys(state.achievements || {}).length} / ${ACHIEVEMENTS.length}` },
        { icon: '🌊', label: 'Zonas desbloqueadas', value: `${ZONES.filter((_, i) => isZoneUnlocked(i)).length} / ${ZONES.length}` },
    ];
    grid.innerHTML = trophies.map(t => `
        <div class="trophy-card">
            <div class="trophy-icon">${t.icon}</div>
            <span class="trophy-label">${t.label}</span>
            <div class="trophy-value">${t.value}</div>
        </div>
    `).join('');
    openModal(document.getElementById('trophiesModal'));
}

// =================================================================
// EVENTOS ALEATÓRIOS — cardume, tempestade, lua cheia
// =================================================================
const EVENTS = [
    { id: 'cardume',    name: 'CARDUME!',     desc: 'Spawn de peixes 3× por 15s',     icon: '🐟', dur: 15000, weight: 5 },
    { id: 'tempestade', name: 'TEMPESTADE!',  desc: 'Anzol 60% mais rápido por 12s',  icon: '⚡', dur: 12000, weight: 4 },
    { id: 'lua_cheia',  name: 'LUA CHEIA!',   desc: 'Só raros+ aparecem por 18s',     icon: '🌕', dur: 18000, weight: 2 },
    { id: 'sorte',      name: 'SORTE GRANDE!',desc: 'Valor +100% por 20s',            icon: '🍀', dur: 20000, weight: 3 },
];

function tickEvents(now, delta) {
    if (!rt.fishingActive) return;
    if (rt.eventActive) {
        rt.eventActive.remaining -= delta;
        if (rt.eventActive.remaining <= 0) {
            const ended = rt.eventActive.name;
            rt.eventActive = null;
            addLog(`📅 Evento "${ended}" terminou.`);
        }
        return;
    }
    if (now < rt.nextEventCheck) return;
    rt.nextEventCheck = now + 8000 + Math.random() * 12000;
    if (Math.random() < 0.18) triggerRandomEvent();
}

function triggerRandomEvent() {
    const total = EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    let chosen = EVENTS[0];
    for (const e of EVENTS) { r -= e.weight; if (r <= 0) { chosen = e; break; } }
    rt.eventActive = { ...chosen, type: chosen.id, remaining: chosen.dur };
    showEventToast(chosen);
    SFX.zone();
    addLog(`✨ ${chosen.icon} ${chosen.name} ${chosen.desc}`);
}

function showEventToast(ev) {
    const t = document.createElement('div');
    t.className = 'event-toast';
    t.innerHTML = `<span class="ev-icon">${ev.icon}</span><div><strong>${ev.name}</strong><span>${ev.desc}</span></div>`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('exiting'), ev.dur - 600);
    setTimeout(() => t.remove(), ev.dur);
}

function getEventValueMult() { return rt.eventActive?.type === 'sorte' ? 2 : 1; }
function getEventHookMult()  { return rt.eventActive?.type === 'tempestade' ? 1.6 : 1; }
function eventFiltersFish(fish) {
    if (rt.eventActive?.type === 'lua_cheia' && fish.rarity === 'common') return false;
    return true;
}

// =================================================================
// MISSÕES DIÁRIAS
// =================================================================
const QUEST_POOL = [
    { id: 'catch_any',    desc: n => `Capture ${n} ${n === 1 ? 'peixe' : 'peixes'}`,                          goals: [10, 25, 50], track: 'catch_any',       reward: lvl => 200 * (lvl + 1) * (lvl + 1), minMotor: 0  },
    { id: 'catch_uncommon', desc: n => `Capture ${n} ${n === 1 ? 'peixe incomum' : 'peixes incomuns'}`,        goals: [5, 12, 25],  track: 'catch_uncommon',  reward: lvl => 500 * (lvl + 1),             minMotor: 0  },
    { id: 'catch_rare',   desc: n => `Capture ${n} ${n === 1 ? 'peixe raro+' : 'peixes raros+'}`,             goals: [3, 8, 15],   track: 'catch_rare',      reward: lvl => 1500 * (lvl + 1),            minMotor: 3  },
    { id: 'catch_epic',   desc: n => `Capture ${n} ${n === 1 ? 'peixe épico' : 'peixes épicos'}`,             goals: [1, 3, 6],    track: 'catch_epic',      reward: lvl => 4000 * (lvl + 1),            minMotor: 7  },
    { id: 'catch_abyss',  desc: n => `Capture ${n} ${n === 1 ? 'peixe da Fossa' : 'peixes da Fossa Abissal'}`, goals: [3, 8, 15], track: 'catch_abyss',     reward: lvl => 8000 * (lvl + 1),            minMotor: 12 },
    { id: 'catch_legend', desc: n => `Capture ${n} ${n === 1 ? 'peixe lendário' : 'peixes lendários'}`,       goals: [1, 2, 3],    track: 'catch_legendary', reward: lvl => 50000 * (lvl + 1),           minMotor: 12 },
    { id: 'earn',         desc: n => `Ganhe ${fmtMoney(n)}`,                                                  goals: [500, 2500, 10000], track: 'earn',     reward: lvl => 300 * (lvl + 1) * (lvl + 1), minMotor: 0  },
];

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function ensureQuestsForToday() {
    if (!state.quests) state.quests = { date: '', list: [] };
    if (state.quests.date === todayKey() && state.quests.list.length) return;
    // Anti-abuso de relógio: além de virar o dia, exige ~18h reais desde o último
    // sorteio antes de renovar (impede adiantar o relógio p/ farmar recompensas).
    // Não bloqueia o 1º sorteio (list vazia) nem saves antigos (rolledAt ausente).
    const nowMs = Date.now();
    if (state.quests.list.length && state.quests.rolledAt &&
        nowMs - state.quests.rolledAt < 18 * 3600 * 1000) return;
    // Filtra missões pelas zonas acessíveis (motor atual)
    const motorLvl = state.upgrades?.motor || 0;
    const reachable = QUEST_POOL.filter(q => q.minMotor <= motorLvl);
    const pool = reachable.length >= 3 ? [...reachable] : [...QUEST_POOL.filter(q => q.minMotor === 0)];
    const list = [];
    for (let i = 0; i < 3 && pool.length; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const q = pool.splice(idx, 1)[0];
        // Nível de dificuldade: limita pelo nível do motor (mais fácil pra novato)
        const maxLvl = motorLvl >= 7 ? 2 : motorLvl >= 3 ? 1 : 0;
        const lvl = Math.floor(Math.random() * (maxLvl + 1));
        list.push({
            id: q.id, track: q.track,
            goal: q.goals[lvl], progress: 0,
            reward: q.reward(lvl),
            desc: q.desc(q.goals[lvl]),
            done: false,
        });
    }
    state.quests = { date: todayKey(), list, rolledAt: nowMs };
}

function questProgress(track, n) {
    if (!state.quests?.list) return;
    let any = false;
    for (const q of state.quests.list) {
        if (q.done) continue;
        if (q.track === track) {
            q.progress += n;
            any = true;
            if (q.progress >= q.goal) {
                q.done = true;
                state.money += q.reward;
                state.totalEarned = (state.totalEarned || 0) + q.reward;
                addLog(`📋 Missão concluída! +${fmtMoney(q.reward)}`);
                showAchievementToast({ name: 'Missão Concluída', desc: q.desc });
                SFX.upgrade();
                notifyTab('quests');
            }
        }
    }
    if (any) renderQuests();
}

function renderQuests() {
    const list = document.getElementById('questsList');
    if (!list) return;
    ensureQuestsForToday();
    list.innerHTML = '';
    state.quests.list.forEach(q => {
        const pct = Math.min(100, (q.progress / q.goal) * 100);
        const item = document.createElement('div');
        item.className = 'quest-item' + (q.done ? ' quest-done' : '');
        item.innerHTML = `
            <div class="quest-row">
                <span class="quest-desc"></span>
                <span class="quest-reward">${q.done ? '✓' : '+' + fmtMoney(q.reward)}</span>
            </div>
            <div class="quest-bar"><div class="quest-bar-fill" style="width: ${pct}%"></div></div>
            <div class="quest-progress">${Math.min(q.progress, q.goal)} / ${q.goal}</div>
        `;
        // desc via textContent — nunca interpola HTML de dados que podem vir de save importado
        item.querySelector('.quest-desc').textContent = q.desc;
        list.appendChild(item);
    });
}

// =================================================================
// GESTÃO DE FOCO DE MODAIS (acessibilidade — WCAG 2.1.2 / 2.4.3)
// =================================================================
let _lastFocused = null;
const MODAL_SEL = '.modal-backdrop.show, .tutorial-overlay.show';
const FOCUSABLE_SEL = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function openModal(modal) {
    if (!modal) return;
    _lastFocused = document.activeElement;
    modal.classList.add('show');
    // Foca o 1º controle do diálogo (normalmente o botão de fechar)
    setTimeout(() => modal.querySelector(FOCUSABLE_SEL)?.focus(), 30);
}
function closeModalEl(modal, onClose) {
    if (!modal || !modal.classList.contains('show')) return;
    modal.classList.remove('show');
    if (typeof onClose === 'function') onClose();
    if (_lastFocused && typeof _lastFocused.focus === 'function') _lastFocused.focus();
    _lastFocused = null;
}
function dismissTutorial() {
    const ov = document.getElementById('tutorialOverlay');
    if (!ov || !ov.classList.contains('show')) return;
    ov.classList.remove('show');
    try { localStorage.setItem('angeloPescadorTutorialDone', '1'); } catch (e) {}
}
// Escape fecha o modal aberto; Tab fica preso dentro dele (focus trap)
function setupModalKeys() {
    document.addEventListener('keydown', (e) => {
        const modal = document.querySelector(MODAL_SEL);
        if (!modal) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            if (modal.id === 'tutorialOverlay') dismissTutorial();
            else closeModalEl(modal);
            return;
        }
        if (e.key !== 'Tab') return;
        const f = modal.querySelectorAll(FOCUSABLE_SEL);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
}

// =================================================================
// PRESTÍGIO (PÉROLAS)
// =================================================================
function openPrestigeModal() {
    const available = calcPearlsToGain();
    const total = calcPearlsAvailable();
    const modal = document.getElementById('prestigeModal');
    if (!modal) return;
    document.getElementById('prestigePearls').textContent = state.pearls;
    document.getElementById('prestigeAvailable').textContent = available;
    document.getElementById('prestigeTotal').textContent = total;
    document.getElementById('prestigeBtn').disabled = available <= 0;
    document.getElementById('prestigeBonusValue').textContent = state.pearlBonuses.value || 0;
    document.getElementById('prestigeBonusSpawn').textContent = state.pearlBonuses.spawn || 0;
    document.getElementById('prestigeBonusMulti').textContent = state.pearlBonuses.multi || 0;
    if (modal.classList.contains('show')) return;   // refresh (ex.: buyPearlBonus) sem re-focar
    openModal(modal);
}
function closePrestigeModal() {
    closeModalEl(document.getElementById('prestigeModal'));
}
function doPrestige() {
    const gain = calcPearlsToGain();
    if (gain <= 0) return;
    if (!confirm(`Vai resetar dinheiro, peixes e melhorias para ganhar ${gain} pérola(s). Bônus permanentes e o compêndio são mantidos. Continuar?`)) return;
    state.pearls += gain;
    state.money = 0;
    state.totalFish = 0;
    state.upgrades = { rod: 0, bait: 0, motor: 0, hook: 0, net: 0, value: 0, abyss: 0 };
    state.currentZone = 0;
    state._biggestCatch = null;
    state._maxCombo = 0;
    state.consumables = { extraBait: 0, magnify: 0, chronometer: 0 };
    rt.consumableActive = null;
    rt.fishingActive = false;
    SFX.catch('legendary');
    rt.cameraShake = 20;
    addLog(`🦪 Prestígio! Ganhou ${gain} pérola(s).`);
    closePrestigeModal();
    updateUpgradeCards();
    updateZoneCards();
    updateStats();
    buildCompendium();
    saveGame();
}
function buyPearlBonus(type) {
    if (state.pearls <= 0) return;
    const labels = { value: 'Mercado das Pérolas', spawn: 'Cardume Permanente', multi: 'Anzol Sortudo' };
    if (!confirm(`Gastar 1 Pérola para subir "${labels[type] || type}"? Pérolas são permanentes mas escassas.`)) return;
    state.pearls -= 1;
    state.pearlBonuses[type] = (state.pearlBonuses[type] || 0) + 1;
    SFX.upgrade();
    openPrestigeModal();
    updateStats();
    saveGame();
}

// =================================================================
// SAVE / LOAD
// =================================================================
function saveGame() {
    try {
        state.lastSave = Date.now();
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        return true;
    } catch (e) { return false; }
}

function loadGame() {
    try {
        let raw = localStorage.getItem(SAVE_KEY);
        if (!raw) raw = localStorage.getItem('angeloPescadorSave_v3');
        if (!raw) raw = localStorage.getItem('angeloPescadorSave_v2');
        if (!raw) raw = localStorage.getItem('angeloPescadorSave_v1');
        if (!raw) return false;
        const s = JSON.parse(raw);
        state = {
            ...state,
            ...s,
            upgrades:     { ...state.upgrades,     ...(s.upgrades     || {}) },
            pearlBonuses: { ...state.pearlBonuses, ...(s.pearlBonuses || {}) },
            consumables:  { ...state.consumables,  ...(s.consumables  || {}) },
            quests:       s.quests || state.quests,
            // Migração: se totalEarned não existe, estima por money + upgrades comprados
            totalEarned:  s.totalEarned ?? s.money ?? 0,
        };
        // Blindagem: zona sempre dentro da faixa válida (evita ZONES[undefined] no boot)
        state.currentZone = Math.max(0, Math.min(ZONES.length - 1, Math.floor(Number(state.currentZone) || 0)));
        return true;
    } catch { return false; }
}

function resetGame() {
    if (!confirm('⚠️ Tem certeza? Todo progresso será perdido (incluindo pérolas e compêndio).')) return;
    ['v1','v2','v3','v4'].forEach(v => localStorage.removeItem('angeloPescadorSave_' + v));
    localStorage.removeItem('angeloPescadorTutorialDone');
    state = {
        money: 0, totalFish: 0, currentZone: 0,
        upgrades: { rod: 0, bait: 0, motor: 0, hook: 0, net: 0, value: 0, abyss: 0 },
        lastSave: Date.now(),
        achievements: {},
        _speciesCaught: {},
        _legendaryCaught: false,
        pearls: 0, totalEarned: 0,
        pearlBonuses: { value: 0, spawn: 0, multi: 0 },
        _biggestCatch: null, _maxCombo: 0, _playTime: 0,
        quests: { date: '', list: [] },
        consumables: { extraBait: 0, magnify: 0, chronometer: 0 },
    };
    rt.consumableActive = null;
    rt.fishingActive = false;
    updateUpgradeCards();
    updateZoneCards();
    updateStats();
    buildCompendium();
    updateConsumables();
    ensureQuestsForToday();
    renderQuests();
    addLog('🔄 Jogo reiniciado');
}

function showSaveToast(msg = '💾 Jogo salvo!') {
    const t = document.createElement('div');
    t.className = 'save-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
}

// === EXPORTAR / IMPORTAR SAVE (protege o progresso entre aparelhos) ===
function exportSave() {
    try {
        saveGame();
        const code = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
        const fallback = () => prompt('Copie seu código de save:', code);
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(code)
                .then(() => showSaveToast('📤 Código copiado! Cole em outro aparelho.'))
                .catch(fallback);
        } else fallback();
    } catch (e) { alert('Erro ao exportar o save.'); }
}

// Valida e saneia um save vindo de fonte externa (import). Coerção para números
// finitos/não-negativos, clamp de zona, e limpeza das missões (fecha NaN-lock e XSS).
function sanitizeSave(s) {
    if (!s || typeof s !== 'object') return false;
    if (!Number.isFinite(s.money)) return false;               // rejeita NaN/Infinity/ausente
    const num = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? v : d);
    const int = (v, d = 0) => Math.max(0, Math.floor(num(v, d)));
    s.money       = num(s.money);
    s.totalFish   = int(s.totalFish);
    s.totalEarned = num(s.totalEarned, s.money);
    s.pearls      = int(s.pearls);
    s.currentZone = Math.max(0, Math.min(ZONES.length - 1, Math.floor(num(s.currentZone))));
    const clean = (obj, keys) => {
        const out = {};
        for (const k of keys) out[k] = int(obj && obj[k]);
        return out;
    };
    s.upgrades     = clean(s.upgrades,     ['rod','bait','motor','hook','net','value','abyss']);
    s.pearlBonuses = clean(s.pearlBonuses, ['value','spawn','multi']);
    s.consumables  = clean(s.consumables,  ['extraBait','magnify','chronometer']);
    if (!s.quests || typeof s.quests !== 'object' || !Array.isArray(s.quests.list)) {
        s.quests = { date: '', list: [] };
    } else {
        s.quests.date = typeof s.quests.date === 'string' ? s.quests.date.slice(0, 20) : '';
        s.quests.list = s.quests.list
            .filter(q => q && typeof q === 'object')
            .slice(0, 3)
            .map(q => ({
                id: String(q.id || ''), track: String(q.track || ''),
                goal: Math.max(1, int(q.goal, 1)), progress: int(q.progress),
                reward: int(q.reward),
                desc: typeof q.desc === 'string' ? q.desc.slice(0, 120) : '',
                done: !!q.done,
            }));
    }
    return true;
}

function importSave() {
    const code = prompt('Cole aqui o código do save exportado:');
    if (!code) return;
    if (code.length > 50000) { alert('Código muito grande — parece inválido.'); return; }
    try {
        const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
        if (!sanitizeSave(s)) throw new Error('inválido');
        localStorage.setItem(SAVE_KEY, JSON.stringify(s));
        location.reload();   // recarrega com o novo save aplicado
    } catch (e) { alert('Código inválido — confira se copiou o texto completo.'); }
}

// =================================================================
// LOOP PRINCIPAL
// =================================================================
let lastFrame = performance.now();

function gameLoop(now) {
    try {
        runFrame(now);
    } catch (err) {
        console.error('[Angelo Pescador] erro no gameLoop:', err);
        // Não interromper o loop — apenas registrar e seguir.
        requestAnimationFrame(gameLoop);
    }
}

function runFrame(now) {
    const delta = Math.min(50, now - lastFrame);
    lastFrame = now;
    updateFxQuality(delta);

    // Pausa
    if (rt.paused) {
        ctx.save();
        ctx.fillStyle = 'rgba(2, 8, 20, 0.72)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 52px sans-serif';
        ctx.shadowColor = 'rgba(0,212,255,0.6)'; ctx.shadowBlur = 24;
        ctx.fillText('⏸', cw / 2, ch / 2 - 36);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('PAUSADO', cw / 2, ch / 2 + 12);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = 'rgba(0,212,255,0.75)';
        ctx.fillText('Pressione P para continuar', cw / 2, ch / 2 + 50);
        ctx.restore();
        requestAnimationFrame(gameLoop);
        return;
    }

    rt.time += delta;

    tickFishing(now, delta);
    tickCooldown(now);
    tickPassive(delta);
    tickEvents(now, delta);
    updateFish(delta);
    updateBubbles(delta);
    updateParticles(delta);
    updateAmbient(delta);
    updateChests(delta);
    updateTrails(delta);
    updateFloatTexts(delta);

    if (now > rt.nextBubbleTime) {
        spawnBubble();
        // Intervalo maior em zonas profundas
        const intervals = [350, 380, 500, 750];
        rt.nextBubbleTime = now + intervals[state.currentZone] + Math.random() * 400;
    }

    if (now > rt.nextAmbientTime) {
        spawnAmbientParticle();
        rt.nextAmbientTime = now + 800 + Math.random() * 1200;
    }

    if (rt.cameraShake > 0) rt.cameraShake = Math.max(0, rt.cameraShake - delta * 0.04);

    // Render
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    if (rt.cameraShake > 0 && !REDUCED_MOTION) {
        const sx = (Math.random() - 0.5) * rt.cameraShake;
        const sy = (Math.random() - 0.5) * rt.cameraShake;
        ctx.translate(sx, sy);
    }

    // ── ACIMA DA ÁGUA (nítido) ──────────────────────────────────
    drawSky(rt.time);
    if (state.currentZone < 3) drawSun(rt.time);
    drawClouds(rt.time);
    drawWater(rt.time);

    // ── SUBMERSO (vai pra uma camada própria e volta refratado) ──
    // Só o conteúdo dentro d'água entra aqui; a superfície e o que está
    // acima dela continuam nítidos.
    const underwater = getFxLayer('underwater');
    drawToLayer(underwater, () => {
        drawCaustics(rt.time);
        drawBackdrop(rt.time);
        drawTerrain(rt.time);
        // Peixes (já estão ordenados por size desde o spawn)
        for (const f of rt.activeFish) drawFish(f);
        drawSeaweed(rt.time);
        drawTrails();
    });
    blitRefracted(underwater, rt.time);

    // ── DE VOLTA NA TELA ────────────────────────────────────────
    drawDepthFog();           // escurece água e conteúdo juntos, como antes
    drawChests(rt.time);      // interativos: ficam nítidos
    drawAmbient();
    drawBubbles();
    drawBoat(rt.time);

    if (rt.fishingActive || rt.hookY > 0) {
        updateRope();
        drawRope();
        drawHook(rt.time);
    }

    drawParticles();
    drawFloatTexts();

    // Passes de pós-processamento (ordem importa: bloom antes da cor)
    applyBloom();
    applyColorGrade();

    // Vinheta — foca o olhar no centro da cena
    if (!rt.vignette || rt.vignette.w !== cw || rt.vignette.h !== ch) {
        const vg = ctx.createRadialGradient(cw / 2, ch * 0.45, Math.min(cw, ch) * 0.30,
                                            cw / 2, ch * 0.45, Math.max(cw, ch) * 0.78);
        vg.addColorStop(0,    'rgba(0, 10, 24, 0)');
        vg.addColorStop(0.62, 'rgba(0, 10, 24, 0.10)');
        vg.addColorStop(1,    'rgba(0, 10, 24, 0.42)');
        rt.vignette = { w: cw, h: ch, grad: vg };
    }
    ctx.fillStyle = rt.vignette.grad;
    ctx.fillRect(0, 0, cw, ch);

    // Display visual do combo (flutua para cima e desaparece)
    if (rt.comboDisplayTimer > 0) {
        rt.comboDisplayTimer -= delta;
        rt.comboY -= delta * 0.022;
        const alpha = Math.min(1, rt.comboDisplayTimer / 500);
        const scale = 1.0 + (1 - Math.min(1, rt.comboDisplayTimer / 1800)) * 0.25;
        const fontSize = Math.round(24 + rt.combo * 1.5);
        ctx.save();
        ctx.translate(rt.comboX, rt.comboY);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // sombra
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(`🔥 COMBO x${rt.combo}`, 2, 3);
        // texto principal
        ctx.shadowColor = 'rgba(255, 107, 53, 0.9)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ff6b35';
        ctx.fillText(`🔥 COMBO x${rt.combo}`, 0, 0);
        ctx.restore();
    }

    // Banner de evento ativo (parte inferior da cena)
    if (rt.eventActive) {
        const ev = rt.eventActive;
        const pct = ev.remaining / ev.dur;
        ctx.save();
        const bw = 220, bh = 28;
        const bx = cw / 2 - bw / 2, by = ch - 130;
        ctx.fillStyle = 'rgba(2, 8, 20, 0.85)';
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 8) : ctx.rect(bx, by, bw, bh);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
        ctx.fillRect(bx + 2, by + bh - 5, (bw - 4) * pct, 3);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${ev.icon} ${ev.name}`, cw / 2, by + 12);
        ctx.restore();
    }

    // Joystick touch
    drawJoystick();

    // Transição de zona (fade)
    if (rt.zoneTransition > 0) {
        rt.zoneTransition = Math.max(0, rt.zoneTransition - delta * 0.003);
        ctx.save();
        ctx.globalAlpha = rt.zoneTransition * 0.85;
        ctx.fillStyle = '#020814';
        ctx.fillRect(0, 0, cw, ch);
        ctx.restore();
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

function slowUpdate() {
    if (document.hidden) return;   // sem varredura de DOM com a aba em segundo plano
    updateStats();
    updateUpgradeCards();
    updateConsumables();
    checkAchievements();
    const tp = document.getElementById('topPearls');
    if (tp) tp.textContent = state.pearls || 0;
}

function switchTab(tabId) {
    document.querySelectorAll('.panel-tab').forEach(t => {
        const active = t.dataset.tab === tabId;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.setAttribute('tabindex', active ? '0' : '-1');   // roving tabindex (APG)
        if (active) t.classList.remove('has-notification');
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.toggle('active', p.dataset.pane === tabId);
    });
    // Som leve ao trocar de aba
    if (typeof SFX !== 'undefined' && SFX.tab) SFX.tab();
}

function notifyTab(tabId) {
    const tab = document.querySelector(`.panel-tab[data-tab="${tabId}"]`);
    if (tab && !tab.classList.contains('active')) {
        tab.classList.add('has-notification');
    }
}

function autoSave() { saveGame(); }

// =================================================================
// INPUT
// =================================================================
function setupInput() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd+S: salvar SEM acionar movimento pra baixo
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
            e.preventDefault();
            if (saveGame()) showSaveToast();
            return;
        }
        if (e.ctrlKey || e.metaKey) return; // ignora outros atalhos com modificador
        // Com um modal aberto, o teclado é do modal (foco/Escape), não do jogo
        if (document.querySelector(MODAL_SEL)) return;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft')  rt.keyState.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') rt.keyState.right = true;
        if (e.code === 'KeyW' || e.code === 'ArrowUp')    { rt.keyState.up = true; e.preventDefault(); }
        if (e.code === 'KeyS' || e.code === 'ArrowDown')  { rt.keyState.down = true; e.preventDefault(); }
        if (e.code === 'Space') { e.preventDefault(); startFishing(); }
        if (e.code === 'KeyP') {
            rt.paused = !rt.paused;
            SFX.pause(rt.paused);
            const btn = document.getElementById('floatingPauseBtn');
            if (btn) btn.textContent = rt.paused ? '▶' : '⏸';
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft')  rt.keyState.left = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') rt.keyState.right = false;
        if (e.code === 'KeyW' || e.code === 'ArrowUp')    rt.keyState.up = false;
        if (e.code === 'KeyS' || e.code === 'ArrowDown')  rt.keyState.down = false;
    });
}

// =================================================================
// INIT
// =================================================================
function init() {
    const isFirstTime = !localStorage.getItem(SAVE_KEY) &&
                        !localStorage.getItem('angeloPescadorSave_v3') &&
                        !localStorage.getItem('angeloPescadorSave_v2') &&
                        !localStorage.getItem('angeloPescadorSave_v1');
    loadGame();
    cacheDOM();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    // ResizeObserver cobre casos que 'resize' não pega (iframe, painel oculto no load)
    if (window.ResizeObserver) {
        new ResizeObserver(resizeCanvas).observe(document.getElementById('oceanPanel'));
    }

    createUpgradeCards();
    createZoneCards();
    updateUpgradeCards();
    updateZoneCards();
    updateStats();
    buildConsumables();

    DOM.castButton.addEventListener('click', startFishing);
    document.getElementById('saveBtn').addEventListener('click', () => { if (saveGame()) showSaveToast(); });
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('openPrestigeBtn')?.addEventListener('click', openPrestigeModal);
    document.getElementById('closePrestigeBtn')?.addEventListener('click', closePrestigeModal);
    document.getElementById('prestigeBtn')?.addEventListener('click', doPrestige);
    document.querySelectorAll('.pbc-buy[data-bonus]').forEach(b => {
        b.addEventListener('click', () => buyPearlBonus(b.dataset.bonus));
    });
    document.getElementById('openTrophiesBtn')?.addEventListener('click', openTrophiesModal);
    // Botão flutuante de pausa (substitui tecla P em mobile)
    document.getElementById('floatingPauseBtn')?.addEventListener('click', () => {
        rt.paused = !rt.paused;
        SFX.pause(rt.paused);
        const btn = document.getElementById('floatingPauseBtn');
        if (btn) btn.textContent = rt.paused ? '▶' : '⏸';
    });
    // Botão de som (desktop + mobile)
    const soundBtn = document.getElementById('soundBtn');
    if (soundBtn) {
        soundBtn.textContent = SFX.muted ? '🔇' : '🔊';
        soundBtn.addEventListener('click', () => {
            const m = SFX.toggleMute();
            soundBtn.textContent = m ? '🔇' : '🔊';
        });
    }
    // Tela cheia (mobile)
    document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    // Exportar / importar save
    document.getElementById('exportBtn')?.addEventListener('click', exportSave);
    document.getElementById('importBtn')?.addEventListener('click', importSave);
    document.getElementById('closeTrophiesBtn')?.addEventListener('click', () => {
        closeModalEl(document.getElementById('trophiesModal'));
    });
    // Filtros do compêndio
    document.querySelectorAll('.comp-filter-btn').forEach(b => {
        b.addEventListener('click', () => setCompFilter(b.dataset.filter));
    });
    // Sistema de abas — clique + navegação por setas (padrão ARIA Tabs)
    const tabEls = Array.from(document.querySelectorAll('.panel-tab'));
    tabEls.forEach((tab, i) => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        tab.addEventListener('keydown', (e) => {
            let ni = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = (i + 1) % tabEls.length;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = (i - 1 + tabEls.length) % tabEls.length;
            else if (e.key === 'Home') ni = 0;
            else if (e.key === 'End') ni = tabEls.length - 1;
            if (ni < 0) return;
            e.preventDefault();
            switchTab(tabEls[ni].dataset.tab);
            tabEls[ni].focus();
        });
    });
    // Tutorial
    document.getElementById('tutorialOkBtn')?.addEventListener('click', dismissTutorial);
    // Fechar modal por backdrop
    document.querySelectorAll('.modal-backdrop').forEach(m => {
        m.addEventListener('click', (e) => { if (e.target === m) closeModalEl(m); });
    });

    setupInput();
    setupModalKeys();
    setupTouch();
    initRope();
    initSeaweed();

    buildCompendium();
    ensureQuestsForToday();
    renderQuests();

    // Topo: pérolas
    const tp = document.getElementById('topPearls');
    if (tp) tp.textContent = state.pearls || 0;

    setInterval(slowUpdate, 250);
    setInterval(autoSave, 15000);
    setInterval(() => { ensureQuestsForToday(); renderQuests(); }, 60000); // checa virada do dia
    window.addEventListener('beforeunload', saveGame);

    addLog('🎣 Bem-vindo! Pressione ESPAÇO ou clique em LANÇAR ANZOL.');
    addLog('🎮 WASD/setas · P pausar · Ctrl+S salvar');

    // Tutorial: aparece se nunca foi visto, independente do save existir ou não
    if (!localStorage.getItem('angeloPescadorTutorialDone')) {
        const ov = document.getElementById('tutorialOverlay');
        ov?.classList.add('show');
        setTimeout(() => document.getElementById('tutorialOkBtn')?.focus(), 40);
    }

    // Som ambiente
    setupAmbientSound();

    // Offline earnings: enquanto a aba estiver oculta, calcula peixes pescados pela rede
    setupOfflineEarnings();

    // Ganhos offline desde o último save (cobre fechar a aba/navegador, não só ocultar)
    grantOfflineEarnings((Date.now() - (state.lastSave || Date.now())) / 1000);

    // Poupa bateria: suspende o áudio quando a aba fica em segundo plano
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) SFX.suspend(); else SFX.resume();
    });

    requestAnimationFrame(gameLoop);
}

// =================================================================
// OFFLINE EARNINGS — calcula ganhos da rede enquanto aba estava oculta
// =================================================================
// Credita os peixes que a rede pescou durante um período ausente.
function grantOfflineEarnings(elapsedSec) {
    const rate = getPassiveRate();
    if (elapsedSec < 30 || rate <= 0) return;
    const minutes = elapsedSec / 60;
    const fishesToCatch = Math.floor(rate * minutes);
    if (fishesToCatch <= 0) return;
    // Cap: máximo OFFLINE_CAP_MINUTES (8h) de pesca offline
    const cappedFishes = Math.min(fishesToCatch, Math.floor(rate * OFFLINE_CAP_MINUTES));
    let totalGain = 0;
    for (let i = 0; i < cappedFishes; i++) {
        const f = rollFish(bestUnlockedZone());
        if (f) totalGain += sellFish(f);
    }
    if (totalGain > 0) {
        showOfflineEarningsToast(cappedFishes, totalGain, elapsedSec);
        SFX.offline();
        updateStats();
        saveGame();
    }
}

function setupOfflineEarnings() {
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            hiddenAt = Date.now();
            saveGame();
        } else if (hiddenAt > 0) {
            const elapsedSec = (Date.now() - hiddenAt) / 1000;
            hiddenAt = 0;
            grantOfflineEarnings(elapsedSec);
        }
    });
}

function showOfflineEarningsToast(fishes, gain, elapsedSec) {
    const mins = Math.round(elapsedSec / 60);
    const t = document.createElement('div');
    t.className = 'offline-toast';
    t.innerHTML = `
        <span class="offline-emoji">🕸️</span>
        <div>
            <strong>Pesca Offline!</strong>
            <span>Sua rede pescou <b>${fishes}</b> peixes em ${mins < 1 ? '<1' : mins} min · +${fmtMoney(gain)}</span>
        </div>
        <button class="offline-close" aria-label="Fechar">×</button>
    `;
    document.body.appendChild(t);
    t.querySelector('.offline-close').addEventListener('click', () => t.remove());
    setTimeout(() => t.remove(), 8000);
}

// =================================================================
// SOM AMBIENTE — ruído de mar gerado por Web Audio
// =================================================================
// Inicia a ambiência do mar no 1º gesto do usuário, usando a ÚNICA fonte de áudio
// (SFX.ambience), que respeita o mute. Antes havia um segundo gerador independente
// que dobrava o volume e ignorava o botão de som.
function setupAmbientSound() {
    const start = () => {
        SFX.ambience();
        document.removeEventListener('click', start);
        document.removeEventListener('keydown', start);
        document.removeEventListener('touchstart', start);
    };
    document.addEventListener('click', start);
    document.addEventListener('keydown', start);
    document.addEventListener('touchstart', start);
}

document.addEventListener('DOMContentLoaded', init);

// Service Worker para jogar offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

})();

/* ================================================================
   ANGELO PESCADOR — Canvas Edition
   Renderização Canvas 2D · Física verlet de corda · Partículas
   Economia rebalanceada · Bestiário expandido (24 espécies)
   ================================================================ */

(() => {
'use strict';

// =================================================================
// CONSTANTES
// =================================================================
const SAVE_KEY            = 'angeloPescadorSave_v3';
const SESSION_BASE_MS     = 6000;
const SPAWN_BASE_MS       = 1800;
const HOOK_BASE_RADIUS    = 30;       // px
const HOOK_SPEED          = 0.035;    // % por ms (mais lento, exige pontaria)
const HOOK_INITIAL_DEPTH  = 50;       // % da água
const ROPE_SEGMENTS       = 26;
const MAX_FISH_ON_SCREEN  = 14;
const COOLDOWN_MS         = 1500;

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
// BESTIÁRIO (24 espécies, com tamanhos distintos)
// =================================================================
const FISH = [
    // ── COSTA RASA ── pequenos e baratos
    { name: 'Sardinha',          emoji: '🐟', baseValue: 2,      rarity: 'common',    zones: [0],       weight: 60,  speed: 1.3, size: 26 },
    { name: 'Peixinho-Dourado',  emoji: '🐠', baseValue: 5,      rarity: 'common',    zones: [0],       weight: 45,  speed: 1.1, size: 28 },
    { name: 'Lambari',           emoji: '🐟', baseValue: 9,      rarity: 'common',    zones: [0],       weight: 38,  speed: 1.6, size: 24 },
    { name: 'Caranguejo',        emoji: '🦀', baseValue: 22,     rarity: 'uncommon',  zones: [0, 1],    weight: 16,  speed: 0.6, size: 32 },
    { name: 'Cavalinha',         emoji: '🐟', baseValue: 30,     rarity: 'uncommon',  zones: [0, 1],    weight: 22,  speed: 1.4, size: 30 },
    { name: 'Robalo',            emoji: '🐡', baseValue: 50,     rarity: 'uncommon',  zones: [0, 1],    weight: 12,  speed: 0.9, size: 34 },

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

    // ── FOSSA ABISSAL ── criaturas exóticas e raríssimas
    { name: 'Peixe-Lanterna',    emoji: '🐟', baseValue: 9000,   rarity: 'rare',      zones: [3],       weight: 22,  speed: 1.0, size: 36 },
    { name: 'Lula Colossal',     emoji: '🦑', baseValue: 22000,  rarity: 'epic',      zones: [3],       weight: 9,   speed: 1.0, size: 58 },
    { name: 'Kraken',            emoji: '🐙', baseValue: 45000,  rarity: 'epic',      zones: [3],       weight: 5,   speed: 0.8, size: 64 },
    { name: 'Peixe-Dragão',      emoji: '🐉', baseValue: 75000,  rarity: 'legendary', zones: [3],       weight: 2.5, speed: 1.6, size: 66, bossHp: 2 },
    { name: 'Tubarão-Fantasma',  emoji: '🦈', baseValue: 130000, rarity: 'legendary', zones: [3],       weight: 1.2, speed: 2.0, size: 72, bossHp: 3 },
    { name: 'Baleia Azul',       emoji: '🐋', baseValue: 320000, rarity: 'legendary', zones: [3],       weight: 0.3, speed: 0.7, size: 92, bossHp: 4 },
];

// =================================================================
// MELHORIAS — economia rebalanceada (curvas mais íngremes)
// =================================================================
const UPGRADES = [
    {
        id: 'rod', name: 'Vara Reforçada', icon: '🎣',
        desc: '+0.15s de duração por sessão de pesca',
        baseCost: 20, costMultiplier: 1.22, maxLevel: 20,
    },
    {
        id: 'bait', name: 'Isca Especial', icon: '🪱',
        desc: 'Peixes aparecem mais rápido e raros mais frequentes',
        baseCost: 120, costMultiplier: 1.25, maxLevel: 20,
    },
    {
        id: 'motor', name: 'Motor do Barco', icon: '⚙️',
        desc: 'Desbloqueia águas mais profundas',
        baseCost: 500, costMultiplier: 1.38, maxLevel: 12,
    },
    {
        id: 'hook', name: 'Anzol Largo', icon: '🪝',
        desc: '+8% área de captura · +3% chance de multi-captura',
        baseCost: 800, costMultiplier: 1.28, maxLevel: 15,
    },
    {
        id: 'net', name: 'Rede de Pesca', icon: '🕸️',
        desc: 'Pesca passiva: 0.15 peixe/min por nível',
        baseCost: 1500, costMultiplier: 1.30, maxLevel: 25,
    },
    {
        id: 'value', name: 'Mercado Premium', icon: '💰',
        desc: '+4% no valor de venda dos peixes',
        baseCost: 2500, costMultiplier: 1.30, maxLevel: 20,
    },
];

// =================================================================
// SONS — Web Audio API sintético (zero dependências)
// =================================================================
const SFX = (() => {
    let ac = null;
    function ctx() {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume();
        return ac;
    }
    function tone(freq, type, dur, vol = 0.28, startDetune = 0, endDetune = 0) {
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
    upgrades: { rod: 0, bait: 0, motor: 0, hook: 0, net: 0, value: 0 },
    lastSave: Date.now(),
    achievements: {},
    _speciesCaught: {},
    _legendaryCaught: false,
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
    cameraShake: 0,
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
};

// =================================================================
// HELPERS DE ECONOMIA
// =================================================================
function calcCost(up, lvl) { return Math.floor(up.baseCost * Math.pow(up.costMultiplier, lvl)); }
function getSessionDuration() { return SESSION_BASE_MS + state.upgrades.rod * 150; }
function getSpawnInterval()  {
    const reduction = Math.pow(0.97, state.upgrades.bait);
    return Math.max(500, SPAWN_BASE_MS * reduction);
}
function getHookRadius()     { return HOOK_BASE_RADIUS * (1 + state.upgrades.hook * 0.08); }
function getMultiCatchChance() {
    return Math.min(0.30, 0.01 + state.upgrades.hook * 0.03 + state.upgrades.bait * 0.008);
}
function getMaxExtras()        { return 1 + Math.floor(state.upgrades.hook / 8); }
function getBaitRarityBonus()  { return Math.min(0.35, state.upgrades.bait * 0.025); }
function getValueMultiplier()  { return 1 + state.upgrades.value * 0.04; }
function getPassiveRate()      { return state.upgrades.net * 0.15; }
function isZoneUnlocked(id)    { return state.upgrades.motor >= ZONES[id].requiredMotor; }

function fmtMoney(n) {
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3)  return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + Math.floor(n).toLocaleString('pt-BR');
}

function rollFish(zoneId) {
    const pool = FISH.filter(f => f.zones.includes(zoneId));
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
    const v = Math.floor(f.baseValue * getValueMultiplier());
    state.money += v;
    state.totalFish += 1;
    // Tracking de espécies e lendários
    if (!state._speciesCaught) state._speciesCaught = {};
    const isNew = !state._speciesCaught[f.name];   // verificar ANTES de setar
    state._speciesCaught[f.name] = true;
    if (f.rarity === 'legendary') state._legendaryCaught = true;
    if (isNew) setTimeout(updateCompendium, 0);
    return v;
}

// =================================================================
// CANVAS
// =================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let cw = 0, ch = 0;

function resizeCanvas() {
    const r = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = Math.round(r.width  * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cw = r.width;
    ch = r.height;
}

function waterY()       { return ch * 0.22; }
function waterHeight()  { return ch - waterY() - 110; } // -110 reserva área dos controles
function boatPos()      { return { x: cw * 0.5, y: waterY() - 12 }; }
function rodTipPos(t) {
    const b = boatPos();
    const sway = Math.sin(t * 0.001) * 3;
    return { x: b.x + 22 + sway * 0.4, y: b.y - 38 + Math.sin(t * 0.001) * 2 };
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

    // Estrelas no céu da Fossa Abissal
    if (state.currentZone === 3) {
        for (let i = 0; i < 100; i++) {
            const sx = (i * 137.5 + 42) % cw;
            const sy = (i * 97.3 + 13) % (waterY() * 0.85);
            const size = 0.5 + (i % 3) * 0.5;
            const twinkle = 0.4 + 0.6 * Math.sin(t * 0.0012 + i * 2.7);
            ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.6})`;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
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

function drawSun(t) {
    const sx = cw * 0.86;
    const sy = waterY() * 0.36;
    const r = 36;
    const pulse = 1 + Math.sin(t * 0.001) * 0.06;

    // Halo grande
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5.5);
    halo.addColorStop(0,   'rgba(255, 240, 180, 0.45)');
    halo.addColorStop(0.4, 'rgba(255, 220, 140, 0.18)');
    halo.addColorStop(1,   'rgba(255, 200, 100, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - r * 6, sy - r * 6, r * 12, r * 12);

    // Disco
    const disc = ctx.createRadialGradient(sx - 6, sy - 6, 0, sx, sy, r);
    disc.addColorStop(0,   '#FFFCE0');
    disc.addColorStop(0.5, '#FFE082');
    disc.addColorStop(1,   '#FFAB40');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sx, sy, r * pulse, 0, Math.PI * 2);
    ctx.fill();
}

function drawCloud(x, y, size, alpha = 0.85) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x,                  y,                size * 0.4,  0, Math.PI * 2);
    ctx.arc(x + size * 0.32,    y - size * 0.12,  size * 0.46, 0, Math.PI * 2);
    ctx.arc(x + size * 0.62,    y,                size * 0.42, 0, Math.PI * 2);
    ctx.arc(x + size * 0.88,    y + size * 0.06,  size * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawClouds(t) {
    const w = cw + 250;
    drawCloud(((100 + t * 0.005) % w) - 120, waterY() * 0.30, 80,  0.85);
    drawCloud(((420 + t * 0.0035) % w) - 120, waterY() * 0.50, 110, 0.78);
    drawCloud(((760 + t * 0.0058) % w) - 120, waterY() * 0.20, 60,  0.9);
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

    // Linha da onda (sines compostas)
    ctx.save();
    ctx.beginPath();
    for (let x = 0; x <= cw; x += 4) {
        const yWave = Math.sin(x * 0.018 + t * 0.0025) * 3
                    + Math.sin(x * 0.045 + t * 0.0040) * 1.6;
        if (x === 0) ctx.moveTo(x, wy + yWave);
        else ctx.lineTo(x, wy + yWave);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Espuma branca abaixo da linha
    ctx.beginPath();
    ctx.moveTo(0, wy);
    for (let x = 0; x <= cw; x += 4) {
        const yWave = Math.sin(x * 0.018 + t * 0.0025) * 3
                    + Math.sin(x * 0.045 + t * 0.0040) * 1.6;
        ctx.lineTo(x, wy + yWave + 5);
    }
    ctx.lineTo(cw, wy);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, wy, 0, wy + 8);
    fg.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    fg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = fg;
    ctx.fill();
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
    }
    ctx.restore();
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
    ctx.moveTo(0, bottom);
    for (let x = 0; x <= cw; x += 20) {
        const h = bottom - floorH + Math.sin(x * 0.015 + t * 0.0003) * 8
                + Math.sin(x * 0.04) * 4;
        ctx.lineTo(x, h);
    }
    ctx.lineTo(cw, bottom);
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
        // Corais (círculos coloridos empilhados)
        for (let i = 0; i < 8; i++) {
            const cx = (i * 173.3 + 90) % cw;
            const cy = bottom - 25 - (i % 3) * 15;
            const hues = [340, 30, 180, 280, 15, 200, 320, 50];
            for (let b = 0; b < 3; b++) {
                ctx.fillStyle = `hsla(${hues[i]}, ${60 + b*10}%, ${55 - b*10}%, 0.5)`;
                ctx.beginPath();
                ctx.arc(cx + (b-1)*5, cy - b*8, 7 - b*1.5, 0, Math.PI * 2);
                ctx.fill();
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
    const baseSpeed = (220 + fishType.speed * 170) * (rarityMult[fishType.rarity] || 1) * variance;
    const vx = (fromLeft ? 1 : -1) * baseSpeed;

    rt.activeFish.push({
        fish: fishType,
        x, y: lane,
        vx,
        flipped: !fromLeft,
        bobPhase: Math.random() * Math.PI * 2,
        rotation: 0,
        bossHp: fishType.bossHp || 0,
        bossMaxHp: fishType.bossHp || 0,
    });
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
            const dist = Math.hypot(hp.x - f.x, hp.y - f.y);
            if (dist < 200) {
                const intensity = (1 - dist / 200) * (f.fish.rarity === 'legendary' ? 2.5 : f.fish.rarity === 'epic' ? 1.8 : 1.2);
                f.vx *= (1 + intensity * dt);
                const maxSpeed = (280 + f.fish.speed * 180) * 2.8;
                if (Math.abs(f.vx) > maxSpeed) f.vx = Math.sign(f.vx) * maxSpeed;
            }
        }

        // Colisão com anzol
        if (rt.fishingActive && !rt.hookDescending) {
            const hp = hookPxPos();
            const dx = hp.x - f.x;
            const dy = hp.y - f.y;
            const r = getHookRadius();
            if (dx * dx + dy * dy < r * r) {
                catchFishInteractive(f);
                rt.activeFish.splice(i, 1);
                continue;
            }
        }
        if (f.x < -100 || f.x > cw + 100) rt.activeFish.splice(i, 1);
    }
}

function drawFish(f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    if (f.flipped) ctx.scale(-1, 1);

    const s = f.fish.size;
    const idx = FISH.indexOf(f.fish);
    const col = idx >= 0 ? FISH_COLORS[idx] : null;
    const bodyLen = s * 0.50;
    const bodyH = s * 0.20;
    const tailLen = s * 0.16;

    // Sombra no fundo
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(0, bodyH + 5, bodyLen * 0.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cauda
    if (col) {
        ctx.fillStyle = col[3];
    } else {
        ctx.fillStyle = 'rgba(200,200,200,0.6)';
    }
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.35, 0);
    ctx.lineTo(-bodyLen * 0.35 - tailLen, -bodyH * 0.9);
    ctx.lineTo(-bodyLen * 0.35 - tailLen * 0.5, 0);
    ctx.lineTo(-bodyLen * 0.35 - tailLen, bodyH * 0.9);
    ctx.closePath();
    ctx.fill();

    // Corpo com gradiente
    if (col) {
        const bg = ctx.createRadialGradient(-bodyLen*0.1, -bodyH*0.3, 1, 0, 0, bodyLen*0.5);
        bg.addColorStop(0,   col[2]);
        bg.addColorStop(0.4, col[0]);
        bg.addColorStop(1,   col[1]);
        ctx.fillStyle = bg;
    } else {
        ctx.fillStyle = 'rgba(150,190,220,0.7)';
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen * 0.5, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nadadeira dorsal
    if (col) {
        ctx.fillStyle = col[3];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(bodyLen * 0.15, -bodyH * 0.7);
        ctx.quadraticCurveTo(bodyLen * 0.32, -bodyH * 1.35, bodyLen * 0.42, -bodyH * 0.7);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Listras decorativas (em alguns peixes)
    if (col && idx % 4 < 2 && col[4]) {
        ctx.strokeStyle = col[4];
        ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.globalAlpha = 0.35;
        for (let si = 0; si < 2; si++) {
            const ox = -bodyLen * 0.15 + si * bodyLen * 0.12;
            ctx.beginPath();
            ctx.moveTo(ox, -bodyH * 0.3);
            ctx.lineTo(ox + bodyLen * 0.15, bodyH * 0.2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // Olho
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bodyLen * 0.24, -bodyH * 0.22, bodyH * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(bodyLen * 0.27, -bodyH * 0.18, bodyH * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bodyLen * 0.30, -bodyH * 0.25, bodyH * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Barra de vida do chefão
    if (f.bossHp > 0 && f.bossMaxHp > 0) {
        const bw = bodyLen * 0.7, bh = Math.max(3, bodyH * 0.28);
        const ratio = f.bossHp / f.bossMaxHp;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-bw/2, -bodyH * 1.3, bw, bh);
        const barGrad = ctx.createLinearGradient(-bw/2, 0, -bw/2 + bw * ratio, 0);
        barGrad.addColorStop(0, '#ff4444');
        barGrad.addColorStop(1, '#ffb347');
        ctx.fillStyle = barGrad;
        ctx.fillRect(-bw/2 + 1, -bodyH * 1.3 + 1, (bw - 2) * ratio, bh - 2);
    }

    // Glow por raridade ao redor do peixe
    const glow = RARITY_GLOW[f.fish.rarity];
    if (glow) {
        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = f.fish.rarity === 'legendary' ? 22 : (f.fish.rarity === 'epic' ? 14 : 8);
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, bodyLen * 0.5 + 2, bodyH + 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Indicador de raridade (estrelas acima de peixes raros+)
    if (f.fish.rarity === 'legendary') {
        const shimmer = 0.5 + 0.5 * Math.sin(rt.time * 0.008);
        ctx.save();
        ctx.fillStyle = `rgba(255, 179, 71, ${shimmer})`;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⭐', 0, -bodyH * 2);
        ctx.restore();
    } else if (f.fish.rarity === 'epic') {
        const shimmer = 0.4 + 0.4 * Math.sin(rt.time * 0.006);
        ctx.save();
        ctx.fillStyle = `rgba(187, 134, 252, ${shimmer})`;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✦', 0, -bodyH * 1.8);
        ctx.restore();
    } else if (f.fish.rarity === 'rare') {
        const shimmer = 0.3 + 0.3 * Math.sin(rt.time * 0.005);
        ctx.save();
        ctx.fillStyle = `rgba(78, 205, 196, ${shimmer})`;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♦', 0, -bodyH * 1.6);
        ctx.restore();
    } else if (f.fish.rarity === 'uncommon') {
        const shimmer = 0.25 + 0.2 * Math.sin(rt.time * 0.004);
        ctx.save();
        ctx.fillStyle = `rgba(173, 216, 230, ${shimmer})`;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('·', 0, -bodyH * 1.5);
        ctx.restore();
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
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 3;
    ctx.font = '36px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪝', 0, 0);
    ctx.restore();
}

// =================================================================
// BARCO + PESCADOR (canvas-drawn hull + emoji do pescador)
// =================================================================
function drawBoat(t) {
    const b = boatPos();
    const bob  = Math.sin(t * 0.001) * 3;
    const tilt = Math.sin(t * 0.001) * 0.04;
    const wy = waterY();

    ctx.save();
    ctx.translate(b.x, b.y + bob);
    ctx.rotate(tilt);

    // Sombra do barco na água
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 100, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Casco — gradiente madeira
    const hullW = 180, hullH = 38;
    const hg = ctx.createLinearGradient(0, -hullH/2, 0, hullH/2);
    hg.addColorStop(0,   '#B8693E');
    hg.addColorStop(0.4, '#8B4513');
    hg.addColorStop(1,   '#4A2511');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(-hullW/2,        -hullH/2);
    ctx.lineTo( hullW/2,        -hullH/2);
    ctx.quadraticCurveTo( hullW/2 + 14, -hullH/4,  hullW/2 - 8, hullH/2);
    ctx.lineTo(-hullW/2 + 8,     hullH/2);
    ctx.quadraticCurveTo(-hullW/2 - 14, -hullH/4, -hullW/2,    -hullH/2);
    ctx.closePath();
    ctx.fill();

    // Linha de tábua
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-hullW/2 + 10, 2);
    ctx.lineTo( hullW/2 - 10, 2);
    ctx.stroke();

    // Highlight superior
    ctx.strokeStyle = 'rgba(255, 230, 200, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-hullW/2 + 4, -hullH/2);
    ctx.lineTo( hullW/2 - 4, -hullH/2);
    ctx.stroke();

    // Pescador desenhado no canvas
    const px = -16, py = -hullH/2 + 6;

    // Chapéu
    ctx.fillStyle = '#C0392B';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.ellipse(px, py - 10, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 7, py - 22, 14, 12);
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(px - 7, py - 22, 14, 3);

    // Rosto
    ctx.fillStyle = '#F5D0A9';
    ctx.beginPath();
    ctx.ellipse(px, py - 10, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Olhos
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(px - 3, py - 12, 1.5, 0, Math.PI * 2);
    ctx.arc(px + 3, py - 12, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Sorriso
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(px, py - 7, 4, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Braço direito (segurando a vara)
    ctx.strokeStyle = '#F5D0A9';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + 6, py - 4);
    ctx.lineTo(px + 14, py - 14);
    ctx.stroke();

    // Colete salva-vidas
    ctx.fillStyle = '#2980B9';
    ctx.shadowBlur = 2;
    ctx.fillRect(px - 8, py - 4, 16, 12);
    ctx.strokeStyle = '#1A5276';
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 8, py - 4, 16, 12);
    // Faixas refletivas
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(px - 8, py, 16, 2);
    ctx.fillRect(px - 8, py + 4, 16, 2);

    // Vara de pesca (canvas-drawn, fina e clara)
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const rodGrad = ctx.createLinearGradient(8, -hullH/2 - 2, 30, -hullH/2 - 42);
    rodGrad.addColorStop(0, '#4A2511');
    rodGrad.addColorStop(1, '#8B5A2B');
    ctx.strokeStyle = rodGrad;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8,  -hullH/2 - 2);
    ctx.lineTo(30, -hullH/2 - 42);
    ctx.stroke();

    // Ponta dourada da vara
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(30, -hullH/2 - 42, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// =================================================================
// BOLHAS
// =================================================================
function spawnBubble() {
    rt.bubbles.push({
        x: Math.random() * cw,
        y: ch,
        size: 3 + Math.random() * 6,
        speed: 28 + Math.random() * 50,
        wobble: Math.random() * Math.PI * 2,
        opacity: 0.25 + Math.random() * 0.4,
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
    const count = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
        const h = 80 + Math.random() * 180;
        rt.seaweed.push({
            x: Math.random() * cw,
            h,
            segs: 5 + Math.floor(Math.random() * 3),
            phase: Math.random() * Math.PI * 2,
            speed: 0.0008 + Math.random() * 0.0015,
            thick: 3 + Math.random() * 3,
            hue: 110 + Math.random() * 50,
        });
    }
}

function drawSeaweed(t) {
    const wy = waterY();
    const wh = waterHeight();
    const bottom = wy + wh;
    for (const alga of rt.seaweed) {
        const segH = alga.h / alga.segs;
        ctx.save();
        ctx.strokeStyle = `hsla(${alga.hue}, ${45 + Math.sin(alga.phase) * 15}%, ${18 + Math.sin(alga.phase * 0.7) * 8}%, 0.7)`;
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
                const valor = 150 + Math.floor(Math.random() * 350) * (1 + state.upgrades.bait * 0.05);
                state.money += valor;
                emitSparkles(c.x, c.y, '#ffd700', 25);
                rt.cameraShake = 5;
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
    document.getElementById('castButton').classList.add('fishing');
    addLog('🎣 Anzol lançado! Use WASD para mover.');
    // Splash inicial na superfície
    emitSplash(cw * 0.5, waterY() + 4);
    SFX.splash();
}

function endFishing() {
    rt.fishingActive = false;
    rt.cooldownEndTime = performance.now() + COOLDOWN_MS;
    rt.activeFish.length = 0;
    document.getElementById('castButton').classList.remove('fishing');
    document.getElementById('castProgress').style.width = '0%';
}

function catchFishInteractive(fish) {
    // Peixes chefões (lendários): múltiplos golpes necessários
    if (fish.bossHp > 0) {
        fish.bossHp--;
        const hp = hookPxPos();
        if (fish.bossHp > 0) {
            fish.vx *= 1.6;
            emitSparkles(hp.x, hp.y, '#ff0000', 25);
            rt.cameraShake = 10;
            addLog(`💢 ${fish.fish.name} se debate! ${fish.bossHp} golpe${fish.bossHp>1?'s':''} restante${fish.bossHp>1?'s':''}.`);
            return;
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
    const comboMult = 1 + (rt.combo - 1) * 0.2;

    let total = 0;
    for (let i = 0; i < count; i++) total += sellFish(fish.fish);
    total = Math.floor(total * comboMult);

    SFX.catch(fish.fish.rarity);
    if (rt.combo > 1) SFX.combo(rt.combo);
    showBigCatch(fish.fish, total, count);
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

    // Camera shake conforme raridade
    if (fish.fish.rarity === 'legendary') rt.cameraShake = 14;
    else if (fish.fish.rarity === 'epic') rt.cameraShake = 7;
    else if (count >= 3)                   rt.cameraShake = 4;
}

function tickFishing(now, delta) {
    if (!rt.fishingActive) return;

    if (rt.hookDescending) {
        rt.hookY += delta * 0.2;
        if (rt.hookY >= HOOK_INITIAL_DEPTH) {
            rt.hookY = HOOK_INITIAL_DEPTH;
            rt.hookDescending = false;
        }
    } else {
        if (rt.keyState.up)   rt.hookY = Math.max(2,  rt.hookY - delta * HOOK_SPEED);
        if (rt.keyState.down) rt.hookY = Math.min(98, rt.hookY + delta * HOOK_SPEED);
    }
    if (rt.keyState.left)  rt.hookX = Math.max(2,  rt.hookX - delta * HOOK_SPEED);
    if (rt.keyState.right) rt.hookX = Math.min(98, rt.hookX + delta * HOOK_SPEED);

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
    document.getElementById('castProgress').style.width = (progress * 100) + '%';

    if (now >= rt.sessionEndTime) endFishing();
}

function tickPassive(delta) {
    const rate = getPassiveRate();
    if (rate <= 0) return;
    rt.passiveAccumulator += (rate / 60000) * delta;
    while (rt.passiveAccumulator >= 1) {
        rt.passiveAccumulator -= 1;
        const f = rollFish(state.currentZone);
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
        const cost = calcCost(up, lvl);
        const can = state.money >= cost;
        r.level.textContent = `Lv ${lvl}${maxed ? ' MAX' : ''}`;
        r.cost.textContent  = maxed ? '—' : fmtMoney(cost);
        r.costLabel.textContent = maxed ? 'MÁXIMO' : 'COMPRAR';
        const shouldDisable = !can || maxed;
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
        btn.innerHTML = `
            <span class="zone-card-name">${zone.name}</span>
            <span class="zone-card-depth">${zone.minDepth}-${zone.maxDepth}m</span>
            <span class="zone-lock"></span>
        `;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isZoneUnlocked(zone.id) || rt.fishingActive) return;
            state.currentZone = zone.id;
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

function showBigCatch(fishType, totalValue, count) {
    const sc = document.getElementById('catchShowcase');
    const card = document.createElement('div');
    card.className = `big-catch-card rarity-${fishType.rarity}`;
    card.innerHTML = `
        <div class="fish-big">${fishType.emoji}</div>
        <div class="info">
            <div class="fish-name">${fishType.name}</div>
            <div class="fish-value">+${fmtMoney(totalValue)}</div>
        </div>
        ${count > 1 ? `<div class="fish-count-badge">×${count}</div>` : ''}
    `;
    sc.prepend(card);
    const dur = fishType.rarity === 'legendary' ? 4900 : 3300;
    setTimeout(() => card.remove(), dur);
    while (sc.children.length > 4) sc.lastChild.remove();
}

function addLog(text) {
    const log = document.getElementById('fishingLog');
    const li = document.createElement('li');
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 25) log.lastChild.remove();
}

function updateStats() {
    document.getElementById('money').textContent = fmtMoney(state.money);
    document.getElementById('totalFish').textContent = state.totalFish.toLocaleString('pt-BR');
    const rate = getPassiveRate();
    const pool = FISH.filter(f => f.zones.includes(state.currentZone));
    const tw = pool.reduce((s, f) => s + f.weight, 0);
    const avg = pool.reduce((s, f) => s + f.baseValue * f.weight, 0) / (tw || 1);
    document.getElementById('passiveIncome').textContent = fmtMoney(rate * avg * getValueMultiplier());
    document.getElementById('currentZone').textContent = ZONES[state.currentZone].name;
    document.getElementById('currentDepth').textContent = ZONES[state.currentZone].maxDepth;
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

function showAchievementToast(a) {
    const t = document.createElement('div');
    t.className = 'achievement-toast';
    t.innerHTML = `<span class="ach-icon">🏆</span><div><strong>${a.name}</strong><span>${a.desc}</span></div>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// =================================================================
// COMPÊNDIO DE ESPÉCIES
// =================================================================
function buildCompendium() {
    const grid = document.getElementById('compendiumGrid');
    if (!grid) return;
    grid.innerHTML = '';
    FISH.forEach((f, i) => {
        const caught = (state._speciesCaught || {})[f.name];
        const cell = document.createElement('div');
        cell.className = 'comp-cell';
        cell.dataset.index = i;
        cell.title = caught ? `${f.name} · ${f.rarity} · ${fmtMoney(f.baseValue)}` : '???';
        cell.innerHTML = `
            <span class="comp-emoji">${caught ? f.emoji : '❓'}</span>
            <span class="comp-rarity comp-rarity-${f.rarity}"></span>
            <span class="comp-name">${caught ? f.name : '???'}</span>
            ${caught ? `<span class="comp-value">${fmtMoney(f.baseValue)}</span>` : ''}
        `;
        grid.appendChild(cell);
    });
    const caught = Object.keys(state._speciesCaught || {}).length;
    const total = FISH.length;
    const counter = document.getElementById('compendiumCount');
    if (counter) counter.textContent = `${caught} / ${total} espécies`;
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
        if (!raw) raw = localStorage.getItem('angeloPescadorSave_v2');
        if (!raw) raw = localStorage.getItem('angeloPescadorSave_v1');
        if (!raw) return false;
        const s = JSON.parse(raw);
        state = { ...state, ...s, upgrades: { ...state.upgrades, ...(s.upgrades || {}) } };
        return true;
    } catch { return false; }
}

function resetGame() {
    if (!confirm('⚠️ Tem certeza? Todo progresso será perdido.')) return;
    ['v1','v2','v3'].forEach(v => localStorage.removeItem('angeloPescadorSave_' + v));
    state = {
        money: 0, totalFish: 0, currentZone: 0,
        upgrades: { rod: 0, bait: 0, motor: 0, hook: 0, net: 0, value: 0 },
        lastSave: Date.now(),
        achievements: {},
        _speciesCaught: {},
        _legendaryCaught: false,
    };
    updateUpgradeCards();
    updateZoneCards();
    updateStats();
    buildCompendium();
    addLog('🔄 Jogo reiniciado');
}

function showSaveToast() {
    const t = document.createElement('div');
    t.className = 'save-toast';
    t.textContent = '💾 Jogo salvo!';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
}

// =================================================================
// LOOP PRINCIPAL
// =================================================================
let lastFrame = performance.now();

function gameLoop(now) {
    const delta = Math.min(50, now - lastFrame);
    lastFrame = now;

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
    tickPassive(delta);
    updateFish(delta);
    updateBubbles(delta);
    updateParticles(delta);
    updateAmbient(delta);
    updateChests(delta);
    updateTrails(delta);

    if (now > rt.nextBubbleTime) {
        spawnBubble();
        rt.nextBubbleTime = now + 350 + Math.random() * 400;
    }

    if (now > rt.nextAmbientTime) {
        spawnAmbientParticle();
        rt.nextAmbientTime = now + 800 + Math.random() * 1200;
    }

    if (rt.cameraShake > 0) rt.cameraShake = Math.max(0, rt.cameraShake - delta * 0.04);

    // Render
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    if (rt.cameraShake > 0) {
        const sx = (Math.random() - 0.5) * rt.cameraShake;
        const sy = (Math.random() - 0.5) * rt.cameraShake;
        ctx.translate(sx, sy);
    }

    drawSky(rt.time);
    if (state.currentZone < 3) drawSun(rt.time);
    drawClouds(rt.time);
    drawWater(rt.time);
    drawCaustics(rt.time);
    drawTerrain(rt.time);

    // Peixes ordenados por tamanho (menores atrás, maiores na frente)
    rt.activeFish.sort((a, b) => a.fish.size - b.fish.size);
    for (const f of rt.activeFish) drawFish(f);

    drawTrails();
    drawDepthFog();
    drawChests(rt.time);
    drawSeaweed(rt.time);
    drawAmbient();
    drawBubbles();
    drawBoat(rt.time);

    if (rt.fishingActive || rt.hookY > 0) {
        updateRope();
        drawRope();
        drawHook(rt.time);
    }

    drawParticles();

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
    updateStats();
    updateUpgradeCards();
    checkAchievements();
}

function autoSave() { saveGame(); }

// =================================================================
// INPUT
// =================================================================
function setupInput() {
    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft')  rt.keyState.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') rt.keyState.right = true;
        if (e.code === 'KeyW' || e.code === 'ArrowUp')    { rt.keyState.up = true; e.preventDefault(); }
        if (e.code === 'KeyS' || e.code === 'ArrowDown')  { rt.keyState.down = true; e.preventDefault(); }
        if (e.code === 'Space') { e.preventDefault(); startFishing(); }
        if (e.code === 'KeyP') {
            rt.paused = !rt.paused;
            SFX.pause(rt.paused);
        }
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
            e.preventDefault();
            if (saveGame()) showSaveToast();
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
    loadGame();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    createUpgradeCards();
    createZoneCards();
    updateUpgradeCards();
    updateZoneCards();
    updateStats();

    document.getElementById('castButton').addEventListener('click', startFishing);
    document.getElementById('saveBtn').addEventListener('click', () => { if (saveGame()) showSaveToast(); });
    document.getElementById('resetBtn').addEventListener('click', resetGame);

    setupInput();
    setupTouch();
    initRope();
    initSeaweed();

    buildCompendium();

    setInterval(slowUpdate, 250);
    setInterval(autoSave, 15000);
    window.addEventListener('beforeunload', saveGame);

    addLog('🎣 Bem-vindo! Pressione ESPAÇO ou clique em LANÇAR ANZOL.');
    addLog('🎮 Use WASD/setas · P = pausar · Ctrl+S = salvar');

    requestAnimationFrame(gameLoop);
}

document.addEventListener('DOMContentLoaded', init);

// Service Worker para jogar offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

})();

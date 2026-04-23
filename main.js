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
const SESSION_BASE_MS     = 8000;
const SPAWN_BASE_MS       = 1100;
const HOOK_BASE_RADIUS    = 38;       // px
const HOOK_SPEED          = 0.055;    // % por ms (mais controlado, exige mira)
const HOOK_INITIAL_DEPTH  = 50;       // % da água
const ROPE_SEGMENTS       = 26;
const MAX_FISH_ON_SCREEN  = 18;
const COOLDOWN_MS         = 1000;

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
    { name: 'Peixe-Dragão',      emoji: '🐉', baseValue: 75000,  rarity: 'legendary', zones: [3],       weight: 2.5, speed: 1.6, size: 66 },
    { name: 'Tubarão-Fantasma',  emoji: '🦈', baseValue: 130000, rarity: 'legendary', zones: [3],       weight: 1.2, speed: 2.0, size: 72 },
    { name: 'Baleia Azul',       emoji: '🐋', baseValue: 320000, rarity: 'legendary', zones: [3],       weight: 0.3, speed: 0.7, size: 92 },
];

// =================================================================
// MELHORIAS — economia rebalanceada (curvas mais íngremes)
// =================================================================
const UPGRADES = [
    {
        id: 'rod', name: 'Vara Reforçada', icon: '🎣',
        desc: '+0.3s de duração por sessão de pesca',
        baseCost: 12, costMultiplier: 1.18, maxLevel: 25,
    },
    {
        id: 'bait', name: 'Isca Especial', icon: '🪱',
        desc: 'Peixes aparecem mais rápido e raros mais frequentes',
        baseCost: 75, costMultiplier: 1.20, maxLevel: 25,
    },
    {
        id: 'motor', name: 'Motor do Barco', icon: '⚙️',
        desc: 'Desbloqueia águas mais profundas',
        baseCost: 350, costMultiplier: 1.32, maxLevel: 14,
    },
    {
        id: 'hook', name: 'Anzol Largo', icon: '🪝',
        desc: '+12% área de captura · +5% chance de multi-captura',
        baseCost: 600, costMultiplier: 1.22, maxLevel: 20,
    },
    {
        id: 'net', name: 'Rede de Pesca', icon: '🕸️',
        desc: 'Pesca passiva: 0.4 peixe/min por nível',
        baseCost: 1000, costMultiplier: 1.25, maxLevel: 35,
    },
    {
        id: 'value', name: 'Mercado Premium', icon: '💰',
        desc: '+6% no valor de venda dos peixes',
        baseCost: 1800, costMultiplier: 1.24, maxLevel: 25,
    },
];

const RARITY_GLOW = {
    common:    null,
    uncommon:  'rgba(173, 216, 230, 0.45)',
    rare:      'rgba(78, 205, 196, 0.75)',
    epic:      'rgba(187, 134, 252, 0.9)',
    legendary: 'rgba(255, 179, 71, 1)',
};
const RARITY_SCORE = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

// =================================================================
// ESTADO PERSISTIDO + RUNTIME
// =================================================================
let state = {
    money: 0, totalFish: 0, currentZone: 0,
    upgrades: { rod: 0, bait: 0, motor: 0, hook: 0, net: 0, value: 0 },
    lastSave: Date.now(),
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
};

// =================================================================
// HELPERS DE ECONOMIA
// =================================================================
function calcCost(up, lvl) { return Math.floor(up.baseCost * Math.pow(up.costMultiplier, lvl)); }
function getSessionDuration() { return SESSION_BASE_MS + state.upgrades.rod * 300; }
function getSpawnInterval()  {
    const reduction = Math.pow(0.95, state.upgrades.bait);
    return Math.max(280, SPAWN_BASE_MS * reduction);
}
function getHookRadius()     { return HOOK_BASE_RADIUS * (1 + state.upgrades.hook * 0.12); }
function getMultiCatchChance() {
    return Math.min(0.55, 0.03 + state.upgrades.hook * 0.05 + state.upgrades.bait * 0.012);
}
function getMaxExtras()        { return 2 + Math.floor(state.upgrades.hook / 6); }
function getBaitRarityBonus()  { return Math.min(0.6, state.upgrades.bait * 0.04); }
function getValueMultiplier()  { return 1 + state.upgrades.value * 0.06; }
function getPassiveRate()      { return state.upgrades.net * 0.4; }
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
function drawSky() {
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
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const numRays = 7;
    for (let i = 0; i < numRays; i++) {
        const baseX = (i / numRays) * cw + Math.sin(t * 0.0008 + i * 1.3) * 60;
        const x1 = baseX;
        const y1 = wy;
        const x2 = baseX + Math.cos(t * 0.0005 + i * 1.7) * 40;
        const y2 = wy + 320;
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        const intensity = 0.10 - state.currentZone * 0.018;
        g.addColorStop(0, `rgba(255, 255, 220, ${Math.max(0, intensity)})`);
        g.addColorStop(1, 'rgba(255, 255, 220, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x1 - 12, y1);
        ctx.lineTo(x1 + 12, y1);
        ctx.lineTo(x2 + 32, y2);
        ctx.lineTo(x2 - 32, y2);
        ctx.closePath();
        ctx.fill();
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

    // Sombra de contato no fundo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, f.fish.size * 0.45, f.fish.size * 0.4, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow por raridade
    const glow = RARITY_GLOW[f.fish.rarity];
    if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = f.fish.rarity === 'legendary' ? 26 : (f.fish.rarity === 'epic' ? 18 : 12);
    } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
    }

    ctx.font = `${f.fish.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.fish.emoji, 0, 0);
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

    // Pescador (emoji)
    ctx.font = '46px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    ctx.fillText('🧑‍🦰', -16, -hullH/2 + 6);

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
}

function endFishing() {
    rt.fishingActive = false;
    rt.cooldownEndTime = performance.now() + COOLDOWN_MS;
    rt.activeFish.length = 0;
    document.getElementById('castButton').classList.remove('fishing');
    document.getElementById('castProgress').style.width = '0%';
}

function catchFishInteractive(fish) {
    const chance = getMultiCatchChance();
    let count = 1;
    const maxExtras = getMaxExtras();
    while (count <= maxExtras && Math.random() < chance) count++;
    let total = 0;
    for (let i = 0; i < count; i++) total += sellFish(fish.fish);
    showBigCatch(fish.fish, total, count);
    addLog(`${fish.fish.emoji} ${fish.fish.name} ×${count} (+${fmtMoney(total)})`);

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
            addLog(`🕸️ Rede: ${f.emoji} ${f.name} (+${fmtMoney(v)})`);
        }
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
            updateZoneCards();
            updateStats();
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
    };
    updateUpgradeCards();
    updateZoneCards();
    updateStats();
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
    rt.time += delta;

    tickFishing(now, delta);
    tickPassive(delta);
    updateFish(delta);
    updateBubbles(delta);
    updateParticles(delta);

    if (now > rt.nextBubbleTime) {
        spawnBubble();
        rt.nextBubbleTime = now + 350 + Math.random() * 400;
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

    drawSky();
    drawSun(rt.time);
    drawClouds(rt.time);
    drawWater(rt.time);
    drawCaustics(rt.time);

    // Peixes ordenados por tamanho (menores atrás, maiores na frente)
    rt.activeFish.sort((a, b) => a.fish.size - b.fish.size);
    for (const f of rt.activeFish) drawFish(f);

    drawDepthFog();
    drawBubbles();
    drawBoat(rt.time);

    if (rt.fishingActive || rt.hookY > 0) {
        updateRope();
        drawRope();
        drawHook(rt.time);
    }

    drawParticles();
    ctx.restore();

    requestAnimationFrame(gameLoop);
}

function slowUpdate() {
    updateStats();
    updateUpgradeCards();
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
    initRope();

    setInterval(slowUpdate, 250);
    setInterval(autoSave, 15000);
    window.addEventListener('beforeunload', saveGame);

    addLog('🎣 Bem-vindo! Pressione ESPAÇO ou clique em LANÇAR ANZOL.');
    addLog('🎮 Use WASD ou setas para mover o anzol nas 4 direções.');

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

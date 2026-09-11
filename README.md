# 🎣 Angelo Pescador — Idle Fishing

Jogo incremental de pesca em HTML5 Canvas, CSS3 e JavaScript puro. Controle o anzol em tempo real, descubra 25 espécies, desbloqueie 4 zonas oceânicas e evolua suas melhorias.

## 🕹️ Jogar online

Basta abrir `index.html` no navegador — nenhuma dependência, nenhum build.

Também funciona **offline** depois do primeiro acesso (PWA / Service Worker).

## 🎮 Controles

- **W A S D** ou **setas** → mover o anzol em 4 direções
- **ESPAÇO** ou botão **LANÇAR ANZOL** → iniciar a pescaria

## ✨ Destaques técnicos

- Renderização Canvas 2D com escala por `devicePixelRatio`
- Personagem e barco 100% vetoriais em canvas (sem sprites): cachos animados,
  piscada periódica, respiração e comemoração ao fisgar
- Cena em camadas com paralaxe: silhuetas de fundo, cardumes, terreno e vinheta
- Física de corda via integração de Verlet (26 segmentos)
- Sistema de partículas (splash + brilhos) + textos flutuantes de dinheiro
- Cáusticos de água com `globalCompositeOperation: 'screen'` + caminho de brilho do sol
- Pós-processamento em canvas 2D puro: refração da água (a cena submersa é
  recomposta em fatias deslocadas por senoides), bloom com threshold aproximado,
  profundidade de campo e color grading por zona
- Qualidade adaptativa: mede o tempo de frame e derruba os passes caros
  automaticamente em aparelho fraco (bloom primeiro, refração depois)
- Teto de resolução de render (1.6 Mpx / 1.25x em touch) — o custo dos passes é
  proporcional aos pixels
- Campo de estrelas pré-renderizado e `shadowBlur` restrito a épicos/lendários
  (custo de render controlado no tablet)
- UI em glassmorphism (backdrop-filter)
- Economia exponencial com rebalanceamento por raridade
- Save/load via `localStorage` + exportar/importar entre aparelhos
- PWA instalável com cache offline
- Áudio 100% sintetizado via Web Audio API (SFX + ambiente de ondas) com mute persistente
- Vibração háptica em capturas no mobile (`navigator.vibrate`)
- Wake Lock — tela não apaga durante a pescaria no celular
- Tela cheia no mobile (Fullscreen API)
- Acessibilidade: respeita `prefers-reduced-motion`

## 📁 Estrutura

```
index.html              → marcação + meta tags + manifest
style.css               → UI em glassmorphism
main.js                 → engine completa (IIFE)
icon.svg                → ícone PWA/favicon
manifest.webmanifest    → metadados PWA
sw.js                   → Service Worker (cache-first)
```

## 📜 Licença

MIT — divirta-se.

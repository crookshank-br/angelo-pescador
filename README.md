# 🎣 Angelo Pescador — Idle Fishing

Jogo incremental de pesca em HTML5 Canvas, CSS3 e JavaScript puro. Controle o anzol em tempo real, descubra 24 espécies, desbloqueie 4 zonas oceânicas e evolua suas melhorias.

## 🕹️ Jogar online

Basta abrir `index.html` no navegador — nenhuma dependência, nenhum build.

Também funciona **offline** depois do primeiro acesso (PWA / Service Worker).

## 🎮 Controles

- **W A S D** ou **setas** → mover o anzol em 4 direções
- **ESPAÇO** ou botão **LANÇAR ANZOL** → iniciar a pescaria

## ✨ Destaques técnicos

- Renderização Canvas 2D com escala por `devicePixelRatio`
- Física de corda via integração de Verlet (26 segmentos)
- Sistema de partículas (splash + brilhos)
- Cáusticos de água com `globalCompositeOperation: 'screen'`
- UI em glassmorphism (backdrop-filter)
- Economia exponencial com rebalanceamento por raridade
- Save/load via `localStorage`
- PWA instalável com cache offline

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

import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "react-qr-code";

// Lazy-load Tone.js to avoid blocking initial render
let Tone = null;
const getTone = async () => {
    if (!Tone) Tone = await import("tone");
    return Tone;
};

/*
Party Guess — the full party edition
- Selfie babies with dress-up props (bow, cap, shades, paci, dino spikes)
- Bib messages (rotating speech bubbles on the big screen)
- Baby crawl race that inches forward with every guess
- Bonus predictions (weight, date, anything) + baby-name suggestion cloud
- Dramatic countdown reveal: heartbeat sound, inflating balloon, pop, confetti
- Prize draw among correct guessers (slot-style so any crowd size works)
- Fun stats after the reveal + a Guest Book view + QR corner for latecomers
Data uses shared storage: everyone with the link sees the same board.
*/

const CONFIG_KEY = "partygame-config";
const GUESS_PREFIX = "partyguess:";
const OPTION_COLORS = ["#5BBFEF", "#FF85A2", "#FFC24D", "#9D7BFF"];
const POLL_MS = 4000;

const PROPS = [
    { id: "bow", label: "🎀 Bow" },
    { id: "cap", label: "🧢 Cap" },
    { id: "shades", label: "🕶️ Shades" },
    { id: "paci", label: "🍼 Paci" },
    { id: "dino", label: "🦖 Dino" },
];

const css = `
.pg-root {
  --bg: #FFFFFF; --bg-glow: #F8F9FF;
  --ink: #2D2D3A; --ink-dim: rgba(45,45,58,0.5);
  --card: #FFFFFF; --line: #E8E8F0;
  --gold: #FF85A2;
  --blue: #5BBFEF; --pink: #FF85A2;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink); font-family: 'Outfit', system-ui, sans-serif;
  display: flex; flex-direction: column; align-items: center;
  padding: 24px 16px 48px; box-sizing: border-box; position: relative;
}
.pg-root *, .pg-root *::before, .pg-root *::after { box-sizing: border-box; }
.pg-display { font-family: 'Bricolage Grotesque', 'Outfit', system-ui, sans-serif; }
.pg-wrap { width: 100%; max-width: 560px; }
.pg-wrap-wide { max-width: 1080px; }
.pg-eyebrow { letter-spacing:.22em; text-transform:uppercase; font-size:11px; color:var(--ink-dim); text-align:center; margin-bottom:8px; }
.pg-question { font-size: clamp(28px,6vw,54px); font-weight:800; line-height:1.05; text-align:center; margin:0 0 6px; background: linear-gradient(135deg, var(--blue), var(--pink)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.pg-sub { text-align:center; color:var(--ink-dim); font-size:14px; margin:0 0 24px; }
.pg-card { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
.pg-label { display:block; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-dim); margin:14px 0 6px; font-weight:600; }
.pg-input, .pg-textarea {
  width:100%; padding:13px 14px; border-radius:12px; border:2px solid var(--line);
  background:#F8F9FF; color:var(--ink); font-size:16px; font-family:inherit; outline:none;
  transition: border-color 0.2s;
}
.pg-textarea { min-height:74px; resize:vertical; }
.pg-input:focus, .pg-textarea:focus { border-color:var(--pink); box-shadow: 0 0 0 3px rgba(255,133,162,0.15); }
.pg-optbtn {
  width:100%; padding:18px; margin-top:10px; border-radius:16px; border:3px solid transparent;
  cursor:pointer; font-size:20px; font-weight:800; color:#FFF; font-family:inherit; transition:all .15s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.pg-optbtn:hover { transform:translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
.pg-optbtn:active { transform:scale(.97); }
.pg-optbtn[data-selected="true"] { border-color:#2D2D3A; box-shadow:0 0 0 3px rgba(45,45,58,.2), 0 4px 12px rgba(0,0,0,0.1); transform:scale(1.02); }
.pg-btn {
  width:100%; padding:16px; margin-top:18px; border-radius:16px; border:none;
  background: linear-gradient(135deg, var(--blue), var(--pink)); color:#FFF; font-size:18px; font-weight:800; cursor:pointer; font-family:inherit;
  box-shadow: 0 4px 16px rgba(91,191,239,0.3);
  transition: transform 0.15s, box-shadow 0.15s;
}
.pg-btn:hover { transform:translateY(-2px); box-shadow: 0 6px 24px rgba(91,191,239,0.4); }
.pg-btn:disabled { opacity:.4; cursor:default; transform:none; box-shadow:none; }
.pg-btn-ghost { background:transparent; border:2px solid var(--line); color:var(--ink-dim); font-weight:600; box-shadow:none; }
.pg-photo-btn {
  width:100%; padding:14px; margin-top:6px; border-radius:12px; border:2px dashed var(--line);
  background:#F8F9FF; color:var(--ink); font-size:15px; cursor:pointer; font-family:inherit;
  transition: border-color 0.2s;
}
.pg-photo-btn:hover { border-color: var(--pink); }
.pg-props { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
.pg-propchip {
  padding:8px 14px; border-radius:999px; border:2px solid var(--line); background:#F8F9FF;
  color:var(--ink); font-size:14px; cursor:pointer; font-family:inherit; font-weight:600;
  transition: all 0.15s;
}
.pg-propchip:hover { border-color: var(--pink); }
.pg-propchip[data-on="true"] { background: linear-gradient(135deg, var(--blue), var(--pink)); color:#FFF; font-weight:700; border-color:transparent; }
.pg-vsbar { display:flex; height:50px; border-radius:25px; overflow:hidden; border:2px solid var(--line); margin:20px 0 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.pg-vsseg {
  display:flex; align-items:center; justify-content:center; color:#FFF; font-weight:800; font-size:15px;
  transition:flex-grow .9s cubic-bezier(.2,.8,.2,1); min-width:0; overflow:hidden; white-space:nowrap;
}
.pg-race { margin:18px 0 6px; }
.pg-track { position:relative; height:64px; border-bottom:2px dashed var(--line); }
.pg-tracklabel { position:absolute; left:0; top:2px; font-size:13px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
.pg-crawler { position:absolute; bottom:4px; width:76px; transition:left 1s cubic-bezier(.2,.8,.2,1); animation: pgcrawlbounce 1.2s ease-in-out infinite; }
@keyframes pgcrawlbounce { 0%,100%{transform:translateY(0) rotate(0);} 30%{transform:translateY(-4px) rotate(2deg);} 60%{transform:translateY(0) rotate(-2deg);} }
.pg-finish { position:absolute; right:0; top:0; bottom:0; width:8px;
  background:repeating-linear-gradient(45deg, var(--pink) 0 6px, var(--blue) 6px 12px); opacity:.5; border-radius:3px; }
.pg-cols { display:grid; gap:14px; margin-top:18px; }
.pg-colcard { border-radius:20px; padding:16px 18px; background:var(--card); border:2px solid var(--line); box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
.pg-colcard[data-winner="true"] { border-color:var(--gold); box-shadow:0 0 24px rgba(255,133,162,.2); }
.pg-colhead { display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
.pg-colname { font-weight:800; font-size:20px; }
.pg-colpct { font-size:28px; font-weight:800; }
.pg-nursery { margin-top:12px; display:flex; flex-wrap:wrap; gap:10px; justify-content:center; }
.pg-baby { display:flex; flex-direction:column; align-items:center; width:var(--baby-w,86px); }
.pg-baby[data-dim="true"] { opacity:.35; filter:grayscale(.7); }
.pg-baby svg { width:100%; height:auto; display:block; }
.pg-babyname { margin-top:2px; font-size:12px; font-weight:700; color:var(--ink); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center; }
.pg-bibline { font-size:10.5px; color:var(--ink-dim); font-style:italic; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pg-baby[data-winner="true"] .pg-babyname { color:var(--pink); font-weight:800; }
@keyframes pgbob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
@keyframes pgwobble { 0%,100%{transform:rotate(0deg) translateY(0);} 25%{transform:rotate(5deg) translateY(-3px);} 50%{transform:rotate(0deg) translateY(0);} 75%{transform:rotate(-5deg) translateY(-3px);} }
@keyframes pgbreathe { 0%,100%{transform:scale(1) rotate(0deg);} 25%{transform:scale(1.06) rotate(2deg);} 50%{transform:scale(1) rotate(0deg);} 75%{transform:scale(1.06) rotate(-2deg);} }
.pg-baby[data-winner="true"] svg { animation:pgbob 0.8s ease-in-out infinite; }
.pg-baby[data-winner="false"][data-dim="false"] svg { animation:pgwobble 1.2s ease-in-out infinite; }
.pg-baby[data-winner="false"][data-dim="false"]:nth-child(odd) svg { animation:pgbreathe 1.4s ease-in-out infinite; }
.pg-baby[data-winner="false"][data-dim="false"]:nth-child(3n) svg { animation-delay: 0.2s; }
.pg-baby[data-winner="false"][data-dim="false"]:nth-child(even) svg { animation-delay: 0.4s; }
.pg-preview { display:flex; justify-content:center; margin-top:10px; }
.pg-bubble {
  max-width:520px; margin:14px auto 0; background:linear-gradient(135deg, #E8F4FD, #FFF0F5); color:var(--ink); border-radius:16px;
  padding:12px 16px; font-size:16px; position:relative; text-align:center; font-weight:600;
  border: 1px solid var(--line); box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}
.pg-bubble::after { content:""; position:absolute; bottom:-9px; left:50%; transform:translateX(-50%);
  border:10px solid transparent; border-top-color:#FFF0F5; border-bottom:0; }
.pg-qr { position:fixed; right:14px; bottom:14px; background:#FFF; padding:10px; border-radius:14px; text-align:center; z-index:5; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border: 1px solid var(--line); }
.pg-qr div { font-size:10px; color:var(--ink); margin-top:4px; font-weight:700; }
.pg-footer { margin-top:26px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.pg-link { background:none; border:none; color:var(--ink-dim); font-size:13px; cursor:pointer; text-decoration:underline; font-family:inherit; }
.pg-bignum { font-size:clamp(50px,11vw,120px); font-weight:800; line-height:1; text-align:center; }
.pg-live-dot { display:inline-block; width:10px; height:10px; border-radius:50%; background:#4ADE80; margin-right:6px; animation:pgpulse 1.6s infinite; box-shadow: 0 0 8px rgba(74,222,128,0.5); }
@keyframes pgpulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }

/* Playful white, sky-blue and pink redesign */
.pg-guest-page,
.pg-dashboard {
  background:
    radial-gradient(circle at 8% 8%, rgba(91,191,239,.20), transparent 25%),
    radial-gradient(circle at 92% 16%, rgba(255,133,162,.18), transparent 27%),
    linear-gradient(145deg, #f8fcff 0%, #ffffff 48%, #fff8fb 100%);
}
.pg-guest-page::before,
.pg-guest-page::after {
  content:""; position:fixed; border-radius:50%; pointer-events:none; z-index:0;
  animation:pgfloat 5s ease-in-out infinite;
}
.pg-guest-page::before { width:110px; height:110px; left:5vw; top:18vh; background:rgba(91,191,239,.16); }
.pg-guest-page::after { width:86px; height:86px; right:6vw; top:34vh; background:rgba(255,133,162,.17); animation-delay:-2s; }
@keyframes pgfloat { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-16px) rotate(8deg)} }
.pg-guest-shell { position:relative; z-index:1; max-width:680px; }
.pg-guest-kicker { display:flex; align-items:center; justify-content:center; gap:9px; margin-bottom:10px; color:#677083; font-size:12px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
.pg-guest-kicker::before,.pg-guest-kicker::after { content:""; width:34px; height:3px; border-radius:4px; }
.pg-guest-kicker::before { background:var(--blue); }
.pg-guest-kicker::after { background:var(--pink); }
.pg-guest-card { border:2px solid #edf0f7; border-top:6px solid transparent; border-image:linear-gradient(90deg,var(--blue),var(--pink)) 1; border-radius:26px; padding:26px; box-shadow:0 20px 55px rgba(72,87,120,.13); }
.pg-choice-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.pg-choice-grid .pg-optbtn { min-height:86px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; margin-top:0; }
.pg-choice-icon { font-size:27px; line-height:1; }
.pg-boy-choice { background:linear-gradient(135deg,#71caf3,#42ace0) !important; }
.pg-girl-choice { background:linear-gradient(135deg,#ff9ab2,#f5688d) !important; }
.pg-success-card { margin-top:26px; padding:30px; background:#fff; border:2px solid #dff4e8; border-radius:24px; box-shadow:0 18px 45px rgba(72,87,120,.12); text-align:center; color:#16875a; font-size:18px; font-weight:800; }

/* Compact, single-screen guest form */
html:has(.pg-guest-page), body:has(.pg-guest-page) { overflow:hidden; }
.pg-guest-page { height:100dvh; min-height:0; padding:10px 14px; justify-content:center; overflow:hidden; }
.pg-guest-shell { width:100%; max-width:900px; max-height:100%; display:flex; flex-direction:column; justify-content:center; }
.pg-guest-shell > .pg-question { font-size:clamp(30px,4.5vw,46px); margin-bottom:3px; }
.pg-guest-shell > .pg-sub { margin:0 0 10px; font-size:13px; }
.pg-guest-shell .pg-guest-kicker { margin-bottom:5px; font-size:10px; }
.pg-guest-card { display:grid; grid-template-columns:minmax(0,1.06fr) minmax(0,.94fr); gap:18px; padding:18px 20px; border-radius:22px; }
.pg-form-column { min-width:0; display:flex; flex-direction:column; justify-content:center; }
.pg-action-column { border-left:1px solid var(--line); padding-left:18px; }
.pg-field-group { min-width:0; }
.pg-guest-card .pg-label { margin:6px 0 3px; font-size:10px; line-height:1.2; }
.pg-guest-card .pg-label span { color:#8b94a6; font-size:9px; font-weight:700; letter-spacing:.05em; }
.pg-guest-card .pg-input { padding:9px 11px; border-radius:10px; font-size:14px; }
.pg-personalize-grid { display:grid; grid-template-columns:minmax(0,1fr) 118px; gap:10px; align-items:center; margin-top:3px; }
.pg-personalize-controls { min-width:0; }
.pg-guest-card .pg-photo-btn { padding:9px 10px; margin-top:0; border-radius:10px; font-size:13px; }
.pg-props-compact { gap:4px; margin-top:2px; }
.pg-props-compact .pg-propchip { padding:5px 7px; font-size:11px; border-width:1px; }
.pg-compact-preview { margin:0; min-height:145px; align-items:center; border:1px dashed var(--line); border-radius:16px; background:rgba(255,255,255,.25); padding:5px; }
.pg-optional-grid,.pg-bonus-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.pg-name-only { grid-template-columns:1fr; }
.pg-bonus-grid { margin-bottom:2px; }
.pg-guest-card .pg-choice-grid { gap:8px; }
.pg-guest-card .pg-optbtn { min-height:62px; padding:8px; border-radius:13px; font-size:16px; }
.pg-guest-card .pg-choice-icon { font-size:20px; }
.pg-submit-compact { margin-top:10px; padding:11px; border-radius:13px; font-size:16px; }
.pg-guest-card .pg-err { margin-top:5px; font-size:12px; }

@media (max-width:700px) {
  .pg-guest-page { padding:10px 12px; }
  .pg-guest-shell > .pg-question { font-size:34px; margin-bottom:4px; }
  .pg-guest-shell > .pg-sub { font-size:13px; margin-bottom:8px; }
  .pg-guest-shell .pg-guest-kicker { font-size:10px; margin-bottom:5px; }
  .pg-guest-card { grid-template-columns:1fr; gap:8px; padding:15px 16px; border-radius:20px; }
  .pg-action-column { border-left:0; border-top:1px solid var(--line); padding:7px 0 0; }
  .pg-personalize-grid { grid-template-columns:minmax(0,1fr) 120px; gap:10px; }
  .pg-compact-preview { min-height:135px; }
  .pg-compact-preview .pg-baby { --baby-w:104px !important; }
  .pg-props-compact .pg-propchip { padding:6px 8px; font-size:11px; }
  .pg-guest-card .pg-label { margin-top:6px; font-size:11px; }
  .pg-guest-card .pg-input,.pg-guest-card .pg-photo-btn { padding:10px 11px; font-size:14px; }
  .pg-guest-card .pg-optbtn { min-height:56px; flex-direction:row; padding:8px; font-size:16px; }
  .pg-guest-card .pg-choice-icon { font-size:20px; }
  .pg-submit-compact { margin-top:8px; padding:12px; font-size:16px; }
}
@media (max-height:680px) {
  .pg-guest-shell > .pg-sub { font-size:11px; margin-bottom:4px; }
  .pg-guest-shell .pg-guest-kicker { margin-bottom:2px; }
  .pg-guest-shell > .pg-question { font-size:29px; }
  .pg-guest-card { padding:11px 13px; gap:5px; }
  .pg-compact-preview { min-height:105px; }
  .pg-compact-preview .pg-baby { --baby-w:86px !important; }
  .pg-props-compact .pg-propchip { padding:4px 6px; font-size:10px; }
  .pg-guest-card .pg-input,.pg-guest-card .pg-photo-btn { padding:8px 9px; font-size:13px; }
  .pg-guest-card .pg-optbtn { min-height:48px; }
  .pg-submit-compact { padding:9px; }
}

.pg-dashboard { display:block; padding:0; min-height:100vh; overflow-x:hidden; }
.pg-side-panel { position:fixed; top:0; bottom:0; width:238px; padding:28px 18px; overflow-y:auto; z-index:3; }
.pg-side-left { left:0; background:linear-gradient(180deg,#eaf8ff 0%,#f8fcff 48%,#fff 100%); border-right:2px solid #d8effb; }
.pg-side-right { right:0; background:linear-gradient(180deg,#fff0f5 0%,#fff9fb 48%,#fff 100%); border-left:2px solid #f9dbe4; }
.pg-side-icon { width:54px; height:54px; border-radius:18px; display:grid; place-items:center; font-size:28px; margin-bottom:16px; box-shadow:0 9px 20px rgba(72,87,120,.12); }
.pg-side-left .pg-side-icon { background:#fff; color:var(--blue); }
.pg-side-right .pg-side-icon { background:#fff; color:var(--pink); }
.pg-side-title { margin:0; font-size:18px; font-weight:900; color:#30364a; }
.pg-side-copy { margin:5px 0 18px; color:#858da1; font-size:12px; line-height:1.45; }
.pg-side-list { display:flex; flex-direction:column; gap:9px; }
.pg-side-item { padding:10px 12px; background:rgba(255,255,255,.92); border:1px solid rgba(220,226,238,.95); border-radius:13px; box-shadow:0 5px 13px rgba(72,87,120,.07); color:#3a4054; font-size:14px; font-weight:800; }
.pg-guest-item { display:grid; grid-template-columns:10px 1fr auto; align-items:center; gap:9px; }
.pg-guest-dot { width:10px; height:10px; border-radius:50%; }
.pg-guest-pick { font-size:10px; color:#9299aa; text-transform:uppercase; letter-spacing:.08em; }
.pg-empty-state { padding:18px 12px; border:2px dashed rgba(145,157,182,.28); border-radius:15px; color:#98a0b2; font-size:13px; text-align:center; }
.pg-dashboard-main { margin:0 238px; padding:26px clamp(20px,3vw,48px) 50px; min-height:100vh; }
.pg-dashboard-hero { position:relative; overflow:hidden; display:grid; grid-template-columns:1fr auto; align-items:center; gap:24px; background:#fff; border:1px solid #e8edf6; border-radius:28px; padding:25px 28px; box-shadow:0 18px 45px rgba(72,87,120,.11); }
.pg-dashboard-hero::before { content:""; position:absolute; width:180px; height:180px; border-radius:50%; background:rgba(91,191,239,.13); left:-70px; top:-95px; }
.pg-dashboard-hero::after { content:""; position:absolute; width:150px; height:150px; border-radius:50%; background:rgba(255,133,162,.13); right:90px; bottom:-105px; }
.pg-hero-content { position:relative; z-index:1; }
.pg-hero-content .pg-question { text-align:left; font-size:clamp(34px,5vw,62px); margin-bottom:8px; }
.pg-hero-content .pg-sub { text-align:left; margin:0; font-size:15px; }
.pg-dashboard-tools { position:relative; z-index:2; display:flex; flex-direction:column; gap:8px; align-items:stretch; }
.pg-dashboard-qr { position:relative; z-index:2; background:#fff; border:3px solid #eef1f7; padding:10px; border-radius:20px; text-align:center; box-shadow:0 10px 24px rgba(72,87,120,.13); }
.pg-dashboard-qr span { display:block; margin-top:5px; color:#525a70; font-size:11px; font-weight:900; }
.pg-reset-btn { min-height:42px; padding:9px 12px; border:1px solid #D99CAF; border-radius:12px; background:linear-gradient(135deg,#E8BEC9,#DFA6B6); color:#583342; font-family:inherit; font-size:12px; font-weight:900; cursor:pointer; box-shadow:0 7px 16px rgba(89,50,65,.14); transition:transform .16s ease,box-shadow .16s ease,opacity .16s ease; }
.pg-reset-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 20px rgba(89,50,65,.20); }
.pg-reset-btn:active:not(:disabled) { transform:scale(.97); }
.pg-reset-btn:disabled { opacity:.48; cursor:not-allowed; box-shadow:none; }
.pg-sound-btn { min-height:42px; padding:9px 12px; border:1px solid #9CC9DD; border-radius:12px; background:linear-gradient(135deg,#BFE3F2,#9FD0E8); color:#245063; font-family:inherit; font-size:12px; font-weight:900; cursor:pointer; box-shadow:0 7px 16px rgba(36,80,99,.14); transition:transform .16s ease,box-shadow .16s ease; }
.pg-sound-btn[data-on="true"] { background:linear-gradient(135deg,#8FD3A6,#63BE86); border-color:#5FAE7E; color:#164E33; }
.pg-sound-btn:hover { transform:translateY(-2px); box-shadow:0 10px 20px rgba(36,80,99,.20); }
.pg-sound-btn:active { transform:scale(.97); }
.pg-reset-error { max-width:170px; color:#9C314F; font-size:10px; line-height:1.3; text-align:center; }
.pg-qr-url { display:block; max-width:150px; margin-top:4px; color:#657086; font-size:9px; line-height:1.25; overflow-wrap:anywhere; }
.pg-race-card { margin-top:18px; background:#fff; border:1px solid #e8edf6; border-radius:24px; padding:20px 22px 16px; box-shadow:0 13px 34px rgba(72,87,120,.08); }
.pg-section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:6px; }
.pg-section-heading h2 { margin:0; font-size:18px; color:#343a4e; }
.pg-section-heading span { color:#969daf; font-size:12px; font-weight:700; }
.pg-race-card .pg-track { border-bottom-color:#dfe5ef; }
.pg-dashboard .pg-cols { grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:20px; margin-top:22px; }
.pg-dashboard .pg-colcard { min-height:320px; padding:24px; border-width:3px; box-shadow:0 15px 34px rgba(72,87,120,.14); overflow:visible; }
.pg-dashboard .pg-colcard:nth-child(1) { background:linear-gradient(145deg,#ffffff 0%,#e4f7ff 100%); border-color:#87CEEB; }
.pg-dashboard .pg-colcard:nth-child(2) { background:linear-gradient(145deg,#ffffff 0%,#ffe8ef 100%); border-color:#FFC0CB; }
.pg-dashboard .pg-colcard:nth-child(1) .pg-colpct { color:#279fd8; }
.pg-dashboard .pg-colcard:nth-child(2) .pg-colpct { color:#eb5f84; }
.pg-dashboard .pg-colname { font-size:24px; }
.pg-dashboard .pg-colpct { font-size:36px; }
.pg-dashboard .pg-nursery { gap:22px; margin-top:22px; min-height:205px; align-items:flex-start; }
.pg-dashboard .pg-babyname { font-size:14px; margin-top:5px; }
.pg-dashboard .pg-bibline { font-size:12px; }
.pg-race-card { border-width:2px; border-color:#dfe9f5; box-shadow:0 16px 38px rgba(72,87,120,.12); }
.pg-dashboard-hero { border-width:2px; border-color:#e1e8f3; }

/* Low-glare pastel surface palette */
.pg-root {
  --bg:#D8E2EB;
  --bg-glow:#CDD9E4;
  --card:#E8EEF3;
  --line:#B7C6D4;
  --ink:#1F2C3D;
  --ink-dim:rgba(31,44,61,.65);
}
.pg-guest-page,
.pg-dashboard {
  background:
    radial-gradient(circle at 8% 8%, rgba(89,164,198,.34), transparent 30%),
    radial-gradient(circle at 92% 15%, rgba(211,130,151,.30), transparent 32%),
    linear-gradient(145deg,#CCDCE7 0%,#DCE4EA 48%,#E6D6DC 100%);
}
.pg-card,
.pg-dashboard-hero,
.pg-race-card { background:#E7EDF2; border-color:#B6C5D3; }
.pg-dashboard-qr { background:#DDE6ED; border-color:#B1C0CE; }
.pg-dashboard-qr svg { background:#FFFFFF; border-radius:8px; }
.pg-input,
.pg-textarea,
.pg-photo-btn,
.pg-propchip { background:#DDE6ED; border-color:#B5C4D1; }
.pg-side-left { background:linear-gradient(180deg,#BFDCE9 0%,#D1E2EA 55%,#D8E2EB 100%); border-right-color:#9CC9DD; }
.pg-side-right { background:linear-gradient(180deg,#E8BEC9 0%,#E5D0D7 55%,#DDDDE4 100%); border-left-color:#D99CAF; }
.pg-side-item,
.pg-side-left .pg-side-icon,
.pg-side-right .pg-side-icon { background:#E6EDF2; border-color:#B0C0CE; }
.pg-dashboard .pg-colcard:nth-child(1) { background:linear-gradient(145deg,#E7EDF2 0%,#BFDDEA 100%); border-color:#55ADD2; }
.pg-dashboard .pg-colcard:nth-child(2) { background:linear-gradient(145deg,#E8EBEF 0%,#E8BBC7 100%); border-color:#DC829B; }
.pg-bubble { background:linear-gradient(135deg,#BFDDEA,#E7BEC9); border-color:#AEBFCD; }
.pg-guest-card { background:#E7EDF2; box-shadow:0 20px 55px rgba(35,51,72,.22); }
.pg-dashboard-hero,
.pg-race-card,
.pg-dashboard .pg-colcard { box-shadow:0 14px 32px rgba(35,51,72,.18); }

/* Dashboard delight layer */
.pg-dashboard-hero { min-height:250px; background:linear-gradient(135deg,#DCECF4 0%,#E8EDF2 48%,#ECD8DF 100%); border-color:#AFC6D5; }
.pg-hero-decor { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; }
.pg-hero-decor span { position:absolute; display:grid; place-items:center; color:rgba(55,102,130,.25); font-size:28px; animation:pgdashfloat 4.5s ease-in-out infinite; }
.pg-hero-decor span:nth-child(1) { left:4%; top:15%; color:rgba(43,156,207,.35); }
.pg-hero-decor span:nth-child(2) { left:43%; bottom:13%; color:rgba(220,91,127,.32); animation-delay:-1.2s; }
.pg-hero-decor span:nth-child(3) { right:24%; top:16%; color:rgba(43,156,207,.26); animation-delay:-2.1s; }
.pg-hero-decor span:nth-child(4) { right:5%; bottom:8%; color:rgba(220,91,127,.28); animation-delay:-3s; }
@keyframes pgdashfloat { 0%,100%{transform:translateY(0) rotate(0) scale(1)} 50%{transform:translateY(-12px) rotate(12deg) scale(1.12)} }
.pg-hero-content { display:flex; flex-direction:column; align-items:center; text-align:center; width:100%; }
.pg-live-pill { display:inline-flex; align-items:center; gap:7px; width:max-content; padding:7px 11px; border-radius:999px; background:rgba(232,238,243,.82); border:1px solid rgba(143,168,184,.55); color:#526174; font-size:10px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
.pg-hero-content .pg-question { margin-top:12px; text-align:center; }
.pg-hero-content .pg-sub { text-align:center; }
.pg-hero-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; width:100%; max-width:760px; margin:20px auto 0; }
.pg-mini-stat { min-width:0; display:flex; align-items:center; gap:10px; padding:12px 13px; border-radius:17px; border:1px solid rgba(130,150,170,.42); box-shadow:0 8px 18px rgba(45,69,91,.10); backdrop-filter:blur(8px); transition:transform .18s ease,box-shadow .18s ease; }
.pg-mini-stat:hover { transform:translateY(-3px); box-shadow:0 12px 22px rgba(45,69,91,.16); }
.pg-mini-stat > span { font-size:24px; }
.pg-mini-stat div { min-width:0; display:flex; flex-direction:column; }
.pg-mini-stat b { color:#26384B; font-size:18px; line-height:1.05; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pg-mini-stat small { margin-top:3px; color:#6E7A8B; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
.pg-stat-guests { background:rgba(210,237,248,.74); }
.pg-stat-leading { background:rgba(238,220,227,.78); }
.pg-stat-names { background:rgba(226,232,239,.82); }
.pg-reveal-controls { display:flex; align-items:center; justify-content:center; flex-wrap:nowrap; gap:4px; width:auto; max-width:100%; margin:7px auto 0; padding:2px; border:0; border-radius:10px; background:transparent; box-shadow:none; white-space:nowrap; }
.pg-reveal-label { flex:0 0 auto; color:rgba(82,97,116,.58); font-size:8px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.pg-gender-picker { flex:0 0 auto; display:flex; gap:3px; }
.pg-gender-option,.pg-reveal-btn,.pg-reveal-done { min-height:32px; border:0; border-radius:9px; padding:5px 9px; font-family:inherit; font-size:10px; font-weight:800; cursor:pointer; transition:background .18s ease,color .18s ease,opacity .18s ease; }
.pg-gender-option { border:1px solid transparent; color:rgba(82,97,116,.72); background:transparent; }
.pg-gender-option span { margin-right:2px; }
.pg-gender-male[data-selected="true"] { color:#356F89; border-color:rgba(85,173,210,.25); background:rgba(191,227,242,.32); box-shadow:none; }
.pg-gender-female[data-selected="true"] { color:#895568; border-color:rgba(220,130,155,.25); background:rgba(242,205,215,.32); box-shadow:none; }
.pg-reveal-btn { color:#667586; border:1px solid rgba(130,150,170,.20); background:rgba(216,226,234,.45); box-shadow:none; }
.pg-gender-option:hover,.pg-reveal-btn:hover { color:#3F5266; background:rgba(207,219,228,.48); transform:none; }
.pg-reveal-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
.pg-reveal-celebration { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; overflow-y:auto; padding:max(20px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left)); background:rgba(28,42,58,.78); backdrop-filter:blur(13px); animation:pgrevealfade .45s ease both; }
.pg-reveal-celebration::before { content:""; position:fixed; inset:0; pointer-events:none; background:radial-gradient(circle at 50% 18%,rgba(255,255,255,.42),transparent 34%); }
.pg-reveal-male { background:linear-gradient(145deg,rgba(32,75,100,.88),rgba(76,155,191,.82)); }
.pg-reveal-female { background:linear-gradient(145deg,rgba(105,55,74,.88),rgba(205,113,141,.82)); }
.pg-reveal-card { position:relative; z-index:2; width:min(960px,100%); max-height:calc(100dvh - 40px); overflow-y:auto; padding:clamp(24px,4vw,44px); border:2px solid rgba(255,255,255,.72); border-radius:32px; text-align:center; color:#243447; background:linear-gradient(145deg,rgba(238,246,250,.97),rgba(247,230,236,.97)); box-shadow:0 30px 80px rgba(14,27,40,.38); animation:pgrevealpop .7s cubic-bezier(.18,.89,.32,1.28) both; }
.pg-reveal-close { position:absolute; top:13px; right:14px; width:42px; min-height:42px; border:0; border-radius:50%; color:#4D5B6C; background:rgba(185,200,211,.45); font-size:28px; line-height:1; cursor:pointer; }
.pg-reveal-icon { font-size:clamp(52px,8vw,82px); line-height:1; animation:pgrevealbounce 1.1s ease-in-out infinite; }
.pg-reveal-kicker { margin-top:10px; color:#667587; font-size:12px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; }
.pg-reveal-title { margin:4px 0 5px; color:#2B9CCF; font-size:clamp(48px,9vw,100px); line-height:.95; text-shadow:0 7px 20px rgba(43,156,207,.18); }
.pg-reveal-female .pg-reveal-title { color:#D45F82; text-shadow:0 7px 20px rgba(212,95,130,.2); }
.pg-reveal-copy { color:#536477; font-size:clamp(15px,2vw,20px); font-weight:800; }
.pg-correct-guesses { display:flex; align-items:flex-start; justify-content:center; flex-wrap:wrap; gap:16px; max-height:46vh; overflow-y:auto; margin:24px auto 8px; padding:10px; }
.pg-correct-guest { display:flex; justify-content:center; padding:12px 12px 9px; border:1px solid rgba(130,150,170,.32); border-radius:22px; background:rgba(255,255,255,.44); box-shadow:0 10px 22px rgba(44,66,84,.12); animation:pgwinnerin .55s cubic-bezier(.18,.89,.32,1.28) both; }
.pg-correct-guest:nth-child(2n) { animation-delay:.08s; }
.pg-correct-guest:nth-child(3n) { animation-delay:.16s; }
.pg-reveal-done { margin-top:18px; padding-inline:22px; color:#FFF; background:#344E64; box-shadow:0 8px 18px rgba(42,63,81,.23); }
.pg-reveal-celebration .pg-confetti { z-index:1; }
@keyframes pgrevealfade { from{opacity:0} to{opacity:1} }
@keyframes pgrevealpop { from{opacity:0;transform:translateY(30px) scale(.82)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes pgrevealbounce { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-10px) rotate(4deg)} }
@keyframes pgwinnerin { from{opacity:0;transform:translateY(22px) scale(.78)} to{opacity:1;transform:translateY(0) scale(1)} }
.pg-dashboard-tools { animation:pgtoolbob 3.2s ease-in-out infinite; }
@keyframes pgtoolbob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
.pg-race-card { background:linear-gradient(145deg,#E4EDF2,#EADFE4); border-color:#AFC2CF; }
.pg-race-card .pg-race { display:flex; flex-direction:column; gap:10px; margin-top:14px; }
.pg-race-card .pg-track { height:72px; margin:0; border:1px solid rgba(123,145,163,.35); border-radius:18px; background:rgba(232,238,243,.72); box-shadow:inset 0 2px 7px rgba(54,76,96,.08); }
.pg-track-progress { position:absolute; inset:0 auto 0 0; opacity:.16; border-radius:17px; transition:width .9s cubic-bezier(.2,.8,.2,1); }
.pg-tracklabel { z-index:2; left:14px; top:10px; font-size:12px; font-weight:900; }
.pg-track-score { position:absolute; z-index:2; right:24px; top:9px; font-size:14px; font-weight:950; }
.pg-race-card .pg-crawler { z-index:3; bottom:0; }
.pg-race-card .pg-finish { z-index:2; }
.pg-dashboard .pg-colcard { position:relative; overflow:hidden; transition:transform .2s ease,box-shadow .2s ease; }
.pg-dashboard .pg-colcard:hover { transform:translateY(-4px); box-shadow:0 20px 38px rgba(35,51,72,.24); }
.pg-team-accent { position:absolute; top:0; left:0; right:0; height:8px; opacity:.85; }
.pg-team-icon { display:inline-grid; place-items:center; width:34px; height:34px; margin-right:7px; border-radius:12px; background:rgba(255,255,255,.42); vertical-align:middle; box-shadow:0 5px 12px rgba(42,63,81,.10); }
.pg-team-meta { margin-top:3px; color:#657387; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
.pg-team-meter { height:10px; margin-top:13px; overflow:hidden; border-radius:999px; background:rgba(104,124,143,.18); box-shadow:inset 0 1px 3px rgba(44,62,78,.14); }
.pg-team-meter span { display:block; height:100%; min-width:3px; border-radius:inherit; transition:width .9s cubic-bezier(.2,.8,.2,1); }
.pg-team-empty { min-height:145px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#677588; text-align:center; }
.pg-team-empty > span { font-size:38px; filter:grayscale(.25); animation:pgemptybounce 1.8s ease-in-out infinite; }
.pg-team-empty b { margin-top:8px; color:#4A5B6E; font-size:14px; }
.pg-team-empty small { margin-top:3px; font-size:11px; }
@keyframes pgemptybounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-6px) scale(1.08)} }
.pg-side-panel { box-shadow:0 0 28px rgba(43,63,81,.12); }
.pg-side-left { border-top:7px solid #55ADD2; }
.pg-side-right { border-top:7px solid #DC829B; }
.pg-side-item { transition:transform .16s ease,box-shadow .16s ease; }
.pg-side-item:hover { transform:translateX(4px); box-shadow:0 9px 18px rgba(48,70,89,.15); }

@media (max-width:700px) {
  .pg-dashboard-hero { min-height:0; }
  .pg-hero-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .pg-mini-stat:last-child { grid-column:1/-1; }
  .pg-mini-stat { padding:10px; }
  .pg-reveal-controls { flex-direction:row; flex-wrap:nowrap; width:auto; max-width:100%; gap:3px; padding:2px; }
  .pg-reveal-label { font-size:7px; }
  .pg-gender-picker { flex:0 0 auto; width:auto; }
  .pg-gender-option { flex:0 0 auto; padding-inline:7px; }
  .pg-reveal-btn { flex:0 0 auto; width:auto; padding-inline:8px; }
  .pg-reveal-card { border-radius:24px; padding:26px 14px 22px; }
  .pg-correct-guesses { gap:10px; margin-top:16px; padding:5px; }
  .pg-correct-guest { padding:8px; }
  .pg-correct-guest .pg-baby { --baby-w:100px !important; }
  .pg-dashboard-tools { animation:none; }
}

@media (max-width:1100px) {
  .pg-side-panel { position:relative; width:auto; min-height:0; bottom:auto; }
  .pg-side-left,.pg-side-right { border:0; }
  .pg-dashboard { display:grid; grid-template-columns:1fr 1fr; }
  .pg-dashboard-main { grid-column:1/-1; grid-row:1; margin:0; padding:18px; }
  .pg-side-left { grid-column:1; grid-row:2; }
  .pg-side-right { grid-column:2; grid-row:2; }
}
@media (max-width:700px) {
  .pg-dashboard { display:block; }
  .pg-dashboard-hero { grid-template-columns:1fr; text-align:center; }
  .pg-hero-content .pg-question,.pg-hero-content .pg-sub { text-align:center; }
  .pg-dashboard-qr { width:max-content; margin:auto; }
  .pg-dashboard .pg-cols { grid-template-columns:1fr !important; }
  .pg-guest-card .pg-choice-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .pg-guest-card { padding:10px 12px; }
}
.pg-confetti { position:fixed; inset:0; pointer-events:none; overflow:hidden; z-index:4; }
.pg-cpiece { position:absolute; top:-20px; width:10px; height:16px; border-radius:2px; animation:pgfall linear infinite; }
@keyframes pgfall { 0%{transform:translateY(-5vh) rotate(0);opacity:1;} 100%{transform:translateY(110vh) rotate(720deg);opacity:.9;} }

@media (prefers-reduced-motion: reduce) {
  .pg-vsseg,.pg-crawler,.pg-balloon,.pg-track-progress,.pg-team-meter span { transition:none; }
  .pg-cpiece { display:none; }
  .pg-live-dot,.pg-hero-decor span,.pg-dashboard-tools,.pg-team-empty > span,
  .pg-reveal-celebration,.pg-reveal-card,.pg-reveal-icon,.pg-correct-guest { animation:none; }
  .pg-baby svg { animation:none !important; }
  .pg-crawler { animation:none; }
}

/* Application-wide responsive hardening */
html, body, #root { width:100%; max-width:100%; min-height:100%; overflow-x:hidden; }
body { background:#D8E2EB; }
.pg-root { width:100%; max-width:100%; overflow-x:clip; }
.pg-guest-page { touch-action:pan-x pan-y; overscroll-behavior:none; }
.pg-root img,.pg-root svg,.pg-root canvas { max-width:100%; }
.pg-root button,.pg-root input,.pg-root textarea,.pg-root select { max-width:100%; touch-action:manipulation; }
.pg-root button { min-height:44px; }
.pg-wrap { width:min(100%,560px); margin-inline:auto; }
.pg-dashboard-main,.pg-dashboard-hero,.pg-race-card,.pg-cols,.pg-colcard,.pg-side-panel { min-width:0; max-width:100%; }
.pg-track { overflow:hidden; }
.pg-crawler { max-width:72px; }
.pg-side-item { overflow-wrap:anywhere; }

@media (max-width:1200px) and (min-width:1025px) {
  .pg-side-panel { width:210px; padding:22px 14px; }
  .pg-dashboard-main { margin-inline:210px; padding:22px; }
  .pg-dashboard-hero { padding:22px; }
  .pg-dashboard .pg-baby { --baby-w:clamp(112px,12vw,145px) !important; }
}

@media (max-width:1024px) {
  .pg-dashboard { display:grid; grid-template-columns:1fr 1fr; align-items:start; }
  .pg-dashboard-main { order:1; grid-column:1/-1; grid-row:1; width:100%; margin:0; padding:18px; }
  .pg-side-panel { position:relative; inset:auto; width:100%; height:auto; max-height:none; padding:20px; }
  .pg-side-left { order:2; grid-column:1; grid-row:2; }
  .pg-side-right { order:3; grid-column:2; grid-row:2; }
  .pg-side-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .pg-dashboard .pg-baby { --baby-w:clamp(110px,18vw,145px) !important; }
}

@media (max-width:768px) {
  .pg-root { padding-inline:max(12px,env(safe-area-inset-left)) max(12px,env(safe-area-inset-right)); }
  .pg-dashboard { display:flex; flex-direction:column; width:100%; }
  .pg-dashboard-main { order:1; width:100%; padding:14px; }
  .pg-side-left { order:2; }
  .pg-side-right { order:3; }
  .pg-side-panel { width:100%; padding:18px 14px; border-inline:0; border-top:2px solid var(--line); }
  .pg-side-list { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .pg-dashboard-hero { grid-template-columns:minmax(0,1fr) auto; gap:14px; padding:18px; border-radius:22px; }
  .pg-hero-content .pg-question { font-size:clamp(30px,8vw,46px); }
  .pg-dashboard-qr { padding:8px; border-radius:16px; }
  .pg-dashboard-qr svg { width:112px; height:112px; }
  .pg-qr-url { max-width:120px; font-size:8px; }
  .pg-race-card { padding:16px; border-radius:20px; }
  .pg-dashboard .pg-cols { grid-template-columns:1fr !important; gap:14px; }
  .pg-dashboard .pg-colcard { min-height:250px; padding:18px; }
  .pg-dashboard .pg-nursery { min-height:160px; }
  .pg-dashboard .pg-baby { --baby-w:clamp(105px,30vw,140px) !important; }
  .pg-question { overflow-wrap:anywhere; }
  .pg-card { width:100%; }
  .pg-input,.pg-textarea { font-size:16px; }
}

@media (max-width:600px) {
  .pg-dashboard-main { padding:10px; }
  .pg-dashboard-hero { grid-template-columns:1fr; text-align:center; }
  .pg-hero-content .pg-question,.pg-hero-content .pg-sub { text-align:center; }
  .pg-dashboard-qr { width:max-content; max-width:100%; margin-inline:auto; }
  .pg-section-heading { align-items:flex-start; }
  .pg-section-heading span { max-width:48%; text-align:right; }
  .pg-side-list { grid-template-columns:1fr; }
  .pg-side-icon { width:46px; height:46px; font-size:24px; margin-bottom:10px; }
  .pg-side-copy { margin-bottom:12px; }
  .pg-dashboard .pg-colcard { min-height:220px; }
  .pg-dashboard .pg-colpct { font-size:30px; }
  .pg-dashboard .pg-colname { font-size:21px; }
}

@media (max-width:414px) {
  .pg-root { padding-left:max(9px,env(safe-area-inset-left)); padding-right:max(9px,env(safe-area-inset-right)); }
  .pg-dashboard-main { padding:8px; }
  .pg-dashboard-hero { padding:15px 13px; border-radius:19px; }
  .pg-dashboard-qr svg { width:98px; height:98px; }
  .pg-race-card { padding:14px 11px; }
  .pg-section-heading { flex-direction:column; gap:3px; }
  .pg-section-heading span { max-width:none; text-align:left; }
  .pg-track { height:58px; }
  .pg-crawler { width:58px; }
  .pg-tracklabel { font-size:11px; letter-spacing:.06em; }
  .pg-dashboard .pg-colcard { padding:15px; border-radius:18px; }
  .pg-dashboard .pg-nursery { gap:12px; min-height:140px; }
  .pg-dashboard .pg-baby { --baby-w:clamp(96px,34vw,126px) !important; }
  .pg-side-panel { padding:16px 12px; }
  .pg-guest-page { padding:8px 9px; }
  .pg-guest-card { width:100%; padding:13px; }
  .pg-personalize-grid { grid-template-columns:minmax(0,1fr) 112px; }
  .pg-optional-grid,.pg-bonus-grid { gap:6px; }
  .pg-props-compact { gap:4px; }
}

@media (max-width:390px) {
  .pg-guest-shell > .pg-question { font-size:31px; }
  .pg-guest-card { padding:12px; gap:7px; }
  .pg-personalize-grid { grid-template-columns:minmax(0,1fr) 102px; }
  .pg-compact-preview .pg-baby { --baby-w:92px !important; }
  .pg-props-compact .pg-propchip { padding:5px 6px; font-size:10px; }
  .pg-guest-card .pg-optbtn { min-height:52px; }
  .pg-dashboard .pg-baby { --baby-w:clamp(92px,33vw,120px) !important; }
}

@media (max-width:375px) {
  .pg-guest-page { padding:6px 7px; }
  .pg-guest-shell .pg-guest-kicker { font-size:9px; }
  .pg-guest-shell > .pg-question { font-size:29px; }
  .pg-guest-shell > .pg-sub { font-size:11px; margin-bottom:5px; }
  .pg-guest-card { padding:10px; border-radius:17px; }
  .pg-personalize-grid { grid-template-columns:minmax(0,1fr) 92px; gap:6px; }
  .pg-compact-preview .pg-baby { --baby-w:82px !important; }
  .pg-guest-card .pg-input,.pg-guest-card .pg-photo-btn { padding:8px; font-size:13px; }
  .pg-guest-card .pg-label { font-size:10px; margin-top:4px; }
  .pg-guest-card .pg-optbtn { min-height:48px; font-size:14px; }
  .pg-submit-compact { padding:10px; font-size:14px; }
}

@media (max-width:320px) {
  .pg-root { padding-inline:5px; }
  .pg-guest-shell > .pg-question { font-size:26px; }
  .pg-guest-card { padding:8px; }
  .pg-personalize-grid { grid-template-columns:minmax(0,1fr) 78px; }
  .pg-compact-preview { min-height:92px; }
  .pg-compact-preview .pg-baby { --baby-w:70px !important; }
  .pg-props-compact .pg-propchip { padding:4px; font-size:9px; }
  .pg-optional-grid,.pg-bonus-grid { gap:4px; }
  .pg-guest-card .pg-input { padding:7px 6px; font-size:12px; }
  .pg-dashboard-main { padding:5px; }
  .pg-dashboard-hero,.pg-race-card,.pg-dashboard .pg-colcard { border-radius:15px; }
  .pg-dashboard .pg-baby { --baby-w:94px !important; }
}

@media (orientation:landscape) and (max-height:600px) {
  html:has(.pg-guest-page),body:has(.pg-guest-page) { overflow-y:auto; }
  .pg-guest-page { height:auto; min-height:100dvh; overflow:visible; padding-block:8px; }
  .pg-guest-shell { max-height:none; }
  .pg-guest-shell > .pg-sub { display:none; }
  .pg-guest-card { grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:12px; padding:10px 14px; }
  .pg-action-column { border-top:0; border-left:1px solid var(--line); padding:0 0 0 12px; }
  .pg-personalize-grid { grid-template-columns:minmax(0,1fr) 88px; }
  .pg-compact-preview { min-height:96px; }
  .pg-compact-preview .pg-baby { --baby-w:76px !important; }
  .pg-dashboard { display:block; }
  .pg-dashboard-main,.pg-side-panel { width:100%; margin:0; position:relative; }
}

@media (max-width:768px) {
  .pg-guest-card input,
  .pg-guest-card textarea,
  .pg-guest-card select { font-size:16px !important; }
}

.pg-err { color:#EF4444; font-size:14px; margin-top:10px; text-align:center; font-weight:600; }
.pg-ok { color:#10B981; font-size:14px; margin-top:10px; text-align:center; font-weight:600; }
`;

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function safeGet(key, shared) {
    try {
        const r = await window.storage.get(key, shared);
        return r ? JSON.parse(r.value) : null;
    } catch {
        return null;
    }
}

function compressPhoto(file, size = 160) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("read failed"));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("decode failed"));
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d");
                const side = Math.min(img.width, img.height);
                const sx = (img.width - side) / 2;
                const sy = Math.max(0, (img.height - side) / 2 - side * 0.08);
                ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
                resolve(canvas.toDataURL("image/jpeg", 0.72));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function initialsOf(name) {
    return (name || "")
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";
}

/* ---------------- Baby avatar with props ---------------- */
function Baby({ photo, name, color, winner, dim, width, props: worn = [], bib }) {
    const clipId = useRef("clip-" + uid());
    const has = (p) => worn.includes(p);
    return (
        <div className="pg-baby" data-winner={!!winner} data-dim={!!dim} style={{ "--baby-w": (width || 86) + "px" }}>
            <svg viewBox="0 0 120 158" role="img" aria-label={name + "'s baby avatar"}>
                {winner && (
                    <g>
                        <path d="M40 16 L48 3 L57 13 L66 1 L75 13 L84 3 L92 16 Z" fill="#FFD166" stroke="#B8860B" strokeWidth="1.5" />
                        <circle cx="48" cy="3" r="2.6" fill="#FFF6E9" />
                        <circle cx="66" cy="1" r="2.6" fill="#FFF6E9" />
                        <circle cx="84" cy="3" r="2.6" fill="#FFF6E9" />
                    </g>
                )}
                <rect x="14" y="72" width="34" height="16" rx="8" fill={color} transform="rotate(24 31 80)" />
                <rect x="72" y="72" width="34" height="16" rx="8" fill={color} transform="rotate(-24 89 80)" />
                <circle cx="20" cy="94" r="8" fill={color} stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
                <circle cx="100" cy="94" r="8" fill={color} stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
                <path d="M38 68 Q60 58 82 68 L86 112 Q60 126 34 112 Z" fill={color} />
                <rect x="41" y="112" width="15" height="26" rx="7.5" fill={color} />
                <rect x="64" y="112" width="15" height="26" rx="7.5" fill={color} />
                <ellipse cx="48" cy="142" rx="11" ry="7.5" fill={color} stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
                <ellipse cx="72" cy="142" rx="11" ry="7.5" fill={color} stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
                <circle cx="52" cy="118" r="2" fill="rgba(0,0,0,.28)" />
                <circle cx="60" cy="120" r="2" fill="rgba(0,0,0,.28)" />
                <circle cx="68" cy="118" r="2" fill="rgba(0,0,0,.28)" />
                <path d="M44 66 Q60 76 76 66 Q60 84 44 66 Z" fill="#FFF6E9" opacity=".9" />
                <defs>
                    <clipPath id={clipId.current}>
                        <circle cx="60" cy="42" r="27" />
                    </clipPath>
                </defs>
                <circle cx="60" cy="42" r="29" fill="#FFF6E9" />
                {photo ? (
                    <image href={photo} x="33" y="15" width="54" height="54" clipPath={"url(#" + clipId.current + ")"} preserveAspectRatio="xMidYMid slice" />
                ) : (
                    <g>
                        <circle cx="60" cy="42" r="27" fill={color} opacity=".35" />
                        <text x="60" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="#FFF6E9">{initialsOf(name)}</text>
                    </g>
                )}
                <circle cx="60" cy="42" r="28" fill="none" stroke={winner ? "#FFD166" : "rgba(0,0,0,.25)"} strokeWidth={winner ? 3 : 2} />
                {!has("cap") && !has("dino") && <path d="M60 13 q 6 -8 12 -2" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="2.5" strokeLinecap="round" />}
                {has("dino") && (
                    <g fill="#6BCB77" stroke="rgba(0,0,0,.2)" strokeWidth="1">
                        <path d="M40 22 L46 8 L52 19 Z" />
                        <path d="M52 17 L60 3 L68 17 Z" />
                        <path d="M68 19 L74 8 L80 22 Z" />
                    </g>
                )}
                {has("cap") && (
                    <g>
                        <path d="M33 38 A27 27 0 0 1 87 38 L87 34 L33 34 Z" fill="#3B3560" />
                        <path d="M33 36 A27 27 0 0 1 87 36 L86 26 A27 27 0 0 0 34 26 Z" fill="#3B3560" />
                        <rect x="60" y="30" width="34" height="8" rx="4" fill="#2A2547" />
                        <circle cx="60" cy="16" r="3.4" fill="#FFD166" />
                    </g>
                )}
                {has("bow") && (
                    <g transform="translate(41 17) rotate(-18)">
                        <path d="M0 0 L-13 -8 L-13 8 Z" fill="#FF5C8A" stroke="rgba(0,0,0,.2)" />
                        <path d="M0 0 L13 -8 L13 8 Z" fill="#FF5C8A" stroke="rgba(0,0,0,.2)" />
                        <circle cx="0" cy="0" r="4" fill="#FF8FB0" />
                    </g>
                )}
                {has("shades") && (
                    <g>
                        <rect x="39" y="33" width="18" height="12" rx="4" fill="#14102B" stroke="#FFF6E9" strokeWidth="1.2" />
                        <rect x="63" y="33" width="18" height="12" rx="4" fill="#14102B" stroke="#FFF6E9" strokeWidth="1.2" />
                        <path d="M57 38 L63 38" stroke="#FFF6E9" strokeWidth="1.6" />
                        <path d="M39 37 L34 34 M81 37 L86 34" stroke="#FFF6E9" strokeWidth="1.6" />
                    </g>
                )}
                {has("paci") && (
                    <g>
                        <circle cx="60" cy="60" r="7" fill="#FFD166" stroke="rgba(0,0,0,.25)" strokeWidth="1.4" />
                        <circle cx="60" cy="60" r="3" fill="#FFF6E9" />
                    </g>
                )}
            </svg>
            <div className="pg-babyname">{winner ? "🏆 " : ""}{name}</div>
            {bib && <div className="pg-bibline" title={bib}>"{bib}"</div>}
        </div>
    );
}

/* ---------------- Crawling racer baby ---------------- */
function Crawler({ color, letter }) {
    return (
        <svg viewBox="0 0 100 60">
            <ellipse cx="40" cy="40" rx="24" ry="14" fill={color} />
            <rect x="22" y="44" width="10" height="14" rx="5" fill={color} />
            <rect x="48" y="44" width="10" height="14" rx="5" fill={color} />
            <circle cx="72" cy="28" r="16" fill="#FFF6E9" />
            <circle cx="72" cy="28" r="16" fill={color} opacity=".3" />
            <text x="72" y="34" textAnchor="middle" fontSize="15" fontWeight="800" fill="#FFF6E9">{letter}</text>
            <circle cx="72" cy="28" r="16" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="2" />
            <path d="M72 10 q 5 -7 10 -2" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
    );
}

function Confetti() {
    const pieces = Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.2,
        dur: 2.6 + Math.random() * 2.4,
        color: OPTION_COLORS[i % OPTION_COLORS.length],
    }));
    return (
        <div className="pg-confetti" aria-hidden="true">
            {pieces.map((p, i) => (
                <div key={i} className="pg-cpiece" style={{
                    left: p.left + "%", background: p.color,
                    animationDuration: p.dur + "s", animationDelay: p.delay + "s",
                }} />
            ))}
        </div>
    );
}

/* ---------------- Prize draw (slot-style) ---------------- */
function PrizeDraw({ prize, candidates }) {
    const [shown, setShown] = useState(prize.winner);
    useEffect(() => {
        const age = Date.now() - prize.spunAt;
        if (age > 8000 || candidates.length < 2) { setShown(prize.winner); return; }
        let i = 0, delay = 60, stop = false;
        const tick = () => {
            if (stop) return;
            i += 1;
            setShown(candidates[i % candidates.length]);
            delay = Math.min(delay * 1.13, 480);
            if (delay >= 470) { setShown(prize.winner); return; }
            setTimeout(tick, delay);
        };
        tick();
        return () => { stop = true; };
    }, [prize.spunAt]);
    return (
        <div className="pg-draw">
            <div className="pg-eyebrow">🎁 Prize draw · correct guessers only</div>
            <div className="pg-drawname pg-display">{shown}</div>
        </div>
    );
}

/* ---------------- Main app ---------------- */
export default function PartyGuessLeaderboard() {
    const [phase, setPhase] = useState("loading");
    const [config, setConfig] = useState(null);
    const [guesses, setGuesses] = useState({});
    const [error, setError] = useState("");
    const [now, setNow] = useState(Date.now());

    // setup
    const [qText, setQText] = useState("");
    const [optText, setOptText] = useState("");
    const [bonusText, setBonusText] = useState("");
    const [pin, setPin] = useState("");

    // guest
    const [guestName, setGuestName] = useState("");
    const [choice, setChoice] = useState(null);
    const [photo, setPhoto] = useState(null);
    const [worn, setWorn] = useState([]);
    const [bib, setBib] = useState("");
    const [nameIdea, setNameIdea] = useState("");
    const [bonusAns, setBonusAns] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef(null);

    // board
    const [tab, setTab] = useState("live");
    const [bubbleIdx, setBubbleIdx] = useState(0);
    const [soundOn, setSoundOn] = useState(false);
    const [resettingGuesses, setResettingGuesses] = useState(false);
    const lastBeat = useRef(-1);

    // host
    const [hostOpen, setHostOpen] = useState(false);
    const [hostPin, setHostPin] = useState("");
    const [hostAuthed, setHostAuthed] = useState(false);
    const [pendingAnswer, setPendingAnswer] = useState(null);
    const [revealDismissed, setRevealDismissed] = useState(false);
    const [linkInput, setLinkInput] = useState("");
    const [lanHost, setLanHost] = useState(null);
    const knownKeys = useRef(new Set());

    const refresh = useCallback(async () => {
        const cfg = await safeGet(CONFIG_KEY, true);
        if (cfg) setConfig(cfg);
        try {
            const listed = await window.storage.list(GUESS_PREFIX, true);
            const keys = listed?.keys || [];
            const newKeys = keys.filter((k) => !knownKeys.current.has(k));
            for (const k of newKeys) {
                const g = await safeGet(k, true);
                if (g && g.name && g.choice != null) {
                    knownKeys.current.add(k);
                    setGuesses((prev) => ({ ...prev, [k]: g }));
                }
            }
            if (keys.length < knownKeys.current.size) {
                knownKeys.current = new Set(keys);
                setGuesses((prev) => {
                    const next = {};
                    for (const k of keys) if (prev[k]) next[k] = prev[k];
                    return next;
                });
            }
        } catch { /* no guesses yet */ }
        return cfg;
    }, []);

    useEffect(() => {
        (async () => {
            const cfg = await refresh();
            // Guests reach the guessing form via the QR link (/?guest=1).
            // Everything else (including the root URL) opens the dashboard.
            const isGuest = window.location.pathname === "/guest"
                || window.location.search.includes("guest")
                || window.location.hash.includes("guest");
            if (isGuest) {
                setPhase(cfg ? "guest" : "setup");
            } else if (cfg) {
                setPhase("board");
            } else {
                // No game configured yet — seed a default gender-reveal so the
                // dashboard opens immediately instead of the setup screen. The
                // host can still reconfigure via the reset control.
                const seeded = {
                    question: "Boy or girl?",
                    options: ["Boy", "Girl"],
                    bonusQs: ["Guess the birth weight", "Guess the due date"],
                    pin: "",
                    revealed: false, answer: null, revealAt: null, prize: null, partyLink: "",
                };
                try {
                    await window.storage.set(CONFIG_KEY, JSON.stringify(seeded), true);
                    setConfig(seeded);
                    setPhase("board");
                } catch {
                    setPhase("setup");
                }
            }
        })();
    }, [refresh]);

    // When testing on localhost, ask the server for its LAN IP so the guest
    // QR code points to an address phones can actually reach.
    useEffect(() => {
        const h = window.location.hostname;
        if (h !== "localhost" && h !== "127.0.0.1") return;
        fetch("/api/lan-ip")
            .then((r) => r.json())
            .then((d) => { if (d && d.ip) setLanHost(d.ip); })
            .catch(() => {});
    }, []);

    // Disable browser and touch zoom only on the guest guessing form.
    useEffect(() => {
        if (phase !== "guest") return;

        const viewport = document.querySelector('meta[name="viewport"]');
        const previousViewport = viewport?.getAttribute("content") || "";
        viewport?.setAttribute(
            "content",
            "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        );

        const preventKeyboardZoom = (event) => {
            if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) {
                event.preventDefault();
            }
        };
        const preventWheelZoom = (event) => {
            if (event.ctrlKey || event.metaKey) event.preventDefault();
        };
        const preventGestureZoom = (event) => event.preventDefault();

        window.addEventListener("keydown", preventKeyboardZoom);
        window.addEventListener("wheel", preventWheelZoom, { passive: false });
        document.addEventListener("gesturestart", preventGestureZoom, { passive: false });
        document.addEventListener("gesturechange", preventGestureZoom, { passive: false });

        return () => {
            viewport?.setAttribute("content", previousViewport);
            window.removeEventListener("keydown", preventKeyboardZoom);
            window.removeEventListener("wheel", preventWheelZoom);
            document.removeEventListener("gesturestart", preventGestureZoom);
            document.removeEventListener("gesturechange", preventGestureZoom);
        };
    }, [phase]);

    // Poll every few seconds AND listen for real-time WebSocket updates
    useEffect(() => {
        if (phase !== "board" && !(phase === "guest" && submitted)) return;
        const t = setInterval(refresh, POLL_MS);
        // Real-time: refresh immediately when any storage change arrives via WebSocket
        let unsub;
        if (window.storageSubscribe) {
            unsub = window.storageSubscribe(() => {
                refresh();
            });
        }
        return () => {
            clearInterval(t);
            if (unsub) unsub();
        };
    }, [phase, submitted, refresh]);

    // countdown clock + heartbeat
    const countingDown = config?.revealAt && !config.revealed && now < config.revealAt;
    useEffect(() => {
        if (!config?.revealAt || config.revealed) return;
        const t = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(t);
    }, [config?.revealAt, config?.revealed]);

    useEffect(() => {
        if (!countingDown || !soundOn) return;
        const secsLeft = Math.ceil((config.revealAt - now) / 1000);
        if (secsLeft !== lastBeat.current && secsLeft > 0) {
            lastBeat.current = secsLeft;
            (async () => {
                try {
                    const T = await getTone();
                    const synth = new T.MembraneSynth().toDestination();
                    synth.triggerAttackRelease("C1", "8n");
                    setTimeout(() => synth.dispose(), 600);
                } catch { }
            })();
        }
    }, [now, countingDown, soundOn, config?.revealAt]);

    const effectiveRevealed = !!config?.revealed || (!!config?.revealAt && now >= config.revealAt);
    const popPlayed = useRef(false);
    const revealSoundPlayed = useRef(false);
    useEffect(() => {
        if (effectiveRevealed && config?.revealAt && !popPlayed.current) {
            popPlayed.current = true;
            if (soundOn) {
                (async () => {
                    try {
                        const T = await getTone();
                        const noise = new T.NoiseSynth({ envelope: { attack: 0.001, decay: 0.4, sustain: 0 } }).toDestination();
                        noise.triggerAttackRelease("8n");
                        const m = new T.MembraneSynth().toDestination();
                        m.triggerAttackRelease("G2", "4n");
                        setTimeout(() => { noise.dispose(); m.dispose(); }, 1200);
                    } catch { }
                })();
            }
        }
    }, [effectiveRevealed, soundOn, config?.revealAt]);

    // rotating bib bubbles
    useEffect(() => {
        if (phase !== "board") return;
        const t = setInterval(() => setBubbleIdx((i) => i + 1), 5000);
        return () => clearInterval(t);
    }, [phase]);

    // QR code rendered as React component inline (no useEffect needed)

    /* ---------- actions ---------- */
    const createGame = async () => {
        setError("");
        const options = optText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
        const bonusQs = bonusText.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 4);
        if (!qText.trim()) return setError("Add a question first.");
        if (options.length < 2) return setError("Enter at least two options, separated by commas.");
        if (!pin.trim()) return setError("Set a host PIN so only you can reveal the answer.");
        const cfg = { question: qText.trim(), options, bonusQs, pin: pin.trim(), revealed: false, answer: null, revealAt: null, prize: null, partyLink: "" };
        try {
            await window.storage.set(CONFIG_KEY, JSON.stringify(cfg), true);
            setConfig(cfg); setPhase("guest");
        } catch { setError("Couldn't save the game. Try again."); }
    };

    const onPickPhoto = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setError("");
        try { setPhoto(await compressPhoto(file)); }
        catch { setError("Couldn't read that photo — try another one."); }
        e.target.value = "";
    };

    const toggleProp = (id) =>
        setWorn((w) => (w.includes(id) ? w.filter((x) => x !== id) : w.length >= 3 ? w : [...w, id]));

    const submitGuess = async () => {
        setError("");
        if (!guestName.trim()) return setError("Add your name so the board knows who guessed.");
        if (choice == null) return setError("Tap one of the options to pick your guess.");
        setSaving(true);
        try {
            const key = GUESS_PREFIX + uid();
            const g = {
                name: guestName.trim().slice(0, 24), choice, photo: photo || null,
                props: worn, bib: null,
                nameIdea: nameIdea.trim().slice(0, 20) || null,
                bonus: Object.fromEntries(Object.entries(bonusAns).map(([k, v]) => [k, String(v).trim().slice(0, 40)]).filter(([, v]) => v)),
                t: Date.now(),
            };
            await window.storage.set(key, JSON.stringify(g), true);
            knownKeys.current.add(key);
            setGuesses((prev) => ({ ...prev, [key]: g }));
            setSubmitted(true);
        } catch { setError("Couldn't save your guess — give it another try."); }
        setSaving(false);
    };

    const saveConfig = async (cfg) => {
        try { await window.storage.set(CONFIG_KEY, JSON.stringify(cfg), true); setConfig(cfg); return true; }
        catch { setError("Couldn't save. Try again."); return false; }
    };

    const tryHostLogin = () => {
        if (config && hostPin === config.pin) { setHostAuthed(true); setError(""); }
        else setError("That PIN doesn't match.");
    };

    const revealNow = async () => {
        if (pendingAnswer == null) return;
        // The click is a user gesture, so audio can start here even if the
        // sound toggle was never pressed. Reset so "Show again" replays it.
        revealSoundPlayed.current = false;
        playRevealFanfare(pendingAnswer);
        const saved = await saveConfig({ ...config, revealed: true, answer: pendingAnswer, revealAt: null });
        if (saved) setRevealDismissed(false);
    };
    const revealCountdown = () => pendingAnswer != null && saveConfig({ ...config, answer: pendingAnswer, revealAt: Date.now() + 10500 });

    const spinPrize = () => {
        const winners = list.filter((g) => g.choice === config.answer);
        if (!winners.length) return setError("No correct guessers to draw from!");
        const w = winners[Math.floor(Math.random() * winners.length)];
        saveConfig({ ...config, prize: { winner: w.name, spunAt: Date.now() } });
    };

    const savePartyLink = () => saveConfig({ ...config, partyLink: linkInput.trim() });

    const resetGuesses = async () => {
        if (!Object.keys(guesses).length) return;
        const confirmed = window.confirm("Clear all testing guesses? The game setup and QR code will be kept.");
        if (!confirmed) return;

        setResettingGuesses(true);
        setError("");
        try {
            const listed = await window.storage.list(GUESS_PREFIX, true);
            await Promise.all((listed?.keys || []).map((key) => window.storage.delete(key, true)));
            knownKeys.current = new Set();
            setGuesses({});
            setBubbleIdx(0);
        } catch {
            setError("Couldn't clear the guesses. Please try again.");
        } finally {
            setResettingGuesses(false);
        }
    };

    const resetGame = async () => {
        try {
            const listed = await window.storage.list(GUESS_PREFIX, true);
            for (const k of listed?.keys || []) { try { await window.storage.delete(k, true); } catch { } }
        } catch { }
        try { await window.storage.delete(CONFIG_KEY, true); } catch { }
        knownKeys.current = new Set(); popPlayed.current = false;
        setGuesses({}); setConfig(null); setSubmitted(false); setChoice(null); setPhoto(null);
        setWorn([]); setBib(""); setNameIdea(""); setBonusAns({});
        setHostAuthed(false); setHostOpen(false); setHostPin(""); setPendingAnswer(null);
        setQText(""); setOptText(""); setBonusText(""); setPin("");
        setPhase("setup");
    };

    const enableSound = async () => { try { const T = await getTone(); await T.start(); setSoundOn(true); } catch { } };

    // Upbeat looping party music for when the board is idle.
    const ambientRef = useRef(null);
    const toneRef = useRef(null);

    // Preload Tone.js up front so the "turn on sound" click can start audio
    // immediately, without an async import breaking the user-gesture unlock.
    useEffect(() => {
        getTone().then((T) => { toneRef.current = T; }).catch(() => {});
    }, []);

    const startAmbient = useCallback((T) => {
        if (ambientRef.current) return;
        // A gain bus so we can duck the music during the reveal without
        // affecting the fanfare (which plays straight to the destination).
        const bus = new T.Gain(1).toDestination();

        const kick = new T.MembraneSynth().connect(bus);
        kick.volume.value = -4;
        const bass = new T.Synth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.2 } }).connect(bus);
        bass.volume.value = -12;
        const lead = new T.PolySynth(T.Synth).connect(bus);
        lead.volume.value = -7;
        lead.set({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.25 } });

        const melody = ["E4", "G4", "A4", "G4", "E4", "C4", "D4", "E4", "G4", "A4", "C5", "A4", "G4", "E4", "D4", "G4"];
        const bassline = ["C2", null, "G2", null, "A2", null, "F2", null, "C2", null, "G2", null, "A2", null, "F2", "G2"];
        let step = 0;
        const loop = new T.Loop((time) => {
            const s = step % 16;
            if (s % 2 === 0) kick.triggerAttackRelease("C2", "16n", time);
            if (bassline[s]) bass.triggerAttackRelease(bassline[s], "8n", time);
            if (melody[s]) lead.triggerAttackRelease(melody[s], "16n", time);
            step++;
        }, "8n");

        T.Transport.bpm.value = 124;
        loop.start(0);
        T.Transport.start();
        ambientRef.current = { bus, kick, bass, lead, loop, T };
    }, []);

    const stopAmbient = useCallback(() => {
        const a = ambientRef.current;
        if (!a) return;
        try {
            a.loop.stop(); a.loop.dispose();
            a.kick.dispose(); a.bass.dispose(); a.lead.dispose(); a.bus.dispose();
            a.T.Transport.stop();
        } catch { }
        ambientRef.current = null;
    }, []);

    const toggleSound = useCallback(async () => {
        if (soundOn) { stopAmbient(); setSoundOn(false); return; }
        try {
            const T = toneRef.current || await getTone();
            toneRef.current = T;
            await T.start(); // resume the audio context on this user gesture
            // Instant confirmation blip so you know audio is unlocked.
            const blip = new T.Synth().toDestination();
            blip.volume.value = -6;
            blip.triggerAttackRelease("C5", "8n");
            setTimeout(() => blip.dispose(), 500);
            startAmbient(T);
            setSoundOn(true);
        } catch { }
    }, [soundOn, startAmbient, stopAmbient]);

    // Celebratory gender-reveal fanfare — boy in C major, girl a touch brighter
    // in D major — capped so it only plays once per reveal.
    const playRevealFanfare = useCallback(async (ans) => {
        if (revealSoundPlayed.current) return;
        revealSoundPlayed.current = true;
        try {
            const T = await getTone();
            await T.start();
            const t0 = T.now();
            const chord = new T.PolySynth(T.Synth).toDestination();
            chord.volume.value = -8;
            const melody = ans === 0
                ? ["C4", "E4", "G4", "C5"]
                : ["D4", "F#4", "A4", "D5"];
            melody.forEach((n, i) => chord.triggerAttackRelease(n, "8n", t0 + i * 0.15));
            const finalChord = ans === 0 ? ["C5", "E5", "G5"] : ["D5", "F#5", "A5"];
            chord.triggerAttackRelease(finalChord, "1n", t0 + 0.7);
            setTimeout(() => chord.dispose(), 3000);
        } catch { }
    }, []);

    /* ---------- derived ---------- */
    const list = Object.values(guesses).sort((a, b) => a.t - b.t);
    const total = list.length;
    const counts = (config?.options || []).map((_, i) => list.filter((g) => g.choice === i).length);
    const pct = counts.map((c) => (total ? Math.round((c / total) * 100) : 0));
    const answer = config?.answer;
    const showAnswer = effectiveRevealed && answer != null;
    const correctList = showAnswer ? list.filter((g) => g.choice === answer) : [];
    const correctPct = showAnswer && total ? Math.round((correctList.length / total) * 100) : 0;
    const bibs = list.filter((g) => g.bib);
    const nameIdeas = {};
    for (const g of list) if (g.nameIdea) nameIdeas[g.nameIdea] = (nameIdeas[g.nameIdea] || 0) + 1;

    const revealActive = showAnswer && !revealDismissed;

    // Play the fanfare on any dashboard that has sound enabled (e.g. the big
    // screen, or a reveal that arrives via the countdown/live sync). The host's
    // own Reveal click is handled directly in revealNow.
    useEffect(() => {
        if (showAnswer && soundOn) playRevealFanfare(answer);
        if (!showAnswer) revealSoundPlayed.current = false;
    }, [showAnswer, soundOn, answer, playRevealFanfare]);

    // Duck the background music while the reveal screen is up so the fanfare
    // stands out, then bring it back when the modal is dismissed.
    useEffect(() => {
        const a = ambientRef.current;
        if (!a) return;
        try { a.bus.gain.rampTo(revealActive ? 0.08 : 1, 0.4); } catch { }
    }, [revealActive]);

    // Stop the music if the component unmounts.
    useEffect(() => () => stopAmbient(), [stopAmbient]);

    /* ---------- screens ---------- */
    if (phase === "loading") {
        return (
            <div className="pg-root">
                <style>{css}</style>
                <div className="pg-wrap" style={{ textAlign: "center", marginTop: 80 }}>
                    <div className="pg-eyebrow">Party Guess</div>
                    <p className="pg-sub">Loading the board…</p>
                </div>
            </div>
        );
    }

    if (phase === "setup") {
        return (
            <div className="pg-root">
                <style>{css}</style>
                <div className="pg-wrap">
                    <div className="pg-eyebrow">Party Guess · Host setup</div>
                    <h1 className="pg-question pg-display">Set up the game</h1>
                    <p className="pg-sub">Guests scan a QR code, add a selfie, dress their baby, and guess. Names, photos, and messages are visible to everyone with the link.</p>
                    <div className="pg-card">
                        <label className="pg-label">The question</label>
                        <input className="pg-input" value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Boy or girl?" />
                        <label className="pg-label">Options (comma-separated, 2–4)</label>
                        <input className="pg-input" value={optText} onChange={(e) => setOptText(e.target.value)} placeholder="Boy, Girl" />
                        <label className="pg-label">Bonus predictions (optional, one per line)</label>
                        <textarea className="pg-textarea" value={bonusText} onChange={(e) => setBonusText(e.target.value)}
                            placeholder={"Guess the birth weight\nGuess the due date"} />
                        <label className="pg-label">Host PIN</label>
                        <input className="pg-input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="A short code only you know" />
                        {error && <div className="pg-err">{error}</div>}
                        <button className="pg-btn" onClick={createGame}>Open the game</button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === "guest") {
        const previewColor = choice != null ? OPTION_COLORS[choice % OPTION_COLORS.length] : "#C8D6E5";
        return (
            <div className="pg-root pg-guest-page">
                <style>{css}</style>
                <div className="pg-wrap pg-guest-shell">
                    <div className="pg-guest-kicker">Welcome to the baby party</div>
                    <h1 className="pg-question pg-display">{config.question}</h1>
                    <p className="pg-sub">Dress your little avatar, choose your team, and join the live board.</p>
                    {!submitted && (
                        <div className="pg-card pg-guest-card">
                            <section className="pg-form-column">
                                <div className="pg-field-group">
                                    <label className="pg-label">Your name</label>
                                    <input className="pg-input" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="e.g. Aunt Priya" />
                                </div>

                                <div className="pg-personalize-grid">
                                    <div className="pg-personalize-controls">
                                        <label className="pg-label">Selfie <span>optional</span></label>
                                        <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={onPickPhoto} />
                                        <button className="pg-photo-btn" onClick={() => fileRef.current && fileRef.current.click()}>
                                            {photo ? "📸 Change photo" : "📸 Add photo"}
                                        </button>
                                        <label className="pg-label">Dress baby <span>pick 3</span></label>
                                        <div className="pg-props pg-props-compact">
                                            {PROPS.map((p) => (
                                                <button key={p.id} className="pg-propchip" data-on={worn.includes(p.id)} onClick={() => toggleProp(p.id)}>{p.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pg-preview pg-compact-preview">
                                        <Baby photo={photo} name={guestName.trim() || "You"} color={previewColor} width={110} props={worn} bib={null} />
                                    </div>
                                </div>
                            </section>

                            <section className="pg-form-column pg-action-column">
                                <div className="pg-optional-grid pg-name-only">
                                    <div className="pg-field-group">
                                        <label className="pg-label">Baby name <span>optional</span></label>
                                        <input className="pg-input" value={nameIdea} onChange={(e) => setNameIdea(e.target.value)} maxLength={20} placeholder="e.g. Luca" />
                                    </div>
                                </div>

                                {(config.bonusQs || []).length > 0 && (
                                    <div className="pg-bonus-grid">
                                        {(config.bonusQs || []).map((q, i) => (
                                            <div className="pg-field-group" key={i}>
                                                <label className="pg-label">{q}</label>
                                                <input className="pg-input" value={bonusAns[i] || ""} onChange={(e) => setBonusAns({ ...bonusAns, [i]: e.target.value })} placeholder="Prediction" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <label className="pg-label">Choose your team</label>
                                <div className="pg-choice-grid">
                                    {config.options.map((opt, i) => (
                                        <button key={i}
                                            className={`pg-optbtn ${i === 0 ? "pg-boy-choice" : i === 1 ? "pg-girl-choice" : ""}`}
                                            data-selected={choice === i}
                                            style={i > 1 ? { background: OPTION_COLORS[i % OPTION_COLORS.length] } : undefined}
                                            onClick={() => setChoice(i)}>
                                            <span className="pg-choice-icon">{i === 0 ? "💙" : i === 1 ? "🎀" : "⭐"}</span>
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                                {error && <div className="pg-err">{error}</div>}
                                <button className="pg-btn pg-submit-compact" onClick={submitGuess} disabled={saving}>
                                    {saving ? "Joining…" : "🎉 Lock in my guess"}
                                </button>
                            </section>
                        </div>
                    )}
                    {submitted && (
                        <p className="pg-ok">You're on the board, {guestName.trim()}! Look for your baby on the big screen. 🎉</p>
                    )}
                </div>
            </div>
        );
    }

    /* ---------- big screen ---------- */
    const bubble = bibs.length ? bibs[bubbleIdx % bibs.length] : null;
    const configuredPartyLink = (config.partyLink || "").trim();
    const configuredLinkIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredPartyLink);
    // Prefer a configured public party link. Otherwise use the current origin,
    // but if the dashboard was opened on localhost, swap in the server's LAN IP
    // (fetched above) so the QR code is scannable by phones on the same Wi-Fi.
    const guestOrigin = (() => {
        const h = window.location.hostname;
        if ((h === "localhost" || h === "127.0.0.1") && lanHost) {
            const port = window.location.port ? `:${window.location.port}` : "";
            return `${window.location.protocol}//${lanHost}${port}`;
        }
        return window.location.origin;
    })();
    const guestUrl = configuredPartyLink && !configuredLinkIsLocal
        ? configuredPartyLink
        : `${guestOrigin}/?guest=1`;
    const leaderIndex = total > 0 ? counts.indexOf(Math.max(...counts)) : -1;
    const leadingTeam = leaderIndex >= 0 ? config.options[leaderIndex] : "Waiting";
    const nameIdeaCount = Object.keys(nameIdeas).length;

    return (
        <div className="pg-root pg-dashboard">
            <style>{css}</style>

            {showAnswer && !revealDismissed && (
                <div className={`pg-reveal-celebration pg-reveal-${answer === 0 ? "male" : "female"}`} role="dialog" aria-modal="true" aria-labelledby="pg-reveal-title">
                    <Confetti />
                    <div className="pg-reveal-card">
                        <button className="pg-reveal-close" onClick={() => setRevealDismissed(true)} aria-label="Close reveal">×</button>
                        <div className="pg-reveal-icon" aria-hidden="true">{answer === 0 ? "💙" : "🎀"}</div>
                        <div className="pg-reveal-kicker">The answer is…</div>
                        <h2 id="pg-reveal-title" className="pg-reveal-title pg-display">{config.options[answer]}!</h2>
                        <p className="pg-reveal-copy">
                            {correctList.length
                                ? `${correctList.length} guest${correctList.length === 1 ? " guessed" : "s guessed"} correctly!`
                                : "No correct guesses this time—but everyone joined the fun!"}
                        </p>
                        {correctList.length > 0 && (
                            <div className="pg-correct-guesses" aria-label="Correct guessers">
                                {correctList.map((guest, index) => (
                                    <div className="pg-correct-guest" key={`${guest.name}-${index}`}>
                                        <Baby
                                            photo={guest.photo}
                                            name={guest.name}
                                            props={guest.props || []}
                                            bib={null}
                                            color={OPTION_COLORS[answer % OPTION_COLORS.length]}
                                            winner={true}
                                            dim={false}
                                            width={118}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="pg-reveal-done" onClick={() => setRevealDismissed(true)}>Back to dashboard</button>
                    </div>
                </div>
            )}

            <aside className="pg-side-panel pg-side-left">
                <div className="pg-side-icon">🍼</div>
                <h2 className="pg-side-title">Baby name ideas</h2>
                <p className="pg-side-copy">Sweet suggestions from everyone at the party.</p>
                <div className="pg-side-list">
                    {Object.keys(nameIdeas).length === 0 ? (
                        <div className="pg-empty-state">Names will appear here after guests submit them.</div>
                    ) : Object.entries(nameIdeas).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                        <div className="pg-side-item" key={name}>
                            {name}{count > 1 ? ` ×${count}` : ""}
                        </div>
                    ))}
                </div>
            </aside>

            <main className="pg-dashboard-main">
                <section className="pg-dashboard-hero">
                    <div className="pg-hero-decor" aria-hidden="true">
                        <span>✦</span><span>♡</span><span>★</span><span>◌</span>
                    </div>
                    <div className="pg-hero-content">
                        <div className="pg-live-pill"><span className="pg-live-dot" />Live party board</div>
                        <h1 className="pg-question pg-display">{config.question}</h1>
                        <p className="pg-sub">
                            {total === 0 ? "Scan the code and start the party!" : "The guesses are rolling in—who will lead?"}
                        </p>
                        <div className="pg-hero-stats">
                            <div className="pg-mini-stat pg-stat-guests">
                                <span>🎉</span><div><b>{total}</b><small>Guests joined</small></div>
                            </div>
                            <div className="pg-mini-stat pg-stat-leading">
                                <span>{leaderIndex === 0 ? "💙" : leaderIndex === 1 ? "🎀" : "🏁"}</span>
                                <div><b>{leadingTeam}</b><small>Leading team</small></div>
                            </div>
                            <div className="pg-mini-stat pg-stat-names">
                                <span>🍼</span><div><b>{nameIdeaCount}</b><small>Name ideas</small></div>
                            </div>
                        </div>
                        <div className="pg-reveal-controls">
                            <span className="pg-reveal-label">Answer</span>
                            <div className="pg-gender-picker" role="group" aria-label="Select the gender to reveal">
                                <button
                                    className="pg-gender-option pg-gender-male"
                                    data-selected={pendingAnswer === 0}
                                    aria-pressed={pendingAnswer === 0}
                                    onClick={() => setPendingAnswer(0)}
                                >
                                    <span>💙</span> Male
                                </button>
                                <button
                                    className="pg-gender-option pg-gender-female"
                                    data-selected={pendingAnswer === 1}
                                    aria-pressed={pendingAnswer === 1}
                                    onClick={() => setPendingAnswer(1)}
                                >
                                    <span>🎀</span> Female
                                </button>
                            </div>
                            <button className="pg-reveal-btn" onClick={revealNow} disabled={pendingAnswer == null}>
                                ✨ {config.revealed && pendingAnswer === answer ? "Show again" : "Reveal"}
                            </button>
                        </div>
                    </div>
                    <div className="pg-dashboard-tools">
                        <div className="pg-dashboard-qr">
                            <QRCode key={guestUrl} value={guestUrl} size={132} bgColor="#FFFFFF" fgColor="#30364A" />
                            <span>SCAN TO MAKE A GUESS</span>
                            <small className="pg-qr-url">{guestUrl.replace(/^https?:\/\//, "")}</small>
                        </div>
                        <button
                            className="pg-sound-btn"
                            data-on={soundOn}
                            onClick={toggleSound}
                            title={soundOn ? "Turn party music off" : "Turn party music on"}
                        >
                            {soundOn ? "🔊 Sound on" : "🔈 Turn on sound"}
                        </button>
                        <button
                            className="pg-reset-btn"
                            onClick={resetGuesses}
                            disabled={resettingGuesses || total === 0}
                            title="Clear all testing guesses but keep the game setup"
                        >
                            {resettingGuesses ? "Clearing guesses…" : "↻ Reset test guesses"}
                        </button>
                        {error && <div className="pg-reset-error">{error}</div>}
                    </div>
                </section>

                <section className="pg-race-card">
                    <div className="pg-section-heading">
                        <h2>👶 Baby crawl race</h2>
                        <span>Every new guess moves a team forward</span>
                    </div>
                    <div className="pg-race">
                        {config.options.map((opt, i) => (
                            <div className={`pg-track pg-track-team-${i % 2}`} key={i}>
                                <div
                                    className="pg-track-progress"
                                    style={{ width: `${Math.max(pct[i], 3)}%`, background: OPTION_COLORS[i % OPTION_COLORS.length] }}
                                />
                                <span className="pg-tracklabel" style={{ color: OPTION_COLORS[i % OPTION_COLORS.length] }}>
                                    {i === 0 ? "💙 " : i === 1 ? "🎀 " : ""}{opt}
                                </span>
                                <span className="pg-track-score" style={{ color: OPTION_COLORS[i % OPTION_COLORS.length] }}>{pct[i]}%</span>
                                <div className="pg-finish" />
                                <div className="pg-crawler" style={{ left: `calc(${Math.min(pct[i], 88)}%)` }}>
                                    <Crawler color={OPTION_COLORS[i % OPTION_COLORS.length]} letter={opt[0]} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {bubble && <div className="pg-bubble">💬 {bubble.name}: “{bubble.bib}”</div>}
                </section>

                <Board config={config} counts={counts} pct={pct} total={total} list={list} revealed={false} answer={null} />
            </main>

            <aside className="pg-side-panel pg-side-right">
                <div className="pg-side-icon">🎉</div>
                <h2 className="pg-side-title">Party guests</h2>
                <p className="pg-side-copy">{total} guest{total === 1 ? "" : "s"} have locked in a guess.</p>
                <div className="pg-side-list">
                    {list.length === 0 ? (
                        <div className="pg-empty-state">Guest names will appear here in real time.</div>
                    ) : list.map((guest, index) => (
                        <div className="pg-side-item pg-guest-item" key={`${guest.name}-${index}`}>
                            <span className="pg-guest-dot" style={{ background: OPTION_COLORS[guest.choice % OPTION_COLORS.length] }} />
                            <span>{guest.name}</span>
                            <span className="pg-guest-pick">{config.options[guest.choice]}</span>
                        </div>
                    ))}
                </div>
            </aside>
        </div>
    );
}

function Board({ config, counts, pct, total, list, revealed, answer, compact }) {
    const babyWidth = compact ? 100 : 150;
    return (
        <>
            {compact && (
                <div className="pg-vsbar" aria-label="Live results">
                    {config.options.map((opt, i) => (
                        <div key={i} className="pg-vsseg"
                            style={{
                                flexGrow: total ? Math.max(counts[i], 0.0001) : 1, flexBasis: 0,
                                background: OPTION_COLORS[i % OPTION_COLORS.length],
                                opacity: revealed && answer !== i ? 0.35 : 1,
                            }}>
                            {pct[i] >= 12 ? `${opt} ${pct[i]}%` : ""}
                        </div>
                    ))}
                </div>
            )}
            <div className="pg-cols" style={{ gridTemplateColumns: compact ? "1fr" : `repeat(auto-fit, minmax(260px, 1fr))` }}>
                {config.options.map((opt, i) => {
                    const team = list.filter((g) => g.choice === i);
                    const isWinner = revealed && answer === i;
                    const isLoser = revealed && answer !== i;
                    return (
                        <div key={i} className="pg-colcard" data-winner={isWinner}>
                            <div className="pg-team-accent" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
                            <div className="pg-colhead">
                                <span className="pg-colname pg-display" style={{ color: OPTION_COLORS[i % OPTION_COLORS.length] }}>
                                    <span className="pg-team-icon">{i === 0 ? "💙" : i === 1 ? "🎀" : "⭐"}</span>
                                    {isWinner ? "🏆 " : ""}{opt}
                                </span>
                                <span className="pg-colpct">{pct[i]}%</span>
                            </div>
                            <div className="pg-team-meta">{counts[i]} guess{counts[i] === 1 ? "" : "es"}</div>
                            <div className="pg-team-meter" aria-label={`${opt} has ${pct[i]} percent`}>
                                <span style={{ width: `${pct[i]}%`, background: OPTION_COLORS[i % OPTION_COLORS.length] }} />
                            </div>
                            <div className="pg-nursery">
                                {team.length === 0 ? (
                                    <div className="pg-team-empty">
                                        <span>{i === 0 ? "💙" : i === 1 ? "🎀" : "⭐"}</span>
                                        <b>Waiting for a teammate</b>
                                        <small>Scan the QR code to join</small>
                                    </div>
                                ) : team.map((g, j) => (
                                    <Baby key={j} photo={g.photo} name={g.name} props={g.props || []} bib={g.bib}
                                        color={OPTION_COLORS[i % OPTION_COLORS.length]}
                                        winner={isWinner} dim={isLoser} width={babyWidth} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

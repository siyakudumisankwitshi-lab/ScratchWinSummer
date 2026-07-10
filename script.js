const $ = s => document.querySelector(s);
const safe = (s, fn) => { const el = $(s); if (el) fn(el); };
const $$ = s => [...document.querySelectorAll(s)];

const stateKey = 'vupScratchState_v5_paid_history';
const prizes = [
  'a Free OG Doughnut when you buy any Hot Drink at Krispy Kreme',
  '100MB data for 1 day',
  '10% off a partner deal',
  'a Free Coffee Upgrade',
  'a Bonus V-Up Reward'
];

const video = document.getElementById("bgVideo");
const soundBtn = document.getElementById("soundBtn");

soundBtn.addEventListener("click", () => {
    video.muted = !video.muted;

    soundBtn.textContent = video.muted
        ? "Sound-Off"
        : "Sound-On";
});

let state = loadState();
let current = { type: 'free', win: true, prize: prizes[0] };
let audioCtx = null;
let audioReady = false;
let soundOn = true;
let finished = false;
let scratchNoise = null;

let scratchingAudio = new Audio('assets/scratch.mp3');
scratchingAudio.loop = true;
scratchingAudio.preload = 'auto';

let buyToastTimer;

function showBuyMoreToast(cardsLeft) {
  const toast = $('#buyMoreToast');
  $('#buyMoreToastText').textContent =
    `${cardsLeft} of 5 cards still available to buy`;
  clearTimeout(buyToastTimer);
  toast.classList.remove('hidden');
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  buyToastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 350);
  }, 5000); 
}


function startScratchAudio() {
  if (!soundOn) return;

  try {
    scratchingAudio.currentTime = 0;
    scratchingAudio.play();
  } catch (err) {
    console.log(err);
  }
}

function stopScratchAudio() {
  try {
    scratchingAudio.pause();
    scratchingAudio.currentTime = 0;
  } catch (err) {
    console.log(err);
  }
}


function resetTime(now = new Date()) {
  const n = new Date(now);
  const r = new Date(n);
  r.setHours(12, 1, 0, 0);
  if (n >= r) r.setDate(r.getDate() + 1);
  return r.getTime();
}

function freshState() {
  return {
    freeUsed: 0,
    paidBought: 0,
    paidUsed: 0,
    vb: 10,
    nextReset: resetTime(),
    history: [],
    lastResult: null,
    freeOutcomes: ['win', 'lose', 'win']
  };
}

function resetGame() {
  clearInterval(window.cd);

  localStorage.removeItem(stateKey);

  state = freshState();
  saveState(state);

  current = {
    type: 'free',
    win: true,
    prize: prizes[0]
  };

  finished = false;

  renderHome();
  show('home');

  toast('Game reset');
}


function loadState() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(stateKey) || 'null'); } catch (_) {}
  let s = saved || freshState();
  if (Date.now() >= s.nextReset) {
    s = { ...freshState(), vb: s.vb ?? 10, history: s.history || [] };
  }
  if (!s.freeOutcomes) s.freeOutcomes = ['win', 'lose', 'win'];
  s.freeUsed = Math.max(0, Math.min(3, Number(s.freeUsed || 0)));
  s.paidBought = Math.max(0, Math.min(5, Number(s.paidBought || 0)));
  s.paidUsed = Math.max(0, Math.min(s.paidBought, Number(s.paidUsed || 0)));
  s.vb = Number.isFinite(Number(s.vb)) ? Number(s.vb) : 10;
  if (!Array.isArray(s.history)) s.history = [];
  if (typeof s.lastResult === 'undefined') s.lastResult = null;
  saveState(s);
  return s;
}

function saveState(s = state) {
  localStorage.setItem(stateKey, JSON.stringify(s));
}

function show(id) {
  const target = $('#' + id);
  if (!target) return;
  $$('.screen').forEach(x => x.classList.remove('active', 'noWin'));
  target.classList.add('active');
  fx('tap');
}

// function toast(t) {
//   $('#message').textContent = t;
//   $('#message').classList.add('show');
//   setTimeout(() => $('#message').classList.remove('show'), 2800);
// }

function toast(t) {
  // disabled
}

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioReady = true;
  soundOn = true;
  $('#soundBtn').textContent = 'Mute Sound';
  fx('success');
}

function toggleSound() {
  if (!audioReady) return initAudio();
  soundOn = !soundOn;
  $('#soundBtn').textContent = soundOn ? 'Sound Off' : 'Sound On';
  if (soundOn) fx('success');
}

function ensureAudioOnGesture() {
  if (!audioReady) initAudio();
}

document.addEventListener('pointerdown', ensureAudioOnGesture, { once: true });
document.addEventListener('touchstart', ensureAudioOnGesture, { once: true });

function tone(freq, dur = .09, type = 'sine', vol = .04, delay = 0) {
  if (!audioReady || !soundOn) return;
  const start = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(.0001, start + dur);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start(start);
  o.stop(start + dur);
}

function noiseBurst(dur = .08, vol = .035) {
  if (!audioReady || !soundOn) return;
  const sr = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, sr * dur, sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audioCtx.createBufferSource();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  filter.type = 'highpass';
  filter.frequency.value = 900;
  gain.gain.value = vol;
  src.buffer = buffer;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}

function fx(n) {
  if (n === 'tap') tone(360, .045, 'triangle', .025);
  // if (n === 'scratch') { noiseBurst(.06, .055); tone(95 + Math.random() * 70, .035, 'sawtooth', .012); navigator.vibrate?.(7); }
  if (n === 'scratch') {
  navigator.vibrate?.(7);
}
  if (n === 'win') { [420, 620, 840, 1060, 1280].forEach((f, i) => tone(f, .13, 'triangle', .06, i * .08)); setTimeout(() => noiseBurst(.22, .045), 180); navigator.vibrate?.([30, 40, 70, 30, 90]); }
  if (n === 'lose') { [320, 240, 170, 120].forEach((f, i) => tone(f, .18, 'sine', .045, i * .12)); navigator.vibrate?.([40, 30, 40]); }
  if (n === 'buy') { [520, 720, 920].forEach((f, i) => tone(f, .1, 'square', .035, i * .07)); }
  if (n === 'success') tone(720, .15, 'triangle', .05);
  if (n === 'error') tone(120, .2, 'sawtooth', .05);
}


function renderHome() {
  state = loadState();
const freeLeft = 3 - state.freeUsed;
 const paidReady = Math.max(0, state.paidBought - state.paidUsed);
  const paidRemainingToBuy = Math.max(0, 5 - state.paidBought);
const home = document.getElementById('home');
const cardSection = document.querySelector('.cardSection');

const isNoCardsScreen =
    freeLeft === 0 &&
    paidReady === 0 &&
    state.paidBought < 5;

home.classList.toggle('noCardsLayout', isNoCardsScreen);
cardSection.classList.toggle('noCardsLayout', isNoCardsScreen);
const subHeaderImage = document.getElementById('subHeaderImage');

if (paidReady > 0) {
    subHeaderImage.src = 'assets/NewCardHeader.webp';
} else if (freeLeft === 0) {
    subHeaderImage.src = 'assets/NoCardsLeft.webp';
} else {
    subHeaderImage.src = 'assets/SummerSubHeader2.webp';
}
  const video = document.getElementById('bgVideo');
const source = video.querySelector('source');

const targetVideo =
    freeLeft === 0
        ? 'assets/NoScratch.mp4'
        : 'assets/MoveVid4.mp4';

if (!source.src.includes(targetVideo)) {
    source.src = targetVideo;
    video.load();
    video.play().catch(() => {});
}
 
  const cards = $('#cardRow');
  cards.innerHTML = '';
  cards.classList.remove('singlePaid');

 const scratchBar = $('#scratchNowBar');
const buyBar = $('#buyBar');
const promoBanner = $('#promoBanner');

scratchBar.classList.add('hidden');
buyBar.classList.add('hidden');
promoBanner.classList.add('hidden');

// if (freeLeft === 0 && state.paidBought >= 3 && paidReady === 0) {
//     showUsedCardsScreen();
//     return;
// }

  if (freeLeft === 0 && state.paidBought >= 5 && paidReady === 0) {
    show('timer');
    startCountdown();
    return;
  }


if (paidReady > 0) {
  subHeaderImage.src = 'assets/NewCardHeader.webp';
    document.querySelector('.cardSection')
        .classList.add('paidLayout');
        home.classList.add('paidScreen');
    // $('#home').style.backgroundImage = "url('assets/bought.png')";
   $('#headline').innerHTML ='<img src="assets/CardAdded.png" class="newCardAddedImageblock"style="width:65%"/>';
    // $('#headline').textContent = 'YOU HAVE 1 NEW CARD!';
    $('#headline').style.display = 'block';
    document.querySelector('.subcopy').textContent = '';
    $('#statusBadge').classList.add('hidden');
    cards.classList.add('singlePaid');
    const d = document.createElement('button');
    d.className = 'miniCard paid pulse';
    d.onclick = selectPaid;

    cards.appendChild(d);

        $('#scratchNowBar').classList.remove('hidden');
        $('#scratchNowCopy').textContent = 'Guaranteed win'; 
        // $('#promoBanner').classList.remove('hidden');
        home.classList.add('paidScreen');
        const cardsLeftToBuy = 5 - state.paidBought;
        showBuyMoreToast(cardsLeftToBuy);
        // promoBanner.classList.remove('hidden');

        return;
    }
document.querySelector('.cardSection')
        .classList.remove('paidLayout');
        home.classList.remove('paidScreen');
  $('#statusBadge').classList.add('hidden');
  // $('#home').style.backgroundImage = `url('assets/${freeLeft === 3 ? 'home3' : freeLeft === 2 ? 'home2' : freeLeft === 1 ? 'home1' : 'nofree'}.png')`;
$('#headline').textContent = '';
document.querySelector('.subcopy').textContent = '';
 for (let i = 0; i < 3; i++) {
  const d = document.createElement('button');
  const used = i < state.freeUsed;

  d.className = used
    ? 'miniCard used'
    : 'miniCard available pulse';

  d.onclick = () => selectFree(i);
  cards.appendChild(d);
}

  const canBuy = freeLeft === 0 && state.paidBought < 5;
  $('#buyBar').classList.toggle('hidden', !canBuy);
  $('#buyCopy').textContent = canBuy
    ? `${paidRemainingToBuy} of 5 still left to buy today, buy 1 card for 1VB`
    : '5 available, buy 1 card for 1VB';

//     const ctaVisible =
//     !scratchBar.classList.contains('hidden') ||
//     !buyBar.classList.contains('hidden');

// promoBanner.classList.toggle('hidden', ctaVisible);
}

function selectPaid() {
  state = loadState();
  const paidLeft = state.paidBought - state.paidUsed;
  if (paidLeft <= 0) {
    fx('error');
    toast('You do not have a bought card ready. Buy 1 card for 1VB.');
    renderHome();
    return;
  }
  current = { type: 'paid', win: true, prize: prizes[Math.floor(Math.random() * prizes.length)] };
  openScratch();
}

function selectFree(i) {
  if (i < state.freeUsed) { fx('error'); toast('This card has already been used. Choose an available card.'); return; }
  if (i !== state.freeUsed) { fx('error'); toast('Please scratch the next available card.'); return; }

  const outcome = state.freeOutcomes[state.freeUsed] || (Math.random() < .5 ? 'win' : 'lose');
  current = {
    type: 'free',
    win: outcome === 'win',
    prize: prizes[Math.floor(Math.random() * prizes.length)]
  };
  openScratch();
}

function buyOne() {
  state = loadState();
  if (state.freeUsed < 3) { fx('error'); toast('Use your 3 free scratch cards first.'); return; }
  if (state.paidBought >= 5) { show('timer'); startCountdown(); return; }
//   if (state.paidBought >= 3) {
//     showUsedCardsScreen();
//     return;
// }
  if (state.vb < 1) { fx('error'); toast('You do not have enough VB to buy another scratch card.'); return; }

  state.vb -= 1;
  state.paidBought += 1;
  saveState();
  fx('buy');
  toast(`Card bought. ${5 - state.paidBought} of 5 paid cards still available to buy today.`);
  renderHome();
}

function openScratch() {
  finished = false;
  show('scratch');
  requestAnimationFrame(setupScratch);
}

function setupScratch() {
  const canvas = $('#scratchCanvas');
  const wrap = $('#scratchWrap');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rect = wrap.getBoundingClientRect();
  const scale = devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  $('#prizeLayer').innerHTML = current.win
  ? `
    <div>
      <img src="assets/Congrats.webp" class="scratchResultImage"/>
    </div>
  `
  : `
    <div class="lose">
      <img src="assets/Sorry.webp" class="scratchResultImage"/>
      <button>Continue</button>
    </div>
  `;

  // drawFoil(ctx, rect.width, rect.height);
  // drawScratchImage(ctx, rect.width, rect.height);
  // $('#progressPill').textContent = '0%';
  drawScratchImage(ctx, rect.width, rect.height, () => {
    $('#progressPill').textContent = '0%';
});

let scratching = false;
let last = null;
let lastSound = 0;
let scratchCount = 0;

  function pos(e) {
    const t = e.touches ? e.touches[0] : e;
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function drawScratchImage(ctx, w, h, callback) {
    const img = new Image();

    img.onload = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        if (callback) callback();
    };

    img.src = 'assets/ScratchCardSand2.png';
}

//   function drawScratchImage(ctx, w, h) {
//   ctx.globalCompositeOperation = 'source-over';

//   const img = new Image();

//   img.onload = () => {
//     ctx.drawImage(img, 0, 0, w, h);
//   };

//   img.src = 'assets/ScratchCard.png';
// }


  function scratch(e) {
    if (!scratching || finished) return;
    e.preventDefault();
    const p = pos(e);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 65 + Math.random() * 15;

    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
    ctx.fill();
    last = p;
    dust(p);

    scratchCount++;

    const pct = Math.min(
      100,
      Math.round((scratchCount / 300) * 100)
    );

    $('#progressPill').textContent = pct + '%';

    if (scratchCount > 300) {
      finishScratch(ctx, rect.width, rect.height);
    }

    // const now = performance.now();
    // if (now - lastSound > 42) { fx('scratch'); lastSound = now; }

    // const pct = Math.min(100, Math.round(revealed(ctx, canvas) * 100));
    // $('#progressPill').textContent = pct + '%';
    
    // if (pct > 52) finishScratch(ctx, rect.width, rect.height);
  }

  // canvas.onpointerdown = e => { scratching = true; last = pos(e); canvas.setPointerCapture?.(e.pointerId); scratch(e); };
  canvas.onpointerdown = e => {
  scratching = true;
  startScratchAudio();
  last = pos(e);
  canvas.setPointerCapture?.(e.pointerId);
  scratch(e);
};
  canvas.onpointermove = scratch;
  // canvas.onpointerup = () => { scratching = false; last = null; };
 canvas.onpointerup = () => {
  scratching = false;
  stopScratchAudio();
  last = null;
};
  // canvas.onpointercancel = () => { scratching = false; last = null; };
 canvas.onpointercancel = () => {
  scratching = false;
  stopScratchAudio();
  last = null;
};
  // canvas.ontouchstart = e => { scratching = true; last = pos(e); scratch(e); };
  canvas.ontouchstart = e => {
  scratching = true;
  last = pos(e);
  scratch(e);
};
  canvas.ontouchmove = scratch;
  // canvas.ontouchend = () => { scratching = false; last = null; };
canvas.ontouchend = () => {
  scratching = false;
  stopScratchAudio();
  last = null;
};
}

function drawFoil(ctx, w, h) {
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#fff4d6');
  g.addColorStop(.24, '#f2c467');
  g.addColorStop(.5, '#b40700');
  g.addColorStop(.72, '#ffe2a2');
  g.addColorStop(1, '#870700');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,.34)';
  ctx.lineWidth = 1;
  for (let y = 8; y < h; y += 16) {
    ctx.beginPath();
    for (let x = 0; x < w; x += 8) ctx.lineTo(x, y + Math.sin((x + y) / 18) * 5);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = 0; i < 420; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
}

// function revealed(ctx, canvas) {
//   const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
//   let clear = 0, total = 0;
//   for (let i = 3; i < d.length; i += 48) { total++; if (d[i] < 35) clear++; }
//   return clear / total;
// }

function revealed(ctx, canvas) {
  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  ).data;

  let transparent = 0;
  let total = 0;

  for (let i = 3; i < imageData.length; i += 4 * 32) {
    total++;

    if (imageData[i] < 128) {
      transparent++;
    }
  }

  return transparent / total;
}

// function finishScratch(ctx, w, h) {
//   if (finished) return;
//   finished = true;
//   ctx.clearRect(0, 0, w, h);
//   $('#progressPill').textContent = '100%';
//   setTimeout(resolveResult, 650);
// }
function finishScratch(ctx, w, h) {
  if (finished) return;

  stopScratchAudio();

  finished = true;
  ctx.clearRect(0, 0, w, h);
  $('#progressPill').textContent = '100%';
  setTimeout(resolveResult, 650);
}

function dust(p) {
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('i');
    el.className = 'particle';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.setProperty('--x', (Math.random() * 100 - 50) + 'px');
    el.style.setProperty('--y', (Math.random() * 90 - 45) + 'px');
    $('#dust').appendChild(el);
    setTimeout(() => el.remove(), 850);
  }
}

function resolveResult() {
  if (current.type === 'free') state.freeUsed += 1;
  else state.paidUsed += 1;

  const item = {
    date: new Date().toISOString(),
    type: current.type,
    result: current.win ? 'Win' : 'No Win',
    prize: current.win ? current.prize : 'No prize'
  };
  state.history.push(item);
  state.lastResult = item;
  saveState();

  $('#reveal').classList.toggle('noWin', !current.win);
  $('#resultImage').src = current.win
  ? 'assets/Congrats.webp'
  : 'assets/Sorry.webp';

$('#claimBtn').textContent = current.win
  ? 'Claim Prize'
  : 'Continue';
  show('reveal');
  current.win ? (fx('win'), confetti()) : fx('lose');
}

// function confetti() {
//   const c = $('#confetti');
//   c.innerHTML = '';
//   for (let i = 0; i < 110; i++) {
//     const e = document.createElement('i');
//     e.className = 'confettiPiece';
//     e.style.left = Math.random() * 100 + '%';
//     e.style.setProperty('--h', Math.random() * 360);
//     e.style.animationDelay = Math.random() * .55 + 's';
//     c.appendChild(e);
//     setTimeout(() => e.remove(), 2600);
//   }
// }

let fireworks;

function confetti() {

    const container = document.getElementById("fireworks");

    container.innerHTML = "";

fireworks = new Fireworks.default(container, {
    autoresize: true,

    opacity: 0.8,

    acceleration: 1.05,
    friction: 0.95,
    gravity: 1.1,

    particles: 150,
    explosion: 12,

    traceLength: 15,
    traceSpeed: 8,

    intensity: 4,

    delay: {
        min: 1,
        max: 5
    },

    brightness: {
        min: 50,
        max: 100
    },

    decay: {
        min: 0.01,
        max: 0.03
    },

    rocketsPoint: {
        min: 20,
        max: 80
    }
});

    fireworks.start();

    setTimeout(() => {
    fireworks.setOptions({
        intensity: 6,
        particles: 250,
        explosion: 25
    });
}, 5000);
}
function confirm() {
  show('confirm');
  $('#confirmHero').style.backgroundImage = `url('assets/${current.win ? 'winconfirm' : 'nowinconfirm'}.png')`;
  $('#confirmTitle').textContent = current.win ? 'Congratulations!' : 'Better luck next time.';
  $('#confirmCopy').textContent = current.win
    ? `You've won ${current.prize}. Your voucher code will be sent via SMS shortly.`
    : "You didn't win this time. You can still use another available free card or buy more after your free cards are used.";
  $('#upsellTitle').textContent = current.win ? 'Want to upsize?' : 'You might want to Upsize';

  const freeLeft = 3 - state.freeUsed;
  const paidLeft = state.paidBought - state.paidUsed;
  const buyLeft = 5 - state.paidBought;
  $('#remainingCopy').textContent = freeLeft > 0
    ? `${freeLeft} FREE scratch card${freeLeft > 1 ? 's' : ''} left`
    : paidLeft > 0
      ? `${paidLeft} of 5 bought scratch card${paidLeft > 1 ? 's' : ''} left`
      : buyLeft > 0
        ? `${buyLeft} of 5 paid cards still available to buy`
        : 'Come back tomorrow';
}

function nextStep() {
  state = loadState();
  const freeLeft = 3 - state.freeUsed;
  const paidLeft = state.paidBought - state.paidUsed;

  if (freeLeft > 0) {
    renderHome();
    show('home');
    return;
  }

  if (paidLeft > 0) {
    current = { type: 'paid', win: true, prize: prizes[Math.floor(Math.random() * prizes.length)] };
    openScratch();
    return;
  }

  if (state.paidBought < 5) {
    renderHome();
    show('home');
    toast('No free cards left. Buy 1 extra card for 1VB. Bought cards are guaranteed wins.');
    return;
  }

  // showUsedCardsScreen();

  show('timer');
  startCountdown();
}

function startCountdown() {
  clearInterval(window.cd);
  const tick = () => {
    state = loadState();
    const ms = Math.max(0, state.nextReset - Date.now());
    const h = String(Math.floor(ms / 36e5)).padStart(2, '0');
    const m = String(Math.floor(ms % 36e5 / 6e4)).padStart(2, '0');
    const s = String(Math.floor(ms % 6e4 / 1000)).padStart(2, '0');
    $('#countdown').textContent = `${h} : ${m} : ${s}`;
    if (ms <= 0) { renderHome(); show('home'); }
  };
  tick();
  window.cd = setInterval(tick, 1000);
}

$('#soundBtn').onclick = toggleSound;
$('#buyBar').onclick = buyOne;
$('#scratchNowBar').onclick = selectPaid;
$('#claimBtn').onclick = confirm;
$('#nextCardBtn').onclick = nextStep;
$('#backHome').onclick = () => { renderHome(); show('home'); };
$('#revealBack').onclick = confirm;
$('#confirmBack').onclick = nextStep;
$('#closeConfirm').onclick = nextStep;
function allCardsFinished() {
  state = loadState();
  return state.freeUsed >= 3 && state.paidBought >= 5 && state.paidUsed >= 5;
}

function goRewardsHome() {
  show('rewardsHome');
}

function showHistory() {
  state = loadState();
  const today = new Date().toDateString();
  const rows = state.history.filter(x => new Date(x.date).toDateString() === today);
  const list = $('#historyList');
  list.innerHTML = rows.length ? '' : '<div class="historyItem empty">No scratch results yet today.</div>';
  rows.forEach((x, idx) => {
    const item = document.createElement('div');
    item.className = 'historyItem ' + (x.result === 'Win' ? 'won' : 'lost');
    item.innerHTML = `<b>${idx + 1}. ${x.result}</b><span>${x.type === 'paid' ? 'Bought card' : 'Free card'}</span><p>${x.prize}</p>`;
    list.appendChild(item);
  });
  show('history');
}

// $('#timerBack').onclick = () => allCardsFinished() ? goRewardsHome() : (renderHome(), show('home'));
$('#timerBack').onclick = () => {
    renderHome();
    show('home');
};

$('#homeBack').onclick = () => allCardsFinished() ? goRewardsHome() : fx('tap');
$('#historyBtn').onclick = showHistory;
$('#historyBack').onclick = () => show('timer');
$('#rewardHomeHistory').onclick = showHistory;
$('#rewardsBack').onclick = () => show('timer');
$$('.icon.back').forEach(b => b.addEventListener('click', () => fx('tap')));


function boot() {
  try {
    renderHome();
  } catch (err) {
    console.error('Prototype boot issue:', err);

    localStorage.removeItem(stateKey);
    state = freshState();
    saveState();

    renderHome();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}


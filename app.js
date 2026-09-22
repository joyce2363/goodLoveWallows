const image = document.querySelector("#map-image");
const stage = document.querySelector("#stage");
const glowImages = document.querySelectorAll(".glow-image");
const glowAuras = document.querySelectorAll(".glow-aura");
const statusLabel = document.querySelector("#status-label");
const drumsAudio = document.querySelector("#drums-audio");
const bassAudio = document.querySelector("#bass-audio");
const vocalsAudio = document.querySelector("#vocals-audio");
let audioContext;
let analyser;
let frequencyData;
let audioSource;
let beatFrame;
let beatBaseline = 0;
let bassAnalyser;
let bassFrequencyData;
let bassAudioSource;
let bassBeatFrame;
let bassBeatBaseline = 0;

// One/two audio are toggled directly off keypresses, so they're decoded into
// in-memory buffers ahead of time and played via AudioBufferSourceNode.
// HTMLAudioElement.play() has to spin up the media pipeline on every call,
// which is slow enough on a 3-minute mp3 to feel like input lag.
const bufferTracks = {
  one:   { url: "1.mp3", boxIndex: 0, buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
  two:   { url: "2.mp3", boxIndex: 2, buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
  three: { url: "3.mp3", boxIndex: 3, buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
  four:  { url: "4.mp3", boxIndex: 5, buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
  five:  { url: "5.mp3", boxIndex: 9, buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
  six:   { url: "6.mp3", boxIndex: 7, buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
  seven: { url: "7.mp3", boxIndex: 8, buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
  eight: { url: "8.mp3", boxIndex: 11, buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
  nine:  { url: "9.mp3", boxIndex: 6,  buffer: null, source: null, offset: 0, startedAt: 0, playing: false },
};

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function loadBufferTrack(key) {
  const track = bufferTracks[key];
  fetch(track.url)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => getAudioContext().decodeAudioData(arrayBuffer))
    .then((buffer) => {
      track.buffer = buffer;
    })
    .catch(() => {
      statusLabel.textContent = `Failed to load ${track.url}`;
    });
}

function toggleBufferTrack(key, allowKey) {
  const track = bufferTracks[key];
  if (!track.buffer) {
    statusLabel.textContent = `Loading audio, press ${allowKey} again in a moment`;
    return;
  }

  const ctx = getAudioContext();
  ctx.resume();

  if (track.source) {
    track.source.onended = null;
    try {
      track.source.stop();
    } catch (e) {}
    track.source = null;
  }

  track.offset = 0;
  const source = ctx.createBufferSource();
  source.buffer = track.buffer;
  source.connect(ctx.destination);
  source.start(0, 0);

  source.onended = () => {
    if (track.source === source) {
      track.source = null;
      track.offset = 0;
      track.playing = false;
      if (track.boxIndex !== undefined) {
        turnOffGlow(track.boxIndex);
      }
    }
  };

  track.source = source;
  track.startedAt = ctx.currentTime;
  track.playing = true;
  if (track.boxIndex !== undefined) {
    setGlow(track.boxIndex, true);
  }
}

const imageSize = { width: 1487, height: 934 };
const boxes = [
  { // (0, 0) W
    minX: 199,
    minY: 604,
    maxX: 277,
    maxY: 656,
  },
  { // P
    minX: 676,
    minY: 345,
    maxX: 957,
    maxY: 601,
  },
  { // (0, 1) E
    minX: 287,
    minY: 604,
    maxX: 365,
    maxY: 656,
  },
  { // (0, 2) R
    minX: 377,
    minY: 604,
    maxX: 454,
    maxY: 655,
  },
  { // Y
    minX: 228,
    minY: 173,
    maxX: 478,
    maxY: 336,
  },
  { // S
    minX: 199,
    minY: 670,
    maxX: 276,
    maxY: 722,
  },
  { // C
    minX: 376,
    minY: 744,
    maxX: 453,
    maxY: 795,
  },
  { // F
    minX: 375,
    minY: 670,
    maxX: 453,
    maxY: 721,
  },
  { // C
    minX: 199,
    minY: 744,
    maxX: 276,
    maxY: 796,
  },
  { // D
    minX: 287,
    minY: 670,
    maxX: 366,
    maxY: 722,
  },
  { // J diamond
    minX: 560,
    minY: 349,
    maxX: 641,
    maxY: 609,
    points: [
      { x: 567, y: 371 },
      { x: 641, y: 349 },
      { x: 641, y: 609 },
      { x: 560, y: 607 },
    ],
  },
  { // C
    minX: 287,
    minY: 744,
    maxX: 366,
    maxY: 796,
  },
  { // K
    minX: 566,
    minY: 708,
    maxX: 628,
    maxY: 789,
    points: [
      { x: 568, y: 708 },
      { x: 625, y: 716 },
      { x: 628, y: 789 },
      { x: 566, y: 774 },
    ],
  },
];

function positionGlowBox() {
  const stageBounds = stage.getBoundingClientRect();
  const scale = Math.min(
    stageBounds.width / imageSize.width,
    stageBounds.height / imageSize.height,
  );
  const renderedWidth = imageSize.width * scale;
  const renderedHeight = imageSize.height * scale;
  const offsetX = (stageBounds.width - renderedWidth) / 2;
  const offsetY = (stageBounds.height - renderedHeight) / 2;
  boxes.forEach((box, index) => {
    const left = offsetX + box.minX * scale;
    const top = offsetY + box.minY * scale;
    const width = (box.maxX - box.minX) * scale;
    const height = (box.maxY - box.minY) * scale;
    const glowImage = glowImages[index];
    const glowAura = glowAuras[index];

    glowImage.style.setProperty("--clip-left", `${left}px`);
    glowImage.style.setProperty("--clip-top", `${top}px`);
    glowImage.style.setProperty("--clip-right", `${stageBounds.width - left - width}px`);
    glowImage.style.setProperty("--clip-bottom", `${stageBounds.height - top - height}px`);
    glowAura.style.left = `${left}px`;
    glowAura.style.top = `${top}px`;
    glowAura.style.width = `${width}px`;
    glowAura.style.height = `${height}px`;

    if (box.points) {
      const imagePolygon = box.points
        .map((point) => `${(offsetX + point.x * scale) / stageBounds.width * 100}% ${(offsetY + point.y * scale) / stageBounds.height * 100}%`)
        .join(", ");
      const boxPolygon = box.points
        .map((point) => `${(point.x - box.minX) / (box.maxX - box.minX) * 100}% ${(point.y - box.minY) / (box.maxY - box.minY) * 100}%`)
        .join(", ");
      glowImage.style.clipPath = `polygon(${imagePolygon})`;
      glowAura.style.clipPath = `polygon(${boxPolygon})`;
    }
  });
}

function setGlow(boxIndex, forceState) {
  const stateClass = `is-on-${boxIndex + 1}`;
  if (forceState !== undefined) {
    document.body.classList.toggle(stateClass, forceState);
  } else {
    document.body.classList.toggle(stateClass);
  }
  const activeBoxes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].filter((number) =>
    document.body.classList.contains(`is-on-${number}`),
  );

  if (activeBoxes.length) {
    statusLabel.textContent = `${activeBoxes.map((number) => ["W", "P", "E", "R", "Y", "S", "V", "F", "X", "D", "J", "C", "K"][number - 1]).join(" + ")} on`;
  } else {
    statusLabel.textContent = "Glow off";
  }
}

function toggleGlow(boxIndex) {
  setGlow(boxIndex);
}

function turnOffGlow(boxIndex) {
  setGlow(boxIndex, false);
}

drumsAudio.addEventListener("ended", () => {
  turnOffGlow(1);
  stopBeatVisualizer();
});

bassAudio.addEventListener("ended", () => {
  turnOffGlow(4);
  stopBassBeatVisualizer();
});

vocalsAudio.addEventListener("ended", () => {
  turnOffGlow(10);
});

function toggleDrums() {
  const ctx = getAudioContext();
  if (!analyser) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    audioSource = ctx.createMediaElementSource(drumsAudio);
    audioSource.connect(analyser);
    analyser.connect(ctx.destination);
  }

  if (drumsAudio.paused) {
    ctx.resume();
    drumsAudio.play().catch(() => {
      statusLabel.textContent = "Press P to allow drums";
    });
    startBeatVisualizer();
  } else {
    drumsAudio.pause();
    stopBeatVisualizer();
  }
}

function toggleBass() {
  const ctx = getAudioContext();
  if (!bassAnalyser) {
    bassAnalyser = ctx.createAnalyser();
    bassAnalyser.fftSize = 256;
    bassAnalyser.smoothingTimeConstant = 0.72;
    bassFrequencyData = new Uint8Array(bassAnalyser.frequencyBinCount);
    bassAudioSource = ctx.createMediaElementSource(bassAudio);
    bassAudioSource.connect(bassAnalyser);
    bassAnalyser.connect(ctx.destination);
  }

  if (bassAudio.paused) {
    ctx.resume();
    bassAudio.play().catch(() => {
      statusLabel.textContent = "Press Y to allow bass";
    });
    startBassBeatVisualizer();
  } else {
    bassAudio.pause();
    stopBassBeatVisualizer();
  }
}

function toggleVocals() {
  const ctx = getAudioContext();
  if (vocalsAudio.paused) {
    ctx.resume();
    vocalsAudio.play().catch(() => {
      statusLabel.textContent = "Press J to allow vocals";
    });
  } else {
    vocalsAudio.pause();
  }
}

function toggleOneAudio() {
  toggleBufferTrack("one", "W");
}

function toggleTwoAudio() {
  toggleBufferTrack("two", "E");
}

function toggleThreeAudio() {
  toggleBufferTrack("three", "R");
}

function toggleFourAudio() {
  toggleBufferTrack("four", "S");
}

function toggleFiveAudio() {
  toggleBufferTrack("five", "D");
}

function toggleSixAudio() {
  toggleBufferTrack("six", "F");
}

function toggleSevenAudio() {
  toggleBufferTrack("seven", "X");
}

function toggleEightAudio() {
  toggleBufferTrack("eight", "C");
}

function toggleNineAudio() {
  toggleBufferTrack("nine", "V");
}

function startBeatVisualizer() {
  if (!beatFrame) {
    beatFrame = requestAnimationFrame(updateBeatGlow);
  }
}

function stopBeatVisualizer() {
  if (beatFrame) {
    cancelAnimationFrame(beatFrame);
    beatFrame = undefined;
  }
  setBeatStyles(0);
}

function setBeatStyles(beat) {
  const brightness = 1.48 + beat * 1.35;
  const saturation = 1.4 + beat * 0.8;
  const shadow = 0.52 + beat * 0.4;
  const wideShadow = 0.3 + beat * 0.35;

  glowImages[1].style.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)}) contrast(1.08)`;
  glowAuras[1].style.transform = `scale(${(1 + beat * 0.12).toFixed(3)})`;
  glowAuras[1].style.boxShadow = `0 0 12px rgba(101, 246, 226, ${shadow.toFixed(3)}), 0 0 28px rgba(101, 246, 226, ${wideShadow.toFixed(3)})`;
}

function updateBeatGlow() {
  analyser.getByteFrequencyData(frequencyData);
  const lowFrequencyBins = frequencyData.slice(0, 12);
  const energy = lowFrequencyBins.reduce((sum, value) => sum + value, 0) /
    (lowFrequencyBins.length * 255);
  beatBaseline = beatBaseline * 0.94 + energy * 0.06;
  const beat = Math.min(1, Math.max(0, (energy - beatBaseline) * 5.5));

  setBeatStyles(beat);
  beatFrame = drumsAudio.paused ? undefined : requestAnimationFrame(updateBeatGlow);
}

function startBassBeatVisualizer() {
  if (!bassBeatFrame) {
    bassBeatFrame = requestAnimationFrame(updateBassGlow);
  }
}

function stopBassBeatVisualizer() {
  if (bassBeatFrame) {
    cancelAnimationFrame(bassBeatFrame);
    bassBeatFrame = undefined;
  }
  setBassBeatStyles(0);
}

function setBassBeatStyles(beat) {
  const brightness = 1.48 + beat * 1.5;
  const saturation = 1.4 + beat * 1.0;
  const shadow = 0.52 + beat * 0.5;
  const wideShadow = 0.3 + beat * 0.4;

  if (glowImages[4]) {
    glowImages[4].style.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)}) contrast(1.08)`;
  }
  if (glowAuras[4]) {
    glowAuras[4].style.transform = `scale(${(1 + beat * 0.14).toFixed(3)})`;
    glowAuras[4].style.boxShadow = `0 0 14px rgba(101, 246, 226, ${shadow.toFixed(3)}), 0 0 32px rgba(101, 246, 226, ${wideShadow.toFixed(3)})`;
  }
}

function updateBassGlow() {
  bassAnalyser.getByteFrequencyData(bassFrequencyData);
  const lowFrequencyBins = bassFrequencyData.slice(0, 10);
  const energy = lowFrequencyBins.reduce((sum, value) => sum + value, 0) /
    (lowFrequencyBins.length * 255);
  bassBeatBaseline = bassBeatBaseline * 0.94 + energy * 0.06;
  const beat = Math.min(1, Math.max(0, (energy - bassBeatBaseline) * 6.0));

  setBassBeatStyles(beat);
  bassBeatFrame = bassAudio.paused ? undefined : requestAnimationFrame(updateBassGlow);
}

stage.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  if (event.key.toLowerCase() === "w") {
    toggleOneAudio();
  } else if (event.key.toLowerCase() === "p") {
    toggleGlow(1);
    toggleDrums();
  } else if (event.key.toLowerCase() === "s") {
    toggleFourAudio();
  } else if (event.key.toLowerCase() === "v") {
    toggleNineAudio();
  } else if (event.key.toLowerCase() === "e") {
    toggleTwoAudio();
  } else if (event.key.toLowerCase() === "r") {
    toggleThreeAudio();
  } else if (event.key.toLowerCase() === "y") {
    toggleGlow(4);
    toggleBass();
  } else if (event.key.toLowerCase() === "f") {
    toggleSixAudio();
  } else if (event.key.toLowerCase() === "x") {
    toggleSevenAudio();
  } else if (event.key.toLowerCase() === "d") {
    toggleFiveAudio();
  } else if (event.key.toLowerCase() === "c") {
    toggleEightAudio();
  } else if (event.key.toLowerCase() === "j") {
    toggleGlow(10);
    toggleVocals();
  } else if (event.key.toLowerCase() === "k") {
    toggleGlow(12);
  }
});

stage.addEventListener("click", () => {
  stage.focus();
  getAudioContext().resume();
});
window.addEventListener("resize", positionGlowBox);
image.addEventListener("load", positionGlowBox);

stage.focus();
positionGlowBox();
loadBufferTrack("one");
loadBufferTrack("two");
loadBufferTrack("three");
loadBufferTrack("four");
loadBufferTrack("five");
loadBufferTrack("six");
loadBufferTrack("seven");
loadBufferTrack("eight");
loadBufferTrack("nine");
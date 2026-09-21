const image = document.querySelector("#map-image");
const stage = document.querySelector("#stage");
const glowImages = document.querySelectorAll(".glow-image");
const glowAuras = document.querySelectorAll(".glow-aura");
const statusLabel = document.querySelector("#status-label");
const drumsAudio = document.querySelector("#drums-audio");
const bassAudio = document.querySelector("#bass-audio");
let audioContext;
let analyser;
let frequencyData;
let audioSource;
let beatFrame;
let beatBaseline = 0;

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
    minX: 557,
    minY: 349,
    maxX: 641,
    maxY: 606,
    points: [
      { x: 564, y: 371 },
      { x: 641, y: 349 },
      { x: 641, y: 606 },
      { x: 557, y: 604 },
    ],
  },
  { // C
    minX: 293,
    minY: 744,
    maxX: 364,
    maxY: 804,
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
    glowAura.style.left = `${left - 7}px`;
    glowAura.style.top = `${top - 7}px`;
    glowAura.style.width = `${width + 14}px`;
    glowAura.style.height = `${height + 14}px`;

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

function toggleGlow(boxIndex) {
  const stateClass = `is-on-${boxIndex + 1}`;
  const isOn = document.body.classList.toggle(stateClass);
  const activeBoxes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].filter((number) =>
    document.body.classList.contains(`is-on-${number}`),
  );

  if (activeBoxes.length) {
    statusLabel.textContent = `${activeBoxes.map((number) => ["W", "P", "E", "R", "Y", "S", "V", "F", "X", "D", "J", "C", "K"][number - 1]).join(" + ")} on`;
  } else {
    statusLabel.textContent = "Glow off";
  }
}

function toggleDrums() {
  if (!audioContext) {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    audioSource = audioContext.createMediaElementSource(drumsAudio);
    audioSource.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  if (drumsAudio.paused) {
    audioContext.resume();
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
  if (bassAudio.paused) {
    bassAudio.play().catch(() => {
      statusLabel.textContent = "Press Y to allow bass";
    });
  } else {
    bassAudio.pause();
  }
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

stage.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  if (event.key.toLowerCase() === "w") {
    toggleGlow(0);
  } else if (event.key.toLowerCase() === "p") {
    toggleGlow(1);
  } else if (event.key.toLowerCase() === "s") {
    toggleGlow(5);
  } else if (event.key.toLowerCase() === "v") {
    toggleGlow(6);
    toggleDrums();
  } else if (event.key.toLowerCase() === "e") {
    toggleGlow(2);
  } else if (event.key.toLowerCase() === "r") {
    toggleGlow(3);
  } else if (event.key.toLowerCase() === "y") {
    toggleGlow(4);
    toggleBass();
  } else if (event.key.toLowerCase() === "f") {
    toggleGlow(7);
  } else if (event.key.toLowerCase() === "x") {
    toggleGlow(8);
  } else if (event.key.toLowerCase() === "d") {
    toggleGlow(9);
  } else if (event.key.toLowerCase() === "c") {
    toggleGlow(11);
  } else if (event.key.toLowerCase() === "j") {
    toggleGlow(10);
  } else if (event.key.toLowerCase() === "k") {
    toggleGlow(12);
  }
});

stage.addEventListener("click", () => stage.focus());
window.addEventListener("resize", positionGlowBox);
image.addEventListener("load", positionGlowBox);

stage.focus();
positionGlowBox();
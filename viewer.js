/* viewer.js – jump‑to‑cycle via toolbar field only (no G key prompt) */

/* ───────────────────────── Constants ───────────────────────── */
const STAGES = ["IF", "ID", "EX", "MEM", "WB"];
const COLOURS = {
  arith:  "#59b4e3", // blue
  ls:     "#9ad17b", // green
  branch: "#f9d351", // yellow
  nop:    "#bfbfbf"  // grey
};
const MNEMONIC_CLASS = {
  LW: "ls", SW: "ls", LD: "ls", SD: "ls", LBU: "ls", LHU: "ls", LOAD: "ls", STORE: "ls", ST: "ls",
  BEQ: "branch", BNE: "branch", J: "branch", JR: "branch", B: "branch",
  NOP: "nop", NOOP: "nop"
};

/* ───────────────────────── Elements & state ───────────────────────── */
let cycles = [];
let curIdx = 0;

const heading      = document.querySelector("h1");
const cycleCounter = document.getElementById("cycleCounter");
const pipeline     = document.getElementById("pipeline");
const toolbar      = document.getElementById("toolbar");

const stageBodies = Object.fromEntries(
  STAGES.map(s => [s, document.querySelector(`#stage-${s} .stage-body`)])
);

const stageBoxes = Object.fromEntries(
  STAGES.map(s => [s, document.getElementById(`stage-${s}`)])
);

/* ────── Jump‑to‑cycle controls ────── */
const jumpInput = document.createElement("input");
jumpInput.type = "number";
jumpInput.min = "1";
jumpInput.step = "1";
jumpInput.placeholder = "Cycle #";
jumpInput.title = "Enter cycle number and press Enter or Go";
jumpInput.style.width = "6rem";

const jumpBtn = document.createElement("button");
jumpBtn.textContent = "Go";
jumpBtn.title = "Jump to cycle";

if (toolbar) toolbar.append(jumpInput, jumpBtn);

function attemptJump(val) {
  const n = parseInt(val, 10);
  if (Number.isFinite(n) && n >= 1 && n <= cycles.length) {
    show(n - 1);
  } else {
    alert(`Invalid cycle (1 – ${cycles.length})`);
  }
}

jumpBtn.addEventListener("click", () => attemptJump(jumpInput.value));
jumpInput.addEventListener("keydown", e => {
  if (e.key === "Enter") attemptJump(jumpInput.value);
});

/* ───────────────────────── Helpers ───────────────────────── */
function mnemonicOf(line) {
  if (!line) return "NOP";
  const t = line.match(/`\s*([A-Za-z]{1,8})/);
  if (t) return t[1].toUpperCase();
  const k = line.match(/(?:fetched|decode)\s+([A-Za-z]{2,8})/i);
  if (k) return k[1].toUpperCase();
  return line.trim().split(/\s+/)[0].replace(/[^A-Za-z]/g, "").toUpperCase();
}

function bucketFor(line) {
  return MNEMONIC_CLASS[mnemonicOf(line)] ?? "arith";
}

function emphasiseOpcode(str) {
  return str.includes("`")
    ? str.replace(/`([^`]+)`/, "<strong>$1</strong>")
    : str.replace(/^([\w.$]+)/, "<strong>$1</strong>");
}

/* ───────────────────────── Log parsing ───────────────────────── */
function parseLog(text) {
  const arr = [];
  let c = null;

  text.split(/\n/).forEach(r => {
    const l = r.trimEnd();
    if (!l) return;

    if (l.startsWith("==")) {
      if (c) arr.push(c);
      const n = parseInt(l.match(/Cycle\s+(\d+)/)?.[1] ?? arr.length + 1, 10);
      c = { num: n, stages: {} };
      return;
    }

    const [lab, ...rest] = l.split(":");
    if (STAGES.includes(lab.trim())) {
      c.stages[lab.trim()] = rest.join(":").trim();
    }
  });

  if (c) arr.push(c);
  return arr;
}

/* ───────────────────────── Render ───────────────────────── */
function show(idx) {
  if (idx < 0 || idx >= cycles.length) return;

  curIdx = idx;
  const cyc = cycles[idx];

  heading.textContent = `Cycle ${cyc.num} / ${cycles.length}`;
  cycleCounter.textContent = `(#${cyc.num})`;

  STAGES.forEach(s => {
    const raw = cyc.stages[s] ?? "no-op";
    stageBodies[s].innerHTML = emphasiseOpcode(raw);
    stageBoxes[s].style.background = COLOURS[bucketFor(raw)];
  });

  location.hash = `#${cyc.num}`;
  requestAnimationFrame(scaleToFit);
}

/* ───────────────────────── Scaling ───────────────────────── */
function scaleToFit() {
  const fullW = pipeline.scrollWidth;
  const avail = document.documentElement.clientWidth - 32;
  const scale = Math.min(1, avail / fullW);

  pipeline.style.transform = `scale(${scale})`;
  pipeline.style.transformOrigin = "top left";
  pipeline.style.marginLeft = scale < 1
    ? `calc(50% - ${(fullW * scale) / 2}px)`
    : "auto";
}

window.addEventListener("load", scaleToFit);
window.addEventListener("resize", scaleToFit);

/* ───────────────────────── Navigation keys ───────────────────────── */
function next() {
  show(Math.min(curIdx + 1, cycles.length - 1));
}

function prev() {
  show(Math.max(curIdx - 1, 0));
}

document.addEventListener("keydown", e => {
  if (["ArrowRight", "d", "D"].includes(e.key)) next();
  else if (["ArrowLeft", "a", "A"].includes(e.key)) prev();
});

/* ───────────────────────── File / drag‑drop ───────────────────────── */
const fileInput = document.getElementById("logFile");

fileInput.addEventListener("change", () => {
  handleFile(fileInput.files?.[0]);
});

window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => {
  e.preventDefault();
  handleFile(e.dataTransfer.files?.[0]);
});

async function handleFile(f) {
  if (!f) return;

  cycles = parseLog(await f.text());

  if (!cycles.length) {
    return alert("Unable to parse cycles – check log format.");
  }

  const h = parseInt(location.hash.replace("#", ""), 10);
  show(Number.isFinite(h) && h >= 1 && h <= cycles.length ? h - 1 : 0);
}

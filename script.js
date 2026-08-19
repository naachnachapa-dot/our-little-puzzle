const canvas = document.getElementById("puzzleCanvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const againBtn = document.getElementById("againBtn");
const intro = document.getElementById("intro");
const game = document.getElementById("game");
const complete = document.getElementById("complete");
const loading = document.getElementById("loading");
const progressEl = document.getElementById("progress");
const timerEl = document.getElementById("timer");
const hintBtn = document.getElementById("hintBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

const W = 1200;
const H = 800;

// ============================================================
// PUZZLE SETTINGS
// ============================================================

const COLS = 6;
const ROWS = 4;
const TOTAL = COLS * ROWS;

const BOARD = {
  x: 170,
  y: 105,
  w: 860,
  h: 573
};

// Size of the tabs/indents.
const TAB = 18;

// How close a piece must be before it snaps.
const SNAP_DISTANCE = 35;

// ============================================================
// IMAGE
// ============================================================

const image = new Image();
image.src = "assets/puzzle-photo.jpeg";

const imageCanvas = document.createElement("canvas");
const imageCtx = imageCanvas.getContext("2d");

// ============================================================
// GAME VARIABLES
// ============================================================

let pieces = [];
let selectedPiece = null;

let dragOffsetX = 0;
let dragOffsetY = 0;

let solvedCount = 0;
let zCounter = 0;

let gameStarted = false;
let animationId = null;

let timerInterval = null;
let elapsedSeconds = 0;

// ============================================================
// RANDOMIZER
// ============================================================

function random(seed) {
  let value = seed >>> 0;

  return function () {
    value += 0x6D2B79F5;

    let t = value;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = random(182026);

// ============================================================
// PREPARE PHOTO
// ============================================================

function prepareImage() {

  imageCanvas.width = BOARD.w;
  imageCanvas.height = BOARD.h;

  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;

  const boardRatio = BOARD.w / BOARD.h;
  const imageRatio = imageWidth / imageHeight;

  let drawWidth;
  let drawHeight;

  if (imageRatio > boardRatio) {

    drawHeight = BOARD.h;
    drawWidth = drawHeight * imageRatio;

  } else {

    drawWidth = BOARD.w;
    drawHeight = drawWidth / imageRatio;
  }

  const offsetX = (BOARD.w - drawWidth) / 2;
  const offsetY = (BOARD.h - drawHeight) / 2;

  imageCtx.clearRect(
    0,
    0,
    BOARD.w,
    BOARD.h
  );

  imageCtx.drawImage(
    image,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );
}

// ============================================================
// JIGSAW EDGE SYSTEM
// ============================================================
//
// Each shared edge gets ONE value.
//
//  1 = tab
// -1 = indentation
//
// The neighbouring piece receives the opposite value.
// This guarantees that the two pieces fit together.
// ============================================================

function createEdges() {

  const verticalEdges = [];
  const horizontalEdges = [];

  // Vertical shared edges
  for (let row = 0; row < ROWS; row++) {

    verticalEdges[row] = [];

    for (let col = 0; col < COLS - 1; col++) {

      verticalEdges[row][col] =
        rand() > 0.5 ? 1 : -1;
    }
  }

  // Horizontal shared edges
  for (let row = 0; row < ROWS - 1; row++) {

    horizontalEdges[row] = [];

    for (let col = 0; col < COLS; col++) {

      horizontalEdges[row][col] =
        rand() > 0.5 ? 1 : -1;
    }
  }

  return {
    verticalEdges,
    horizontalEdges
  };
}

// ============================================================
// JIGSAW EDGE SHAPES
// ============================================================

function drawHorizontalEdge(path, x1, y, x2, depth) {

  if (depth === 0) {
    path.lineTo(x2, y);
    return;
  }

  const width = x2 - x1;
  const third = width / 3;

  const a = x1 + third;
  const b = x2 - third;
  const center = (a + b) / 2;

  // Move to beginning of the curved section
  path.lineTo(a, y);

  // First half of tab / hole
  path.bezierCurveTo(
    a + 7,
    y,
    a + 7,
    y + depth,
    center,
    y + depth
  );

  // Second half
  path.bezierCurveTo(
    b - 7,
    y + depth,
    b - 7,
    y,
    b,
    y
  );

  // Finish edge
  path.lineTo(x2, y);
}


function drawHorizontalEdgeReverse(
  path,
  x1,
  y,
  x2,
  depth
) {

  if (depth === 0) {
    path.lineTo(x1, y);
    return;
  }

  const width = x2 - x1;
  const third = width / 3;

  const a = x1 + third;
  const b = x2 - third;
  const center = (a + b) / 2;

  // We are travelling RIGHT -> LEFT

  path.lineTo(b, y);

  path.bezierCurveTo(
    b - 7,
    y,
    b - 7,
    y + depth,
    center,
    y + depth
  );

  path.bezierCurveTo(
    a + 7,
    y + depth,
    a + 7,
    y,
    a,
    y
  );

  path.lineTo(x1, y);
}


function drawVerticalEdge(
  path,
  x,
  y1,
  y2,
  depth
) {

  if (depth === 0) {
    path.lineTo(x, y2);
    return;
  }

  const height = y2 - y1;
  const third = height / 3;

  const a = y1 + third;
  const b = y2 - third;
  const center = (a + b) / 2;

  path.lineTo(x, a);

  path.bezierCurveTo(
    x,
    a + 7,
    x + depth,
    a + 7,
    x + depth,
    center
  );

  path.bezierCurveTo(
    x + depth,
    b - 7,
    x,
    b - 7,
    x,
    b
  );

  path.lineTo(x, y2);
}


function drawVerticalEdgeReverse(
  path,
  x,
  y1,
  y2,
  depth
) {

  if (depth === 0) {
    path.lineTo(x, y1);
    return;
  }

  const height = y2 - y1;
  const third = height / 3;

  const a = y1 + third;
  const b = y2 - third;
  const center = (a + b) / 2;

  // Travelling BOTTOM -> TOP

  path.lineTo(x, b);

  path.bezierCurveTo(
    x,
    b - 7,
    x + depth,
    b - 7,
    x + depth,
    center
  );

  path.bezierCurveTo(
    x + depth,
    a + 7,
    x,
    a + 7,
    x,
    a
  );

  path.lineTo(x, y1);
}


// ============================================================
// CREATE ONE COMPLETE JIGSAW PIECE
// ============================================================

function createPiecePath(piece) {

  const path = new Path2D();

  const x = TAB;
  const y = TAB;

  const right =
    TAB + piece.cellW;

  const bottom =
    TAB + piece.cellH;


  // ----------------------------------------------------------
  // TOP
  // ----------------------------------------------------------

  // Top edge faces UP, therefore its outward direction
  // is negative Y.

  drawHorizontalEdge(
    path,
    x,
    y,
    right,
    -TAB * piece.top
  );


  // ----------------------------------------------------------
  // RIGHT
  // ----------------------------------------------------------

  // Right edge faces RIGHT.

  drawVerticalEdge(
    path,
    right,
    y,
    bottom,
    TAB * piece.right
  );


  // ----------------------------------------------------------
  // BOTTOM
  // ----------------------------------------------------------

  // We are now travelling RIGHT -> LEFT.

  drawHorizontalEdgeReverse(
    path,
    x,
    bottom,
    right,
    TAB * piece.bottom
  );


  // ----------------------------------------------------------
  // LEFT
  // ----------------------------------------------------------

  // We are travelling BOTTOM -> TOP.
  //
  // Left edge faces LEFT, therefore negative X.

  drawVerticalEdgeReverse(
    path,
    x,
    y,
    bottom,
    -TAB * piece.left
  );


  path.closePath();

  return path;
}

// ============================================================
// CREATE ALL PUZZLE PIECES
// ============================================================

function createPuzzle() {

  const {
    verticalEdges,
    horizontalEdges
  } = createEdges();

  const cellW = BOARD.w / COLS;
  const cellH = BOARD.h / ROWS;

  pieces = [];

  solvedCount = 0;
  zCounter = 0;

  for (let row = 0; row < ROWS; row++) {

    for (let col = 0; col < COLS; col++) {

      // ------------------------------------------------
      // The ACTUAL piece is larger than its photo cell.
      // This gives the tabs enough room.
      // ------------------------------------------------

      const pieceWidth = cellW + TAB * 2;
      const pieceHeight = cellH + TAB * 2;

      // ------------------------------------------------
      // Correct location of the entire piece.
      // ------------------------------------------------

      const targetX =
        BOARD.x +
        col * cellW -
        TAB;

      const targetY =
        BOARD.y +
        row * cellH -
        TAB;

      // ------------------------------------------------
      // Random starting location.
      // ------------------------------------------------

      let startX;
      let startY;

      const side =
        Math.floor(rand() * 4);

      if (side === 0) {

        startX =
          10 +
          rand() *
          (W - pieceWidth - 20);

        startY =
          10 +
          rand() * 60;

      } else if (side === 1) {

        startX =
          10 +
          rand() * 120;

        startY =
          130 +
          rand() *
          (H - pieceHeight - 200);

      } else if (side === 2) {

        startX =
          10 +
          rand() *
          (W - pieceWidth - 20);

        startY =
          H -
          pieceHeight -
          15 -
          rand() * 60;

      } else {

        startX =
          W -
          pieceWidth -
          10 -
          rand() * 120;

        startY =
          130 +
          rand() *
          (H - pieceHeight - 200);
      }

      // ------------------------------------------------
      // Determine edge shapes.
      // ------------------------------------------------

      const top =
        row === 0
          ? 0
          : -horizontalEdges[row - 1][col];

      const bottom =
        row === ROWS - 1
          ? 0
          : horizontalEdges[row][col];

      const left =
        col === 0
          ? 0
          : -verticalEdges[row][col - 1];

      const right =
        col === COLS - 1
          ? 0
          : verticalEdges[row][col];

      const piece = {

        row,
        col,

        cellW,
        cellH,

        w: pieceWidth,
        h: pieceHeight,

        x: startX,
        y: startY,

        targetX,
        targetY,

        top,
        right,
        bottom,
        left,

        solved: false,

        z: zCounter++
      };

      piece.path =
        createPiecePath(piece);

      pieces.push(piece);
    }
  }

  updateProgress();
}

// ============================================================
// COUNTER
// ============================================================

function updateProgress() {

  progressEl.textContent =
    `${solvedCount} / ${TOTAL}`;
}

// ============================================================
// TIMER
// ============================================================

function updateTimerDisplay() {

  const minutes =
    Math.floor(elapsedSeconds / 60)
      .toString()
      .padStart(2, "0");

  const seconds =
    (elapsedSeconds % 60)
      .toString()
      .padStart(2, "0");

  timerEl.textContent =
    `${minutes}:${seconds}`;
}


function startTimer() {

  stopTimer();

  elapsedSeconds = 0;

  updateTimerDisplay();

  timerInterval =
    setInterval(() => {

      if (!gameStarted) return;

      elapsedSeconds++;

      updateTimerDisplay();

    }, 1000);
}


function stopTimer() {

  if (timerInterval) {

    clearInterval(timerInterval);

    timerInterval = null;
  }
}


function resetTimer() {

  stopTimer();

  elapsedSeconds = 0;

  updateTimerDisplay();
}

// ============================================================
// HINT
// ============================================================

let hintedPiece = null;
let hintTimeout = null;


function giveHint() {

  if (!gameStarted || solvedCount === TOTAL) {
    return;
  }

  const unsolvedPieces =
    pieces.filter(
      piece => !piece.solved
    );

  if (unsolvedPieces.length === 0) {
    return;
  }

  // Pick one unsolved piece
  const piece =
    unsolvedPieces[
      Math.floor(
        Math.random() *
        unsolvedPieces.length
      )
    ];

  hintedPiece = piece;

  // Bring the hinted piece to the front
  piece.z = ++zCounter;

  // Remove an older hint timer
  if (hintTimeout) {
    clearTimeout(hintTimeout);
  }

  // Remove the hint after 2 seconds
  hintTimeout =
    setTimeout(() => {

      hintedPiece = null;

    }, 2000);
}

// ============================================================
// SHUFFLE
// ============================================================

function shufflePuzzle() {

  if (!gameStarted) {
    return;
  }

  const unsolvedPieces =
    pieces.filter(
      piece => !piece.solved
    );

  for (const piece of unsolvedPieces) {

    const side =
      Math.floor(
        Math.random() * 4
      );

    if (side === 0) {

      piece.x =
        10 +
        Math.random() *
        (W - piece.w - 20);

      piece.y =
        10 +
        Math.random() * 70;

    } else if (side === 1) {

      piece.x =
        10 +
        Math.random() * 130;

      piece.y =
        130 +
        Math.random() *
        (H - piece.h - 200);

    } else if (side === 2) {

      piece.x =
        10 +
        Math.random() *
        (W - piece.w - 20);

      piece.y =
        H -
        piece.h -
        15 -
        Math.random() * 70;

    } else {

      piece.x =
        W -
        piece.w -
        10 -
        Math.random() * 130;

      piece.y =
        130 +
        Math.random() *
        (H - piece.h - 200);
    }

    piece.z = ++zCounter;
  }

  selectedPiece = null;
}

// ============================================================
// DRAW BACKGROUND
// ============================================================

function drawBackground() {

  ctx.fillStyle = "#fff8f7";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  // Board shadow

  ctx.save();

  ctx.shadowColor =
    "rgba(65,30,40,.18)";

  ctx.shadowBlur = 24;

  ctx.shadowOffsetY = 8;

  ctx.fillStyle = "#ffffff";

  ctx.fillRect(
    BOARD.x,
    BOARD.y,
    BOARD.w,
    BOARD.h
  );

  ctx.restore();

  // Board outline

  ctx.strokeStyle =
    "rgba(160,90,105,.25)";

  ctx.lineWidth = 2;

  ctx.strokeRect(
    BOARD.x,
    BOARD.y,
    BOARD.w,
    BOARD.h
  );
}

// ============================================================
// DRAW HEARTS
// ============================================================

function drawHeart(x, y, size) {

  ctx.save();

  ctx.fillStyle =
    "rgba(233,107,130,.22)";

  ctx.font =
    `${size}px Georgia`;

  ctx.fillText(
    "♥",
    x,
    y
  );

  ctx.restore();
}

// ============================================================
// DRAW ONE PUZZLE PIECE
// ============================================================

function drawPiece(piece) {

  ctx.save();

  ctx.translate(
    piece.x,
    piece.y
  );

  // ==========================================================
  // HINT GLOW
  // ==========================================================

  if (piece === hintedPiece) {

    ctx.shadowColor = "#e96b82";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

  } else if (!piece.solved) {

    ctx.shadowColor =
      "rgba(55,25,35,.22)";

    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 4;
  }

  // Clip to actual jigsaw shape

  ctx.clip(piece.path);

  // ---------------------------------------------------------
  // IMPORTANT:
  //
  // The image begins TAB pixels before the visible cell.
  // This means the tabs also contain the correct photograph.
  // ---------------------------------------------------------

  const imageX =
  TAB -
  piece.col * piece.cellW;

const imageY =
  TAB -
  piece.row * piece.cellH;

ctx.drawImage(
  imageCanvas,
  imageX,
  imageY
);

  ctx.restore();

  // Piece border

  ctx.save();

  ctx.translate(
    piece.x,
    piece.y
  );

  ctx.strokeStyle =
    piece.solved
      ? "rgba(255,255,255,.55)"
      : "rgba(70,35,45,.42)";

  ctx.lineWidth = 2;

  ctx.stroke(
    piece.path
  );

  ctx.restore();
}

// ============================================================
// RENDER
// ============================================================

function render() {

  ctx.clearRect(
    0,
    0,
    W,
    H
  );

  drawBackground();

  drawHeart(
    65,
    115,
    34
  );

  drawHeart(
    1090,
    120,
    28
  );

  drawHeart(
    70,
    700,
    30
  );

  drawHeart(
    1090,
    690,
    36
  );

  const ordered =
    [...pieces].sort(
      (a, b) => a.z - b.z
    );

  // ==========================================================
// DRAW HINT DESTINATION
// ==========================================================

if (hintedPiece) {

  ctx.save();

  ctx.translate(
    hintedPiece.targetX,
    hintedPiece.targetY
  );

  ctx.fillStyle =
    "rgba(233,107,130,.18)";

  ctx.shadowColor =
    "#e96b82";

  ctx.shadowBlur = 25;

  ctx.fill(hintedPiece.path);

  ctx.restore();


  // Draw a dashed outline around the destination
  ctx.save();

  ctx.translate(
    hintedPiece.targetX,
    hintedPiece.targetY
  );

  ctx.strokeStyle =
    "rgba(189,64,90,.85)";

  ctx.lineWidth = 3;

  ctx.setLineDash([8, 6]);

  ctx.stroke(hintedPiece.path);

  ctx.restore();
}


// ==========================================================
// DRAW PUZZLE PIECES
// ==========================================================

for (const piece of ordered) {

  drawPiece(piece);
}

  animationId =
    requestAnimationFrame(render);
}

// ============================================================
// POINTER POSITION
// ============================================================

function getPointer(e) {

  const rect =
    canvas.getBoundingClientRect();

  return {

    x:
      (e.clientX - rect.left) *
      (W / rect.width),

    y:
      (e.clientY - rect.top) *
      (H / rect.height)
  };
}

// ============================================================
// FIND PIECE UNDER MOUSE
// ============================================================

function findPiece(x, y) {

  const ordered =
    pieces
      .filter(
        piece => !piece.solved
      )
      .sort(
        (a, b) => b.z - a.z
      );

  for (const piece of ordered) {

    if (
      ctx.isPointInPath(
        piece.path,
        x - piece.x,
        y - piece.y
      )
    ) {

      return piece;
    }
  }

  return null;
}

// ============================================================
// START DRAG
// ============================================================

canvas.addEventListener(
  "pointerdown",
  e => {

    if (!gameStarted) return;

    const pos =
      getPointer(e);

    const piece =
      findPiece(
        pos.x,
        pos.y
      );

    if (!piece) return;

    selectedPiece =
      piece;

    dragOffsetX =
      pos.x - piece.x;

    dragOffsetY =
      pos.y - piece.y;

    piece.z =
      ++zCounter;

    canvas.classList.add(
      "dragging"
    );

    canvas.setPointerCapture(
      e.pointerId
    );
  }
);

// ============================================================
// DRAG
// ============================================================

canvas.addEventListener(
  "pointermove",
  e => {

    if (!selectedPiece)
      return;

    const pos =
      getPointer(e);

    selectedPiece.x =
      pos.x - dragOffsetX;

    selectedPiece.y =
      pos.y - dragOffsetY;
  }
);

// ============================================================
// RELEASE PIECE
// ============================================================

function releasePiece(e) {

  if (!selectedPiece)
    return;

  const piece =
    selectedPiece;

  const dx =
    piece.x -
    piece.targetX;

  const dy =
    piece.y -
    piece.targetY;

  const distance =
    Math.sqrt(
      dx * dx +
      dy * dy
    );

  if (
    distance <=
    SNAP_DISTANCE
  ) {

    piece.x =
      piece.targetX;

    piece.y =
      piece.targetY;

    piece.solved =
      true;

    solvedCount++;

    updateProgress();

    if (
      solvedCount === TOTAL
    ) {

      setTimeout(
        showComplete,
        700
      );
    }
  }

  selectedPiece = null;

  canvas.classList.remove(
    "dragging"
  );

  try {

    canvas.releasePointerCapture(
      e.pointerId
    );

  } catch (_) {}
}

canvas.addEventListener(
  "pointerup",
  releasePiece
);

canvas.addEventListener(
  "pointercancel",
  releasePiece
);

// ============================================================
// COMPLETE
// ============================================================

function showComplete() {

  gameStarted = false;

  stopTimer();

  if (animationId) {

    cancelAnimationFrame(
      animationId
    );
  }

  game.classList.add(
    "hidden"
  );

  complete.classList.remove(
    "hidden"
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// ============================================================
// START PUZZLE
// ============================================================

function startPuzzle() {

  intro.classList.add(
    "hidden"
  );

  complete.classList.add(
    "hidden"
  );

  game.classList.remove(
    "hidden"
  );

  loading.classList.remove(
    "hidden"
  );

  const startGame = () => {

    prepareImage();

createPuzzle();

gameStarted = true;

resetTimer();
startTimer();

loading.classList.add(
  "hidden"
);

    if (animationId) {

      cancelAnimationFrame(
        animationId
      );
    }

    render();
  };

  if (image.complete) {

    startGame();

  } else {

    image.onload =
      startGame;
  }
}

// ============================================================
// BUTTONS
// ============================================================

startBtn.addEventListener(
  "click",
  startPuzzle
);

hintBtn.addEventListener(
  "click",
  giveHint
);

shuffleBtn.addEventListener(
  "click",
  shufflePuzzle
);

againBtn.addEventListener(
  "click",
  () => {

    stopTimer();

    resetTimer();

    complete.classList.add(
      "hidden"
    );

    intro.classList.remove(
      "hidden"
    );
  }
);
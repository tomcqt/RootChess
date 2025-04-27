const HOST = location.origin.replace(/^http/, "ws").replace(/:9001$/, ":9002"); // it's over 9000!!!
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const board = [];
const teams = [];
for (let i = 0; i < boardW; i++) {
  board[i] = [];
  teams[i] = [];
  for (let j = 0; j < boardH; j++) {
    board[i][j] = 0;
    teams[i][j] = 0;
  }
}

let interpolatingPieces = {
  /*squareX: {squareY: [curX, curY]}*/
};

let mouse,
  lastRenderedMinimap = -1e5;
let selectedSquareX, selectedSquareY;
let legalMoves = [],
  draggingSelected = false,
  moveWasDrag = false;
let curMoveCooldown = 0;
window.onmousemove = (e) => {
  if (isMobile && dragging === true) {
    let mouseCoords = canvasPos({ x: e.x, y: e.y });
    dist = Math.min(
      stickR,
      Math.sqrt(
        (mouseCoords.x - coords.x) ** 2 + (mouseCoords.y - coords.y) ** 2
      )
    );
    angle = Math.atan2(mouseCoords.y - coords.y, mouseCoords.x - coords.x);
    changed = true;
    mouse = e;
    return;
  }

  mouse = e;
  if (selectedSquareX !== undefined) {
    changed = true;
  }
};

window.oncontextmenu = (e) => {
  return e.preventDefault();
};

window.onmousedown = (e) => {
  // if(mousePos === undefined){
  const t = ctx.getTransform();

  ctx.translate(canvas.w / 2, canvas.h / 2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(camera.x, camera.y);

  mousePos = canvasPos({ x: e.x, y: e.y });

  ctx.setTransform(t);
  // }

  if (isMobile === true) {
    let mouseCoords = canvasPos({ x: e.x, y: e.y });

    for (let i = 0; i < buttons.length; i++) {
      const { clicking, xPercent, yPercent, rPercent, text } = buttons[i];
      const coords = { x: xPercent * innerWidth, y: yPercent * innerHeight };
      let mag = Math.sqrt(
        (mouseCoords.x - coords.x) ** 2 + (mouseCoords.y - coords.y) ** 2
      );
      if (mag <= rPercent * innerHeight) {
        buttons[i].clicking = true;
        changed = true;
        return;
      }
    }

    let mag = Math.sqrt(
      (mouseCoords.x - coords.x) ** 2 + (mouseCoords.y - coords.y) ** 2
    );
    dist = Math.min(stickR, mag);
    angle = Math.atan2(mouseCoords.y - coords.y, mouseCoords.x - coords.x);
    if (mag <= stickR) {
      dragging = true;
      changed = true;
      return;
    } else {
      if (dist !== 0 || angle !== 0) changed = true;
      dist = angle = 0;
    }
  }

  const squareX = Math.floor(mousePos.x / squareSize);
  const squareY = Math.floor(mousePos.y / squareSize);

  if (legalMoves !== undefined && selectedSquareX !== undefined) {
    for (let i = 0; i < legalMoves.length; i++) {
      if (
        legalMoves[i][0] === squareX &&
        legalMoves[i][1] === squareY &&
        curMoveCooldown <= 220
      ) {
        const buf = new Uint16Array(4);
        buf[0] = selectedSquareX;
        buf[1] = selectedSquareY;
        buf[2] = squareX;
        buf[3] = squareY;
        send(buf);

        legalMoves = [];

        selectedSquareX = squareX;
        selectedSquareY = squareY;

        unconfirmedSX = selectedSquareX;
        unconfirmedSY = selectedSquareY;

        moveWasDrag = false;
        return;
      }
    }
  }
  selectedSquareX = selectedSquareY = undefined;
  legalMoves = undefined;

  const inBounds =
    squareX >= 0 && squareX < boardW && squareY >= 0 && squareY < boardH;

  if (
    inBounds &&
    board[squareX][squareY] !== 0 &&
    teams[squareX][squareY] === selfId
  ) {
    selectedSquareX = squareX;
    selectedSquareY = squareY;

    legalMoves = generateLegalMoves(
      selectedSquareX,
      selectedSquareY,
      board,
      teams
    );

    draggingSelected = true;

    // selectedOffsetX = mousePos.x - squareX * squareSize;
    // selectedOffsetY = mousePos.y - squareY * squareSize;
  }
};

let unconfirmedSX, unconfirmedSY;
window.onmouseup = (e) => {
  if (isMobile) {
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].clicking === true) changed = true;
      buttons[i].clicking = false;
    }

    if (dragging === true) {
      dragging = false;
      dist = angle = 0;
      return;
    }
    // otherwise try placing
  }

  if (selectedSquareX !== undefined) {
    const newX = Math.floor(mousePos.x / squareSize);
    const newY = Math.floor(mousePos.y / squareSize);

    let legal = false;
    for (let i = 0; i < legalMoves.length; i++) {
      if (legalMoves[i][0] === newX && legalMoves[i][1] === newY) {
        legal = true;
        break;
      }
    }

    if (legal === true && curMoveCooldown <= 220) {
      const buf = new Uint16Array(4);
      buf[0] = selectedSquareX;
      buf[1] = selectedSquareY;
      buf[2] = newX;
      buf[3] = newY;
      send(buf);

      legalMoves = [];
      unconfirmedSX = selectedSquareX;
      unconfirmedSY = selectedSquareY;

      moveWasDrag = true;
      return;
    }
  }
  // selectedSquareX = selectedSquareY = undefined;
  // legalMoves = [];
  draggingSelected = false;
};

const colors = ["#d8bfd8", "#9370db"]; // Light purple and medium purple

// images are 150x150 so this is best aspect ratio
const squareSize = 150;

const bw = boardW * squareSize;
const bh = boardH * squareSize;

let camera = {
  x: (-boardW * squareSize) / 2,
  y: (-boardH * squareSize) / 2,
  scale: 1,
};

// 0 - empty
// 1 - pawn
// 2 - knight
// 3 - bishop
// 4 - rook
// 5 - queen
// 6 - king
const srcs = ["wp", "wn", "wb", "wr", "wq", "wk"];

const imgs = [undefined];
let imgsToLoad = 0,
  imgsLoaded = false;
for (let i = 0; i < srcs.length; i++) {
  imgsToLoad++;
  const img = new Image();
  img.src = `/assets/${srcs[i]}.png`;
  img.onload = () => {
    imgsToLoad--;
    if (imgsToLoad === 0) {
      imgsLoaded = true;
      requestAnimationFrame(render);
    }
  };
  imgs.push(img);
}

const audioSrcs = ["move1", "move2", "capture1", "capture2", "gameover"];
let audios = [];
let audiosToLoad = 0,
  audioLoaded = false;
for (let i = 0; i < audioSrcs.length; i++) {
  audiosToLoad++;
  const a = new Audio();

  a.src = `/assets/${audioSrcs[i]}.mp3`;
  a.oncanplay = () => {
    audiosToLoad--;
    audios[i] = a;
    if (audiosToLoad === 0) {
      audioLoaded = true;

      audios = {
        move: [audios[0], audios[1]],
        capture: [audios[2], audios[3]],
        gameover: [audios[4]],
      };
    }
  };
}

const tintedImgs = {
  /*hex: [array of images]*/
};

let time = performance.now();
let lastTime = time;
let dt = 0;
let lastPixelX, lastPixelY;
let cooldown = -1;
let mousePos;
let gameOver = false,
  interpSquare = undefined,
  gameOverAlpha = 0,
  gameOverTime;

let minimapCanvas = document.getElementById("minimapCanvas");
let cx = minimapCanvas.getContext("2d");

function render() {
  canvas.w = canvas.width;
  canvas.h = canvas.height;
  ctx.imageSmoothingEnabled = camera.scale < 2;

  requestAnimationFrame(render);

  time = performance.now();
  dt = time - lastTime;
  if (cooldown > 0) changed = true;
  cooldown -= dt;
  lastTime = time;

  changed = true; // TEMP

  if (interpSquare !== undefined) {
    let d = dt / 16.66;
    camera.x = interpolate(
      camera.x,
      -(interpSquare[0] * squareSize + squareSize / 2),
      0.1 * d
    );
    camera.y = interpolate(
      camera.y,
      -(interpSquare[1] * squareSize + squareSize / 2),
      0.1 * d
    );
  } else {
    let xv = input.left - input.right;
    if (xv !== 0) {
      if (input.shift) xv *= 3;
      camera.x += xv * dt;
      changed = true;
    }

    let yv = input.up - input.down;
    if (yv !== 0) {
      if (input.shift) yv *= 3;
      camera.y += yv * dt;
      changed = true;
    }

    let zv = input.zoomOut - input.zoomIn;
    if (isMobile) {
      zv = buttons[0].clicking - buttons[1].clicking;
    }
    if (zv !== 0) {
      if (input.shift) zv *= 3;
      camera.scale *= 1 - zv / 50;
      if (camera.scale > 6) camera.scale = 6;
      else if (camera.scale < 0.27) camera.scale = 0.27;
      changed = true; //e.deltaY
    }

    if (isMobile) {
      if (dist !== 0) {
        const xv = (Math.cos(angle) * dist) / 138;
        const yv = (Math.sin(angle) * dist) / 138;
        camera.x -= xv * dt;
        camera.y -= yv * dt;
        changed = true;
      }
    }
  }

  if (!changed) return;
  changed = false;

  // drawing board
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, canvas.w, canvas.h);

  const t = ctx.getTransform();

  ctx.translate(canvas.w / 2, canvas.h / 2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(camera.x, camera.y);

  let topLeft = canvasPos({ x: 0, y: 0 });
  let bottomRight = canvasPos({ x: innerWidth, y: innerHeight });

  let cameraTop = {
    x: topLeft.x / (boardW * squareSize),
    y: topLeft.y / (boardH * squareSize),
  };

  let cameraBottom = {
    x: bottomRight.x / (boardW * squareSize),
    y: bottomRight.y / (boardH * squareSize),
  };

  topLeft.x = Math.max(0, Math.min(boardW, Math.floor(topLeft.x / squareSize)));
  topLeft.y = Math.max(0, Math.min(boardH, Math.floor(topLeft.y / squareSize)));

  bottomRight.x = Math.max(
    0,
    Math.min(boardW, Math.ceil(bottomRight.x / squareSize))
  );
  bottomRight.y = Math.max(
    0,
    Math.min(boardH, Math.ceil(bottomRight.y / squareSize))
  );

  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, bw, bh);

  ctx.fillStyle = colors[1];

  for (let i = topLeft.x; i < bottomRight.x; i++) {
    for (let j = topLeft.y; j < bottomRight.y; j++) {
      if ((i + j) % 2 === 0) {
        ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);
      }
    }
  }

  if (legalMoves) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "black";
    for (let i = 0; i < legalMoves.length; i++) {
      if (
        legalMoves[i][0] < topLeft.x ||
        legalMoves[i][0] > bottomRight.x ||
        legalMoves[i][1] < topLeft.y ||
        legalMoves[i][1] > bottomRight.y
      )
        continue;

      const x = legalMoves[i][0] * squareSize + squareSize / 2;
      const y = legalMoves[i][1] * squareSize + squareSize / 2;

      ctx.beginPath();
      ctx.arc(x, y, squareSize / 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
    }
    ctx.globalAlpha = 1;
  }

  for (let i = topLeft.x; i < bottomRight.x; i++) {
    for (let j = topLeft.y; j < bottomRight.y; j++) {
      if (board[i][j] !== 0) {
        if (teams[i][j] === 0) {
          ctx.drawImage(imgs[board[i][j]], i * squareSize, j * squareSize);
        } else {
          if (teams[i][j] === selfId) {
            ctx.fillStyle = "#00b400";
            ctx.globalAlpha = 0.6 + Math.sin(time / 320) * 0.2;
            ctx.fillRect(
              i * squareSize,
              j * squareSize,
              squareSize,
              squareSize
            );
            ctx.globalAlpha = 1;
            changed = true;
          }

          const color = teamToColor(teams[i][j]);
          const hash = color.r + "_" + color.g + "_" + color.b;
          if (tintedImgs[hash] === undefined) {
            generateTintedImages(color);
          }

          const img = tintedImgs[hash][board[i][j]];

          if (
            interpolatingPieces[i] !== undefined &&
            interpolatingPieces[i][j] !== undefined
          ) {
            const interp = interpolatingPieces[i][j];
            interp[0] = interpolate(interp[0], i, (0.45 * dt) / 16.66);
            interp[1] = interpolate(interp[1], j, (0.45 * dt) / 16.66);

            if (
              Math.abs(interp[0] - i) < 0.01 &&
              Math.abs(interp[1] - j) < 0.01
            ) {
              delete interpolatingPieces[i][j];
            }

            ctx.drawImage(img, interp[0] * squareSize, interp[1] * squareSize);
          } else {
            ctx.drawImage(img, i * squareSize, j * squareSize);
          }
        }
      }
    }
  }

  if (selectedSquareX !== undefined && draggingSelected === true) {
    let i = selectedSquareX;
    let j = selectedSquareY;
    // cover up original
    if ((i + j) % 2 === 0) {
      ctx.fillStyle = colors[1];
    } else {
      ctx.fillStyle = colors[0];
    }

    ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);

    // draw new
    const color = teamToColor(selfId);

    const img =
      tintedImgs[color.r + "_" + color.g + "_" + color.b][board[i][j]];
    ctx.drawImage(
      img,
      mousePos.x - squareSize / 2,
      mousePos.y - squareSize / 2
    );
  }

  if (mouse) {
    mousePos = canvasPos(mouse);

    const squareX = Math.floor(mousePos.x / squareSize);
    const squareY = Math.floor(mousePos.y / squareSize);

    if (
      board[squareX] &&
      board[squareX][squareY] !== 0 &&
      teams[squareX][squareY] === selfId
    ) {
      canvas.style.cursor = "grab";
    } else {
      canvas.style.cursor = "";
    }

    if (curMoveCooldown > 0) {
      curMoveCooldown -= dt;
      const percent = Math.max(0, curMoveCooldown / window.moveCooldown);

      let xOff = 10 / camera.scale;
      let yOff = -42 / camera.scale;

      const w = 68 / camera.scale;
      const h = 22 / camera.scale;

      // if(mouse.x / innerWidth > 0.93){
      //     xOff = -xOff - w;
      // }

      ctx.fillStyle = "black";

      ctx.globalAlpha = Math.min(percent * 4, 0.8);

      const x = xOff + mousePos.x;
      const y = yOff + mousePos.y;

      ctx.fillRect(x + w * percent, y, w * (1 - percent), h);

      const color = teamToColor(selfId);
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillRect(x, y, w * percent, h);

      ctx.globalAlpha = 1;
    }
  }

  ctx.setTransform(t);

  // minimap
  const offset = Math.min(canvas.w, canvas.h) / 20;
  const size = Math.min(canvas.w, canvas.h) / 5;

  const x = canvas.w - offset - size;
  const y = canvas.h - offset - size;

  // // outline
  ctx.strokeStyle = "black";
  ctx.fillStyle = "black"; //colors[0];
  ctx.lineWidth = 3;

  ctx.lineJoin = ctx.lineCap = "round";
  ctx.beginPath();
  ctx.rect(x, y, size, size);

  ctx.globalAlpha = 0.3;
  // ctx.stroke();
  ctx.fill();
  ctx.closePath();
  ctx.globalAlpha = 1;

  // // re-render minimap canvas if necessary
  if (time - lastRenderedMinimap > 300) {
    lastRenderedMinimap = time;

    minimapCanvas.width = size;
    minimapCanvas.height = size;

    minimapCanvas.style.width = size + "px";
    minimapCanvas.style.height = size + "px";

    minimapCanvas.style.bottom = offset + "px";
    minimapCanvas.style.right = offset + "px";

    const blockSize = size / boardW;
    for (let i = 0; i < boardW; i++) {
      for (let j = 0; j < boardH; j++) {
        if (board[i][j] === 0 || teams[i][j] === 0) {
          // if((i + j) % 2 === 0){
          //     cx.fillStyle = colors[1];
          //     cx.fillRect(i * blockSize, j * blockSize, blockSize, blockSize);
          // }
          continue;
        }

        let color = teamToColor(teams[i][j]);
        cx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;

        cx.fillRect(i * blockSize, j * blockSize, blockSize, blockSize);
      }
    }

    cx.lineWidth = 2;
    cx.strokeStyle = "#434343";
    cx.strokeRect(
      cameraTop.x * size,
      cameraTop.y * size,
      (cameraBottom.x - cameraTop.x) * size,
      (cameraBottom.y - cameraTop.y) * size
    );
  }

  if (gameOver === true) {
    gameOverAlpha = interpolate(gameOverAlpha, 1, (dt / 16.66) * 0.1);
    changed = true;

    const y = (Math.sin(time / 320) * canvas.h) / 16;

    ctx.font = "700 62px monospace";
    ctx.lineWidth = 5;
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("Game Over!", canvas.w / 2, canvas.h / 2 + y - 36);
    ctx.fillText("Game Over!", canvas.w / 2, canvas.h / 2 + y - 36);

    ctx.font = "700 31px monospace";
    ctx.lineWidth = 3;

    const t = (Math.max(0, gameOverTime + respawnTime - time) / 1000).toFixed(
      1
    );

    ctx.strokeText(`You Will Respawn in`, canvas.w / 2, canvas.h / 2 + y + 7);
    ctx.fillText(`You Will Respawn in`, canvas.w / 2, canvas.h / 2 + y + 7);

    ctx.strokeText(`${t} seconds.`, canvas.w / 2, canvas.h / 2 + y + 36);
    ctx.fillText(`${t} seconds.`, canvas.w / 2, canvas.h / 2 + y + 36);
  }

  // if(mouse){
  //     let mouseCoords = canvasPos({x: mouse.x, y: mouse.y});
  //     ctx.fillStyle = 'red';
  //     ctx.beginPath();
  //     ctx.arc(mouseCoords.x, mouseCoords.y, 30, 0, Math.PI * 2);
  //     ctx.fill();
  //     ctx.closePath();
  // }

  if (isMobile) {
    drawJoystick();
    drawButtons();
  }
}

// seeded rng
function teamToColor(team) {
  let num = Math.round(((Math.sin(team * 10000) + 1) / 2) * 0xffffff);

  let r = (num & 0xff0000) >>> 16;
  let g = (num & 0x00ff00) >>> 8;
  let b = num & 0x0000ff;

  if (r + g + b > 520) {
    r /= 2;
    g /= 2;
    b /= 2;
  }

  return { r, g, b };
}

function generateTintedImages(color) {
  let arr = [undefined];

  const r = color.r / 256;
  const g = color.g / 256;
  const b = color.b / 256;
  for (let i = 1; i < imgs.length; i++) {
    const c = document.createElement("canvas");
    const cx = c.getContext("2d");
    c.width = c.height = squareSize;

    cx.drawImage(imgs[i], 0, 0);

    const imgData = cx.getImageData(0, 0, c.width, c.height);
    const data = imgData.data;
    for (let j = 0; j < data.length; j += 4) {
      data[j] *= r;
      data[j + 1] *= g;
      data[j + 2] *= b;
    }

    cx.clearRect(0, 0, c.width, c.height);
    cx.putImageData(imgData, 0, 0);

    arr.push(c);
  }

  tintedImgs[color.r + "_" + color.g + "_" + color.b] = arr;
}

// page position to position on the canvas
function canvasPos({ x, y }) {
  const canvasDimensions = canvas.getBoundingClientRect();
  // first convert to canvas coords
  x = ((x - canvasDimensions.x) / canvasDimensions.width) * canvas.width;
  y = ((y - canvasDimensions.y) / canvasDimensions.height) * canvas.height;

  // then transform the point from where it should be drawn
  // to where it's supposed to be on the canvas so that
  // after its translated it will be drawn there
  const { a, b, c, d, e, f } = ctx.getTransform();

  const denom1 = a * d - c * b;
  const denom2 = -denom1;

  const invA = d / denom1;
  const invC = c / denom2;
  const invE = (e * d - c * f) / denom2;
  const invB = b / denom2;
  const invD = a / denom1;
  const invF = (e * b - a * f) / denom1;

  // then apply inverse transform
  return {
    x: invA * x + invC * y + invE,
    y: invB * x + invD * y + invF,
  };
}

// MOBILE

let joystick = {
  xPercent: 0.72,
  yPercent: 0.87,
  rPercent: 0.1,
};
let angle = 0,
  dist = 0,
  coords,
  rCoords,
  stickR,
  dragging = false;

let buttons = [
  {
    text: "-",
    xPercent: 0.34,
    yPercent: 0.94,
    rPercent: 0.045,
    clicking: false,
  },
  {
    text: "+",
    xPercent: 0.12,
    yPercent: 0.94,
    rPercent: 0.045,
    clicking: false,
  },
];

function drawJoystick() {
  const { xPercent, yPercent, rPercent } = joystick;

  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "blue";

  coords = { x: xPercent * innerWidth, y: yPercent * innerHeight };
  rCoords = {
    x: xPercent * innerWidth,
    y: (yPercent + rPercent) * innerHeight,
  };
  stickR = rCoords.y - coords.y;

  ctx.beginPath();
  ctx.arc(coords.x, coords.y, stickR, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();

  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(
    coords.x + Math.cos(angle) * dist,
    coords.y + Math.sin(angle) * dist,
    stickR / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.closePath();

  ctx.globalAlpha = 1;
}

function drawButtons() {
  for (let i = 0; i < buttons.length; i++) {
    drawButton(buttons[i]);
  }
}

function drawButton(b) {
  const { clicking, xPercent, yPercent, rPercent, text } = b;
  const coords = { x: xPercent * innerWidth, y: yPercent * innerHeight };
  const rCoords = {
    x: xPercent * innerWidth,
    y: (yPercent + rPercent) * innerHeight,
  };
  const btnR = rCoords.y - coords.y;

  ctx.fillStyle = "blue";
  ctx.globalAlpha = clicking ? 0.56 : 0.3;

  ctx.beginPath();
  ctx.arc(coords.x, coords.y, btnR, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();

  ctx.globalAlpha *= 1.79;

  ctx.fillStyle = "#f0f0f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 120px Monospace`;
  ctx.fillText(text, coords.x, coords.y);

  ctx.globalAlpha = 1;
}

if (isMobile) {
  const oldMouseDown = window.onmousedown;
  const oldMouseMove = window.onmousemove;
  const oldMouseUp = window.onmouseup;
  window.addEventListener("touchstart", (e) => {
    const c = e.changedTouches[0];
    defineTouch(c);
    oldMouseDown(c);
    oldMouseMove(c);
  });
  window.addEventListener(
    "touchmove",
    (e) => {
      const c = e.changedTouches[0];
      defineTouch(c);
      oldMouseMove(c);
      return e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener("touchend", (e) => {
    const c = e.changedTouches[0];
    defineTouch(c);
    oldMouseMove(c);
    oldMouseUp(c);
  });
  function defineTouch(e) {
    e.preventDefault = () => {};
    e.x = e.pageX;
    e.y = e.pageY;
  }
  window.onmousedown = window.onmouseup = window.onmousemove = () => {};
}

function interpolate(s, e, t) {
  return (1 - t) * s + e * t;
}

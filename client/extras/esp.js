// ==UserScript==
// @name         Pre-moves and attack ESP
// @namespace    http://tampermonkey.net/
// @version      2025-04-14
// @description  Adds pre-moves to the site
// @author       dovev
// @match        https://chess.ytdraws.win/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ytdraws.win
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // Your code here...
  moveCooldown = 900;

  const premoves = [];

  const unsafeSquares = [];
  const calculateUnsafeSquares = () => {
    const checkBoard = structuredClone(board);
    for (let x = 0; x < checkBoard.length; x++) {
      for (let y = 0; y < checkBoard[x].length; y++) {
        if (checkBoard[x][y] === 6 && teams[x][y] === selfId)
          checkBoard[x][y] = 0;
      }
    }

    unsafeSquares.length = 0;
    for (let x = 0; x < board.length; x++) {
      for (let y = 0; y < board[x].length; y++) {
        if (teams[x][y] === 0 || teams[x][y] === selfId) continue;
        const legalMoves = generateLegalMoves(x, y, checkBoard, teams);
        for (const move of legalMoves) {
          if (unsafeSquares.includes(move[0] + "-" + move[1])) continue;
          unsafeSquares.push(move[0] + "-" + move[1]);
        }
        if (board[x][y] === 1) {
          if (!unsafeSquares.includes(x - 1 + "-" + y - 1))
            unsafeSquares.push(x - 1 + "-" + y - 1);
          if (!unsafeSquares.includes(x - 1 + "-" + y + 1))
            unsafeSquares.push(x - 1 + "-" + y + 1);
          if (!unsafeSquares.includes(x + 1 + "-" + y - 1))
            unsafeSquares.push(x + 1 + "-" + y - 1);
          if (!unsafeSquares.includes(x + 1 + "-" + y + 1))
            unsafeSquares.push(x + 1 + "-" + y + 1);
        }
      }
    }
  };

  ws.addEventListener("message", (event) => {
    const msg = new Uint16Array(event.data);
    if (msg[0] === 64535 && msg[1] === 12345) return calculateUnsafeSquares();
    if (msg.byteLength === 8) {
      calculateUnsafeSquares();
    }
    if (msg.byteLength === 10) {
      calculateUnsafeSquares();
    }
  });

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
        if (legalMoves[i][0] === squareX && legalMoves[i][1] === squareY) {
          const oldX = selectedSquareX;
          const oldY = selectedSquareY;
          const newX = squareX;
          const newY = squareY;
          const performMove = () => {
            premoves.shift();
            const buf = new Uint16Array(4);
            buf[0] = oldX;
            buf[1] = oldY;
            buf[2] = newX;
            buf[3] = newY;
            send(buf);
            curMoveCooldown = moveCooldown;

            legalMoves = [];

            selectedSquareX = newX;
            selectedSquareY = newY;

            unconfirmedSX = selectedSquareX;
            unconfirmedSY = selectedSquareY;
            moveWasDrag = false;
          };
          if (curMoveCooldown <= 0) {
            performMove();
          } else {
            premoves.push({ newX, newY });
            setTimeout(performMove, curMoveCooldown);
          }
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

      const oldX = selectedSquareX;
      const oldY = selectedSquareY;

      const performMove = () => {
        premoves.shift();
        const buf = new Uint16Array(4);
        buf[0] = oldX;
        buf[1] = oldY;
        buf[2] = newX;
        buf[3] = newY;
        send(buf);

        legalMoves = [];
        unconfirmedSX = selectedSquareX;
        unconfirmedSY = selectedSquareY;

        moveWasDrag = true;
      };
      if (legal === true) {
        if (curMoveCooldown <= 0) {
          performMove();
          return;
        } else {
          premoves.push({ newX, newY });
          setTimeout(performMove, curMoveCooldown);
        }
      }
    }
    // selectedSquareX = selectedSquareY = undefined;
    // legalMoves = [];
    draggingSelected = false;
  };

  window.render = function render() {
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

    topLeft.x = Math.max(
      0,
      Math.min(boardW, Math.floor(topLeft.x / squareSize))
    );
    topLeft.y = Math.max(
      0,
      Math.min(boardH, Math.floor(topLeft.y / squareSize))
    );

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
        if (unsafeSquares.includes(i + "-" + j)) {
          ctx.fillStyle = (i + j) % 2 === 0 ? "#935151" : "#edd0d0";
          ctx.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);
          ctx.fillStyle = colors[1];
          continue;
        }
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

              ctx.drawImage(
                img,
                interp[0] * squareSize,
                interp[1] * squareSize
              );
            } else {
              ctx.drawImage(img, i * squareSize, j * squareSize);
            }
          }
        }
      }
    }

    for (const premove of premoves) {
      ctx.fillStyle = "#ffff003f";
      ctx.fillRect(
        premove.newX * squareSize,
        premove.newY * squareSize,
        squareSize,
        squareSize
      );
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
  };
})();

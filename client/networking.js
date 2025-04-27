let ws = new WebSocket(HOST);
ws.binaryType = "arraybuffer";

window.selfId = -1;

ws.addEventListener("message", function (data) {
  const msg = new Uint16Array(data.data);

  if (msg[0] === 64535 && msg[1] === 12345) {
    let teamsToNeutralize = [];
    for (let i = 2; i < msg.length; i++) {
      teamsToNeutralize.push(msg[i]);
    }

    // neutralize
    for (let i = 0; i < boardW; i++) {
      for (let j = 0; j < boardH; j++) {
        if (teamsToNeutralize.includes(teams[i][j]) === true) {
          // delete kings, neutralize other pieces
          if (board[i][j] === 6) {
            board[i][j] = 0;
          }
          teams[i][j] = 0;
        }
      }
    }
  } else if (msg[0] === 47095) {
    const data = new Uint8Array(msg.buffer);
    // chat msg
    const txt = stringHTMLSafe(decodeText(data, 4)).replaceAll("&nbsp;", " ");

    if (msg[1] !== 65534) {
      const color = teamToColor(msg[1]);
      appendChatMessage(txt, `rgb(${color.r},${color.g},${color.b})`);
    } else {
      appendChatMessage(txt, "rainbow");
    }
  } else if (msg[0] === 48027) {
    // leaderboard [id, name, kills]
    const prevLB = document.querySelector(".lb-group");
    if (prevLB) {
      const toRemove = prevLB.querySelectorAll(".lb-players");
      for (let i = 0; i < toRemove.length; i++) {
        toRemove[i].remove();
      }
    }

    const u8 = new Uint8Array(msg.buffer);

    let i = 1;

    const arr = [];

    while (i < msg.length - 1) {
      const id = msg[i++];
      const kills = msg[i++];
      const len = msg[i++];
      const startByteInd = i * 2;

      const name = decodeText(u8, startByteInd, startByteInd + len);

      i += Math.ceil(len / 2);

      const color = teamToColor(id);

      arr.push({ name, id, kills, color });
    }

    arr.sort((a, b) => b.kills - a.kills);

    for (let i = 0; i < arr.length; i++) {
      const { name, id, kills, color } = arr[i];
      addToLeaderboard(
        name,
        id,
        "Leaderboard",
        kills,
        `rgb(${color.r},${color.g},${color.b})`
      );
    }
  } else if (msg.byteLength > 10) {
    // this is the entire board
    let ind = 1;
    selfId = msg[0];
    document.querySelector(".chatContainer").classList.remove("hidden");
    for (let i = 0; i < boardW; i++) {
      for (let j = 0; j < boardH; j++) {
        board[i][j] = msg[ind++];
      }
    }

    for (let i = 0; i < boardW; i++) {
      for (let j = 0; j < boardH; j++) {
        teams[i][j] = msg[ind++];
      }
    }
  } else if (msg.byteLength === 8) {
    if (selectedSquareX === msg[0] && selectedSquareY === msg[1]) {
      unconfirmedSX =
        unconfirmedSY =
        selectedSquareX =
        selectedSquareY =
        legalMoves =
          undefined;
      draggingSelected = false;
      moveWasDrag = false;
    }
    // set a piece
    // x, y, piece, team
    board[msg[0]][msg[1]] = msg[2];
    teams[msg[0]][msg[1]] = msg[3];

    if (msg[2] === 6 && msg[3] === selfId) {
      gameOver = false;
      gameOverTime = undefined;

      interpSquare = [msg[0], msg[1]];
      setTimeout(() => {
        if (gameOver === false) {
          interpSquare = undefined;
        }
      }, 1200);
    }
  } else if (msg.byteLength === 10) {
    if (audioLoaded === true) {
      const teamIsSelfId =
        teams[msg[2]][msg[3]] === selfId || teams[msg[0]][msg[1]] === selfId;
      if (teamIsSelfId) {
        try {
          if (board[msg[2]][msg[3]] !== 0) {
            audios.capture[Math.random() < 0.5 ? 1 : 0].play();
          } else {
            audios.move[Math.random() < 0.5 ? 0 : 1].play();
          }
        } catch (e) {}
      }
    }

    if (board[msg[2]][msg[3]] === 6 && teams[msg[2]][msg[3]] === selfId) {
      // le king is dead
      interpSquare = [msg[2], msg[3]];
      gameOver = true;
      gameOverTime = time;

      try {
        audios.gameover[0].play();
      } catch (e) {}

      setTimeout(() => {
        const buf = new Uint8Array(0);
        send(buf);
      }, respawnTime - 100);
    }

    // move a piece
    board[msg[2]][msg[3]] = board[msg[0]][msg[1]];
    board[msg[0]][msg[1]] = 0;

    teams[msg[2]][msg[3]] = teams[msg[0]][msg[1]];
    teams[msg[0]][msg[1]] = 0;

    if (teams[msg[2]][msg[3]] !== selfId || moveWasDrag === false) {
      if (interpolatingPieces[msg[2]] === undefined) {
        interpolatingPieces[msg[2]] = {};
      }
      interpolatingPieces[msg[2]][msg[3]] = [msg[0], msg[1]];
    }

    if (selectedSquareX === msg[0] && selectedSquareY === msg[1]) {
      unconfirmedSX =
        unconfirmedSY =
        selectedSquareX =
        selectedSquareY =
        legalMoves =
          undefined;
      draggingSelected = false;
      moveWasDrag = false;

      legalMoves = [];
    }
    if (teams[msg[2]][msg[3]] === selfId) curMoveCooldown = window.moveCooldown;
  }

  changed = true;
});

let connected = false;
window.send = () => {};

const msgs = [];
window.send = (data) => {
  msgs.push(data);
};

ws.onopen = () => {
  connected = true;
  window.send = (data) => {
    ws.send(data);
  };

  for (let i = 0; i < msgs.length; i++) {
    window.send(msgs[i]);
  }
  msgs.length = 0;
};

ws.onclose = () => {
  connected = false;
  alert("disconnected from server!");
  // alert('disconnected from server.');
  window.send = () => {};
};

// join game
grecaptcha.ready(() => {
  grecaptcha.render(document.querySelector(".g-recaptcha"), {
    sitekey: "0x4AAAAAABDl4Wthv8-PLPyU",
    callback: (captchaResponse) => {
      const buf = new Uint8Array(captchaResponse.length);
      encodeAtPosition(captchaResponse, buf, 0);

      ws.send(buf);

      document.getElementById("fullscreenDiv").remove();
    },
  });
});

// const buf = new Uint8Array(0);
// send(buf);

const encoder = new TextEncoder();
function encodeAtPosition(string, u8array, position) {
  return encoder.encodeInto(
    string,
    position ? u8array.subarray(position | 0) : u8array
  );
}

window.stringHTMLSafe = (str) => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/ /g, "&nbsp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const decoder = new TextDecoder();
function decodeText(u8array, startPos = 0, endPos = Infinity) {
  return decoder.decode(u8array).slice(startPos, endPos);
}

window.addChatMessage = (message, type) => {
  const div = document.createElement("div");
  if (type !== "system") div.classList.add("chat-message");
  else div.classList.add("system-message");

  const chatPrefixMap = {
    normal: "",
    system: '<span class="rainbow">[SERVER]</span>',
    dev: '<span class="rainbow">[DEV]</span>',
    guest: '<span class="guest">',
  };

  const chatSuffixMap = {
    normal: "",
    system: "",
    dev: "",
    guest: "</span>",
  };

  div.innerHTML = chatPrefixMap[type] + message + chatSuffixMap[type];
  const chatMessageDiv = document.querySelector(".chat-div");
  chatMessageDiv.appendChild(div);
  chatMessageDiv.scrollTop = chatMessageDiv.scrollHeight;
};

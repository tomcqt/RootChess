let changed = true;
const Controls = {
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ShiftLeft: "shift",
  ShiftRight: "shift",
  KeyZ: "zoomOut",
  KeyX: "zoomIn",
};

window.input = {};
for (let key in Controls) {
  window.input[Controls[key]] = false;
}

window.onresize = () => {
  canvas.width = canvas.w = window.innerWidth;
  canvas.height = canvas.h = window.innerHeight;
  lastRenderedMinimap = -1e5;
  changed = true;
};
window.onresize();

let chatOpen = false;
let uiHidden = false;

const chatDiv = document.querySelector(".chatContainer");
const chatMsgContainer = document.querySelector(".chat-div");
const chatInput = document.querySelector(".chat");
const lbDiv = document.querySelector(".leaderboard-div");
const visChatDiv = document.querySelector(".chat-div");

chatMsgContainer.onwheel = (e) => {
  if (chatMsgContainer.scrollHeight > chatMsgContainer.clientHeight) {
    return e.stopPropagation();
  }
};

let loadedChat = false;

window.onkeydown = window.onkeyup = (e) => {
  if (e.repeat) return;

  if (selfId !== -1) {
    if (loadedChat === false) {
      loadedChat = true;
      chatInput.classList.remove("hidden");
      const color = teamToColor(selfId);
      chatInput.style.color = `rgb(${color.r},${color.g},${color.b})`;
    }
    if (e.type === "keydown") {
      if (e.code === "Enter") {
        if (chatOpen === true && e.type === "keydown") {
          // send chat message
          const text = chatInput.value.trim();

          if (text.length !== 0) {
            sendChatMsg(text);
          }

          chatOpen = false;
          chatInput.value = "";
          chatInput.blur();

          chatInput.style.opacity = "0";
        } else if (e.type === "keydown") {
          // focus chat
          chatOpen = true;
          chatDiv.classList.remove("hidden");
          chatInput.setAttribute("tabindex", "0");
          chatInput.focus();

          chatInput.style.opacity = "1";
        }
        return e.preventDefault();
      } else if (e.code === "KeyH" && chatOpen === false) {
        if (uiHidden === false) {
          chatInput.blur();
          if (!visChatDiv.classList.contains("hideChat")) {
            visChatDiv.classList.add("hideChat");
          }
          if (!lbDiv.classList.contains("hideLB")) {
            lbDiv.classList.add("hideLB");
          }
        } else {
          if (visChatDiv.classList.contains("hideChat")) {
            visChatDiv.classList.remove("hideChat");
            visChatDiv.scrollTop = visChatDiv.scrollHeight;
          }
          if (lbDiv.classList.contains("hideLB")) {
            lbDiv.classList.remove("hideLB");
          }
        }
        uiHidden = !uiHidden;
      }
    }

    if (chatOpen === true) {
      return;
    }
  }

  if (Controls[e.code] !== undefined) {
    const name = Controls[e.code];
    const state = e.type === "keydown";
    window.input[name] = state;
  }

  // if(hotkeyFns[e.code] !== undefined && e.type === 'keydown'){
  //     hotkeyFns[e.code](e);
  // }
};

window.onwheel = (e) => {
  camera.scale *= 1 - e.deltaY / 2100;
  // if (camera.scale > 6) camera.scale = 6;
  // else if (camera.scale < 0.27) camera.scale = 0.27;
  // disable limits because they suck lmaooo
  changed = true;
};

function appendChatMessage(msg, color = "white") {
  const chatMessage = document.createElement("div");
  chatMessage.innerText = msg;
  if (color === "rainbow") {
    setInterval(() => {
      chatMessage.style.color = `hsl(${performance.now() / 12}, 50%, 50%)`;
    }, 1000 / 60);
  } else chatMessage.style.color = color;
  chatMessage.className = "chat-message";
  chatMsgContainer.prepend(chatMessage);
  setTimeout(() => {
    // animating fadeout after 5s
    chatMessage.animate(
      [
        {
          opacity: 1,
        },
        {
          transform: "rotateZ(2deg)",
          "font-size": "0rem",
          opacity: 0,
        },
      ],
      {
        duration: 1000,
        iterations: 1,
      }
    );

    setTimeout(() => {
      chatMessage.remove();
    }, 950);
  }, 30000);
}

const leaderboard = document.querySelector(".leaderboard-div");
function addToLeaderboard(
  playerName,
  playerId,
  mapName,
  bracketValue = 0,
  lbColor = "white"
) {
  let mapDiv = document.getElementById(`leaderboard-map-${mapName}`);
  if (mapDiv === null) {
    // create mapDiv
    mapDiv = document.createElement("div");
    mapDiv.classList.add("lb-group");
    mapDiv.id = `leaderboard-map-${mapName}`;

    const displayMapName = stringHTMLSafe(mapName);

    const mapNameDiv = document.createElement("span");
    mapDiv.appendChild(mapNameDiv);
    mapNameDiv.classList.add("lb-name");
    mapNameDiv.style.color =
      /*window.mapColors[mapName] ??*/ /*'#6cd95b'*/ "#3528e0";
    mapNameDiv.innerText = displayMapName;

    leaderboard.appendChild(mapDiv);
  }

  // add the player to the mapDiv
  const playerContainer = document.createElement("div");
  playerContainer.id = `player-container-${playerId}-${mapName}`;
  playerContainer.classList.add("lb-players");
  mapDiv.appendChild(playerContainer);

  const playerDiv = document.createElement("div");
  playerContainer.appendChild(playerDiv);

  const playerNameDiv = document.createElement("span");
  playerNameDiv.classList.add("player-name");
  playerNameDiv.innerText = playerName + ` [${bracketValue}]`;
  playerNameDiv.style.color = lbColor;
  playerDiv.appendChild(playerNameDiv);
}

const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

if (isMobile) {
  chatInput.onclick = () => {
    chatDiv.classList.remove("hidden");
    chatInput.setAttribute("tabindex", "0");
    chatInput.focus();

    chatInput.style.opacity = "1";

    let text = prompt("Send a chat message");
    if (text.length !== 0) {
      sendChatMsg(text);
    }

    chatOpen = false;
    chatInput.value = "";
    chatInput.blur();

    chatInput.style.opacity = "0";
  };
}

function sendChatMsg(txt) {
  if (txt === "/clear") {
    while (chatMsgContainer.firstChild) {
      chatMsgContainer.firstChild.remove();
    }
    return;
  }
  const buf = new Uint8Array(txt.length + (txt.length % 2) + 2);
  buf[0] = 247;
  buf[1] = 183;
  encodeAtPosition(txt, buf, 2);
  send(buf);
}

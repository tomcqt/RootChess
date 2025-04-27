// ==UserScript==
// @name         client commands
// @namespace    http://tampermonkey.net/
// @version      2025-04-15
// @description  try to take over the world!
// @author       You
// @match        https://chess.ytdraws.win/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  window.sendChatMsg = function sendChatMsg(txt) {
    if (txt === "/clear") {
      while (chatMsgContainer.firstChild) {
        chatMsgContainer.firstChild.remove();
      }
      return;
    }
    if (txt.startsWith("/camera")) {
      if (!txt.includes(" ")) {
        let coordinates = {};
        coordinateLoop: for (let x = 0; x < teams.length; x++) {
          for (let y = 0; y < teams[0].length; y++) {
            if (teams[x][y] !== selfId || board[x][y] !== 6) continue;
            coordinates = { x, y, found: true };
            break coordinateLoop;
          }
        }
        if (!coordinates.found) (camera.x = 0), (camera.y = 0);
        interpSquare = [coordinates.x, coordinates.y];
        setTimeout(() => {
          if (
            interpSquare[0] === coordinates.x &&
            interpSquare[1] === coordinates.y
          )
            interpSquare = undefined;
        }, 1200);
      }
      if (txt.split(" ").length === 3) {
        (camera.x = -txt.split(" ")[1] * camera.scale * squareSize),
          (camera.y = -txt.split(" ")[2] * camera.scale * squareSize);
      }
      if (txt.split(" ").length === 2) {
        for (let x = 0; x < board.length; x++) {
          for (let y = 0; y < board[x].length; y++) {
            if (board[x][y] === 6 && teams[x][y] === +txt.split(" ")[1]) {
              interpSquare = [x, y];
              setTimeout(() => {
                if (interpSquare[0] === x && interpSquare[1] === y)
                  interpSquare = undefined;
              }, 1200);
              return;
            }
          }
        }
      }
      return;
    }
    const buf = new Uint8Array(txt.length + (txt.length % 2) + 2);
    buf[0] = 247;
    buf[1] = 183;
    encodeAtPosition(txt, buf, 2);
    send(buf);
  };
})();

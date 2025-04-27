/*
bot for chess
modified from https://pastebin.com/raw/6Kip0HAP
awesome thingy
tomcat 2025
*/

/********************************/
/* I. bot core setup below      */
/********************************/

/*

VERSION
---
BOT: 0.0.4
UPDATED: 24/04/2025
URL: https://chess.ytdraws.win/

RULES
---
* Chess pieces movement roles apply (bishops and rooks move across the 64x64 board any distance).
* Capturing a piece with no team swaps its position with captor piece and grants control over it.
* Capturing a piece with of a different team destroys it.
* Capturing a king with of a different team turns all their pieces into no team pieces.
* Pawns move in 4 cardinal directions but can capture in all 8 directions like kings.

SETUP
---
0. Join game.
1. Copy paste this script into developer console (inspect element).
2. You should see the bot GUI in top left corner updating FPS counter.
3. Enable #Main bot mode (press 1).

USAGE
---
Use keys 0,1,2,3,4,5,6,7,8,9 to pick bot mode
* MODE 0: #Manual (disabled)
* MODE 1: #Main (protect king and expand control over pieces automatically)
* MODES 2-9 are not implemented for now.

*/

// selected MODE tracker
var bot_directive = 0;
var bot_routine_name = "---";

// piece type IDs must be same as client and server (global variable board[i][j] values)
// note that global variable teams[i][j] values hold piece team ID (controlled team ID is given by gobal selfId variable)
const ID_EMPTY = 0;
const ID_PAWN = 1;
const ID_KNIGHT = 2;
const ID_BISHOP = 3;
const ID_ROOK = 4;
const ID_QUEEN = 5;
const ID_KING = 6;

// Helper to convert piece type to string name (for better logging)
function pieceToString(pieceType) {
  switch (pieceType) {
    case ID_PAWN:
      return "PAWN";
    case ID_KNIGHT:
      return "KNIGHT";
    case ID_BISHOP:
      return "BISHOP";
    case ID_ROOK:
      return "ROOK";
    case ID_QUEEN:
      return "QUEEN";
    case ID_KING:
      return "KING";
    default:
      return "EMPTY";
  }
}

// Helper to guide decisions
function getPieceValue(pieceType) {
  switch (pieceType) {
    case ID_KING:
      return 100;
    case ID_QUEEN:
      return 9;
    case ID_ROOK:
      return 5;
    case ID_BISHOP:
      return 3;
    case ID_KNIGHT:
      return 2;
    case ID_PAWN:
      return 1;
    default:
      return 0;
  }
}

// server constants
const bot_MAX_SLIDER_RANGE = 22;
const bot_currMove_COOLDOWN = 220;

// custom constants
const bot_GUI = true; // shows stats in top left corner
const bot_stats_INTERVAL = 50; // interval how often to print the stats (refresh GUI)
const bot_pieces_INTERVAL = 50; // interval how often to look at the board for changes (update custom variables)

var bot_stats_dt = 0; // _stats_INTERVAL timer
var bot_pieces_dt = 0; // _pieces_INTERVAL timer

var bot_teamPieces = {}; // dictionary of keys [i,j].toString() and values of piece type IDs (0,1,2,3,4,5,6)
var bot_kingPiece = []; // [x,y] coordinates of controlled king
var bot_safteyFactor = Infinity; // distance to closest square without an allied piece (empty or enemy or neutral)
var bot_safteySquare = []; // [x,y] coordinates of closest square without an allied piece (empty or enemy or neutral)

// GUI
var botStatsDiv;
if (window.bot_guiInitialized == null && bot_GUI) {
  window.bot_guiInitialized = true;
  window.botStatsDiv = document.createElement("div");
  window.botStatsDiv.style.position = "absolute";
  window.botStatsDiv.style.top = "10px";
  window.botStatsDiv.style.left = "10px";
  window.botStatsDiv.style.padding = "8px";
  window.botStatsDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  // window.botStatsDiv.style.backgroundColor = "rgba(0, 0, 0, 0)";
  // window.botStatsDiv.style.color = "lime";
  window.botStatsDiv.style.color = "white";
  window.botStatsDiv.style.fontFamily = "monospace";
  window.botStatsDiv.style.fontSize = "14px";
  window.botStatsDiv.style.zIndex = 9999;
  document.body.appendChild(botStatsDiv);
}

// keybinds 1,2,3,4,5,6,7,8,9 and 0
if (window.bot_keyListenerAdded == null) {
  window.bot_keyListenerAdded = true;
  window.addEventListener("keydown", function (e) {
    if (e.key >= "1" && e.key <= "9") {
      bot_directive = parseInt(e.key);
    } else if (e.key === "0") {
      bot_directive = 0;
    }
  });
}

var bot_time = 0;
function bot_process(dt) {
  bot_time += dt;

  // skip iteration if king is dead
  if (board == null || teams == null || selfId == null) {
    return;
  }

  // look at the board for changes
  bot_lookAtPieces();

  // automatically play next move
  bot_act();

  // print the GUI stats
  bot_printGUI();
}

function bot_lookAtPieces() {
  bot_pieces_dt += dt;
  if (bot_pieces_dt > bot_pieces_INTERVAL || bot_kingPiece.length === 0) {
    bot_findPieces();
    bot_pieces_dt = 0;
  }
}

// Format time from milliseconds to h:m:s:ms format
function formatTime(milliseconds) {
  // Calculate hours, minutes, seconds, and remaining milliseconds
  const hours = Math.floor(milliseconds / 3600000);
  milliseconds %= 3600000;

  const minutes = Math.floor(milliseconds / 60000);
  milliseconds %= 60000;

  const seconds = Math.floor(milliseconds / 1000);
  const ms = Math.round(milliseconds % 1000);

  // Format as h:m:s:ms
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}:${ms.toString().padStart(3, "0")}`;
}

function bot_printGUI() {
  bot_stats_dt += dt;
  if (bot_stats_dt > bot_stats_INTERVAL) {
    bot_stats_dt = 0;

    if (bot_GUI) {
      if (window.botStatsDiv != null) {
        // const statsText = `
        //         MODE: ${bot_directive} |
        //         KING: [${bot_kingPiece}] |
        //         Pieces: ${Object.keys(bot_teamPieces).length} |
        //         Saftey: ${bot_safteyFactor} [${bot_safteySquare}] |
        //         Team ID: ${selfId} |
        //         FPS: ${(1000 / dt).toFixed(1)} |
        //         ROUTINE: ${bot_routine_name} |
        //         TIME: ${formatTime(bot_time)}
        //         `;
        const statsText = `
                <h1>RootChess</h1>
                By Tomcat 2025 <br>
                MODE: ${bot_directive} <br> 
                KING: [${bot_kingPiece}] <br> 
                PIECES: ${Object.keys(bot_teamPieces).length} <br> 
                SAFETY: ${bot_safteyFactor} [${bot_safteySquare}] <br> 
                TEAM ID: ${selfId} <br> 
                FPS: ${(1000 / dt).toFixed(1)} <br>
                ROUTINE: ${bot_routine_name} <br>
                TIME: ${formatTime(bot_time)}
                `;

        window.botStatsDiv.innerHTML = statsText;
      }
    }
  }
}

/**
 * Calculates distance between two squares.
 * @param {Array<number>} from - [x1, y1]
 * @param {Array<number>} to - [x2, y2]
 * @returns {number} distance.
 */
function bot_distance(from, to) {
  if (!from || from.length !== 2 || !to || to.length !== 2) return Infinity;

  // King distance (Chebyshev distance) - maximum of the absolute differences
  // This represents the number of king moves needed (all 8 directions)
  return Math.max(Math.abs(from[0] - to[0]), Math.abs(from[1] - to[1]));
}

function bot_findPieces() {
  let teamPieces = {};
  let kingPiece = [];
  let safteyFactor = Infinity;
  let safteySquare = [];

  for (let i = 0; i < boardW; i++) {
    for (let j = 0; j < boardH; j++) {
      if (board[i][j] != ID_EMPTY && teams[i][j] === selfId) {
        // team square
        teamPieces[[i, j].toString()] = board[i][j];
        if (board[i][j] == ID_KING) {
          kingPiece = [i, j];
        }
      } else {
        // enemy square or empty square
        if (bot_kingPiece != null && bot_kingPiece.length == 2) {
          var distance = bot_distance(bot_kingPiece, [i, j]);
          if (distance < safteyFactor) {
            safteyFactor = distance;
            safteySquare = [i, j];
          }
        }
      }
    }
  }

  bot_teamPieces = teamPieces;
  bot_kingPiece = kingPiece;
  bot_safteyFactor = safteyFactor;
  bot_safteySquare = safteySquare;
}

function bot_isValidCoord(x, y) {
  return x >= 0 && x < boardW && y >= 0 && y < boardH;
}

function bot_isValidMove(x, y) {
  return (
    bot_isValidCoord(x, y) &&
    (board[x][y] === ID_EMPTY || (teams[x] != null && teams[x][y] != selfId))
  );
}

function bot_move(from, to) {
  var selectedSquareX = from[0];
  var selectedSquareY = from[1];
  var squareX = to[0];
  var squareY = to[1];

  if (!bot_isValidMove(squareX, squareY)) {
    return false;
  }

  var buf = new Uint16Array(4);
  buf[0] = selectedSquareX;
  buf[1] = selectedSquareY;
  buf[2] = squareX;
  buf[3] = squareY;

  console.log("[bot_process] move:", from, to);

  curMoveCooldown = window.moveCooldown; // anticipate move cooldown

  send(buf);

  return true;
}

function bot_move_king(x_offset, y_offset) {
  var move_to = [bot_kingPiece[0] + x_offset, bot_kingPiece[1] + y_offset];
  return bot_move(bot_kingPiece, move_to);
}

function bot_move_king_right(x_offset, y_offset) {
  return bot_move_king(1, 0);
}

function bot_move_king_left() {
  return bot_move_king(-1, 0);
}

function bot_move_king_up() {
  return bot_move_king(0, -1);
}

function bot_move_king_down() {
  return bot_move_king(0, 1);
}

function bot_act() {
  if (bot_kingPiece.length === 0) {
    return; // if dead, wait for respawn
  }

  if (curMoveCooldown >= bot_currMove_COOLDOWN) {
    return; // if move on coolodwn, wait
  }

  bot_act_directive();
}

function bot_act_directive() {
  if (bot_directive == 0) {
    return;
  }

  if (bot_directive == 1) {
    bot_directive_main();
    return;
  }

  if (bot_directive in [2, 3, 4, 5, 6, 7, 8, 9]) {
    // not implemented for now
    return;
  }
}

function bot_directive_main() {
  // stub method, overriden below in section IV.
}

/************************************************/
/* II. utility implementation below             */
/************************************************/

/**
 * Gets all valid destination squares ([toX, toY]) for a piece at [fromX, fromY].
 * Considers piece type, board boundaries, and captures according to game rules.
 * Includes path checking for sliding pieces.
 * @param {Array<number>} from - [fromX, fromY]
 * @param {number} pieceType - The ID of the piece type (e.g., ID_PAWN).
 * @param {number} teamId - The team ID of the piece making the move.
 * @returns {Array<Array<number>>} A list of valid [toX, toY] coordinates.
 */
function bot_getValidDestinations(from, pieceType, teamId) {
  const [fromX, fromY] = from;
  const destinations = [];

  const checkAndAdd = (toX, toY) => {
    if (!bot_isValidCoord(toX, toY)) return false; // Invalid coordinate

    const targetTeam = teams[toX]?.[toY];
    if (targetTeam === teamId) return false; // Cannot move/capture own team

    destinations.push([toX, toY]);
    // If we hit *any* piece (neutral or enemy), we stop searching further in this direction (for sliders)
    return board[toX]?.[toY] !== ID_EMPTY;
  };

  switch (pieceType) {
    case ID_PAWN:
      // Move: 4 cardinal directions, only to empty squares
      const moveOffsets = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];
      for (const [dx, dy] of moveOffsets) {
        const toX = fromX + dx;
        const toY = fromY + dy;
        if (bot_isValidCoord(toX, toY) && board[toX]?.[toY] === ID_EMPTY) {
          destinations.push([toX, toY]);
        }
      }
      // Capture: 8 directions (like king), only to non-empty, non-ally squares
      const captureOffsets = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ];
      for (const [dx, dy] of captureOffsets) {
        const toX = fromX + dx;
        const toY = fromY + dy;
        if (bot_isValidCoord(toX, toY)) {
          const targetTeam = teams[toX]?.[toY];
          // Can capture if square is not empty AND not on the same team
          if (board[toX]?.[toY] !== ID_EMPTY && targetTeam !== teamId) {
            // Avoid adding duplicate destination if it was already possible via move rule somehow (unlikely for pawn)
            if (!destinations.some((d) => d[0] === toX && d[1] === toY)) {
              destinations.push([toX, toY]);
            }
          }
        }
      }
      break;

    case ID_KNIGHT:
      const knightOffsets = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [dx, dy] of knightOffsets) {
        checkAndAdd(fromX + dx, fromY + dy);
      }
      break;

    case ID_KING:
      const kingOffsets = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ];
      for (const [dx, dy] of kingOffsets) {
        checkAndAdd(fromX + dx, fromY + dy);
      }
      break;

    case ID_ROOK:
    case ID_BISHOP:
    case ID_QUEEN:
      let directions = [];
      if (pieceType === ID_ROOK || pieceType === ID_QUEEN) {
        directions.push(
          ...[
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ]
        ); // Cardinal
      }
      if (pieceType === ID_BISHOP || pieceType === ID_QUEEN) {
        directions.push(
          ...[
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ]
        ); // Diagonal
      }

      for (const [dx, dy] of directions) {
        for (let i = 1; i <= bot_MAX_SLIDER_RANGE; i++) {
          const toX = fromX + i * dx;
          const toY = fromY + i * dy;
          if (!bot_isValidCoord(toX, toY)) break; // Off board

          // Check path using built-in logic here
          // We only need to check the immediately previous square for blockage on step i>1
          if (i > 1) {
            const prevX = fromX + (i - 1) * dx;
            const prevY = fromY + (i - 1) * dy;
            if (board[prevX]?.[prevY] !== ID_EMPTY) {
              break; // Path blocked by piece encountered on previous step
            }
          }

          const stopped = checkAndAdd(toX, toY);
          if (stopped) break; // Stop searching in this direction if we hit a piece
        }
      }
      break;
  }

  // Filter out duplicates just in case (e.g., pawn rule overlap)
  const uniqueDests = Array.from(
    new Set(destinations.map(JSON.stringify)),
    JSON.parse
  );
  return uniqueDests;
}

/**
 * Finds all squares that threaten a given target square.
 * @param {Array<number>} targetSquare - [targetX, targetY]
 * @param {number} attackerTeamId - The team ID of potential attackers to consider (use -1 for any enemy).
 * @returns {Array<Array<number>>} List of coordinates [x, y] of pieces threatening the targetSquare.
 */
function bot_getThreatsTo(targetSquare, attackerTeamId = -1) {
  const [targetX, targetY] = targetSquare;
  const threats = [];

  const check_radius = bot_MAX_SLIDER_RANGE + 1;
  const from_x = Math.max(0, targetX - check_radius);
  const to_x = Math.min(boardW, targetX + check_radius);
  const from_y = Math.max(0, targetY - check_radius);
  const to_y = Math.min(boardH, targetY + check_radius);

  for (let x = from_x; x < to_y; x++) {
    for (let y = from_y; y < to_x; y++) {
      const pieceType = board[x]?.[y];
      const pieceTeam = teams[x]?.[y];

      if (pieceType === ID_EMPTY || pieceTeam === selfId || pieceTeam === 0)
        continue; // Skip empty, own, neutral
      if (attackerTeamId !== -1 && pieceTeam !== attackerTeamId) continue; // Skip if specific enemy team desired and doesn't match

      // Check if this enemy piece can attack the target square
      const destinations = bot_getValidDestinations(
        [x, y],
        pieceType,
        pieceTeam
      );
      if (
        destinations.some((dest) => dest[0] === targetX && dest[1] === targetY)
      ) {
        threats.push([x, y]);
      }
    }
  }
  return threats;
}

/**
 * Finds the closest square to a given target that contains a piece of the specified team.
 * @param {Array<number>} targetSquare - [x, y] coordinates to search from.
 * @param {number} [teamId=0] - The team ID to look for (default is 0 for neutral pieces).
 * @returns {Array<number>|null} [x, y] of the closest matching piece or null if not found.
 */
function bot_findClosestTeamPiece(targetSquare, teamId = 0) {
  let closest = null;
  let minDistance = Infinity;

  for (let i = 0; i < boardW; i++) {
    for (let j = 0; j < boardH; j++) {
      if (teams[i]?.[j] === teamId && board[i]?.[j] !== ID_EMPTY) {
        const dist = bot_distance([i, j], targetSquare);
        if (dist < minDistance) {
          minDistance = dist;
          closest = [i, j];
        }
      }
    }
  }

  return closest;
}

/**
 * Find sqeuence of moves to given target.
 * */
function bot_findPathToTarget(from, to, pieceType, teamId) {
  const queue = [[from, [from]]]; // Each item: [currentCoord, pathSoFar]
  const visited = new Set();
  const toStr = (coord) => coord.join(",");

  visited.add(toStr(from));

  while (queue.length > 0) {
    const [current, path] = queue.shift();

    // Reached the target
    if (current[0] === to[0] && current[1] === to[1]) {
      return path;
    }

    const nextMoves = bot_getValidDestinations(current, pieceType, teamId);

    for (const next of nextMoves) {
      const key = toStr(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push([next, [...path, next]]);
      }
    }
  }

  // No path found
  return null;
}

/************************************************/
/* III. mode routines implementation below      */
/************************************************/

/**
 * Move king to capture neutral pieces if it's the only piece we control.
 * */
function bot_routine_king_march() {
  if (Object.keys(bot_teamPieces).length > 1) {
    return false;
  }

  var closestNeutral = bot_findClosestTeamPiece(bot_kingPiece);
  if (closestNeutral == null) {
    console.log("[bot_routine] KING_MARCH: No neutral pieces nearby.");
    return false;
  }

  console.log(
    "[bot_routine] KING_MARCH: Targeting neutral piece at:",
    closestNeutral
  );

  // Calculate direction to move
  const dx = Math.sign(closestNeutral[0] - bot_kingPiece[0]);
  const dy = Math.sign(closestNeutral[1] - bot_kingPiece[1]);

  // Prioritize the axis with larger difference
  if (
    Math.abs(closestNeutral[0] - bot_kingPiece[0]) >
    Math.abs(closestNeutral[1] - bot_kingPiece[1])
  ) {
    // Move horizontally first
    const moveToX = bot_kingPiece[0] + dx;
    const moveToY = bot_kingPiece[1];
    if (
      bot_isValidCoord(moveToX, moveToY) &&
      teams[moveToX][moveToY] !== selfId
    ) {
      bot_move(bot_kingPiece, [moveToX, moveToY]);
      return true;
    }
    // If horizontal blocked, try vertical
    const moveToY2 = bot_kingPiece[1] + dy;
    if (
      bot_isValidCoord(bot_kingPiece[0], moveToY2) &&
      teams[bot_kingPiece[0]][moveToY2] !== selfId
    ) {
      bot_move(bot_kingPiece, [bot_kingPiece[0], moveToY2]);
      return true;
    }
  } else {
    // Move vertically first
    const moveToX = bot_kingPiece[0];
    const moveToY = bot_kingPiece[1] + dy;
    if (
      bot_isValidCoord(moveToX, moveToY) &&
      teams[moveToX][moveToY] !== selfId
    ) {
      bot_move(bot_kingPiece, [moveToX, moveToY]);
      return true;
    }
    // If vertical blocked, try horizontal
    const moveToX2 = bot_kingPiece[0] + dx;
    if (
      bot_isValidCoord(moveToX2, bot_kingPiece[1]) &&
      teams[moveToX2][bot_kingPiece[1]] !== selfId
    ) {
      bot_move(bot_kingPiece, [moveToX2, bot_kingPiece[1]]);
      return true;
    }
  }

  return false;
}

/**
 * Capture enemy pieces threatening our pieces, prioritizing threats near the king.
 * Avoiding using the king for captures when other options exist.
 * If cannot capture, run away with the king.
 * */
function bot_routine_king_defense() {
  let threatTargets = [];

  // For each of our pieces (including king), check for adjacent enemy pieces
  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    if (!coords || coords.length !== 2) continue;

    // Check 8 adjacent squares for enemy pieces
    const adjacentOffsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];
    for (const [dx, dy] of adjacentOffsets) {
      const x = coords[0] + dx;
      const y = coords[1] + dy;

      if (
        bot_isValidCoord(x, y) &&
        board[x][y] !== ID_EMPTY &&
        teams[x][y] !== 0 &&
        teams[x][y] !== selfId
      ) {
        // Found adjacent enemy piece
        threatTargets.push({
          enemyPiece: [x, y],
          ourPiece: coords,
          distToKing: bot_distance([x, y], bot_kingPiece),
          isKingThreat:
            coords[0] === bot_kingPiece[0] && coords[1] === bot_kingPiece[1],
        });
      }
    }
  }

  // Also check for pieces directly threatening our king
  const directKingThreats = bot_getThreatsTo(bot_kingPiece);
  for (const threat of directKingThreats) {
    // Avoid duplicating threats already found via adjacent check
    if (
      !threatTargets.some(
        (t) =>
          t.enemyPiece[0] === threat[0] &&
          t.enemyPiece[1] === threat[1] &&
          t.isKingThreat === true
      )
    ) {
      threatTargets.push({
        enemyPiece: threat,
        ourPiece: bot_kingPiece,
        distToKing: 0, // Highest priority - direct threat to king
        isKingThreat: true,
      });
    }
  }

  // Sort threats by priority - direct king threats first, then by distance to king
  threatTargets.sort((a, b) => {
    if (a.isKingThreat !== b.isKingThreat) {
      return a.isKingThreat ? -1 : 1; // King threats first
    }
    return a.distToKing - b.distToKing; // Then by distance
  });

  if (threatTargets.length <= 0) {
    return false;
  }

  const highestThreat = threatTargets[0];

  console.log(
    "[bot_routine] KING_DEFENSE: Defending against threat at",
    highestThreat.enemyPiece
  );

  const captureOptions = [];

  // Find non-king pieces that can capture this threat
  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    if (!coords || coords.length !== 2) continue;

    const pieceType = bot_teamPieces[coordStr];

    // Skip checking king for now - we'll only use king if no other options
    if (pieceType === ID_KING) continue;

    const validMoves = bot_getValidDestinations(coords, pieceType, selfId);

    const canCapture = validMoves.some(
      (move) =>
        move[0] === highestThreat.enemyPiece[0] &&
        move[1] === highestThreat.enemyPiece[1]
    );

    if (canCapture) {
      captureOptions.push({
        piece: coords,
        pieceType: pieceType,
        target: highestThreat.enemyPiece,
        isKing: false,
        priority: getPieceValue(pieceType) * -1, // Lower value pieces get higher priority
      });
    }
  }

  // Sort capture options - prefer using lower value pieces first
  captureOptions.sort((a, b) => a.priority - b.priority);

  // If we have non-king capture options, use the best one
  if (captureOptions.length > 0) {
    const bestCapture = captureOptions[0];
    console.log(
      `[bot_routine] KING_DEFENSE: Using ${
        bestCapture.isKing ? "KING" : pieceToString(bestCapture.pieceType)
      } to capture threat at ${bestCapture.target}`
    );
    bot_move(bestCapture.piece, bestCapture.target);
    return true;
  }

  // No non-king captures available - check if king can capture
  if (highestThreat.isKingThreat) {
    const kingMoves = bot_getValidDestinations(bot_kingPiece, ID_KING, selfId);
    const kingCanCapture = kingMoves.some(
      (move) =>
        move[0] === highestThreat.enemyPiece[0] &&
        move[1] === highestThreat.enemyPiece[1]
    );

    if (kingCanCapture) {
      console.log(
        `[bot_routine] KING_DEFENSE: Using KING to capture immediate threat at ${highestThreat.enemyPiece} (no other options available)`
      );
      bot_move(bot_kingPiece, highestThreat.enemyPiece);
      return true;
    }
  }

  // If direct threat to king and no capture possible, move king away
  if (highestThreat.isKingThreat) {
    // Get all valid king moves
    var kingMoves = bot_getValidDestinations(bot_kingPiece, ID_KING, selfId);

    // Filter out moves that are under threat
    var safeMoves = kingMoves.filter((move) => {
      const threatsToMove = bot_getThreatsTo(move);
      return threatsToMove.length === 0;
    });

    // Do any move if none are safe
    if (safeMoves.length === 0) {
      safeMoves = kingMoves;
      console.log(
        `[bot_routine] KING_DEFENSE: No safe moves available for king`
      );
    }

    // Prioritize moves that increase distance from the threat source
    safeMoves.sort((a, b) => {
      const distA = bot_distance(a, highestThreat.enemyPiece);
      const distB = bot_distance(b, highestThreat.enemyPiece);
      return distB - distA; // Prefer farthest from enemy
    });

    console.log(
      `[bot_routine] KING_DEFENSE: Moving king to safe square at ${safeMoves[0]} (avoiding threat)`
    );
    bot_move(bot_kingPiece, safeMoves[0]);
    return true;
  }

  return false;
}

const bot_clusteringThresholds = [Infinity, 3]; // next elements signals next layer of cluster needs filling based on total piece count outside cluster

for (let i = 2; i < 100; i++) {
  bot_clusteringThresholds.push((i ^ 2) - 1); // e.g. 2^2 - 1 = 3, 3^2 - 1 = 8, 4^2 - 1 = 15, etc.
  // This means we expect to have at least i^2 - 1 pieces outside the cluster before moving to next layer
}

/**
 * Move pieces closer to the king. (Create layers around it at given clustering thresholds.)
 * */
function bot_routine_king_cluster() {
  if (
    !bot_safteySquare ||
    bot_safteySquare.length !== 2 ||
    bot_safteyFactor < 0
  ) {
    return false;
  }

  // Step 1: Check if clustering is applicable
  let fartherPieces = 0;
  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    if (coords[0] === bot_kingPiece[0] && coords[1] === bot_kingPiece[1])
      continue;

    const dist = bot_distance(coords, bot_kingPiece);
    if (dist > bot_safteyFactor) {
      fartherPieces++;
    }
  }

  if (bot_safteyFactor >= bot_clusteringThresholds.length) {
    return false;
  }
  const requiredThreshold =
    bot_clusteringThresholds[bot_safteyFactor] || Infinity;
  if (fartherPieces < requiredThreshold) {
    return false;
  }

  // Step 2: Find piece with shortest path to safteySquare
  let bestPiece = null;
  let bestPath = null;

  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    const pieceType = bot_teamPieces[coordStr];
    if (
      pieceType === ID_KING ||
      bot_distance(coords, bot_kingPiece) <= bot_safteyFactor
    )
      continue; // Let’s skip king and clustered pieces for clustering

    const path = bot_findPathToTarget(
      coords,
      bot_safteySquare,
      pieceType,
      selfId
    );
    if (path && path.length > 1) {
      // path includes source, so need at least 2 to have a move
      if (!bestPath || path.length < bestPath.length) {
        bestPiece = coords;
        bestPath = path;
      }
    }
  }

  if (!bestPiece || !bestPath || bestPath.length < 2) {
    return false; // No valid path found
  }

  const nextStep = bestPath[1]; // First move
  console.log(
    `[bot_routine] KING_CLUSTER: Moving piece at ${bestPiece} toward safteySquare at ${bot_safteySquare}`
  );
  bot_move(bestPiece, nextStep);
  return true;
}

const bot_protectionFactor = 20; // every n pieces, expect one more piece on every direct line
/**
 * Move pieces to critical lines to block direct paths to king. (By enemy rooks and bishops.)
 * If the line is full (near edge and has all squares equal to some team piece), then we ignore it (maximally secure).
 * */
/**
 * Move pieces to critical lines to block direct paths to king (from enemy rooks and bishops).
 * Protection level is determined by how many enemy pieces are targeting each line.
 * Uses pieces that are not already on any line and that are at least bot_safteyFactor + 1 away from king.
 */
function bot_routine_king_protection() {
  if (!bot_kingPiece || bot_kingPiece.length !== 2) {
    return false;
  }

  // Map to track attack lines and the enemies attacking along them
  const attackLines = new Map(); // Key: lineId, Value: { squares: [[x,y],...], enemies: [] }

  // Track all our pieces that are already on protection lines
  const piecesOnLines = new Set();

  // Get all sliding pieces (rooks, bishops, queens) of enemy teams
  const slidingEnemies = [];
  for (let x = 0; x < boardW; x++) {
    for (let y = 0; y < boardH; y++) {
      const pieceType = board[x][y];
      const teamId = teams[x][y];

      // Skip if empty, neutral or own team
      if (pieceType === ID_EMPTY || teamId === 0 || teamId === selfId) continue;

      // Check if it's a sliding piece
      if (
        pieceType === ID_ROOK ||
        pieceType === ID_BISHOP ||
        pieceType === ID_QUEEN
      ) {
        slidingEnemies.push({
          coords: [x, y],
          pieceType: pieceType,
          team: teamId,
          distanceToKing: bot_distance([x, y], bot_kingPiece),
        });
      }
    }
  }

  // No sliding enemies found
  if (slidingEnemies.length === 0) {
    return false;
  }

  // Analyze attack lines from each enemy sliding piece
  for (const enemy of slidingEnemies) {
    const [ex, ey] = enemy.coords;
    const [kx, ky] = bot_kingPiece;

    // Determine if the enemy piece can attack along a line to the king
    let dx = 0,
      dy = 0;
    let canAttack = false;
    let lineType = "";

    // Check if on same row/column (rook moves)
    if (ex === kx || ey === ky) {
      if (enemy.pieceType === ID_ROOK || enemy.pieceType === ID_QUEEN) {
        dx = ex === kx ? 0 : ex < kx ? 1 : -1;
        dy = ey === ky ? 0 : ey < ky ? 1 : -1;
        canAttack = true;
        lineType = ex === kx ? `col-${ex}` : `row-${ey}`;
      }
    }
    // Check if on same diagonal (bishop moves)
    else if (Math.abs(ex - kx) === Math.abs(ey - ky)) {
      if (enemy.pieceType === ID_BISHOP || enemy.pieceType === ID_QUEEN) {
        dx = ex < kx ? 1 : -1;
        dy = ey < ky ? 1 : -1;
        canAttack = true;
        // Identify diagonal line by its slope and y-intercept
        const slope = (ey - ky) / (ex - kx);
        const intercept = ey - slope * ex;
        lineType = `diag-${slope.toFixed(0)}-${intercept.toFixed(0)}`;
      }
    }

    if (!canAttack) continue;

    // Analyze the attack line
    const line = [];
    let blocked = false;
    let x = ex + dx,
      y = ey + dy;

    // Trace the path from enemy to king
    while (x !== kx || y !== ky) {
      if (!bot_isValidCoord(x, y)) {
        blocked = true;
        break;
      }

      // Check if square is already occupied
      if (board[x][y] !== ID_EMPTY) {
        // If occupied by enemy or neutral piece, we consider the line broken
        if (teams[x][y] !== selfId) {
          blocked = true;
          break;
        }
        // Record that one of our pieces is already on this line
        piecesOnLines.add(`${x},${y}`);
      }

      // Add this square to the attack line
      line.push([x, y]);
      x += dx;
      y += dy;
    }

    // Skip if line is already blocked
    if (blocked) continue;

    // Record this attack line and the enemy attacking along it
    if (!attackLines.has(lineType)) {
      attackLines.set(lineType, {
        squares: line,
        enemies: [enemy],
        priority: 0, // Will be calculated later
      });
    } else {
      // Add this enemy to the existing line
      attackLines.get(lineType).enemies.push(enemy);
    }
  }

  // No attack lines that need protection
  if (attackLines.size === 0) {
    return false;
  }

  // Calculate priority for each line based on number of enemies and their strength
  for (const [lineId, lineData] of attackLines) {
    const enemyCount = lineData.enemies.length;
    let totalThreatValue = 0;

    // Calculate total threat value of enemies on this line
    for (const enemy of lineData.enemies) {
      totalThreatValue += getPieceValue(enemy.pieceType) / enemy.distanceToKing;
    }

    // Priority = enemyCount (primary) + normalized threat value (secondary)
    lineData.priority = enemyCount * 100 + totalThreatValue;

    // Calculate current protection
    lineData.currentProtection = lineData.squares.filter(
      (pos) =>
        board[pos[0]][pos[1]] !== ID_EMPTY && teams[pos[0]][pos[1]] === selfId
    ).length;

    // Calculate needed protection (equal to number of enemies)
    lineData.neededProtection = Math.max(
      0,
      enemyCount - lineData.currentProtection
    );
  }

  // Convert map to array and sort by priority
  const prioritizedLines = Array.from(attackLines.values())
    .filter((line) => line.neededProtection > 0)
    .sort((a, b) => b.priority - a.priority);

  // No lines needing additional protection
  if (prioritizedLines.length === 0) {
    return false;
  }

  // Find pieces we can use for protection
  // Exclude king and pieces within safetyFactor distance
  const availablePieces = [];
  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    const pieceType = bot_teamPieces[coordStr];

    // Skip king for protection duty
    if (pieceType === ID_KING) continue;

    // Skip pieces already on protection lines
    if (piecesOnLines.has(coordStr)) continue;

    // Skip pieces that are within the safety cluster around the king
    const distanceToKing = bot_distance(coords, bot_kingPiece);
    if (distanceToKing <= bot_safteyFactor) continue;

    availablePieces.push({
      coords: coords,
      pieceType: pieceType,
      value: getPieceValue(pieceType),
    });
  }

  // Sort pieces by value (prefer using less valuable pieces for protection)
  availablePieces.sort((a, b) => a.value - b.value);

  // Try to protect the highest priority line
  for (const targetLine of prioritizedLines) {
    // Find the closest empty square on this line
    const emptySquares = targetLine.squares.filter(
      (pos) => board[pos[0]][pos[1]] === ID_EMPTY
    );

    if (emptySquares.length === 0) continue; // No empty squares to protect on this line

    // Find best piece to move to protect line
    let bestPiece = null;
    let bestTarget = null;
    let bestDistance = Infinity;

    for (const piece of availablePieces) {
      // For each empty square on the line
      for (const targetPos of emptySquares) {
        // Check if this piece can reach the target position directly
        const validMoves = bot_getValidDestinations(
          piece.coords,
          piece.pieceType,
          selfId
        );
        const canReachDirectly = validMoves.some(
          (move) => move[0] === targetPos[0] && move[1] === targetPos[1]
        );

        if (canReachDirectly) {
          // Direct move possible - highest priority
          bestPiece = piece.coords;
          bestTarget = targetPos;
          bestDistance = 1;
          break;
        } else {
          // Try pathfinding if direct move not possible
          const path = bot_findPathToTarget(
            piece.coords,
            targetPos,
            piece.pieceType,
            selfId
          );
          if (path && path.length > 1) {
            const dist = path.length - 1; // Path length minus starting position

            if (dist < bestDistance) {
              bestPiece = piece.coords;
              bestTarget = path[1]; // First move along path
              bestDistance = dist;
            }
          }
        }
      }

      if (bestPiece && bestDistance === 1) break; // Found a direct move, use it
    }

    if (bestPiece && bestTarget) {
      const enemyCount = targetLine.enemies.length;
      const firstEnemy = targetLine.enemies[0];
      console.log(
        `[bot_routine] KING_PROTECTION: Moving piece at ${bestPiece} to protect king from ${enemyCount} enemies including ${pieceToString(
          firstEnemy.pieceType
        )} at ${firstEnemy.coords}`
      );
      bot_move(bestPiece, bestTarget);
      return true;
    }
  }

  return false;
}

const bot_hitmanRange = 20;
const bot_hitmanMass = 40;
/**
 * Aggressively hunts down enemy kings, capturing neutral or enemy pieces along the way.
 * Prioritizes:
 * 1. Direct captures of enemy kings
 * 2. Moves that get pieces closer to enemy kings
 * 3. Opportunistic captures of neutral/enemy pieces that are on the path to kings
 *
 * Only activates when:
 * - At least one enemy king is within bot_hitmanRange
 * - Bot controls at least bot_hitmanMass number of pieces
 */
function bot_routine_hitman() {
  // Check if we have enough pieces to engage in hitman mode
  const ourPieceCount = Object.keys(bot_teamPieces).length;
  if (ourPieceCount < bot_hitmanMass) {
    return false;
  }

  // Step 1: Find all enemy kings on the board
  const enemyKings = [];
  for (let x = 0; x < boardW; x++) {
    for (let y = 0; y < boardH; y++) {
      if (
        board[x][y] === ID_KING &&
        teams[x][y] !== selfId &&
        teams[x][y] !== 0
      ) {
        enemyKings.push({
          coords: [x, y],
          team: teams[x][y],
          distFromOurKing: bot_distance([x, y], bot_kingPiece),
        });
      }
    }
  }

  // No enemy kings found
  if (enemyKings.length === 0) {
    return false;
  }

  // Sort kings by distance (target closest kings first)
  enemyKings.sort((a, b) => a.distFromOurKing - b.distFromOurKing);

  // Exit if no kings are within range
  if (enemyKings[0].distFromOurKing > bot_hitmanRange) {
    return false;
  }

  // Step 2: Check for immediate king captures
  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    const pieceType = bot_teamPieces[coordStr];

    // Skip using king for capturing enemy kings unless no other option
    if (pieceType === ID_KING && Object.keys(bot_teamPieces).length > 1)
      continue;

    const validMoves = bot_getValidDestinations(coords, pieceType, selfId);

    // Check if this piece can capture any enemy king
    for (const enemyKing of enemyKings) {
      if (
        validMoves.some(
          (move) =>
            move[0] === enemyKing.coords[0] && move[1] === enemyKing.coords[1]
        )
      ) {
        console.log(
          `[bot_routine] HITMAN: Capturing enemy king at ${enemyKing.coords} with piece at ${coords}`
        );
        bot_move(coords, enemyKing.coords);
        return true;
      }
    }
  }

  // Step 3: Look for opportunistic captures of enemy pieces
  const captureOptions = [];

  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    const pieceType = bot_teamPieces[coordStr];

    // Skip king unless it's our only piece
    if (pieceType === ID_KING && Object.keys(bot_teamPieces).length > 1)
      continue;

    const validMoves = bot_getValidDestinations(coords, pieceType, selfId);

    // Look for capture moves
    for (const move of validMoves) {
      const [moveX, moveY] = move;
      // If square has a piece and it's not our team
      if (board[moveX][moveY] !== ID_EMPTY && teams[moveX][moveY] !== selfId) {
        const targetPieceType = board[moveX][moveY];
        const targetTeam = teams[moveX][moveY];

        // Calculate priority of this capture
        let priority = getPieceValue(targetPieceType) * 10;

        // Bonus for enemy pieces over neutral pieces
        if (targetTeam !== 0) priority += 50;

        // Calculate how this move affects our distance to closest enemy king
        const currentDistToKing = Math.min(
          ...enemyKings.map((king) => bot_distance(coords, king.coords))
        );
        const newDistToKing = Math.min(
          ...enemyKings.map((king) => bot_distance(move, king.coords))
        );

        // If this move gets us closer to an enemy king, big bonus
        priority += (currentDistToKing - newDistToKing) * 30;

        captureOptions.push({
          from: coords,
          to: move,
          targetType: targetPieceType,
          targetTeam: targetTeam,
          priority: priority,
        });
      }
    }
  }

  if (captureOptions.length > 0) {
    // Sort by priority (highest first)
    captureOptions.sort((a, b) => b.priority - a.priority);
    const bestCapture = captureOptions[0];

    console.log(
      `[bot_routine] HITMAN: Capturing ${pieceToString(
        bestCapture.targetType
      )} at ${bestCapture.to} on path to enemy king`
    );
    bot_move(bestCapture.from, bestCapture.to);
    return true;
  }

  // Step 4: Move pieces toward the closest enemy king using pathfinding
  const moveOptions = [];
  const targetKing = enemyKings[0]; // Focus on closest enemy king

  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    const pieceType = bot_teamPieces[coordStr];

    // Skip moving king to attack unless it's our only piece
    if (pieceType === ID_KING && Object.keys(bot_teamPieces).length > 1)
      continue;

    // Find path to enemy king
    const path = bot_findPathToTarget(
      coords,
      targetKing.coords,
      pieceType,
      selfId
    );

    if (path && path.length > 1) {
      // Calculate priority based on piece value (prefer using less valuable pieces)
      // and how many steps to the king (prefer shorter paths)
      const pieceValue = getPieceValue(pieceType);
      const movePriority = 100 - pieceValue + 1000 / path.length;

      moveOptions.push({
        from: coords,
        to: path[1], // First step in the path
        pieceType: pieceType,
        pathLength: path.length,
        priority: movePriority,
      });
    }
  }

  if (moveOptions.length > 0) {
    // Sort by priority
    moveOptions.sort((a, b) => b.priority - a.priority);
    const bestMove = moveOptions[0];

    console.log(
      `[bot_routine] HITMAN: Moving ${pieceToString(bestMove.pieceType)} at ${
        bestMove.from
      } toward enemy king at ${targetKing.coords}`
    );
    bot_move(bestMove.from, bestMove.to);
    return true;
  }

  // No valid moves found
  return false;
}

/**
 * Capture neutral pieces with non-king pieces to expand control.
 * Use optimal pathfinding to reach targets.
 * */
function bot_routine_expand_nearest() {
  // Find all neutral pieces on the board
  const neutralPieces = [];
  for (let x = 0; x < boardW; x++) {
    for (let y = 0; y < boardH; y++) {
      if (board[x][y] !== ID_EMPTY && teams[x][y] === 0) {
        neutralPieces.push({
          coords: [x, y],
          distToKing: bot_distance([x, y], bot_kingPiece),
          pieceType: board[x][y],
        });
      }
    }
  }

  if (neutralPieces.length === 0) return false;
  neutralPieces.sort((a, b) => a.distToKing - b.distToKing);

  // Step 1: Try immediate captures first
  const captureOptions = [];

  for (const neutralPiece of neutralPieces) {
    if (captureOptions.length >= 5 && neutralPiece.distToKing > 10) continue;

    for (const coordStr in bot_teamPieces) {
      const coords = coordStr.split(",").map(Number);
      const pieceType = bot_teamPieces[coordStr];

      if (pieceType === ID_KING) continue;

      const validMoves = bot_getValidDestinations(coords, pieceType, selfId);
      if (
        validMoves.some(
          (move) =>
            move[0] === neutralPiece.coords[0] &&
            move[1] === neutralPiece.coords[1]
        )
      ) {
        const pieceValue = getPieceValue(neutralPiece.pieceType);
        captureOptions.push({
          from: coords,
          to: neutralPiece.coords,
          priority:
            pieceValue * 5 +
            (20 - neutralPiece.distToKing) * 3 -
            bot_distance(coords, neutralPiece.coords),
        });
      }
    }
  }

  if (captureOptions.length > 0) {
    captureOptions.sort((a, b) => b.priority - a.priority);
    console.log(
      `[bot_routine] EXPAND_NEAREST: Capturing neutral piece at ${captureOptions[0].to}`
    );
    bot_move(captureOptions[0].from, captureOptions[0].to);
    return true;
  }

  // Step 2: Use pathfinding to move pieces toward neutral pieces
  const pathOptions = [];
  const targetNeutralPieces = neutralPieces.slice(0, 5); // Focus on the closest 5 neutral pieces

  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    const pieceType = bot_teamPieces[coordStr];

    // Skip king and pieces already clustered around the king
    if (
      pieceType === ID_KING ||
      bot_distance(coords, bot_kingPiece) <= bot_safteyFactor
    )
      continue;

    for (const neutralPiece of targetNeutralPieces) {
      // Find optimal path to the neutral piece
      const path = bot_findPathToTarget(
        coords,
        neutralPiece.coords,
        pieceType,
        selfId
      );

      if (path && path.length > 1) {
        // Path includes source, so we need at least 2 nodes for a valid move
        const pieceValue = getPieceValue(neutralPiece.pieceType);
        pathOptions.push({
          from: coords,
          to: path[1], // First step in the path
          targetPiece: neutralPiece.coords,
          pieceType: pieceType,
          priority: pieceValue * 3 + (20 - neutralPiece.distToKing) * 5,
          pathLength: path.length,
        });
      }
    }
  }

  if (pathOptions.length > 0) {
    // Sort by shorter path first, then by priority
    pathOptions.sort((a, b) => {
      if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;
      return b.priority - a.priority;
    });

    console.log(
      `[bot_routine] EXPAND_NEAREST: Moving piece along optimal path to neutral piece: ${pathOptions[0].from} -> ${pathOptions[0].to} (targeting ${pathOptions[0].targetPiece})`
    );
    bot_move(pathOptions[0].from, pathOptions[0].to);
    return true;
  }

  // Fallback: Find piece farthest from king and move it toward closest neutral using pathfinding
  let farthestPiece = null;
  let maxDist = -1;

  for (const coordStr in bot_teamPieces) {
    const coords = coordStr.split(",").map(Number);
    const pieceType = bot_teamPieces[coordStr];
    if (pieceType === ID_KING) continue;

    const dist = bot_distance(coords, bot_kingPiece);
    if (dist > maxDist) {
      maxDist = dist;
      farthestPiece = { coords, pieceType };
    }
  }

  if (farthestPiece && neutralPieces.length > 0) {
    const closestNeutral = neutralPieces[0];
    const path = bot_findPathToTarget(
      farthestPiece.coords,
      closestNeutral.coords,
      farthestPiece.pieceType,
      selfId
    );

    if (path && path.length > 1) {
      console.log(
        `[bot_routine] EXPAND_NEAREST: Fallback... moving farthest piece ${farthestPiece.coords} along optimal path to neutral at ${closestNeutral.coords}`
      );
      bot_move(farthestPiece.coords, path[1]);
      return true;
    }
  }

  return false;
}

/************************************************/
/* IV. directive implementation below           */
/************************************************/

var cycle = 0;
function bot_directive_main() {
  cycle += 1;
  console.log(`${formatTime(bot_time)}` + " CYCLE: " + cycle);

  if (bot_routine_king_march()) {
    bot_routine_name = "KING_MARCH";
    return;
  }
  if (bot_routine_king_defense()) {
    bot_routine_name = "KING_DEFENSE";
    return;
  }
  if (bot_routine_king_cluster()) {
    bot_routine_name = "KING_CLUSTER";
    return;
  }
  if (bot_routine_king_protection()) {
    bot_routine_name = "KING_PROTECTION";
    return;
  }
  if (bot_routine_expand_nearest()) {
    bot_routine_name = "EXPAND_NEAREST";
    return;
  }
  if (bot_routine_hitman()) {
    bot_routine_name = "HITMAN";
    return;
  } // will never trigger since expand rearest always triggers
}

/***********************************************/
/* V. override original client functions below */
/***********************************************/

// override original function from client.js modified with few custom tweaks, e.g. to use "bot_process(dt)" function
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

  bot_process(dt);

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

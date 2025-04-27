globalThis.boardW = 64; //64//512;
globalThis.boardH = 64; //64//512;

globalThis.moveCooldown = 1.5 * 1000;

globalThis.respawnTime = 5 * 1000;

Array.prototype.random = function () {
  return this[Math.floor(Math.random() * this.length)];
};

globalThis.generateLegalMoves = (x, y, board, teams) => {
  const type = board[x][y];
  const selfId = teams[x][y];
  return moveMap[type](x, y, board, teams, selfId);
};

const moveMap = [
  undefined,
  // pawn
  (x, y, board, teams, selfId) => {
    const arr = [
      [x + 1, y + 0],
      [x - 1, y + 0],
      [x + 0, y + 1],
      [x + 0, y - 1],
    ].filter(
      (m) =>
        m[0] >= 0 &&
        m[1] >= 0 &&
        m[0] < boardW &&
        m[1] < boardH &&
        teams[m[0]][m[1]] !== selfId /* && board[m[0]][m[1]] === 0*/
    );

    const diagonals = [
      [x + 1, y + 1],
      [x + 1, y - 1],
      [x - 1, y + 1],
      [x - 1, y - 1],
    ].filter(
      (m) =>
        m[0] >= 0 &&
        m[1] >= 0 &&
        m[0] < boardW &&
        m[1] < boardH &&
        teams[m[0]][m[1]] !== selfId &&
        board[m[0]][m[1]] !== 0
    );

    return [...arr, ...diagonals];
  },
  // knight
  (x, y, board, teams, selfId) => {
    return [
      [x + 1, y + 2],
      [x + 2, y + 1],
      [x + 2, y - 1],
      [x + 1, y - 2],
      [x - 1, y - 2],
      [x - 2, y - 1],
      [x - 2, y + 1],
      [x - 1, y + 2],
    ].filter(
      (m) =>
        m[0] >= 0 &&
        m[1] >= 0 &&
        m[0] < boardW &&
        m[1] < boardH &&
        teams[m[0]][m[1]] !== selfId
    );
  },
  // bishop
  (x, y, board, teams, selfId) => {
    let moves = [];

    getAllStraightLineMoves(moves, x, y, 1, 1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, 1, -1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, -1, 1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, -1, -1, board, teams, selfId);

    return moves;
  },
  // rook
  (x, y, board, teams, selfId) => {
    let moves = [];

    getAllStraightLineMoves(moves, x, y, 1, 0, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, 0, 1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, -1, 0, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, 0, -1, board, teams, selfId);

    return moves;
  },
  // queen
  (x, y, board, teams, selfId) => {
    let moves = [];

    getAllStraightLineMoves(moves, x, y, 1, 1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, 1, -1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, -1, 1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, -1, -1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, 1, 0, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, 0, 1, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, -1, 0, board, teams, selfId);
    getAllStraightLineMoves(moves, x, y, 0, -1, board, teams, selfId);

    return moves;
  },
  // king
  (x, y, board, teams, selfId) => {
    return [
      [x + 1, y + 0],
      [x - 1, y + 0],
      [x + 0, y + 1],
      [x + 0, y - 1],

      [x + 1, y + 1],
      [x + 1, y - 1],
      [x - 1, y + 1],
      [x - 1, y - 1],
    ].filter(
      (m) =>
        m[0] >= 0 &&
        m[1] >= 0 &&
        m[0] < boardW &&
        m[1] < boardH &&
        teams[m[0]][m[1]] !== selfId
    );
  },
];

function getAllStraightLineMoves(
  moves,
  x,
  y,
  xInc,
  yInc,
  board,
  teams,
  selfId,
  maxRange = 22
) {
  let curX = x + xInc;
  let curY = y + yInc;
  for (let i = 0; i < maxRange; i++) {
    // if we hit a wall, break
    if (
      curX < 0 ||
      curX >= boardW ||
      curY < 0 ||
      curY >= boardH ||
      teams[curX][curY] === selfId
    )
      break;

    moves.push([curX, curY]);

    // if this move was a capture, break
    if (board[curX][curY] !== 0) break;

    curX += xInc;
    curY += yInc;
  }
}

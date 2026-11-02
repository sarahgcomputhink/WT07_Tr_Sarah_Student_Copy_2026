const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const FLOOR_TOP = 490;
const SURVIVAL_GOAL = 90;
const BUILD_SIZE = 40;
const PLAYER_REACH = 115;
const PLAYER_MOVE_SPEED = 220;

let player;
let ground;
let salvage = [];
let enemies = [];
let builtPlatforms = [];
let gameState = 'title';
let health = 100;
let scrap = 6;
let survivalTime = 0;
let spawnTimer = 0;
let damageTimer = 0;
let jumpQueued = false;
let pressedKeys = new Set();
let statusMessage = '';
let statusTimer = 0;
let gameResult = '';

function setup() {
  const gameCanvas = createCanvas(GAME_WIDTH, GAME_HEIGHT);
  gameCanvas.parent('game-canvas');
  world.gravity.y = 12;

  const canvasElement = document.querySelector('#game-canvas canvas');
  canvasElement.tabIndex = 0;
  canvasElement.addEventListener('pointerdown', handleCanvasPointerDown);
  canvasElement.addEventListener('contextmenu', (event) => event.preventDefault());
  document.querySelector('#start-button').addEventListener('click', startGame);
  window.addEventListener('keydown', handleGlobalKeyDown, true);
  window.addEventListener('keyup', handleGlobalKeyUp, true);
  window.addEventListener('blur', clearPressedKeys);
  updateStartButton();
}

function update() {
  if (gameState === 'playing') {
    updateGame();
  }
}

function draw() {
  drawBackdrop();

  if (gameState === 'title') {
    drawTitleScreen();
    return;
  }

  drawWorld();
  drawHud();

  if (gameState === 'gameover') {
    drawEndScreen();
  }
}

function drawBackdrop() {
  background(8, 13, 30);
  noStroke();
  for (let i = 0; i < 55; i++) {
    const starX = (i * 173 + 37) % GAME_WIDTH;
    const starY = (i * 83 + 19) % 345;
    fill(150, 210, 255, 100 + (i % 3) * 45);
    circle(starX, starY, i % 5 === 0 ? 3 : 2);
  }
  fill(17, 26, 43);
  rect(0, 390, GAME_WIDTH, 150);
  fill(28, 42, 59);
  for (let x = 0; x < GAME_WIDTH; x += 80) {
    rect(x, 442 + (x % 3) * 5, 48, 48);
  }
}

function drawTitleScreen() {
  fill(3, 8, 20, 220);
  rect(70, 65, 820, 390, 18);

  textAlign(CENTER, CENTER);
  fill('#67e8ff');
  textSize(42);
  text('ORBITAL OUTPOST', GAME_WIDTH / 2, 130);

  fill(235);
  textSize(18);
  text('A salvage crew is the last line of defense on a hostile moon.', GAME_WIDTH / 2, 185);
  text('Survive for 90 seconds. Build smart, and keep the drones away.', GAME_WIDTH / 2, 215);

  fill('#b4c6df');
  textSize(15);
  text('A / D  Move     W or SPACE  Jump', GAME_WIDTH / 2, 280);
  text('LEFT CLICK  Mine nearby salvage or attack a nearby drone', GAME_WIDTH / 2, 312);
  text('RIGHT CLICK  Build an alloy platform (costs 2 scrap)', GAME_WIDTH / 2, 342);

  fill('#9dffb0');
  textSize(20);
  text('Click the game or press ENTER to begin', GAME_WIDTH / 2, 405);
  textAlign(LEFT, BASELINE);
}

function startGame() {
  removeGameSprites();
  pressedKeys.clear();
  health = 100;
  scrap = 6;
  survivalTime = 0;
  spawnTimer = 4;
  damageTimer = 0;
  statusMessage = 'Mine salvage for scrap, then build with right click.';
  statusTimer = 4;
  gameResult = '';

  ground = new Sprite(GAME_WIDTH / 2, FLOOR_TOP + 25, GAME_WIDTH, 50, 'static');
  ground.opacity = 0;
  ground.color = '#35445a';
  ground.stroke = '#70859d';

  player = new Sprite(160, FLOOR_TOP - 24, 28, 44);
  player.opacity = 0;
  player.color = '#42d8d0';
  player.stroke = '#c9ffff';
  player.rotationLock = true;
  player.gameType = 'player';

  createSalvage(250, FLOOR_TOP - 25, 'tree');
  createSalvage(455, FLOOR_TOP - 18, 'crate');
  createSalvage(650, FLOOR_TOP - 18, 'crate');
  createSalvage(800, FLOOR_TOP - 25, 'tree');

  const firstDrone = createEnemy(760);
  firstDrone.gameDirection = -1;
  gameState = 'playing';
  updateStartButton();
  document.querySelector('#game-canvas canvas').focus();
}

function removeGameSprites() {
  if (player) player.remove();
  if (ground) ground.remove();
  for (const item of salvage) item.remove();
  for (const enemy of enemies) enemy.remove();
  for (const platform of builtPlatforms) platform.remove();

  salvage = [];
  enemies = [];
  builtPlatforms = [];
}

function createSalvage(x, y, kind) {
  const size = kind === 'tree' ? [26, 52] : [38, 34];
  const item = new Sprite(x, y, size[0], size[1], 'static');
  item.opacity = 0;
  item.gameType = kind;
  item.gameReward = kind === 'tree' ? 3 : 2;
  item.color = kind === 'tree' ? '#6fd18b' : '#e5a84f';
  item.stroke = kind === 'tree' ? '#c1ffd0' : '#ffe0a6';
  salvage.push(item);
}

function createEnemy(x) {
  const enemy = new Sprite(x, FLOOR_TOP - 24, 34, 34);
  enemy.opacity = 0;
  enemy.color = '#fa5972';
  enemy.stroke = '#ffd2da';
  enemy.rotationLock = true;
  enemy.gameType = 'drone';
  enemy.gameHp = 2;
  enemy.gameDirection = x < GAME_WIDTH / 2 ? 1 : -1;
  enemies.push(enemy);
  return enemy;
}

function updateGame() {
  survivalTime += deltaTime / 1000;
  spawnTimer -= deltaTime / 1000;
  damageTimer -= deltaTime / 1000;
  statusTimer -= deltaTime / 1000;

  const moveDirection =
    (pressedKeys.has('KeyD') ? 1 : 0) -
    (pressedKeys.has('KeyA') ? 1 : 0);
  player.vel.x = 0;
  player.x = constrain(
    player.x + moveDirection * PLAYER_MOVE_SPEED * deltaTime / 1000,
    player.w / 2,
    GAME_WIDTH - player.w / 2
  );

  if (jumpQueued) {
    player.vel.y = -8.5;
    jumpQueued = false;
  }

  moveEnemies();
  damagePlayerIfTouched();
  removeOffscreenEnemies();

  if (spawnTimer <= 0 && enemies.length < 5) {
    const edgeX = random() < 0.5 ? 35 : GAME_WIDTH - 35;
    createEnemy(edgeX);
    spawnTimer = 7;
  }

  if (survivalTime >= SURVIVAL_GOAL) {
    finishGame('win');
  } else if (health <= 0) {
    finishGame('lose');
  }
}

function moveEnemies() {
  for (const enemy of enemies) {
    const direction = player.x < enemy.x ? -1 : 1;
    enemy.gameDirection = direction;
    enemy.vel.x = direction * 1.15;
    enemy.x = constrain(enemy.x, enemy.w / 2, GAME_WIDTH - enemy.w / 2);
  }
}

function damagePlayerIfTouched() {
  if (damageTimer > 0) return;

  const touchingEnemy = enemies.some((enemy) => {
    return dist(player.x, player.y, enemy.x, enemy.y) < 37;
  });

  if (touchingEnemy) {
    health = max(0, health - 12);
    damageTimer = 0.9;
    statusMessage = 'Drone hit! Keep moving or attack it.';
    statusTimer = 1.6;
  }
}

function removeOffscreenEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].y > GAME_HEIGHT + 80) {
      enemies[i].remove();
      enemies.splice(i, 1);
    }
  }
}

function drawWorld() {
  drawMoonSurface();
  drawDecorations();
  drawPlatformDetails();
  drawPlayerDetails();
  drawEnemyDetails();
}

function drawMoonSurface() {
  noStroke();
  fill('#52647a');
  rect(0, FLOOR_TOP, GAME_WIDTH, GAME_HEIGHT - FLOOR_TOP);
  fill('#8494a2');
  rect(0, FLOOR_TOP, GAME_WIDTH, 5);
}

function drawDecorations() {
  for (let x = 35; x < GAME_WIDTH; x += 95) {
    fill(106, 128, 147, 130);
    ellipse(x, FLOOR_TOP + 21 + (x % 4) * 3, 22, 5);
  }

  for (const item of salvage) {
    if (item.gameType === 'tree') {
      fill('#8b603b');
      rect(item.x - 4, item.y + 3, 8, 21);
      fill('#63d78b');
      triangle(item.x, item.y - 28, item.x - 18, item.y + 5, item.x + 18, item.y + 5);
    } else {
      fill('#cf8b3c');
      rect(item.x - 16, item.y - 12, 32, 24, 4);
      stroke('#ffdb8d');
      line(item.x - 12, item.y - 4, item.x + 12, item.y - 4);
      noStroke();
    }
  }
}

function drawPlatformDetails() {
  for (const platform of builtPlatforms) {
    noStroke();
    fill('#4ba9bb');
    rect(platform.x - platform.w / 2, platform.y - platform.h / 2, platform.w, platform.h, 4);
    stroke('#b2f6ff');
    noFill();
    rect(platform.x - platform.w / 2, platform.y - platform.h / 2, platform.w, platform.h, 4);
    noStroke();
    fill('#9fe9ee');
    rect(platform.x - 3, platform.y - 3, 6, 6);
  }
}

function drawPlayerDetails() {
  if (!player) return;
  noStroke();
  fill('#d7fffb');
  rect(player.x - 7, player.y - 8, 14, 15, 5);
  fill('#15374a');
  rect(player.x - 4, player.y - 5, 8, 5, 2);
  fill('#c4f8ff');
  rect(player.x - 11, player.y + 14, 8, 8, 2);
  rect(player.x + 3, player.y + 14, 8, 8, 2);
}

function drawEnemyDetails() {
  for (const enemy of enemies) {
    noStroke();
    fill('#fa5972');
    ellipse(enemy.x, enemy.y, enemy.w, enemy.h);
    fill('#c54475');
    triangle(enemy.x - 13, enemy.y - 5, enemy.x - 23, enemy.y - 14, enemy.x - 19, enemy.y + 2);
    triangle(enemy.x + 13, enemy.y - 5, enemy.x + 23, enemy.y - 14, enemy.x + 19, enemy.y + 2);
    fill('#ffe2e7');
    circle(enemy.x - 6, enemy.y - 2, 5);
    circle(enemy.x + 6, enemy.y - 2, 5);
    fill('#712f55');
    rect(enemy.x - 6, enemy.y + 7, 12, 4, 2);
  }
}

function drawHud() {
  fill(5, 11, 24, 220);
  noStroke();
  rect(12, 12, GAME_WIDTH - 24, 58, 10);

  fill('#ffffff');
  textAlign(LEFT, CENTER);
  textSize(16);
  text(`HEALTH ${health}`, 28, 32);
  fill('#ff6d83');
  rect(28, 48, 130, 9, 4);
  fill('#75f0b3');
  rect(28, 48, 130 * health / 100, 9, 4);

  fill('#ffe69b');
  text(`SCRAP ${scrap}`, 195, 40);
  fill('#a9d8ff');
  text(`SURVIVE ${max(0, Math.ceil(SURVIVAL_GOAL - survivalTime))}s`, 315, 40);
  fill('#c5d5e8');
  text('A / D move   W / SPACE jump   LEFT click mine / attack   RIGHT click build', 500, 40);

  if (statusTimer > 0 && statusMessage) {
    textAlign(CENTER, CENTER);
    textSize(14);
    fill('#ffffff');
    text(statusMessage, GAME_WIDTH / 2, GAME_HEIGHT - 20);
  }
  textAlign(LEFT, BASELINE);
}

function drawEndScreen() {
  fill(3, 8, 20, 220);
  noStroke();
  rect(190, 160, 580, 220, 16);
  textAlign(CENTER, CENTER);
  fill(gameResult === 'win' ? '#9dffb0' : '#ff8798');
  textSize(38);
  text(gameResult === 'win' ? 'OUTPOST SECURED!' : 'OUTPOST LOST', GAME_WIDTH / 2, 225);
  fill('#ffffff');
  textSize(18);
  text(
    gameResult === 'win'
      ? 'You held the line until rescue arrived.'
      : 'The drones overwhelmed your defenses.',
    GAME_WIDTH / 2,
    278
  );
  fill('#b8d7f0');
  textSize(16);
  text('Press ENTER to play again', GAME_WIDTH / 2, 330);
  textAlign(LEFT, BASELINE);
}

function finishGame(result) {
  gameResult = result;
  gameState = 'gameover';
  updateStartButton();
  player.vel.x = 0;
  player.vel.y = 0;
  for (const enemy of enemies) {
    enemy.vel.x = 0;
    enemy.vel.y = 0;
  }
}

function mineOrAttack() {
  const clickedEnemy = enemies.find((enemy) => {
    const insideDrone =
      abs(mouseX - enemy.x) < enemy.w / 2 + 8 &&
      abs(mouseY - enemy.y) < enemy.h / 2 + 8;
    return insideDrone && dist(player.x, player.y, enemy.x, enemy.y) <= PLAYER_REACH;
  });

  if (clickedEnemy) {
    clickedEnemy.gameHp -= 1;
    statusMessage = 'Drone hit!';
    statusTimer = 0.8;
    if (clickedEnemy.gameHp <= 0) {
      scrap += 2;
      clickedEnemy.remove();
      enemies.splice(enemies.indexOf(clickedEnemy), 1);
      statusMessage = 'Drone disabled. +2 scrap.';
      statusTimer = 1.5;
    }
    return;
  }

  const clickedSalvage = salvage.find((item) => {
    const insideTarget =
      abs(mouseX - item.x) < item.w / 2 + 8 &&
      abs(mouseY - item.y) < item.h / 2 + 8;
    return insideTarget && dist(player.x, player.y, item.x, item.y) <= PLAYER_REACH;
  });

  if (!clickedSalvage) {
    statusMessage = 'Move closer and click a salvage object or drone.';
    statusTimer = 1.5;
    return;
  }

  scrap += clickedSalvage.gameReward;
  clickedSalvage.remove();
  salvage.splice(salvage.indexOf(clickedSalvage), 1);
  statusMessage = `Salvage collected. +${clickedSalvage.gameReward} scrap.`;
  statusTimer = 1.5;
}

function buildPlatform() {
  if (scrap < 2) {
    statusMessage = 'Not enough scrap. Mine salvage or disable a drone.';
    statusTimer = 1.8;
    return;
  }

  const buildX = round(mouseX / BUILD_SIZE) * BUILD_SIZE;
  const buildY = round(mouseY / BUILD_SIZE) * BUILD_SIZE;
  const inReach = dist(player.x, player.y, buildX, buildY) <= PLAYER_REACH;
  const withinWorld = buildX > BUILD_SIZE / 2 && buildX < GAME_WIDTH - BUILD_SIZE / 2;
  const aboveSurface = buildY < FLOOR_TOP - BUILD_SIZE / 2;
  const overlapsPlatform = builtPlatforms.some((platform) => {
    return abs(platform.x - buildX) < BUILD_SIZE && abs(platform.y - buildY) < BUILD_SIZE;
  });
  const overlapsPlayer =
    abs(player.x - buildX) < player.w / 2 + BUILD_SIZE / 2 &&
    abs(player.y - buildY) < player.h / 2 + BUILD_SIZE / 2;

  if (!inReach || !withinWorld || !aboveSurface || overlapsPlatform || overlapsPlayer) {
    statusMessage = 'Choose a clear spot nearby, above the ground.';
    statusTimer = 1.6;
    return;
  }

  const platform = new Sprite(buildX, buildY, BUILD_SIZE, 12, 'static');
  platform.color = '#4ba9bb';
  platform.stroke = '#b2f6ff';
  builtPlatforms.push(platform);
  scrap -= 2;
  statusMessage = 'Alloy platform built. -2 scrap.';
  statusTimer = 1.5;
}

function handleGlobalKeyDown(event) {
  const pressedKey = getGameKey(event);

  if (gameState === 'playing') {
    if (['KeyA', 'KeyD', 'KeyW', 'Space'].includes(pressedKey)) {
      event.preventDefault();
    }

    pressedKeys.add(pressedKey);
    if (!event.repeat && pressedKey === 'KeyA') movePlayer(-1);
    if (!event.repeat && pressedKey === 'KeyD') movePlayer(1);
    if (['KeyW', 'Space'].includes(pressedKey) && !event.repeat) jumpQueued = true;
    return;
  }

  if (pressedKey === 'Enter' && (gameState === 'title' || gameState === 'gameover')) {
    event.preventDefault();
    startGame();
  }
}

function handleGlobalKeyUp(event) {
  pressedKeys.delete(getGameKey(event));
}

function clearPressedKeys() {
  pressedKeys.clear();
}

function getGameKey(event) {
  if (event.code) return event.code;

  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'd' || key === 'w') {
    return `Key${key.toUpperCase()}`;
  }
  if (key === ' ') return 'Space';
  return event.key;
}

function movePlayer(direction) {
  if (gameState !== 'playing') return;

  player.x = constrain(
    player.x + direction * 12,
    player.w / 2,
    GAME_WIDTH - player.w / 2
  );
}

function handleCanvasPointerDown(event) {
  event.preventDefault();
  event.currentTarget.focus();

  const canvasBounds = event.currentTarget.getBoundingClientRect();
  mouseX = (event.clientX - canvasBounds.left) * GAME_WIDTH / canvasBounds.width;
  mouseY = (event.clientY - canvasBounds.top) * GAME_HEIGHT / canvasBounds.height;

  if (gameState === 'title' || gameState === 'gameover') {
    startGame();
    return;
  }

  if (gameState !== 'playing') return;

  if (event.button === 0) {
    mineOrAttack();
  } else if (event.button === 2) {
    buildPlatform();
  }
}

function updateStartButton() {
  const startButton = document.querySelector('#start-button');
  const showButton = gameState === 'title' || gameState === 'gameover';
  startButton.hidden = !showButton;
  startButton.textContent = gameState === 'gameover' ? 'Play Again' : 'Start Game';
}

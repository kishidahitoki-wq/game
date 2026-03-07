// Game Configuration
const GAME_WIDTH = 800;
const GAME_HEIGHT = 450;
const INITIAL_SPEED = 5;
const MAX_HP = 100;
const MIN_SPEED = 3;
const MAX_SPEED = 12;
const GRAVITY = 0.6;
const GROUND_Y = GAME_HEIGHT - 50;

// Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const hpBar = document.getElementById('hp-bar');
const startMenu = document.getElementById('start-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');

// Game State Enum
const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    GAME_OVER: 'game_over'
};

let gameState = GameState.MENU;
let animationFrameId;

// Game Variables
let gameSpeed = INITIAL_SPEED;
let score = 0;
let hp = MAX_HP;
let distanceTraveled = 0;
let lastTime = 0;

// Inputs
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowRight: false,
    ArrowLeft: false
};

// Listeners
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
        e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
        e.preventDefault();
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function resizeCanvas() {
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
}
resizeCanvas();

// --- Entities ---
const catImg = new Image();
catImg.src = 'images/cat.png';

class Player {
    constructor() {
        this.width = 40;
        this.originalHeight = 40;
        this.height = this.originalHeight;
        this.x = 100;
        this.y = GROUND_Y - this.height;
        this.vy = 0;
        this.vx = 0;
        this.jumpForce = -12;
        this.grounded = false;
        this.color = '#0ea5e9';
        this.invulnerableTime = 0;
    }

    update(deltaTime) {
        if (this.invulnerableTime > 0) {
            this.invulnerableTime -= deltaTime;
        }

        // Horizontal Movement
        if (keys.ArrowRight) {
            this.vx = Math.min(6, this.vx + 0.5);
        } else if (keys.ArrowLeft) {
            this.vx = Math.max(-6, this.vx - 0.5);
        } else {
            if (this.vx > 0) {
                this.vx = Math.max(0, this.vx - 0.3);
            } else if (this.vx < 0) {
                this.vx = Math.min(0, this.vx + 0.3);
            }
        }

        this.x += this.vx;

        // Screen Boundaries
        if (this.x < 10) {
            this.x = 10;
            this.vx = 0;
        } else if (this.x > GAME_WIDTH - this.width - 10) {
            this.x = GAME_WIDTH - this.width - 10;
            this.vx = 0;
        }

        // Jump
        if (keys.ArrowUp && this.grounded) {
            this.vy = this.jumpForce;
            this.grounded = false;
        }

        // Gravity
        this.y += this.vy;
        if (this.y + this.height < GROUND_Y) {
            this.vy += GRAVITY;
            this.grounded = false;
        } else {
            this.vy = 0;
            this.grounded = true;
            this.y = GROUND_Y - this.height;
        }

        // Duck
        if (keys.ArrowDown) {
            this.height = this.originalHeight / 2;
            if (this.grounded) {
                this.y = GROUND_Y - this.height;
            } else {
                this.vy += GRAVITY * 1.5;
            }
        } else {
            this.height = this.originalHeight;
            if (this.grounded) {
                this.y = GROUND_Y - this.height;
            }
        }
    }

    draw() {
        if (this.invulnerableTime > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            return; // Flicker effect
        }

        ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        if (catImg.complete) {
            ctx.drawImage(catImg, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Obstacle {
    constructor(type) {
        this.x = GAME_WIDTH;
        this.type = type; // 'low' (jump over) or 'high' (duck under)
        this.width = 30;
        this.height = 40;
        this.passed = false;

        if (type === 'low') {
            this.y = GROUND_Y - this.height;
            this.color = '#ef4444'; // Red
        } else {
            this.y = GROUND_Y - this.height - 40; // Hovering
            this.color = '#f59e0b'; // Amber
        }
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;

        if (this.type === 'low') {
            // e.g. Trash can / Box
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else {
            // e.g. Crow / Hanging sign
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
}

class Item {
    constructor() {
        this.x = GAME_WIDTH;
        this.y = GROUND_Y - 30 - Math.random() * 60; // Random height
        this.width = 20;
        this.height = 20;
        this.color = '#eab308'; // Yellow/Gold
        this.collected = false;
        this.spin = 0;
    }

    update() {
        this.x -= gameSpeed;
        this.spin += 0.1;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.spin);
        // Coin shape
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.shadowBlur = 0;
    }
}

let player;
let obstacles = [];
let items = [];
let spawnTimer = 0;
let itemSpawnTimer = 0;

// --- Game Functions ---

function startGame() {
    gameState = GameState.PLAYING;
    gameSpeed = INITIAL_SPEED;
    score = 0;
    hp = MAX_HP;
    distanceTraveled = 0;

    player = new Player();
    obstacles = [];
    items = [];
    spawnTimer = 0;
    itemSpawnTimer = 0;

    updateHUD();
    startMenu.classList.remove('active');
    gameOverMenu.classList.remove('active');

    lastTime = performance.now();
    cancelAnimationFrame(animationFrameId);
    gameLoop(lastTime);
}

function gameOver() {
    gameState = GameState.GAME_OVER;
    finalScoreEl.innerText = Math.floor(score);
    gameOverMenu.classList.add('active');
}

function updateHUD() {
    scoreEl.innerText = Math.floor(score);
    const hpPercent = Math.max(0, Math.min(100, (hp / MAX_HP) * 100));
    hpBar.style.width = `${hpPercent}%`;
    if (hpPercent <= 30) {
        hpBar.classList.add('low');
    } else {
        hpBar.classList.remove('low');
    }
}

function checkCollision(obj1, obj2) {
    return (
        obj1.x < obj2.x + obj2.width &&
        obj1.x + obj1.width > obj2.x &&
        obj1.y < obj2.y + obj2.height &&
        obj1.y + obj1.height > obj2.y
    );
}

function gameLoop(timestamp) {
    if (gameState !== GameState.PLAYING) return;

    const deltaTime = timestamp - lastTime || 16.6; // fallback for first frame
    lastTime = timestamp;

    update(deltaTime);
    draw();

    if (hp > 0) {
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        gameOver();
    }
}

function update(deltaTime) {
    // Game speed smoothly increases as distance is traveled
    const targetSpeed = INITIAL_SPEED + distanceTraveled * 0.0001;
    if (gameSpeed < targetSpeed) {
        gameSpeed += 0.02;
    }
    gameSpeed = Math.min(MAX_SPEED, gameSpeed);

    player.update(deltaTime);

    // Entity Spawning
    spawnTimer += deltaTime;
    // Spawn rate based on speed
    if (spawnTimer > 1500 * (INITIAL_SPEED / gameSpeed)) {
        spawnTimer = 0;
        const type = Math.random() > 0.5 ? 'low' : 'high';
        obstacles.push(new Obstacle(type));
    }

    itemSpawnTimer += deltaTime;
    if (itemSpawnTimer > 2000 * (INITIAL_SPEED / gameSpeed)) {
        itemSpawnTimer = 0;
        if (Math.random() > 0.3) {
            items.push(new Item());
        }
    }

    // Sub-Updates
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.update();

        // Collision Check
        if (checkCollision(player, obs)) {
            if (player.invulnerableTime <= 0) {
                hp -= 20;
                player.invulnerableTime = 1000; // 1 second invulnerability
                updateHUD();
            }
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        item.update();

        if (!item.collected && checkCollision(player, item)) {
            score += 50;
            item.collected = true;
            updateHUD();
            items.splice(i, 1);
            continue;
        }

        if (item.x + item.width < 0) {
            items.splice(i, 1);
        }
    }

    // Score based on distance
    distanceTraveled += gameSpeed;
    score += gameSpeed * 0.02;

    updateHUD();
}

function draw() {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    let offset = (distanceTraveled * 0.5) % 45;
    for (let x = GAME_WIDTH + offset; x > 0; x -= 45) {
        ctx.beginPath();
        ctx.moveTo(x - offset, 0);
        ctx.lineTo(x - offset, GROUND_Y);
        ctx.stroke();
    }

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, GROUND_Y, GAME_WIDTH, 50);
    ctx.fillStyle = '#38bdf8';

    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 15;
    ctx.fillRect(0, GROUND_Y, GAME_WIDTH, 2);
    ctx.shadowBlur = 0;

    // Draw Entities
    for (let item of items) {
        item.draw();
    }

    for (let obs of obstacles) {
        obs.draw();
    }

    if (player) {
        player.draw();
    }
}
draw();

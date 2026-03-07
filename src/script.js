// Game Configuration
const GAME_WIDTH = 800;
const GAME_HEIGHT = 450;
const INITIAL_SPEED = 5;
const MAX_HP = 100;
const MIN_SPEED = 3;
const MAX_SPEED = 12;
const GRAVITY = 0.6;
const BASE_GROUND_Y = GAME_HEIGHT - 50;

class TerrainSegment {
    constructor(type, startX, startY, length, isHole = false) {
        this.type = type;
        this.x = startX;
        this.startY = startY;
        this.length = length;
        this.isHole = isHole;
        this.endY = startY;

        if (type === 'slope_up') {
            this.endY = startY - 80;
        } else if (type === 'slope_down') {
            this.endY = startY + 80;
        }
    }

    getYAt(targetX) {
        if (targetX <= this.x) return this.startY;
        if (targetX >= this.x + this.length) return this.endY;
        const progress = (targetX - this.x) / this.length;
        return this.startY + (this.endY - this.startY) * progress;
    }
}

class TerrainManager {
    constructor() {
        this.segments = [];
        this.lastX = 0;
        this.lastY = BASE_GROUND_Y;
        this.addSegment('flat', GAME_WIDTH * 2);
    }

    addSegment(type, length) {
        let isHole = type === 'hole';
        let segment = new TerrainSegment(type, this.lastX, this.lastY, length, isHole);
        this.segments.push(segment);
        this.lastX += length;
        if (!isHole) {
            this.lastY = segment.endY;
        }
    }

    update(speed) {
        for (let seg of this.segments) {
            seg.x -= speed;
        }
        this.lastX -= speed;

        if (this.segments.length > 0 && this.segments[0].x + this.segments[0].length < -200) {
            this.segments.shift();
        }

        while (this.lastX < GAME_WIDTH + 800) {
            this.generateNextSegment();
        }
    }

    generateNextSegment() {
        const rand = Math.random();
        let type = 'flat';
        let length = 200 + Math.random() * 400;

        let lastType = this.segments[this.segments.length - 1].type;

        if (lastType === 'hole') {
            type = 'flat';
            length = 300 + Math.random() * 300;
        } else if (lastType === 'slope_up' || lastType === 'slope_down') {
            type = 'flat';
            length = 300 + Math.random() * 300;
        } else {
            if (rand < 0.25) type = 'slope_up';
            else if (rand < 0.5) type = 'slope_down';
            else if (rand < 0.65) {
                type = 'hole';
                length = 130 + Math.random() * 70;
            }
        }

        if (type === 'slope_up' && this.lastY < 180) type = 'slope_down';
        if (type === 'slope_down' && this.lastY > GAME_HEIGHT - 120) type = 'slope_up';

        this.addSegment(type, length);
    }

    getGroundY(x) {
        for (let seg of this.segments) {
            if (x >= seg.x && x <= seg.x + seg.length) {
                return seg.isHole ? GAME_HEIGHT + 200 : seg.getYAt(x);
            }
        }
        return GAME_HEIGHT + 200;
    }

    getAirY(x) {
        for (let seg of this.segments) {
            if (x >= seg.x && x <= seg.x + seg.length) {
                return seg.getYAt(x);
            }
        }
        return BASE_GROUND_Y;
    }

    getAngleAt(x) {
        for (let seg of this.segments) {
            if (x >= seg.x && x <= seg.x + seg.length) {
                if (seg.isHole) return 0;
                return Math.atan2(seg.endY - seg.startY, seg.length);
            }
        }
        return 0;
    }

    draw(ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        let started = false;

        for (let seg of this.segments) {
            if (seg.isHole) {
                if (started) {
                    ctx.lineTo(seg.x, GAME_HEIGHT);
                    ctx.fill();
                    started = false;
                }
            } else {
                if (!started) {
                    ctx.beginPath();
                    ctx.moveTo(seg.x, GAME_HEIGHT);
                    ctx.lineTo(seg.x, seg.startY);
                    started = true;
                } else {
                    ctx.lineTo(seg.x, seg.startY);
                }
                ctx.lineTo(seg.x + seg.length, seg.endY);
            }
        }

        if (started) {
            let lastSeg = this.segments[this.segments.length - 1];
            ctx.lineTo(lastSeg.x + lastSeg.length, GAME_HEIGHT);
            ctx.fill();
        }

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        let first = true;
        for (let seg of this.segments) {
            if (seg.isHole) {
                ctx.stroke();
                ctx.beginPath();
                first = true;
            } else {
                if (first) {
                    ctx.moveTo(seg.x, seg.startY);
                    first = false;
                } else {
                    ctx.lineTo(seg.x, seg.startY);
                }
                ctx.lineTo(seg.x + seg.length, seg.endY);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

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
        this.y = BASE_GROUND_Y - this.height;
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

        this.y += this.vy;
        let currentGroundY = terrain ? terrain.getGroundY(this.x + this.width / 2) : BASE_GROUND_Y;

        if (this.y + this.height <= currentGroundY) {
            if (this.grounded && this.vy >= 0 && currentGroundY - (this.y + this.height) < 15 && currentGroundY < GAME_HEIGHT) {
                this.grounded = true;
                this.vy = 0;
                this.y = currentGroundY - this.height;
            } else {
                this.vy += GRAVITY;
                this.grounded = false;
            }
        } else {
            this.vy = 0;
            this.grounded = true;
            this.y = currentGroundY - this.height;
        }

        if (this.y > GAME_HEIGHT + 50) {
            hp = 0;
        }

        // Duck
        if (keys.ArrowDown) {
            this.height = this.originalHeight / 2;
            if (this.grounded) {
                this.y = currentGroundY - this.height;
            } else {
                this.vy += GRAVITY * 1.5;
            }
        } else {
            this.height = this.originalHeight;
            if (this.grounded) {
                this.y = currentGroundY - this.height;
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
            ctx.save();
            // Anchor at the bottom center of the player
            ctx.translate(this.x + this.width / 2, this.y + this.height);

            let angle = 0;
            let scaleX = 1;
            let scaleY = 1;
            let yOffset = 0;

            if (this.grounded && this.height === this.originalHeight) {
                // Running animation
                const cycle = distanceTraveled * 0.08;

                // Bobbing up and down
                const bounce = Math.abs(Math.sin(cycle));

                // Move up in the air at the peak of the bounce
                yOffset = -bounce * 8;

                // Rotate left and right periodically + slope
                let slopeAngle = terrain ? terrain.getAngleAt(this.x + this.width / 2) : 0;
                angle = slopeAngle + Math.sin(cycle) * 0.15;

                // Compress when hitting the ground
                if (bounce < 0.3) {
                    const squish = 1 - (bounce / 0.3); // 1 at bounce=0, 0 at bounce=0.3
                    scaleY = 1 - squish * 0.2; // Max 0.8 scaleY
                    scaleX = 1 + squish * 0.1; // Max 1.1 scaleX
                } else {
                    // Small stretch when in the air
                    scaleY = 1 + bounce * 0.05;
                    scaleX = 1 - bounce * 0.05;
                }
            } else if (!this.grounded) {
                // Jumping animation
                angle = Math.max(-0.5, Math.min(0.5, this.vy * 0.03)); // Tilt based on velocity
                scaleY = 1.1;
                scaleX = 0.9;
            } else if (this.height < this.originalHeight) {
                // Ducking animation
                angle = 0.3; // Lean forward
                yOffset = 5; // Sink slightly
                scaleY = 0.8;
                scaleX = 1.1;
            }

            ctx.translate(0, yOffset);
            ctx.rotate(angle);
            ctx.scale(scaleX, scaleY);

            ctx.drawImage(catImg, -this.width / 2, -this.height, this.width, this.height);
            ctx.restore();
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
            this.yOffset = 0;
            this.color = '#ef4444'; // Red
        } else {
            this.yOffset = 40; // Hovering
            this.color = '#f59e0b'; // Amber
        }
    }

    update() {
        this.x -= gameSpeed;
        let gy = this.type === 'low' ? (terrain ? terrain.getGroundY(this.x + this.width / 2) : BASE_GROUND_Y) : (terrain ? terrain.getAirY(this.x + this.width / 2) : BASE_GROUND_Y);
        this.y = gy - this.height - this.yOffset;
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
        this.yOffset = 30 + Math.random() * 60; // 30 to 90px above ground
        this.width = 20;
        this.height = 20;
        this.color = '#eab308'; // Yellow/Gold
        this.collected = false;
        this.spin = 0;
    }

    update() {
        this.x -= gameSpeed;
        this.spin += 0.1;
        this.y = (terrain ? terrain.getAirY(this.x + this.width / 2) : BASE_GROUND_Y) - this.height - this.yOffset;
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
let terrain;
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
    terrain = new TerrainManager();
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

    if (terrain) terrain.update(gameSpeed);
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
        let gy = terrain ? terrain.getGroundY(x - offset) : GAME_HEIGHT;
        if (gy > GAME_HEIGHT) gy = GAME_HEIGHT;
        ctx.lineTo(x - offset, gy);
        ctx.stroke();
    }

    if (terrain) terrain.draw(ctx);

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

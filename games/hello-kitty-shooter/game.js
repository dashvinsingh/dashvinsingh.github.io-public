// Game setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Game state
let gameStarted = false;
let gameOver = false;
let gamePaused = false;
let singlePlayerMode = false;
let asteroids = [];
let particles = [];
let ammoPickups = [];
let powerups = [];
let boss = null;
let bossActive = false;
let bossDefeated = false;
const BOSS_SPAWN_SCORE = 500; // Boss appears when combined score reaches 500

// Mobile touch controls
let touchJoystick = { x: 0, y: 0, active: false };
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Powerup types
const POWERUP_TYPES = {
    SHIELD: { name: 'Shield', color: '#00ffff', duration: 8000 },
    RAPID_FIRE: { name: 'Rapid Fire', color: '#ff6347', duration: 6000 },
    TRIPLE_SHOT: { name: 'Triple Shot', color: '#9370db', duration: 7000 },
    SPEED_BOOST: { name: 'Speed Boost', color: '#32cd32', duration: 6000 }
};

// Gamepad state
let gamepads = {};
let player1InputMode = 'keyboard'; // 'keyboard' or 'gamepad'
let player2InputMode = 'keyboard';
let player1GamepadIndex = null;
let player2GamepadIndex = null;

// Player class
class Player {
    constructor(x, y, color, controls, ammoElementId, powerupElementId, livesElementId) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.width = 30;
        this.height = 30;
        this.color = color;
        this.baseSpeed = 5;
        this.speed = 5;
        this.bullets = [];
        this.score = 0;
        this.ammo = 30; // Start with full ammo
        this.maxAmmo = 40; // Increased max ammo capacity
        this.lives = 5;
        this.ammoElementId = ammoElementId;
        this.powerupElementId = powerupElementId;
        this.livesElementId = livesElementId;
        this.controls = controls;
        this.keys = {};
        this.alive = true;
        this.invincible = false;
        this.invincibleTimer = null;
        this.vx = 0;
        this.vy = 0;

        // Powerup states
        this.hasShield = false;
        this.hasRapidFire = false;
        this.hasTripleShot = false;
        this.hasSpeedBoost = false;
        this.powerupTimers = {};
    }

    draw() {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Invincibility effect - flashing
        if (this.invincible) {
            const flash = Math.floor(Date.now() / 100) % 2;
            if (flash === 0) {
                ctx.globalAlpha = 0.5;
            }
        }

        // Draw shield effect
        if (this.hasShield) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ffff';
            ctx.beginPath();
            ctx.arc(0, 0, this.width/2 + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Speed boost aura
        if (this.hasSpeedBoost) {
            ctx.strokeStyle = '#32cd32';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#32cd32';
            const pulse = Math.sin(Date.now() / 100) * 3 + this.width/2 + 5;
            ctx.beginPath();
            ctx.arc(0, 0, pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Hello Kitty inspired spaceship
        // Main body (head)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
        ctx.fill();

        // White face
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 2, this.width/2.5, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(-6, -2, 2, 0, Math.PI * 2);
        ctx.arc(6, -2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 3, 2, 0, Math.PI * 2);
        ctx.fill();

        // Whiskers
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-12, 3);
        ctx.lineTo(-8, 3);
        ctx.moveTo(8, 3);
        ctx.lineTo(12, 3);
        ctx.stroke();

        // Bow
        ctx.fillStyle = this.color === '#ff69b4' ? '#ff1493' : '#4169e1';
        ctx.beginPath();
        ctx.arc(-10, -10, 4, 0, Math.PI * 2);
        ctx.arc(-3, -10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-8, -12, 2, 4);

        // Ears
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(-10, -12, 5, 0, Math.PI * 2);
        ctx.arc(10, -12, 5, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    update(gamepadInput = null, useTouchControls = false) {
        if (!this.alive) return;

        // Smooth movement
        this.vx = 0;
        this.vy = 0;

        if (useTouchControls && touchJoystick.active) {
            // Mobile touch joystick input
            this.vx = touchJoystick.x * this.speed;
            this.vy = touchJoystick.y * this.speed;
        } else if (gamepadInput) {
            // Gamepad input
            this.vx = gamepadInput.axisX * this.speed;
            this.vy = gamepadInput.axisY * this.speed;
        } else {
            // Keyboard input
            if (this.keys[this.controls.up]) this.vy = -this.speed;
            if (this.keys[this.controls.down]) this.vy = this.speed;
            if (this.keys[this.controls.left]) this.vx = -this.speed;
            if (this.keys[this.controls.right]) this.vx = this.speed;

            // Normalize diagonal movement
            if (this.vx !== 0 && this.vy !== 0) {
                this.vx *= 0.707;
                this.vy *= 0.707;
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        // Boundary collision
        this.x = Math.max(this.width/2, Math.min(canvas.width - this.width/2, this.x));
        this.y = Math.max(this.height/2, Math.min(canvas.height - this.height/2, this.y));

        // Update bullets
        this.bullets = this.bullets.filter(bullet => {
            bullet.update();
            return bullet.active;
        });
    }

    shoot() {
        // Rapid fire gives unlimited ammo, otherwise check ammo count
        if (!this.alive || (!this.hasRapidFire && this.ammo <= 0)) return;

        if (this.hasTripleShot) {
            // Triple shot - 3 bullets in a spread pattern
            this.bullets.push(new Bullet(this.x, this.y - this.height/2, this.color, -0.3));
            this.bullets.push(new Bullet(this.x, this.y - this.height/2, this.color, 0));
            this.bullets.push(new Bullet(this.x, this.y - this.height/2, this.color, 0.3));
        } else {
            // Normal single shot
            this.bullets.push(new Bullet(this.x, this.y - this.height/2, this.color, 0));
        }

        // Only consume ammo if rapid fire is NOT active
        if (!this.hasRapidFire) {
            this.ammo--;
            this.updateAmmo();
        }

        playSound('shoot');
    }

    activatePowerup(type) {
        // Clear existing timer for this powerup type
        if (this.powerupTimers[type]) {
            clearTimeout(this.powerupTimers[type]);
        }

        const powerupInfo = POWERUP_TYPES[type];

        switch(type) {
            case 'SHIELD':
                this.hasShield = true;
                this.powerupTimers.SHIELD = setTimeout(() => {
                    this.hasShield = false;
                    this.updatePowerupDisplay();
                }, powerupInfo.duration);
                break;
            case 'RAPID_FIRE':
                this.hasRapidFire = true;
                this.powerupTimers.RAPID_FIRE = setTimeout(() => {
                    this.hasRapidFire = false;
                    this.updatePowerupDisplay();
                }, powerupInfo.duration);
                break;
            case 'TRIPLE_SHOT':
                this.hasTripleShot = true;
                this.powerupTimers.TRIPLE_SHOT = setTimeout(() => {
                    this.hasTripleShot = false;
                    this.updatePowerupDisplay();
                }, powerupInfo.duration);
                break;
            case 'SPEED_BOOST':
                this.hasSpeedBoost = true;
                this.speed = this.baseSpeed * 1.8;
                this.powerupTimers.SPEED_BOOST = setTimeout(() => {
                    this.hasSpeedBoost = false;
                    this.speed = this.baseSpeed;
                    this.updatePowerupDisplay();
                }, powerupInfo.duration);
                break;
        }
        this.updatePowerupDisplay();
    }

    updatePowerupDisplay() {
        const container = document.getElementById(this.powerupElementId);
        if (!container) return;

        container.innerHTML = '';

        if (this.hasShield) {
            const indicator = document.createElement('div');
            indicator.className = 'powerup-indicator powerup-shield';
            indicator.textContent = 'SHIELD';
            container.appendChild(indicator);
        }
        if (this.hasRapidFire) {
            const indicator = document.createElement('div');
            indicator.className = 'powerup-indicator powerup-rapid';
            indicator.textContent = 'RAPID FIRE';
            container.appendChild(indicator);
        }
        if (this.hasTripleShot) {
            const indicator = document.createElement('div');
            indicator.className = 'powerup-indicator powerup-triple';
            indicator.textContent = 'TRIPLE SHOT';
            container.appendChild(indicator);
        }
        if (this.hasSpeedBoost) {
            const indicator = document.createElement('div');
            indicator.className = 'powerup-indicator powerup-speed';
            indicator.textContent = 'SPEED BOOST';
            container.appendChild(indicator);
        }
    }

    updateAmmo() {
        document.getElementById(this.ammoElementId).textContent = this.ammo;
    }

    updateLives() {
        const container = document.getElementById(this.livesElementId);
        if (!container) return;

        // Create heart symbols for lives
        container.textContent = '❤️'.repeat(this.lives);

        // Add visual warning when lives are low
        const livesStatElement = container.parentElement;
        if (this.lives <= 2) {
            livesStatElement.classList.add('low-lives');
        } else {
            livesStatElement.classList.remove('low-lives');
        }
    }

    addAmmo(amount) {
        this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
        this.updateAmmo();
    }

    loseLife() {
        this.lives--;
        this.updateLives();

        if (this.lives <= 0) {
            this.alive = false;
            return false; // Game over for this player
        } else {
            // Respawn with invincibility
            this.respawn();
            return true; // Player still has lives
        }
    }

    respawn() {
        // Reset position
        this.x = this.startX;
        this.y = this.startY;

        // Clear bullets
        this.bullets = [];

        // Grant temporary invincibility
        this.invincible = true;
        if (this.invincibleTimer) {
            clearTimeout(this.invincibleTimer);
        }
        this.invincibleTimer = setTimeout(() => {
            this.invincible = false;
        }, 5000); // 5 seconds of invincibility for better recovery
    }

    checkPickupCollision(pickup) {
        if (!this.alive) return false;
        const dx = this.x - pickup.x;
        const dy = this.y - pickup.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.width/2 + pickup.radius;
    }

    checkCollision(asteroid) {
        if (!this.alive || this.hasShield || this.invincible) return false; // Shield and invincibility protect from collisions
        const dx = this.x - asteroid.x;
        const dy = this.y - asteroid.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.width/2 + asteroid.radius;
    }

    checkPowerupCollision(powerup) {
        if (!this.alive) return false;
        const dx = this.x - powerup.x;
        const dy = this.y - powerup.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.width/2 + powerup.radius;
    }
}

// Bullet class
class Bullet {
    constructor(x, y, color, angle = 0) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 12;
        this.speed = 8;
        this.color = color;
        this.active = true;
        this.angle = angle; // Angle for spread shots
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Heart-shaped bullet
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(0.5, 0.5);
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.bezierCurveTo(-5, -3, -10, 0, 0, 10);
        ctx.bezierCurveTo(10, 0, 5, -3, 0, 3);
        ctx.fill();
        ctx.restore();

        ctx.shadowBlur = 0;
    }

    update() {
        this.y -= this.speed;
        this.x += this.angle * this.speed; // Apply horizontal movement for spread shots
        if (this.y < 0 || this.x < 0 || this.x > canvas.width) this.active = false;
    }

    checkCollision(asteroid) {
        const dx = this.x - asteroid.x;
        const dy = this.y - asteroid.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < asteroid.radius + 5;
    }
}

// Asteroid class
class Asteroid {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.speed = speed;
        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        this.vertices = this.generateVertices();
        this.active = true;
    }

    generateVertices() {
        const vertices = [];
        const points = 8;
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const variance = 0.7 + Math.random() * 0.3;
            vertices.push({
                x: Math.cos(angle) * this.radius * variance,
                y: Math.sin(angle) * this.radius * variance
            });
        }
        return vertices;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Cute pastel asteroid
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#dda0dd');
        gradient.addColorStop(0.5, '#da70d6');
        gradient.addColorStop(1, '#ba55d3');
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Cute sparkle effect
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.radius * 0.3, -this.radius * 0.3, 2, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#fff0f5';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    update() {
        this.y += this.speed;
        this.rotation += this.rotationSpeed;
        if (this.y > canvas.height + this.radius) {
            this.active = false;
        }
    }
}

// Particle class for explosions
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.radius = Math.random() * 3 + 1;
        this.color = color;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
}

// Boss projectile class
class BossProjectile {
    constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.radius = 8;
        this.active = true;
        this.color = '#ff1493';
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Angry pink projectile
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // Remove if off screen
        if (this.x < -20 || this.x > canvas.width + 20 ||
            this.y < -20 || this.y > canvas.height + 20) {
            this.active = false;
        }
    }

    checkPlayerCollision(player) {
        if (!player.alive || player.hasShield || player.invincible) return false;
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.radius + player.width/2;
    }
}

// Boss class - Evil Hello Kitty
class Boss {
    constructor() {
        this.x = canvas.width / 2;
        this.y = 200; // Moved down from 100 to 200 for better visibility
        this.width = 80;
        this.height = 80;
        this.maxHealth = 1000;
        this.health = this.maxHealth;
        this.speed = 2;
        this.direction = 1;
        this.projectiles = [];
        this.shootTimer = 0;
        this.shootRate = 60;
        this.attackPattern = 0;
        this.patternTimer = 0;
        this.alive = true;
    }

    draw() {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Evil aura
        const pulse = Math.sin(Date.now() / 100) * 10 + this.width/2 + 20;
        ctx.strokeStyle = 'rgba(139, 0, 139, 0.5)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#8b008b';
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Main body - dark purple
        ctx.fillStyle = '#8b008b';
        ctx.beginPath();
        ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
        ctx.fill();

        // Face - darker
        ctx.fillStyle = '#4b0082';
        ctx.beginPath();
        ctx.arc(0, 2, this.width/2.5, 0, Math.PI * 2);
        ctx.fill();

        // Evil red eyes
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.arc(-10, -2, 4, 0, Math.PI * 2);
        ctx.arc(10, -2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Evil grin
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 8, 12, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Dark bow
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-15, -15, 6, 0, Math.PI * 2);
        ctx.arc(-5, -15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-12, -18, 4, 6);

        // Horns
        ctx.fillStyle = '#8b008b';
        ctx.beginPath();
        ctx.moveTo(-15, -20);
        ctx.lineTo(-18, -30);
        ctx.lineTo(-12, -20);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(15, -20);
        ctx.lineTo(18, -30);
        ctx.lineTo(12, -20);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.width/2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    update() {
        if (!this.alive) return;

        // Move side to side
        this.x += this.speed * this.direction;
        if (this.x < this.width || this.x > canvas.width - this.width) {
            this.direction *= -1;
        }

        // Update attack pattern
        this.patternTimer++;
        if (this.patternTimer > 300) {
            this.attackPattern = (this.attackPattern + 1) % 3;
            this.patternTimer = 0;
        }

        // Shoot projectiles
        this.shootTimer++;
        if (this.shootTimer >= this.shootRate) {
            this.shoot();
            this.shootTimer = 0;
        }

        // Update projectiles
        this.projectiles = this.projectiles.filter(proj => {
            proj.update();
            return proj.active;
        });
    }

    shoot() {
        switch(this.attackPattern) {
            case 0: // Spread shot
                for (let i = -2; i <= 2; i++) {
                    const angle = Math.PI / 2 + (i * Math.PI / 8);
                    this.projectiles.push(new BossProjectile(this.x, this.y + this.height/2, angle, 4));
                }
                break;
            case 1: // Target players
                const target1Angle = Math.atan2(player1.y - this.y, player1.x - this.x);
                const target2Angle = Math.atan2(player2.y - this.y, player2.x - this.x);
                this.projectiles.push(new BossProjectile(this.x, this.y + this.height/2, target1Angle, 5));
                this.projectiles.push(new BossProjectile(this.x, this.y + this.height/2, target2Angle, 5));
                break;
            case 2: // Circle shot
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    this.projectiles.push(new BossProjectile(this.x, this.y, angle, 3));
                }
                break;
        }
        playSound('shoot');
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            bossDefeated = true;
            createExplosion(this.x, this.y, '#8b008b');
            createExplosion(this.x - 30, this.y - 30, '#ff00ff');
            createExplosion(this.x + 30, this.y - 30, '#ff1493');
            createExplosion(this.x - 30, this.y + 30, '#8b008b');
            createExplosion(this.x + 30, this.y + 30, '#ff00ff');
        }
    }
}

// Ammo pickup class
class AmmoPickup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.speed = 2;
        this.active = true;
        this.rotation = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
    }

    draw() {
        this.rotation += 0.05;
        this.pulsePhase += 0.1;
        const pulse = Math.sin(this.pulsePhase) * 0.2 + 1;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(pulse, pulse);

        // Glowing star shape for ammo
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFD700';
        ctx.fillStyle = '#FFD700';

        // Draw star
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Inner glow
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        if (this.y > canvas.height + this.radius) {
            this.active = false;
        }
    }
}

// Powerup class
class Powerup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 18;
        this.speed = 2.5;
        this.active = true;
        this.rotation = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.color = POWERUP_TYPES[type].color;
        this.name = POWERUP_TYPES[type].name;
    }

    draw() {
        this.rotation += 0.08;
        this.pulsePhase += 0.12;
        const pulse = Math.sin(this.pulsePhase) * 0.25 + 1;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(pulse, pulse);

        // Outer glow
        ctx.shadowBlur = 30;
        ctx.shadowColor = this.color;

        // Draw hexagon
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Inner hexagon
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x = Math.cos(angle) * this.radius * 0.6;
            const y = Math.sin(angle) * this.radius * 0.6;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Center glow
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Draw icon based on type
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 0;

        switch(this.type) {
            case 'SHIELD':
                // Shield icon
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(-6, -4);
                ctx.lineTo(-6, 4);
                ctx.lineTo(0, 8);
                ctx.lineTo(6, 4);
                ctx.lineTo(6, -4);
                ctx.closePath();
                ctx.stroke();
                break;
            case 'RAPID_FIRE':
                // Lightning bolt
                ctx.beginPath();
                ctx.moveTo(-2, -8);
                ctx.lineTo(3, 0);
                ctx.lineTo(-1, 0);
                ctx.lineTo(2, 8);
                ctx.lineTo(-3, 0);
                ctx.lineTo(1, 0);
                ctx.closePath();
                ctx.stroke();
                break;
            case 'TRIPLE_SHOT':
                // Three arrows
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i * 5, 6);
                    ctx.lineTo(i * 5, -2);
                    ctx.lineTo(i * 5 - 3, 2);
                    ctx.moveTo(i * 5, -2);
                    ctx.lineTo(i * 5 + 3, 2);
                    ctx.stroke();
                }
                break;
            case 'SPEED_BOOST':
                // Double chevron
                ctx.beginPath();
                ctx.moveTo(-8, 4);
                ctx.lineTo(-4, 0);
                ctx.lineTo(-8, -4);
                ctx.moveTo(-2, 4);
                ctx.lineTo(2, 0);
                ctx.lineTo(-2, -4);
                ctx.stroke();
                break;
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        if (this.y > canvas.height + this.radius) {
            this.active = false;
        }
    }
}

// Sound effects (simple)
function playSound(type) {
    // Create simple sound effects using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'shoot') {
        oscillator.frequency.value = 600;
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === 'explosion') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 100;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } else if (type === 'pickup') {
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } else if (type === 'powerup') {
        oscillator.type = 'square';
        oscillator.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1500, audioContext.currentTime + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.25);
    }
}

// Create particles
function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, color));
    }
    playSound('explosion');
}

// Initialize players
const player1 = new Player(canvas.width * 0.3, canvas.height - 100, '#ff69b4', {
    up: 'w',
    down: 's',
    left: 'a',
    right: 'd',
    shoot: ' '
}, 'ammo1', 'powerups1', 'lives1');

const player2 = new Player(canvas.width * 0.7, canvas.height - 100, '#87ceeb', {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    shoot: 'Enter'
}, 'ammo2', 'powerups2', 'lives2');

// Initialize lives display
player1.updateLives();
player2.updateLives();

// Gamepad API
window.addEventListener("gamepadconnected", (e) => {
    console.log("Gamepad connected:", e.gamepad.index, e.gamepad.id);
    gamepads[e.gamepad.index] = e.gamepad;
});

window.addEventListener("gamepaddisconnected", (e) => {
    console.log("Gamepad disconnected:", e.gamepad.index);
    delete gamepads[e.gamepad.index];

    // Reset player input if their gamepad was disconnected
    if (player1GamepadIndex === e.gamepad.index) {
        player1InputMode = 'keyboard';
        player1GamepadIndex = null;
        const control1 = document.getElementById('control1');
        if (control1) control1.textContent = 'Keyboard';
    }
    if (player2GamepadIndex === e.gamepad.index) {
        player2InputMode = 'keyboard';
        player2GamepadIndex = null;
        const control2 = document.getElementById('control2');
        if (control2) control2.textContent = 'Keyboard';
    }
});


function getGamepadInput(gamepadIndex) {
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return null;

    // Left stick (axes 0 and 1)
    const deadzone = 0.15;
    let axisX = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
    let axisY = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0;

    // X button (PlayStation) or A button (Xbox) - button index 0
    const shootButton = gp.buttons[0] && gp.buttons[0].pressed;

    return {
        axisX: axisX,
        axisY: axisY,
        shoot: shootButton
    };
}

// Initialize start screen and controls
function initializeStartScreen() {
    const startScreen = document.getElementById('startScreen');
    const startGameBtn = document.getElementById('startGame');
    const singlePlayerBtn = document.getElementById('singlePlayerBtn');
    const multiPlayerBtn = document.getElementById('multiPlayerBtn');
    const controlInfo = document.getElementById('controlInfo');
    const keyboardControls = document.getElementById('keyboardControls');
    const mobileControlsInfo = document.getElementById('mobileControls');

    // Mode selection
    if (singlePlayerBtn) {
        singlePlayerBtn.addEventListener('click', () => {
            singlePlayerMode = true;
            controlInfo.classList.remove('hidden');

            // Hide player 2 HUD in single player
            const player2Info = document.querySelector('.blue-info');
            if (player2Info) player2Info.style.display = 'none';

            // Show appropriate controls based on device
            if (isMobile) {
                keyboardControls.style.display = 'none';
                mobileControlsInfo.classList.remove('hidden');
            } else {
                keyboardControls.style.display = 'flex';
                // Hide player 2 controls
                const p2Box = document.querySelector('.blue-box');
                if (p2Box) p2Box.style.display = 'none';
            }
        });
    }

    if (multiPlayerBtn) {
        multiPlayerBtn.addEventListener('click', () => {
            singlePlayerMode = false;
            controlInfo.classList.remove('hidden');
            keyboardControls.style.display = 'flex';
            mobileControlsInfo.classList.add('hidden');

            // Show both players in HUD
            const player2Info = document.querySelector('.blue-info');
            if (player2Info) player2Info.style.display = 'block';

            // Show player 2 controls
            const p2Box = document.querySelector('.blue-box');
            if (p2Box) p2Box.style.display = 'block';
        });
    }

    // Start game button
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            gameStarted = true;
            if (startScreen) {
                startScreen.style.display = 'none';
            }

            // Show mobile controls if single player on mobile
            if (singlePlayerMode && isMobile) {
                const mobileControlsDiv = document.querySelector('.mobile-controls');
                if (mobileControlsDiv) {
                    mobileControlsDiv.classList.remove('hidden');
                }
                initializeMobileControls();
            }
        });
    }
}

// Initialize mobile touch controls
function initializeMobileControls() {
    const joystickContainer = document.getElementById('joystick');
    const joystickStick = document.getElementById('joystickStick');
    const shootBtn = document.getElementById('shootBtn');

    if (!joystickContainer || !joystickStick || !shootBtn) return;

    let joystickCenter = { x: 0, y: 0 };
    let touchId = null;

    function updateJoystickPosition(x, y) {
        const rect = joystickContainer.getBoundingClientRect();
        joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        const deltaX = x - joystickCenter.x;
        const deltaY = y - joystickCenter.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = 45;

        if (distance > maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            touchJoystick.x = Math.cos(angle);
            touchJoystick.y = Math.sin(angle);
            joystickStick.style.left = `${50 + Math.cos(angle) * maxDistance}px`;
            joystickStick.style.top = `${50 + Math.sin(angle) * maxDistance}px`;
        } else {
            touchJoystick.x = deltaX / maxDistance;
            touchJoystick.y = deltaY / maxDistance;
            joystickStick.style.left = `${50 + deltaX}px`;
            joystickStick.style.top = `${50 + deltaY}px`;
        }
    }

    function resetJoystick() {
        touchJoystick.x = 0;
        touchJoystick.y = 0;
        touchJoystick.active = false;
        joystickStick.style.left = '50%';
        joystickStick.style.top = '50%';
        touchId = null;
    }

    joystickContainer.addEventListener('touchstart', (e) => {
        if (touchId === null) {
            e.preventDefault();
            const touch = e.touches[0];
            touchId = touch.identifier;
            touchJoystick.active = true;
            updateJoystickPosition(touch.clientX, touch.clientY);
        }
    });

    joystickContainer.addEventListener('touchmove', (e) => {
        if (touchId !== null) {
            e.preventDefault();
            for (let touch of e.touches) {
                if (touch.identifier === touchId) {
                    updateJoystickPosition(touch.clientX, touch.clientY);
                    break;
                }
            }
        }
    });

    joystickContainer.addEventListener('touchend', (e) => {
        e.preventDefault();
        for (let touch of e.changedTouches) {
            if (touch.identifier === touchId) {
                resetJoystick();
                break;
            }
        }
    });

    // Shoot button
    shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player1.alive && !gamePaused) {
            player1.shoot();
        }
    });
}


// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeStartScreen();
    });
} else {
    initializeStartScreen();
}

// Input handling
let shootCooldown1 = false;
let shootCooldown2 = false;
let gamepadShoot1Pressed = false;
let gamepadShoot2Pressed = false;

document.addEventListener('keydown', (e) => {
    if (gameOver) {
        if (e.key === 'r' || e.key === 'R') {
            location.reload();
        }
        return;
    }

    if (!gameStarted) return; // Don't process game keys until game starts

    // Toggle pause with ESC key
    if (e.key === 'Escape') {
        e.preventDefault();
        gamePaused = !gamePaused;
        return;
    }

    if (gamePaused) return; // Don't process game input when paused

    player1.keys[e.key] = true;
    player2.keys[e.key] = true;

    // Shooting with cooldown (rapid fire reduces cooldown)
    if (e.key === ' ' && !shootCooldown1) {
        e.preventDefault();
        player1.shoot();
        shootCooldown1 = true;
        const cooldown = player1.hasRapidFire ? 100 : 250;
        setTimeout(() => shootCooldown1 = false, cooldown);
    }
    if (e.key === 'Enter' && !shootCooldown2) {
        e.preventDefault();
        player2.shoot();
        shootCooldown2 = true;
        const cooldown = player2.hasRapidFire ? 100 : 250;
        setTimeout(() => shootCooldown2 = false, cooldown);
    }
});

document.addEventListener('keyup', (e) => {
    player1.keys[e.key] = false;
    player2.keys[e.key] = false;
});

// Spawn asteroids
let asteroidSpawnTimer = 0;
let asteroidSpawnRate = 80; // Slower initial spawn for easier start
let ammoPickupTimer = 0;
let ammoPickupRate = 200; // Spawn ammo more frequently (every 3.3 seconds)
let powerupTimer = 0;
let powerupRate = 400; // Spawn powerup every 6.6 seconds

function spawnAsteroid() {
    // Start with smaller, slower asteroids and gradually increase
    const baseRadius = 15 + Math.min(asteroidSpawnTimer / 100, 20); // Starts at 15, gradually grows to 35
    const radius = Math.random() * 15 + baseRadius;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const baseSpeed = 1.5 + Math.min(asteroidSpawnTimer / 300, 2); // Starts at 1.5, grows to 3.5
    const speed = Math.random() * 2 + baseSpeed;
    asteroids.push(new Asteroid(x, -radius, radius, speed));
}

function spawnAmmoPickup() {
    const x = Math.random() * (canvas.width - 50) + 25;
    ammoPickups.push(new AmmoPickup(x, -30));
}

function spawnPowerup() {
    const x = Math.random() * (canvas.width - 100) + 50;
    const types = Object.keys(POWERUP_TYPES);
    const randomType = types[Math.floor(Math.random() * types.length)];
    powerups.push(new Powerup(x, -30, randomType));
}

function spawnBossShields() {
    // Spawn 4 shield powerups when boss appears - positioned across the screen
    const shieldPositions = [
        canvas.width * 0.2,
        canvas.width * 0.4,
        canvas.width * 0.6,
        canvas.width * 0.8
    ];

    shieldPositions.forEach((x, index) => {
        // Stagger the Y positions so they don't all spawn at once
        const y = -50 - (index * 100);
        powerups.push(new Powerup(x, y, 'SHIELD'));
    });
}

// Update game
function updateGame() {
    // Check if boss should spawn
    const totalScore = player1.score + player2.score;
    if (!bossActive && !bossDefeated && totalScore >= BOSS_SPAWN_SCORE) {
        bossActive = true;
        boss = new Boss();
        // Clear asteroids when boss appears
        asteroids = [];
        // Spawn shield powerups to help with boss fight
        spawnBossShields();
    }

    // Don't spawn asteroids during boss fight
    if (!bossActive) {
        // Spawn asteroids
        asteroidSpawnTimer++;
        if (asteroidSpawnTimer >= asteroidSpawnRate) {
            spawnAsteroid();
            asteroidSpawnTimer = 0;
            // Increase difficulty over time - more gradual increase
            asteroidSpawnRate = Math.max(25, asteroidSpawnRate - 0.15);
        }
    }

    // Spawn ammo pickups
    ammoPickupTimer++;
    if (ammoPickupTimer >= ammoPickupRate) {
        spawnAmmoPickup();
        ammoPickupTimer = 0;
    }

    // Spawn powerups
    powerupTimer++;
    if (powerupTimer >= powerupRate) {
        spawnPowerup();
        powerupTimer = 0;
    }

    // Handle gamepad input
    let gamepad1Input = null;
    let gamepad2Input = null;

    if (player1InputMode === 'gamepad' && player1GamepadIndex !== null) {
        gamepad1Input = getGamepadInput(player1GamepadIndex);
        if (gamepad1Input && gamepad1Input.shoot && !gamepadShoot1Pressed && !shootCooldown1) {
            player1.shoot();
            shootCooldown1 = true;
            gamepadShoot1Pressed = true;
            const cooldown = player1.hasRapidFire ? 100 : 250;
            setTimeout(() => shootCooldown1 = false, cooldown);
        }
        if (gamepad1Input && !gamepad1Input.shoot) {
            gamepadShoot1Pressed = false;
        }
    }

    if (player2InputMode === 'gamepad' && player2GamepadIndex !== null) {
        gamepad2Input = getGamepadInput(player2GamepadIndex);
        if (gamepad2Input && gamepad2Input.shoot && !gamepadShoot2Pressed && !shootCooldown2) {
            player2.shoot();
            shootCooldown2 = true;
            gamepadShoot2Pressed = true;
            const cooldown = player2.hasRapidFire ? 100 : 250;
            setTimeout(() => shootCooldown2 = false, cooldown);
        }
        if (gamepad2Input && !gamepad2Input.shoot) {
            gamepadShoot2Pressed = false;
        }
    }

    // Update players
    const useTouchForP1 = singlePlayerMode && isMobile;
    player1.update(gamepad1Input, useTouchForP1);

    // Only update player 2 in multiplayer mode
    if (!singlePlayerMode) {
        player2.update(gamepad2Input);
    }

    // Update ammo pickups
    ammoPickups = ammoPickups.filter(pickup => {
        pickup.update();

        // Check player collisions with pickup
        if (player1.checkPickupCollision(pickup)) {
            player1.addAmmo(10);
            pickup.active = false;
            playSound('pickup');
            createExplosion(pickup.x, pickup.y, '#FFD700');
        }
        if (!singlePlayerMode && player2.checkPickupCollision(pickup)) {
            player2.addAmmo(10);
            pickup.active = false;
            playSound('pickup');
            createExplosion(pickup.x, pickup.y, '#FFD700');
        }

        return pickup.active;
    });

    // Update powerups
    powerups = powerups.filter(powerup => {
        powerup.update();

        // Check player collisions with powerup
        if (player1.checkPowerupCollision(powerup)) {
            player1.activatePowerup(powerup.type);
            powerup.active = false;
            playSound('powerup');
            createExplosion(powerup.x, powerup.y, powerup.color);
        }
        if (!singlePlayerMode && player2.checkPowerupCollision(powerup)) {
            player2.activatePowerup(powerup.type);
            powerup.active = false;
            playSound('powerup');
            createExplosion(powerup.x, powerup.y, powerup.color);
        }

        return powerup.active;
    });

    // Update asteroids
    asteroids = asteroids.filter(asteroid => {
        asteroid.update();

        // Check bullet collisions
        for (let player of [player1, player2]) {
            for (let i = player.bullets.length - 1; i >= 0; i--) {
                if (player.bullets[i].checkCollision(asteroid)) {
                    player.bullets.splice(i, 1);
                    asteroid.active = false;
                    player.score += 10;
                    createExplosion(asteroid.x, asteroid.y, player.color);
                    updateScores();
                    break;
                }
            }
        }

        // Check player collisions
        if (player1.checkCollision(asteroid)) {
            asteroid.active = false;
            createExplosion(player1.x, player1.y, player1.color);
            const stillAlive = player1.loseLife();
            if (!stillAlive) {
                endGame();
            }
        }
        if (!singlePlayerMode && player2.checkCollision(asteroid)) {
            asteroid.active = false;
            createExplosion(player2.x, player2.y, player2.color);
            const stillAlive = player2.loseLife();
            if (!stillAlive) {
                endGame();
            }
        }

        return asteroid.active;
    });

    // Update boss
    if (bossActive && boss && boss.alive) {
        boss.update();

        // Check player bullets hitting boss
        for (let player of [player1, player2]) {
            for (let i = player.bullets.length - 1; i >= 0; i--) {
                const bullet = player.bullets[i];
                const dx = bullet.x - boss.x;
                const dy = bullet.y - boss.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < boss.width/2 + 5) {
                    player.bullets.splice(i, 1);
                    boss.takeDamage(10);
                    player.score += 5;
                    createExplosion(bullet.x, bullet.y, player.color);
                    updateScores();
                }
            }
        }

        // Check boss projectiles hitting players
        boss.projectiles.forEach(proj => {
            if (proj.checkPlayerCollision(player1)) {
                proj.active = false;
                createExplosion(player1.x, player1.y, player1.color);
                const stillAlive = player1.loseLife();
                if (!stillAlive) endGame();
            }
            if (!singlePlayerMode && proj.checkPlayerCollision(player2)) {
                proj.active = false;
                createExplosion(player2.x, player2.y, player2.color);
                const stillAlive = player2.loseLife();
                if (!stillAlive) endGame();
            }
        });

        // Check if boss is defeated
        if (!boss.alive && bossDefeated) {
            setTimeout(() => {
                showVictoryScreen();
            }, 2000);
        }
    }

    // Update particles
    particles = particles.filter(particle => {
        particle.update();
        return particle.life > 0;
    });
}

// Draw background stars
function drawStars() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const starCount = Math.floor(canvas.width * canvas.height / 10000);
    for (let i = 0; i < starCount; i++) {
        const x = (i * 137.5) % canvas.width;
        const y = (i * 123.7) % canvas.height;
        const size = (i % 3) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Draw game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stars
    drawStars();

    // Draw particles
    particles.forEach(particle => particle.draw());

    // Draw ammo pickups
    ammoPickups.forEach(pickup => pickup.draw());

    // Draw powerups
    powerups.forEach(powerup => powerup.draw());

    // Draw asteroids
    asteroids.forEach(asteroid => asteroid.draw());

    // Draw boss and projectiles
    if (bossActive && boss) {
        boss.draw();
        boss.projectiles.forEach(proj => proj.draw());

        // Draw boss health bar
        if (boss.alive) {
            drawBossHealthBar();
        }
    }

    // Draw players and bullets
    player1.bullets.forEach(bullet => bullet.draw());
    player2.bullets.forEach(bullet => bullet.draw());
    player1.draw();
    player2.draw();

    // Draw boss warning message
    if (bossActive && !boss.alive && bossDefeated) {
        ctx.font = '60px Comic Sans MS';
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#ff69b4';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFD700';
        ctx.strokeText('BOSS DEFEATED!', canvas.width/2, canvas.height/2);
        ctx.fillText('BOSS DEFEATED!', canvas.width/2, canvas.height/2);
        ctx.shadowBlur = 0;
    }
}

function drawBossHealthBar() {
    const barWidth = 400;
    const barHeight = 30;
    const x = canvas.width/2 - barWidth/2;
    const y = 50;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 5, y - 5, barWidth + 10, barHeight + 10);

    // Health bar border
    ctx.strokeStyle = '#8b008b';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Health bar fill
    const healthPercent = boss.health / boss.maxHealth;
    const fillWidth = barWidth * healthPercent;

    const gradient = ctx.createLinearGradient(x, y, x + fillWidth, y);
    gradient.addColorStop(0, '#ff00ff');
    gradient.addColorStop(0.5, '#8b008b');
    gradient.addColorStop(1, '#ff1493');

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, fillWidth, barHeight);

    // Boss name
    ctx.font = 'bold 24px Comic Sans MS';
    ctx.fillStyle = '#ff00ff';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#8b008b';
    ctx.fillText('EVIL HELLO KITTY', canvas.width/2, y - 10);
    ctx.shadowBlur = 0;

    // Health text
    ctx.font = 'bold 18px Comic Sans MS';
    ctx.fillStyle = 'white';
    ctx.fillText(`${Math.ceil(boss.health)} / ${boss.maxHealth}`, canvas.width/2, y + barHeight/2 + 7);
}

// Update scores
function updateScores() {
    document.getElementById('score1').textContent = player1.score;
    document.getElementById('score2').textContent = player2.score;
}

// End game
function endGame() {
    if (gameOver) return;
    gameOver = true;

    const gameOverDiv = document.getElementById('gameOver');
    const winnerText = document.getElementById('winner');

    if (!player1.alive && !player2.alive) {
        if (player1.score > player2.score) {
            winnerText.textContent = `Player 1 Wins with ${player1.score} points!`;
        } else if (player2.score > player1.score) {
            winnerText.textContent = `Player 2 Wins with ${player2.score} points!`;
        } else {
            winnerText.textContent = `It's a Tie! Both scored ${player1.score} points!`;
        }
    } else if (!player1.alive) {
        winnerText.textContent = `Player 2 Wins with ${player2.score} points!`;
    } else {
        winnerText.textContent = `Player 1 Wins with ${player1.score} points!`;
    }

    gameOverDiv.classList.remove('hidden');
}

// Victory screen
function showVictoryScreen() {
    gameOver = true;
    const victoryScreen = document.getElementById('victoryScreen');
    const victoryScores = document.getElementById('victoryScores');

    const totalScore = player1.score + player2.score;
    victoryScores.textContent = `Final Score: Player 1: ${player1.score} | Player 2: ${player2.score} | Total: ${totalScore}`;

    victoryScreen.classList.remove('hidden');
}

// Game loop
function gameLoop() {
    if (gameStarted && !gameOver && !gamePaused) {
        updateGame();
    }
    draw();

    // Draw pause overlay
    if (gamePaused && gameStarted && !gameOver) {
        drawPauseOverlay();
    }

    requestAnimationFrame(gameLoop);
}

// Draw pause overlay
function drawPauseOverlay() {
    // Semi-transparent dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pause text
    ctx.font = 'bold 80px Comic Sans MS';
    ctx.fillStyle = '#ff69b4';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff69b4';

    ctx.strokeText('PAUSED', canvas.width/2, canvas.height/2 - 40);
    ctx.fillText('PAUSED', canvas.width/2, canvas.height/2 - 40);

    // Instructions
    ctx.font = 'bold 32px Comic Sans MS';
    ctx.fillStyle = '#87ceeb';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#87ceeb';
    ctx.fillText('Press ESC to Resume', canvas.width/2, canvas.height/2 + 40);

    ctx.shadowBlur = 0;
}

// Start game loop (will only update when gameStarted is true)
gameLoop();

const path = require('path');
const fs = require('fs');

Error.stackTraceLimit = Infinity;
let enviroment = require('./lib/dotenv.js')(fs.readFileSync(path.join(__dirname, '../.env')).toString());
for (let key in enviroment) {
    process.env[key] = enviroment[key];
}
const GLOBAL = require("./modules/global.js");

console.log(`[${GLOBAL.creationDate}]: Server initialized.\nRoom Info:\n Dimensions: ${room.width} x ${room.height}`);

// Let's get a cheaper array removal thing
Array.prototype.remove = function (index) {
    if (index === this.length - 1) return this.pop();
    let r = this[index];
    this[index] = this.pop();
    return r;
};

//console window title
// https://stackoverflow.com/questions/29548477/how-do-you-set-the-terminal-tab-title-from-node-js
process.stdout.write(String.fromCharCode(27) + "]0;" + Config.WINDOW_NAME + String.fromCharCode(7));

util.log(room.width + " x " + room.height + " room initalized.");

// Collision stuff
const auraCollideTypes = ["miniboss", "tank", "food", "crasher"]
function collide(instance, other) {
    if (instance.noclip || other.noclip) {
        return 0;
    }

    instance.emit('collide', { body: instance, instance, other });
    other.emit('collide', { body: other, instance: other, other: instance });
    // Check for ghosts...
    if (other.isGhost) {
        util.error("GHOST FOUND");
        util.error(other.label);
        util.error("x: " + other.x + " y: " + other.y);
        util.error(other.collisionArray);
        util.error("health: " + other.health.amount);
        if (other.isInGrid) {
            other.kill();
            util.warn("Ghost removed.");
        }
        return 0;
    }
    if (instance.isGhost) {
        util.error("GHOST FOUND");
        util.error(instance.label);
        util.error("x: " + instance.x + " y: " + instance.y);
        util.error(instance.collisionArray);
        util.error("health: " + instance.health.amount);
        if (instance.isInGrid) {
            other.kill();
            util.warn("Ghost removed.");
        }
        return 0;
    }
    if (
        (!instance.activation.active && !other.activation.active) ||
        (instance.isArenaCloser && !instance.alpha) ||
        (other.isArenaCloser && !other.alpha)
    ) return 0;
    switch (true) {
        case instance.type === "wall" || other.type === "wall":
            if (instance.type === "wall" && other.type === "wall") return;
            if (instance.type === "aura" || other.type === "aura") return;
            if (instance.type === "satellite" || other.type === "satellite") return;
            let wall = instance.type === "wall" ? instance : other;
            let entity = instance.type === "wall" ? other : instance;
            if (entity.isArenaCloser || entity.master.isArenaCloser) return;
            switch (wall.shape) {
                case 4:
                    mazewallcollide(wall, entity);
                    break;
                default:
                    mooncollide(wall, entity);
                    break;
            }
            break;
        case instance.team === other.team &&
            (instance.settings.hitsOwnType === "pushOnlyTeam" ||
                other.settings.hitsOwnType === "pushOnlyTeam"):
            {
                let pusher = instance.settings.hitsOwnType === "pushOnlyTeam" ? instance : other;
                let entity = instance.settings.hitsOwnType === "pushOnlyTeam" ? other : instance;
                // Dominator / Mothership collisions
                if (
                    instance.settings.hitsOwnType === other.settings.hitsOwnType ||
                    entity.settings.hitsOwnType === "never"
                ) return;
                let a = 1 + 10 / (Math.max(entity.velocity.length, pusher.velocity.length) + 10);
                advancedcollide(pusher, entity, false, false, a);
            }
            break;
        case (instance.type === "crasher" && other.type === "food" && instance.team === other.team) ||
            (other.type === "crasher" && instance.type === "food" && other.team === instance.team):
            firmcollide(instance, other);
            break;
        case instance.team !== other.team ||
            (instance.team === other.team &&
                (
                    instance.healer ||
                    other.healer
                )):
            // Exits if the aura is not hitting a boss, tank, food, or crasher
            if (instance.type === "aura") {
                if (!(auraCollideTypes.includes(other.type))) return;
            } else if (other.type === "aura") {
                if (!(auraCollideTypes.includes(instance.type))) return;
            }
            advancedcollide(instance, other, true, true);
            break;
        case instance.settings.hitsOwnType == "never" ||
            other.settings.hitsOwnType == "never":
            break;
        case instance.settings.hitsOwnType === other.settings.hitsOwnType:
            switch (instance.settings.hitsOwnType) {
                case 'assembler': {
                    if (instance.assemblerLevel == null) instance.assemblerLevel = 1;
                    if (other.assemblerLevel == null) other.assemblerLevel = 1;

                    const [target1, target2] = (instance.id > other.id) ? [instance, other] : [other, instance];

                    if (
                        target2.assemblerLevel >= 10 || target1.assemblerLevel >= 10 ||
                        target1.isDead() || target2.isDead() ||
                        target1.parent.id != target2.parent.id &&
                        target1.parent.id != null &&
                        target2.parent.id != null // idk why
                    ) {
                        advancedcollide(instance, other, false, false); // continue push
                        break;
                    }

                    const better = (state) => {
                        return target1[state] > target2[state] ? target1[state] : target2[state];
                    }

                    target1.assemblerLevel = Math.min(target2.assemblerLevel + target1.assemblerLevel, 10);
                    target1.SIZE = better('SIZE') * 1.1;
                    target1.SPEED = better('SPEED') * 0.9;
                    target1.HEALTH = better('HEALTH') * 1.2;
                    target1.health.amount = target1.health.max;
                    target1.DAMAGE = better('DAMAGE') * 1.1;
                    target2.kill();

                    for (let i = 0; i < 10; ++i) {
                        const o = new Entity(target1, target1);
                        o.define('assemblerEffect');
                        o.team = target1.team;
                        o.color = target1.color;
                        o.SIZE = target1.SIZE / 3;
                        o.velocity = new Vector((Math.random() - 0.5) * 25, (Math.random() - 0.5) * 25);
                        o.refreshBodyAttributes();
                        o.life();
                    }
                } // don't break
                case "push":
                    advancedcollide(instance, other, false, false);
                    break;
                case "hard":
                    firmcollide(instance, other);
                    break;
                case "hardWithBuffer":
                    firmcollide(instance, other, 30);
                    break;
                case "hardOnlyTanks":
                    if (
                        instance.type === "tank" &&
                        other.type === "tank" &&
                        !instance.isDominator &&
                        !other.isDominator
                    )
                        firmcollide(instance, other);
                case "hardOnlyBosses":
                    if (instance.type === other.type && instance.type === "miniboss")
                        firmcollide(instance, other);
                case "repel":
                    simplecollide(instance, other);
                    break;
            }
            break;
    }
}

// The most important loop. Lots of looping.
let ticks = 0;
const regenTickRate = Math.max(1, Math.round(room.regenerateTick / room.cycleSpeed));
const gameloop = () => {
    logs.loops.tally();
    logs.master.startTracking();
    logs.activation.startTracking();
    const isRegenTick = (ticks % regenTickRate === 0);
    logs.activation.endTracking();
    // Do collisions
    logs.entities.startTracking();
    grid.clear();
    for (const instance of entities.values()) {
        if (instance.contemplationOfMortality() === 1) {
            instance.destroy();
            continue;
        }
        if (isRegenTick) {
			if (instance.shield.max) {
				instance.shield.regenerate();
			}
			if (instance.health.max) {
				instance.health.regenerate((instance.shield.max && instance.shield.max === instance.shield.amount) ? 1 : 0);
			}
		}
        if (instance.activation.active || instance.isPlayer) {
            if (instance.bond == null) {
                instance.physics();
            }
            instance.friction();
            instance.confinementToTheseEarthlyShackles();
        }
        instance.updateAABB(instance.activation.active);
        if (instance.activation.active) {
            grid.insert(instance, instance.minX, instance.minY, instance.maxX, instance.maxY);
        }
    }
    for (const instance of entities.values()) {
        if (!instance.isDead() && (instance.activation.active || instance.isPlayer)) {
            instance.life();
            instance.collisionArray = [];
            for (const other of grid.query(instance.minX, instance.minY, instance.maxX, instance.maxY).values()) {
                if (instance.id !== other.id) {
                    collide(instance, other);
                }
            }
        }
        instance.activation.update();
        instance.takeSelfie();
        instance.emit('tick', { body: instance });
		const tile = room.getAt(instance);
		if (tile) {
			tile.entities.push(instance);
		}
    }
    logs.entities.endTracking();
    logs.master.endTracking();
    room.lastCycle = performance.now();
    ticks++;
    if (ticks & 1) {
        for (let i = 0; i < sockets.players.length; i++) {
            sockets.players[i].socket.view.gazeUpon();
            sockets.players[i].socket.lastUptime = Infinity;
        }
    }
};

setTimeout(closeArena, 24 * 60 * 60 * 1000); // Restart every 2 hours

global.naturallySpawnedBosses = [];
global.bots = [];
let bossTimer = 0;
const maintainloop = () => {
    // Update the grid
    if (!naturallySpawnedBosses.length && bossTimer++ > Config.BOSS_SPAWN_COOLDOWN) {
        bossTimer = -Config.BOSS_SPAWN_DURATION;
        let selection = Config.BOSS_TYPES[ran.chooseChance(...Config.BOSS_TYPES.map((selection) => selection.chance))],
            amount = ran.chooseChance(...selection.amount) + 1;
        if (selection.message) {
            sockets.broadcast(selection.message);
        }
        sockets.broadcast(amount > 1 ? "Visitors are coming." : "A visitor is coming.");
        setSyncedTimeout(() => {
            let names = ran.chooseBossName(selection.nameType, amount);

            for (let i = 0; i < amount; i++) {
                let spot, attempts = 30, name = names[i];
                do { spot = getSpawnableArea(TEAM_ENEMIES); } while (attempts-- && dirtyCheck(spot, 500));

                let boss = new Entity(spot);
                boss.define(selection.bosses.sort(() => 0.5 - Math.random())[i % selection.bosses.length]);
                boss.team = TEAM_ENEMIES;
                if (name) {
                    boss.name = name;
                }

                naturallySpawnedBosses.push(boss);
                boss.on('dead', () => util.remove(naturallySpawnedBosses, naturallySpawnedBosses.indexOf(boss)));
            }

            sockets.broadcast(`${util.listify(names)} ${names.length == 1 ? 'has' : 'have'} arrived!`);
        }, Config.BOSS_SPAWN_DURATION * 30);
    }

    // upgrade existing ones
    for (let i = 0; i < bots.length; i++) {
        let o = bots[i];
        if (o.skill.level < Config.LEVEL_CAP) {
            o.skill.score += Config.BOT_XP;
        }
        o.skill.maintain();
        o.skillUp(["atk", "hlt", "spd", "str", "pen", "dam", "rld", "mob", "rgn", "shi"][ran.chooseChance(...Config.BOT_SKILL_UPGRADE_CHANCES)]);
        if (o.leftoverUpgrades && o.upgrade(ran.irandomRange(0, o.upgrades.length))) {
            o.leftoverUpgrades--;
        }
    }

    // then add new bots if arena is open
    if (!global.arenaClosed && bots.length < Config.BOTS) {
        let botName = Config.BOT_NAME_PREFIX + ran.chooseBotName(),
            team = Config.MODE === "tdm" ? getWeakestTeam() : undefined,
            limit = 20, // give up after 20 attempts and just pick whatever is currently chosen
            loc;
        do {
            loc = getSpawnableArea(team);
        } while (limit-- && dirtyCheck(loc, 50))
        let o = new Entity(loc);
        o.define(Config.SPAWN_CLASS);
        o.define({ CONTROLLERS: ["nearestDifferentMaster"] });
        o.refreshBodyAttributes();
        o.skill.score = Config.BOT_START_XP;
        o.isBot = true;
        o.name = botName;
        o.invuln = true;
        o.nameColor = "#ffffff";
        o.leftoverUpgrades = ran.chooseChance(...Config.BOT_CLASS_UPGRADE_CHANCES);
        let color = Config.RANDOM_COLORS ? Math.floor(Math.random() * 20) : team ? getTeamColor(team) : "darkGrey";
        o.color.base = color;
        if (team) o.team = team;
        bots.push(o);
        setTimeout(() => {
            // allow them to move
            // Save index so it isn't overwritten by the bot Class's index
            let index = o.index;
            o.define('bot');
            o.index = index;
            o.refreshBodyAttributes();
            o.invuln = false;
        }, 3000 + Math.floor(Math.random() * 7000));
        o.on('dead', () => util.remove(bots, bots.indexOf(o)));
    }
};

//evaluating js with a seperate console window if enabled
if (Config.REPL_WINDOW) {
    util.log('Starting REPL Terminal.');
    //TODO: figure out how to spawn a seperate window and put the REPL stdio in there instead
    //let { stdin, stdout, stderr } = (require('child_process').spawn("cmd.exe", ["/c", "node", "blank.js"], { detached: true }));
    require('repl').start({/* stdin, stdout, stderr,*/ useGlobal: true });
}

// Bring it to life
let counter = 0;
setInterval(() => {
    gameloop();
    gamemodeLoop();
    for (let y = 0; y < room.setup.length; y++) {
        for (let x = 0; x < room.setup[y].length; x++) {
            let tile = room.setup[y][x];
            tile.tick(tile);
            tile.entities = [];
        }
    }

    for (let y = 0; y < room.setup.length; y++) {
        for (let x = 0; x < room.setup[y].length; x++) {
            let tile = room.setup[y][x];
            tile.tick(tile);
            tile.entities = [];
        }
    }

    if (room.sendColorsToClient) {
        room.sendColorsToClient = false;
        sockets.broadcastRoom();
    }

    if (counter++ / Config.runSpeed > 30) {
        chatLoop();
        maintainloop();
        speedcheckloop();
        counter = 0;
    }

    syncedDelaysLoop();
}, room.cycleSpeed);

import { global } from "./global.js";
import { util } from "./util.js";
import { settings } from "./settings.js";
import { protocol } from "./protocol.js";
window.fakeLagMS = 0;
var sync = [];
var clockDiff = 0;
let truscore = 0;
let levelscore = 0;
let deduction = 0;
let level = 0;
let sscore = util.Smoothbar(0, 10);
var serverStart = 0,
    gui = {
        getStatNames: data => [
            data?.body_damage ?? 'Body Damage',
            data?.max_health ?? 'Max Health',
            data?.bullet_speed ?? 'Bullet Speed',
            data?.bullet_health ?? 'Bullet Health',
            data?.bullet_pen ?? 'Bullet Penetration',
            data?.bullet_damage ?? 'Bullet Damage',
            data?.reload ?? 'Reload',
            data?.move_speed ?? 'Movement Speed',
            data?.shield_regen ?? 'Shield Regeneration',
            data?.shield_cap ?? 'Shield Capacity',
        ],
        skills: [
            { amount: 0, color: 'purple', cap: 1, softcap: 1 },
            { amount: 0, color: 'pink', cap: 1, softcap: 1 },
            { amount: 0, color: 'blue', cap: 1, softcap: 1 },
            { amount: 0, color: 'lgreen', cap: 1, softcap: 1 },
            { amount: 0, color: 'red', cap: 1, softcap: 1 },
            { amount: 0, color: 'yellow', cap: 1, softcap: 1 },
            { amount: 0, color: 'green', cap: 1, softcap: 1 },
            { amount: 0, color: 'teal', cap: 1, softcap: 1 },
            { amount: 0, color: 'gold', cap: 1, softcap: 1 },
            { amount: 0, color: 'orange', cap: 1, softcap: 1 }
        ],
        points: 0,
        upgrades: [],
        playerid: -1,
        __s: {
            setScore: s => {
                if (s) {
                    sscore.set(s);
                    if (deduction > sscore.get()) {
                        level = 0;
                        deduction = 0;
                    }
                } else {
                    sscore = util.Smoothbar(0, 10);
                    level = 0;
                }
            },
            update: () => {
                levelscore = Math.ceil(Math.pow(level, 3) * 0.3083);
                if (sscore.get() >= levelscore - 0.01) {
                    deduction = levelscore;
                    level += 1;
                }
            },
            getProgress: () => levelscore ? Math.min(1, Math.max(0, (sscore.get() - deduction) / (levelscore - deduction))) : 0,
            getScore: () => sscore.get(),
            getLevel: () => level,
        },
        showhealthtext: false,
        type: 0,
        root: "",
        class: "",
        fps: 0,
        color: 0,
        accel: 0,
        topspeed: 1,
    };
let xx = 0,
    yy = 0,
    _vx = 0,
    _vy = 0;
var moveCompensation = {
    reset: () => {
        xx = 0;
        yy = 0;
    },
    get: () => {
        if (settings.lag.unresponsive) {
            return {
                x: 0,
                y: 0,
            };
        }
        return {
            x: xx,
            y: yy,
        };
    },
    iterate: (g) => {
        if (global.died || global.gameStart) return 0;
        // Add motion
        let damp = gui.accel / gui.topSpeed,
            len = Math.sqrt(g.x * g.x + g.y * g.y);
        _vx += gui.accel * g.x / len;
        _vy += gui.accel * g.y / len;
        // Dampen motion
        let motion = Math.sqrt(_vx * _vx + _vy * _vy);
        if (motion > 0 && damp) {
            let finalvelocity = motion / (damp / settings.roomSpeed + 1);
            _vx = finalvelocity * _vx / motion;
            _vy = finalvelocity * _vy / motion;
        }
        xx += _vx;
        yy += _vy;
    },
};
const Integrate = class {
    constructor(dataLength) {
        this.dataLength = dataLength;
        this.elements = {};
    }
    reset() {
        this.elements = {};
    }
    update(delta, index = 0) {
        let deletedLength = delta[index++]
        for (let i = 0; i < deletedLength; i++) delete this.elements[delta[index++]]
        let updatedLength = delta[index++]
        for (let i = 0; i < updatedLength; i++) {
            let id = delta[index++]
            let data = delta.slice(index, index + this.dataLength)
            index += this.dataLength
            this.elements[id] = data
        }
        return index
    }
    entries() {
        return Object.entries(this.elements).map(([id, data]) => ({
            id: +id,
            data
        }))
    }
}
const Minimap = class {
    constructor(speed = 250) {
        this.speed = speed
        this.map = {}
        this.lastUpdate = Date.now()
    }
    update(elements) {
        this.lastUpdate = Date.now()
        for (let [key, value] of Object.entries(this.map))
            if (value.now) {
                value.old = value.now
                value.now = null
            } else {
                delete this.map[key]
            }
        for (let element of elements)
            if (this.map[element.id]) {
                this.map[element.id].now = element
            } else {
                this.map[element.id] = {
                    old: null,
                    now: element
                }
            }
    }
    get() {
        let state = Math.min(1, (Date.now() - this.lastUpdate) / this.speed)
        let stateOld = 1 - state
        return Object.values(this.map).map(({ old, now }) => {
            if (!now) return {
                type: old.type,
                id: old.id,
                x: old.x,
                y: old.y,
                color: old.color,
                size: old.size,
                alpha: stateOld,
                width: old.width,
                height: old.height
            }
            if (!old) return {
                type: now.type,
                id: now.id,
                x: now.x,
                y: now.y,
                color: now.color,
                size: now.size,
                alpha: state,
                width: now.width,
                height: now.height
            }
            return {
                type: now.type,
                id: now.id,
                x: state * now.x + stateOld * old.x,
                y: state * now.y + stateOld * old.y,
                color: now.color,
                size: state * now.size + stateOld * old.size,
                alpha: 1,
                width: state * now.width + stateOld * old.width,
                height: state * now.height + stateOld * old.height
            }
        })
    }
}
// Build the leaderboard object
const Entry = class {
    constructor(to) {
        this.score = util.Smoothbar(0, 10, 3, .03);
        this.update(to);
    }
    update(to) {
        this.name = to.name;
        this.bar = to.bar;
        if (typeof to.bar === "string" && to.bar.includes(", ")) this.bar = +to.bar.split(", ")[0];
        this.color = to.color;
        this.index = to.index;
        this.score.set(to.score);
        this.old = false;
        this.nameColor = to.nameColor;
        this.id = to.id;
        this.label = to.label;
    }
    publish() {
        let indexes = this.index.split("-"),
            ref = global.mockups[parseInt(indexes[0])];
        return {
            id: this.id,
            image: util.getEntityImageFromMockup(this.index, this.color),
            position: ref.position,
            barColor: this.bar,
            label: this.name ? this.name + " - " + this.label : this.label,
            score: this.score.get(),
            nameColor: this.nameColor,
        };
    }
};
const Leaderboard = class {
    constructor() {
        this.entries = {};
    }
    get() {
        let out = [];
        let max = 1;
        for (let value of Object.values(this.entries)) {
            let data = value.publish();
            out.push(data);
            if (data.score > max) max = data.score;
        }
        out.sort((a, b) => b.score - a.score);
        return {
            data: out,
            max
        };
    }
    update(elements) {
        elements.sort((a, b) => b.score - a.score);
        for (let value of Object.values(this.entries)) value.old = true;
        for (let element of elements)
            if (this.entries[element.id]) this.entries[element.id].update(element);
            else this.entries[element.id] = new Entry(element);
        for (let [id, value] of Object.entries(this.entries))
            if (value.old) delete this.entries[id];
    }
};
let minimapAllInt = new Integrate(5),
    minimapTeamInt = new Integrate(3),
    leaderboardInt = new Integrate(7),
    leaderboard = new Leaderboard(),
    minimap = new Minimap(200);
let lags = [];
var lag = {
    get: () => lags.length ? lags.reduce((a, b) => a + b) / lags.length : 0,
    add: l => {
        lags.push(l);
        if (lags.length > settings.lag.memory) {
            lags.splice(0, 1);
        }
    }
};
var getNow = () => Date.now() - clockDiff - serverStart;
// Inital setup stuff
window.WebSocket = window.WebSocket || window.MozWebSocket;
// Make a data crawler
let crawlIndex = 0,
    crawlData = [];
const get = {
    next: () => {
        if (crawlIndex >= crawlData.length) {
            console.log(crawlData);
            throw new Error('Trying to crawl past the end of the provided data!');
        } else {
            return crawlData[crawlIndex++];
        }
    },
    set: (data) => {
        crawlData = data;
        crawlIndex = 0;
    },
    all: () => crawlData.slice(crawlIndex),
    take: amount => {
        crawlIndex += amount;
        if (crawlIndex > crawlData.length) {
            console.error(crawlData);
            throw new Error("Trying to crawl past the end of the provided data!");
        }
    }
};
function physics(g) {
    g.isUpdated = true;
    if (g.motion || g.position) {
        // Simulate recoil
        g.motion -= 0.2 * g.position;
        g.position += g.motion;
        if (g.position < 0) { // Bouncing off the back
            g.position = 0;
            g.motion = -g.motion;
        }
        if (g.motion > 0) {
            g.motion *= 0.5;
        }
    }
}
// Some status manager constructors
const GunContainer = n => {
    let a = [];
    for (let i = 0; i < n; i++) {
        a.push({
            motion: 0,
            position: 0,
            isUpdated: true,
            configLoaded: false,
            color: "",
            alpha: 0,
            strokeWidth: 0,
            borderless: false,
            drawFill: true,
            drawAbove: false,
            length: 0,
            width: 0,
            aspect: 0,
            angle: 0,
            direction: 0,
            offset: 0,
        });
    }
    return {
        getPositions: () => a.map(g => {
            return g.position;
        }),
        getConfig: () => a.map(g => {
            return {
                color: g.color,
                alpha: g.alpha,
                strokeWidth: g.strokeWidth,
                borderless: g.borderless,
                drawFill: g.drawFill,
                drawAbove: g.drawAbove,
                length: g.length,
                width: g.width,
                aspect: g.aspect,
                angle: g.angle,
                direction: g.direction,
                offset: g.offset,
            };
        }),
        setConfig: (ind, c) => {
            let g = a[ind];
            if (!g.configLoaded) {
                g.configLoaded = true;
                g.color = c.color;
                g.alpha = c.alpha;
                g.strokeWidth = c.strokeWidth
                g.borderless = c.borderless;
                g.drawFill = c.drawFill;
                g.drawAbove = c.drawAbove;
                g.length = c.length;
                g.width = c.width;
                g.aspect = c.aspect;
                g.angle = c.angle;
                g.direction = c.direction;
                g.offset = c.offset;
            }
        },
        update: () => {
            for (let instance of a) {
                physics(instance);
            }
        },
        fire: (i, power) => {
            if (a[i].isUpdated) a[i].motion += Math.sqrt(power) / 20;
            a[i].isUpdated = false;
        },
        length: a.length,
    };
};
function Status() {
    let statState = 'normal',
        statTime = getNow();
    return {
        set: val => {
            if (val !== statState || statState === 'injured') {
                if (statState !== 'dying') statTime = getNow();
                statState = val;
            }
        },
        getState: () => statState,
        getFade: () => {
            return (statState === 'dying' || statState === 'killed') ? 1 - Math.min(1, (getNow() - statTime) / 300) : 1;
        },
        getColor: () => {
            return '#FFFFFF';
        },
        getBlend: () => {
            let o = (statState === 'normal' || statState === 'dying') ? 0 :
                statState === 'invuln' ? 0.125 + Math.sin((getNow() - statTime) / 33) / 8 :
                    1 - Math.min(1, (getNow() - statTime) / 80);
            if (getNow() - statTime > 500 && statState === 'injured') {
                statState = 'normal';
            }
            return o;
        }
    };
}
// Make a converter
const process = (z = {}) => {
    let isNew = z.facing == null; // For whatever reason arguments.length is uglified poorly...
    // Figure out what kind of data we're looking at
    let type = get.next();
    // Handle it appropiately
    if (type & 0x01) { // issa turret
        z.facing = get.next();
        z.layer = get.next();
        z.index = get.next();
        z.color = get.next();
        z.strokeWidth = get.next();
        z.borderless = get.next();
        z.drawFill = get.next();
        z.size = get.next();
        z.realSize = get.next();
        z.sizeFactor = get.next();
        z.angle = get.next();
        z.direction = get.next();
        z.offset = get.next();
        z.mirrorMasterAngle = get.next();
    } else { // issa something real
        z.interval = global.metrics.rendergap;
        z.id = get.next();
        // Determine if this is an new entity or if we already know about it
        let i = global.entities.findIndex(x => x.id === z.id);
        if (i !== -1) {
            // remove it if needed (this way we'll only be left with the dead/unused entities)
            z = global.entities.splice(i, 1)[0];
        }
        // Change the use of the variable
        isNew = i === -1;
        // If it's not new, save the memory data
        if (!isNew) {
            z.render.draws = true; // yay!!
            z.render.lastx = z.x;
            z.render.lasty = z.y;
            z.render.lastvx = z.vx;
            z.render.lastvy = z.vy;
            z.render.lastf = z.facing;
            z.render.lastRender = global.player.time;
        }
        // Either way, keep pulling information
        z.index = get.next();
        z.x = get.next();
        z.y = get.next();
        z.vx = get.next();
        z.vy = get.next();
        z.size = get.next();
        z.facing = get.next();
        z.perceptionAngleIndependence = get.next();
        z.defaultAngle = get.next();
        z.twiggle = get.next();
        z.layer = get.next();
        z.color = get.next();
        z.borderless = get.next();
        z.drawFill = get.next();
        let invuln = get.next();
        // Update health, flagging as injured if needed
        if (isNew) {
            z.health = get.next() / 65535;
            z.healthN = get.next();
            z.maxHealthN = get.next();
            z.shield = get.next() / 65535;
        } else {
            let hh = z.health,
                ss = z.shield;
            z.health = get.next() / 65535;
            z.healthN = get.next();
            z.maxHealthN = get.next();
            z.shield = get.next() / 65535;
            // Update stuff
            if (z.health < hh || z.shield < ss) {
                z.render.status.set('injured');
            } else if (z.render.status.getFade() !== 1) {
                // If it turns out that we thought it was dead and it wasn't
                z.render.status.set('normal');
            }
        }
        z.alpha = get.next() / 255;
        z.drawsHealth = !!(type & 0x02); // force to boolean
        // Nameplates
        if (type & 0x04) { // has a nameplate
            z.name = get.next();
            z.score = get.next();
        }
        z.nameplate = type & 0x04;
        // If it's new, give it rendering information
        if (isNew) {
            z.render = {
                draws: false,
                expandsWithDeath: z.drawsHealth,
                lastRender: global.player.time,
                x: z.x,
                y: z.y,
                lastx: z.x - global.metrics.rendergap * settings.roomSpeed * (1000 / 40) * z.vx,
                lasty: z.y - global.metrics.rendergap * settings.roomSpeed * (1000 / 40) * z.vy,
                lastvx: z.vx,
                lastvy: z.vy,
                lastf: z.facing,
                f: z.facing,
                h: z.health,
                s: z.shield,
                interval: global.metrics.rendergap,
                slip: 0,
                status: Status(),
                health: util.Smoothbar(z.health, 0.5, 5, .15),
                shield: util.Smoothbar(z.shield, 0.5, 5, .15),
            };
        }
        if (invuln) {
            z.render.status.set('invuln');
        } else if (z.render.status.getState() === 'invuln') {
            z.render.status.set('normal');
        }
        // Update the rendering healthbars
        z.render.health.set(z.health);
        z.render.shield.set(z.shield);
        // Figure out if the class changed (and if so, refresh the guns and turrets)
        if (!isNew && z.oldIndex !== z.index) isNew = true;
        z.oldIndex = z.index;
    }
    // If it needs to have a gun container made, make one
    let gunnumb = get.next();
    if (isNew) {
        z.guns = GunContainer(gunnumb);
    } else if (gunnumb !== z.guns.length) {
        throw new Error('Mismatch between data gun number and remembered gun number!');
    }
    // Decide if guns need to be fired one by one
    for (let i = 0; i < gunnumb; i++) {
        let time = get.next(),
            power = get.next(),
            color = get.next(),
            alpha = get.next(),
            strokeWidth = get.next(),
            borderless = get.next(),
            drawFill = get.next(),
            drawAbove = get.next(),
            length = get.next(),
            width = get.next(),
            aspect = get.next(),
            angle = get.next(),
            direction = get.next(),
            offset = get.next();
        z.guns.setConfig(i, { color, alpha, strokeWidth, borderless, drawFill, drawAbove, length, width, aspect, angle, direction, offset }); // Load gun config into container
        if (time > global.player.lastUpdate - global.metrics.rendergap) z.guns.fire(i, power); // Shoot it
    }
    // Update turrets
    let turnumb = get.next();
    if (isNew || z.turrets.length !== turnumb) {
        z.turrets = [];
        for (let i = 0; i < turnumb; i++) {
            z.turrets.push(process());
        }
    } else {
        // if (z.turrets.length !== turnumb) {
        //     throw new Error('Mismatch between data turret number and remembered turret number!');
        // }
        for (let tur of z.turrets) {
            tur = process(tur);
        }
    }
    // Return our monsterous creation
    return z;
};
// This is what we use to figure out what the hell the server is telling us to look at
const convert = {
    begin: data => get.set(data),
    // Make a data convertor
    data: () => {
        // Set up the output thingy+
        let output = [];
        // Get the number of entities and work through them
        for (let i = 0, len = get.next(); i < len; i++) {
            output.push(process());
        }
        // Handle the dead/leftover entities
        for (let e of global.entities) {
            // Kill them
            e.render.status.set(e.health === 1 ? 'dying' : 'killed');
            // And only push them if they're not entirely dead and still visible
            if (e.render.status.getFade() !== 0 && util.isInView(e.render.x - global.player.renderx, e.render.y - global.player.rendery, e.size, true)) {
                output.push(e);
            } else {
                if (e.render.textobjs != null) {
                    for (let o of e.render.textobjs) {
                        o.remove();
                    }
                }
            }
        }
        // Save the new entities list
        global.entities = output;
        global.entities.sort((a, b) => {
            let sort = a.layer - b.layer;
            if (!sort) sort = b.id - a.id;
            if (!sort) throw new Error('tha fuq is up now');
            return sort;
        });
    },
    // Define our gui convertor
    gui: () => {
        let index = get.next(),
            // Translate the encoded index
            indices = {
                showhealthtext: index & 0x0800,
                class: index & 0x0400,
                root: index & 0x0200,
                topspeed: index & 0x0100,
                accel: index & 0x0080,
                skills: index & 0x0040,
                statsdata: index & 0x0020,
                upgrades: index & 0x0010,
                points: index & 0x0008,
                score: index & 0x0004,
                label: index & 0x0002,
                fps: index & 0x0001,
            };
        // Operate only on the values provided
        if (indices.fps) {
            gui.fps = get.next();
        }
        if (indices.label) {
            gui.type = get.next();
            gui.color = get.next();
            gui.playerid = get.next();
        }
        if (indices.score) {
            gui.__s.setScore(get.next());
        }
        if (indices.points) {
            gui.points = get.next();
        }
        if (indices.upgrades) {
            gui.upgrades = [];
            for (let i = 0, len = get.next(); i < len; i++) {
                gui.upgrades.push(get.next().split("\\\\//"));
                gui.upgrades[i][2] = util.getEntityImageFromMockup(gui.upgrades[i][2], gui.color);
            }
        }
        if (indices.statsdata) {
            for (let i = 9; i >= 0; i--) {
                gui.skills[i].name = get.next();
                gui.skills[i].cap = get.next();
                gui.skills[i].softcap = get.next();
            }
        }
        if (indices.skills) {
            let skk = get.next();
            gui.skills[0].amount = parseInt(skk.slice(0, 2), 16);
            gui.skills[1].amount = parseInt(skk.slice(2, 4), 16);
            gui.skills[2].amount = parseInt(skk.slice(4, 6), 16);
            gui.skills[3].amount = parseInt(skk.slice(6, 8), 16);
            gui.skills[4].amount = parseInt(skk.slice(8, 10), 16);
            gui.skills[5].amount = parseInt(skk.slice(10, 12), 16);
            gui.skills[6].amount = parseInt(skk.slice(12, 14), 16);
            gui.skills[7].amount = parseInt(skk.slice(14, 16), 16);
            gui.skills[8].amount = parseInt(skk.slice(16, 18), 16);
            gui.skills[9].amount = parseInt(skk.slice(18, 20), 16);
        }
        if (indices.accel) {
            gui.accel = get.next();
        }
        if (indices.topspeed) {
            gui.topspeed = get.next();
        }
        if (indices.root) {
            gui.root = get.next();
        }
        if (indices.class) {
            gui.class = get.next();
        }
        if (indices.showhealthtext) {
            gui.showhealthtext = get.next();
        }
    },
    broadcast: () => {
        let all = get.all();
        let by = minimapAllInt.update(all);
        by = minimapTeamInt.update(all, by);
        by = leaderboardInt.update(all, by);
        get.take(by);
        let map = [];
        for (let {
            id,
            data
        } of minimapAllInt.entries()) {
            map.push({
                id,
                type: data[0],
                x: (data[1] * global.gameWidth) / 255,
                y: (data[2] * global.gameHeight) / 255,
                color: data[3],
                size: data[4]
            });
        }
        for (let {
            id,
            data
        } of minimapTeamInt.entries()) {
            map.push({
                id,
                type: 0,
                x: (data[0] * global.gameWidth) / 255,
                y: (data[1] * global.gameHeight) / 255,
                color: data[2],
                size: 0
            });
        }
        minimap.update(map);
        let entries = [];
        for (let {
            id,
            data
        } of leaderboardInt.entries()) {
            entries.push({
                id,
                score: data[0],
                index: data[1],
                name: data[2],
                color: data[3],
                bar: data[4],
                nameColor: data[5],
                label: data[6],
            })
        }
        leaderboard.update(entries);
    }
};
const protocols = {
    "http:": "ws://",
    "https:": "wss://"
};
const socketInit = port => {
    window.resizeEvent();
    let socket = new WebSocket(protocols[location.protocol] + window.serverAdd);
    // Set up our socket
    socket.binaryType = 'arraybuffer';
    socket.open = false;
    // Handle commands
    let flag = false;
    let commands = [
        false, // moving
        false, // lmb
        false, // mmb
        false, // rmb
    ];
    socket.cmd = {
        set: (index, value) => {
            if (commands[index] !== value) {
                commands[index] = value;
                flag = true;
            }
        },
        talk: () => {
            flag = false;
            let o = 0;
            for (let i = 0; i < commands.length; i++) {
                if (commands[i]) o += Math.pow(2, i);
            }
            let ratio = util.getRatio();
            socket.talk('C', Math.round(global.target.x / ratio), Math.round(global.target.y / ratio), global.reverseTank, global.movement, o);
        },
        check: () => flag,
    };
    // Learn how to talk
    socket.talk = async (...message) => {
        await new Promise(Resolve => setTimeout(Resolve, window.fakeLagMS));
        // Make sure the socket is open before we do anything
        if (!socket.open) return 1;
        socket.send(protocol.encode(message));
    };
    // Websocket functions for when stuff happens
    // This is for when the socket first opens
    socket.onopen = function socketOpen() {
        socket.open = true;
        global.message = 'That token is invalid, expired, or already in use on this server. Please try another one!';
        socket.talk('k', global.playerKey);
        console.log('Token submitted to the server for validation.');
        // define a pinging function
        socket.ping = payload => socket.talk('p', payload);
        socket.commandCycle = setInterval(() => {
            if (socket.cmd.check()) socket.cmd.talk();
        });
    };
    // Handle incoming messages
    socket.onmessage = async function socketMessage(message) {
        await new Promise(Resolve => setTimeout(Resolve, window.fakeLagMS));
        // Make sure it looks legit.
        let m = protocol.decode(message.data);
        if (m === -1) {
            throw new Error('Malformed packet.');
        }
        // Decide how to interpret it
        switch (m.shift()) {
            case 'w': // welcome to the game
                if (m[0]) { // Ask to spawn
                    console.log('The server has welcomed us to the game room.');
                    global.message = 'Loading mockups, this could take a bit...';
                    global.mockupLoading.then(() => {
                        console.log('Sending spawn request.');
                        socket.talk('s', global.playerName, 1, 1 * settings.game.autoLevelUp);
                        global.message = '';
                    });
                }
                break;
            case 'R': // room setup
                global.gameWidth = m[0];
                global.gameHeight = m[1];
                global.roomSetup = JSON.parse(m[2]);
                serverStart = JSON.parse(m[3]);
                settings.roomSpeed = m[4];
                console.log('Room data received. Commencing syncing process.');
                // Start the syncing process
                socket.talk('S', getNow());
                break;
            case "r":
                global.gameWidth = m[0];
                global.gameHeight = m[1];
                global.roomSetup = JSON.parse(m[2]);
                break;
            case 'info': // info
                global.message = m[0];
                console.log(m[0]);
                break;
            case "svInfo": // For debugging.
                global.serverName = m[0];
                global.mspt = m[1];
                if (global.showDebug) console.log(`mspt: ${global.mspt} total entities on screen: ${global.entities.length} Player X: ${(global.player.renderx).toFixed(1)} Player Y: ${(global.player.rendery).toFixed(1)}`);
                break;
            case "updateName": // Update the name if needed.
                global.player.name = m[0];
                break;
            case 'c': // force camera move
                global.player.renderx = global.player.cx = m[0];
                global.player.rendery = global.player.cy = m[1];
                global.player.renderv = global.player.view = m[2];
                global.player.nameColor = m[3];
                console.log('Camera moved!');
                break;
            case 'S': // clock syncing
                let clientTime = m[0],
                    serverTime = m[1],
                    laten = (getNow() - clientTime) / 2,
                    delta = getNow() - laten - serverTime;
                // Add the datapoint to the syncing data
                sync.push({ delta: delta, latency: laten, });
                // Do it again a couple times
                if (sync.length < 10) {
                    // Wait a bit just to space things out
                    setTimeout(() => socket.talk('S', getNow()), 10);
                    global.canThrowSyncClockError = true;
                    global.message = "Syncing clocks, please do not tab away. " + sync.length + "/10...";
                } else {
                    // Calculate the clock error
                    sync.sort((e, f) => e.latency - f.latency);
                    let median = sync[Math.floor(sync.length / 2)].latency;
                    let sd = 0,
                        sum = 0,
                        valid = 0;
                    for (let e of sync) {
                        sd += Math.pow(e.latency - median, 2);
                    }
                    sd = Math.sqrt(sd / sync.length);
                    for (let e of sync) {
                        if (Math.abs(e.latency - median) < sd) {
                            sum += e.delta;
                            valid++;
                        }
                    }
                    clockDiff = Math.round(sum / valid);
                    global.canThrowSyncClockError = false;
                    // Start the game
                    console.log(sync);
                    console.log('Syncing complete, calculated clock difference ' + clockDiff + 'ms. Beginning game.');
                    console.log('Beginning game.');
                    global.gameStart = true;
                    global.entities = [];
                    global.message = '';
                    global.canThrowClosedMessage = true;
                }
                break;
            case 'm': // message
                global.createMessage(m[1], m[0]);
                break;
            case 'u': // uplink
                // Pull the camera info
                let camtime = m[0],
                    camx = m[1],
                    camy = m[2],
                    camfov = m[3],
                    camvx = m[4],
                    camvy = m[5],
                    camscoping = m[6],
                    // We'll have to do protocol decoding on the remaining data
                    theshit = m.slice(7);
                // Process the data
                if (camtime > global.player.lastUpdate) { // Don't accept out-of-date information.
                    // Time shenanigans
                    lag.add(getNow() - camtime);
                    global.player.time = camtime + lag.get();
                    global.metrics.rendergap = camtime - global.player.lastUpdate;
                    if (global.metrics.rendergap <= 0) {
                        console.log('yo some bullshit is up wtf');
                    }
                    global.player.lastUpdate = camtime;
                    // Convert the gui and entities
                    convert.begin(theshit);
                    convert.gui();
                    convert.data();
                    // Save old physics values
                    global.player.lastx = global.player.cx;
                    global.player.lasty = global.player.cy;
                    global.player.lastvx = global.player.vx;
                    global.player.lastvy = global.player.vy;
                    // Get new physics values
                    global.player.cx = camx;
                    global.player.cy = camy;
                    global.player.vx = global.died ? 0 : camvx;
                    global.player.vy = global.died ? 0 : camvy;
                    // For centered camera
                    global.player.isScoping = camscoping;
                    // Figure out where we're rendering if we don't yet know
                    if (isNaN(global.player.renderx)) {
                        global.player.renderx = global.player.cx;
                    }
                    if (isNaN(global.player.rendery)) {
                        global.player.rendery = global.player.cy;
                    }
                    moveCompensation.reset();
                    // Fov stuff
                    global.player.view = camfov;
                    if (isNaN(global.player.renderv) || global.player.renderv === 0) {
                        global.player.renderv = 2000;
                    }
                    // Metrics
                    global.metrics.lastlag = global.metrics.lag;
                    global.metrics.lastuplink = getNow();
                } else {
                    console.log("Old data! Last given time: " + global.player.time + "; offered packet timestamp: " + camtime + ".");
                }
                // Send the downlink and the target
                socket.talk('d', Math.max(global.player.lastUpdate, camtime));
                socket.cmd.talk();
                global.updateTimes++; // metrics
                break;
            case "b":
                convert.begin(m);
                convert.broadcast();
                break;
            case 'p': // ping
                global.metrics.latency = global.time - m[0];
                break;
            case 'F': // to pay respects
                global.finalScore = util.Smoothbar(0, 4);
                global.finalScore.set(m[0]);
                global.finalLifetime = util.Smoothbar(0, 5);
                global.finalLifetime.set(m[1]);
                global.finalKills = [util.Smoothbar(0, 3), util.Smoothbar(0, 4.5), util.Smoothbar(0, 2.5), util.Smoothbar(0, 10)];
                global.respawnTimeout = m[2];
                if (global.respawnTimeout > 0) {
                    global.cannotRespawn = true;
                    let respawnTimeoutloop = setInterval(() => {
                        if (global.respawnTimeout <= 1) {
                            global.cannotRespawn = false;
                            global.respawnTimeout = false;
                            clearInterval(respawnTimeoutloop);
                        } else {
                            global.respawnTimeout--;
                        }
                    }, 1000); // One second.
                }
                global.finalKills[0].set(m[3]);
                global.finalKills[1].set(m[4]);
                global.finalKills[2].set(m[5]);
                global.finalKills[3].set(m[6]);
                global.finalKillers = [];
                for (let i = 0; i < m[7]; i++) {
                    global.finalKillers.push(m[8 + i]);
                }
                window.animations.deathScreen.reset();
                window.canvas.reverseDirection = false;
                global.died = true;
                global.autoSpin = false;
                global.syncingWithTank = false;
                window.onbeforeunload = () => false;
                break;
            case 'I': // sync with the tank
                if (m[0]) {
                    global.syncingWithTank = true;
                } else {
                    global.syncingWithTank = false;
                }
                break;
            case 'K': // kicked
                window.onbeforeunload = () => false;
                break;
            case 'z': // name color
                global.nameColor = m[0];
                break;
            case 'CHAT_MESSAGE_ENTITY':
                get.set(m);
                global.chats = {};

                for (let i = get.next(); i; i--) {
                    let spamCollection = [];
                    global.chats[get.next()] = spamCollection;

                    for (let j = get.next(); j; j--) {
                        spamCollection.push({
                            text: get.next(),
                            expires: parseFloat(get.next())
                        });
                    }
                }
                break;
            default:
                throw new Error('Unknown message index.');
        }
    };
    // Handle closing
    socket.onclose = () => {
        socket.open = false;
        global.disconnected = true;
        clearInterval(socket.commandCycle);
        window.onbeforeunload = () => false;
        console.log('The connection has closed.');
        if (global.canThrowSyncClockError) global.message = "Failed to sync with the server. Please try again."
        if (global.canThrowClosedMessage) global.message = "The connection has closed. Refresh to continue playing!"
    };
    // Notify about errors
    socket.onerror = error => {
        console.log('WebSocket error: ' + error);
        global.message = 'Socket error. Maybe another server will work.';
    };
    // Gift it to the rest of the world
    return socket;
};

export { socketInit, gui, leaderboard, minimap, moveCompensation, lag, getNow };

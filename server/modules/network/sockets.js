let permissionsDict = {},
    net = require('net'),
    clients = [],
    players = [],
    disconnections = [];

for (let entry of require("../../permissions.js")) {
    permissionsDict[entry.key] = entry;
}

// Closing the socket
function close(socket) {
    // Figure out who the player was
    let player = socket.player,
        index = players.indexOf(player);
    // Remove it from any group if there was one...
    if (socket.group) groups.removeMember(socket);
    // Remove the player if one was created
    if (index != -1) {
        // Kill the body if it exists
        if (player.body != null) {
            if (player.body.underControl) {
                player.body.giveUp(player);
            }
            if (player.body.invuln) {
                player.body.invuln = false;
                player.body.kill();
            } else {
                let timeout = setTimeout(function () {
                    if (player.body != null) {
                        player.body.kill();
                    }
                    util.remove(disconnections, disconnections.indexOf(disconnection));
                }, 60000);
                let disconnection = {
                    body: player.body,
                    ip: socket.ip,
                    timeout: timeout,
                };
                disconnections.push(disconnection);
                player.command.autospin = false;
                player.body.life();
            }
        }
        // Disconnect everything
        util.log("[INFO] " + (player.body ? `User ${player.body.name == "" ? "A unnamed player" : player.body.name}` : "A user without an entity") + " disconnected!");
        util.remove(players, index);
    } else {
        util.log("[INFO] A player disconnected before entering the game.");
    }
    // Free the view
    util.remove(views, views.indexOf(socket.view));
    // Remove the socket
    util.remove(clients, clients.indexOf(socket));
    util.log("[INFO] The connection has closed. Views: " + views.length + ". Clients: " + clients.length + ".");
}
// Being kicked
function kick(socket, reason = "No reason given.") {
    util.warn(reason + " Kicking.");
    socket.lastWords("K");
}

function chatLoop() {
    // clean up expired messages
    let now = Date.now();
    for (let i in chats) {
        chats[i] = chats[i].filter(chat => chat.expires > now);
        if (!chats[i].length) {
            delete chats[i];
        }
    }

    // send chat messages to everyone
    for (let view of views) {
        let spammersAdded = 0,
            array = [];

        // data format:
        // [ entityCount,
        //   entityId1, chatMessageCount1, chatMsg1_1, chatExp1_1, chatMsg1_2, chatExp1_2, ... ,
        //   entityId2, chatMessageCount2, chatMsg2_1, chatExp2_1, chatMsg2_2, chatExp2_2, ... ,
        //   entityId3, chatMessageCount3, chatMsg3_1, chatExp3_1, chatMsg3_2, chatExp3_2, ... ,
        //   ... ]
        for (let entity of view.nearby) {
            let id = entity.id;
            if (chats[id]) {
                spammersAdded++;
                array.push(id, chats[id].length);
                for (let chat of chats[id]) {
                    array.push(chat.message, chat.expires.toString());
                }
            }
        }

        view.socket.talk('CHAT_MESSAGE_ENTITY', spammersAdded, ...array);
    }
}

// Handle incoming messages
function incoming(message, socket) {
    // Only accept binary
    if (!(message instanceof ArrayBuffer)) {
        socket.kick("Non-binary packet.");
        return 1;
    }
    // Decode it
    let m = protocol.decode(message);
    // Make sure it looks legit
    if (m === -1) {
        socket.kick("Malformed packet.");
        return 1;
    }
    // Log the message request
    socket.status.requests++;
    // Remember who we are
    let player = socket.player;
    // Handle the request
    if (socket.resolveResponse(m[0], m)) {
        return;
    }
    switch (m.shift()) {
        case "k":
            // key verification
            if (m.length > 1) {
                socket.kick("Ill-sized key request.");
                return 1;
            }
            if (socket.status.verified) {
                socket.kick("Duplicate verification attempt.");
                return 1;
            }
            socket.talk("w", true);
            if (m.length === 1) {
                let key = m[0].toString().trim();
                socket.permissions = permissionsDict[key];
                if (socket.permissions) {
                    util.log(`[INFO] A socket ( ${socket.ip} ) was verified with the token: ${key}`);
                } else {
                    util.log(`[WARNING] A socket ( ${socket.ip} ) failed to verify with the token: ${key}`);
                }
                socket.key = key;
            }
            socket.verified = true;
            util.log(`[INFO] A socket ( ${socket.ip} ) has been welcomed to the server room. Waiting for spawn request.`);
            util.log("Clients: " + clients.length);
            break;
        case "s":
            // spawn request
            util.log(`[INFO] A socket ( ${socket.ip} ) is asking for spawn request, checking all securities...`);
            if (!socket.status.deceased) {
                socket.kick("Trying to spawn while already alive.");
                return 1;
            }
            if (m.length !== 3) {
                socket.kick("Ill-sized spawn request.");
                return 1;
            }
            // Get data
            let name = m[0].replace(Config.BANNED_CHARACTERS_REGEX, "");
            let needsRoom = m[1];
            let autoLVLup = m[2];
            // Verify it
            if (typeof name != "string") {
                socket.kick("Bad spawn request name.");
                return 1;
            }
            if (encodeURI(name).split(/%..|./).length > 48) {
                socket.kick("Overly-long name.");
                return 1;
            }
            if (typeof m[1] !== "number") {
                socket.kick("Bad spawn request needsRoom.");
                return 1;
            }
            if (typeof autoLVLup !== "number") {
                socket.kick("Bad spawn request autoLVLup.");
                return 1;
            }
            if (global.arenaClosed) return 1;
            // Bring to life
            socket.status.deceased = false;
            // Define the player.
            if (players.indexOf(socket.player) != -1) {
                util.remove(players, players.indexOf(socket.player));
            }
            // Free the old view
            if (views.indexOf(socket.view) != -1) {
                util.remove(views, views.indexOf(socket.view));
                socket.makeView();
            }
            util.log("[INFO] Passed the security, spawning player.");
            socket.party = m[4];
            socket.player = socket.spawn(name);

            if (autoLVLup) {
                while (socket.player.body.skill.level < Config.LEVEL_CHEAT_CAP) {
                    socket.player.body.skill.score += socket.player.body.skill.levelScore;
                    socket.player.body.skill.maintain();
                    socket.player.body.refreshBodyAttributes();
                }
            }
            //socket.view.gazeUpon();
            //socket.lastUptime = Infinity;
            // Give it the room state
            if (needsRoom) socket.talk(
                "R",
                room.width,
                room.height,
                JSON.stringify(room.setup.map(x => x.map(t => t.color.compiled))),
                JSON.stringify(util.serverStartTime),
                Config.runSpeed,
                Config.ARENA_TYPE
            );
            // Give the server name
            if (needsRoom) socket.talk("svInfo", Config.gameModeName, "?");
            // More important stuff
            socket.talk("updateName", socket.player.body.name);
            // Log it
            util.log(`[INFO] ${name == "" ? "An unnamed player" : m[0]} ${needsRoom ? "joined" : "rejoined"} the game on team ${socket.player.body.team}! Players: ${players.length}`);
            break;
        case "S":
            // clock syncing
            if (m.length !== 1) {
                socket.kick("Ill-sized sync packet.");
                return 1;
            }
            // Get data
            let synctick = m[0];
            // Verify it
            if (typeof synctick !== "number") {
                socket.kick("Weird sync packet.");
                return 1;
            }
            // Bounce it back
            socket.talk("S", synctick, performance.now());
            break;
        case "p":
            // ping
            if (m.length !== 1) {
                socket.kick("Ill-sized ping.");
                return 1;
            }
            // Get data
            let ping = m[0];
            // Verify it
            if (typeof ping !== "number") {
                socket.kick("Weird ping.");
                return 1;
            }
            // Pong
            socket.talk("p", m[0]); // Just pong it right back
            socket.status.lastHeartbeat = performance.now();
            break;
        case "d":
            // downlink
            if (m.length !== 1) {
                socket.kick("Ill-sized downlink.");
                return 1;
            }
            // Get data
            let time = m[0];
            // Verify data
            if (typeof time !== "number") {
                socket.kick("Bad downlink.");
                return 1;
            }
            //socket.view.gazeUpon();
            //socket.lastUptime = Infinity;
            break;
        case "C":
            // command packet
            if (m.length !== 5) {
                socket.kick("Ill-sized command packet.");
                return 1;
            }
            // Get data
            let target = {
                    x: m[0],
                    y: m[1],
                },
                reverseTank = m[2],
                movement = m[3],
                commands = m[4];
            // Verify data
            if (
                typeof target.x !== "number" ||
                typeof target.y !== "number" ||
                typeof movement !== "number" ||
                typeof commands !== "number"
            ) {
                socket.kick("Weird downlink.");
                return 1;
            }
            if (commands > 255) {
                socket.kick("Malformed command packet.");
                return 1;
            }
            // Will not work out
            // if (Config.SPACE_MODE && player.body) {
            //     let spaceOffsetAngle = Math.atan2(
            //         room.width / 2 - player.body.x,
            //         room.height / 2 - player.body.y
            //     );
            //     let vecLength = Math.sqrt(Math.pow(m[0], 2) + Math.pow(m[1], 2));
            //     vecAngle = Math.atan2(m[1], m[0]) - spaceOffsetAngle;
            //     target = {
            //         x: Math.cos(angle) * length,
            //         y: Math.sin(angle) * length,
            //     };
            // }
            // Put the new target in
            player.target = target;
            if (player.body) player.body.reverseTank = reverseTank;
            // Process the commands
            if (player.command != null && player.body != null) {
                let moving = commands & 1;
                player.command.movement = moving ? {
                    x: Math.cos(movement),
                    y: Math.sin(movement)
                } : { x: 0, y: 0 };
                player.command.lmb = (commands & 2) >> 1;
                player.command.mmb = (commands & 4) >> 2;
                player.command.rmb = (commands & 8) >> 3;
            }
            // Update the thingy
            socket.timeout.set(commands);
            break;
        case "t":
            // player toggle
            if (m.length !== 2) {
                socket.kick("Ill-sized toggle.");
                return 1;
            }
            // Get data
            let tog = m[0];
            // Verify request
            if (typeof tog !== "number") {
                socket.kick("Weird toggle.");
                return 1;
            }
            let sendMessage = m[1];
            // ...what are we supposed to do?
            let given = [
                "autospin",
                "autofire",
                "override",
                "autoalt",
                "spinlock" //spinlock does something both in client and server side
            ][tog];

            // Kick if it sent us shit.
            if (!given) {
                socket.kick("Bad toggle.");
                return 1;
            }
            // Apply a good request.
            if (player.command != null && player.body != null) {
                player.command[given] = !player.command[given];
                // Send a message.
                if (sendMessage) player.body.sendMessage(given.charAt(0).toUpperCase() + given.slice(1) + (player.command[given] ? " enabled." : " disabled."));
            }
            break;
        case "U":
            // upgrade request
            if (m.length !== 2) {
                socket.kick("Ill-sized upgrade request.");
                return 1;
            }
            // Get data
            let upgrade = m[0];
            let branchId = m[1];
            // Verify the request
            if (typeof upgrade != "number" || upgrade < 0 || typeof branchId != "number" || branchId < 0) {
                socket.kick("Bad upgrade request.");
                return 1;
            }
            // Upgrade it
            if (player.body != null) {
                player.body.upgrade(upgrade, branchId); // Ask to upgrade
            }
            break;
        case "x":
            // skill upgrade request
            if (m.length !== 2) {
                socket.kick("Ill-sized skill request.");
                return 1;
            }
            let number = m[0],
                max = m[1],
                stat = ["atk", "hlt", "spd", "str", "pen", "dam", "rld", "mob", "rgn", "shi"][number];

            if (typeof number != "number") {
                socket.kick("Weird stat upgrade request number.");
                return 1;
            }
            if (typeof max != "number") {
                socket.kick("Weird stat upgrade request max boolean.");
                return 1;
            }
            if (max !== 0 && 1 !== max) {
                socket.kick("invalid upgrade request max boolean.");
                return 1;
            }

            if (!stat) {
                socket.kick("Unknown stat upgrade request.");
                return 1;
            }

            if (player.body != null) {
                let limit = 256;
                do {
                    player.body.skillUp(stat);
                } while (limit-- && max && player.body.skill.points && player.body.skill.amount(stat) < player.body.skill.cap(stat))
            }
            break;
        case "L":
            // level up cheat
            if (m.length !== 0) {
                socket.kick("Ill-sized level-up request.");
                return 1;
            }
            // cheatingbois
            if (player.body == null || player.body.underControl) return;
            if (player.body.skill.level < Config.LEVEL_CHEAT_CAP || (socket.permissions && socket.permissions.infiniteLevelUp)) {
                player.body.skill.score += player.body.skill.levelScore;
                player.body.skill.maintain();
                player.body.refreshBodyAttributes();
            }
            break;
        case "0":
            // testbed cheat
            if (m.length !== 0) {
                socket.kick("Ill-sized testbed request.");
                return 1;
            }
            // cheatingbois
            if (player.body != null && socket.permissions && socket.permissions.class) {
                player.body.define({ RESET_UPGRADES: true, BATCH_UPGRADES: false });
                player.body.define(socket.permissions.class);
                if (player.body.color.base == '-1' || player.body.color.base == 'mirror') {
                    player.body.color.base = getTeamColor((Config.GROUPS || (Config.MODE == 'ffa' && !Config.TAG)) ? TEAM_RED : player.body.team);
                }
            }
            break;
        case "1":
            //suicide squad
            if (player.body != null && !player.body.underControl) {
                for (const instance of entities.values()) {
                    if (instance.settings.clearOnMasterUpgrade && instance.master.id === player.body.id) {
                        instance.kill();
                    }
                }
                player.body.destroy();
            }
            break;
        case "A":
            if (player.body != null) return 1;
            let possible = []
            for (const entry of entities.values()) {
                if (entry.type === "miniboss") possible.push(entry);
                if (entry.isDominator || entry.isMothership || entry.isArenaCloser) possible.push(entry);
                if (Config.MODE === "tdm" && socket.rememberedTeam === entry.team && entry.type === "tank" && entry.bond == null) possible.push(entry);
            }
            if (!possible.length) {
                player.body.sendMessage("There are no entities to spectate!");
                return 1;
            }
            let entity;
            do {
                entity = ran.choose(possible);
            } while (entity === socket.spectateEntity && possible.length > 1);
            socket.spectateEntity = entity;
            player.body.sendMessage(`You are now spectating ${entity.name.length ? entity.name : "An unnamed player"}! (${entity.label})`);
            break;
        case "H":
            if (player.body == null) return 1;
            let body = player.body;
            body.emit("control", { body })
            if (body.underControl) {
                if (Config.DOMINATOR_LOOP) {
                    player.body.sendMessage("You have relinquished control of the dominator.");
                    body.giveUp(player, body.isDominator ? "" : undefined);
                    return 1;
                } else if (Config.MOTHERSHIP_LOOP) {
                    player.body.sendMessage("You have relinquished control of the mothership.");
                    body.giveUp(player, body.isDominator ? "" : undefined);
                    return 1;
                } else {
                    player.body.sendMessage("You have relinquished control of the special tank.");
                    body.giveUp(player, body.isDominator ? "" : undefined);
                    return 1;
                }
            }
            if (Config.MOTHERSHIP_LOOP) {
                let motherships = entities
                    .map((entry) => {
                        if (
                            entry.isMothership &&
                            entry.team === player.body.team &&
                            !entry.underControl
                        )
                            return entry;
                    })
                    .filter((instance) => instance);
                if (!motherships.length) {
                    player.body.sendMessage("There are no motherships available that are on your team or already controlled by an player.");
                    return 1;
                }
                let mothership = motherships.shift();
                mothership.controllers = [];
                mothership.underControl = true;
                player.body = mothership;
                player.body.become(player);
                body.kill();
                if (!player.body.dontIncreaseFov) player.body.FOV += 0.5;
                player.body.dontIncreaseFov = true;
                player.body.skill.points = 0;
                player.body.refreshBodyAttributes();
                player.body.name = body.name;
                player.body.sendMessage("You are now controlling the mothership.");
                player.body.sendMessage("Press F to relinquish control of the mothership.");
            } else if (Config.DOMINATOR_LOOP) {
                const dominators = [];
                for (const entity of entities.values()) {
                    if (entity.isDominator && entity.team === player.body.team && !entity.underControl) {
                        dominators.push(entity);
                    }
                }
                if (!dominators.length) {
                    player.body.sendMessage("There are no dominators available that are on your team or already controlled by an player.");
                    return 1;
                }
                let dominator = dominators.shift();
                dominator.controllers = [];
                dominator.underControl = true;
                player.body = dominator;
                player.body.become(player, true);
                body.dontSendDeathMessage = true;
                body.kill();
                if (!player.body.dontIncreaseFov) player.body.FOV += 0.5;
                player.body.dontIncreaseFov = true;
                player.body.skill.points = 0;
                player.body.refreshBodyAttributes();
                player.body.name = body.name;
                player.body.sendMessage("You are now controlling the dominator.");
                player.body.sendMessage("Press F to relinquish control of the dominator.");
            } else {
                player.body.sendMessage("There are no special tanks in this mode that you can control.");
            }
            break;

        case "M":
            if (player.body == null) return 1;
            let abort, message = m[0], original = m[0];

            if ("string" !==  typeof message) {
                socket.kick("Non-string chat message.");
                return 1;
            }

            util.log(player.body.name + ': ' + original);

            if (Config.SANITIZE_CHAT_MESSAGE_COLORS) {
                // I thought it should be "§§" but it only works if you do "§§§§"?
                message = message.replace(/§/g, "§§§§");
                original = original.replace(/§/g, "§§§§");
            }

            Events.emit('chatMessage', { message: original, socket, preventDefault: () => abort = true, setMessage: str => message = str });

            // we are not anti-choice here.
            if (abort) break;

            if (message !== original) {
                util.log('changed to: ' + message);
            }

            let id = player.body.id;
            if (!chats[id]) {
                chats[id] = [];
            }

            // TODO: this needs to be lag compensated, so the message would not last 1 second less due to high ping
            chats[id].unshift({ message, expires: Date.now() + Config.CHAT_MESSAGE_DURATION });

            // do one tick of the chat loop so they don't need to wait 100ms to receive it.
            chatLoop();

            // for (let i = 0; i < clients.length; i++) {
            //     clients[i].talk("CHAT_MESSAGE_BOX", message);
            // }
            break;
    }
}
// Monitor traffic and handle inactivity disconnects
function traffic(socket) {
    let strikes = 0;
    // This function wiSl be called in the slow loop
    return () => {
        // Kick if it's d/c'd
        if (performance.now() - socket.status.lastHeartbeat > Config.maxHeartbeatInterval) {
            socket.kick("Heartbeat lost.");
            return 0;
        }
        // Add a strike if there's more than 50 requests in a second
        if (socket.status.requests > 50) {
            strikes++;
        } else {
            strikes = 0;
        }
        // Kick if we've had 3 violations in a row
        if (strikes > 3) {
            socket.kick("Socket traffic volume violation!");
            return 0;
        }
        // Reset the requests
        socket.status.requests = 0;
    };
}

// This is because I love to cheat
// Define a little thing that should automatically keep
// track of whether or not it needs to be updated
function floppy(value = null) {
    let flagged = true;
    return {
        // The update method
        update: (newValue) => {
            let eh = false;
            if (value == null) {
                eh = true;
            } else {
                if (typeof newValue != typeof value) {
                    eh = true;
                }
                // Decide what to do based on what type it is
                switch (typeof newValue) {
                    case "number":
                    case "string":
                        if (newValue !== value) {
                            eh = true;
                        }
                        break;
                    case "object":
                        if (Array.isArray(newValue)) {
                            if (newValue.length !== value.length) {
                                eh = true;
                            } else {
                                for (let i = 0, len = newValue.length; i < len; i++) {
                                    if (newValue[i] !== value[i]) eh = true;
                                }
                            }
                            break;
                        }
                    default:
                        util.error(newValue);
                        throw new Error("Unsupported type for a floppyvar!");
                }
            }
            // Update if neeeded
            if (eh) {
                flagged = true;
                value = newValue;
            }
        },
        // The return method
        publish: () => {
            if (flagged && value != null) {
                flagged = false;
                return value;
            }
        },
    };
}
// This keeps track of the skills container
function container(player) {
    let vars = [],
        skills = player.body.skill,
        out = [],
        statnames = ["atk", "hlt", "spd", "str", "pen", "dam", "rld", "mob", "rgn", "shi"];
    // Load everything (b/c I'm too lazy to do it manually)
    for (let i = 0; i < statnames.length; i++) {
        vars.push(floppy());
        vars.push(floppy());
        vars.push(floppy());
    }
    return {
        update: () => {
            let needsupdate = false,
                i = 0;
            // Update the things
            for (let j = 0; j < statnames.length; j++) {
                let a = statnames[j];
                vars[i++].update(skills.title(a));
                vars[i++].update(skills.cap(a));
                vars[i++].update(skills.cap(a, true));
            }
            /* This is a for and not a find because we need
             * each floppy cyles or if there's multiple changes
             * (there will be), we'll end up pushing a bunch of
             * excessive updates long after the first and only
             * needed one as it slowly hits each updated value
             */
            for (let j = 0; j < vars.length; j++)
                if (vars[j].publish() != null) needsupdate = true;
            if (needsupdate) {
                // Update everything
                for (let j = 0; j < statnames.length; j++) {
                    let a = statnames[j];
                    out.push(skills.title(a));
                    out.push(skills.cap(a));
                    out.push(skills.cap(a, true));
                }
            }
        },
        /* The reason these are seperate is because if we can
         * can only update when the body exists, we might have
         * a situation where we update and it's non-trivial
         * so we need to publish but then the body dies and so
         * we're forever sending repeated data when we don't
         * need to. This way we can flag it as already sent
         * regardless of if we had an update cycle.
         */
        publish: () => {
            if (out.length) {
                let o = out.splice(0, out.length);
                out = [];
                return o;
            }
        },
    };
}
// This makes a number for transmission
function getstuff(s) {
    let val = '';
    //these have to be in reverse order
    val += s.amount("shi").toString(16).padStart(2, '0');
    val += s.amount("rgn").toString(16).padStart(2, '0');
    val += s.amount("mob").toString(16).padStart(2, '0');
    val += s.amount("rld").toString(16).padStart(2, '0');
    val += s.amount("dam").toString(16).padStart(2, '0');
    val += s.amount("pen").toString(16).padStart(2, '0');
    val += s.amount("str").toString(16).padStart(2, '0');
    val += s.amount("spd").toString(16).padStart(2, '0');
    val += s.amount("hlt").toString(16).padStart(2, '0');
    val += s.amount("atk").toString(16).padStart(2, '0');
    return val;
}
// These are the methods
function update(gui) {
    let b = gui.master.body;
    // We can't run if we don't have a body to look at
    if (!b) return 0;
    gui.bodyid = b.id;
    // Update most things
    gui.fps.update(Math.min(1, (global.fps / Config.runSpeed / 1000) * 30));
    gui.color.update(gui.master.teamColor);
    gui.label.update(b.index);
    gui.score.update(b.skill.score);
    gui.points.update(b.skill.points);
    // Update the upgrades
    let upgrades = [];
    let skippedUpgrades = [0];
    for (let i = 0; i < b.upgrades.length; i++) {
        let upgrade = b.upgrades[i];
        if (b.skill.level >= b.upgrades[i].level) {
            upgrades.push(upgrade.branch.toString() + "\\\\//" + upgrade.branchLabel + "\\\\//" + upgrade.index);
        } else {
            if (upgrade.branch >= skippedUpgrades.length) {
                skippedUpgrades[upgrade.branch] = 1;
            } else {
                skippedUpgrades[skippedUpgrades.length - 1]++;
            }
        }
    }
    b.skippedUpgrades = skippedUpgrades;
    gui.upgrades.update(upgrades);
    // Update the stats and skills
    gui.stats.update();
    gui.skills.update(getstuff(b.skill));
    // Update physics
    gui.accel.update(b.acceleration);
    gui.topspeed.update(-b.team * room.partyHash);
    // Update other
    gui.root.update(b.rerootUpgradeTree);
    gui.class.update(b.label);
    gui.showhealthtext.update(Config.SHOW_HEALTHBAR_TEXT ? 1 : 0);
}

function publish(gui) {
    let o = {
        fps: gui.fps.publish(),
        label: gui.label.publish(),
        score: gui.score.publish(),
        points: gui.points.publish(),
        upgrades: gui.upgrades.publish(),
        color: gui.color.publish(),
        statsdata: gui.stats.publish(),
        skills: gui.skills.publish(),
        accel: gui.accel.publish(),
        top: gui.topspeed.publish(),
        root: gui.root.publish(),
        class: gui.class.publish(),
        showhealthtext: gui.showhealthtext.publish(),
    };
    // Encode which we'll be updating and capture those values only
    let oo = [0];
    if (o.fps != null) {
        oo[0] += 0x0001;
        oo.push(o.fps || 1);
    }
    if (o.label != null) {
        oo[0] += 0x0002;
        oo.push(o.label);
        oo.push(gui.master.teamColor);
        oo.push(gui.bodyid);
    }
    if (o.score != null) {
        oo[0] += 0x0004;
        oo.push(o.score);
    }
    if (o.points != null) {
        oo[0] += 0x0008;
        oo.push(o.points);
    }
    if (o.upgrades != null) {
        oo[0] += 0x0010;
        oo.push(o.upgrades.length, ...o.upgrades);
    }
    if (o.statsdata != null) {
        oo[0] += 0x0020;
        oo.push(...o.statsdata);
    }
    if (o.skills != null) {
        oo[0] += 0x0040;
        oo.push(o.skills);
    }
    if (o.accel != null) {
        oo[0] += 0x0080;
        oo.push(o.accel);
    }
    if (o.top != null) {
        oo[0] += 0x0100;
        oo.push(o.top);
    }
    if (o.root != null) {
        oo[0] += 0x0200;
        oo.push(o.root);
    }
    if (o.class != null) {
        oo[0] += 0x0400;
        oo.push(o.class);
    }
    if (o.showhealthtext != null) {
        oo[0] += 0x0800;
        oo.push(o.showhealthtext);
    }
    // Output it
    return oo;
}

// Define guis
let newgui = (player) => {
    // This is the protected gui data
    let gui = {
        master: player,
        fps: floppy(),
        label: floppy(),
        score: floppy(),
        points: floppy(),
        upgrades: floppy(),
        color: floppy(),
        skills: floppy(),
        topspeed: floppy(),
        accel: floppy(),
        stats: container(player),
        bodyid: -1,
        root: floppy(),
        class: floppy(),
        showhealthtext: floppy(),
    };
    // This is the gui itself
    return {
        update: () => update(gui),
        publish: () => publish(gui),
    };
};

// Make a function to spawn new players
const spawn = (socket, name) => {
    let player = {},
        loc = {};
    if (!socket.group && Config.GROUPS) {
        groups.addMember(socket, socket.party || -1);
    }
    player.team = socket.rememberedTeam;

    if (Config.MODE == "tdm" || Config.TAG) {
        let team = getWeakestTeam();
        // Choose from one of the least ones
        if (player.team == null || (player.team !== team && global.defeatedTeams.includes(player.team))
        ) {
            player.team = team;
        }
        if (socket.party && !Config.TAG) {
            let team = socket.party / room.partyHash;
            if (team > 0 && team < Config.TEAMS + 1 && team & 1 == team && !global.defeatedTeams.includes(team)) {
                player.team = team;
                console.log("Party Code with team:", team, "Party:", socket.party);
            }
        }
    }
    if (socket.group) {
        do {
            loc = room.near(socket.group.getSpawn(), 300);
        } while (dirtyCheck(loc, 50));
    }
    else {
        loc = getSpawnableArea(player.team);
    }

    let body, filter = disconnections.filter(r => r.ip === socket.ip && r.body && !r.body.isDead());
    if (filter.length) {
        let recover = filter[0];
        util.remove(disconnections, disconnections.indexOf(recover));
        clearTimeout(recover.timeout);
        body = recover.body;
        body.become(player);
        player.team = body.team;
    } else {
        body = new Entity(loc);
        body.protect();
        body.isPlayer = true; // Mark it as an player.
        if (player.team != null) {
            body.team = player.team;
        } else {
            player.team = body.team;
        }
        body.define(Config.SPAWN_CLASS);
        if (socket.permissions && socket.permissions.nameColor) {
            body.nameColor = socket.permissions.nameColor;
            socket.talk("z", body.nameColor);
        } else {
            body.nameColor = "#ffffff";
            socket.talk("z", body.nameColor);
        }
        body.become(player); // become it so it can speak and listen.
        socket.spectateEntity = null; // Dont break the camera.
        body.invuln = true; // Make it safe 

        // Default confinement
        for (let bounds in Config.SPAWN_CONFINEMENT) {
            body.confinement[bounds] = Config.SPAWN_CONFINEMENT[bounds];
        }
    }
    body.name = name; // Define the name.

    socket.rememberedTeam = player.team;
    player.body = body;
    body.socket = socket;
    if (body.color.base == '-1' || body.color.base == 'mirror') {
        body.color.base = getTeamColor(Config.GROUPS || (Config.MODE == 'ffa' && !Config.TAG)
            ? Config.RANDOM_COLORS ? ran.choose([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 ]) : TEAM_RED
            : player.body.team);
    }

    // Decide what to do about colors when sending updates and stuff
    player.teamColor = new Color(!Config.RANDOM_COLORS && (Config.GROUPS || (Config.MODE == 'ffa' && !Config.TAG)) ? 10 : getTeamColor(body.team)).compiled; // blue
    player.target = { x: 0, y: 0 };
    player.command = {
        movement: { x: 0, y: 0 },
        lmb: false,
        mmb: false,
        rmb: false,
        autofire: false,
        autospin: false,
        override: false,
        autoalt: false,
        spinlock: false
    };
    // Set up the recording commands
    let begin = performance.now();
    player.records = () => [
        player.body.skill.score,
        Math.floor((performance.now() - begin) / 1000),
        Config.RESPAWN_TIMEOUT,
        player.body.killCount.solo,
        player.body.killCount.assists,
        player.body.killCount.bosses,
        player.body.killCount.polygons,
        player.body.killCount.killers.length,
        ...player.body.killCount.killers
    ];
    player.gui = newgui(player);
    player.socket = socket;
    players.push(player);
    socket.camera.x = body.x;
    socket.camera.y = body.y;
    socket.camera.fov = 2000;
    socket.status.hasSpawned = true;

    let msg = Config.WELCOME_MESSAGE.split("\n");
    for (let i = 0; i < msg.length; i++) {
        body.sendMessage(msg[i]);
    }
    socket.talk("c", socket.camera.x, socket.camera.y, socket.camera.fov); // Move the camera
    return player;
};

// Define how to prepare data for submission
function flatten(data) {
    let output = [data.type]; // We will remove the first entry in the persepective method
    if (data.type & 0x01) {
        output.push(
            /*  1 */ data.facing,
            /*  2 */ data.layer,
            /*  3 */ data.index,
            /*  4 */ data.color,
            /*  5 */ data.strokeWidth,
            /*  6 */ data.borderless,
            /*  7 */ data.drawFill,
            /*  8 */ data.size,
            /*  9 */ data.realSize,
            /* 10 */ data.sizeFactor,
            /* 11 */ data.angle,
            /* 12 */ data.direction,
            /* 13 */ data.offset,
            /* 14 */ data.mirrorMasterAngle,
        );
    } else {
        output.push(
            /*  1 */ data.id,
            /*  2 */ data.index,
            /*  3 */ data.x,
            /*  4 */ data.y,
            /*  5 */ data.vx,
            /*  6 */ data.vy,
            /*  7 */ data.size,
            /*  8 */ data.facing,
            /*  9 */ Math.round(255 * data.perceptionAngleIndependence),
            /* 10 */ data.defaultAngle,
            /* 11 */ data.twiggle,
            /* 12 */ data.layer,
            /* 13 */ data.color,
            /* 14 */ data.borderless,
            /* 15 */ data.drawFill,
            /* 16 */ data.invuln,
            /* 17 */ Math.ceil(65535 * data.health),
            /* 18 */ data.healthN,
            /* 19 */ data.maxHealthN,
            /* 19 */ Math.round(65535 * data.shield),
            /* 20 */ Math.round(255 * data.alpha),
        );
        if (data.type & 0x04) {
            output.push(
                /* 21 */ data.name,
                /* 22 */ data.score
            );
        }
    }
    // Add the gun data to the array
    output.push(data.guns.length);
    for (let i = 0; i < data.guns.length; i++) {
        for (let k in data.guns[i])
            output.push(data.guns[i][k]);
    }
    // For each turret, add their own output
    output.push(data.turrets.length);
    for (let i = 0; i < data.turrets.length; i++) output.push(...flatten(data.turrets[i]));
    // Push all that to the array
    // Return it
    return output;
}

function perspective(e, player, data) {
    if (player.body != null) {
        if (player.body.id === e.master.id) {
            data = data.slice(); // So we don't mess up references to the original
            // And make it force to our mouse if it ought to
            if (player.command.autospin) {
                data[10] = 1;
            }
        }
        if (
            player.body.team === e.source.team &&
            (Config.GROUPS || (Config.MODE == 'ffa' && !Config.TAG)) &&
            player.body.color.base == 12
        ) {
            // GROUPS
            data = data.slice();
            data[13] = player.teamColor;
        }
    }
    return data;
}

function check(camera, obj) {
    let a =
        Math.abs(obj.x - camera.x) <
        camera.fov * 0.6 + 1.5 * obj.size + 100;
    let b =
        Math.abs(obj.y - camera.y) <
        camera.fov * 0.6 * 0.5625 + 1.5 * obj.size + 100;
    return a && b;
}

// Make a function that will make a function that will send out world updates
class View {
    constructor (socket) {
        this.lastVisibleUpdate = 0;
        this.nearby = [];
        this.socket = socket;
        views.push(this);
    }
    add (e) {
        if (check(this.socket.camera, e)) this.nearby.push(e);
    }
    remove (e) {
        let i = this.nearby.indexOf(e);
        if (i !== -1) util.remove(this.nearby, i);
    }
    check (e) {
        return check(this.socket.camera, e);
    }
    gazeUpon () {
        logs.network.startTracking();
        let player = this.socket.player,
            camera = this.socket.camera;
        // If nothing has changed since the last update, wait (approximately) until then to update
        let rightNow = room.lastCycle;
        // ...elseeeeee...
        // Update the record.
        camera.lastUpdate = rightNow;
        // Get the socket status
        this.socket.status.receiving++;
        // Now prepare the data to emit
        let setFov = camera.fov;
        // If we are alive, update the camera
        if (player.body != null) {
            // But I just died...
            if (player.body.isDead()) {
                this.socket.status.deceased = true;
                // Let the client know it died
                this.socket.talk("F", ...player.records());
                // Remove the body
                player.body = null;
            }
            // I live!
            else if (player.body.photo) {
                // Update camera position and motion
                camera.x = player.body.cameraOverrideX === null ? player.body.photo.x : player.body.cameraOverrideX;
                camera.y = player.body.cameraOverrideY === null ? player.body.photo.y : player.body.cameraOverrideY;
                camera.vx = player.body.photo.vx;
                camera.vy = player.body.photo.vy;
                camera.scoping = player.body.cameraOverrideX !== null;
                // Get what we should be able to see
                setFov = player.body.fov;
                // Get our body id
                player.viewId = player.body.id;
            }
        }
        if (player.body == null) {
            // u dead bro
            setFov = 2000;
            camera.scoping = false;
            if (this.socket.spectateEntity != null) {
                if (this.socket.spectateEntity) {
                    camera.x = this.socket.spectateEntity.x;
                    camera.y = this.socket.spectateEntity.y;
                }
            }
        }
        // Smoothly transition view size
        camera.fov = setFov;
        // Find what the user can see.
        // Update which entities are nearby
        if (camera.lastUpdate - this.lastVisibleUpdate > Config.visibleListInterval) {
            // Update our timer
            this.lastVisibleUpdate = camera.lastUpdate;
            // And update the nearby list
            this.nearby = []
            for (const entity of entities.values()) {
                if (check(this.socket.camera, entity)) {
                    this.nearby.push(entity);
                }
            }
        }
        // Look at our list of nearby entities and get their updates
        let visible = [];
        for (let i = 0; i < this.nearby.length; i++) {
            let e = this.nearby[i];
            if (e.photo &&
                Math.abs(e.x - camera.x) <  camera.fov / 2             + 1.5 * e.size &&
                Math.abs(e.y - camera.y) < (camera.fov / 2) * (9 / 16) + 1.5 * e.size
            ) {
                // Grab the photo
                if (!e.flattenedPhoto) {
                    e.flattenedPhoto = flatten(e.photo);
                }
                visible.push(perspective(e, player, e.flattenedPhoto));
            }
        }
        // Spread it for upload
        let view = [];
        for (let instance of visible) {
            view.push(...instance);
        }

        // Update the gui
        player.gui.update();
        // Send it to the player
        let finalData = [
            "u",
            rightNow,
            camera.x,
            camera.y,
            setFov,
            camera.vx,
            camera.vy,
            camera.scoping,
            ...player.gui.publish(),
            visible.length,
            ...view];
        this.socket.talk2(finalData);
        logs.network.endTracking();
    }
}

// Delta Calculator
const Delta = class {
    constructor(dataLength, finder) {
        this.dataLength = dataLength;
        this.finder = finder;
        this.data = [];
    }
    update(id = 0, ...args) {
        if (!this.data[id]) this.data[id] = this.finder([]);
        let old = this.data[id];
        let now = this.finder(args);
        this.data[id] = now;
        let oldIndex = 0;
        let nowIndex = 0;
        let updates = [];
        let updatesLength = 0;
        let deletes = [];
        let deletesLength = 0;
        while (oldIndex < old.length && nowIndex < now.length) {
            let oldElement = old[oldIndex];
            let nowElement = now[nowIndex];
            if (oldElement.id === nowElement.id) {
                // update
                nowIndex++;
                oldIndex++;
                let updated = false;
                for (let i = 0; i < this.dataLength; i++)
                    if (oldElement.data[i] !== nowElement.data[i]) {
                        updated = true;
                        break;
                    }
                if (updated) {
                    updates.push(nowElement.id, ...nowElement.data);
                    updatesLength++;
                }
            } else if (oldElement.id < nowElement.id) {
                // delete
                deletes.push(oldElement.id);
                deletesLength++;
                oldIndex++;
            } else {
                // create
                updates.push(nowElement.id, ...nowElement.data);
                updatesLength++;
                nowIndex++;
            }
        }
        for (let i = oldIndex; i < old.length; i++) {
            deletes.push(old[i].id);
            deletesLength++;
        }
        for (let i = nowIndex; i < now.length; i++) {
            updates.push(now[i].id, ...now[i].data);
            updatesLength++;
        }
        let reset = [0, now.length],
            update = [deletesLength, ...deletes, updatesLength, ...updates];
        for (let element of now) reset.push(element.id, ...element.data);
        return { update, reset };
    }
};

// Deltas
let minimapAll = new Delta(5, args => {
    let all = [];
    for (let my of entities.values()) {
        if (my.allowedOnMinimap && (
            my.alwaysShowOnMinimap ||
            (my.type === "wall" && my.alpha > 0.2) ||
            my.type === "miniboss" || my.type == "portal" || 
            my.isMothership
        )) {
            all.push({
                id: my.id,
                data: [
                    my.type === "wall" || my.isMothership ? my.shape === 4 ? 2 : 1 : 0,
                    util.clamp(Math.floor((256 * my.x) / room.width), 0, 255),
                    util.clamp(Math.floor((256 * my.y) / room.height), 0, 255),
                    my.color.compiled,
                    Math.round(my.SIZE),
                ],
            });
        }
    }
    return all;
});
let minimapTeams = new Delta(3, args => {
    let all = [];
    for (let my of entities.values())
        if (my.type === "tank" && my.team === args[0] && my.master === my && my.allowedOnMinimap) {
            all.push({
                id: my.id,
                data: [
                    util.clamp(Math.floor((256 * my.x) / room.width), 0, 255),
                    util.clamp(Math.floor((256 * my.y) / room.height), 0, 255),
                    Config.GROUPS || (Config.MODE == 'ffa' && !Config.TAG) ? '10 0 1 0 false' : my.color.compiled,
                ],
            });
        }
    return all;
});
let leaderboard = new Delta(7, args => {
    let list = [];
    if (Config.TAG)
        for (let id = 0; id < Config.TEAMS; id++) {
            let team = -id - 1;
            list.push({
                id,
                skill: { score: 0 },
                index: Class.tagMode.index.toString(),
                name: getTeamName(team),
                color: { compiled: `${getTeamColor(team)} 0 1 0 false` },
                label: "Players",
                team
            });
        }
    for (let instance of entities.values()) {
        if (Config.MOTHERSHIP_LOOP) {
            if (instance.isMothership) list.push(instance);
        } else if (Config.TAG) {
            let entry = list.find((r) => r.team === instance.team);
            if (entry && (instance.isPlayer || instance.isBot))
                entry.skill.score++;
        } else {
            if (
                instance.settings.leaderboardable &&
                instance.settings.drawShape &&
                (instance.type === "tank" ||
                    instance.killCount.solo ||
                    instance.killCount.assists)
            )
                list.push(instance);
        }
    }
    let topTen = [];
    for (let i = 0; i < 10 && list.length; i++) {
        let top,
            is = 0;
        for (let j = 0; j < list.length; j++) {
            let val = list[j].skill.score;
            if (val > is) {
                is = val;
                top = j;
            }
        }
        if (is === 0) break;
        let entry = list[top];
        let color = args.length && args[0] == entry.id
            ? '10 0 1 0 false'
            : entry.color.compiled;
        topTen.push({
            id: entry.id,
            data: [
                Config.MOTHERSHIP_LOOP ? Math.round(entry.health.amount) : Math.round(entry.skill.score),
                entry.index,
                entry.name,
                color,
                color,
                entry.nameColor || "#FFFFFF",
                entry.label,
            ],
        });
        list.splice(top, 1);
    }
    room.topPlayerID = topTen.length ? topTen[0].id : -1;
    return topTen.sort((a, b) => a.id - b.id);
});

// Periodically give out updates
let subscribers = [];
setInterval(() => {
    logs.minimap.startTracking();
    let minimapUpdate = minimapAll.update(),
        leaderboardUpdate,
        teamUpdate;
    for (let socket of subscribers) {
        if (!socket.status.hasSpawned) continue;
        leaderboardUpdate = leaderboard.update(
            socket.id,
            (Config.GROUPS || (Config.MODE == 'ffa' && !Config.TAG)) && socket.player.body ? socket.player.body.id : null
        );
        teamUpdate = minimapTeams.update(
            socket.id,
            socket.player.team
        );
        socket.talk(
            "b",
            ...socket.status.needsNewBroadcast ? minimapUpdate.reset : minimapUpdate.update,
            ...teamUpdate ? socket.status.needsNewBroadcast ? teamUpdate.reset : teamUpdate.update : [0, 0],
            ...socket.status.needsNewBroadcast ? leaderboardUpdate.reset : leaderboardUpdate.update
        );
        if (socket.status.needsNewBroadcast) {
            socket.status.needsNewBroadcast = false;
        }
    }
    logs.minimap.endTracking();
    let time = performance.now();
    for (let socket of clients) {
        if (socket.timeout.check(time)) socket.lastWords("K");
        if (time - socket.statuslastHeartbeat > Config.maxHeartbeatInterval) socket.kick("Lost heartbeat.");
    }
}, 250);

// Make a function that will send out minimap
// and leaderboard updates. We'll also start
// the mm/lb updating loop here. It runs at 1Hz
// and also kicks inactive sockets
const broadcast = {
    subscribe: socket => subscribers.push(socket),
    unsubscribe: socket => {
        let i = subscribers.indexOf(socket);
        if (i !== -1) util.remove(subscribers, i);
    },
};
let lastTime = 0;

// Get a unique id for each socket
let socketId = 0;
const sockets = {
    players: players,
    clients: clients,
    disconnections: disconnections,
    broadcast: (message) => {
        for (let i = 0; i < clients.length; i++) {
            clients[i].talk("m", Config.MESSAGE_DISPLAY_TIME, message);
        }
    },
    broadcastRoom: () => {
        for (let i = 0; i < clients.length; i++) {
            clients[i].talk("r", room.width, room.height, JSON.stringify(room.setup.map(x => x.map(t => t.color.compiled))));
        }
    },
    connect: (socket, req) => {
        // This function initalizes the socket upon connection
        if (Date.now() - lastTime < 250) return socket.terminate();
        lastTime = Date.now();

        // Get information about the new connection and verify it
        util.log("A client is trying to connect...");

        // Set it up
        socket.id = socketId++;
        socket.binaryType = "arraybuffer";
        socket.key = "";
        socket.player = { camera: {} };
        socket.spectateEntity = null;
        socket.onerror = () => {};
        let mem = 0;
        let timer = 0;
        socket.timeout = {
            check: (time) => timer && time - timer > Config.maxHeartbeatInterval,
            set: (val) => {
                if (mem !== val) {
                    mem = val;
                    timer = performance.now();
                }
            },
        };
        socket.awaiting = {};
        socket.awaitResponse = function (options, callback) {
            socket.awaiting[options.packet] = {
                callback: callback,
                timeout: setTimeout(() => {
                    console.log("Socket did not respond to the eval packet, kicking...");
                    socket.kick("Did not comply with the server's protocol.");
                }, options.timeout),
            };
        };
        socket.resolveResponse = function (id, packet) {
            if (socket.awaiting[id]) {
                clearTimeout(socket.awaiting[id].timeout);
                socket.awaiting[id].callback(packet);
                return true;
            }
            return false;
        };
        // Set up the status container
        socket.status = {
            verified: false,
            receiving: 0,
            deceased: true,
            requests: 0,
            hasSpawned: false,
            needsFullMap: true,
            needsNewBroadcast: true,
            lastHeartbeat: performance.now(),
        };
        // Set up loops
        let nextUpdateCall = null; // has to be started manually
        let trafficMonitoring = setInterval(() => traffic(socket), 1500);
        broadcast.subscribe(socket);
        socket.loops = {
            setUpdate: (timeout) => {
                nextUpdateCall = timeout;
            },
            cancelUpdate: () => {
                clearTimeout(nextUpdateCall);
            },
            terminate: () => {
                clearTimeout(nextUpdateCall);
                clearTimeout(trafficMonitoring);
                broadcast.unsubscribe(socket);
            },
        };
        // Set up the camera
        socket.camera = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            lastUpdate: performance.now(),
            lastDowndate: undefined,
            fov: 2000,
        };
        // Set up the viewer
        socket.makeView = () => {
            socket.view = new View(socket);
        };
        socket.makeView();
        // Put the fundamental functions in the socket
        socket.kick = (reason) => kick(socket, reason);
        socket.talk = (...message) => {
            if (socket.readyState === socket.OPEN) {
                socket.send(protocol.encode(message), { binary: true });
            }
        };
        socket.talk2 = (message) => {
            if (socket.readyState === socket.OPEN) {
                socket.send(protocol.encode(message), { binary: true });
            }
        };
        socket.lastWords = (...message) => {
            if (socket.readyState === socket.OPEN) {
                socket.send(protocol.encode(message), { binary: true }, () => setTimeout(() => socket.close(), 1000));
            }
        };
        // Put the player functions in the socket
        socket.spawn = (name) => spawn(socket, name);
        socket.on("message", message => incoming(message, socket));
        socket.on("close", () => {
            socket.loops.terminate();
            close(socket);
        });
        socket.on("error", (e) => {
            util.log("[ERROR]:");
            util.error(e);
        });

        //account for proxies
        //very simplified reimplementation of what the forwarded-for npm package does
        let store = req.headers['fastly-client-ip'] || req.headers["cf-connecting-ip"] || req.headers['x-forwarded-for'] || req.headers['z-forwarded-for'] ||
                    req.headers['forwarded'] || req.headers['x-real-ip'] || req.connection.remoteAddress,
            ips = store.split(',');

        if (!ips) {
            return socket.kick("Missing IP: " + store);
        }

        for (let i = 0; i < ips.length; i++) {
            if (net.isIPv6(ips[i])) {
                ips[i] = ips[i].trim();
            } else {
                ips[i] = ips[i].split(':')[0].trim();
            }
            if (!net.isIP(ips[i])) {
                return socket.kick("Invalid IP(s): " + store);
            }
        }

        socket.ip = ips[0];

        // Log it
        clients.push(socket);
        util.log("[INFO] New socket opened with ip " + socket.ip);
    }
};
module.exports = { sockets, chatLoop };

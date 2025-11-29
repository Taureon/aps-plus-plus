let loop;
function close() {
    sockets.broadcast("Closing!");
    util.log('Closing!');
    clearInterval(loop);
    setTimeout(process.exit, 1000);
}

function closeArena() {
    if (arenaClosed) return;
    sockets.broadcast("Arena closed: No players may join!");
    util.log('Arena Closing initiated');
    global.arenaClosed = true;
    for (const entity of entitites.values()) {
        if (entity.isBot) {
            entity.kill();
        }
    }
    for (let i = 0; i < 15; i++) {
        let angle = ((Math.PI * 2) / 15) * i;
        let o = new Entity({
            x: room.width / 2 + (room.width / 1.5) * Math.cos(angle),
            y: room.width / 2 + (room.width / 1.5) * Math.sin(angle),
        });
        o.define('arenaCloser');
        o.define({
            AI: {
                FULL_VIEW: true,
                SKYNET: true,
                BLIND: true,
                LIKES_SHAPES: true,
            },
            CONTROLLERS: ["nearestDifferentMaster", "mapTargetToGoal"],
            SKILL: Array(10).fill(9),
            ACCEPTS_SCORE: false,
            CAN_BE_ON_LEADERBOARD: false,
            VALUE: 100000,
            LEVEL: 45,
            CAN_GO_OUTSIDE_ROOM: true,
        });
        o.color.base = 3;
        o.team = TEAM_ROOM;
        o.name = "Arena Closer";
    }
    let ticks = 0;
    loop = setInterval(() => {
        ticks++;
        if (ticks >= 20) return close();
        let alive = false;
        for (const instance of entities.values()) {
            if (
                instance.isPlayer || instance.isMothership ||
                (instance.isDominator && instance.team !== TEAM_ROOM)
            ) {
                alive = true;
            }
        }
        if (!alive) close();
    }, 500);
}

module.exports = { closeArena };
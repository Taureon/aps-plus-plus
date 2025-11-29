global.defeatedTeams = [];
let motherships = [];
let teamWon = false;
let choices = ['mothership'];

function spawn() {
    let locs = [{
        x: Config.WIDTH * 0.1,
        y: Config.HEIGHT * 0.1
    }, {
        x: Config.WIDTH * 0.9,
        y: Config.HEIGHT * 0.9
    }, {
        x: Config.WIDTH * 0.9,
        y: Config.HEIGHT * 0.1
    }, {
        x: Config.WIDTH * 0.1,
        y: Config.HEIGHT * 0.9
    }, {
        x: Config.WIDTH * 0.9,
        y: Config.HEIGHT * 0.5
    }, {
        x: Config.WIDTH * 0.1,
        y: Config.HEIGHT * 0.5
    }, {
        x: Config.WIDTH * 0.5,
        y: Config.HEIGHT * 0.9
    }, {
        x: Config.WIDTH * 0.5,
        y: Config.HEIGHT * 0.1
    }].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Config.TEAMS; i++) {
        let o = new Entity(locs[i]),
            team = -i - 1;
        o.define(ran.choose(choices));
        o.define({ ACCEPTS_SCORE: false, VALUE: 643890 });
        o.color.base = getTeamColor(team);
        o.team = team;
        o.name = "Mothership";
        o.isMothership = true;
        o.controllers.push(new ioTypes.nearestDifferentMaster(o), new ioTypes.mapTargetToGoal(o));
        o.refreshBodyAttributes();
        motherships.push([o.id, team]);
    }
};

function death(entry) {
    sockets.broadcast(getTeamName(entry[1]) + "'s mothership has been killed!");
    global.defeatedTeams.push(-entry[1] - 1);
    for (const o of entities.values()) {
        if (o.team === -entry[1] - 1) {
            o.sendMessage("Your team has been eliminated.");
            o.kill();
        }
    }
    return false;
};

function winner(teamId) {
    sockets.broadcast(getTeamName(teamId) + " has won the game!");
    setTimeout(closeArena, 3000);
};

function loop() {
    if (teamWon) return;
    const aliveNow = motherships.map(([id, data]) => {
        const entity = entities.get(id);
        return [id, data, entity];
    });
    aliveNow = aliveNow.filter(entry => {
        if (!entry[2] || entry[2].isDead()) return death(entry);
        return true;
    });
    if (aliveNow.length === 1) {
        teamWon = true;
        setTimeout(winner, 2500, aliveNow[0][1]);
    }
    motherships = aliveNow;
};

module.exports = { mothershipLoop:  { spawn, loop, motherships } };
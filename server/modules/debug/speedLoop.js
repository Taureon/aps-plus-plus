let fails = 0;
const speedcheckloop = () => {
    let activationtime = logs.activation.sumLogTimes(),
        collidetime = logs.collide.sumLogTimes(),
        movetime = logs.entities.sumLogTimes(),
        playertime = logs.network.sumLogTimes(),
        maptime = logs.minimap.sumLogTimes(),
        physicstime = logs.physics.sumLogTimes(),
        lifetime = logs.life.sumLogTimes(),
        selfietime = logs.selfie.sumLogTimes();
    let sum = logs.master.averageLogTimes();
    let loops = logs.loops.getTallyCount(),
        active = logs.entities.getTallyCount();
    global.fps = (1000 / sum).toFixed(2);
    for (let e of entities.values()) {
        if (e.isPlayer && e.socket) { // give the debug info i guess.
            e.socket.talk("svInfo", Config.gameModeName, (sum).toFixed(1));
        }
    }
    if (sum > 1000 / Config.runSpeed / 40) {
        //fails++;
        if (Config.LOGS) {
            util.warn('~~ LAST SERVER TICK TOOK TOO LONG TO CALCULATE ~~');
            util.warn('~~ LOOPS: ' + loops + '. ENTITIES: ' + entities.size + '//' + Math.round(active / loops) + '. VIEWS: ' + views.length + '. BACKLOGGED :: ' + (sum * Config.runSpeed * 3).toFixed(3) + '%! ~~');
            util.warn('Total activation time: ' + activationtime);
            util.warn('Total collision time: ' + collidetime);
            util.warn('Total cycle time: ' + movetime);
            util.warn('Total player update time: ' + playertime);
            util.warn('Total lb+minimap processing time: ' + maptime);
            util.warn('Total entity physics calculation time: ' + physicstime);
            util.warn('Total entity life+thought cycle time: ' + lifetime);
            util.warn('Total entity selfie-taking time: ' + selfietime);
            util.warn('Total time: ' + (activationtime + collidetime + movetime + playertime + maptime + physicstime + lifetime + selfietime));
        }
        if (fails > 60) {
            util.error("FAILURE!");
            //process.exit(1);
        }
    } else {
        fails = 0;
    }
};

module.exports = {
    speedcheckloop
};
class ManHunt {
    constructor () {
        this.leaderIDs = [null];
    }

    //calculate leader by going through each player/bot and getting the one with the highest score
    getLeader() {
        let highestScore = -Infinity,
            leader = { id: null };
        for (let entity of entities.values()) {
            if (!entity.isPlayer && !entity.isBot) continue;
            if (entity.skill.score <= highestScore) continue;
            highestScore = entity.skill.score;
            leader = entity;
        }
        return leader;
    }

    loop() {

        // get new leader
        let leader = this.getLeader();
        if (this.leaderIDs.includes(leader.id)) return;
        this.leaderIDs.push(leader.id);

        // apply buffs to them
        leader.color.base = getTeamColor(TEAM_GREEN);
        leader.skill.points += 18;
        leader.alwaysShowOnMinimap = true;

        // if this guy died then remove them from the leader ids
        // prevents a memory leak
        leader.on('dead', () => {
            let i = this.leaderIDs.indexOf(leader.id);
            if (i !== -1) {
                this.leaderIDs.splice(i, 1);
            }
        });

        // NOTE: This implementation does not care about someone new becoming leader in a way that doesn't kill the previous one.
    }
}

module.exports = { ManHunt };
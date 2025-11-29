class Moon {
    constructor () {
        let o = new Entity(room.center);
        o.define('moon');
        o.team = TEAM_ROOM;
        o.SIZE = room.width / 10;
        o.protect();
        o.life();
        this.moon = o;
    }
    loop () {
        for (const entity of entities.values()) {
            if ((entity.isPlayer || entity.isBot) || (entity.id != this.moon.id && !entity.isArenaCloser && entity.alpha)) {
                entity.velocity.x += util.clamp(this.moon.x - entity.x, -90, 90) * entity.damp * 0.02;
                entity.velocity.y += util.clamp(this.moon.y - entity.y, -90, 90) * entity.damp * 0.02;
            }
        }
    }
}

module.exports = { Moon };
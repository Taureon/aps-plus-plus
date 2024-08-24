let pickFromChanceSet = set => {
    while (Array.isArray(set)) {
        set = set[ran.chooseChance(...set.map(e => e[0]))][1];
    }
    return set;
},

spawnNatural = (tile, layeredSet, kind) => {
    let o = new Entity(tile.randomInside());
    o.define(pickFromChanceSet(layeredSet));
    o.facing = ran.randomAngle();
    o.team = TEAM_ENEMIES;
    o.on('dead', () => tile.data[kind + 'Count']--);
    tile.data[kind + 'Count']++;
    return o;
},

normal = new Tile({
    color: "white",
    data: {
        allowMazeWallSpawn: true,
        foodSpawnCooldown: 0, foodCount: 0
    },
    init: tile => room.spawnableDefault.push(tile),
    tick: tile => {
        if (++tile.data.foodSpawnCooldown > Config.FOOD_SPAWN_COOLDOWN) {
            tile.data.foodSpawnCooldown = 0;
            if (tile.data.foodCount < Config.FOOD_CAP && Math.random() < Config.FOOD_SPAWN_CHANCE) {
                spawnNatural(tile, Config.FOOD_TYPES, 'food');
            }
        }
    }
}),
    
normalNoFood = new Tile({
    color: "white",
    data: {
        allowMazeWallSpawn: true,
    },
    init: tile => room.spawnableDefault.push(tile),
}),

dancefloor = new Tile({
    color: "rainbow",
    data: {
        allowMazeWallSpawn: false,
    },
    init: tile => room.spawnableDefault.push(tile),
}),
    
dancefloor1 = new Tile({
    color: 20,
    data: {
        allowMazeWallSpawn: false,
    },
    init: tile => room.spawnableDefault.push(tile),
}),
dancefloor2 = new Tile({
    color: 21,
    data: {
        allowMazeWallSpawn: false,
    },
    init: tile => room.spawnableDefault.push(tile),
}),
dancefloor3 = new Tile({
    color: 22,
    data: {
        allowMazeWallSpawn: false,
    },
    init: tile => room.spawnableDefault.push(tile),
}),
dancefloor4 = new Tile({
    color: 23,
    data: {
        allowMazeWallSpawn: false,
    },
    init: tile => room.spawnableDefault.push(tile),
}),
dancefloor5 = new Tile({
    color: 24,
    data: {
        allowMazeWallSpawn: false,
    },
    init: tile => room.spawnableDefault.push(tile),
}),
blacktile = new Tile({
    color: 19,
    data: {
        allowMazeWallSpawn: false,
    },
    init: tile => room.spawnableDefault.push(tile),
}),

nestTick = tile => {
    if (++tile.data.enemySpawnCooldown > Config.ENEMY_SPAWN_COOLDOWN_NEST) {
        tile.data.enemySpawnCooldown = 0;
        if (tile.data.enemyCount < Config.ENEMY_CAP_NEST && Math.random() < Config.ENEMY_SPAWN_CHANCE_NEST) {
            spawnNatural(tile, Config.ENEMY_TYPES_NEST, 'enemy');
        }
    }

    if (++tile.data.foodSpawnCooldown > Config.FOOD_SPAWN_COOLDOWN_NEST) {
        tile.data.foodSpawnCooldown = 0;
        if (tile.data.foodCount < Config.FOOD_CAP_NEST && Math.random() < Config.FOOD_SPAWN_CHANCE_NEST) {
            spawnNatural(tile, Config.FOOD_TYPES_NEST, 'food');
        }
    }
},

nestColor = {BASE: "purple", BRIGHTNESS_SHIFT: 10, SATURATION_SHIFT: 0.8},
nest = new Tile({
    color: nestColor,
    data: {
        allowMazeWallSpawn: true,
        foodSpawnCooldown: 0, foodCount: 0,
        enemySpawnCooldown: 0, enemyCount: 0
    },
    init: tile => {
        if (!room.spawnable[TEAM_ENEMIES]) room.spawnable[TEAM_ENEMIES] = [];
        room.spawnable[TEAM_ENEMIES].push(tile);
    },
    tick: nestTick
}),

nestNoBoss = new Tile({
    color: nestColor,
    data: {
        allowMazeWallSpawn: true,
        foodSpawnCooldown: 0, foodCount: 0,
        enemySpawnCooldown: 0, enemyCount: 0
    },
    tick: nestTick
}),
    
nestNoFood = new Tile({
    color: nestColor,
    data: {
        allowMazeWallSpawn: true,
    },
}),

wall = new Tile({
    color: "white",
    init: tile => {
	    let o = new Entity(tile.loc);
	    o.define("wall");
	    o.team = TEAM_ROOM;
	    o.SIZE = room.tileWidth / 1.82;
	    o.protect();
	    o.life();
      makeHitbox(o);
      walls.push(o);
    }
}),

dfxwall = new Tile({
    color: "lightGray",
    init: tile => {
	    let o = new Entity(tile.loc);
	    o.define("dfxwall");
      o.team = TEAM_ROOM;
	    o.SIZE = room.tileWidth / 1.82;
	    o.protect();
	    o.life();
      makeHitbox(o);
      walls.push(o);
    }
}),

fovwall = new Tile({
    color: "yellow",
    init: tile => {
	    let o = new Entity(tile.loc);
	    o.define("fovwall");
      o.team = TEAM_ROOM;
	    o.SIZE = room.tileWidth / 1.82;
	    o.protect();
	    o.life();
      makeHitbox(o);
      walls.push(o);
    }
}),

hookpoint = new Tile({
    color: "cyan",
    init: tile => {
	    let o = new Entity(tile.loc);
	    o.define("hookpoint");
      o.team = TEAM_ROOM;
	    o.SIZE = 35;
	    o.protect();
	    o.life();
    }
});

module.exports = { normal, normalNoFood, nest, nestNoFood, wall, nestNoBoss, blacktile, dancefloor, dancefloor1, dancefloor2, dancefloor3, dancefloor4, dancefloor5, dfxwall, hookpoint, fovwall };
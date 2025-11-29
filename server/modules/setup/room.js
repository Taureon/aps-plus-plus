let importedRoom = [];

for (let filename of Config.ROOM_SETUP) {
    let currentRoom = require(`./rooms/${filename}.js`);
    Config.roomHeight = currentRoom.length;
    Config.roomWidth = currentRoom[0].length;
    for (let y = 0; y < Config.roomHeight; y++) {
        for (let x = 0; x < Config.roomWidth; x++) {
            if (importedRoom[y] == null) {
                importedRoom[y] = currentRoom[y];
            } else if (currentRoom[y][x]) {
                importedRoom[y][x] = currentRoom[y][x];
            }
        }
    }
}

global.room = {
    lastCycle: undefined,
    cycleSpeed: 1000 / 40,
    regenerateTick: Config.REGENERATE_TICK,
    setup: importedRoom,
    xgrid: importedRoom[0].length,
    ygrid: importedRoom.length,
    topPlayerID: -1,
    partyHash: Number(((Math.random() * 1000000 | 0) + 1000000).toString().replace("0.", "")),
    spawnableDefault: [],
    center: {},
    spawnable: {},
    blackHoles: [],
    sendColorsToClient: false
};

Object.defineProperties(room, {
    tileWidth: { get: () => Config.TILE_WIDTH, set: v => Config.TILE_WIDTH = v },
    tileHeight: { get: () => Config.TILE_HEIGHT, set: v => Config.TILE_HEIGHT = v },
    width: { get: () => room.xgrid * Config.TILE_WIDTH, set: v => Config.TILE_WIDTH = v / room.xgrid },
    height: { get: () => room.ygrid * Config.TILE_HEIGHT, set: v => Config.TILE_HEIGHT = v / room.ygrid }
});

Object.defineProperties(room.center, {
    x: { get: () => room.xgrid * Config.TILE_WIDTH / 2, set: v => Config.TILE_WIDTH = v * 2 / room.xgrid },
    y: { get: () => room.ygrid * Config.TILE_HEIGHT / 2, set: v => Config.TILE_HEIGHT = v * 2 / room.ygrid }
});

room.isInRoom = location => {
    if (Config.ARENA_TYPE === "circle") {
        return (location.x - room.center.x) ** 2 + (location.y - room.center.y) ** 2 < room.center.x ** 2;
    }
    return location.x >= 0 && location.x <= room.width && location.y >= 0 && location.y <= room.height;
};
room.near = function(position, radius) {
    let point = ran.pointInUnitCircle();
    return {
        x: Math.round(position.x + radius * point.x),
        y: Math.round(position.y + radius * point.y)
    };
};
room.random = function() {
    return Config.ARENA_TYPE === "circle" ? room.near(room.center, room.center.x) : {
        x: ran.irandom(room.width),
        y: ran.irandom(room.height)
    };
};
room.getAt = location => {
    if (!room.isInRoom(location)) return null;
    let a = Math.floor(location.y / room.tileWidth);
    let b = Math.floor(location.x / room.tileHeight);
    return room.setup[a][b];
};

class TileEntity {
    constructor (tile, loc) {
        if (!(tile instanceof Tile)) {
            throw new Error(`The cell at ${loc.x},${loc.y} in the room setup is not a Tile object!` +
                ('string' == typeof tile ? ' But it is a string, which means you probably need to update your room setup!' : ' But it is of type ' + typeof tile)
            );
        }
        let gridLoc = this.gridLoc = { x: parseFloat(loc.x), y: parseFloat(loc.y) };
        // this.blueprint = tile.args;
        this.loc = {
            get x() { return room.tileWidth * (gridLoc.x + 0.5); },
            get y() { return room.tileHeight * (gridLoc.y + 0.5); }
        };
        this.color = new Color(tile.color ?? 8);
        this.init = tile.init;
        this.tick = tile.tick;
        this.entities = [];
        this.data = JSON.parse(JSON.stringify(tile.data));
    }

    randomInside() {
        return {
            x: room.tileWidth * (this.gridLoc.x + Math.random()),
            y: room.tileHeight * (this.gridLoc.y + Math.random())
        }
    }
}

for (let y in room.setup) {
    for (let x in room.setup[y]) {
        let tile = room.setup[y][x] = new TileEntity(room.setup[y][x], { x, y });
        tile.init(tile);
    }
}
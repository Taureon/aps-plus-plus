// Labyrinth generation
let validPositions;
let generateLabyrinth = (size) => {
    const padding = 1;

    let maze = JSON.parse(JSON.stringify(Array(size).fill(Array(size).fill(true))));
    validPositions = JSON.parse(JSON.stringify(Array(size + padding * 2).fill(Array(size + padding * 2).fill(true))))
    let bfsqx = [1];
    let bfsqy = [1];
    let intermediateQX = [1];
    let intermediateQY = [1];
    const offsets = [0, 1, 0, -1, 0];
    let mazeWallScale = room.height / (size + 2 * padding);
    
    while (bfsqx.length) {
        // Delete walls where the search travels
        let currentX = bfsqx.shift();
        let currentY = bfsqy.shift();
        let intermediateX = intermediateQX.shift();
        let intermediateY = intermediateQY.shift();
        if (!maze[currentY][currentX]) continue;
        maze[currentY][currentX] = false;
        if (intermediateX && intermediateY) maze[intermediateX][intermediateY] = false;

        let options = [];
        for (let i = 0; i < 4; i++) {
            // Move between grid cells
            let newX = currentX + offsets[i] * 2;
            let newY = currentY + offsets[i+1] * 2;

            // Punch holes in the walls to reach the outer edge
            if (newX < 0 || newX >= size || newY < 0 || newY >= size) {
                if (ran.random(1) < 0.25) {
                    maze[currentY + offsets[i+1]][currentX + offsets[i]] = false;
                }
                continue;
            }
            if (!maze[newY][newX]) continue;
            options.push([newX, newY]);
        }

        if (!options.length) continue;

        // Pick where to go
        shuffledOptions = [];
        while (options.length) {
            let index = Math.floor(ran.random(options.length));
            shuffledOptions.push([...options[index]]);
            options.splice(index, 1);
        }

        // Save all options on where to go so we can come back to them later
        bfsqx.unshift(...shuffledOptions.map((x) => x[0]));
        bfsqy.unshift(...shuffledOptions.map((x) => x[1]));
        intermediateQX.unshift(...shuffledOptions.map((x) => (x[0] + currentX) / 2));
        intermediateQY.unshift(...shuffledOptions.map((x) => (x[1] + currentY) / 2));
    }

    // Make the maze more interconnected by randomly removing walls
    for (let x = 1; x < size; x += 2) {
        for (let y = 1; y < size; y += 2) {
            for (let i = 0; i < 4; i++) {
                let nextX = x + offsets[i];
                let nextY = y + offsets[i + 1];
                if (ran.random(1) < 0.9) continue;
                maze[nextY][nextX] = false;
            }
        }
    }

    // Punch holes in the maze
    const holeCenters = [
        [5, 5],
        [5, 25],
        [25, 5],
        [25, 25],
        [15, 15],
    ];
    const holeRadius = 2;
    for (let [centerX, centerY] of holeCenters) {
        for (let x = centerX - holeRadius; x <= centerX + holeRadius; x++) {
            for (let y = centerY - holeRadius; y <= centerY + holeRadius; y++) {
                maze[y][x] = false;
            }
        }
    }

    // Open permanant corridors
    const corridors = [7, 23];
    for (let y of corridors) {
        for (let x = corridors[0]; x <= corridors[1]; x++) {
            maze[y][x] = false;
            maze[x][y] = false;
        }
    }

    // Spawn the maze
    for (let x = padding; x < size + padding; x++) {
        for (let y = padding; y < size + padding; y++) {
            // Find spawn location and size
            if (!maze[y - 1][x - 1]) continue;

            let d = {
                x: x * mazeWallScale + mazeWallScale / 2,
                y: y * mazeWallScale + mazeWallScale / 2,
            };
            
            if (room.getAt(d).data.allowMazeWallSpawn === null) continue;
            
            let o = new Entity({
                x: d.x,
                y: d.y
            });
            o.define("wall");
            o.SIZE = mazeWallScale * 0.5 / lazyRealSizes[4] * Math.SQRT2 - 2;
            o.team = TEAM_ENEMIES;
            o.protect();
            o.life();
            makeHitbox(o);
            walls.push(o);
            validPositions[y][x] = false;
        }
    }

    // Convert valid positions
    let truePositions = [];
    for (let y = 0; y < size + 2 * padding; y++) {
        for (let x = 0; x < size + 2 * padding; x++) {
            if (!validPositions[y][x]) continue;
            let trueX = x * mazeWallScale + mazeWallScale / 2;
            let trueY = y * mazeWallScale + mazeWallScale / 2;
            truePositions.push([trueX, trueY]);
        }
    }
    validPositions = truePositions;

    // Big food
    // Class.sphere.SIZE = 17;
    // Class.cube.SIZE = 22;
    // Class.tetrahedron.SIZE = 27;
    // Class.octahedron.SIZE = 28;
    // Class.dodecahedron.SIZE = 30;
    // Class.icosahedron.SIZE = 32;
    // Class.tesseract.SIZE = 39;
    delete Class.food.LEVEL_CAP;
}

// Portal loop
class PortalLoop {
    constructor() {
        this.initialized = false;
        this.spawnBuffer = 50;
        this.openBounds = {
            xMin: 19500,
            xMax: 25500,
            yMin: 1500,
            yMax: 7500,
        };
        this.labyrinthBounds = {
            xMin: 50,
            xMax: 8950,
            yMin: 50,
            yMax: 8950,
        };
        this.forgeBounds = {
            xMin: 11500,
            xMax: 15500,
            yMin: 2500,
            yMax: 6500,
        };
        this.locationArrayVariance = 80;
        this.readyToSpawn = true;
        this.spawnBatches = [
            {
                bounds: this.labyrinthBounds,
                types: [
                    {
                        type: "spikyPortalOfficialV1",
                        destination: this.openBounds,
                        buffer: 1500,
                        spawnArray: validPositions,
                        handler: (entity) => {
                            // Spawn in default spawnable area if on a tank team
                            if (entity.team == TEAM_DREADNOUGHTS) return;
                            let {x, y} = getSpawnableArea(entity.team);
                            entity.x = x;
                            entity.y = y;
                        }
                    },
                    {
                        type: "bluePortalOfficialV1",
                        destination: this.forgeBounds,
                        buffer: 0,
                        spawnArray: validPositions,
                        handler: (entity) => {
                            if (entity.team == TEAM_DREADNOUGHTS) return;

                            entity.reset(); // Remove non-player controllers
                            entity.skill.set(Array(10).fill(0)); // Purge skill upgrades
                            entity.define({ // Purge all unwanted entity config
                                STAT_NAMES: {},
                                IS_SMASHER: false,
                                ALPHA: [0, 1],
                                INVISIBLE: [0, 0],
                            });
                            entity.upgrades = [];
                            entity.define('dreadOfficialV1');
                            entity.team = TEAM_DREADNOUGHTS;

                            // Fix minimap
                            if (entity.socket) {
                                entity.socket.player.team = entity.team;
                            }
                        },
                        entryBarrier: (entity) => {
                            return entity.skill.level >= 150;
                        }
                    }
                ]
            },
            {
                bounds: this.openBounds,
                types: [
                    {
                        type: "spikyPortalOfficialV1",
                        destination: this.labyrinthBounds,
                        buffer: 50,
                        destinationArray: validPositions,
                    }
                ]
            },
            {
                bounds: this.forgeBounds,
                types: [
                    {
                        type: "spikyPortalOfficialV1",
                        destination: this.labyrinthBounds,
                        buffer: 50,
                        destinationArray: validPositions,
                    },
                    {
                        type: "greenPortalOfficialV1",
                        destination: this.openBounds,
                        buffer: 1500,
                    }
                ]
            },
        ]
    }
    spawnCycle() {
        this.readyToSpawn = true;
        for (let batch of this.spawnBatches) {
            for (let portal of batch.types) {
                let spawnX, spawnY;
                if (portal.spawnArray) {
                    let [x, y] = ran.choose(portal.spawnArray);
                    spawnX = x + ran.irandomRange(-this.locationArrayVariance, this.locationArrayVariance);
                    spawnY = y + ran.irandomRange(-this.locationArrayVariance, this.locationArrayVariance);
                } else {
                    spawnX = ran.irandomRange(batch.bounds.xMin, batch.bounds.xMax);
                    spawnY = ran.irandomRange(batch.bounds.yMin, batch.bounds.yMax);
                }
                let entity = new Entity({x: spawnX, y: spawnY});
                entity.define(portal.type);
                entity.on('collide', ({instance, other}) => {
                    // Swap order if the portal is the 'other' in the pair
                    if (other.type == 'portal') other = instance;

                    // Validity checking
                    if (other.type != 'tank') {
                        if (
                            other.type != "miniboss" && other.type != "food" && other.type != "crasher" && other.type != "aura" && other.type != "wall" && other.type != "unknown" &&
                            (other.x - entity.x) ** 2 + (other.y - entity.y) ** 2 <= (other.size + entity.size) ** 2
                        ) {
                            other.kill();
                        }
                        return;
                    }
                    if (other.invuln) return;
                    if ((other.x - entity.x) ** 2 + (other.y - entity.y) ** 2 > (other.size ** 2)) return;
                    if (portal.entryBarrier && !portal.entryBarrier(other)) return;

                    // Spawn in target region
                    if (portal.destinationArray) {
                        let [x, y] = ran.choose(portal.destinationArray);
                        other.x = x + ran.irandomRange(-this.locationArrayVariance, this.locationArrayVariance);
                        other.y = y + ran.irandomRange(-this.locationArrayVariance, this.locationArrayVariance);
                    } else {
                        other.x = ran.irandomRange(portal.destination.xMin, portal.destination.xMax);
                        other.y = ran.irandomRange(portal.destination.yMin, portal.destination.yMax);
                    }
                    other.invuln = true;
                    other.destroyAllChildren();
                    
                    // Set new confinement
                    other.confinement.xMin = portal.destination.xMin - portal.buffer;
                    other.confinement.xMax = portal.destination.xMax + portal.buffer;
                    other.confinement.yMin = portal.destination.yMin - portal.buffer;
                    other.confinement.yMax = portal.destination.yMax + portal.buffer;

                    // Special portal properties
                    if (portal.handler) {
                        portal.handler(other);
                    }
                });
                entity.on('death', ({body}) => {
                    if (arenaClosed || !this.readyToSpawn) return;

                    // Spawn after 20 seconds if a portal dies
                    this.readyToSpawn = false;
                    setTimeout(() => {
                        this.spawnCycle();
                    }, 20_000);
                });
            }
        }
    }
    init() {
        this.spawnCycle();
    }
}

if (Config.GAME_MODES.includes('old_dreadnoughts')) {
    global.generateMaze = generateLabyrinth;
}
module.exports = { generateLabyrinth, PortalLoop };
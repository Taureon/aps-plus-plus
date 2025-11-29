// Define mocking up functions
function getMockup(e, positionInfo) {
    let turretsAndProps = e.turrets.concat(e.props);
    return {
        index: e.index,
        name: e.label,
        upgradeName: e.upgradeLabel,
        upgradeTooltip: e.upgradeTooltip,
        x: util.rounder(e.x),
        y: util.rounder(e.y),
        color: e.color.compiled,
        strokeWidth: e.strokeWidth,
        upgradeColor: e.upgradeColor,
        glow: e.glow,
        borderless: e.borderless,
        drawFill: e.drawFill,
        shape: e.shapeData,
        imageInterpolation: e.imageInterpolation,
        size: util.rounder(e.size),
        realSize: util.rounder(e.realSize),
        facing: util.rounder(e.facing),
        mirrorMasterAngle: e.settings.mirrorMasterAngle,
        layer: e.layer,
        statnames: e.settings.skillNames,
        position: positionInfo,
        rerootUpgradeTree: e.rerootUpgradeTree,
        className: e.className,
        upgrades: e.upgrades.map(r => ({
            tier: r.tier,
            index: r.index
        })),
        guns: e.guns.map(function(gun) {
            return {
                offset: util.rounder(gun.offset),
                direction: util.rounder(gun.offsetDirection),
                length: util.rounder(gun.length),
                width: util.rounder(gun.width),
                aspect: util.rounder(gun.aspect),
                angle: util.rounder(gun.angle),
                color: gun.color.compiled,
                strokeWidth: gun.strokeWidth,
                alpha: gun.alpha,
                borderless: gun.borderless,
                drawFill: gun.drawFill,
                drawAbove: gun.drawAbove,
            };
        }),
        turrets: turretsAndProps.map(function(t) {
            let out = getMockup(t, {});
            out.sizeFactor = util.rounder(t.bound.size);
            out.offset = util.rounder(t.bound.offset);
            out.direction = util.rounder(t.bound.direction);
            out.layer = util.rounder(t.bound.layer);
            out.angle = util.rounder(t.bound.angle);
            return out;
        }),
    };
}

let endPoints;
function getFurthestFrom(x, y) {
    let furthestDistance = 0,
        furthestPoint = [x, y],
        furthestIndex = 0;
    for (let i = 0; i < endPoints.length; i++) {
        let point = endPoints[i];
        let distance = (point[0] - x) ** 2 + (point[1] - y) ** 2;
        if (distance > furthestDistance) {
            furthestDistance = distance;
            furthestPoint = point;
            furthestIndex = i;
        }
    }
    endPoints.splice(furthestIndex, 1);
    return [util.rounder(furthestPoint[0]), util.rounder(furthestPoint[1])];
}

function checkIfSamePoint(p1, p2) {
    return p1[0] == p2[0] && p1[1] == p2[1];
}

function checkIfOnLine(endpoint1, endpoint2, checkPoint) {
    let xDiff = endpoint2[0] - endpoint1[0],
        yDiff = endpoint2[1] - endpoint1[1];
    
    // Endpoints on the same vertical line
    if (xDiff == 0) {
        return (checkPoint[0] == endpoint1[0]);
    }

    let slope = yDiff / xDiff,
        xLengthToCheck = checkPoint[0] - endpoint1[0],
        predictedY = endpoint1[1] + xLengthToCheck * slope;
    // Check point is on the line with a small margin
    return Math.abs(checkPoint[1] - predictedY) <= 1e-5;
}

function getDimensions(entity) {
    // Begin processing from the main body
    endPoints = [];
    sizeEntity(entity);

    // Convert to useful info
    endPoints.sort((a, b) => (b[0] ** 2 + b[1] ** 2 - a[0] ** 2 - a[1] ** 2));
    let point1 = getFurthestFrom(0, 0),
        point2 = getFurthestFrom(...point1);
    
    // Repeat selecting the second point until at least one of the first two points is off the centerline
    while ((point1[0] == 0 && point2[0] == 0 || point1[1] == 0 && point2[1] == 0) && entity.shape != 4) {
        point2 = getFurthestFrom(...point1);
    }

    let avgX = (point1[0] + point2[0]) / 2,
        avgY = (point1[1] + point2[1]) / 2,
        point3 = getFurthestFrom(avgX, avgY);
    
    // Repeat selecting the third point until it's actually different from the other points and it's not collinear with them
    while (checkIfSamePoint(point3, point1) || checkIfSamePoint(point3, point2) || checkIfOnLine(point1, point2, point3)) {
        point3 = getFurthestFrom(avgX, avgY);
    }
    
    let {x, y, r} = constructCircumcirle(point1, point2, point3);

    return {
        axis: r * 2,
        middle: {x, y},
    };
}

// Find circumcircle and circumcenter
function constructCircumcirle(point1, point2, point3) {
    // util.rounder to avoid floating point nonsense
    let x1 = util.rounder(point1[0]);
    let y1 = util.rounder(point1[1]);
    let x2 = util.rounder(point2[0]);
    let y2 = util.rounder(point2[1]);
    let x3 = util.rounder(point3[0]);
    let y3 = util.rounder(point3[1]);

    // Invalid math protection
    if (x3 == x1 || x3 == x2) {
        x3 += 1e-5;
    }
    
    let numer1 = x3 ** 2 + y3 ** 2 - x1 ** 2 - y1 ** 2;
    let numer2 = x2 ** 2 + y2 ** 2 - x1 ** 2 - y1 ** 2;
    let factorX1 = 2 * x2 - 2 * x1;
    let factorX2 = 2 * x3 - 2 * x1;
    let factorY1 = 2 * y1 - 2 * y2;
    let factorY2 = 2 * y1 - 2 * y3;
    let y = (numer1 * factorX1 - numer2 * factorX2) / (factorY1 * factorX2 - factorY2 * factorX1);
    let x = ((y - y3) ** 2 - (y - y1) ** 2 - x1 ** 2 + x3 ** 2) / factorX2;
    let r = Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));

    return {x, y, r};
}

const sidesMax = 16;
function sizeEntity(entity, x = 0, y = 0, angle = 0, scale = 1) {    
    // Process body as a polygon with [sidesMax] sides if it has at least that many or less than three sides
    if (entity.shape < 3 || entity.shape >= sidesMax) {
        for (let i = 0; i < sidesMax; i++) {
            let theta = Math.PI * 2 / sidesMax * i;
            endPoints.push([x + Math.cos(theta) * scale, y + Math.sin(theta) * scale]);
        }
    } else {
        // Process body as true size and shape otherwise
        let angleOffset = (entity.shape % 1) * 2 * Math.PI;
        let numSides = Math.floor(entity.shape);
        for (let i = 0; i < numSides; i++) {
            let theta = 2 * Math.PI / numSides * i + angleOffset;
            endPoints.push([x + Math.cos(theta) * scale * lazyRealSizes[numSides], y + Math.sin(theta) * scale * lazyRealSizes[numSides]]);
        }
    }
    
    // Process guns
    for (let g of entity.guns) {
        // Construct a trapezoid at angle 0
        let widths = g.aspect > 0 ? [g.width * g.aspect / 2, g.width / 2] : [g.width / 2, -g.width * g.aspect / 2],
            points = [],
            sinT = Math.sin(g.angle + angle),
            cosT = Math.cos(g.angle + angle);
        points.push([0, widths[1]]);
        points.push([g.length, widths[0]]);
        points.push([g.length, -widths[0]]);
        points.push([0, -widths[1]]);
    
        for (let point of points) {
            // Rotate it to the new angle via vector rotation
            let newX = point[0] * cosT - point[1] * sinT,
                newY = point[0] * sinT + point[1] * cosT;
            // Translate it to the right position
            newX += g.offset * Math.cos(g.offsetDirection + g.angle + angle);
            newY += g.offset * Math.sin(g.offsetDirection + g.angle + angle);
            // Save coords
            endPoints.push([x + newX * scale, y + newY * scale]);
        }
    }

    // Process turrets and props
    let turretsAndProps = entity.turrets.concat(entity.props);
    for (let t of turretsAndProps) {
        let trueAngle = angle + t.bound.angle,
            xShift = t.bound.offset * Math.cos(t.bound.direction + trueAngle),
            yShift = t.bound.offset * Math.sin(t.bound.direction + trueAngle);
        sizeEntity(t, x + xShift * scale, y + yShift * scale, trueAngle, t.bound.size * scale);
    }
}

console.log("Started loading mockups...");
let mockupsLoadStartTime = performance.now();

let mockupData = [];
for (let k in Class) {
    try {
        if (!Class.hasOwnProperty(k)) continue;
        let type = Class[k];
        // Create a reference entities which we'll then take an image of.
        let temptank = new Entity({ x: 0, y: 0 });
        temptank.define(type);
        temptank.className = k;
        temptank.name = type.LABEL; // Rename it (for the upgrades menu).
        // Fetch the mockup.
        type.mockup = {
            body: temptank.camera(true),
            position: getDimensions(temptank),
        };
        // This is to pass the size information about the mockup that we didn't have until we created the mockup
        type.mockup.body.position = type.mockup.position;
        // Add the new data to the thing.
        mockupData.push(getMockup(temptank, type.mockup.position));
        // Kill the reference entities.
        temptank.destroy();
    } catch (error) {
        util.error('[WARNING] An error has occured during mockup loading:');
        util.error('When attempting to generate mockup "' + k + '":');
        for (let i in Class[k]) util.error("\t" + i + ": " + Class[k][i]);
        throw error;
    }
}

let mockupsLoadEndTime = performance.now();
console.log("Finished compiling " + mockupData.length + " classes into mockups.");
console.log("Mockups generated in " + util.rounder(mockupsLoadEndTime - mockupsLoadStartTime, 3) + " milliseconds.\n");
console.log("Server loaded in " + util.rounder(mockupsLoadEndTime, 4) + " milliseconds.\n");
mockupsLoaded = true;

let mockupJsonData = JSON.stringify(mockupData);

module.exports = {
    mockupJsonData
};
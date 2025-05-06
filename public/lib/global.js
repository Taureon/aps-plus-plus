function Clickable() {
    let region = {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
    };
    let active = false;
    return {
        set: (x, y, w, h) => {
            region.x = x * global.ratio;
            region.y = y * global.ratio;
            region.w = w * global.ratio;
            region.h = h * global.ratio;
            active = true;
        },
        check: target => {
            let dx = Math.round(target.x - region.x);
            let dy = Math.round(target.y - region.y);
            return active && dx >= 0 && dy >= 0 && dx <= region.w && dy <= region.h;
        },
        hide: () => {
            active = false;
        },
    };
}
let Region = (size) => {
    // Define the region
    let data = [];
    for (let i = 0; i < size; i++) {
        data.push(Clickable());
    }
    // Return the region methods
    return {
        place: (index, ...a) => {
            if (index >= data.length) {
                console.log(index);
                console.log(data);
                throw new Error('Trying to reference a clickable outside a region!');
            }
            data[index].set(...a);
        },
        hide: () => {
            for (let region of data) region.hide();
        },
        check: x => data.findIndex(r => r.check(x))
    };
};

const global = {
    // Keys and other mathematical constants
    KEY_ESC: 27,
    KEY_ENTER: 13,
    KEY_SHIFT: 16,
    KEY_BECOME: 70,
    KEY_CHAT: 13,
    KEY_FIREFOOD: 119,
    KEY_SPLIT: 32,

    KEY_LEFT: 65,
    KEY_UP: 87,
    KEY_RIGHT: 68,
    KEY_DOWN: 83,
    KEY_LEFT_ARROW: 37,
    KEY_UP_ARROW: 38,
    KEY_RIGHT_ARROW: 39,
    KEY_DOWN_ARROW: 40,

    KEY_AUTO_SPIN: 67,
    KEY_AUTO_FIRE: 69,
    KEY_AUTO_ALT: 71,
    KEY_OVER_RIDE: 82,
    KEY_REVERSE_TANK: 86,
    KEY_REVERSE_MOUSE: 66,
    KEY_SPIN_LOCK: 88,

    KEY_LEVEL_UP: 78,
    KEY_FUCK_YOU: 192,
    KEY_DEBUG: 76,
    KEY_CLASS_TREE: 84,
    KEY_MAX_STAT: 77,
    KEY_SUICIDE: 79,
    KEY_ZOOM_OUT: 45,
    KEY_ZOOM_IN: 61,
    KEY_TELEPORT: 80,
    KEY_SMALLER_TANK: 188,
    KEY_BIGGER_TANK: 190,
    KEY_SMALLER_FOV: 187,
    KEY_BIGGER_FOV: 189,
    KEY_GOD_MODE: 186,
    KEY_INVISIBLE: 222,
    KEY_CAN_BE_ON_LEADERBOARD: 113,
    KEY_STRONG: 191,
    KEY_HEAL: 220,
    KEY_WATCH_THIS: 219,
    KEY_DRAG: 221,
    KEY_SPAWN_WALL: 17,
    KEY_RANDOM_TEST: 81,
    KEY_CHANGE_SONG: 112,
    KEY_ABILITY: 17,
    KEY_SCREENSHOT: 81,//Q
    KEY_RECORD: 90,//Z

    KEY_UPGRADE_ATK: 49,
    KEY_UPGRADE_HTL: 50,
    KEY_UPGRADE_SPD: 51,
    KEY_UPGRADE_STR: 52,
    KEY_UPGRADE_PEN: 53,
    KEY_UPGRADE_DAM: 54,
    KEY_UPGRADE_RLD: 55,
    KEY_UPGRADE_MOB: 56,
    KEY_UPGRADE_RGN: 57,
    KEY_UPGRADE_SHI: 48,
    KEY_MOUSE_0: 32,
    KEY_MOUSE_1: 86,
    KEY_MOUSE_2: 16,
    KEY_CHOOSE_1: 89,
    KEY_CHOOSE_2: 85,
    KEY_CHOOSE_3: 73,
    KEY_CHOOSE_4: 72,
    KEY_CHOOSE_5: 74,
    KEY_CHOOSE_6: 75,
    KEY_WIKI: 118,
  
    showTree: false,

    scrollX: 0,
    realScrollX: 0,
    // Canvas
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    gameWidth: 0,
    gameHeight: 0,
    xoffset: -0,
    yoffset: -0,
    movement: false,
    motion: { x: 0, y: 0 },
    gameLoading: false,
    gameStart: false,
    disconnected: false,
    autoSpin: false,
    syncingWithTank: false,
    respawnTimeout: false,
    showDebug: false,
    died: false,
    kicked: false,
    continuity: false,
    wiki: false,
    startPingTime: 0,
    toggleMassState: 0,
    backgroundColor: '#f2fbff',
    lineColor: '#000000',
    nameColor: "#FFFFFF",
    message: "",
    player: {},
    messages: [],
    mockups: [],
    roomSetup: [],
    entities: [],
    updateTimes: 0,
    clickables: {
        stat: Region(10),
        upgrade: Region(100),
        hover: Region(1),
        skipUpgrades: Region(1),
        mobileButtons: Region(20),
    },
    statHover: false,
    upgradeHover: false,
    statMaxing: false,
    metrics: {
        latency: 0,
        lag: 0,
        rendertime: 0,
        updatetime: 0,
        lastlag: 0,
        lastrender: 0,
        rendergap: 0,
        lastuplink: 0,
        killcount: 0,
        shapecount: 0,
    },
    mobileStatus: {
        enableCrosshair: false,
        showCrosshair: false,
        useBigJoysticks: false,
        showJoysticks: false,
    },
    GUIStatus: {
        renderGUI: false,
        renderLeaderboard: false,
        renderhealth: false,
        renderPlayerNames: false,
        renderPlayerScores: false,
        minimapReducedInfo: false,
    },
    emojiloaded: false,
    wikidisplaytank: 25,
    wikiclassname: "basic",
    ISTHEGODAMNFUCKINGGAMEON: "no",
    killsoundready: true,
    skin: "",
    skinpage: 0,
    savedkillcount: 0,
    savedshapecount: 0,
    lockedornot: 0,
    mouse: { x: 0, y: 0},
    target: { x: 0, y: 0 },
    reverseTank: 1,
    fps: 60,
    screenSize: Math.min(1920, Math.max(window.innerWidth, 1280)),
    ratio: window.devicePixelRatio,
    mockupLoading: { then: cb => cb() },
    treeScale: 1,
    chats: {},
    music2: {
      src: "",
      songname: "",
    },
    corruptprogression: 0,
    stopthefuckingkillsoundyouprick: false,
    blackhole: false
};
export { global }

/* jshint esversion: 11 */

import { util } from "./lib/util.js";
import { global } from "./lib/global.js";
import { settings } from "./lib/settings.js";
import { Canvas } from "./lib/canvas.js";
import { color } from "./lib/color.js";
import { gameDraw } from "./lib/gameDraw.js";
import * as socketStuff from "./lib/socketInit.js";
(async function (util, global, settings, Canvas, color, gameDraw, socketStuff) {

let { socketInit, gui, leaderboard, minimap, moveCompensation, lag, getNow } = socketStuff;
// fetch("changelog.md", { cache: "no-cache" })
// .then((response) => response.text())
// .then((response) => {
//     const changelogs = response.split("\n\n").map((changelog) => changelog.split("\n"));
//     for (let changelog of changelogs) {
//         changelog[0] = changelog[0].split(":").map((line) => line.trim());
//         document.getElementById("patchNotes").innerHTML += `<div><b>${changelog[0][0].slice(1).trim()}</b>: ${changelog[0].slice(1).join(":") || "Update lol"}<ul>${changelog.slice(1).map((line) => `<li>${line.slice(1).trim()}</li>`).join("")}</ul><hr></div>`;
//     }
// });

fetch("changelog.html", { cache: "no-cache" })
    .then(async ChangelogsHTMLFile => {
        let patchNotes = document.querySelector("#patchNotes");
        try {
            let parser = new DOMParser(),
                RawHTMLString = await ChangelogsHTMLFile.text(),
                ParsedHTML = parser.parseFromString(RawHTMLString, "text/html"),
                titles = ParsedHTML.documentElement.getElementsByTagName('h1');
            for (const title of titles) {
                title.classList.add('title');
            }

            patchNotes.innerHTML += ParsedHTML.documentElement.innerHTML;
        } catch (error) {
            patchNotes.innerHTML = `<p>An error occured while trying to fetch 'changelogs.html'</p><p>${error}</p>`;
            console.error(error);
        }
    });

class Animation {
    constructor(start, to, smoothness = 0.05) {
        this.start = start;
        this.to = to;
        this.value = start;
        this.smoothness = smoothness;
    }
    reset() {
        this.value = this.start;
        return this.value;
    }
    getLerp() {
        this.value = util.lerp(this.value, this.to, this.smoothness, true);
        return this.value;
    }
    getNoLerp() {
        this.value = this.to;
        return this.value;
    }
    get() {
        return settings.graphical.fancyAnimations ? this.getLerp() : this.getNoLerp();
    }
    flip() {
        const start = this.to;
        const to = this.start;
        this.start = start;
        this.to = to;
    }
    goodEnough(val = 0.5) {
        return Math.abs(this.to - this.value) < val;
    }
}
let controls = document.getElementById("controlSettings"),
    resetButton = document.getElementById("resetControls"),
    moreControls = document.getElementById("moreControls"),
    moreControlsLength = null,
    selectedElement = null,
    controlsArray = [],
    defaultKeybinds = {},
    keybinds = {},
    animations = window.animations = {
        connecting: new Animation(1, 0),
        disconnected: new Animation(1, 0),
        deathScreen: new Animation(1, 0),
        error: new Animation(1, 0),
    };

// Mockup functions
// Prepare stuff
global.player = {
    //Set up the player
    id: -1,
    x: global.screenWidth / 2,
    y: global.screenHeight / 2,
    vx: 0,
    vy: 0,
    cx: 0,
    cy: 0,
    renderx: global.screenWidth / 2,
    rendery: global.screenHeight / 2,
    isScoping: false,
    screenx: 0,
    screeny: 0,
    renderv: 1,
    slip: 0,
    view: 1,
    time: 0,
    screenWidth: global.screenWidth,
    screenHeight: global.screenHeight,
    nameColor: "#ffffff",
};
var upgradeSpin = 0,
    lastPing = 0,
    renderTimes = 0;
global.clearUpgrades = () => gui.upgrades = [];
// Build the leaderboard object
global.player = global.player;
global.canUpgrade = false;
global.canSkill = false;
global.message = "";
global.time = 0;
global.enableSlideAnimation = false;
global.mspt = "?";
global.serverName = "Unknown";
// Tips setup :D
let tips = global.tips[Math.floor(Math.random() * global.tips.length)];
global.tips = tips[Math.floor(Math.random() * tips.length)];
// Window setup <3
global.mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
global.mobile && document.body.classList.add("mobile");
function getMockups() {
    global.mockupLoading = new Promise(Resolve => {
        util.pullJSON("mockups").then(data => {
            global.mockups = data;
            console.log('Mockups loading complete.');
            Resolve();
        });
    });
}
function getKeybinds() {
    let kb = localStorage.getItem("keybinds");
    keybinds = typeof kb === "string" && kb.startsWith("{") ? JSON.parse(kb) : {};
}
function setKeybinds() {
    localStorage.setItem("keybinds", JSON.stringify(keybinds));
}
function unselectElement() {
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
    selectedElement.element.parentNode.parentNode.classList.remove("editing");
    selectedElement = null;
}
function selectElement(element) {
    selectedElement = element;
    selectedElement.element.parentNode.parentNode.classList.add("editing");
    if (selectedElement.keyCode !== -1 && window.getSelection) {
        let selection = window.getSelection();
        selection.removeAllRanges();
        let range = document.createRange();
        range.selectNodeContents(selectedElement.element);
        selection.addRange(range);
    }
}
function setKeybind(key, keyCode) {
    selectedElement.element.parentNode.parentNode.classList.remove("editing");
    resetButton.classList.add("active");
    if (keyCode !== selectedElement.keyCode) {
        let otherElement = controlsArray.find(c => c.keyCode === keyCode);
        if (keyCode !== -1 && otherElement) {
            otherElement.keyName = selectedElement.keyName;
            otherElement.element.innerText = selectedElement.keyName;
            otherElement.keyCode = selectedElement.keyCode;
            global[otherElement.keyId] = selectedElement.keyCode;
            keybinds[otherElement.keyId] = [selectedElement.keyName, selectedElement.keyCode];
        }
    }
    selectedElement.keyName = key;
    selectedElement.element.innerText = key;
    selectedElement.keyCode = keyCode;
    global[selectedElement.keyId] = keyCode;
    keybinds[selectedElement.keyId] = [key, keyCode];
    setKeybinds();
}
function getElements(kb, storeInDefault) {
    for (let row of controls.rows) {
        for (let cell of row.cells) {
            let element = cell.firstChild.firstChild;
            if (!element) continue;
            let key = element.dataset.key;
            if (storeInDefault) defaultKeybinds[key] = [element.innerText, global[key]];
            if (kb[key]) {
                element.innerText = kb[key][0];
                global[key] = kb[key][1];
                resetButton.classList.add("active");
            }
            let obj = {
                element,
                keyId: key,
                keyName: element.innerText,
                keyCode: global[key]
            };
            controlsArray.push(obj);
        }
    }
}
window.onload = async () => {
    window.serverAdd = (await (await fetch("/serverData.json")).json()).ip;
    if (Array.isArray(window.serverAdd)) {
        window.isMultiserver = true;
        const servers = window.serverAdd;
        let serverSelector = document.getElementById("serverSelector"),
            tbody = document.createElement("tbody");
        serverSelector.style.display = "block";
        document.getElementById("startMenuSlidingContent").removeChild(document.getElementById("serverName"));
        serverSelector.classList.add("serverSelector");
        serverSelector.classList.add("shadowscroll");
        serverSelector.appendChild(tbody);
        let myServer = {
            classList: {
                contains: () => false,
            },
        };
        for (let server of servers) {
            try {
                const tr = document.createElement("tr");
                const td = document.createElement("td");
                td.textContent = `${server.gameMode} | ${server.players} Players`;
                td.onclick = () => {
                    if (myServer.classList.contains("selected")) {
                        myServer.classList.remove("selected");
                    }
                    tr.classList.add("selected");
                    myServer = tr;
                    window.serverAdd = server.ip;
                    getMockups();
                };
                tr.appendChild(td);
                tbody.appendChild(tr);
                myServer = tr;
            } catch (e) {
                console.log(e);
            }
        }
        if (Array.from(myServer.children)[0].onclick) {
            Array.from(myServer.children)[0].onclick();
        }
    } else {
        getMockups();
        util.pullJSON("gamemodeData").then((json) => {
            document.getElementById("serverName").innerHTML = `<h4 class="nopadding">${json.gameMode} | ${json.players} Players</h4>`;
        });
    }
    // Save forms
    util.retrieveFromLocalStorage("playerNameInput");
    util.retrieveFromLocalStorage("playerKeyInput");
    util.retrieveFromLocalStorage("optScreenshotMode");
    util.retrieveFromLocalStorage("optPredictive");
    util.retrieveFromLocalStorage("optFancy");
    util.retrieveFromLocalStorage("optLowResolution");
    util.retrieveFromLocalStorage("coloredHealthbars");
    util.retrieveFromLocalStorage("centerTank");
    util.retrieveFromLocalStorage("optColors");
    util.retrieveFromLocalStorage("optCustom");
    util.retrieveFromLocalStorage("optNoPointy");
    util.retrieveFromLocalStorage("optBorders");
    util.retrieveFromLocalStorage("optNoGrid");
    util.retrieveFromLocalStorage("seperatedHealthbars");
    util.retrieveFromLocalStorage("autoLevelUp");
    util.retrieveFromLocalStorage("optMobile");
    // GUI
    util.retrieveFromLocalStorage("optRenderGui");
    util.retrieveFromLocalStorage("optRenderLeaderboard");
    util.retrieveFromLocalStorage("optRenderNames");
    util.retrieveFromLocalStorage("optRenderHealth");
    util.retrieveFromLocalStorage("optRenderScores");
    util.retrieveFromLocalStorage("optReducedInfo");
    util.retrieveFromLocalStorage("showCrosshair");
    util.retrieveFromLocalStorage("showJoystick");
    // Set default theme
    if (document.getElementById("optColors").value === "") {
        document.getElementById("optColors").value = "normal";
        // Also do auto check for GUI stuff.
        document.getElementById("optRenderGui").checked = true;
        document.getElementById("optRenderLeaderboard").checked = true;
        document.getElementById("optRenderNames").checked = true;
        document.getElementById("optRenderHealth").checked = true;
        document.getElementById("optRenderScores").checked = true;
        document.getElementById("optFancy").checked = true;
        if (global.mobile) document.getElementById("showCrosshair").checked = true, document.getElementById("showJoystick").checked = true;
    }
    if (document.getElementById("optBorders").value === "") {
        document.getElementById("optBorders").value = "normal";
    }
    // Mobile Selection stuff
    if (document.getElementById("optMobile").value === "") {
        document.getElementById("optMobile").value = "mobile";
    }
    // Keybinds stuff
    getKeybinds();
    getElements(keybinds, true);
    document.addEventListener("click", event => {
        if (!global.gameStart) {
            if (selectedElement) {
                unselectElement();
            } else {
                let element = controlsArray.find(({ element }) => element === event.target);
                if (element) selectElement(element);
            }
        }
    });
    resetButton.addEventListener("click", () => {
        keybinds = {};
        setKeybinds();
        controlsArray = [];
        getElements(defaultKeybinds);
        resetButton.classList.add("spin");
        setTimeout(() => {
            resetButton.classList.remove("active"); 
            resetButton.classList.remove("spin");
        }, 400);
    });
    moreControls.addEventListener("click", () => {
      if (moreControlsLength) {
        for (var b = 0; b < moreControlsLength.length; b++) moreControlsLength[b].classList.add("hidden");
        moreControlsLength = null;
        moreControls.classList.remove("x");
      } else {
        moreControlsLength = document.querySelectorAll("#controlSettings tr.hidden");
        for (b = 0; b < moreControlsLength.length; b++) moreControlsLength[b].classList.remove("hidden");
        moreControls.classList.add("x");
      }
    });
    // Game start stuff
    document.getElementById("startButton").onclick = () => startGame();
    document.onkeydown = (e) => {
        if (!(global.gameStart || e.shiftKey || e.ctrlKey || e.altKey)) {
            let key = e.which || e.keyCode;
            if (selectedElement) {
                if (1 !== e.key.length || /[0-9]/.test(e.key) || 3 === e.location) {
                    if (!("Backspace" !== e.key && "Delete" !== e.key)) {
                        setKeybind("", -1);
                    }
                } else {
                    setKeybind(e.key.toUpperCase(), e.keyCode);
                }
            } else if (key === global.KEY_ENTER) {
                startGame();
            }
        }
    };
    window.addEventListener("resize", resizeEvent);
    resizeEvent();
};
// Sliding between options menu.
function toggleOptionsMenu() {
    let clicked = false,
        a = document.getElementById("startMenuSlidingTrigger"), // Trigger ID
        c = document.getElementById("optionArrow"), // Arrow
        h = document.getElementById("viewOptionText"), // Text (view options)
        u = document.getElementsByClassName("sliderHolder")[0], // Sliding.
        y = document.getElementsByClassName("slider"), // For animations things.
        toggle = () => {
            c.style.transform = c.style.webkitTransform = clicked // Rotate the arrow.
            ? "translate(2px, -2px) rotate(45deg)"
            : "rotate(-45deg)";
            h.innerText = clicked ? "close options" : "view options"; // Change the text.
            clicked ? u.classList.add("slided") : u.classList.remove("slided"); // Slide it up.
            y[0].style.opacity = clicked ? 0 : 1; // Fade it away.
            y[2].style.opacity = clicked ? 1 : 0; // same for this.
        };
    a.onclick = () => { // When the button is triggered, This code runs.
        clicked = !clicked;
        toggle();
    };
    return () => {
        clicked || ((clicked = !0), toggle());
    };
};
// Tab options
function tabOptionsMenuSwitcher() {
    let buttonTabs = document.getElementById("optionMenuTabs"),
    tabOptions = [
      document.getElementById("tabAppearance"),
      document.getElementById("tabOptions"),
      document.getElementById("tabControls"),
      document.getElementById("tabAbout"),
    ];
    for (let g = 1; g < tabOptions.length; g++) tabOptions[g].style.display = "none";
    let e = 0;
    for (let g = 0; g < buttonTabs.children.length; g++)
        buttonTabs.children[g].addEventListener("click", () => {
            e !== g &&
            (buttonTabs.children[e].classList.remove("active"), // Remove the active class
            buttonTabs.children[g].classList.add("active"), // Add the clicked active class
            (tabOptions[e].style.display = "none"), // Dont display the old menu.
            (tabOptions[g].style.display = "block"), // Display the menu.
            (e = g))
      });
}
function resizeEvent() {
    let scale = window.devicePixelRatio;
    if (settings.graphical.lowResolution) {
        scale *= 0.5;
    }
    global.screenWidth = window.innerWidth * scale;
    global.screenHeight = window.innerHeight * scale;
    c.resize(global.screenWidth, global.screenHeight);
    global.ratio = scale;
    global.screenSize = Math.min(1920, Math.max(window.innerWidth, 1280));
}
window.resizeEvent = resizeEvent;
window.canvas = new Canvas();
var c = window.canvas.cv;
var ctx = c.getContext("2d");
var c2 = document.createElement("canvas");
var ctx2 = c2.getContext("2d");
ctx2.imageSmoothingEnabled = true;
// important functions
tabOptionsMenuSwitcher();
toggleOptionsMenu();
// Animation things
function Smoothbar(value, speed, sharpness = 3, lerpValue = 0.025) {
    let time = Date.now();
    let display = value;
    let oldvalue = value;
    return {
        set: (val) => {
            if (value !== val) {
                oldvalue = display;
                value = val;
                time = Date.now();
            }
        },
        get: (round = false) => {
            display = util.lerp(display, value, lerpValue);
            if (Math.abs(value - display) < 0.1 && round) display = value;
            return display;
        },
        force: (val) => {
            display = value = val;
        },
    };
}
global.player = {
    vx: 0,
    vy: 0,
    lastvx: 0,
    lastvy: 0,
    renderx: global.player.cx,
    rendery: global.player.cy,
    lastx: global.player.x,
    lasty: global.player.y,
    cx: 0,
    cy: 0,
    screenx: 0,
    screeny: 0,
    target: !global.mobile ? calculateTarget() : window.canvas.target,
    name: "",
    lastUpdate: 0,
    time: 0,
    nameColor: "#ffffff",
};
function calculateTarget() {
    global.target.x = global.mouse.x - (global.player.screenx / global.screenWidth * window.canvas.width + window.canvas.width / 2);
    global.target.y = global.mouse.y - (global.player.screeny / global.screenHeight * window.canvas.height + window.canvas.height / 2);
    if (window.canvas.reverseDirection) global.reverseTank = -1;
    else global.reverseTank = 1;
    global.target.x *= global.screenWidth / window.canvas.width;
    global.target.y *= global.screenHeight / window.canvas.height;
    if (settings.graphical.screenshotMode && Math.abs(Math.atan2(global.target.y, global.target.x) + Math.PI / 2) < 0.035) global.target.x = 0;
    return global.target;
};
function parseTheme(string) {
    // Decode from base64
    try {
        let stripped = string.replace(/\s+/g, '');
        if (stripped.length % 4 == 2)
            stripped += '==';
        else if (stripped.length % 4 == 3)
            stripped += '=';
        let data = atob(stripped);

        let name = 'Unknown Theme',
            author = '';
        let index = data.indexOf('\x00');
        if (index === -1) return null;
        name = data.slice(0, index) || name;
        data = data.slice(index + 1);
        index = data.indexOf('\x00');
        if (index === -1) return null;
        author = data.slice(0, index) || author;
        data = data.slice(index + 1);
        let border = data.charCodeAt(0) / 0xff;
        data = data.slice(1);
        let paletteSize = Math.floor(data.length / 3);
        if (paletteSize < 2) return null;
        let colorArray = [];
        for (let i = 0; i < paletteSize; i++) {
            let red = data.charCodeAt(i * 3)
            let green = data.charCodeAt(i * 3 + 1)
            let blue = data.charCodeAt(i * 3 + 2)
            let color = (red << 16) | (green << 8) | blue
            colorArray.push('#' + color.toString(16).padStart(6, '0'))
        }
        let content = {
            teal: colorArray[0],
            lgreen: colorArray[1],
            orange: colorArray[2],
            yellow: colorArray[3],
            aqua: colorArray[4],
            pink: colorArray[5],
            vlgrey: colorArray[6],
            lgrey: colorArray[7],
            guiwhite: colorArray[8],
            black: colorArray[9],

            blue: colorArray[10],
            green: colorArray[11],
            red: colorArray[12],
            gold: colorArray[13],
            purple: colorArray[14],
            magenta: colorArray[15],
            grey: colorArray[16],
            dgrey: colorArray[17],
            white: colorArray[18],
            guiblack: colorArray[19],

            paletteSize,
            border,
        }
        return { name, author, content };
    } catch (e) { }

    // Decode from JSON
    try {
        let output = JSON.parse(string);
        if (typeof output !== 'object')
            return null;
        let { name = 'Unknown Theme', author = '', content } = output;

        for (let colorHex of [
            content.teal,
            content.lgreen,
            content.orange,
            content.yellow,
            content.aqua,
            content.pink,
            content.vlgrey,
            content.lgrey,
            content.guiwhite,
            content.black,

            content.blue,
            content.green,
            content.red,
            content.gold,
            content.purple,
            content.magenta,
            content.grey,
            content.dgrey,
            content.white,
            content.guiblack,
        ]) {
            if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) return null;
        }

        return {
            name: (typeof name === 'string' && name) || 'Unknown Theme',
            author: (typeof author === 'string' && author) || '',
            content,
        }
    } catch (e) { }

    return null;
}
// This starts the game and sets up the websocket
function startGame() {
    // Set flag
    global.gameLoading = true;
    console.log('Started connecting.');
    if (global.mobile) {
        var d = document.body;
        d.requestFullscreen ? d.requestFullscreen()
            : d.msRequestFullscreen ? d.msRequestFullscreen()
                : d.mozRequestFullScreen ? d.mozRequestFullScreen()
                    : d.webkitRequestFullscreen && d.webkitRequestFullscreen();
    }
    // Get options
    util.submitToLocalStorage("optFancy");
    util.submitToLocalStorage("optLowResolution");
    util.submitToLocalStorage("centerTank");
    util.submitToLocalStorage("optBorders");
    util.submitToLocalStorage("optNoPointy");
    util.submitToLocalStorage("autoLevelUp");
    util.submitToLocalStorage("optMobile");
    util.submitToLocalStorage("optPredictive");
    util.submitToLocalStorage("optScreenshotMode");
    util.submitToLocalStorage("coloredHealthbars");
    util.submitToLocalStorage("seperatedHealthbars");
    util.submitToLocalStorage("optNoGrid");
    // GUI
    util.submitToLocalStorage("optRenderGui");
    util.submitToLocalStorage("optRenderLeaderboard");
    util.submitToLocalStorage("optRenderNames");
    util.submitToLocalStorage("optRenderHealth");
    util.submitToLocalStorage("optRenderScores");
    util.submitToLocalStorage("optReducedInfo");
    util.submitToLocalStorage("showCrosshair");
    util.submitToLocalStorage("showJoystick");
    settings.graphical.fancyAnimations = document.getElementById("optFancy").checked;
    settings.graphical.centerTank = document.getElementById("centerTank").checked;
    settings.graphical.pointy = !document.getElementById("optNoPointy").checked;
    settings.game.autoLevelUp = document.getElementById("autoLevelUp").checked;
    settings.lag.unresponsive = document.getElementById("optPredictive").checked;
    settings.graphical.screenshotMode = document.getElementById("optScreenshotMode").checked;
    settings.graphical.coloredHealthbars = document.getElementById("coloredHealthbars").checked;
    settings.graphical.seperatedHealthbars = document.getElementById("seperatedHealthbars").checked;
    settings.graphical.lowResolution = document.getElementById("optLowResolution").checked;
    settings.graphical.showGrid = !document.getElementById("optNoGrid").checked;
    // GUI
    global.GUIStatus.renderGUI = document.getElementById("optRenderGui").checked;
    global.GUIStatus.renderLeaderboard = document.getElementById("optRenderLeaderboard").checked;
    global.GUIStatus.renderPlayerNames = document.getElementById("optRenderNames").checked;
    global.GUIStatus.renderPlayerScores = document.getElementById("optRenderScores").checked;
    global.GUIStatus.renderhealth = document.getElementById("optRenderHealth").checked;
    global.GUIStatus.minimapReducedInfo = document.getElementById("optReducedInfo").checked;
    global.mobileStatus.enableCrosshair = document.getElementById("showCrosshair").checked;
    global.mobileStatus.showJoysticks = document.getElementById("showJoystick").checked;
    switch (document.getElementById("optBorders").value) {
        case "normal":
            settings.graphical.darkBorders = settings.graphical.neon = false;
            break;
        case "dark":
            settings.graphical.darkBorders = true;
            settings.graphical.neon = false;
            break;
        case "glass":
            settings.graphical.darkBorders = false;
            settings.graphical.neon = true;
            break;
        case "neon":
            settings.graphical.darkBorders = settings.graphical.neon = true;
            break;
    }
    switch (document.getElementById("optMobile").value) {
        case "desktop":
            global.mobile = false;
            break;
        case "mobileWithBigJoysticks":
            global.mobileStatus.useBigJoysticks = true;
            break;
    }
    util.submitToLocalStorage("optColors");
    let a = document.getElementById("optColors").value;
    color = color[a === "" ? "normal" : a];
    if (a == "custom") {
        let customTheme = document.getElementById("optCustom").value;
        color = parseTheme(customTheme).content;
        util.submitToLocalStorage("optCustom");
    }
    gameDraw.color = color;
    // Other more important stuff
    let playerNameInput = document.getElementById("playerNameInput");
    let playerKeyInput = document.getElementById("playerKeyInput");
    let autolevelUpInput = document.getElementById("autoLevelUp").checked;
    global.autolvlUp = autolevelUpInput;
    // Name and keys
    util.submitToLocalStorage("playerNameInput");
    util.submitToLocalStorage("playerKeyInput");
    global.playerName = global.player.name = playerNameInput.value;
    global.playerKey = playerKeyInput.value.replace(/(<([^>]+)>)/gi, "").substring(0, 64);
    // Change the screen
    global.screenWidth = window.innerWidth;
    global.screenHeight = window.innerHeight;
    document.getElementById("startMenuWrapper").style.top = "-700px";
    document.getElementById("gameAreaWrapper").style.opacity = 1;
    setTimeout(() => {
        document.getElementById("startMenuWrapper").remove();
    }, 1e3);
    // Set up the socket
    if (!global.socket) {
        global.socket = socketInit(26301);
    }
    if (!global.animLoopHandle) {
        animloop();
    }
    // initialize canvas.
    window.canvas.socket = global.socket;
    setInterval(() => moveCompensation.iterate(global.motion), 1000 / 40);
    canvas.init();
    document.getElementById("gameCanvas").focus();
    window.onbeforeunload = () => true;
}

function clearScreen(clearColor, alpha) {
    ctx.fillStyle = clearColor;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, global.screenWidth, global.screenHeight);
    ctx.globalAlpha = 1;
}

function arrayifyText(rawText) {
    //we want people to be able to use the section sign in writing too
    // string with double §           txt   col   txt                      txt
    // "...§text§§text§..." => [..., "text", "", "text", ...] => [..., "text§text", ...]
    // this code is balanced on tight threads, holy shit
    let textArrayRaw = rawText.split('§'),
        textArray = [];
    if (!(textArrayRaw.length & 1)) {
        textArrayRaw.unshift('');
    }
    while (textArrayRaw.length) {
        let first = textArrayRaw.shift();
        if (!textArrayRaw.length) {
            textArray.push(first);
        } else if (textArrayRaw[1]) {
            textArray.push(first, textArrayRaw.shift());
        } else {
            textArrayRaw.shift();
            textArray.push(first + '§' + textArrayRaw.shift(), textArrayRaw.shift());
        }
    }
    return textArray;
}

function measureText(text, fontSize, withHeight = false) {
    fontSize += settings.graphical.fontSizeBoost;
    ctx.font = "bold " + fontSize + "px Ubuntu";
    let measurement = ctx.measureText(arrayifyText(text).reduce((a, b, i) => (i & 1) ? a : a + b, ''));
    return withHeight ? { width: measurement.width, height: fontSize } : measurement.width;
}

function drawText(rawText, x, y, size, defaultFillStyle, align = "left", center = false, fade = 1, stroke = true, context = ctx) {
    size += settings.graphical.fontSizeBoost;
    // Get text dimensions and resize/reset the canvas
    let offset = size / 5,
        ratio = 1,
        textArray = arrayifyText(rawText),
        renderedFullText = textArray.reduce((a, b, i) => (i & 1) ? a : a + b, '');
    if (context.getTransform) {
        ratio = ctx.getTransform().d;
        offset *= ratio;
    }
    if (ratio !== 1) {
        size *= ratio;
    }
    context.font = "bold " + size + "px Ubuntu";
    let Xoffset = offset,
        Yoffset = (size + 2 * offset) / 2,
        alignMultiplier = 0;
    switch (align) {
        //case "left":
        //    //do nothing.
        //    break;
        case "center":
            alignMultiplier = 0.5;
            break;
        case "right":
            alignMultiplier = 1;
    }
    if (alignMultiplier) {
        Xoffset -= ctx.measureText(renderedFullText).width * alignMultiplier;
    }
    // Draw it
    context.lineWidth = (size + 1) / settings.graphical.fontStrokeRatio;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.strokeStyle = color.black;
    context.fillStyle = defaultFillStyle;
    context.save();
    context.lineCap = settings.graphical.miterText ? "miter" : "round";
    context.lineJoin = settings.graphical.miterText ? "miter" : "round";
    if (ratio !== 1) {
        context.scale(1 / ratio, 1 / ratio);
    }
    Xoffset += x * ratio - size / 4; //this extra size-dependant margin is a guess lol // apparently this guess worked out to be a hella good one
    Yoffset += y * ratio - Yoffset * (center ? 1.05 : 1.5);
    if (stroke) {
        context.strokeText(renderedFullText, Xoffset, Yoffset);
    }
    for (let i = 0; i < textArray.length; i++) {
        let str = textArray[i];

        // odd index = this is a color to set the fill style to
        if (i & 1) {

            //reset color to default
            if (str === "reset") {
                context.fillStyle = defaultFillStyle;
            } else {
                str = gameDraw.getColor(str) ?? str;
            }
            context.fillStyle = str;

        } else {
            // move forward a bit taking the width of the last piece of text + "kerning" between
            // the last letter of last text and the first letter of current text,
            // making it align perfectly with what we drew with strokeText earlier
            if (i) {
                Xoffset += ctx.measureText(textArray[i - 2] + str).width - ctx.measureText(str).width;
            }
            context.fillText(str, Xoffset, Yoffset);
        }
    }
    context.restore();
}
// Gui drawing functions
function drawGuiRect(x, y, length, height, stroke = false) {
    switch (stroke) {
        case true:
            ctx.strokeRect(x, y, length, height);
            break;
        case false:
            ctx.fillRect(x, y, length, height);
            break;
    }
}

function drawGuiCircle(x, y, radius, stroke = false) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (stroke) {
        ctx.stroke();
    } else {
        ctx.fill();
    }
}

function drawGuiLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.lineTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    ctx.closePath();
    ctx.stroke();
}

function drawBar(x1, x2, y, width, color) {
    ctx.beginPath();
    ctx.lineTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.closePath();
    ctx.stroke();
}
// Sub-drawing functions
const drawPolyImgs = [];
function drawPoly(context, centerX, centerY, radius, sides, angle = 0, borderless, fill, imageInterpolation) {
    try {
        // Start drawing
        context.beginPath();
        if (sides instanceof Array) {
            let dx = Math.cos(angle);
            let dy = Math.sin(angle);
            for (let [x, y] of sides)
                context.lineTo(
                    centerX + radius * (x * dx - y * dy),
                    centerY + radius * (y * dx + x * dy)
                );
        } else {
            if ("string" === typeof sides) {
                //ideally we'd preload images when mockups are loaded but im too lazy for that atm
                if (sides.startsWith('/') | sides.startsWith('./') | sides.startsWith('http')) {
                    drawPolyImgs[sides] = new Image();
                    drawPolyImgs[sides].src = sides;
                    drawPolyImgs[sides].isBroken = false;
                    drawPolyImgs[sides].onerror = function() {
                    this.isBroken = true;
                }

                let img = drawPolyImgs[sides];
                context.translate(centerX, centerY);
                context.rotate(angle);
                context.imageSmoothingEnabled = imageInterpolation;
                context.drawImage(img, -radius, -radius, radius*2, radius*2);
                context.imageSmoothingEnabled = true;
                context.rotate(-angle);
                context.translate(-centerX, -centerY);
                return;
            }
            let path = new Path2D(sides);
            context.save();
            context.translate(centerX, centerY);
            context.scale(radius, radius);
            context.lineWidth /= radius;
            context.rotate(angle);
            context.lineWidth *= fill ? 1 : 0.5; // Maintain constant border width
            if (!borderless) context.stroke(path);
            if (fill) context.fill(path);
            context.restore();
            return;
        }
        angle += sides % 2 ? 0 : Math.PI / sides;
        }
        if (!sides) {
            // Circle
            let fillcolor = context.fillStyle;
            let strokecolor = context.strokeStyle;
            context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            context.fillStyle = strokecolor;
            context.lineWidth *= fill ? 1 : 0.5; // Maintain constant border width
            if (!borderless) context.stroke();
            context.closePath();
            context.beginPath();
            context.fillStyle = fillcolor;
            context.arc(centerX, centerY, radius * fill, 0, 2 * Math.PI);
            if (fill) context.fill();
            context.closePath();
            return;
        } else if (sides < 0) {
            // Star
            if (settings.graphical.pointy) context.lineJoin = "miter";
            sides = -sides;
            angle += (sides % 1) * Math.PI * 2;
            sides = Math.floor(sides);
            let dip = 1 - 6 / (sides ** 2);
            context.moveTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
            context.lineWidth *= fill ? 1 : 0.5; // Maintain constant border width
            for (let i = 0; i < sides; i++) {
                let htheta = ((i + 0.5) / sides) * 2 * Math.PI + angle,
                    theta = ((i + 1) / sides) * 2 * Math.PI + angle,
                    cx = centerX + radius * dip * Math.cos(htheta),
                    cy = centerY + radius * dip * Math.sin(htheta),
                    px = centerX + radius * Math.cos(theta),
                    py = centerY + radius * Math.sin(theta);
                /*if (curvyTraps) {
                    context.quadraticCurveTo(cx, cy, px, py);
                } else {
                    context.lineTo(cx, cy);
                    context.lineTo(px, py);
                }*/
                context.quadraticCurveTo(cx, cy, px, py);
            }
        } else if (sides > 0) {
            // Polygon
            angle += (sides % 1) * Math.PI * 2;
            sides = Math.floor(sides);
            context.lineWidth *= fill ? 1 : 0.5; // Maintain constant border width
            for (let i = 0; i < sides; i++) {
                let theta = (i / sides) * 2 * Math.PI + angle;
                context.lineTo(centerX + radius * Math.cos(theta), centerY + radius * Math.sin(theta));
            }
        }
        context.closePath();
        if (!borderless) context.stroke();
        if (fill) context.fill();
        context.lineJoin = "round";
    } catch (e) { // this actually prevents to panic the client. so we will just call "resizeEvent()".
        resizeEvent();
        console.error("Uh oh, 'CanvasRenderingContext2D' has gotton an error! Error: " + e);
    }
}
function drawTrapezoid(context, x, y, length, height, aspect, angle, borderless, fill, alpha, strokeWidth, position) {
    let h = [];
    h = aspect > 0 ? [height * aspect, height] : [height, -height * aspect];

    // Construct a trapezoid at angle 0
    let points = [],
        sinT = Math.sin(angle),
        cosT = Math.cos(angle);
    points.push([-position, h[1]]);
    points.push([length * 2 - position, h[0]]);
    points.push([length * 2 - position, -h[0]]);
    points.push([-position, -h[1]]);
    context.globalAlpha = alpha;

    // Rotate it to the new angle via vector rotation
    context.beginPath();
    for (let point of points) {
        let newX = point[0] * cosT - point[1] * sinT + x,
            newY = point[0] * sinT + point[1] * cosT + y;
        context.lineTo(newX, newY);
    }
    context.closePath();
    context.lineWidth *= strokeWidth
    context.lineWidth *= fill ? 1 : 0.5; // Maintain constant border width
    if (!borderless) context.stroke();
    context.lineWidth /= fill ? 1 : 0.5; // Maintain constant border width
    if (fill) context.fill();
    context.globalAlpha = 1;
}
const drawEntity = (baseColor, x, y, instance, ratio, alpha = 1, scale = 1, lineWidthMult = 1, rot = 0, turretsObeyRot = false, assignedContext = false, turretInfo = false, render = instance.render) => {
    let context = assignedContext ? assignedContext : ctx;
    let fade = turretInfo ? 1 : render.status.getFade(),
        drawSize = scale * ratio * instance.size,
        indexes = instance.index.split("-"),
        m = global.mockups[parseInt(indexes[0])],
        xx = x,
        yy = y,
        source = turretInfo === false ? instance : turretInfo,
        blend = render.status.getBlend(),
        initStrokeWidth = lineWidthMult * Math.max(settings.graphical.mininumBorderChunk, ratio * settings.graphical.borderChunk);
    source.guns.update();
    if (fade === 0 || alpha === 0) return;
    if (render.expandsWithDeath && settings.graphical.fancyAnimations) drawSize *= 1 + 0.5 * (1 - fade);
    if (!settings.graphical.fancyAnimations) drawSize *= 1 + -2 * (1 - fade);
    if (settings.graphical.fancyAnimations && assignedContext != ctx2 && (fade !== 1 || alpha !== 1)) {
        context = ctx2;
        context.canvas.width = context.canvas.height = drawSize * m.position.axis / ratio * 2 + initStrokeWidth;
        xx = context.canvas.width / 2 - (drawSize * m.position.axis * m.position.middle.x * Math.cos(rot)) / 4;
        yy = context.canvas.height / 2 - (drawSize * m.position.axis * m.position.middle.y * Math.sin(rot)) / 4;
    } else {
        if (fade * alpha < 0.5) return;
    }
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = initStrokeWidth

    let upperTurretsIndex = source.turrets.length;
    // Draw turrets beneath us
    for (let i = 0; i < source.turrets.length; i++) {
        let t = source.turrets[i];
        context.lineWidth = initStrokeWidth * t.strokeWidth
        t.lerpedFacing == undefined
            ? (t.lerpedFacing = t.facing)
            : (t.lerpedFacing = util.lerpAngle(t.lerpedFacing, t.facing, 0.1, true));

        // Break condition
        if (t.layer > 0) {
            upperTurretsIndex = i;
            break;
        }

        let ang = t.direction + t.angle + rot,
            len = t.offset * drawSize,
            facing;
        if (t.mirrorMasterAngle || turretsObeyRot) {
            facing = rot + t.angle;
        } else {
            facing = t.lerpedFacing;
        }
        drawEntity(baseColor, xx + len * Math.cos(ang), yy + len * Math.sin(ang), t, ratio, 1, (drawSize / ratio / t.size) * t.sizeFactor, lineWidthMult, facing, turretsObeyRot, context, t, render);
    }
    // Draw guns below us
    let positions = source.guns.getPositions(),
        gunConfig = source.guns.getConfig();
    for (let i = 0; i < source.guns.length; i++) {
        context.lineWidth = initStrokeWidth
        let g = gunConfig[i];
        if (!g.drawAbove) {
            let gx = g.offset * Math.cos(g.direction + g.angle + rot),
                gy = g.offset * Math.sin(g.direction + g.angle + rot),
                gunColor = g.color == null ? color.grey : gameDraw.modifyColor(g.color, baseColor),
                alpha = g.alpha,
                strokeWidth = g.strokeWidth,
                borderless = g.borderless,
                fill = g.drawFill;
            gameDraw.setColor(context, gameDraw.mixColors(gunColor, render.status.getColor(), blend));
            drawTrapezoid(context, xx + drawSize * gx, yy + drawSize * gy, drawSize * g.length / 2, drawSize * g.width / 2, g.aspect, g.angle + rot, borderless, fill, alpha, strokeWidth, drawSize * positions[i]);
        }
    }
    // Draw body
    context.globalAlpha = 1;
    context.lineWidth = initStrokeWidth * m.strokeWidth
    gameDraw.setColor(context, gameDraw.mixColors(gameDraw.modifyColor(instance.color, baseColor), render.status.getColor(), blend));

    //just so you know, the glow implimentation is REALLY bad and subject to change in the future
    context.shadowColor = m.glow.color != null ? gameDraw.modifyColor(m.glow.color) : gameDraw.mixColors(
        gameDraw.modifyColor(instance.color),
        render.status.getColor(),
        render.status.getBlend()
    );
    if (m.glow.radius && m.glow.radius > 0) {
        context.shadowBlur = m.glow.radius * ((drawSize / m.size) * m.realSize);
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.globalAlpha = m.glow.alpha;
        for (var i = 0; i < m.glow.recursion; i++) {
            drawPoly(context, xx, yy, (drawSize / m.size) * m.realSize, m.shape, rot, true, m.drawFill);
        }
        context.globalAlpha = 1;
    }
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    drawPoly(context, xx, yy, (drawSize / m.size) * m.realSize, m.shape, rot, instance.borderless, instance.drawFill, m.imageInterpolation);

    // Draw guns above us
    for (let i = 0; i < source.guns.length; i++) {
        context.lineWidth = initStrokeWidth
        let g = gunConfig[i];
        if (g.drawAbove) {
            let gx = g.offset * Math.cos(g.direction + g.angle + rot),
                gy = g.offset * Math.sin(g.direction + g.angle + rot),
                gunColor = g.color == null ? color.grey : gameDraw.modifyColor(g.color, baseColor),
                alpha = g.alpha,
                strokeWidth = g.strokeWidth,
                borderless = g.borderless,
                fill = g.drawFill;
            gameDraw.setColor(context, gameDraw.mixColors(gunColor, render.status.getColor(), blend));
            drawTrapezoid(context, xx + drawSize * gx, yy + drawSize * gy, drawSize * g.length / 2, drawSize * g.width / 2, g.aspect, g.angle + rot, borderless, fill, alpha, strokeWidth, drawSize * positions[i]);
        }
    }
    // Draw turrets above us
    for (let i = upperTurretsIndex; i < source.turrets.length; i++) {
        let t = source.turrets[i];
        context.lineWidth = initStrokeWidth * t.strokeWidth
        t.lerpedFacing == undefined
            ? (t.lerpedFacing = t.facing)
            : (t.lerpedFacing = util.lerpAngle(t.lerpedFacing, t.facing, 0.1, true));
        let ang = t.direction + t.angle + rot,
            len = t.offset * drawSize,
            facing;
        if (t.mirrorMasterAngle || turretsObeyRot) {
            facing = rot + t.angle;
        } else {
            facing = t.lerpedFacing;
        }
        drawEntity(baseColor, xx + len * Math.cos(ang), yy + len * Math.sin(ang), t, ratio, 1, (drawSize / ratio / t.size) * t.sizeFactor, lineWidthMult, facing, turretsObeyRot, context, t, render);
    }
    if (assignedContext == false && context != ctx && context.canvas.width > 0 && context.canvas.height > 0) {
        ctx.save();
        ctx.globalAlpha = alpha * fade;
        ctx.imageSmoothingEnabled = true;
        //ctx.globalCompositeOperation = "overlay";
        ctx.drawImage(context.canvas, x - xx, y - yy);
        ctx.restore();
        //ctx.globalCompositeOperation = "source-over";
    }
};
function drawHealth(x, y, instance, ratio, alpha) {
    let fade = instance.render.status.getFade();
    ctx.globalAlpha = fade * fade;
    let size = instance.size * ratio,
        indexes = instance.index.split("-"),
        m = global.mockups[parseInt(indexes[0])],
        realSize = (size / m.size) * m.realSize;
    if (instance.drawsHealth) {
        let health = instance.render.health.get(),
            shield = instance.render.shield.get();
        if (health < 0.99 || shield < 0.99 && global.GUIStatus.renderhealth) {
            let col = settings.graphical.coloredHealthbars ? gameDraw.mixColors(gameDraw.modifyColor(instance.color), color.guiwhite, 0.5) : color.lgreen;
            let yy = y + realSize + 15 * ratio;
            let barWidth = 3 * ratio;
            //TODO: seperate option for hp bars
            // function drawBar(x1, x2, y, width, color) {

            //background bar
            drawBar(x - size, x + size, yy + barWidth * settings.graphical.seperatedHealthbars / 2, barWidth * (1 + settings.graphical.seperatedHealthbars) + settings.graphical.barChunk, color.black);

            //hp bar
            drawBar(x - size, x - size + 2 * size * health, yy + barWidth * settings.graphical.seperatedHealthbars, barWidth, col);

            //shield bar
            if (shield || settings.graphical.seperatedHealthbars) {
                if (!settings.graphical.seperatedHealthbars) ctx.globalAlpha = (1 + shield) * 0.3 * (alpha ** 2) * fade;
                drawBar(x - size, x - size + 2 * size * shield, yy, barWidth, settings.graphical.coloredHealthbars ? gameDraw.mixColors(col, color.guiblack, 0.25) : color.teal);
                ctx.globalAlpha = 1;
            }
            if (gui.showhealthtext) drawText(Math.round(instance.healthN) + "/" + Math.round(instance.maxHealthN), x, yy + barWidth * 2 + barWidth * settings.graphical.seperatedHealthbars * 2 + 10, 12 * ratio, color.guiwhite, "center");
            ctx.globalAlpha = fade * (alpha ** 2);
        }
    }
    if (instance.id !== gui.playerid && instance.nameplate) {
        var name = instance.name.substring(7, instance.name.length + 1);
        var namecolor = instance.name.substring(0, 7);
        ctx.globalAlpha = fade * (alpha ** 2);
        if (global.GUIStatus.renderPlayerNames) drawText(name, x, y - realSize - 22 * ratio, 12 * ratio, namecolor == "#ffffff" ? color.guiwhite : namecolor, "center");
        if (global.GUIStatus.renderPlayerScores) drawText(util.handleLargeNumber(instance.score, 1), x, y - realSize - 12 * ratio, 6 * ratio, namecolor == "#ffffff" ? color.guiwhite : namecolor, "center");
    }
}

const iconColorOrder = [10, 11, 12, 15, 13, 2, 14, 4, 5, 1, 0, 3];
function getIconColor(colorIndex) {
    return iconColorOrder[colorIndex % 12].toString();
}

function drawEntityIcon(model, x, y, len, height, lineWidthMult, angle, alpha, colorIndex, upgradeKey, hover = false) {
    let picture = (typeof model == "object") ? model : util.getEntityImageFromMockup(model, gui.color),
        position = picture.position,
        scale = (0.6 * len) / position.axis,
        entityX = x + 0.5 * len,
        entityY = y + 0.5 * height,
        baseColor = picture.color;

    // Find x and y shift for the entity image
    let xShift = position.middle.x * Math.cos(angle) - position.middle.y * Math.sin(angle),
        yShift = position.middle.x * Math.sin(angle) + position.middle.y * Math.cos(angle);
    entityX -= scale * xShift;
    entityY -= scale * yShift;

    // Draw box
    ctx.globalAlpha = alpha;
    ctx.fillStyle = picture.upgradeColor != null
        ? gameDraw.modifyColor(picture.upgradeColor)
        : gameDraw.getColor(getIconColor(colorIndex));
    drawGuiRect(x, y, len, height);
    ctx.globalAlpha = 0.25 * alpha;
    ctx.fillStyle = color.black;
    drawGuiRect(x, y + height * 0.6, len, height * 0.4);
    // Shading for hover
    if (hover) {
        ctx.globalAlpha = 0.15 * alpha;
        ctx.fillStyle = color.guiwhite;
        drawGuiRect(x, y, len, height);
    }
    ctx.globalAlpha = 1;

    // Draw Tank
    drawEntity(baseColor, entityX, entityY, picture, 1, 1, scale / picture.size, lineWidthMult, angle, true);

    // Tank name
    drawText(picture.upgradeName ?? picture.name, x + (upgradeKey ? 0.9 * len : len) / 2, y + height * 0.94, height / 10, color.guiwhite, "center");

    // Upgrade key
    if (upgradeKey) {
        drawText("[" + upgradeKey + "]", x + len - 4, y + height - 6, height / 8 - 5, color.guiwhite, "right");
    }
    ctx.strokeStyle = color.black;
    ctx.lineWidth = 3 * lineWidthMult;
    drawGuiRect(x, y, len, height, true); // Border
}

// Start animation
window.requestAnimFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame || (callback => setTimeout(callback, 1000 / 60));
window.cancelAnimFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;
// Drawing states
const statMenu = Smoothbar(0, 0.7, 1.5, 0.1);
const upgradeMenu = Smoothbar(0, 2, 3, 0.1);
const mobileUpgradeGlide = Smoothbar(0, 2, 3, 0.1);
// Define the graph constructor
function graph() {
    var data = [];
    return (point, x, y, w, h, col) => {
        // Add point and push off old ones
        data.push(point);
        while (data.length > w) {
            data.splice(0, 1);
        }
        // Get scale
        let min = Math.min(...data),
            max = Math.max(...data),
            range = max - min;
        // Draw zero
        if (max > 0 && min < 0) {
            drawBar(x, x + w, y + (h * max) / range, 2, color.guiwhite);
        }
        // Draw points
        ctx.beginPath();
        let i = -1;
        for (let p of data) {
            if (!++i) {
                ctx.moveTo(x, y + (h * (max - p)) / range);
            } else {
                ctx.lineTo(x + i, y + (h * (max - p)) / range);
            }
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = col;
        ctx.stroke();
    };
}
// Protected functions
function interpolate(p1, p2, v1, v2, ts, tt) {
    let k = Math.cos((1 + tt) * Math.PI);
    return 0.5 * (((1 + tt) * v1 + p1) * (k + 1) + (-tt * v2 + p2) * (1 - k));
}

function extrapolate(p1, p2, v1, v2, ts, tt) {
    return p2 + (p2 - p1) * tt;
}
// Useful thing
let modulo = function (a, n) {
    return ((a % n) + n) % n;
};
function angleDifference(sourceA, targetA) {
    let a = targetA - sourceA;
    return modulo(a + Math.PI, 2 * Math.PI) - Math.PI;
}
// Lag compensation functions
const compensation = () => {
    // Protected vars
    let t = 0,
        tt = 0,
        ts = 0;
    // Methods
    return {
        set: (
            time = global.player.time,
            interval = global.metrics.rendergap
        ) => {
            t = Math.max(getNow() - time - 80, -interval);
            if (t > 150 && t < 1000) {
                t = 150;
            }
            if (t > 1000) {
                t = (1000 * 1000 * Math.sin(t / 1000 - 1)) / t + 1000;
            }
            tt = t / interval;
            ts = (settings.roomSpeed * 30 * t) / 1000;
        },
        predict: (p1, p2, v1, v2) => {
            return t >= 0
                ? extrapolate(p1, p2, v1, v2, ts, tt)
                : interpolate(p1, p2, v1, v2, ts, tt);
        },
        predictFacing: (f1, f2) => {
            return f1 + (1 + tt) * angleDifference(f1, f2);
        },
        getPrediction: () => {
            return t;
        },
    };
};
// Make graphs
const timingGraph = graph(),
    lagGraph = graph(),
    gapGraph = graph();
// The skill bar dividers
let skas = [];
for (let i = 1; i <= 256; i++) { //if you want to have more skill levels than 255, then update this
    skas.push((i - 2) * 0.01 + Math.log(4 * (i / 9) + 1) / 1.6);
}
const ska = (x) => skas[x];
let scaleScreenRatio = (by, unset) => {
    global.screenWidth /= by;
    global.screenHeight /= by;
    ctx.scale(by, by);
    if (!unset) ratio *= by;
};
var getClassUpgradeKey = function (number) {
    switch (number) {
        case 0:
            return "Y";
        case 1:
            return "U";
        case 2:
            return "I";
        case 3:
            return "H";
        case 4:
            return "J";
        case 5:
            return "K";
        default:
            return null;
    }
};

let tiles,
    branches,
    tankTree,
    measureSize = (x, y, colorIndex, { index, tier = 0 }) => {
        tiles.push({ x, y, colorIndex, index });
        let { upgrades } = global.mockups[parseInt(index)],
            xStart = x,
            cumulativeWidth = 1,
            maxHeight = 1,
            hasUpgrades = [],
            noUpgrades = [];
        for (let i = 0; i < upgrades.length; i++) {
            let upgrade = upgrades[i];
            if (global.mockups[upgrade.index].upgrades.length) {
                hasUpgrades.push(upgrade);
            } else {
                noUpgrades.push(upgrade);
            }
        }
        for (let i = 0; i < hasUpgrades.length; i++) {
            let upgrade = hasUpgrades[i],
                spacing = 2 * Math.max(1, upgrade.tier - tier),
                measure = measureSize(x, y + spacing, upgrade.upgradeColor ?? i, upgrade);
            branches.push([{ x, y: y + Math.sign(i) }, { x, y: y + spacing + 1 }]);
            if (i === hasUpgrades.length - 1 && !noUpgrades.length) {
                branches.push([{ x: xStart, y: y + 1 }, { x, y: y + 1 }]);
            }
            x += measure.width;
            cumulativeWidth += measure.width;
            if (maxHeight < measure.height) maxHeight = measure.height;
        }
        y++;
        for (let i = 0; i < noUpgrades.length; i++) {
            let upgrade = noUpgrades[i],
                height = 2 + upgrades.length;
            measureSize(x, y + 1 + i + Math.sign(hasUpgrades.length) * 2, upgrade.upgradeColor ?? i, upgrade);
            if (i === noUpgrades.length - 1) {
                if (hasUpgrades.length > 1) cumulativeWidth++;
                branches.push([{ x: xStart, y }, { x, y }]);
                branches.push([{ x, y }, { x, y: y + noUpgrades.length + Math.sign(hasUpgrades.length) * 2 }]);
            }
            if (maxHeight < height) maxHeight = height;
        }
        return {
            width: cumulativeWidth,
            height: 2 + maxHeight,
        };
    };
function generateTankTree(indexes) {
    tiles = [];
    branches = [];
    tankTree = { width: 0, height: 0 };
    let rightmostSoFar = 0;
    if (!Array.isArray(indexes)) indexes = [indexes];
    for (let index of indexes) {
        rightmostSoFar += 3 + measureSize(rightmostSoFar, 0, 0, { index }).width;
    }
    for (let { x, y } of tiles) {
        tankTree.width = Math.max(tankTree.width, x);
        tankTree.height = Math.max(tankTree.height, y);
    }
}

function drawFloor(px, py, ratio) {
    // Clear the background + draw grid
    clearScreen(color.white, 1);
    clearScreen(color.guiblack, 0.1);

    //loop through the entire room setup
    let W = global.roomSetup[0].length,
        H = global.roomSetup.length;
    for (let i = 0; i < H; i++) {

        //skip if this row is not visible
        let top = Math.max(0, (ratio * i * global.gameHeight) / H - py + global.screenHeight / 2),
            bottom = Math.min(global.screenHeight, (ratio * (i + 1) * global.gameHeight) / H - py + global.screenHeight / 2);
        if (top > global.screenHeight || bottom < 0) continue;

        //loop through tiles in this row
        let row = global.roomSetup[i];
        for (let j = 0; j < W; j++) {

            //skip if tile not visible
            let left = Math.max(0, (ratio * j * global.gameWidth) / W - px + global.screenWidth / 2),
                right = Math.min(global.screenWidth, (ratio * (j + 1) * global.gameWidth) / W - px + global.screenWidth / 2);
            if (left > global.screenWidth || right < 0) continue;

            //draw it
            let tile = row[j];
            
            if (tile.includes('none')) continue;

            ctx.globalAlpha = 1;
            ctx.fillStyle = settings.graphical.screenshotMode ? color.guiwhite : color.white;
            ctx.fillRect(left, top, right - left, bottom - top);

            if (settings.graphical.screenshotMode) continue;
            
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = gameDraw.modifyColor(tile);
            ctx.fillRect(left, top, right - left + 1, bottom - top + 1);
        }
    }
    if (settings.graphical.showGrid) {
        let gridsize = 30 * ratio;
        if (gridsize < 7) return;
        ctx.lineWidth = ratio;
        ctx.strokeStyle = settings.graphical.screenshotMode ? color.guiwhite : color.guiblack;
        ctx.globalAlpha = 0.04;
        ctx.beginPath();
        for (let x = (global.screenWidth / 2 - px) % gridsize; x < global.screenWidth; x += gridsize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, global.screenHeight);
        }
        for (let y = (global.screenHeight / 2 - py) % gridsize; y < global.screenHeight; y += gridsize) {
            ctx.moveTo(0, y);
            ctx.lineTo(global.screenWidth, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

function drawEntities(px, py, ratio) {
    // Draw things
    for (let instance of global.entities) {
        if (!instance.render.draws) {
            continue;
        }
        let motion = compensation();
        if (instance.render.status.getFade() === 1) {
            motion.set();
        } else {
            motion.set(instance.render.lastRender, instance.render.interval);
        }
        instance.render.x = util.lerp(instance.render.x, Math.round(instance.x + instance.vx), 0.1, true);
        instance.render.y = util.lerp(instance.render.y, Math.round(instance.y + instance.vy), 0.1, true);
        instance.render.f = instance.id === gui.playerid && !global.autoSpin && !global.syncingWithTank && !instance.twiggle && !global.died ? Math.atan2(global.target.y * global.reverseTank, global.target.x * global.reverseTank) : util.lerpAngle(instance.render.f, instance.facing, 0.15, true);
        let x = ratio * instance.render.x - px,
            y = ratio * instance.render.y - py,
            baseColor = instance.color;

        if (instance.id === gui.playerid) {
            x = settings.graphical.centerTank && !global.player.isScoping ? 0 : x;
            y = settings.graphical.centerTank && !global.player.isScoping ? 0 : y;
            global.player.screenx = x;
            global.player.screeny = y;
        }
        x += global.screenWidth / 2;
        y += global.screenHeight / 2;
        drawEntity(baseColor, x, y, instance, ratio, instance.id === gui.playerid || global.showInvisible ? instance.alpha ? instance.alpha * 0.75 + 0.25 : 0.25 : instance.alpha, 1, 1, instance.render.f);
    }

    //dont draw healthbars and chat messages in screenshot mode
    if (settings.graphical.screenshotMode) return;

    //draw health bars above entities
    for (let instance of global.entities) {
        let x = instance.id === gui.playerid ? global.player.screenx : ratio * instance.render.x - px,
            y = instance.id === gui.playerid ? global.player.screeny : ratio * instance.render.y - py;
        x += global.screenWidth / 2;
        y += global.screenHeight / 2;
        drawHealth(x, y, instance, ratio, instance.alpha);
    }

    let now = Date.now(),
        ratioForChat = (1 + ratio) / 2;
    for (let instance of global.entities) {
        //put chat msg above name
        let size = instance.size * ratio,
            indexes = instance.index.split("-"),
            m = global.mockups[parseInt(indexes[0])],
            realSize = (size / m.size) * m.realSize,
            x = instance.id === gui.playerid ? global.player.screenx : ratio * instance.render.x - px,
            y = instance.id === gui.playerid ? global.player.screeny : ratio * instance.render.y - py;
        x += global.screenWidth / 2;
        y += global.screenHeight / 2 - realSize - 46 * ratio;
        if (instance.id !== gui.playerid && instance.nameplate) y -= 8 * ratio;

        //draw all the msgs
        for (let i in global.chats[instance.id]) {
            let chat = global.chats[instance.id][i],
                text = chat.text,
                msgLengthHalf = measureText(text, 15 * ratioForChat) / 2,
                alpha = Math.max(!global.mobile ? 0 : 1, Math.min(1000, chat.expires - now) / 1000);

            ctx.globalAlpha = 0.5 * alpha;
            drawBar(x - msgLengthHalf, x + msgLengthHalf, y, 30 * ratioForChat, gameDraw.modifyColor(instance.color));
            ctx.globalAlpha = alpha;
            settings.graphical.fontStrokeRatio *= 1.2;
            drawText(text, x, y + 7 * ratioForChat, 15 * ratioForChat, color.guiwhite, "center");
            settings.graphical.fontStrokeRatio /= 1.2;
            y -= 35 * ratioForChat;
        }
    }
}

global.showTree = false;
global.scrollX = global.scrollY = global.fixedScrollX = global.fixedScrollY = -1;
global.scrollVelocityY = global.scrollVelocityX = 0;
let lastGuiType = null;
function drawUpgradeTree(spacing, alcoveSize) {
    /*if (global.died) {
        global.showTree = false;
        global.scrollX = global.scrollY = global.fixedScrollX = global.fixedScrollY = global.scrollVelocityY = global.scrollVelocityX = 0;
        global.treeScale = 1;
        return;
    }*/ // Hide the tree on death

    if (lastGuiType != gui.type) {
        let m = util.getEntityImageFromMockup(gui.type), // The mockup that corresponds to the player's tank
            rootName = m.rerootUpgradeTree, // The upgrade tree root of the player's tank
            rootIndex = [];
        for (let name of rootName) {
            let ind = name == undefined ? -1 : global.mockups.find(i => i.className == name).index;
            rootIndex.push(ind); // The index of the mockup that corresponds to the root tank (-1 for no root)
        }
        if (!rootIndex.includes(-1)) {
            generateTankTree(rootIndex);
        }
        lastGuiType = gui.type;
    }

    if (!tankTree) {
        console.log('No tank tree rendered yet.');
        return;
    }

    let tileSize = alcoveSize / 2,
        size = tileSize - 4, // TODO: figure out where this 4 comes from
        spaceBetween = 10,
        screenDivisor = (spaceBetween + tileSize) * 2 * global.treeScale,
        padding = tileSize / screenDivisor,
        dividedWidth = global.screenWidth / screenDivisor,
        dividedHeight = global.screenHeight / screenDivisor,
        treeFactor = 1 + spaceBetween / tileSize;

    global.fixedScrollX = Math.max(
        dividedWidth - padding,
        Math.min(
            tankTree.width * treeFactor + padding - dividedWidth,
            global.fixedScrollX + global.scrollVelocityX
        )
    );
    global.fixedScrollY = Math.max(
        dividedHeight - padding,
        Math.min(
            tankTree.height * treeFactor + padding - dividedHeight,
            global.fixedScrollY + global.scrollVelocityY
        )
    );
    global.scrollX = util.lerp(global.scrollX, global.fixedScrollX, 0.1);
    global.scrollY = util.lerp(global.scrollY, global.fixedScrollY, 0.1);

    for (let [start, end] of branches) {
        let sx = ((start.x - global.scrollX) * (tileSize + spaceBetween) + 1 + 0.5 * size) * global.treeScale + global.screenWidth / 2,
            sy = ((start.y - global.scrollY) * (tileSize + spaceBetween) + 1 + 0.5 * size) * global.treeScale + global.screenHeight / 2,
            ex = ((end.x - global.scrollX) * (tileSize + spaceBetween) + 1 + 0.5 * size) * global.treeScale + global.screenWidth / 2,
            ey = ((end.y - global.scrollY) * (tileSize + spaceBetween) + 1 + 0.5 * size) * global.treeScale + global.screenHeight / 2;
        if (ex < 0 || sx > global.screenWidth || ey < 0 || sy > global.screenHeight) continue;
        ctx.strokeStyle = color.black;
        ctx.lineWidth = 2 * global.treeScale;
        drawGuiLine(sx, sy, ex, ey);
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color.guiwhite;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = 1;

    //draw the various tank icons
    let angle = -Math.PI / 4;
    for (let { x, y, colorIndex, index } of tiles) {
        let ax = (x - global.scrollX) * (tileSize + spaceBetween) * global.treeScale + global.screenWidth / 2,
            ay = (y - global.scrollY) * (tileSize + spaceBetween) * global.treeScale + global.screenHeight / 2;
        if (ax < -tileSize || ax > global.screenWidth + tileSize || ay < -tileSize || ay > global.screenHeight + tileSize) continue;
        drawEntityIcon(index.toString(), ax, ay, tileSize * global.treeScale, tileSize * global.treeScale, global.treeScale, angle, 1, colorIndex);
    }

    let text = "Arrow keys to navigate the class tree. Shift to navigate faster. Scroll wheel (or +/- keys) to zoom in/out.";
    let w = measureText(text, 18);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.fillStyle = color.dgrey;
    ctx.strokeStyle = color.black;
    ctx.fillText(text, global.screenWidth / 2 - w / 2, innerHeight * 0.04);
    ctx.strokeText(text, global.screenWidth / 2 - w / 2, innerHeight * 0.04);
}

function drawMessages(spacing, alcoveSize) {
    // Draw messages
    let vspacing = 4;
    let len = 0;
    let height = 18;
    let x = global.screenWidth / 2;
    let y = spacing;
    if (global.mobile) {
        if (global.canUpgrade) {
            mobileUpgradeGlide.set(0 + (global.canUpgrade || global.upgradeHover));
            y += (alcoveSize / 1.4 /*+ spacing * 2*/) * mobileUpgradeGlide.get();
        }
        y += global.canSkill || global.showSkill ? (alcoveSize / 2.2 /*+ spacing * 2*/) * statMenu.get() : 0;
    }
    // Draw each message
    for (let i = global.messages.length - 1; i >= 0; i--) {
        let msg = global.messages[i],
            txt = msg.text,
            text = txt; //txt[0].toUpperCase() + txt.substring(1);
        // Give it a textobj if it doesn't have one
        if (msg.len == null) msg.len = measureText(text, height - 4);
        // Draw the background
        ctx.globalAlpha = 0.5 * msg.alpha;
        drawBar(x - msg.len / 2, x + msg.len / 2, y + height / 2, height, color.black);
        // Draw the text
        ctx.globalAlpha = Math.min(1, msg.alpha);
        drawText(text, x, y + height / 2, height - 4, color.guiwhite, "center", true);
        // Iterate and move
        y += vspacing + height;
        if (msg.status > 1) {
            y -= (vspacing + height) * (1 - Math.sqrt(msg.alpha));
        }
        if (msg.status > 1) {
            msg.status -= 0.05;
            msg.alpha += 0.05;
        } else if (
            i === 0 &&
            (global.messages.length > 5 || Date.now() - msg.time > 0)
        ) {
            msg.status -= 0.05;
            msg.alpha -= 0.05;
            // Remove
            if (msg.alpha <= 0) {
                global.messages.splice(0, 1);
            }
        }
    }
    ctx.globalAlpha = 1;
}

function drawSkillBars(spacing, alcoveSize) {
    // Draw skill bars
    if (global.mobile) return drawMobileSkillUpgrades(spacing, alcoveSize);
    statMenu.set(0 + (global.died || global.statHover || (global.canSkill && !gui.skills.every(skill => skill.cap === skill.amount))));
    global.clickables.stat.hide();
    let vspacing = 4;
    let height = 15;
    let gap = 40;
    let len = alcoveSize; // * global.screenWidth; // The 30 is for the value modifiers
    let save = len;
    let x = spacing + (statMenu.get() - 1) * (height + 50 + len * ska(gui.skills.reduce((largest, skill) => Math.max(largest, skill.cap), 0)));
    let y = global.screenHeight - spacing - height;
    let ticker = 11;
    let namedata = gui.getStatNames(global.mockups[parseInt(gui.type.split("-")[0])].statnames);
    let clickableRatio = canvas.height / global.screenHeight / global.ratio;
    for (let i = 0; i < gui.skills.length; i++) {
        ticker--;
        //information about the bar
        let skill = gui.skills[i],
            name = namedata[ticker - 1],
            level = skill.amount,
            col = color[skill.color],
            cap = skill.softcap,
            maxLevel = skill.cap;
        if (!cap) continue;
        len = save;
        let max = 0,
            extension = cap > max,
            blocking = cap < maxLevel;
        if (extension) {
            max = cap;
        }

        //bar fills
        drawBar(x + height / 2, x - height / 2 + len * ska(cap), y + height / 2, height - 3 + settings.graphical.barChunk, color.black);
        drawBar(x + height / 2, x + height / 2 + len * ska(cap) - gap, y + height / 2, height - 3, color.grey);
        drawBar(x + height / 2, x + height / 2 + len * ska(level) - gap, y + height / 2, height - 3.5, col);

        // Blocked-off area
        if (blocking) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = color.grey;
            for (let j = cap + 1; j < max; j++) {
                drawGuiLine(x + len * ska(j) - gap, y + 1.5, x + len * ska(j) - gap, y - 3 + height);
            }
        }

        // Vertical dividers
        ctx.strokeStyle = color.black;
        ctx.lineWidth = 1;
        for (let j = 1; j < level + 1; j++) {
            drawGuiLine(x + len * ska(j) - gap, y + 1.5, x + len * ska(j) - gap, y - 3 + height);
        }

        // Skill name
        len = save * ska(max);
        let textcolor = level == maxLevel ? col : !gui.points || (cap !== maxLevel && level == cap) ? color.grey : color.guiwhite;
        drawText(name, Math.round(x + len / 2) + 0.5, y + height / 2, height - 5, textcolor, "center", true);

        // Skill key
        drawText("[" + (ticker % 10) + "]", Math.round(x + len - height * 0.25) - 1.5, y + height / 2, height - 5, textcolor, "right", true);
        if (textcolor === color.guiwhite) {
            // If it's active
            global.clickables.stat.place(ticker - 1, x * clickableRatio, y * clickableRatio, len * clickableRatio, height * clickableRatio);
        }

        // Skill value
        if (level) {
            drawText(textcolor === col ? "MAX" : "+" + level, Math.round(x + len + 4) + 0.5, y + height / 2, height - 5, col, "left", true);
        }

        // Move on
        y -= height + vspacing;
    }
    global.clickables.hover.place(0, 0, y * clickableRatio, 0.8 * len * clickableRatio, (global.screenHeight - y) * clickableRatio);
    if (gui.points !== 0) {
        // Draw skillpoints to spend
        drawText("x" + gui.points, Math.round(x + len - 2) + 0.5, Math.round(y + height - 4) + 0.5, 20, color.guiwhite, "right");
    }
}
function drawMobileSkillUpgrades(spacing, alcoveSize) {
    global.canSkill = gui.points > 0 && gui.skills.some(s => s.amount < s.cap) && !global.canUpgrade;
    global.showSkill = !global.canUpgrade && !global.canSkill && global.died;
    statMenu.set(global.canSkill || global.showSkill || global.disconnected ? 1 : 0);
    let n = statMenu.get();
    global.clickables.stat.hide();
    let t = alcoveSize / 2,
        q = alcoveSize / 3,
        x = 2 * n * spacing - spacing,
        statNames = gui.getStatNames(global.mockups[parseInt(gui.type.split("-")[0])].statnames),
        clickableRatio = canvas.height / global.screenHeight / global.ratio;
    if (global.canSkill || global.showSkill) {
        for (let i = 0; i < gui.skills.length; i++) {
            let skill = gui.skills[i],
                softcap = skill.softcap;
            if (softcap <= 0) continue;
            let amount = skill.amount,
                skillColor = color[skill.color],
                cap = skill.cap,
                name = statNames[9 - i].split(/\s+/),
                halfNameLength = Math.floor(name.length / 2),
                [name1, name2] = name.length === 1 ? [name[0], null] : [name.slice(0, halfNameLength).join(" "), name.slice(halfNameLength).join(" ")];

            ctx.globalAlpha = 0.5;
            ctx.fillStyle = skillColor;
            drawGuiRect(x, spacing, t, 2 * q / 3);

            ctx.globalAlpha = 0.1;
            ctx.fillStyle = color.black;
            drawGuiRect(x, spacing + q * 2 / 3 * 2 / 3, t, q * 2 / 3 / 3);

            ctx.globalAlpha = 1;
            ctx.fillStyle = color.guiwhite;
            drawGuiRect(x, spacing + q * 2 / 3, t, q / 3);

            ctx.fillStyle = skillColor;
            drawGuiRect(x, spacing + q * 2 / 3, t * amount / softcap, q / 3);

            ctx.strokeStyle = color.black;
            ctx.lineWidth = 1;
            for (let j = 1; j < cap; j++) {
                let width = x + j / softcap * t;
                drawGuiLine(width, spacing + q * 2 / 3, width, spacing + q);
            }

            cap === 0 || !gui.points || softcap !== cap && amount === softcap || global.clickables.stat.place(9 - i, x * clickableRatio, spacing * clickableRatio, t * clickableRatio, q * clickableRatio);

            if (name2) {
                drawText(name2, x + t / 2, spacing + q * 0.55, q / 5, color.guiwhite, "center");
                drawText(name1, x + t / 2, spacing + q * 0.3, q / 5, color.guiwhite, "center");
            } else {
                drawText(name1, x + t / 2, spacing + q * 0.425, q / 5, color.guiwhite, "center");
            }

            if (amount > 0) {
                drawText(amount < softcap ? `+${amount}` : "MAX", x + t / 2, spacing + q * 1.3, q / 4, skillColor, "center");
            }

            ctx.strokeStyle = color.black;
            ctx.globalAlpha = 1;
            ctx.lineWidth = 3;
            drawGuiLine(x, spacing + q * 2 / 3, x + t, spacing + q * 2 / 3);
            drawGuiRect(x, spacing, t, q, true);

            x += n * (t + 14);
        }

        if (gui.points > 1) {
            drawText(`x${gui.points}`, x, spacing + 20, 20, color.guiwhite, "left");
        }
    }
}
function drawSelfInfo(spacing, alcoveSize, max) {
    //rendering information
    let vspacing = 4.5;
    let len = 1.75 * alcoveSize; // * global.screenWidth;
    let height = 23;
    let x = (global.screenWidth - len) / 2;
    let y = global.screenHeight - spacing - height - 1;
    ctx.lineWidth = 1;

    // Draw the exp bar
    drawBar(x, x + len, y + height / 2, height + settings.graphical.barChunk, color.black);
    drawBar(x, x + len, y + height / 2, height - settings.graphical.barChunk / 4, color.grey);
    drawBar(x, x + len * gui.__s.getProgress(), y + height / 2, height - 2, color.gold);

    // Draw the class type
    drawText("Level " + gui.__s.getLevel() + " " + gui.class, x + len / 2, y + height / 2 + 1, height - 2.5, color.guiwhite, "center", true);
    height = 16;
    y -= height + vspacing;

    // Draw the %-of-leader bar
    drawBar(x + len * 0.1, x + len * 0.9, y + height / 2, height - 3 + settings.graphical.barChunk, color.black);
    drawBar(x + len * 0.1, x + len * 0.9, y + height / 2, height - 3 - settings.graphical.barChunk / 4, color.grey);
    drawBar(x + len * 0.1, x + len * (0.1 + 0.8 * (max ? Math.min(1, gui.__s.getScore() / max) : 1)), y + height / 2, height - 3 - settings.graphical.barChunk / 4, color.green);

    //write the score and name
    drawText("Score: " + util.formatLargeNumber(Math.round(gui.__s.getScore())), x + len / 2, y + height / 2 + 1, height - 3.5, color.guiwhite, "center", true);
    ctx.lineWidth = 4;
    drawText(global.player.name, Math.round(x + len / 2) + 0.5, Math.round(y - 10 - vspacing) + 0.5, 32, global.nameColor = "#ffffff" ? color.guiwhite : global.nameColor, "center");
}
function drawMinimapAndDebug(spacing, alcoveSize, GRAPHDATA) {
    // Draw minimap and FPS monitors
    //minimap stuff starts here
    let orangeColor = false;
    let len = alcoveSize; // * global.screenWidth;
    let height = (len / global.gameWidth) * global.gameHeight;
    if (global.gameHeight > global.gameWidth || global.gameHeight < global.gameWidth) {
        let ratio = [
            global.gameWidth / global.gameHeight,
            global.gameHeight / global.gameWidth,
        ];
        len /= ratio[1] * 1.5;
        height /= ratio[1] * 1.5;
        if (len > alcoveSize * 2) {
            ratio = len / (alcoveSize * 2);
        } else if (height > alcoveSize * 2) {
            ratio = height / (alcoveSize * 2);
        } else {
            ratio = 1;
        }
        len /= ratio;
        height /= ratio;
    }
    let upgradeColumns = Math.ceil(gui.upgrades.length / 9);
    let x = global.mobile ? spacing : global.screenWidth - spacing - len;
    let y = global.mobile ? spacing : global.screenHeight - height - spacing;
    if (global.mobile) {
      y += global.canUpgrade ? (alcoveSize / 1.5) * mobileUpgradeGlide.get() * upgradeColumns / 1.5 + spacing * (upgradeColumns + 1.55) + 9 : 0;
      y += global.canSkill || global.showSkill ? statMenu.get() * alcoveSize / 2.6 + spacing / 0.75 : 0;
    }
    ctx.globalAlpha = 0.4;
    let W = global.roomSetup[0].length,
        H = global.roomSetup.length,
        i = 0;
    for (let ycell = 0; ycell < H; ycell++) {
        let row = global.roomSetup[ycell];
        let j = 0;
        for (let xcell = 0; xcell < W; xcell++) {
            let cell = global.roomSetup[ycell][xcell];

            if (cell.includes('none')) {
                cell = cell.split(' ');
                cell.shift();
                cell.unshift('pureBlack');
                cell = cell.join(' ');
            }

            ctx.fillStyle = gameDraw.modifyColor(cell);
            if (gameDraw.modifyColor(cell) !== color.white) {
                drawGuiRect(x + (j * len) / W, y + (i * height) / H, len / W, height / H);
            }
            j++;
        }
        i++;
    }
    ctx.fillStyle = color.white;
    drawGuiRect(x, y, len, height);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.fillStyle = color.black;
    drawGuiRect(x, y, len, height, true); // Border
    for (let entity of minimap.get()) {
        ctx.fillStyle = gameDraw.mixColors(gameDraw.modifyColor(entity.color), color.black, 0.3);
        ctx.globalAlpha = entity.alpha;
        switch (entity.type) {
            case 2:
                let trueSize = (entity.size + 2) / 1.1283791671; // lazyRealSizes[4] / sqrt(2)
                drawGuiRect(x + ((entity.x - trueSize) / global.gameWidth) * len - 0.4, y + ((entity.y - trueSize) / global.gameHeight) * height - 1, ((2 * trueSize) / global.gameWidth) * len + 0.2, ((2 * trueSize) / global.gameWidth) * len + 0.2);
                break;
            case 1:
                drawGuiCircle(x + (entity.x / global.gameWidth) * len, y + (entity.y / global.gameHeight) * height, (entity.size / global.gameWidth) * len + 0.2);
                break;
            case 0:
                if (entity.id !== gui.playerid) drawGuiCircle(x + (entity.x / global.gameWidth) * len, y + (entity.y / global.gameHeight) * height, !global.mobile ? 2 : 3.5);
                break;
        }
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = color.guiblack;
    ctx.fillStyle = color.guiblack;
    drawGuiCircle(x + (global.player.cx / global.gameWidth) * len - 0, y + (global.player.cy / global.gameHeight) * height - 1, !global.mobile ? 2 : 3.5, false);
    if (global.mobile) {
        x = global.screenWidth - spacing - len;
        y = global.screenHeight - spacing;
    }
    if (global.showDebug) {
        drawGuiRect(x, y - 40, len, 30);
        lagGraph(lag.get(), x, y - 40, len, 30, color.teal);
        gapGraph(global.metrics.rendergap, x, y - 40, len, 30, color.pink);
        timingGraph(GRAPHDATA, x, y - 40, len, 30, color.yellow);
    }
    //minimap stuff ends here
    //debug stuff
    if (!global.showDebug) y += 14 * 3;
    if ((100 * gui.fps).toFixed(2) < 100) orangeColor = true;
    if (global.metrics.rendertime < 10) orangeColor = true;
    // Text
    if (global.showDebug) {
        drawText("Open Source Arras", x + len, y - 50 - 5 * 14 - 2, 15, "#1081E5", "right");
        drawText("Prediction: " + Math.round(GRAPHDATA) + "ms : " + global.mspt + " mspt", x + len, y - 50 - 4 * 14, 10, color.guiwhite, "right");
        // drawText(`Bandwidth: ${gui.bandwidth.in} in, ${gui.bandwidth.out} out`, x + len, y - 50 - 3 * 14, 10, color.guiwhite, "right");
        drawText("Memory: " + global.metrics.rendergap.toFixed(1) + " Mib : " + "Class: " + gui.class, x + len, y - 50 - 3 * 14, 10, color.guiwhite, "right");
        drawText("Update Rate: " + global.metrics.updatetime + "Hz", x + len, y - 50 - 2 * 14, 10, color.guiwhite, "right");
        drawText("Server Speed: " + (100 * gui.fps).toFixed(2) + "% : Client Speed: " + global.metrics.rendertime + " FPS", x + len, y - 50 - 1 * 14, 10, orangeColor ? color.orange : color.guiwhite, "right");
        drawText(global.metrics.latency + " ms - " + global.serverName, x + len, y - 50, 10, color.guiwhite, "right");
    } else if (!global.GUIStatus.minimapReducedInfo) {
        drawText("Open Source Arras", x + len, y - 50 - 2 * 14 - 2, 15, "#1081E5", "right");
        drawText((100 * gui.fps).toFixed(2) + "% : " + global.metrics.rendertime + " FPS", x + len, y - 50 - 1 * 14, 10, orangeColor ? color.orange : color.guiwhite, "right");
        drawText(global.metrics.latency + " ms : " + global.metrics.updatetime + "Hz", x + len, y - 50, 10, color.guiwhite, "right");
    } else drawText("Open Source Arras", x + len, y - 22 - 2 * 14 - 2, 15, "#1081E5", "right");
}

function drawLeaderboard(spacing, alcoveSize, max) {
    // Draw leaderboard
    let lb = leaderboard.get();
    let vspacing = 4;
    let len = alcoveSize; // * global.screenWidth;
    let height = 14;
    let x = global.screenWidth - len - spacing;
    let y = spacing + height + 7;
    if (!lb.data.length) return;

    // Animation things
    let mobileGlide = mobileUpgradeGlide.get();
    if (global.mobile) {
        if (global.canUpgrade) {
            y += (alcoveSize / 1.4) * mobileGlide;
        }
        y += global.canSkill || global.showSkill ? (alcoveSize / 2.2 /*+ spacing * 2*/) * statMenu.get() : 0;
    }

    drawText("Leaderboard", Math.round(x + len / 2) + 0.5, Math.round(y - 6) + 0.5, height + 3.5, color.guiwhite, "center");
    y += 7;
    for (let i = 0; i < lb.data.length; i++) {
        let entry = lb.data[i];
        drawBar(x, x + len, y + height / 2, height - 3 + settings.graphical.barChunk, color.black);
        drawBar(x, x + len, y + height / 2, height - 3, color.grey);
        let shift = Math.min(1, entry.score / max);
        drawBar(x, x + len * shift, y + height / 2, height - 3.5, gameDraw.modifyColor(entry.barColor));
        // Leadboard name + score
        let nameColor = entry.nameColor || "#FFFFFF";
        drawText(entry.label + (": " + util.handleLargeNumber(Math.round(entry.score))), x + len / 2, y + height / 2, height - 5, nameColor == "#ffffff" ? color.guiwhite : nameColor, "center", true);
        // Mini-image
        let scale = height / entry.position.axis,
            xx = x - 1.5 * height - scale * entry.position.middle.x * Math.SQRT1_2,
            yy = y + 0.5 * height - scale * entry.position.middle.y * Math.SQRT1_2,
            baseColor = entry.color;
        drawEntity(baseColor, xx, yy, entry.image, 1 / scale, 1, (scale * scale) / entry.image.size, 1, -Math.PI / 4, true);
        // Move down
        y += vspacing + height;
    }
}

function drawAvailableUpgrades(spacing, alcoveSize) {
    // Draw upgrade menu
    if (gui.upgrades.length > 0) {
        let internalSpacing = 15;
        let len = alcoveSize / 2;
        let height = len;

        // Animation processing
        global.columnCount = Math.max(global.mobile ? 9 : 3, Math.floor(gui.upgrades.length ** 0.55));
        upgradeMenu.set(0);
        if (!global.canUpgrade) {
            upgradeMenu.force(-global.columnCount * 3)
            global.canUpgrade = true;
        }
        let glide = upgradeMenu.get();

        let x = glide * 2 * spacing + spacing;
        let y = spacing - height - 2.5 * internalSpacing;
        let xStart = x;
        let initialX = x;
        let rowWidth = 0;
        let initialY = y;
        let ticker = 0;
        let upgradeNum = 0;
        let colorIndex = 0;
        let clickableRatio = global.canvas.height / global.screenHeight / global.ratio;
        let lastBranch = -1;
        let upgradeHoverIndex = global.clickables.upgrade.check({ x: global.mouse.x, y: global.mouse.y });
        upgradeSpin += 0.01;

        for (let i = 0; i < gui.upgrades.length; i++) {
            let upgrade = gui.upgrades[i];
            let upgradeBranch = upgrade[0];
            let upgradeBranchLabel = upgrade[1] == "undefined" ? "" : upgrade[1];
            let model = upgrade[2];

            // Draw either in the next row or next column
            if (ticker === global.columnCount || upgradeBranch != lastBranch) {
                x = xStart;
                y += height + internalSpacing;
                if (upgradeBranch != lastBranch) {
                    if (upgradeBranchLabel.length > 0) {
                        drawText(" " + upgradeBranchLabel, xStart, y + internalSpacing * 2, internalSpacing * 2.3, color.guiwhite, "left", false);
                        y += 1.5 * internalSpacing;
                    }
                    y += 1.5 * internalSpacing;
                    colorIndex = 0;
                }
                lastBranch = upgradeBranch;
                ticker = 0;
            } else {
                x += len + internalSpacing;
            }

            if (y > initialY) initialY = y;
            rowWidth = x;

            global.clickables.upgrade.place(i, x * clickableRatio, y * clickableRatio, len * clickableRatio, height * clickableRatio);
            let upgradeKey = getClassUpgradeKey(upgradeNum);

            drawEntityIcon(model, x, y, len, height, 1, upgradeSpin, 0.6, colorIndex++, !global.mobile ? upgradeKey : false, !global.mobile ? upgradeNum == upgradeHoverIndex : false);

            ticker++;
            upgradeNum++;
        }

        // Draw dont upgrade button
        let h = 16,
            textScale = h - 6,
            msg = "Don't Upgrade",
            m = measureText(msg, textScale) + 10;
        let buttonX = initialX + (rowWidth + len - initialX) / 2,
            buttonY = initialY + height + internalSpacing;
        drawBar(buttonX - m / 2, buttonX + m / 2, buttonY + h / 2, h + settings.graphical.barChunk, color.black);
        drawBar(buttonX - m / 2, buttonX + m / 2, buttonY + h / 2, h, color.white);
        drawText(msg, buttonX, buttonY + h / 2, textScale, color.guiwhite, "center", true);
        global.clickables.skipUpgrades.place(0, (buttonX - m / 2) * clickableRatio, buttonY * clickableRatio, m * clickableRatio, h * clickableRatio);

        // Upgrade tooltip
        if (upgradeHoverIndex > -1 && upgradeHoverIndex < gui.upgrades.length && !global.mobile) {
            let picture = gui.upgrades[upgradeHoverIndex][2];
            if (picture.upgradeTooltip.length > 0) {
                let boxWidth = measureText(picture.name, alcoveSize / 10),
                    boxX = global.mouse.x * global.screenWidth / window.canvas.width + 2,
                    boxY = global.mouse.y * global.screenHeight / window.canvas.height + 2,
                    boxPadding = 6,
                    splitTooltip = picture.upgradeTooltip.split("\n"),
                    textY = boxY + boxPadding + alcoveSize / 10;

                // Tooltip box width
                for (let line of splitTooltip) boxWidth = Math.max(boxWidth, measureText(line, alcoveSize / 15));

                // Draw tooltip box
                gameDraw.setColor(ctx, color.dgrey);
                ctx.lineWidth /= 1.5;
                drawGuiRect(boxX, boxY, boxWidth + boxPadding * 3, alcoveSize * (splitTooltip.length + 1) / 10 + boxPadding * 3, false);
                drawGuiRect(boxX, boxY, boxWidth + boxPadding * 3, alcoveSize * (splitTooltip.length + 1) / 10 + boxPadding * 3, true);
                ctx.lineWidth *= 1.5;
                drawText(picture.name, boxX + boxPadding * 1.5, textY, alcoveSize / 10, color.guiwhite);
                for (let t of splitTooltip) {
                    textY += boxPadding + alcoveSize / 15
                    drawText(t, boxX + boxPadding * 1.5, textY, alcoveSize / 15, color.guiwhite);
                }
            }
        }
    } else {
        global.canUpgrade = false;
        upgradeMenu.force(0);
        global.clickables.upgrade.hide();
        global.clickables.skipUpgrades.hide();
    }
}
// MOBILE UI FUNCTIONS
function drawMobileJoysticks() {
    // Draw the joysticks.
    let radius = Math.min(
        global.mobileStatus.useBigJoysticks ? global.screenWidth * 0.8 : global.screenWidth * 0.6,
        global.mobileStatus.useBigJoysticks ? global.screenHeight * 0.16 : global.screenHeight * 0.12
    );
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(
        (global.screenWidth * 1) / 6,
        (global.screenHeight * 2) / 3,
        radius,
        0,
        2 * Math.PI
    );
    ctx.arc(
        (global.screenWidth * 5) / 6,
        (global.screenHeight * 2) / 3,
        radius,
        0,
        2 * Math.PI
    );
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (global.mobileStatus.showJoysticks) {
        ctx.arc(
            canvas.movementTouchPos.x + (global.screenWidth * 1) / 6,
            canvas.movementTouchPos.y + (global.screenHeight * 2) / 3,
            radius / 2.5,
            0,
            2 * Math.PI
        );
        ctx.arc(
            canvas.controlTouchPos.x + (global.screenWidth * 5) / 6,
            canvas.controlTouchPos.y + (global.screenHeight * 2) / 3,
            radius / 2.5,
            0,
            2 * Math.PI
        );
    }
    ctx.fill();
    // crosshair
    if (global.mobileStatus.showCrosshair && global.mobileStatus.enableCrosshair) {
        const crosshairpos = {
            x: global.screenWidth / 2 + global.player.target.x,
            y: global.screenHeight / 2 + global.player.target.y
        };
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#202020"
        ctx.beginPath();
        ctx.moveTo(crosshairpos.x, crosshairpos.y - 20);
        ctx.lineTo(crosshairpos.x, crosshairpos.y + 20);
        ctx.moveTo(crosshairpos.x - 20, crosshairpos.y);
        ctx.lineTo(crosshairpos.x + 20, crosshairpos.y);
        ctx.closePath();
        ctx.stroke();
    }
}

function makeButton(index, x, y, width, height, text, clickableRatio) {
    // Set the clickable's position
    global.clickables.mobileButtons.place(index, x * clickableRatio, y * clickableRatio, width * clickableRatio, height * clickableRatio);

    // Draw boxes
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color.grey;
    drawGuiRect(x, y, width, height);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = color.black;
    drawGuiRect(x, y + height * 0.6, width, height * 0.4);
    ctx.globalAlpha = 1;

    // Draw text
    drawText(text, x + width / 2, y + height * 0.5, height * 0.6, color.guiwhite, "center", true);

    // Draw the borders
    ctx.strokeStyle = color.black;
    ctx.lineWidth = 3;
    drawGuiRect(x, y, width, height, true);
}

function makeButtons(buttons, startX, startY, baseSize, clickableRatio, spacing) {
    let x = startX, y = startY, index = 0;

    for (let row = 0; row < buttons.length; row++) {
        for (let col = 0; col < buttons[row].length; col++) {
            makeButton(buttons[row][col][3] ?? index, x, y, baseSize * (buttons[row][col][1] ?? 1), baseSize * (buttons[row][col][2] ?? 1), buttons[row][col][0], clickableRatio);
            x += baseSize * (buttons[row][col][1] ?? 1) + spacing;
            index++;
        }

        x = startX;
        y += Math.max(...buttons[row].map(b => baseSize * (b[2] ?? 1))) + spacing;
    }
}

function drawMobileButtons(spacing, alcoveSize) {
    if (global.clickables.mobileButtons.active == null) global.clickables.mobileButtons.active = false;
    if (global.clickables.mobileButtons.altFire == null) global.clickables.mobileButtons.altFire = false;

    // Hide the buttons
    global.clickables.mobileButtons.hide();

    // Some animations.
    mobileUpgradeGlide.set(0 + (global.canUpgrade || global.upgradeHover));

    // Some sizing variables
    let clickableRatio = global.canvas.height / global.screenHeight / global.ratio;
    let upgradeColumns = Math.ceil(gui.upgrades.length / 9);
    let yOffset = 0;
    if (global.mobile) {
      yOffset += global.canUpgrade ? (alcoveSize / 1.5 /*+ spacing * 2*/) * mobileUpgradeGlide.get() * upgradeColumns / 1.5 + spacing * (upgradeColumns + 1.55) + -17.5 : 0;
      yOffset += global.canSkill || global.showSkill ? statMenu.get() * alcoveSize / 2.6 + spacing / 0.75 : 0;
    }
    let buttons;
    let baseSize = (alcoveSize - spacing * 2) / 3;

    if (global.mobile) {
        buttons = global.clickables.mobileButtons.active ? [
            [[global.clickables.mobileButtons.active ? "-" : "+"], [`Alt ${global.clickables.mobileButtons.altFire ? "Manual" : "Disabled"}`, 6], [`${!document.fullscreenElement ? "Full" : "Exit Full"} Screen`, 5]],
            [["Autofire", 3.5], ["Reverse", 3.5], ["Self-Destruct", 5]],
            [["Autospin", 3.5], ["Override", 3.5], ["Level Up", 5]],
            [["Action", 3.5], ["Special", 3.5], ["Chat", 5]],
        ] : [
            [[global.clickables.mobileButtons.active ? "-" : "+"]],
        ];
    }
    if (global.clickables.mobileButtons.altFire) buttons.push([["\u2756", 2, 2]]);

    let len = alcoveSize;
    let height = (len / global.gameWidth) * global.gameHeight;
    if (global.gameHeight > global.gameWidth || global.gameHeight < global.gameWidth) {
        let ratio = [
            global.gameWidth / global.gameHeight,
            global.gameHeight / global.gameWidth,
        ];
        len /= ratio[1] * 1.5;
        height /= ratio[1] * 1.5;
        if (len > alcoveSize * 2) {
            ratio = len / (alcoveSize * 2);
       } else if (height > alcoveSize * 2) {
            ratio = height / (alcoveSize * 2);
        } else {
            ratio = 1;
        }
        len /= ratio;
        height /= ratio;
   }
    makeButtons(buttons, len + spacing * 2, yOffset + spacing, baseSize, clickableRatio, spacing);
}
const gameDrawAlive = (ratio, drawRatio) => {
    let GRAPHDATA = 0;
    // Prep stuff
    renderTimes++;
    // Move the camera
    let motion = compensation();
    motion.set();
    let smear = { x: 0, y: 0 };
    GRAPHDATA = motion.getPrediction();
    // Don't move the camera if you're dead. This helps with jitter issues
    global.player.renderx = util.lerp(global.player.renderx, global.player.cx, 0.1, true);
    global.player.rendery = util.lerp(global.player.rendery, global.player.cy, 0.1, true);
    let px = ratio * global.player.renderx,
        py = ratio * global.player.rendery;

    // Get the player's target
    if (!global.mobile) calculateTarget();

    //draw the in game stuff
    drawFloor(px, py, ratio);
    drawEntities(px, py, ratio);
    ratio = util.getScreenRatio();
    scaleScreenRatio(ratio, true);

    //draw hud
    let alcoveSize = 200 / ratio; // drawRatio * global.screenWidth;
    let spacing = 20;
    gui.__s.update();
    let lb = leaderboard.get();
    let max = lb.max;
    global.canSkill = !!gui.points && !global.showTree;
    global.fps = global.metrics.rendertime;
    if (global.showTree) {
        drawUpgradeTree(spacing, alcoveSize);
    } else {
        if (global.mobile) { // MOBILE UI
            drawMobileJoysticks();
            drawMobileButtons(spacing, alcoveSize);
        }
        if (global.GUIStatus.renderGUI) {
            drawMessages(spacing, alcoveSize);
            drawSkillBars(spacing, alcoveSize);
            drawSelfInfo(spacing, alcoveSize, max);
            drawMinimapAndDebug(spacing, alcoveSize, GRAPHDATA);
            if (global.GUIStatus.renderLeaderboard) drawLeaderboard(spacing, alcoveSize, max, lb);
            drawAvailableUpgrades(spacing, alcoveSize);
        } else drawAvailableUpgrades(spacing, alcoveSize);
    }
    global.metrics.lastrender = getNow();
};
let getKills = () => {
    let finalKills = {
        " kills": [Math.round(global.finalKills[0].get()), 1],
        " assists": [Math.round(global.finalKills[1].get()), 0.5],
        " visitors defeated": [Math.round(global.finalKills[2].get()), 3],
        " polygons destroyed": [Math.round(global.finalKills[3].get()), 0.05],
    }, killCountTexts = [];
    let destruction = 0;
    for (let key in finalKills) {
        if (finalKills[key][0]) {
            destruction += finalKills[key][0] * finalKills[key][1];
            killCountTexts.push(finalKills[key][0] + key);
        }
    }
    return (
        (destruction === 0 ? "🌼"
        : destruction < 4 ? "🎯"
        : destruction < 8 ? "💥"
        : destruction < 15 ? "💢"
        : destruction < 25 ? "🔥"
        : destruction < 50 ? "💣"
        : destruction < 75 ? "👺"
        : destruction < 100 ? "🌶️" : "💯"
        ) + " " + (!killCountTexts.length ? "A true pacifist" :
            killCountTexts.length == 1 ? killCountTexts.join(" and ") :
                killCountTexts.slice(0, -1).join(", ") + " and " + killCountTexts[killCountTexts.length - 1])
    );
};
let getDeath = () => {
    let txt = "";
    if (global.finalKillers.length) {
        txt = "🔪 Succumbed to";
        for (let e of global.finalKillers) {
            txt += " " + util.addArticle(util.getEntityImageFromMockup(e).name) + " and";
        }
        txt = txt.slice(0, -4);
    } else {
        txt += "🤷 Well that was kinda dumb huh";
    }
    return txt;
};
let getTips = () => {
    let txt = "❓ ";
    if (global.finalKillers.length) {
        txt += "lol you died";
    } else if (!global.autolvlUp) {
        txt += "Enable auto-level up in the options menu to get level 45";
    } else {
        txt += "Kill players and polygons to get more score";
    }
    return txt;
};
const gameDrawDead = () => {
    clearScreen(color.black, 0.25);
    let ratio = util.getScreenRatio();
    scaleScreenRatio(ratio, true);
    let shift = animations.deathScreen.get();
    ctx.translate(0, -shift * global.screenHeight);
    let x = global.screenWidth / 2,
        y = global.screenHeight / 2 - 50,
        len = 140,
        position = global.mockups[parseInt(gui.type.split("-")[0])].position,
        scale = len / position.axis,
        xx = global.screenWidth / 2 - scale * position.middle.x * 0.707,
        yy = global.screenHeight / 2 - 35 + scale * position.middle.y * 0.707,
        picture = util.getEntityImageFromMockup(gui.type, gui.color),
        baseColor = picture.color,
        timestamp = Math.floor(Date.now() /1000);
    drawEntity(baseColor, (xx - 190 - len / 2 + 0.5) | 0, (yy - 10 + 0.5) | 0, picture, 1.5, 1, (0.5 * scale) / picture.realSize, 1, -Math.PI / 4, true);
    drawText("Level " + gui.__s.getLevel(), x - 275, y - -80, 14, color.guiwhite, "center");
    drawText(picture.name, x - 275, y - -110, 24, color.guiwhite, "center");
    drawText(timestamp + '', x, y - 80, 10, color.guiwhite, "center");
    if (global.player.name == "") {
        drawText("Your Score: ", x - 170, y - 30, 24, color.guiwhite);
    } else {
        drawText(global.player.name + "'s Score: ", x - 170, y - 30, 24, color.guiwhite);
    }
    drawText(util.formatLargeNumber(Math.round(global.finalScore.get())), x - 170, y + 25, 50, color.guiwhite);
    drawText("⌚ Survived for " + util.timeForHumans(Math.round(global.finalLifetime.get())), x - 170, y + 55, 16, color.guiwhite);
    drawText(getKills(), x - 170, y + 77, 16, color.guiwhite);
    drawText(getDeath(), x - 170, y + 99, 16, color.guiwhite);
    drawText(getTips(), x - 170, y + 122, 16, color.guiwhite);
    drawText("🦆 The server was " + +(100 * gui.fps).toFixed(0) + "%" + " active", x - 170, y + 144, 16, color.guiwhite);
    drawText(global.cannotRespawn ? global.respawnTimeout ? "(" + global.respawnTimeout + " Secon" + `${global.respawnTimeout <= 1 ? 'd' : 'ds'} ` + "left to respawn)" : "(you cannot respawn!)" : global.mobile ? "(tap to respawn)" : "(press enter to respawn)", x, y + 189, 16, color.guiwhite, "center");
    ctx.translate(0, shift * global.screenHeight);
};
const gameDrawOldDead = () => {
    clearScreen(color.black, 0.25);
    let ratio = util.getScreenRatio();
    scaleScreenRatio(ratio, true);
    let shift = global.enableSlideAnimation ? animations.deathScreen.get() : animations.deathScreen.getNoLerp();
    ctx.translate(0, -shift * global.screenHeight);
    let x = global.screenWidth / 2,
        y = global.screenHeight / 2 - 50;
    let len = 140,
        position = global.mockups[parseInt(gui.type.split("-")[0])].position,
        scale = len / position.axis,
        xx = global.screenWidth / 2 - scale * position.middle.x * 0.707,
        yy = global.screenHeight / 2 - 35 + scale * position.middle.y * 0.707,
        picture = util.getEntityImageFromMockup(gui.type, gui.color),
        baseColor = picture.color;
    drawEntity(baseColor, (xx - 190 - len / 2 + 0.5) | 0, (yy - 10 + 0.5) | 0, picture, 1.5, 1, (0.5 * scale) / picture.realSize, 1, -Math.PI / 4, true);
    drawText("You died!", x, y - 80, 16, color.guiwhite, "center");
    drawText("Level " + gui.__s.getLevel() + " " + picture.name, x - 170, y - 30, 24, color.guiwhite);
    drawText("Final score: " + util.formatLargeNumber(Math.round(global.finalScore.get())), x - 170, y + 25, 50, color.guiwhite);
    drawText("⌚ Survived for " + util.timeForHumans(Math.round(global.finalLifetime.get())), x - 170, y + 55, 16, color.guiwhite);
    drawText(getKills(), x - 170, y + 77, 16, color.guiwhite);
    drawText(getDeath(), x - 170, y + 99, 16, color.guiwhite);
    drawText("(press enter to respawn)", x, y + 125, 16, color.guiwhite, "center");
    ctx.translate(0, shift * global.screenHeight);
};
const gameDrawBeforeStart = () => {
    let ratio = util.getScreenRatio();
    scaleScreenRatio(ratio, true);
    clearScreen(color.white, 0.5);
    let shift = global.enableSlideAnimation ? animations.connecting.get() : animations.connecting.getNoLerp();
    ctx.translate(0, -shift * global.screenHeight);
    drawText("Connecting...", global.screenWidth / 2, global.screenHeight / 2, 30, color.guiwhite, "center");
    drawText(global.message, global.screenWidth / 2, global.screenHeight / 2 + 30, 15, color.lgreen, "center");
    drawText(global.tips, global.screenWidth / 2, global.screenHeight / 2 + 90, 15, color.guiwhite, "center");
    ctx.translate(0, shift * global.screenHeight);
};
const gameDrawDisconnected = () => {
    let ratio = util.getScreenRatio();
    scaleScreenRatio(ratio, true);
    clearScreen(gameDraw.mixColors(color.red, color.guiblack, 0.3), 0.25);
    let shift = global.enableSlideAnimation ? animations.disconnected.get() : animations.disconnected.getNoLerp();
    ctx.translate(0, -shift * global.screenHeight);
    drawText("Disconnected", global.screenWidth / 2, global.screenHeight / 2, 30, color.guiwhite, "center");
    drawText(global.message, global.screenWidth / 2, global.screenHeight / 2 + 30, 15, color.orange, "center");
    ctx.translate(0, shift * global.screenHeight);
};
const gameDrawError = () => {
    let ratio = util.getScreenRatio();
    scaleScreenRatio(ratio, true);
    clearScreen(gameDraw.mixColors(color.red, color.guiblack, 0.2), 0.35);
    let shift = global.enableSlideAnimation ? animations.error.get() : animations.error.getNoLerp();
    ctx.translate(0, -shift * global.screenHeight);
    drawText("There has been an error!", global.screenWidth / 2, global.screenHeight / 2 - 50, 50, color.guiwhite, "center");
    drawText("Check the browser console for details.", global.screenWidth / 2, global.screenHeight / 2, 30, color.guiwhite, "center");
    drawText(global.message, global.screenWidth / 2, global.screenHeight / 2 + 30, 15, color.orange, "center");
    ctx.translate(0, shift * global.screenHeight);
};
// The main function
function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameDraw.reanimateColors();
    global.player.renderv += (global.player.view - global.player.renderv) / 10;
    var ratio = settings.graphical.screenshotMode ? 2 : util.getRatio();
    // Set the drawing style
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Draw the game
    if (global.gameStart && !global.disconnected) {
        global.time = getNow();
        if (global.time - lastPing > 1000) {
            // Latency
            // Do ping.
            global.socket.ping(global.time);
            lastPing = global.time;
            // Do rendering speed.
            global.metrics.rendertime = renderTimes;
            renderTimes = 0;
            // Do update rate.
            global.metrics.updatetime = global.updateTimes;
            global.updateTimes = 0;
        }
        global.metrics.lag = global.time - global.player.time;
    }
    ctx.translate(0.5, 0.5);
    try {
        if (global.gameStart) {
            gameDrawAlive(ratio, util.getScreenRatio());
        } else if (!global.disconnected) {
            gameDrawBeforeStart();
        }
        if (global.died) { // Womp Womp you died
            gameDrawDead();
        }
        if (global.disconnected) { // Draw disconnection screen if the client lost connection to the server.
            gameDrawDisconnected();
        }
        ctx.translate(-0.5, -0.5);

        //oh no we need to throw an error!
    } catch (e) {

        //hold on....
        gameDrawError(); // Draw the error screen.
        ctx.translate(-0.5, -0.5);

        //okay, NOW throw the error!
        throw e;
    }
}

})(util, global, settings, Canvas, color, gameDraw, socketStuff);

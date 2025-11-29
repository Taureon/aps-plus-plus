
import { settings } from "./settings.js";
import { gui } from "./socketInit.js";

var gameDraw = {
    color: null,
    /** https://gist.github.com/jedfoster/7939513 **/
    decimal2hex: (d) => {
        return d.toString(16);
    }, // convert a decimal value to hex
    hex2decimal: (h) => {
        return parseInt(h, 16);
    }, // convert a hex value to decimal
    mixColors: (function () {
        const mixCache = new Map();
        const intCache = new Map();
        return function mixColor(hex1, hex2, mix = 0.5) {
            let c1 = intCache.get(hex1);
            if (c1 === undefined) {
                c1 = parseInt(hex1.slice(1), 16);
                intCache.set(hex1, c1);
            }
            let c2 = intCache.get(hex2);
            if (c2 === undefined) {
                c2 = parseInt(hex2.slice(1), 16);
                intCache.set(hex2, c2);
            }
            const key = c1 * (1 << 29) + c2 * (1 << 5) + Math.round(mix * 31);
            if (mixCache.has(key)) {
                return mixCache.get(key);
            }
            const r1 = (c1 >> 16) & 0xFF;
            const g1 = (c1 >> 8) & 0xFF;
            const b1 = c1 & 0xFF;
            const result = ((1 << 24) | (((r1 + (((c2 >> 16) & 0xFF) - r1) * mix) | 0) << 16) | (((g1 + (((c2 >> 8) & 0xFF) - g1) * mix) | 0) << 8) | ((b1 + ((c2 & 0xFF) - b1) * mix) | 0));
            const hex = '#' + (result & 0xFFFFFF).toString(16).padStart(6, '0');
            mixCache.set(key, hex);
            return hex;
        }
    })(),
    hslToRgb: (h, s, l) => {
        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = gameDraw.hueToRgb(p, q, h + 1 / 3);
            g = gameDraw.hueToRgb(p, q, h);
            b = gameDraw.hueToRgb(p, q, h - 1 / 3);
        }
        return '#' +
            Math.round(r * 255).toString(16).padStart(2, '0') +
            Math.round(g * 255).toString(16).padStart(2, '0') +
            Math.round(b * 255).toString(16).padStart(2, '0');
    },
    rgbToHsl: (rgb) => {
        let r, g, b, h, s, l;

        r = parseInt(rgb.substring(1, 3), 16) / 255;
        g = parseInt(rgb.substring(3, 5), 16) / 255;
        b = parseInt(rgb.substring(5, 7), 16) / 255;

        let cmax = Math.max(r, g, b);
        let cmin = Math.min(r, g, b);
        let deltaC = cmax - cmin;

        // Hue
        switch (true) {
            case deltaC == 0:
                h = 0;
                break;
            case cmax == r:
                h = 1 / 6 * (((g - b) / deltaC) % 6);
                break;
            case cmax == g:
                h = 1 / 6 * ((b - r) / deltaC + 2);
                break;
            case cmax == b:
                h = 1 / 6 * ((r - g) / deltaC + 4);
                break;
        }
        // Brightness
        l = (cmax + cmin) / 2
        // Saturation
        if (deltaC == 0)
            s = 0;
        else
            s = deltaC / (1 - Math.abs(2 * l - 1));

        return [h, s, l];
    },
    hueToRgb: (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 0.166) return p + (q - p) * 6 * t;
        if (t < 0.5) return q;
        if (t < 0.666) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    },
    clamp: (n, lower, upper) => {
        return Math.min(upper, Math.max(lower, n));
    },
    //TODO: somehow move the calculation to these in reanimateColors to improve performance
    colorCache: {},
    modifyColor: (color, base = "16 0 1 0 false") => {
        // Split into array
        let colorDetails = color.split(" "),
            baseDetails = base.split(" ");

        // Color mirroring
        if (colorDetails[0] == "-1" || colorDetails[0] == "mirror") {
            colorDetails[0] = baseDetails[0];
        }
        if (colorDetails[0] == "-1" || colorDetails[0] == "mirror") {
            colorDetails[0] = gui.color.split(" ")[0];
        }

        // Exit if calculated already
        let colorId = colorDetails.join(' ');
        let cachedColor = gameDraw.colorCache[colorId];
        if (cachedColor != undefined) return cachedColor;

        // Get HSL values
        let baseColor = gameDraw.rgbToHsl(gameDraw.getColor(colorDetails[0]) ?? colorDetails[0]);

        // Get color config
        let hueShift = parseFloat(colorDetails[1]) / 360,
            saturationShift = parseFloat(colorDetails[2]),
            brightnessShift = parseFloat(colorDetails[3]) / 100,
            allowBrightnessInvert = colorDetails[4] == 'true';

        // Apply config
        let finalHue = (baseColor[0] + hueShift) % 1,
            finalSaturation = gameDraw.clamp(baseColor[1] * saturationShift, 0, 1),
            finalBrightness = baseColor[2] + brightnessShift;

        if (allowBrightnessInvert && (finalBrightness > 1 || finalBrightness < 0)) {
            finalBrightness -= brightnessShift * 2;
        }
        finalBrightness = gameDraw.clamp(finalBrightness, 0, 1);

        // Gaming.
        let finalColor = gameDraw.hslToRgb(finalHue, finalSaturation, finalBrightness);
        if (!gameDraw.animatedColors[colorDetails[0]]) gameDraw.colorCache[colorId] = finalColor;
        return finalColor;
    },
    getRainbow: (a, b, c = 0.5) => {
        if (0 >= c) return a;
        if (1 <= c) return b;
        let f = 1 - c;
        a = parseInt(a.slice(1, 7), 16);
        b = parseInt(b.slice(1, 7), 16);
        return (
            "#" +
            (
                (((a & 0xff0000) * f + (b & 0xff0000) * c) & 0xff0000) |
                (((a & 0x00ff00) * f + (b & 0x00ff00) * c) & 0x00ff00) |
                (((a & 0x0000ff) * f + (b & 0x0000ff) * c) & 0x0000ff)
            )
                .toString(16)
                .padStart(6, "0")
        );
    },
    animatedColor: {
        lesbian: "",
        gay: "",
        bi: "",
        trans: "",
        magenta: "",
        blue_red: "",
        blue_grey: "",
        grey_blue: "",
        red_grey: "",
        grey_red: ""
    },
    reanimateColors: () => {
        let now = Date.now(),

            //six_gradient = Math.floor((now / 200) % 6),
            five_bars = Math.floor((now % 2000) / 400),
            three_bars = Math.floor((now % 2000) * 3 / 2000),
            blinker = 150 > now % 300,

            lesbian_magenta = "#a50062",
            lesbian_oredange = "#d62900",
            lesbian_white = "#ffffff",
            lesbian_useSecondSet = five_bars < 2,

            gay_transition = (now / 2000) % 1,

            ratio = (Math.sin(now / 2000 * Math.PI)) / 2 + 0.5,
            light_purple = { h: 258 / 360, s: 1, l: 0.84 },
            purple = { h: 265 / 360, s: 0.69, l: 0.47 },

            bi_pink = "#D70071",
            bi_purple = "#9C4E97",
            bi_blue = "#0035AA",

            trans_pink = "#f7a8b8",
            trans_blue = "#55cdfc",
            trans_white = "#ffffff";

        gameDraw.animatedColor.lesbian = gameDraw.getRainbow(lesbian_useSecondSet ? lesbian_oredange : lesbian_white, lesbian_useSecondSet ? lesbian_white : lesbian_magenta, (lesbian_useSecondSet ? five_bars : five_bars - 3) / 2);
        gameDraw.animatedColor.gay = gameDraw.hslToRgb(gay_transition, 0.75, 0.5);
        // gameDraw.animatedColor.trans = [trans_blue, trans_pink, trans_white, trans_pink, trans_blue][five_bars];
        gameDraw.animatedColor.trans = gameDraw.mixColors(trans_white, 2000 > now % 4000 ? trans_blue : trans_pink, Math.max(Math.min(5 * Math.sin(now % 2000 / 2000 * Math.PI) - 2, 1), 0)); // Animated!
        gameDraw.animatedColor.magenta = gameDraw.hslToRgb(
            light_purple.h + (purple.h - light_purple.h) * ratio,
            light_purple.s + (purple.s - light_purple.s) * ratio,
            light_purple.l + (purple.l - light_purple.l) * ratio
        );

        gameDraw.animatedColor.blue_red = blinker ? gameDraw.color.blue : gameDraw.color.red;
        gameDraw.animatedColor.blue_grey = blinker ? gameDraw.color.blue : gameDraw.color.grey;
        gameDraw.animatedColor.grey_blue = blinker ? gameDraw.color.grey : gameDraw.color.blue;
        gameDraw.animatedColor.red_grey = blinker ? gameDraw.color.red : gameDraw.color.grey;
        gameDraw.animatedColor.grey_red = blinker ? gameDraw.color.grey : gameDraw.color.red;
    },
    animatedColors: {
        // police
        20: true,
        flashBlueRed: true,

        21: true,
        flashBlueGrey: true,
        flashBlueGray: true,

        22: true,
        flashGreyBlue: true,
        flashGrayBlue: true,

        23: true,
        flashRedGrey: true,
        flashRedGray: true,

        24: true,
        flashGreyRed: true,
        flashGrayRed: true,

        // lesbian
        29: true,
        lesbian: true,

        // rainbow
        36: true,
        rainbow: true,

        // trans
        37: true,
        trans: true,

        // bi
        38: true,
        bi: true,

        // magenta
        42: true,
        animatedMagenta: true,
    },
    getColor: (colorNumber) => {
        if (colorNumber[0] == '#') return colorNumber;
        switch (colorNumber) {

            // polygons & other entities
            case "6":
            case "egg":
            case "veryLightGrey":
            case "veryLightGray":
                return gameDraw.color.vlgrey;
            case "13":
            case "square":
            case "gold":
                return gameDraw.color.gold;
            case "2":
            case "triangle":
            case "orange":
                return gameDraw.color.orange;
            case "14":
            case "pentagon":
            case "purple":
                return gameDraw.color.purple;
            case "4":
            case "hexagon":
            case "aqua":
                return gameDraw.color.aqua;
            case "5":
            case "crasher":
            case "pink":
                return gameDraw.color.pink;
            case "1":
            case "shiny":
            case "lightGreen":
                return gameDraw.color.lgreen;
            case "0":
            case "legendary":
            case "teal":
                return gameDraw.color.teal;
            case "7":
            case "wall":
            case "lightGrey":
            case "lightGray":
                return gameDraw.color.lgrey;

            // teams
            case "3":
            case "neutral":
            case "yellow":
                return gameDraw.color.yellow;
            case "10":
            case "blue":
                return gameDraw.color.blue;
            case "11":
            case "green":
                return gameDraw.color.green;
            case "12":
            case "red":
                return gameDraw.color.red;
            case "15":
            case "magenta":
                return gameDraw.color.magenta;
            case "25":
            case "mustard":
                return gameDraw.color.mustard;
            case "26":
            case "tangerine":
                return gameDraw.color.tangerine;
            case "27":
            case "brown":
                return gameDraw.color.brown;
            case "28":
            case "cyan":
            case "turquoise":
                return gameDraw.color.cyan;

            // shades of grey/gray
            case "8":
            case "pureWhite":
                return gameDraw.color.guiwhite;
            case "18":
            case "white":
                return gameDraw.color.white;
            case "16":
            case "grey":
            case "gray":
                return gameDraw.color.grey;
            case "17":
            case "darkGrey":
            case "darkGray":
                return gameDraw.color.dgrey;
            case "9":
            case "black":
                return gameDraw.color.black;
            case "19":
            case "pureBlack":
                return gameDraw.color.guiblack;

            // lgbt
            case "lesbian":
                return gameDraw.animatedColor.lesbian;
            case "rainbow":
            case "gay":
                return gameDraw.animatedColor.gay;
            case "bi":
                return gameDraw.animatedColor.bi;
            case "trans":
                return gameDraw.animatedColor.trans;

            // police
            case "flashBlueRed":
                return gameDraw.animatedColor.blue_red;
            case "flashBlueGrey":
            case "flashBlueGray":
                return gameDraw.animatedColor.blue_grey;
            case "flashGreyBlue":
            case "flashGrayBlue":
                return gameDraw.animatedColor.grey_blue;
            case "flashRedGrey":
            case "flashRedGray":
                return gameDraw.animatedColor.red_grey;
            case "flashGreyRed":
            case "flashGrayRed":
                return gameDraw.animatedColor.grey_red;

            // infinity gems
            case "30":
            case "powerGem":
            case "powerStone":
                return "#a913cf";
            case "31":
            case "spaceGem":
            case "spaceStone":
                return "#226ef6";
            case "32":
            case "realityGem":
            case "realityStone":
                return "#ff1000";
            case "33":
            case "soulGem":
            case "soulStone":
                return "#ff9000";
            case "34":
            case "timeGem":
            case "timeStone":
                return "#00e00b";
            case "35":
            case "mindGem":
            case "mindStone":
                return "#ffd300";

            // seasonal rocks
            case "pumpkinStem":
                return "#654321";
            case "pumpkinBody":
                return "#e58100";
            case "tree":
                return "#267524";

            // unsorted
            case "nest":
            case "lavender":
                return gameDraw.color.lavender;
            case "42":
            case "animatedMagenta":
                return gameDraw.animatedColor.magenta;
        }
    },
    getColorDark: (givenColor) => {
        let dark = settings.graphical.neon ? gameDraw.color.white : gameDraw.color.black;
        if (settings.graphical.darkBorders) return dark;
        return gameDraw.mixColors(givenColor, dark, gameDraw.color.border);
    },
    getZoneColor: (cell, real) => {
        switch (cell) {
            case "dom0":
                return gameDraw.color.gold;
            case "bas1":
            case "bap1":
            case "dom1":
                return gameDraw.color.blue;
            case "bas2":
            case "bap2":
            case "dom2":
                return gameDraw.color.green;
            case "bas3":
            case "bap3":
            case "dom3":
            case "boss":
                return gameDraw.color.red;
            case "bas4":
            case "bap4":
            case "dom4":
                return gameDraw.color.magenta;
            case "bas5":
            case "bap5":
            case "dom5":
                return gameDraw.color.mustard;
            case "bas6":
            case "bap6":
            case "dom6":
                return gameDraw.color.tangerine;
            case "bas7":
            case "bap7":
            case "dom7":
                return gameDraw.color.brown;
            case "bas8":
            case "bap8":
            case "dom8":
                return gameDraw.color.cyan;
            case "port":
                return gameDraw.color.guiblack;
            case "nest":
                return gameDraw.color.lavender;
            default:
                return real ? gameDraw.color.white : gameDraw.color.lgrey;
        }
    },
    setColor: (context, givenColor) => {
        if (settings.graphical.neon) {
            context.fillStyle = gameDraw.getColorDark(givenColor);
            context.strokeStyle = givenColor;
        } else {
            context.fillStyle = givenColor;
            context.strokeStyle = gameDraw.getColorDark(givenColor);
        }
    }
}
export { gameDraw }

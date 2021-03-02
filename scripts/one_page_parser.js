const WALL_OFFSET = 0.25;

// The OnePageParser class
export class OnePageParser {
    // Button to open UI to import a dungeon
    importButton;

    importButtonClicked() {
        console.log("OnePageParser | importButtonClicked");
        let form = new OnePageParserForm({});
        form.render(true);
    }
}

class MatrixMap {
    // for fast checking
    matrix;
    // for fast iterating
    list;

    constructor() {
        this.matrix = {};
        this.list = [];
    }

    get(x, y) {
        return this.matrix[x] && this.matrix[x][y];
    }

    put(x, y) {
        if (!this.matrix[x]) {
            this.matrix[x] = {};
        }
        this.matrix[x][y] = true;
        this.list.push([x, y]);
    }

    addRect(rect) {
        for (let x = rect.x; x < rect.x + rect.w; x++) {
            for (let y = rect.y; y < rect.y + rect.h; y++) {
                this.put(x, y);
            }
        }
    }

    getWalls() {
        let walls = [];
        this.list.forEach(p => {
            let x = p[0];
            let y = p[1];

            if (!this.get(x, y-1)) {
                walls.push([x, y, x+1, y]);
            }

            if (!this.get(x, y+1)) {
                walls.push([x, y+1, x+1, y+1]);
            }

            if (!this.get(x-1, y)) {
                walls.push([x, y, x, y+1]);
            }

            if (!this.get(x+1, y)) {
                walls.push([x+1, y, x+1, y+1]);
            }
        });
        return walls;
    }

    getProcessedWalls() {
        let walls = this.getWalls();
        let keys = [[], []];
        let sorting = [{}, {}];
        walls.forEach(w => {
            if (w[1] == w[3]) {
                if (!sorting[0][w[1]]) {
                    sorting[0][w[1]] = [];
                    keys[0].push(w[1]);
                }
                sorting[0][w[1]].push(w);
            } else {
                if (!sorting[1][w[0]]) {
                    sorting[1][w[0]] = [];
                    keys[1].push(w[0]);
                }
                sorting[1][w[0]].push(w);
            }
        });

        let result = [];

        // Do for both x and y. For y, shift indexing points by 1
        for (let i = 0; i < 2; i++) {
            keys[i].forEach(k => {
                // Sort heap by starting time
                let heap = sorting[i][k];
                heap.sort((a, b) => a[i] > b[i] ? 1 : -1);
                // Add first element to the stack
                let stack = [];
                stack.push(heap[0]);
                heap.forEach(wall => {
                    if (wall[i] > stack[stack.length - 1][i+2]) {
                        // new wall starts after current segment ends, so push to stack
                        stack.push(wall);
                    } else if (stack[stack.length - 1][i+2] < wall[i+2]) {
                        // new wall is longer than current segment, so lengthen wall
                        stack[stack.length - 1][i+2] = wall[i+2];
                    } else {
                        // else wall is contained inside current segment
                    }
                });
                stack.forEach(wall => result.push(wall));
            });
        }

        // For every wall coordinate, offset it into the open space (away from the filled tiles)
        result.forEach((wall, index, list) => {
            for (let p = 0; p < 2; p++) {
                let x = wall[2 * p];
                let y = wall[2 * p + 1];

                // get grid:
                let subgrid = [[false, false], [false, false]];
                let parity = 0;
                for (let i = 0; i < 2; i++) {
                    for (let j = 0; j < 2; j++) {
                        subgrid[i][j] = this.get(x-1 + i, y-1 + j);
                        if (subgrid[i][j]) {
                            parity += 1;
                        }
                    }
                }
                // if outside corner case, switch to equivalent inside corner case
                if (parity == 1) {
                    subgrid = [
                        [!subgrid[1][1], !subgrid[1][0]],
                        [!subgrid[0][1], !subgrid[0][0]],
                    ]
                }

                // find the inside corner to shift the wall toward
                let inside_corner = [];
                for (let i = 0; i < 2; i++) {
                    for (let j = 0; j < 2; j++) {
                        if (!subgrid[i][j]) {
                            inside_corner = [i, j];
                        }
                    }
                }

                result[index][2 * p] = x + (inside_corner[0] == 0 ? -WALL_OFFSET : WALL_OFFSET);
                result[index][2 * p + 1] = y + (inside_corner[1] == 0 ? -WALL_OFFSET : WALL_OFFSET);
            }
        });

        return result;
    }

}

// DOOR TYPES
const DOOR_TYPE_EMPTY = 0;
const DOOR_TYPE_SINGLE_DOOR = 1;
const DOOR_TYPE_OPENING = 2;
const DOOR_TYPE_STAIRS_ENTRANCE = 3;
const DOOR_TYPE_BARS = 4;
const DOOR_TYPE_DOUBLE_DOOR = 5;
const DOOR_TYPE_SECRET_WALL = 6;
const DOOR_TYPE_FLUSH_DOOR = 7;
const DOOR_TYPE_STAIRS_EXIT = 8;

// Helper function that converts a JSON door input to a wall (in map grid coordinates)
function doorToWall(door) {
    if (door["type"] == DOOR_TYPE_EMPTY ||
        door["type"] == DOOR_TYPE_OPENING ||
        door["type"] == DOOR_TYPE_STAIRS_ENTRANCE ||
        door["type"] == DOOR_TYPE_STAIRS_EXIT) {
        return null;
    }
    let result = {};
    result["c"] = [door["x"] - 0.75 * door["dir"]["y"], door["y"] - 0.75 * door["dir"]["x"], door["x"] + 0.75 * door["dir"]["y"], door["y"] + 0.75 * door["dir"]["x"]];
    result["c"] = result["c"].map(p => p + 0.5);
    if (door["type"] == DOOR_TYPE_SECRET_WALL ||
        door["type"] == DOOR_TYPE_FLUSH_DOOR) {
        result["c"] = [result["c"][0] - WALL_OFFSET * door["dir"]["x"],
                       result["c"][1] - WALL_OFFSET * door["dir"]["y"],
                       result["c"][2] - WALL_OFFSET * door["dir"]["x"],
                       result["c"][3] - WALL_OFFSET * door["dir"]["y"]];
    }
    result["door"] =  CONST.WALL_DOOR_TYPES.DOOR;
    if (door["type"] == DOOR_TYPE_SECRET_WALL) {
        result["door"] =  CONST.WALL_DOOR_TYPES.SECRET;
    }
    if (door["type"] == DOOR_TYPE_BARS) {
        result["sense"] = CONST.WALL_SENSE_TYPES.NONE;
        result["ds"] = CONST.WALL_DOOR_STATES.LOCKED;
    }
    if (door["type"] == DOOR_TYPE_DOUBLE_DOOR) {
        result["ds"] = CONST.WALL_DOOR_STATES.LOCKED;
    }
    return result;
}

class OnePageParserForm extends FormApplication {
    constructor(options) {
        super(options);
        console.log("OnePageParser | OnePageParserForm constructor");
    }

    // overrides superclass
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = "OnePageParser Import Scene";
        options.template = "modules/one-page-parser/templates/one-page-parser-form.html";
        options.editable = true;
        options.width = 450;
        options.height = "auto";
        options.classes = ["one-page-parser"];
        return options;
    }

    // must override - abstract function
    _updateObject(event, formData) {
        const promiseResult = new Promise(async (resolve, reject) => {
            // The parser logic
            // Tries to create a new scene from the info in the form.
            // On success, can call 'resolve' with a helpful message.
            // On failure, calls 'reject' with an error message.

            // TODO Find right filelist that contains the formData.json-file
            const fileList = $("#one-page-parser-json")[0].files;

            //console.log($('form[name="one-page-parser-form"]'));
            let validData = true;

            if (isNaN(formData.grid)) {
                ui.notifications.error("Grid Size must be a number");
                validData = false;
            }

            if (formData.grid < 50) {
                ui.notifications.error("Grid Size must be at least 50");
                validData = false;
            }

            if (fileList.length != 1) {
                ui.notifications.error("Must import a JSON file");
                validData = false;
            } else {
                await readTextFromFile(fileList[0]).then(json => formData.json = json);
            }

            await $.get(formData.img).fail( () => {
                ui.notifications.error("Background Image file not found");
                validData = false;
            });

            if (validData) {
                try {
                    this.updateScene(formData);
                    ui.notifications.info("Imported Scene");
                    resolve("Imported Scene");
                } catch (error) {
                    reject(error);
                }
            } else {
                reject("Form data is not valid. See error notifications.");
            }
        });
        return promiseResult;
    }

    async updateScene(formData) {
        const loader = new TextureLoader();
        const texture = await loader.loadTexture(formData.img);

        let info = await JSON.parse(formData.json);
        let map = new MatrixMap();

        info["rects"].forEach(r => map.addRect(r));

        try {
            const newScene = await Scene.create({
                name: formData.name == "" ? info["title"]: formData.name,
                grid: formData.grid,
                img: formData.img,
                height: texture.height,
                width: texture.width,
                padding: 0,
                fogExploration: true,
                tokenVision: true,
            });
            let g = formData.grid;
            let walls = map.getProcessedWalls().map(m => m.map(v => v*g)).map(m => { return {c : m} });
            newScene.createEmbeddedEntity("Wall", walls, {noHook: false});
            let doors = info["doors"].map(d => doorToWall(d)).filter(d => d != null);
            doors = doors.map(d => {
                d["c"] = d["c"].map(v => v*g);
                return d;
            });
            await newScene.createEmbeddedEntity("Wall", doors, {noHook: false});

            let minvals = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
            newScene.data.walls.forEach(w => {
                minvals[0] = Math.min(minvals[0], w.c[0], w.c[2]);
                minvals[1] = Math.min(minvals[1], w.c[1], w.c[3]);
            });

            newScene.data.walls = newScene.data.walls.map(w => {
                w.c = [w.c[0] - minvals[0],
                       w.c[1] - minvals[1],
                       w.c[2] - minvals[0],
                       w.c[3] - minvals[1]];
                return w;
            });

            if (formData.debug) {
                console.log("Debug enabled");
                await newScene.createEmbeddedEntity("Drawing", info["doors"].map(d => {
                    return {
                        type: CONST.DRAWING_TYPES.RECTANGLE,
                        author: game.user._id,
                        x : (d["x"] + 0.5) * g,
                        y : (d["y"] + 0.5) * g,
                        width : g * 1.5,
                        height : g * 1.5,
                        text: d["type"],
                        strokeColor: "#FF0000",
                        textColor: "#FF0000",
                    };
                }), {noHook: false});
            }
        } catch (error) {
            ui.notifications.error(error);
            console.log("OnePageParser | Error creating scene");
        }

    }

}

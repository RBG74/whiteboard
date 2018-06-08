let isPressingCanvas = false;
let color;
let size = 6;

// Ratio width/height for the canvas to draw on
const CANVAS_RATIO = 300 / 200;

// La channel actuelle est stoqué dans le hash
const CURRENT_CHANNEL = location.pathname.slice(1);

// Prepare the canvas
const canvas = document.createElement("canvas");
const container = document.getElementById("canvas-container");

canvas.id = "CursorLayer";
canvas.width = 800;//container.clientWidth;
canvas.height = 500;//canvas.width / CANVAS_RATIO;
container.appendChild(canvas);

const ctx = canvas.getContext("2d");

// Draw in the canvas for draw message received
const socket = new WebSocket("ws://"+ window.location.host+"/", "protocolOne");

socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);

    if (message.channel != CURRENT_CHANNEL) {
        console.log(message.channel, CURRENT_CHANNEL);
        throw new Error(
            "On ne devrait pas recevoir de message depuis cette channel"
        );
        return;
    }

    if (message.type == "draw") {
        drawInCanvas(
            ctx,
            message.payload.x,
            message.payload.y,
            message.payload.color,
            message.payload.size
        );
    }

    
    if (message.type == "target") {
        //console.log("target", message);
        drawInCanvas(
            ctx,
            message.x,
            message.y,
            message.color,
            message.size
        );
    }

    if (message.type == "clean") {
        drawInCanvas(
            ctx,
            message.x,
            message.y,
            message.color,
            message.size
        );
    }
});

socket.addEventListener("open", () => {
    sendMessage("subscribe", {});
});

function sendMessage(type, payload) {
    const message = { type, payload, channel: CURRENT_CHANNEL };
    socket.send(JSON.stringify(message));
}

function drawInCanvas(ctx, x, y, color, size) {
    const circle = new Path2D();
    circle.moveTo(x, y);
    circle.arc(x, y, size, 0, 2 * Math.PI);

    ctx.fillStyle = color;
    ctx.fill(circle);
}

// Bind event listener to color picker
document.querySelectorAll(".color").forEach(colorButton => {
    const style = window.getComputedStyle(colorButton);
    const colorValue = style.getPropertyValue("background-color");

    colorButton.addEventListener(
        "click",
        () => {
            color = colorValue;
        },
        false
    );

    color = colorValue;
});

// Bind event listeners for canvas
const onMouseMove = event => {
    if (!isPressingCanvas) {
        return;
    }

    const x = event.pageX - canvas.offsetLeft;
    const y = event.pageY - canvas.offsetTop;

    drawInCanvas(ctx, x, y, color, size);

    /*sendMessage("draw", {
        x,
        y,
        color,
        size
    });*/
};

const onMouseDown = (event) => {
    isPressingCanvas = true;
    const x = event.pageX - canvas.offsetLeft;
    const y = event.pageY - canvas.offsetTop;
    //jonathan
    sendMessage("shoot", {
        x,
        y
    });
};

const onMouseUp = () => {
    isPressingCanvas = false;
};

canvas.addEventListener("click", onMouseDown, false);

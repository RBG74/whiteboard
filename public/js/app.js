let color;
let size = 6;

// La channel actuelle est stoqué dans le hash
const USERNAME = new URL(location.href).searchParams.get("name");
const CURRENT_CHANNEL = location.pathname.slice(1);

// Prepare the canvas
const canvas = document.createElement("canvas");
const container = document.getElementById("canvas-container");

canvas.id = "CursorLayer";
canvas.width = 800;
canvas.height = 500;
container.appendChild(canvas);

const ctx = canvas.getContext("2d");

// Draw in the canvas for draw message received
const socket = new WebSocket("wss://"+ window.location.host+"/", "protocolOne");

socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);

    if (message.channel != CURRENT_CHANNEL) {
        console.log(message.channel, CURRENT_CHANNEL);
        throw new Error(
            "On ne devrait pas recevoir de message depuis cette channel"
        );
        return;
    }
    
    if (message.type == "target") {
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
    const message = { type, payload, channel: CURRENT_CHANNEL, name: USERNAME };
    socket.send(JSON.stringify(message));
}

function drawInCanvas(ctx, x, y, color, size) {
    const circle = new Path2D();
    circle.moveTo(x, y);
    circle.arc(x, y, size, 0, 2 * Math.PI);

    ctx.fillStyle = color;
    ctx.fill(circle);
}

const onClick = (event) => {
    const x = event.pageX - canvas.offsetLeft;
    const y = event.pageY - canvas.offsetTop;
    
    sendMessage("shoot", {
        x,
        y
    });
};

canvas.addEventListener("click", onClick, false);

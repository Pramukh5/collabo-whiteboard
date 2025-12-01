const io = require("socket.io-client");

const socketUrl = "http://localhost:5000";

const clientA = io(socketUrl);
const clientB = io(socketUrl);
const clientC = io(socketUrl);

const room1 = "room-1";
const room2 = "room-2";

let passed = true;

function fail(msg) {
    console.error("FAIL:", msg);
    passed = false;
}

async function test() {
    console.log("Starting test...");

    // Join rooms
    clientA.emit("join-room", room1);
    clientB.emit("join-room", room1);
    clientC.emit("join-room", room2);

    // Wait for joins to process
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 1: A draws, B should receive, C should NOT
    const drawData = { roomId: room1, x: 10, y: 10, color: "#000" };

    const p1 = new Promise(resolve => {
        clientB.once("draw", (data) => {
            console.log("Client B received draw");
            if (data.x === 10 && data.y === 10) resolve();
        });
    });

    const p2 = new Promise((resolve, reject) => {
        clientC.once("draw", () => {
            fail("Client C received draw from room 1");
            reject();
        });
        setTimeout(resolve, 1000); // Wait 1s to ensure C doesn't receive
    });

    console.log("Client A emitting draw...");
    clientA.emit("draw", drawData);

    await Promise.all([p1, p2]);

    // Test 2: C draws, A and B should NOT receive
    const drawData2 = { roomId: room2, x: 20, y: 20, color: "#f00" };

    const p3 = new Promise((resolve, reject) => {
        clientA.once("draw", () => {
            fail("Client A received draw from room 2");
            reject();
        });
        setTimeout(resolve, 1000);
    });

    console.log("Client C emitting draw...");
    clientC.emit("draw", drawData2);

    await p3;

    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();

    if (passed) {
        console.log("ALL TESTS PASSED");
        process.exit(0);
    } else {
        console.error("TESTS FAILED");
        process.exit(1);
    }
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});

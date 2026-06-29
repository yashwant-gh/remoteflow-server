// RemoteFlow/server/server.js
const WebSocket = require('ws');

// Dynamically read the port assigned by Render, fallback to 8080 for local testing
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Map(); 

wss.on('connection', (ws) => {
    let currentId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'register':
                    currentId = data.deviceId;
                    clients.set(currentId, ws);
                    console.log(`Device registered: ${currentId}`);
                    break;

                case 'candidate':
                case 'offer':
                case 'answer':
                    const targetClient = clients.get(data.targetId);
                    if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                        console.log(`Routing signaling message [${data.type}] from ${currentId} to ${data.targetId}`);
                        targetClient.send(JSON.stringify({
                            type: data.type,
                            senderId: currentId,
                            payload: data.payload
                        }));
                    } else {
                        console.log(`Routing failed: Target device ${data.targetId} is offline.`);
                        // Send an error payload receipt back to the original caller to clear their UI block
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "error", message: "Target offline" }));
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    ws.on('close', () => {
        if (currentId) {
            clients.delete(currentId);
            console.log(`Device disconnected: ${currentId}`);
        }
    });
});

console.log(`🚀 RemoteFlow Signaling Server running on port ${PORT}`);
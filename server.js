// RemoteFlow/server/server.js
const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
const clients = new Map(); 

wss.on('connection', (ws, req) => {
    let currentId = null;
    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    ws.on('message', (message) => {
        try {
            // Check if the payload is stringified JSON before parsing
            const data = JSON.parse(message);

            switch (data.type) {
                case 'register':
                    currentId = data.deviceId;
                    clients.set(currentId, { ws, publicIp });
                    console.log(`Device registered: ${currentId}`);
                    break;

                case 'offer':
                case 'answer':
                case 'stream_frame': // <-- Relays compressed desktop frames fluidly
                    const target = clients.get(data.targetId);
                    if (target && target.ws.readyState === WebSocket.OPEN) {
                        target.ws.send(JSON.stringify({
                            type: data.type,
                            senderId: currentId,
                            payload: data.payload
                        }));
                    }
                    break;
            }
        } catch (error) {
            console.error("Error processing message loop:", error);
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
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
            // Convert message to a readable string/buffer safely
            const isBinaryString = typeof message === 'string' && message.startsWith('BIN');
            const isBinaryBuffer = Buffer.isBuffer(message) && message.length > 3 && message.toString('utf8', 0, 3) === 'BIN';

            // STRICT BINARY ROUTING ONLY
            if (isBinaryString || isBinaryBuffer) {
                const dataBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message);
                const targetId = dataBuffer.toString('utf8', 3, 12).trim();
                const target = clients.get(targetId);
                
                if (target && target.ws.readyState === WebSocket.OPEN) {
                    target.ws.send(message); 
                }
                return; // Only exit early for genuine binary desktop streams
            }

            // ROBUST TEXT ROUTING FOR JSON PACKETS (Handles both strings and text buffers)
            const textContent = Buffer.isBuffer(message) ? message.toString('utf8') : message;
            const data = JSON.parse(textContent);

            switch (data.type) {
                case 'register':
                    currentId = data.deviceId;
                    clients.set(currentId, { ws, publicIp });
                    console.log(`Device successfully registered on grid: ${currentId}`);
                    break;

                case 'offer':
                case 'answer':
                    console.log(`Routing signaling packet [${data.type}] from ${currentId} to target: ${data.targetId}`);
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
            console.error("Error processing packet message loop:", error);
        }
    });

    ws.on('close', () => {
        if (currentId) {
            clients.delete(currentId);
            console.log(`Device disconnected from grid: ${currentId}`);
        }
    });
});

console.log(`🚀 RemoteFlow Signaling Server running on port ${PORT}`);
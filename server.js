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
            // Check if it's our custom binary frame format payload
            if (Buffer.isBuffer(message) || (typeof message === 'string' && message.startsWith('BIN'))) {
                const dataBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message);
                
                if (dataBuffer.length > 14 && dataBuffer.toString('utf8', 0, 3) === 'BIN') {
                    // Extract the padded target device ID slice straight from the binary header
                    const targetId = dataBuffer.toString('utf8', 3, 14).trim();
                    const target = clients.get(targetId);
                    
                    if (target && target.ws.readyState === WebSocket.OPEN) {
                        target.ws.send(message); // Deliver raw binary payload straight to target peer
                    }
                }
                return;
            }

            // Fallback for standard configuration text signaling packets
            const data = JSON.parse(message);
            switch (data.type) {
                case 'register':
                    currentId = data.deviceId;
                    clients.set(currentId, { ws, publicIp });
                    console.log(`Device registered: ${currentId}`);
                    break;

                case 'offer':
                case 'answer':
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
            console.log(`Device disconnected: ${currentId}`);
        }
    });
});

console.log(`🚀 RemoteFlow Signaling Server running on port ${PORT}`);
// RemoteFlow/server/server.js
const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
const clients = new Map(); 

wss.on('connection', (ws, req) => {
    let currentId = null;

    // Extract the client's public IP address crossing the internet
    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'register':
                    currentId = data.deviceId;
                    // Store both the active socket connection and the public IP address
                    clients.set(currentId, { ws, publicIp });
                    console.log(`Device registered: ${currentId} from WAN IP: ${publicIp}`);
                    break;

                case 'offer':
                    const target = clients.get(data.targetId);
                    const sender = clients.get(currentId);
                    
                    if (target && target.ws.readyState === WebSocket.OPEN) {
                        console.log(`Routing WebRTC link request from ${currentId} to ${data.targetId}`);
                        
                        // Send the offer to the target, including the sender's public IP address
                        target.ws.send(JSON.stringify({
                            type: 'offer',
                            senderId: currentId,
                            senderIp: sender.publicIp,
                            payload: data.payload
                        }));
                    }
                    break;

                case 'answer':
                    const origin = clients.get(data.targetId);
                    const responder = clients.get(currentId);
                    
                    if (origin && origin.ws.readyState === WebSocket.OPEN) {
                        // Send the answer back to the original connector, including the responder's public IP
                        origin.ws.send(JSON.stringify({
                            type: 'answer',
                            senderId: currentId,
                            senderIp: responder.publicIp,
                            payload: data.payload
                        }));
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
import { createServer } from 'node:http';
import { type WebSocket, WebSocketServer } from 'ws';
import { handleAwarenessUpdate, nextCollaboratorColor } from './awareness';
import { type Client, Room } from './room';

const PORT = Number(process.env.PORT) || 4000;

const rooms = new Map<string, Room>();

function getOrCreateRoom(roomId: string): Room {
	let room = rooms.get(roomId);
	if (!room) {
		room = new Room(roomId);
		rooms.set(roomId, room);
	}
	return room;
}

// HTTP server for health checks
const server = createServer((_req, res) => {
	res.writeHead(200, { 'Content-Type': 'application/json' });
	res.end(
		JSON.stringify({
			status: 'ok',
			rooms: rooms.size,
			clients: Array.from(rooms.values()).reduce((sum, r) => sum + r.getClientCount(), 0),
		}),
	);
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
	const url = new URL(req.url || '/', `http://localhost:${PORT}`);
	const roomId = url.searchParams.get('room') || 'default';
	const clientName = url.searchParams.get('name') || 'Anonymous';
	const clientId = crypto.randomUUID();
	const color = nextCollaboratorColor();

	const room = getOrCreateRoom(roomId);

	const client: Client = {
		id: clientId,
		name: clientName,
		color,
		send(data: string) {
			if (ws.readyState === ws.OPEN) ws.send(data);
		},
	};

	room.addClient(client);

	ws.on('message', (raw) => {
		try {
			const msg = JSON.parse(String(raw));

			switch (msg.type) {
				case 'ops':
					room.applyOps(clientId, msg.version ?? 0, msg.ops ?? []);
					break;
				case 'awareness':
					handleAwarenessUpdate(room, clientId, msg);
					break;
			}
		} catch {
			// Ignore malformed messages
		}
	});

	ws.on('close', () => {
		room.removeClient(clientId);
		// Clean up empty rooms
		if (room.getClientCount() === 0) {
			rooms.delete(roomId);
		}
	});
});

server.listen(PORT, () => {
	console.log(`JPOffice Collab Server running on port ${PORT}`);
});

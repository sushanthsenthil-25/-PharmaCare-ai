from typing import Dict, List, Set
import uuid
from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections grouped by business_id and branch_id."""
    def __init__(self):
        # business_id -> Set of WebSockets
        self.active_business_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, business_id: str):
        await websocket.accept()
        if business_id not in self.active_business_connections:
            self.active_business_connections[business_id] = set()
        self.active_business_connections[business_id].add(websocket)

    def disconnect(self, websocket: WebSocket, business_id: str):
        if business_id in self.active_business_connections:
            self.active_business_connections[business_id].discard(websocket)
            if not self.active_business_connections[business_id]:
                del self.active_business_connections[business_id]

    async def broadcast_to_business(self, business_id: str, message: dict):
        if business_id in self.active_business_connections:
            dead_sockets = set()
            for connection in self.active_business_connections[business_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_sockets.add(connection)
            for dead in dead_sockets:
                self.active_business_connections[business_id].discard(dead)


ws_manager = ConnectionManager()

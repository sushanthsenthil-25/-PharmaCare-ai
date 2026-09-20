from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.websocket.manager import ws_manager
from app.core.security import decode_access_token

ws_router = APIRouter(tags=["WebSocket"])


@ws_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    try:
        payload = decode_access_token(token)
        business_id = payload.get("business_id")
        if not business_id:
            await websocket.close(code=4003)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, business_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo heartbeat or client message
            await websocket.send_json({"type": "PONG", "message": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, business_id)

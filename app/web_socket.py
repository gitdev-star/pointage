from fastapi import WebSocket, WebSocketDisconnect
from typing import List

# Keep track of connected WebSocket clients
active_connections: List[WebSocket] = []


async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    print("New WebSocket connection established.")

    try:
        while True:
            # Optionally handle incoming messages from clients (if needed)
            data = await websocket.receive_text()
            print(f"Received data: {data}")
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print("WebSocket connection closed.")


async def broadcast_attendance_data(attendance_data):
    """Broadcast the fetched attendance data to all connected WebSocket clients."""
    for connection in active_connections:
        try:
            await connection.send_json(attendance_data)
        except Exception as e:
            print(f"Failed to send data: {e}")

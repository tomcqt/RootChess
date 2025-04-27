[    import asyncio
import websockets
import threading
import http.server
import socketserver

HTTP_PORT = 9001  # it's over 9000!!!
WS_PORT = 9002

STATIC_DIR = "client"
TARGET_WS_URL = "wss://chess.ytdraws.win"

# --- Static file server setup ---
class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

def start_static_server():
    with socketserver.ThreadingTCPServer(("", HTTP_PORT), CustomHandler) as httpd:
        print(f"Static file server running at http://localhost:{HTTP_PORT}")
        httpd.serve_forever()

# --- WebSocket proxy handler ---
async def proxy_websocket(client_ws, path=""):
    try:
        async with websockets.connect(
            TARGET_WS_URL,
            origin=TARGET_WS_URL.replace("wss://", "https://"),
            ping_interval=None,
        ) as target_ws:
            print(f"Proxying WebSocket connection to {TARGET_WS_URL}")

            async def from_client():
                async for message in client_ws:
                    await target_ws.send(message)
                    print(f"Sent to target: {message}")

            async def from_target():
                async for message in target_ws:
                    await client_ws.send(message)
                    print(f"Sent to client: {message}")

            await asyncio.gather(from_client(), from_target())

    except Exception as e:
        print(f"WebSocket proxy error: {e}")

# --- WebSocket Server ---
async def start_ws_server():
    print(f"WebSocket proxy listening at ws://localhost:{WS_PORT}/")
    server = await websockets.serve(proxy_websocket, "0.0.0.0", WS_PORT)
    await server.wait_closed()

# --- Main Entry Point ---
if __name__ == "__main__":
    threading.Thread(target=start_static_server, daemon=True).start()
    print("Static file server started.")
    try:
        asyncio.run(start_ws_server())
    except KeyboardInterrupt:
        print("Shutting down WebSocket server...")
        print("WebSocket server stopped.")
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Exiting...")
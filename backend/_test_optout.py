import asyncio
import json
import logging
import os
import sys
import threading

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from fastapi import FastAPI, Request
import uvicorn

from services.optout_listener import poll_optout_status

# Fake send2 endpoint: accepts GET with a JSON body (non-standard).
app = FastAPI()

@app.get("/devdesk/AI_chatbot_API_incomingentry")
async def fake_send2(request: Request):
    body = await request.json()
    print("GOT:", json.dumps(body))
    return {"number": body.get("number"), "type": "optout", "msg": "STOP"}

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=2307, log_level="error")

async def main():
    threading.Thread(target=run_server, daemon=True).start()
    await asyncio.sleep(1.5)

    import services.optout_listener as m
    m.POLL_INTERVAL_SECONDS = 1   # speed it up for the test

    stop = asyncio.Event()
    task = asyncio.create_task(poll_optout_status(stop))
    await asyncio.sleep(3.5)      # let a couple polls run
    stop.set()
    try:
        await task
    except asyncio.CancelledError:
        pass

asyncio.run(main())
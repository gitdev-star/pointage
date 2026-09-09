# dans root@

import asyncio
import json
import time
from datetime import datetime, timezone

from app.services.device_admin import delete_user_from_all_devices

EMPLOYEE_IDS = [

1210,1518,1578,1653,1673,1793,2114,2248,2288,2420,2823,2932,3109,3223,3375,3408,3848,3916,3931,4003,4035,4040,4147,4407,4409,4610,4671,4684,4689,4728,4731,4953,4984,4995,5089,5133,5151,5215,5225,5326,5327,5338,5340,5355,5365,5367,5368,5372,5389,5402,5408,5411,5413,5447,5478,5499,5516,5518,5523,5531,5534,5535,5590,5599,5612,5613,5617,5618,5763,5764,5770,5774,5777,5800,5807,5820,5822,5827,5839,5842,5855,5858,5866,5870,5876,5879,5885,5887,5889,5891,5930,5936,5937,5942,5943,5944,5958,5962,5990,6023,6033,6035,6044,6106,6127,6128,6133,6159,6173,6175,6181,6203,6228,6243,6250,6254,6260,6263,6267,6280,6288,6289,6291,6293,6297,6418,6432,6540,6562,
]

LOG_PATH = f"/app/bulk_sweep_result_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"

log = {}

for i, uid in enumerate(EMPLOYEE_IDS, start=1):
    start = time.monotonic()
    result = asyncio.run(delete_user_from_all_devices(str(uid)))
    elapsed = round(time.monotonic() - start, 1)

    log[str(uid)] = {"result": result, "elapsed_s": elapsed}
    print(f"[{i}/{len(EMPLOYEE_IDS)}] uid={uid} done in {elapsed}s -> {result}")

    if i % 25 == 0:
        with open(LOG_PATH, "w") as f:
            json.dump(log, f, indent=2)

with open(LOG_PATH, "w") as f:
    json.dump(log, f, indent=2)

print(f"\nDone. {len(log)} employees processed. Full log written to {LOG_PATH}")
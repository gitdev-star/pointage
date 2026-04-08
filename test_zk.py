from zk import ZK, const

device_ip = '192.168.8.201'
port = 4370
password = 0

zk = ZK(device_ip, port=port, timeout=5, password=password)
conn = None

try:
    conn = zk.connect()
    print("Connected successfully!")
    users = conn.get_users()
    print(f"Users on device: {users}")
except Exception as e:
    print(f"Failed to connect: {e}")
finally:
    if conn:
        conn.disconnect()

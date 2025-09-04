import psycopg2

try:
    conn = psycopg2.connect(
        dbname="pointage_db",
        user="odilon",
        password="YES",  # Your password here
        host="localhost"
    )
    print("Connection successful!")
except Exception as e:
    print("Error connecting to the database:", e)
finally:
    if conn:
        conn.close()

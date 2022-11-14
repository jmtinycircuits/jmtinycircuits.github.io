import serial
import time

payload = bytearray(400 * 1000)

ser = serial.Serial("COM850")


while True:
    t0 = time.time()
    ser.write(payload)
    print((time.time() - t0) * 1000, "ms")


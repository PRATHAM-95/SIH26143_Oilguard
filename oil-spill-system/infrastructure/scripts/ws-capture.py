"""Minimal raw RFC6455 client for capturing plain-JSON WebSocket frames.

Used by the STEP 10 live integration check to verify the attribution event
sequence broadcast on /ws/simulation/{id}. Dependency-free on purpose.
"""
import argparse
import base64
import json
import os
import socket
import struct
import sys
import threading
import time
import urllib.request


def _fire(url: str, body_file: str, out) -> None:
    """Fired a short moment after the socket handshake completes."""
    import warnings

    try:
        with open(body_file, "r", encoding="utf-8") as fh:
            payload = fh.read()
        req = urllib.request.Request(
            url, data=payload.encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST"
        )
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with urllib.request.urlopen(req, timeout=150) as resp:
                out.write("FIRED %d %s\n" % (resp.status, resp.read().decode("utf-8", "replace")[:2000]))
    except Exception as exc:  # noqa: BLE001 - surfaced to the capture log
        out.write("FIRE_ERROR %s\n" % exc)
    out.flush()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8082)
    p.add_argument("--path", default="/ws/simulation/probe")
    p.add_argument("--timeout", type=float, default=120.0)
    p.add_argument("--out", default=None)
    p.add_argument("--until", action="append", default=[])
    p.add_argument("--fire", default=None, help="HTTP POST url to fire after handshake")
    p.add_argument("--fire-body", default=None, help="file containing the JSON body")
    p.add_argument("--fire-delay", type=float, default=2.0)
    args = p.parse_args()

    out = open(args.out, "w", encoding="utf-8") if args.out else sys.stdout

    key = base64.b64encode(os.urandom(16)).decode()
    sock = socket.create_connection((args.host, args.port), timeout=10)
    sock.settimeout(1)
    req = (
        "GET %s HTTP/1.1\r\n"
        "Host: %s:%d\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: %s\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n" % (args.path, args.host, args.port, key)
    )
    sock.sendall(req.encode("ascii"))
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = sock.recv(4096)
        if not chunk:
            break
        buf += chunk
    head, _, rest = buf.partition(b"\r\n\r\n")
    status_line = head.split(b"\r\n", 1)[0]
    if b" 101 " not in status_line:
        out.write("HANDSHAKE_FAILED %r\n" % head)
        out.flush()
        return 2
    out.write("OPEN %s\n" % status_line.decode("latin1"))
    out.flush()

    if args.fire:
        def _delayed_fire():
            time.sleep(args.fire_delay)
            _fire(args.fire, args.fire_body, out)

        threading.Thread(target=_delayed_fire, daemon=True).start()

    data = rest
    deadline = time.time() + args.timeout
    while time.time() < deadline:
        if len(data) < 2:
            try:
                chunk = sock.recv(4096)
            except socket.timeout:
                continue
            if not chunk:
                break
            data += chunk
            continue
        b0, b1 = data[0], data[1]
        opcode = b0 & 0x0F
        masked = (b1 & 0x80) != 0
        ln = b1 & 0x7F
        idx = 2
        need = 0
        if ln == 126:
            need = 4
        elif ln == 127:
            need = 10
        if need:
            if len(data) < need:
                try:
                    data += sock.recv(4096)
                except socket.timeout:
                    pass
                continue
            ln = struct.unpack("!H", data[2:4])[0] if need == 4 else struct.unpack("!Q", data[2:10])[0]
            idx = need
        if masked:
            if len(data) < idx + 4:
                try:
                    data += sock.recv(4096)
                except socket.timeout:
                    pass
                continue
            mask = data[idx : idx + 4]
            idx += 4
        if len(data) < idx + ln:
            try:
                data += sock.recv(4096)
            except socket.timeout:
                pass
            continue
        payload = data[idx : idx + ln]
        data = data[idx + ln :]
        if masked:
            payload = bytes(c ^ mask[i % 4] for i, c in enumerate(payload))
        if opcode == 0x9:  # ping -> pong
            sock.sendall(b"\x8a" + bytes([len(payload)]) + payload)
            continue
        if opcode == 0x8:  # close
            out.write("CLOSE\n")
            out.flush()
            break
        if opcode == 0x0:  # continuation (append text accumulated above; rare here)
            continue
        if opcode == 0x1:  # text
            text = payload.decode("utf-8", "replace")
            out.write(text + "\n")
            out.flush()
            if args.until and any(u in text for u in args.until):
                out.write("MATCH\n")
                out.flush()
                sock.close()
                return 0
    out.write("TIMEOUT\n")
    out.flush()
    return 1


if __name__ == "__main__":
    sys.exit(main())
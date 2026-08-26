"""Yjs wire-format helpers used by the Schreibraum collab socket.

These are the only pure functions in collab.py, and everything the editor
exchanges is framed by them — an off-by-one here silently corrupts documents,
so they are worth pinning down without a WebSocket.
"""
import pytest

from api.routers.schreibraum.collab import (
    MSG_SYNC, SYNC_STEP1, SYNC_STEP2, SYNC_UPDATE,
    _dec_varbytes, _dec_varint, _enc_varbytes, _enc_varint,
    _sync1, _sync2, _update_msg,
)


@pytest.mark.parametrize("n", [0, 1, 127, 128, 300, 16383, 16384, 2 ** 31, 2 ** 53])
def test_varint_round_trip(n):
    encoded = _enc_varint(n)
    assert _dec_varint(encoded, 0) == (n, len(encoded))


def test_varint_uses_seven_bits_per_byte():
    assert _enc_varint(0) == b"\x00"
    assert _enc_varint(127) == b"\x7f"
    assert _enc_varint(128) == b"\x80\x01"      # continuation bit set
    assert _enc_varint(300) == b"\xac\x02"


def test_dec_varint_starts_at_the_given_offset():
    data = b"\xff\xff" + _enc_varint(300) + b"tail"
    value, pos = _dec_varint(data, 2)
    assert value == 300
    assert data[pos:] == b"tail"


@pytest.mark.parametrize("payload", [b"", b"y", b"\x00\x01\x02", bytes(range(256)), b"x" * 500])
def test_varbytes_round_trip(payload):
    encoded = _enc_varbytes(payload)
    assert encoded.startswith(_enc_varint(len(payload)))
    assert _dec_varbytes(encoded, 0) == (payload, len(encoded))


def test_varbytes_decode_leaves_the_reader_after_the_payload():
    stream = _enc_varbytes(b"eins") + _enc_varbytes(b"zwei")
    first, pos = _dec_varbytes(stream, 0)
    second, pos = _dec_varbytes(stream, pos)
    assert (first, second) == (b"eins", b"zwei")
    assert pos == len(stream)


@pytest.mark.parametrize("build,step", [
    (_sync1, SYNC_STEP1),
    (_sync2, SYNC_STEP2),
    (_update_msg, SYNC_UPDATE),
])
def test_sync_messages_carry_the_right_header_and_payload(build, step):
    msg = build(b"state-vector")
    assert msg[0] == MSG_SYNC
    assert msg[1] == step
    assert _dec_varbytes(msg, 2) == (b"state-vector", len(msg))

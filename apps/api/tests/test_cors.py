"""Regression tests for the Chrome extension's ability to reach this backend.

The extension runs as a chrome-extension:// page, which Chrome classifies as a more
"public" address space than the localhost backend it calls. That triggers a Private
Network Access (PNA) preflight in addition to the normal CORS origin check; without
allow_private_network=True, Starlette answers "Disallowed CORS private-network" and
Chrome blocks every request the extension makes — this is invisible to the web app
because a localhost:3000 page calling localhost:8000 never crosses address spaces.
"""

EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"


def test_extension_origin_preflight_is_allowed(client):
    resp = client.options(
        "/api/meetings",
        headers={
            "Origin": EXTENSION_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == EXTENSION_ORIGIN


def test_extension_private_network_preflight_is_allowed(client):
    """The actual regression: a plain CORS preflight is not enough, Chrome also needs this."""
    resp = client.options(
        "/api/meetings",
        headers={
            "Origin": EXTENSION_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-private-network"] == "true"


def test_unrelated_origin_is_still_rejected(client):
    resp = client.options(
        "/api/meetings",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert resp.status_code == 400

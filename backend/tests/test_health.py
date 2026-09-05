from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "ClipFetch API" in response.text
    assert "All Systems Operational" in response.text


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ClipFetch"


def test_vercel_origin_is_allowed():
    response = client.options(
        "/api/analyze",
        headers={
            "Origin": "https://clipfetch-preview.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://clipfetch-preview.vercel.app"

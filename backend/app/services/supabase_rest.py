import httpx

from app.core.config import settings


class SupabaseREST:
    """
    Minimal server-side client using Supabase PostgREST + service role key.
    This keeps secrets on the server and enables efficient aggregation queries.
    """

    def __init__(self) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

        self.base_url = settings.supabase_url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }

    async def get(self, path: str, params: dict | None = None):
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{self.base_url}/{path.lstrip('/')}", headers=self.headers, params=params)
            r.raise_for_status()
            return r.json()

    async def post(self, path: str, json: dict):
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{self.base_url}/{path.lstrip('/')}", headers=self.headers, json=json)
            r.raise_for_status()
            return r.json()

    async def patch(self, path: str, params: dict | None = None, json: dict | None = None):
        headers = {**self.headers, "Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.patch(
                f"{self.base_url}/{path.lstrip('/')}", headers=headers, params=params, json=json
            )
            r.raise_for_status()
            if r.content:
                return r.json()
            return []

    async def delete(self, path: str, params: dict | None = None):
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.delete(f"{self.base_url}/{path.lstrip('/')}", headers=self.headers, params=params)
            r.raise_for_status()
            if r.content:
                return r.json()
            return None


supabase_rest = SupabaseREST


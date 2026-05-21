from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    app_name: str = "societrack-backend"

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    cors_origins: str = "http://localhost:5173"
    # Password reset links (must match Supabase Auth redirect URLs)
    app_public_url: str = ""

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    # Dashboard → Webhooks: secret shown when you create the endpoint (not the API key secret)
    razorpay_webhook_secret: str = ""
    # Optional: Azure/cron can POST /api/maintenance/rollover-cron with this header
    maintenance_rollover_secret: str = ""

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def public_site_url(self) -> str:
        if self.app_public_url.strip():
            return self.app_public_url.strip().rstrip("/")
        origins = self.cors_origin_list()
        return origins[0].rstrip("/") if origins else ""


settings = Settings()


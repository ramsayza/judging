from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "mysql+pymysql://agility:agility@db:3306/agility_portal"
    backend_jwt_secret: str = "dev-backend-jwt-secret-change-me"
    internal_service_secret: str = "dev-internal-service-secret-change-me"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

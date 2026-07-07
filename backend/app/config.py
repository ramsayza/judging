from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg2://agility:agility@db:5432/agility_portal"
    backend_jwt_secret: str = "dev-backend-jwt-secret-change-me"
    internal_service_secret: str = "dev-internal-service-secret-change-me"
    cors_origins: str = "http://localhost:3000"
    frontend_base_url: str = "http://localhost:3000"

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Heroku's Postgres add-on sets DATABASE_URL with the bare "postgres://"
        # scheme, which SQLAlchemy no longer accepts; rewrite it to the psycopg2 dialect.
        if value.startswith("postgres://"):
            return "postgresql+psycopg2://" + value[len("postgres://") :]
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

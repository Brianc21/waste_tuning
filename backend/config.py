"""Configuration settings for the application."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    sql_server: str = "hebwmddev-sqlvm.ri-team.net"
    sql_database: str
    sql_port: int = 1433
    
    # Authentication settings - choose one method:
    # For Windows Integrated Auth: set use_windows_auth=True and run with domain creds
    # For SQL/Windows auth with creds: set sql_username and sql_password
    # For Azure AD: set use_azure_ad=True and azure credentials
    use_windows_auth: bool = True  # Use Windows Integrated Authentication (most common)
    sql_username: Optional[str] = None  # e.g., "ri-team\\username" for Windows auth
    sql_password: Optional[str] = None
    use_azure_ad: bool = False  # Set to True to use Azure AD token auth instead
    
    azure_tenant_id: str = "common"
    azure_client_id: str = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"  # Azure CLI client ID
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings()

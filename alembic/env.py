from __future__ import with_statement
import os
from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from sqlalchemy import MetaData
from alembic import context

# Import your Base and models here
from app.models import Base  # Adjust this to the location of your models

# This will import your configuration file (ini or env.py settings)
config = context.config

# Setting up logging, make sure your logging is set up properly in your ini file
fileConfig(config.config_file_name)

# This is the MetaData object, which Alembic uses to auto-generate migrations
target_metadata = Base.metadata

# Get the URL of the database from the configuration or environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://odilon:YES@localhost:5432/pointage_db?client_encoding=UTF8")

# This is where Alembic sets up the engine
def run_migrations_online():
    # Create the connection to the database
    connectable = create_engine(
        DATABASE_URL,  # Replace with your actual database URL
        poolclass=pool.NullPool
    )

    # Connect to the database and run migrations
    with connectable.connect() as connection:
        # Here we pass the connection to Alembic's context
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,  # Set to True to compare column types in migrations
        )

        with context.begin_transaction():
            context.run_migrations()

# Run the migrations online (standard workflow)
if context.is_offline_mode():
    print("Running offline migrations, but this is not typical for autogenerate")
else:
    run_migrations_online()

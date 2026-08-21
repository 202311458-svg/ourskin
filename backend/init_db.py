"""Compatibility entry point for database setup.

Schema changes are migration-controlled. This module deliberately performs no
DDL so importing or starting the application can never mutate the schema.
"""


def main() -> None:
    raise SystemExit(
        "Database initialization is migration-controlled. "
        "Run `alembic upgrade head` from the backend directory."
    )


if __name__ == "__main__":
    main()
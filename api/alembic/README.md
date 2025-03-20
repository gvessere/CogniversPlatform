# Alembic Migrations

This directory contains database migrations for the Cognivers API. Alembic is used to manage database schema changes.

## Running Migrations

### Prerequisites
- Docker and Docker Compose installed
- The database container running (`docker-compose up db`)

### Commands

1. **Create a new migration**
```bash
docker-compose exec api alembic revision --autogenerate -m "description of changes"
```

2. **Apply pending migrations**
```bash
# First, apply the migrations
docker-compose exec api alembic upgrade head

# Then, rebuild the API service to ensure all changes are properly loaded
docker-compose down && docker-compose up --build api
```

3. **Rollback last migration**
```bash
docker-compose exec api alembic downgrade -1
```

4. **Rollback all migrations**
```bash
docker-compose exec api alembic downgrade base
```

5. **View migration history**
```bash
docker-compose exec api alembic history
```

6. **View current migration version**
```bash
docker-compose exec api alembic current
```

## Best Practices

1. Always review auto-generated migrations before applying them
2. Test migrations on a development database first
3. Keep migrations in version control
4. Write clear, descriptive migration messages
5. One logical change per migration
6. After applying migrations, always rebuild the API service using `docker-compose down && docker-compose up --build api`

## Troubleshooting

If you encounter issues:

1. Check if the database container is running
2. Verify database connection settings in `alembic.ini`
3. Ensure all dependencies are installed in the API container
4. Check migration history for conflicts
5. If migrations aren't being picked up, try rebuilding the API service

## Directory Structure

- `versions/`: Contains all migration files
- `env.py`: Migration environment configuration
- `script.py.mako`: Template for new migrations
- `alembic.ini`: Alembic configuration file 
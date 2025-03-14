from setuptools import setup, find_packages

setup(
    name="api",
    version="0.1.0",
    packages=find_packages(),
    package_data={
        "api": ["py.typed"],
        "api.stubs.celery": ["py.typed", "*.pyi"],
    },
    install_requires=[
        "celery",
        "fastapi",
        "sqlmodel",
        "alembic",
        "jose",
        "passlib",
        "argon2-cffi",
    ],
) 
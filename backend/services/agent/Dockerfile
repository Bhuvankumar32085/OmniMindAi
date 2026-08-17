# Python 3.13 Base Image
FROM python:3.13-slim

WORKDIR /app

# Install Astral UV package manager for fast builds
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency definition files
COPY pyproject.toml uv.lock ./

# Install dependencies into global environment
RUN uv sync --frozen --no-cache

# Copy application source files
COPY . .

EXPOSE 8003

# Run production application with Gunicorn WSGI server (threaded worker for SSE streaming support)
CMD ["uv", "run", "gunicorn", "-w", "2", "--threads", "4", "--timeout", "120", "-b", "0.0.0.0:8003", "main:app"]

FROM python:3.12-slim

# psycopg[binary] traz o driver compilado, então não precisamos de libpq-dev
# nem toolchain — a imagem fica pequena sem etapa de build.
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY etl/ ./etl/

# Usuário sem privilégio: a API fica exposta na VPS.
RUN useradd -m ratio && chown -R ratio /app
USER ratio

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

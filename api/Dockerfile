FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends pandoc libreoffice && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY requirements.txt .
# pip selbst aktuell halten (das Basis-Image bringt eine Version mit bekannten Lücken mit)
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy api source into /workspace/api/ so relative imports work
COPY . ./api/

EXPOSE 8000
ENTRYPOINT ["sh", "./api/entrypoint.sh"]
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

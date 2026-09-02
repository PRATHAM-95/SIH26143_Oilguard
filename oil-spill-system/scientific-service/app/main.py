from fastapi import FastAPI

app = FastAPI(title="Oil Spill Scientific Service", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "UP", "service": "oil-spill-scientific-service", "version": "0.1.0"}

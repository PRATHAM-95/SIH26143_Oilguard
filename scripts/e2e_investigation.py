import time
import requests
import sys

BASE_URL = "http://localhost:8082/api"

def create_simulation():
    res = requests.post(f"{BASE_URL}/simulation", json={"region": {"north":25,"south":-10,"east":100,"west":50}, "mode": "captain"})
    res.raise_for_status()
    return res.json()["simulationId"]

def list_vessels(sim_id):
    res = requests.get(f"{BASE_URL}/simulation/{sim_id}/vessels")
    res.raise_for_status()
    vessels = res.json()["vessels"]
    if not vessels:
        raise Exception("No vessels found")
    return vessels[0]["id"]

def start_simulation(sim_id):
    res = requests.post(f"{BASE_URL}/simulation/{sim_id}/start", json={})
    res.raise_for_status()

def release_spill(sim_id, vessel_id):
    payload = {
        "type": "accidental",
        "oilType": "GENERIC CRUDE",
        "quantityKg": 5000
    }
    res = requests.post(f"{BASE_URL}/simulation/{sim_id}/vessels/{vessel_id}/spill", json=payload)
    res.raise_for_status()
    return res.json()["incidentId"]

def run_forward_drift(sim_id):
    payload = {
        "durationHours": 6,
        "particleCount": 500,
        "oilType": "GENERIC CRUDE",
        "environmentSource": "CONTROLLED",
        "currents": {"u": 0.5, "v": 0},
        "wind": {"u": 2, "v": 0}
    }
    res = requests.post(f"{BASE_URL}/simulation/{sim_id}/forward-drift", json=payload)
    res.raise_for_status()
    
def start_investigation(incident_id):
    res = requests.post(f"{BASE_URL}/investigation/{incident_id}/start")
    res.raise_for_status()
    return res.json()["investigationId"]

def poll_investigation(inv_id):
    print("Polling investigation...")
    for i in range(30):
        res = requests.get(f"{BASE_URL}/investigation/{inv_id}")
        res.raise_for_status()
        data = res.json()
        status = data.get("status")
        print(f"[{i*20}s] Status: {status}")
        if status == "COMPLETED" or status == "FAILED":
            return data
        time.sleep(20)
    raise Exception("Investigation timed out after 10 minutes")

def main():
    try:
        print("Creating simulation...")
        sim_id = create_simulation()
        print(f"Simulation created: {sim_id}")
        
        vessel_id = list_vessels(sim_id)
        print(f"Using vessel: {vessel_id}")
        
        start_simulation(sim_id)
        print("Simulation started.")
        
        incident_id = release_spill(sim_id, vessel_id)
        print(f"Spill released. Incident ID: {incident_id}")
        
        print("Running forward drift...")
        run_forward_drift(sim_id)
        time.sleep(2) # brief wait before investigation
        
        print("Starting investigation...")
        inv_id = start_investigation(incident_id)
        print(f"Investigation started: {inv_id}")
        
        final_data = poll_investigation(inv_id)
        print("\n--- FINAL INVESTIGATION STATE ---")
        print(f"Status: {final_data.get('status')}")
        for stage in final_data.get("stages", []):
            print(f"Stage {stage.get('stageId')}: {stage.get('status')}")
            
    except Exception as e:
        print(f"E2E Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

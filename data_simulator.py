import threading, time, random
from collections import deque

class TwinSimulator:
    def __init__(self, num_twins=12, history_len=30, update_interval=5.0):
        self.num_twins = num_twins
        self.history_len = history_len
        self.update_interval = update_interval
        self._data = {}
        
        machine_names = [
            "CNC Milling Machine",
            "Hydraulic Press",
            "Industrial Compressor",
            "Steam Boiler Unit",
            "Conveyor Belt Motor",
            "Cooling Tower Fan",
            "Power Generator",
            "Robotic Arm",
            "Air Handling Unit",
            "Heat Exchanger",
            "Gas Turbine",
            "Pumping Station"
        ]

        for i in range(1, num_twins+1):
            self._data[str(i)] = {
                'id': str(i),
                'name': machine_names[i-1],
                'active': True,
                'temperature': round(random.uniform(18, 25), 2),
                'pressure': round(random.uniform(0.95, 1.10), 3),
                'performance': round(random.uniform(70, 99), 2),
                'history': {
                    'temperature': deque(maxlen=history_len),
                    'pressure': deque(maxlen=history_len),
                    'performance': deque(maxlen=history_len),
                }
            }
            for _ in range(history_len):
                self._data[str(i)]['history']['temperature'].append(round(random.uniform(18, 25), 2))
                self._data[str(i)]['history']['pressure'].append(round(random.uniform(0.95, 1.10), 3))
                self._data[str(i)]['history']['performance'].append(round(random.uniform(70, 99), 2))

        self._stop = False
        self._thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        if not self._thread.is_alive():
            self._thread.start()

    def stop(self):
        self._stop = True
        if self._thread.is_alive():
            self._thread.join(timeout=1)

    def _run(self):
        while not self._stop:
            time.sleep(self.update_interval)
            for v in self._data.values():
                v['temperature'] = round(v['temperature'] + random.uniform(-0.5, 0.5), 2)
                v['pressure'] = round(v['pressure'] + random.uniform(-0.01, 0.01), 3)
                v['performance'] = max(50.0, min(100.0, round(v['performance'] + random.uniform(-2, 2), 2)))
                v['history']['temperature'].append(v['temperature'])
                v['history']['pressure'].append(v['pressure'])
                v['history']['performance'].append(v['performance'])

    def get_snapshot(self):
        out = []
        for v in self._data.values():
            out.append({
                'id': v['id'],
                'name': v['name'],
                'active': v['active'],
                'temperature': round(v['temperature'], 2),
                'pressure': round(v['pressure'], 3),
                'performance': round(v['performance'], 2),
                'history': {
                    'temperature': list(v['history']['temperature']),
                    'pressure': list(v['history']['pressure']),
                    'performance': list(v['history']['performance']),
                }
            })
        return out
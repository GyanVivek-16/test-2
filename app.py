from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from functools import wraps
from data_simulator import TwinSimulator

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = 'replace_this_with_secure_key'

# Simulator: 12 twins, updates every 5s
simulator = TwinSimulator(num_twins=12, history_len=30, update_interval=5.0)
simulator.start()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return redirect(url_for('dashboard') if 'user' in session else url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if username == 'admin' and password == 'admin':
            session['user'] = username
            return redirect(url_for('dashboard'))
        return render_template('login.html', error="Invalid username or password")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', num_twins=simulator.num_twins)

@app.route('/api/data')
@login_required
def api_data():
    return jsonify(simulator.get_snapshot())

@app.route('/api/predict/<twin_id>')
@login_required
def api_predict(twin_id):
    # Predict next 6 steps via simple least squares and flag anomalies
    data = simulator.get_snapshot()
    twin = next((t for t in data if str(t['id']) == str(twin_id)), None)
    if not twin:
        return jsonify({'error':'twin not found'}), 404

    FUTURE_STEPS = 6
    interval_seconds = int(simulator.update_interval)

    def linreg_forecast(series, steps):
        n = len(series)
        if n < 2:
            last = series[-1] if n else 0.0
            return [round(last,3)]*steps
        xs = list(range(n))
        sumx = sum(xs)
        sumy = sum(series)
        sumxx = sum(x*x for x in xs)
        sumxy = sum(xs[i]*series[i] for i in range(n))
        denom = (n*sumxx - sumx*sumx) or 1.0
        a = (n*sumxy - sumx*sumy) / denom
        b = (sumy - a*sumx) / n
        return [ round(a*(n+i) + b, 3) for i in range(steps) ]

    hist = twin.get('history', {})
    temp_pred = linreg_forecast(hist.get('temperature', []), FUTURE_STEPS)
    pres_pred = linreg_forecast(hist.get('pressure', []), FUTURE_STEPS)
    perf_pred = linreg_forecast(hist.get('performance', []), FUTURE_STEPS)

    THRESH = {
        'temperature': {'low': 15.0, 'high': 28.0},
        'pressure': {'low': 0.90, 'high': 1.20},
        'performance': {'low': 60.0, 'high': 100.0},
    }

    alerts = []
    def check(series_future, metric):
        low = THRESH[metric]['low']
        high = THRESH[metric]['high']
        for i, v in enumerate(series_future, start=1):
            if v < low:
                alerts.append({
                    'metric': metric, 'type': 'LOW', 'value': round(v,3),
                    'in_seconds': i*interval_seconds,
                    'message': f"{metric.capitalize()} predicted to drop below {low} in {i*interval_seconds}s (~{round(i*interval_seconds/60,1)} min)."
                })
                break
            if v > high:
                alerts.append({
                    'metric': metric, 'type': 'HIGH', 'value': round(v,3),
                    'in_seconds': i*interval_seconds,
                    'message': f"{metric.capitalize()} predicted to exceed {high} in {i*interval_seconds}s (~{round(i*interval_seconds/60,1)} min)."
                })
                break

    check(temp_pred, 'temperature')
    check(pres_pred, 'pressure')
    check(perf_pred, 'performance')

    return jsonify({
        'id': twin['id'],
        'name': twin['name'],
        'future_steps': FUTURE_STEPS,
        'step_seconds': interval_seconds,
        'predictions': {
            'temperature': temp_pred,
            'pressure': pres_pred,
            'performance': perf_pred,
        },
        'thresholds': THRESH,
        'alerts': alerts
    })

if __name__ == '__main__':
    app.run(debug=True)
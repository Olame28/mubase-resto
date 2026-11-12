import json, time, urllib.request, sys
import websocket

DEBUG = 'http://127.0.0.1:9333'
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8931/tests/tests.html'

def get_ws(url):
    tabs = json.load(urllib.request.urlopen(DEBUG + '/json'))
    for t in tabs:
        if t.get('type') == 'page':
            return t['webSocketDebuggerUrl']
    # create new tab
    req = urllib.request.Request(DEBUG + '/json/new?' + urllib.request.quote(URL, safe=''), method='PUT')
    t = json.load(urllib.request.urlopen(req))
    return t['webSocketDebuggerUrl']

ws_url = get_ws(URL)
ws = websocket.create_connection(ws_url, timeout=30)
mid = [0]
def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == mid[0]:
            return msg

def evaluate(expr):
    r = send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
    return r.get('result', {}).get('result', {}).get('value')

send('Page.enable')
send('Page.navigate', {'url': URL})

# attendre la fin des tests (summary contient 'réussi(s)' ou timeout)
deadline = time.time() + 120
last = ''
while time.time() < deadline:
    txt = evaluate("document.getElementById('summary') ? document.getElementById('summary').textContent : ''") or ''
    if 'réussi(s)' in txt or 'échoué(s)' in txt:
        break
    time.sleep(1)

summary = evaluate("document.getElementById('summary') ? document.getElementById('summary').innerText : 'NO SUMMARY'")
print('=== SUMMARY ===')
print(summary)
print('=== FAILURES ===')
fails = evaluate("""
Array.prototype.map.call(document.querySelectorAll('.fail'), function(e){return e.textContent}).join('\\n')
""")
print(fails or '(aucun)')
ws.close()

import json, time, urllib.request, sys
import websocket

DEBUG = 'http://127.0.0.1:9333'
URL = sys.argv[1]

tabs = json.load(urllib.request.urlopen(DEBUG + '/json'))
page = [t for t in tabs if t.get('type') == 'page'][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=30)
mid = [0]
def send(method, params=None):
    mid[0] += 1
    ws.send(json.dumps({'id': mid[0], 'method': method, 'params': params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == mid[0]:
            return msg

def ev(expr):
    r = send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
    res = r.get('result', {})
    if 'exceptionDetails' in res.get('result', r):
        pass
    return res.get('result', {}).get('value')

send('Page.enable')
send('Runtime.enable')
send('Page.navigate', {'url': URL})
time.sleep(4)
print('title:', ev('document.title'))
print('products:', ev("document.querySelectorAll('.product-card').length"))
print('categories:', ev("document.querySelectorAll('.cat-tab').length"))
print('tables options:', ev("document.getElementById('tableSelect').options.length"))
print('cart badge:', ev("document.getElementById('tableBadge').textContent"))
print('sw support:', ev("'serviceWorker' in navigator"))
print('idb support:', ev("!!window.indexedDB"))
ws.close()

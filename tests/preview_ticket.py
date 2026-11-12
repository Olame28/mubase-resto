import json, time, urllib.request
import websocket

DEBUG = 'http://127.0.0.1:9333'
URL = 'http://127.0.0.1:8931/index.html'
tabs = json.load(urllib.request.urlopen(DEBUG + '/json'))
page = [t for t in tabs if t.get('type') == 'page'][0]
ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=30)
mid = [0]
def send(m, p=None):
    mid[0]+=1; ws.send(json.dumps({'id':mid[0],'method':m,'params':p or {}}))
    while True:
        r=json.loads(ws.recv())
        if r.get('id')==mid[0]: return r
def ev(e):
    r=send('Runtime.evaluate',{'expression':e,'returnByValue':True,'awaitPromise':True})
    return r.get('result',{}).get('result',{}).get('value')
send('Page.enable'); send('Page.navigate',{'url':URL})
time.sleep(4)
js = """
(function(){
  var sale={receiptNo:'MUB-20261112-0001',date:new Date().toISOString(),tableName:'VIP',server:'',rate:2800,
   items:[{name:'Shawarma poulet',qty:2,note:'sans oignon',unitUSD:4,unitFC:11200},{name:'Pizza 4 saisons',qty:1,note:'',unitUSD:12,unitFC:33600},{name:'Riz',qty:1,note:'',unitUSD:0,unitFC:0,free:true}],
   totalUSD:20,totalFC:56000,discountFC:0,
   payment:{method:'FC',fcReceived:60000,fcChange:4000,usdReceived:0,usdChange:0}};
  return MUBASE.Receipts.buildReceiptText(sale);
})()
"""
print('===== RECU =====')
print(ev(js))
js2 = """
(function(){
  return MUBASE.Receipts.buildKitchenTicketText(
    [{name:'Shawarma poulet',qty:2,note:'sans oignon'},{name:'Pizza 4 saisons',qty:1}], 'VIP');
})()
"""
print('===== BON CUISINE =====')
print(ev(js2))
ws.close()

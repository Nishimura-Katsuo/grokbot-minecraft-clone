import sys,time
from playwright.sync_api import sync_playwright
shots=[a.split('=',1) for a in sys.argv[1:]]  # name=query
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':1280,'height':720})
    pg.on('console',lambda m: (m.type in('error','warning')) and errs.append(f'{m.type}: {m.text}'))
    pg.on('pageerror',lambda e: errs.append('pageerror: '+str(e)))
    for name,q in shots:
        t=time.time();pg.goto('http://localhost:8765/index.html?shot&'+q)
        pg.wait_for_function('window.__f>=6',timeout=600000,polling=500)
        pg.screenshot(path=f'/workspace/voxel/shots/{name}.png');import shutil;shutil.copy(f'/workspace/voxel/shots/{name}.png',f'/tmp/view/{name}_{int(time.time())}.png');print(name,'%.1fs'%(time.time()-t),flush=True)
    b.close()
print('ERRORS:',errs if errs else 'none')

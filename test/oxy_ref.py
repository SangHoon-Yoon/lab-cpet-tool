# Reference outputs from pyoxynet itself, for test/oxy_compare.js.
import pandas as pd, glob, json, warnings, sys
warnings.filterwarnings('ignore')
import pyoxynet, numpy as np
def load(pat):
    d=pd.read_excel(glob.glob('/home/claude/samples/*'+pat+'*')[0],sheet_name='Data',header=0).iloc[2:]
    d=d[d['t'].notna()]
    sec=lambda x:x.hour*3600+x.minute*60+x.second
    return pd.DataFrame({'time':[sec(x) for x in d['t']],'VO2_I':d['VO2'].astype(float)/1000,'VCO2_I':d['VCO2'].astype(float)/1000,'VE_I':d['VE'].astype(float),'PetO2_I':d['PetO2'].astype(float),'PetCO2_I':d['PetCO2'].astype(float)})
out={}
for pat,(a,b) in {'TREAD_CHAR':(90,1575),'GXT':(300,1500)}.items():
    df=load(pat);df=df[(df.time>=a)&(df.time<=b)].reset_index(drop=True)
    for m in ['CNN','LSTM']:
        k=pat+'_'+m
        try:
            o,t=pyoxynet.test_pyoxynet(input_df=df.copy(),model=m)
            out[k]={'time':o['time'].tolist(),'md':o['p_md'].tolist(),'hv':o['p_hv'].tolist(),'sv':o['p_sv'].tolist(),'vt1':t['VT1'],'vt2':t['VT2']}
        except Exception as e: out[k]={'error':str(e)}
        print(k,out[k].get('vt1',out[k].get('error')),out[k].get('vt2'))
json.dump({'data':{p:load(p).to_dict('list') for p in ['TREAD_CHAR','GXT']},'ref':out},open('/tmp/claude-0/-home-claude/f2a3b0f6-b28d-5952-946e-21cdf36e71d8/scratchpad/oxy_ref.json','w'))

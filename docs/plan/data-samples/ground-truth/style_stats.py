"""Frame style statistics for the UGG-look checks (doc 08 section 3). Usage: python style_stats.py OUT.json IMG..."""
import numpy as np, sys, json
from PIL import Image
def rgb2lab(a):
    a=np.where(a<=0.04045,a/12.92,((a+0.055)/1.055)**2.4)
    M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    xyz=a@M.T/np.array([0.95047,1.0,1.08883])
    f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)
def stats(path,k=12,seed=0):
    im=Image.open(path).convert('RGB').resize((960,540),Image.BILINEAR)
    a=np.asarray(im).astype(np.float64)/255
    mx=a.max(-1); mn=a.min(-1); V=mx; S=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-9),0)
    L=0.2126*a[...,0]+0.7152*a[...,1]+0.0722*a[...,2]
    gx=np.zeros_like(L); gy=np.zeros_like(L)
    gx[:,1:-1]=L[:,2:]-L[:,:-2]; gy[1:-1,:]=L[2:,:]-L[:-2,:]
    G=np.hypot(gx,gy)
    rg=a[...,0]-a[...,1]; yb=0.5*(a[...,0]+a[...,1])-a[...,2]
    colourful=np.hypot(rg.std(),yb.std())+0.3*np.hypot(rg.mean(),yb.mean())
    lab=rgb2lab(a).reshape(-1,3); rng=np.random.default_rng(seed); X=lab[rng.choice(len(lab),20000,replace=False)]
    C=X[rng.choice(len(X),k,replace=False)]
    for _ in range(25):
        d=((X[:,None,:]-C[None])**2).sum(-1); lbl=d.argmin(1)
        C=np.array([X[lbl==i].mean(0) if (lbl==i).any() else C[i] for i in range(k)])
    d=np.sqrt(((X[:,None,:]-C[None])**2).sum(-1)).min(1)
    return dict(mean_s=round(S.mean(),3),mean_v=round(V.mean(),3),std_v=round(V.std(),3),
        dark_frac_v_lt_0p12=round((V<0.12).mean(),4),edge_frac_g_gt_0p2=round((G>0.2).mean(),4),
        colourfulness=round(colourful,3),kmeans12_mean_dE=round(d.mean(),2),kmeans12_p90_dE=round(np.percentile(d,90),2))
if __name__=='__main__':
    out={p.split('/')[-1]:{k:float(v) for k,v in stats(p).items()} for p in sys.argv[2:]}
    keys=list(next(iter(out.values())).keys())
    rng={k:[min(o[k] for o in out.values()),max(o[k] for o in out.values())] for k in keys}
    json.dump({'per_image':out,'range':rng},open(sys.argv[1],'w'),indent=1); print(json.dumps(rng))

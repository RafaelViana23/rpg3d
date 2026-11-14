"""Bake the existing GLB's plank layout into shared floor colour/height textures."""
import json, struct, argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description='Optional rebuild from an external original GLB; generated PNG textures are already committed.')
parser.add_argument('source',type=Path,help='Path to the original wood-floor GLB outside the project')
raw=parser.parse_args().source.read_bytes()
length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);accessor=doc['accessors'][0];view=doc['bufferViews'][accessor['bufferView']]
positions=np.frombuffer(raw,dtype='<f4',count=accessor['count']*3,offset=28+length+view.get('byteOffset',0)+accessor.get('byteOffset',0)).reshape(-1,3)
# This source consists of a backing slab followed by eight rectangular planks.
planks=[]
for offset in range(24,len(positions),24):
 points=positions[offset:offset+24];planks.append((points.min(axis=0),points.max(axis=0)))
size=1024
# PNG top maps to -Z on the BoxGeometry top surface (UV v=1 at -Z).
x=(np.arange(size)+.5)/size
z=-.999+(np.arange(size)+.5)/size*.998
board=np.zeros((size,size),dtype=bool)
for lo,hi in planks: board|=(x[None,:]>=lo[0])&(x[None,:]<=hi[0])&(z[:,None]>=lo[2])&(z[:,None]<=hi[2])
height=Image.fromarray((board*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.55))
# White leaves the shared wood brown unchanged; only joints receive contact shading.
colour=np.where(board,255,235).astype(np.uint8)
colour=Image.fromarray(colour).convert('RGB')
out=root/'public/textures/city'
colour.save(out/'wood-floor-color.png',optimize=True);height.save(out/'wood-floor-height.png',optimize=True)
(root/'artifacts/floor-comparison/plank-layout.json').write_text(json.dumps([{'min':lo.tolist(),'max':hi.tolist()}for lo,hi in planks],indent=2))
print(f'Baked {len(planks)} source planks; source layout and standard brown preserved.')

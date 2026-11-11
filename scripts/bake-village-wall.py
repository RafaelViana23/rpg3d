"""Bake the supplied wall's front palette/UV appearance into one reusable facade tile."""
import json, struct
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
blob=(root/'public/models/city/props/village-wall.glb').read_bytes()
length=struct.unpack_from('<I',blob,12)[0]
gltf=json.loads(blob[20:20+length]);binary=blob[28+length:]
def accessor(index):
    a=gltf['accessors'][index];v=gltf['bufferViews'][a['bufferView']]
    components={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    kind={5126:'f',5123:'H',5125:'I'}[a['componentType']]
    stride=v.get('byteStride',struct.calcsize('<'+kind*components))
    offset=v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from('<'+kind*components,binary,offset+i*stride) for i in range(a['count'])]
v=gltf['bufferViews'][gltf['images'][0]['bufferView']];start=v.get('byteOffset',0)
palette=Image.open(BytesIO(binary[start:start+v['byteLength']])).convert('RGB')
primitive=gltf['meshes'][0]['primitives'][0];positions=accessor(primitive['attributes']['POSITION']);uv=accessor(primitive['attributes']['TEXCOORD_0'])
indices=[i[0] for i in accessor(primitive['indices'])] if 'indices' in primitive else list(range(len(positions)))
triangles=[]
for start in range(0,len(indices),3):
    ids=indices[start:start+3];p=[positions[i] for i in ids]
    area=(p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0])
    if area<=.00001:continue
    u=sum(uv[i][0] for i in ids)/3;v=sum(uv[i][1] for i in ids)/3
    color=palette.getpixel((min(255,max(0,int(u*256))),min(255,max(0,int(v*256)))))
    triangles.append((sum(t[2] for t in p)/3,p,color))
image=Image.new('RGB',(256,308),'#b9b19b');draw=ImageDraw.Draw(image)
for _,triangle,color in sorted(triangles,key=lambda t:t[0]):
    draw.polygon([(round(p[0]/2*255),round((1-p[1]/2.4)*307)) for p in triangle],fill=color)
# Remove the baked dark timber strips; facade joinery is separate 3D geometry.
from collections import Counter
plaster=Counter(image.getdata()).most_common(1)[0][0]
pixels=image.load()
for y in range(image.height):
    for x in range(image.width):
        r,g,b=pixels[x,y]
        if max(r,g,b)<145:
            pixels[x,y]=plaster
output=root/'public/textures/village-wall.png';output.parent.mkdir(parents=True,exist_ok=True);image.save(output)
print(output)

const images=new Map<string,string>();
const listeners=new Set<()=>void>();
export function setItemThumbnail(id:string,image:string){images.set(id,image);for(const listener of listeners)listener();}
export function refreshItemThumbnails(root:HTMLElement){
  root.querySelectorAll<HTMLImageElement>('img[data-item-thumbnail]').forEach(img=>{
    const image=images.get(img.dataset.itemThumbnail!);if(image){img.src=image;img.classList.add('loaded');}
  });
}
/** Reuse the inventory renders, including GLBs that finish loading after opening a panel. */
export function watchItemThumbnails(root:HTMLElement){listeners.add(()=>refreshItemThumbnails(root));}
export const itemThumbnail=(id:string)=>`<img class="item-thumbnail" data-item-thumbnail="${id}" alt="" width="52" height="52">`;

"""Measured HTML contrast and text enlargement; not a WCAG certification."""
from __future__ import annotations

from playwright.sync_api import Page

CONTRAST_SCRIPT = r"""() => {
  const rgba = value => {
    const parts = value.match(/[\d.]+/g)?.map(Number);
    return parts ? [parts[0], parts[1], parts[2], parts[3] ?? 1] : null;
  };
  const blend = (front, back) => [0,1,2].map(i => front[i]*front[3]+back[i]*(1-front[3])).concat(1);
  const background = element => {
    const parents=[]; for(let e=element;e;e=e.parentElement) parents.unshift(e);
    return parents.reduce((color,e)=>blend(rgba(getComputedStyle(e).backgroundColor),color),[255,255,255,1]);
  };
  const luminance = color => color.slice(0,3).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const ratio = (front,back) => {const values=[luminance(front),luminance(back)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);};
  const values=[];
  const activeRoot=document.querySelector('dialog[open]') || document.body;
  for(const e of activeRoot.querySelectorAll('*')){
    if(!e.getClientRects().length || e.closest('svg,.sr-only,[aria-hidden="true"],[disabled]')) continue;
    const style=getComputedStyle(e);
    if(style.visibility !== 'visible') continue;
    const hasText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if(!hasText && !e.matches('input:not([type=file]),textarea,select')) continue;
    const bg=background(e), fg=blend(rgba(style.color),bg);
    const minimum=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700)?3:4.5;
    values.push({element:e.tagName,selector:e.id?'#'+e.id:e.className,text:(e.value||e.textContent).trim().slice(0,80),foreground:style.color,background:bg.slice(0,3),ratio:Number(ratio(fg,bg).toFixed(2)),minimum});
    if(e.matches('input[placeholder],textarea[placeholder]')&&!e.value){
      const placeholder=getComputedStyle(e,'::placeholder');
      values.push({element:'placeholder',text:e.placeholder,ratio:Number(ratio(blend(rgba(placeholder.color),bg),bg).toFixed(2)),minimum:4.5});
    }
  }
  const sample=document.createElement('span'); sample.hidden=true; document.body.append(sample);
  const token=name=>{sample.style.color=getComputedStyle(document.body).getPropertyValue(name);return rgba(getComputedStyle(sample).color);};
  const controls=['--bg','--sf','--a3'].map(surface=>({surface,border:Number(ratio(token('--bd2'),token(surface)).toFixed(2)),focus:Number(ratio(token('--focus'),token(surface)).toFixed(2))}));
  sample.remove();
  return {measured:values.length,minimumTextRatio:Math.min(...values.map(v=>v.ratio)),failures:values.filter(v=>v.ratio<v.minimum),controls,svgTextNotAutomaticallyMeasured:[...activeRoot.querySelectorAll('svg text')].filter(e=>e.getClientRects().length).length,scope:'Visible HTML text, native form values and placeholders in the active dialog or document; excludes inactive controls, SVG/canvas and rendered-image text. Border/focus figures compare actual CSS tokens against the three declared surfaces.'};
}"""


def measure_accessibility(page: Page, phase: str) -> dict:
    contrast = page.evaluate(CONTRAST_SCRIPT)
    assert not contrast["failures"], f"{phase}: text contrast failures: {contrast['failures']}"
    assert all(item["border"] >= 3 and item["focus"] >= 3 for item in contrast["controls"]), f"{phase}: control token contrast failed"
    previous = page.evaluate("document.documentElement.style.fontSize")
    try:
        page.evaluate("document.documentElement.style.fontSize='200%'")
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        enlarged = page.evaluate("""() => ({
          rootFont:getComputedStyle(document.documentElement).fontSize,
          viewport:innerWidth, pageWidth:document.documentElement.scrollWidth
        })""")
        assert enlarged["pageWidth"] <= enlarged["viewport"], f"{phase}: 200% text enlargement overflow: {enlarged}"
    finally:
        page.evaluate("(value) => {document.documentElement.style.fontSize=value}", previous)
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    return {"phase": phase, "contrast": contrast, "textEnlargement200": enlarged, "note": "Text enlargement only; separate browser zoom and visual/assistive-technology review remain required."}

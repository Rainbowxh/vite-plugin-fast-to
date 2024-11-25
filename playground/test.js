function create() {
  initKeyBoard();
  initStyle();
}

function initKeyBoard() {
  const opt = {
    _status: '',
    get status() {
      return this._status;
    },
    set status(value) {
      this._status = value;
    },
    metaKey: false,
    listeners: [],
    weakMap: new WeakMap(),
    mention: {
      dom: document.createElement('div'),
      cleanup: []
    }
  }
  function onKeyDown(e) {
    opt.status = 'keydown';
    opt.metaKey = e.metaKey
    if(opt.metaKey) {
      onMouseMove(e)
      window.addEventListener('mousemove', onMouseMove);
      opt.listeners.push(() => window.removeEventListener('mousemove', onMouseMove))
    }
  }

  function onMouseMove(e) {
    if(opt.status !== 'keydown') return;

    window.addEventListener('click', onMouseMoveClick, {capture: true});
    opt.listeners.push(() => window.removeEventListener('click', onMouseMoveClick));

    window.addEventListener('contextmenu', onMouseMoveContextmenu, {capture: true});
    opt.listeners.push(() => window.removeEventListener('contextmenu', onMouseMoveContextmenu));
  }

  function collectInfo(e) {
    let current = e.target;
    let depth = 7;
    let result = opt.weakMap.get(current) || {
      all: [],
      element: [],
      component: [],
    }
    if(opt.weakMap.has(current)) {
      result = opt.weakMap.get(current);
    }else {
      const _target = current
      while(current && depth > 0) {
        const attributes = current.attributes;
        
        if(attributes && attributes['fast-component']){
          result.component.push(attributes['fast-component'].value)
          result.all.push(attributes['fast-component'].value)
        }
        if(attributes && attributes['fast-element']){
          if(result.component.length === 0) result.component.push(attributes['fast-element'].value)
          result.element.push(attributes['fast-element'].value)
          result.all.push(attributes['fast-element'].value)
        }
        current = current.parentNode;
        depth--;  
      }
      opt.weakMap.set(_target, result)
    }
  }
  
  function onMouseMoveClick(e) {
    if(opt.status !== 'keydown') return;
    if(!opt.metaKey) return;
    e.preventDefault();
    e.stopPropagation();

    collectInfo(e)

    const current = e.target;
    const currentInfo = opt.weakMap.get(current);
    const path = currentInfo.element[0];
    console.log(e)
    // openEditor(path)
  }

  function onMouseMoveContextmenu(e) {
    opt.mention.dom.innerHTML = ''
    opt.mention.cleanup.forEach(fn => fn())

    if(opt.status !== 'keydown') return;
    if(!opt.metaKey) return;
    
    e.preventDefault();
    e.stopPropagation();

    collectInfo(e)

    const { all } = opt.weakMap.get(e.target) || {}
    for(let i = 0; i < all.length; i++) {
      const dom = document.createElement('div');
      dom.innerText = all[i];
      dom.style.margin = '5px';
      dom.style.cursor = 'pointer';
      const func = () => openEditor(all[i]); 
      dom.addEventListener('click', func)
      opt.mention.dom.appendChild(dom)
      opt.mention.cleanup.push(() => dom.removeEventListener('click', func))
    }

    document.body.appendChild(opt.mention.dom)
    opt.mention.dom.style.display = 'block';
    opt.mention.dom.style.left = e.pageX + 'px';
    opt.mention.dom.style.top = e.pageY + 'px';
    opt.mention.dom.style.position = 'absolute';
  }

  function openEditor(path) {
    fetch('http://localhost:3154/__open-in-editor?file=' + path)
  }

  function onOtherEvent() {
    opt.status = '';
    opt.metaKey = false;
    opt.listeners.forEach(fn => fn())
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onOtherEvent)
  window.addEventListener('mouseleave', onOtherEvent)
  function onVisibilityChange() {
    if(document.hidden) {
      onOtherEvent();
    }
  }

  window.addEventListener('visibilitychange', onVisibilityChange)
  
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onOtherEvent)
    window.removeEventListener('mouseleave', onOtherEvent)
    window.removeEventListener('visibilitychange', onVisibilityChange)
    opt.listeners.forEach(fn => fn())
  }
}

function initStyle() {
  const body = document.body;
  if(!body) return;
  const styleDom = document.createElement('style');
  styleDom.innerHTML = `
    .vite-fast-to-mask { position: relative; }
    .vite-fast-to-mask::after { pointer-events: none; position: absolute; content: ''; left: -1px; right: -1px;bottom: -1px;top: -1px; border: 1px solid silver; background-color: rgba(192,192,192,.3); z-index: 10000; }
  `
  body.appendChild(styleDom);
}
function initPath() {}

create();

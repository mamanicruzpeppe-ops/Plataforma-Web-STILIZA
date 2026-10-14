// Stiliza — carrito persistente + destacados en portada
const CART_KEY = 'stiliza_carrito';

function cargarCarrito() {
  try {
    const raw = localStorage.getItem(CART_KEY) || sessionStorage.getItem(CART_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function guardarCarrito() {
  try {
    const data = JSON.stringify(carrito);
    localStorage.setItem(CART_KEY, data);
    sessionStorage.setItem(CART_KEY, data);
  } catch (_) {}
}

let carrito = cargarCarrito();

function actualizarBadge() {
  const badge = document.getElementById('carritoBadge');
  if (badge) badge.textContent = String(carrito.reduce((s, i) => s + (Number(i.cantidad) || 1), 0));
}

function renderCarrito() {
  const cont = document.getElementById('carritoContenido');
  if (!cont) return;
  if (!carrito.length) {
    cont.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);"><span style="font-size:2.5rem;">🛍️</span><p>Tu carrito está vacío</p></div>';
    const t = document.getElementById('totalCarrito');
    const a = document.getElementById('anticipoCarrito');
    if (t) t.textContent = 'Bs 0.00';
    if (a) a.textContent = 'Bs 0.00';
    return;
  }
  cont.innerHTML = carrito.map((item, idx) => `
    <div class="carrito-item ${item.esPromo ? 'item-promo' : ''}">
      <div class="carrito-item-info">
        <strong>${item.nombre || ''}${item.esPromo ? ' <span class="tag-promo">PROMO</span>' : ''}</strong>
        <small>${item.esPromo ? 'Promoción' : ('Talla: ' + (item.talla || '—'))}</small>
        ${item.precioOriginal ? `<small class="precio-tachado">Bs ${Number(item.precioOriginal).toFixed(2)}</small>` : ''}
      </div>
      <div class="carrito-item-precio">
        <strong>Bs ${(Number(item.precio) * Number(item.cantidad || 1)).toFixed(2)}</strong>
        <button type="button" class="btn-quitar-item" onclick="quitarDelCarrito(${idx})">✕</button>
      </div>
    </div>`).join('');
  const total = carrito.reduce((s, i) => s + Number(i.precio) * Number(i.cantidad || 1), 0);
  const t = document.getElementById('totalCarrito');
  const a = document.getElementById('anticipoCarrito');
  const tp = document.getElementById('totalPago');
  if (t) t.textContent = 'Bs ' + total.toFixed(2);
  if (a) a.textContent = 'Bs ' + (total * 0.2).toFixed(2);
  if (tp) tp.textContent = 'Anticipo: Bs ' + (total * 0.2).toFixed(2);
}

function agregarAlCarrito(item) {
  if (!item || !item.nombre) return;
  const id = String(item.id || '');
  const talla = item.talla || 'M';
  const ex = carrito.find(i => String(i.id) === id && String(i.talla) === String(talla));
  if (ex) ex.cantidad = Number(ex.cantidad || 1) + Number(item.cantidad || 1);
  else carrito.push({
    id: item.id,
    nombre: item.nombre,
    precio: Number(item.precio) || 0,
    precioOriginal: item.precioOriginal || null,
    talla,
    cantidad: Number(item.cantidad) || 1,
    imagen: item.imagen || '',
    esPromo: !!item.esPromo,
    tipo: item.tipo || 'producto'
  });
  guardarCarrito();
  actualizarBadge();
  if (typeof mostrarToast === 'function') mostrarToast((item.nombre || 'Producto') + ' añadido al carrito');
}

function quitarDelCarrito(idx) {
  const n = carrito[idx]?.nombre;
  carrito.splice(idx, 1);
  guardarCarrito();
  renderCarrito();
  actualizarBadge();
  if (typeof mostrarToast === 'function') mostrarToast(n ? n + ' eliminado' : 'Eliminado');
}

function vaciarCarritoTrasPago() {
  carrito = [];
  guardarCarrito();
  actualizarBadge();
  renderCarrito();
}

function renderDestacadosHome() {
  const grid = document.getElementById('gridDestacados');
  if (!grid) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem('stiliza_destacados') || '[]'); } catch (_) { list = []; }
  list = (list || []).filter(p => p && p.activo !== false && p.is_active !== false);
  window.__destacadosCache = list;
  if (!list.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:1.5rem;">Pronto verás aquí los vestidos más destacados.</p>';
    return;
  }
  grid.innerHTML = list.map(p => `
    <div class="producto-card dest-card" data-id="${p.id}" role="button" tabindex="0">
      <div class="producto-imagen" style="${p.imagen ? '' : 'background:linear-gradient(145deg,#f5ede8,#d4a5a5);'}">
        ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre || ''}" style="width:100%;height:100%;object-fit:cover;">` : ''}
        <span class="etiqueta">${p.categoria || 'destacado'}</span>
      </div>
      <div class="producto-info">
        <h3>${p.nombre || 'Vestido'}</h3>
        <p class="desc">${(p.descripcion || '').substring(0, 60)}</p>
        <span class="precio">Bs ${Number(p.precio || 0).toFixed(2)}</span>
        <div class="acciones">
          <button type="button" class="btn-agregar-carrito btn-dest-ver" data-id="${p.id}">Ver detalle</button>
        </div>
      </div>
    </div>`).join('');

  const open = (id) => {
    const prod = (window.__destacadosCache || []).find(x => String(x.id) === String(id));
    if (prod) abrirDetalleDestacado(prod);
  };
  grid.querySelectorAll('.dest-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      open(card.dataset.id);
    });
  });
  grid.querySelectorAll('.btn-dest-ver').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      open(btn.dataset.id);
    });
  });
}

function abrirDetalleDestacado(prod) {
  let modal = document.getElementById('modalDetalleDestacado');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalDetalleDestacado';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-detalle dest-detalle-modal">
        <button type="button" class="cerrar-modal-detalle" id="cerrarDetalleDest">✕</button>
        <div class="detalle-contenido">
          <div class="detalle-imagen" id="destDetImgWrap">
            <img id="destDetImg" src="" alt="">
            <div id="destDetPh" class="detalle-placeholder" style="display:none;">✦</div>
          </div>
          <div class="detalle-info">
            <span class="detalle-categoria" id="destDetCat">Categoría</span>
            <h2 id="destDetNombre">Nombre</h2>
            <p class="detalle-descripcion" id="destDetDesc"></p>
            <p class="detalle-material" id="destDetMaterial"></p>
            <div class="detalle-precio" id="destDetPrecio">Bs 0.00</div>
            <div class="detalle-tallas">
              <span class="tallas-label">Talla</span>
              <div id="destDetTallas" class="tallas-btns"></div>
            </div>
            <button type="button" class="btn-agregar-carrito-detalle" id="btnDestAgregar">🛍️ Añadir al carrito</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('cerrarDetalleDest').onclick = () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    };
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
    document.getElementById('btnDestAgregar').onclick = () => {
      const p = window.__destProdActual;
      if (!p) return;
      const talla = modal.querySelector('#destDetTallas .talla-btn.seleccionada')?.dataset.talla;
      if (!talla) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecciona una talla', 'warn');
        return;
      }
      agregarAlCarrito({
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio) || 0,
        talla,
        cantidad: 1,
        imagen: p.imagen || ''
      });
      modal.classList.remove('active');
      document.body.style.overflow = '';
    };
  }
  window.__destProdActual = prod;
  const img = document.getElementById('destDetImg');
  const ph = document.getElementById('destDetPh');
  if (prod.imagen) {
    img.src = prod.imagen;
    img.style.display = 'block';
    if (ph) ph.style.display = 'none';
  } else {
    img.style.display = 'none';
    if (ph) ph.style.display = 'flex';
  }
  document.getElementById('destDetCat').textContent = prod.categoria || 'destacado';
  document.getElementById('destDetNombre').textContent = prod.nombre || 'Vestido';
  document.getElementById('destDetDesc').textContent = prod.descripcion || '';
  document.getElementById('destDetMaterial').innerHTML = prod.material ? '<strong>Material:</strong> ' + prod.material : '';
  document.getElementById('destDetPrecio').textContent = 'Bs ' + Number(prod.precio || 0).toFixed(2);
  const tallas = (prod.tallas && prod.tallas.length) ? prod.tallas : ['S', 'M', 'L'];
  const box = document.getElementById('destDetTallas');
  box.innerHTML = tallas.map(t => `<button type="button" class="talla-btn" data-talla="${t}">${t}</button>`).join('');
  box.querySelectorAll('.talla-btn').forEach(b => {
    b.onclick = () => {
      box.querySelectorAll('.talla-btn').forEach(x => x.classList.remove('seleccionada'));
      b.classList.add('seleccionada');
    };
  });
  (box.querySelector('[data-talla="M"]') || box.querySelector('.talla-btn'))?.classList.add('seleccionada');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

document.addEventListener('DOMContentLoaded', () => {
  const tema = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', tema);
  const btnTheme = document.getElementById('toggleTheme');
  if (btnTheme) {
    btnTheme.textContent = tema === 'dark' ? '☀️' : '🌙';
    btnTheme.addEventListener('click', () => {
      const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      btnTheme.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }

  document.getElementById('abrirCarrito')?.addEventListener('click', (e) => {
    e.preventDefault();
    carrito = cargarCarrito();
    renderCarrito();
    document.getElementById('modalCarrito')?.classList.add('active');
  });
  document.getElementById('cerrarModalCarrito')?.addEventListener('click', () => {
    document.getElementById('modalCarrito')?.classList.remove('active');
  });
  document.getElementById('vaciarCarrito')?.addEventListener('click', async () => {
    const ok = typeof confirmarElegante === 'function'
      ? await confirmarElegante({ titulo: '¿Vaciar el carrito?', mensaje: 'Se quitarán todos los vestidos.', okText: 'Sí, vaciar', peligro: true })
      : confirm('¿Vaciar carrito?');
    if (ok === false) return;
    carrito = [];
    guardarCarrito();
    renderCarrito();
    actualizarBadge();
    if (typeof mostrarToast === 'function') mostrarToast('Carrito vacío');
  });
  document.getElementById('procederPago')?.addEventListener('click', () => {
    carrito = cargarCarrito();
    if (!carrito.length) {
      if (typeof mostrarToast === 'function') mostrarToast('Tu carrito está vacío', 'error');
      return;
    }
    guardarCarrito();
    document.getElementById('modalCarrito')?.classList.remove('active');
    const total = carrito.reduce((s, i) => s + Number(i.precio) * Number(i.cantidad || 1), 0);
    const anticipo = total * 0.2;
    const tp = document.getElementById('totalPago');
    if (tp) tp.innerHTML = 'Total: <strong>Bs ' + total.toFixed(2) + '</strong> · Anticipo 20%: <strong>Bs ' + anticipo.toFixed(2) + '</strong>';
    // Asegurar que el método tarjeta esté activo y el form visible
    document.querySelectorAll('.metodo-btn').forEach(b => b.classList.toggle('active', b.dataset.metodo === 'tarjeta'));
    document.getElementById('formPagoTarjeta')?.classList.add('active');
    document.getElementById('formPagoQR')?.classList.remove('active');
    const modal = document.getElementById('modalPago');
    if (!modal) {
      if (typeof mostrarToast === 'function') mostrarToast('No se encontró el formulario de pago', 'error');
      return;
    }
    modal.classList.add('active');
  });
  document.getElementById('cerrarModalPago')?.addEventListener('click', () => {
    document.getElementById('modalPago')?.classList.remove('active');
  });
  document.querySelectorAll('.metodo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const m = btn.dataset.metodo;
      document.getElementById('formPagoTarjeta')?.classList.toggle('active', m === 'tarjeta');
      document.getElementById('formPagoQR')?.classList.toggle('active', m === 'qr');
    });
  });

  actualizarBadge();
  renderDestacadosHome();
});

window.agregarAlCarrito = agregarAlCarrito;
window.quitarDelCarrito = quitarDelCarrito;
window.renderCarrito = renderCarrito;
window.actualizarBadge = actualizarBadge;
window.vaciarCarritoTrasPago = vaciarCarritoTrasPago;
window.cargarCarrito = cargarCarrito;
window.guardarCarrito = guardarCarrito;
Object.defineProperty(window, 'carrito', {
  get() { return carrito; },
  set(v) { carrito = Array.isArray(v) ? v : []; guardarCarrito(); }
});

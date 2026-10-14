// Factura Stiliza — carrito → pago → factura + imagen
function generarFacturaHTML(datos) {
  const esVenta = datos.tipo === 'venta' || datos.tipo === 'venta_tienda';
  const fechaObj = datos.fecha instanceof Date ? datos.fecha : new Date(datos.fecha || Date.now());
  const fechaStr = fechaObj.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  const items = datos.items || [];
  const filas = items.map(item => {
    const precio = Number(item.precio || item.unit_price || 0);
    const cant = Number(item.cantidad || item.quantity || 1);
    const sub = precio * cant;
    return `<tr>
      <td>${item.nombre || item.product_name || ''}</td>
      <td class="c">${item.talla || item.size || '—'}</td>
      <td class="r">Bs ${precio.toFixed(2)}</td>
      <td class="c">${cant}</td>
      <td class="r">Bs ${sub.toFixed(2)}</td>
    </tr>`;
  }).join('');
  const metodoLabel = { efectivo: 'Efectivo', qr: 'QR', tarjeta: 'Tarjeta' }[datos.metodo_pago || datos.payment_method]
    || (datos.metodo_pago || datos.payment_method || '');
  const total = Number(datos.total || 0);
  const anticipo = Number(datos.anticipo != null ? datos.anticipo : (esVenta ? total : total * 0.2));
  const saldo = Number(datos.saldo != null ? datos.saldo : Math.max(0, total - anticipo));

  const resumen = esVenta
    ? `<div class="fac-row"><span>Total pagado</span><span>Bs ${total.toFixed(2)}</span></div>
       ${metodoLabel ? `<div class="fac-row"><span>Método</span><span>${metodoLabel}</span></div>` : ''}
       <div class="fac-row fac-saldo"><span>Estado</span><span>Pagado · Entrega inmediata</span></div>`
    : `<div class="fac-row"><span>Total de la compra</span><span>Bs ${total.toFixed(2)}</span></div>
       <div class="fac-row fac-anticipo"><span>Anticipo pagado (20%)</span><span>Bs ${anticipo.toFixed(2)}</span></div>
       <div class="fac-row fac-saldo"><span>Saldo pendiente</span><span>Bs ${saldo.toFixed(2)}</span></div>
       ${metodoLabel ? `<div class="fac-row"><span>Método anticipo</span><span>${metodoLabel}</span></div>` : ''}`;

  const aviso = esVenta
    ? `<div class="fac-aviso fac-aviso-venta">
         <span class="fac-aviso-icon">✓</span>
         <div><strong>Venta en tienda.</strong> Entrega inmediata. No aplica saldo pendiente.</div>
       </div>`
    : `<div class="fac-aviso">
         <span class="fac-aviso-icon">!</span>
         <div>
           <strong>Importante:</strong> Tiene <strong>7 días</strong> para recoger su reserva.
           Si no la recoge, <strong>no hay reembolso del 20%</strong> de anticipo.
         </div>
       </div>
       <div class="fac-aviso fac-aviso-recepcion">
         <span class="fac-aviso-icon">📋</span>
         <div>
           <strong>Presente esta factura en la recepción del negocio</strong>
           para que le entreguen su reserva. Sin este comprobante no se hará la entrega.
         </div>
       </div>`;

  const logoPath = (location.pathname.includes('/dueno') || location.pathname.includes('/empleado'))
    ? '../assets/logo.webp' : 'assets/logo.webp';

  return `
  <div class="fac-paper fac-paper-color" id="facturaPrintable">
    <div class="fac-logo-area">
      <img src="${logoPath}" class="fac-logo" alt="Stiliza" style="max-height:52px;width:auto;" onerror="this.style.display='none'">
      <div class="fac-brand">Stiliza</div>
      <div class="fac-tagline">VESTIDOS QUE TE DEFINEN</div>
    </div>
    <h1 class="fac-titulo">${esVenta ? 'COMPROBANTE DE VENTA' : 'COMPROBANTE DE RESERVA'}</h1>
    <div class="fac-ornament">✦</div>
    <div class="fac-meta">
      <div class="fac-cliente">
        <span class="fac-label">CLIENTE</span>
        <span class="fac-valor">${datos.cliente || ''}</span>
        ${datos.telefono ? `<span class="fac-tel">${datos.telefono}</span>` : ''}
      </div>
      <div class="fac-nums">
        <div><span class="fac-label">N°</span><span class="fac-valor">${datos.numero || ''}</span></div>
        <div><span class="fac-label">FECHA</span><span class="fac-valor">${fechaStr}</span></div>
      </div>
    </div>
    <table class="fac-tabla">
      <thead>
        <tr>
          <th>VESTIDO</th><th class="c">TALLA</th><th class="r">PRECIO</th>
          <th class="c">CANT.</th><th class="r">SUBTOTAL</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="fac-resumen">${resumen}</div>
    ${aviso}
    <div class="fac-footer">
      <span>📍 Mercado Central Satélite Norte, Warnes</span>
      <span>📞 +591 74954029</span>
    </div>
  </div>`;
}

function ensureFacturaStyles() {
  if (document.getElementById('stiliza-factura-styles')) return;
  const s = document.createElement('style');
  s.id = 'stiliza-factura-styles';
  s.textContent = `
    .fac-paper{max-width:640px;margin:0 auto;background:linear-gradient(180deg,#fdf8f4 0%,#faf3ed 100%);
      padding:32px 28px;color:#3a322c;border:1px solid #e8d5c8;border-radius:12px;font-family:Inter,system-ui,sans-serif;}
    .fac-logo-area{text-align:center;margin-bottom:8px}
    .fac-brand{font-family:'Playfair Display',Georgia,serif;font-size:1.85rem;color:#b48b7a;font-style:italic}
    .fac-tagline{font-size:0.68rem;letter-spacing:2.5px;color:#a89080;text-align:center}
    .fac-titulo{text-align:center;color:#b48b7a;letter-spacing:2px;font-family:'Playfair Display',Georgia,serif;
      font-size:1.15rem;margin:12px 0 4px}
    .fac-ornament{text-align:center;color:#d4a5a5;margin-bottom:12px}
    .fac-meta{display:flex;justify-content:space-between;gap:1rem;margin:14px 0;flex-wrap:wrap}
    .fac-label{display:block;font-size:0.65rem;letter-spacing:1px;color:#a89080}
    .fac-valor{font-weight:600;color:#3a322c}
    .fac-tel{display:block;font-size:0.85rem;color:#6b5c52}
    .fac-tabla{width:100%;border-collapse:collapse;font-size:0.88rem;margin:12px 0}
    .fac-tabla th{background:#f5ebe4;padding:8px 6px;text-align:left;font-size:0.72rem;letter-spacing:0.5px;color:#6b5c52}
    .fac-tabla td{padding:8px 6px;border-bottom:1px solid #f0e8e0}
    .fac-tabla .c{text-align:center}.fac-tabla .r{text-align:right}
    .fac-resumen{margin:12px 0 0 auto;width:min(280px,100%)}
    .fac-row{display:flex;justify-content:space-between;padding:5px 0;font-size:0.9rem}
    .fac-anticipo span:last-child{color:#2e7d32;font-weight:600}
    .fac-saldo span:last-child{color:#b45309;font-weight:700}
    .fac-aviso{margin-top:14px;padding:12px 14px;background:#fdf2ed;border-radius:10px;font-size:0.84rem;
      display:flex;gap:10px;align-items:flex-start;border:1px solid #f0d9cc}
    .fac-aviso-icon{font-size:1.1rem;line-height:1.2}
    .fac-aviso-recepcion{background:#eef6f1;border-color:#c5e0d0}
    .fac-aviso-venta{background:#eef6f1;border-color:#c5e0d0}
    .fac-footer{margin-top:18px;padding-top:12px;border-top:1px dashed #e8d5c8;font-size:0.78rem;
      color:#8a7a6e;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}
    .factura-acciones{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px;padding:0 8px 12px}
    .factura-acciones .btn{min-width:130px}
    .btn-pagar:disabled{opacity:0.65;cursor:wait}
  `;
  document.head.appendChild(s);
}

function mostrarFactura(datos) {
  ensureFacturaStyles();
  let modal = document.getElementById('modalFactura');
  let cont = document.getElementById('facturaContenido');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalFactura';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-factura" style="max-width:720px;width:95%;max-height:92vh;overflow:auto;background:#fff;border-radius:16px;padding:12px;position:relative;margin:auto;">
        <button type="button" class="cerrar-modal" id="cerrarModalFactura">✕</button>
        <div id="facturaContenido"></div>
        <div class="factura-acciones">
          <button type="button" class="btn btn-primario" id="btnImprimirFactura">🖨️ Imprimir / PDF</button>
          <button type="button" class="btn btn-primario" id="btnDescargarImagen">📥 Descargar imagen</button>
          <button type="button" class="btn btn-secundario" id="cerrarFac2">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    cont = document.getElementById('facturaContenido');
  }

  // Asegurar botones de acción
  let acciones = modal.querySelector('.factura-acciones');
  if (!acciones) {
    acciones = document.createElement('div');
    acciones.className = 'factura-acciones';
    acciones.innerHTML = `
      <button type="button" class="btn btn-primario" id="btnImprimirFactura">🖨️ Imprimir / PDF</button>
      <button type="button" class="btn btn-primario" id="btnDescargarImagen">📥 Descargar imagen</button>
      <button type="button" class="btn btn-secundario" id="cerrarFac2">Cerrar</button>`;
    modal.querySelector('.modal-factura')?.appendChild(acciones);
  }
  if (!document.getElementById('btnDescargarImagen') && !document.getElementById('btnDescargarFacturaImg')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-primario';
    b.id = 'btnDescargarImagen';
    b.textContent = '📥 Descargar imagen';
    acciones.insertBefore(b, acciones.lastElementChild);
  }

  cont = document.getElementById('facturaContenido');
  cont.innerHTML = generarFacturaHTML(datos);

  const cerrar = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };
  document.getElementById('cerrarModalFactura')?.addEventListener('click', cerrar, { once: true });
  document.getElementById('cerrarFac2')?.addEventListener('click', cerrar, { once: true });
  document.getElementById('btnImprimirFactura')?.addEventListener('click', imprimirFactura);
  document.getElementById('btnDescargarImagen')?.addEventListener('click', descargarFacturaImagen);
  document.getElementById('btnDescargarFacturaImg')?.addEventListener('click', descargarFacturaImagen);

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function imprimirFactura() {
  const el = document.getElementById('facturaPrintable');
  if (!el) return;
  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) {
    if (typeof mostrarToast === 'function') mostrarToast('Permite ventanas emergentes para imprimir', 'warn');
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><title>Comprobante Stiliza</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
      body{font-family:Inter,sans-serif;padding:20px;background:#fff;margin:0}
      .fac-paper{max-width:640px;margin:0 auto;background:#fdf8f4;padding:36px;color:#3a322c;border:1px solid #e8d5c8}
      .fac-brand{font-family:'Playfair Display',serif;font-size:1.8rem;color:#b48b7a;font-style:italic;text-align:center}
      .fac-tagline{text-align:center;font-size:0.7rem;letter-spacing:2px;color:#a89080}
      .fac-titulo{text-align:center;color:#b48b7a;letter-spacing:2px;font-family:'Playfair Display',serif}
      .fac-ornament{text-align:center;color:#d4a5a5}
      .fac-meta{display:flex;justify-content:space-between;margin:14px 0}
      .fac-label{display:block;font-size:0.65rem;color:#a89080}
      .fac-tabla{width:100%;border-collapse:collapse;font-size:0.88rem}
      .fac-tabla th{background:#f5ebe4;padding:8px;text-align:left}
      .fac-tabla td{padding:8px;border-bottom:1px solid #f0e8e0}
      .c{text-align:center}.r{text-align:right}
      .fac-resumen{margin-left:auto;width:260px}
      .fac-row{display:flex;justify-content:space-between;padding:4px 0}
      .fac-aviso{margin-top:14px;padding:12px;background:#fdf2ed;border-radius:10px;font-size:0.85rem;display:flex;gap:8px}
      .fac-aviso-recepcion{background:#eef6f1}
      .fac-footer{margin-top:16px;font-size:0.8rem;color:#8a7a6e;display:flex;justify-content:space-between}
    </style></head><body>${el.outerHTML}
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
    </body></html>`);
  w.document.close();
}

function loadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve(window.html2canvas);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error('html2canvas'));
    document.head.appendChild(s);
  });
}

async function descargarFacturaImagen() {
  const el = document.getElementById('facturaPrintable');
  if (!el) {
    if (typeof mostrarToast === 'function') mostrarToast('No hay factura para descargar', 'error');
    return;
  }
  const btn = document.getElementById('btnDescargarImagen') || document.getElementById('btnDescargarFacturaImg');
  const prev = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  try {
    const html2canvas = await loadHtml2Canvas();
    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fdf8f4', logging: false
    });
    const a = document.createElement('a');
    const num = el.querySelector('.fac-nums .fac-valor')?.textContent || 'Stiliza';
    a.download = 'Factura_Stiliza_' + String(num).replace(/\s+/g, '_') + '.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof mostrarToast === 'function') mostrarToast('Imagen descargada');
  } catch (err) {
    console.error(err);
    const w = window.open('', '_blank', 'width=700,height=900');
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><title>Factura</title></head><body style="padding:16px;font-family:sans-serif">
        <p>Clic derecho sobre la factura → Guardar imagen como…</p>${el.outerHTML}</body></html>`);
      w.document.close();
    }
    if (typeof mostrarToast === 'function') mostrarToast('Abrí la factura para guardarla como imagen', 'info');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = prev || '📥 Descargar imagen'; }
  }
}

function getCarritoItems() {
  try {
    if (typeof window.cargarCarrito === 'function') {
      const c = window.cargarCarrito();
      if (Array.isArray(c) && c.length) return c;
    }
  } catch (_) {}
  try {
    if (Array.isArray(window.carrito) && window.carrito.length) return window.carrito;
  } catch (_) {}
  try {
    const a = JSON.parse(localStorage.getItem('stiliza_carrito') || '[]');
    if (Array.isArray(a) && a.length) return a;
  } catch (_) {}
  try {
    const b = JSON.parse(sessionStorage.getItem('stiliza_carrito') || '[]');
    if (Array.isArray(b) && b.length) return b;
  } catch (_) {}
  return [];
}

async function generarFacturaCompleta(nombre, telefono, payment_method) {
  const cartItems = getCarritoItems();
  if (!cartItems.length) {
    if (typeof mostrarToast === 'function') mostrarToast('Tu carrito está vacío', 'error');
    return false;
  }
  const items = cartItems.map(i => ({
    product_id: i.id,
    product_name: i.nombre,
    nombre: i.nombre,
    size: i.talla || 'M',
    talla: i.talla || 'M',
    unit_price: Number(i.precio) || 0,
    precio: Number(i.precio) || 0,
    quantity: Number(i.cantidad) || 1,
    cantidad: Number(i.cantidad) || 1
  }));
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  if (total <= 0) {
    if (typeof mostrarToast === 'function') mostrarToast('El total debe ser mayor a 0', 'error');
    return false;
  }
  const anticipo = Math.round(total * 0.2 * 100) / 100;
  const saldo = Math.round((total - anticipo) * 100) / 100;
  const numero = 'R-2026-' + String(Math.floor(Math.random() * 90000) + 10000);
  const fecha = new Date().toISOString();

  const reserva = {
    id: 'local-' + Date.now(),
    numero,
    reservation_number: numero,
    cliente: nombre,
    customer_name: nombre,
    telefono: telefono || '',
    customer_phone: telefono || '',
    items,
    reservation_items: items,
    total,
    total_amount: total,
    anticipo,
    deposit_amount: anticipo,
    saldo,
    remaining_amount: saldo,
    estado: 'pendiente',
    pickup_status: 'pendiente',
    tipo: 'reserva',
    metodo_pago: payment_method || 'tarjeta',
    payment_method: payment_method || 'tarjeta',
    fecha,
    created_at: fecha
  };

  try {
    const lista = JSON.parse(localStorage.getItem('stiliza_reservas') || '[]');
    lista.push(reserva);
    localStorage.setItem('stiliza_reservas', JSON.stringify(lista));
  } catch (_) {}

  try {
    window.StilizaReservations?.createReservation?.({
      customer_name: nombre,
      customer_phone: telefono || '',
      items,
      payment_method: payment_method || 'tarjeta',
      tipo: 'reserva'
    }).catch(() => {});
  } catch (_) {}

  if (typeof window.vaciarCarritoTrasPago === 'function') window.vaciarCarritoTrasPago();
  else {
    try {
      localStorage.removeItem('stiliza_carrito');
      sessionStorage.removeItem('stiliza_carrito');
      if (window.carrito) window.carrito = [];
    } catch (_) {}
  }

  document.getElementById('modalPago')?.classList.remove('active');
  document.getElementById('modalCarrito')?.classList.remove('active');

  mostrarFactura({
    numero,
    cliente: nombre,
    telefono,
    items: items.map(i => ({ nombre: i.nombre, talla: i.talla, precio: i.precio, cantidad: i.cantidad })),
    total,
    anticipo,
    saldo,
    fecha,
    tipo: 'reserva',
    payment_method: payment_method || 'tarjeta'
  });
  if (typeof mostrarToast === 'function') mostrarToast('¡Reserva registrada!');
  return true;
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Procesando…</span>';
  } else {
    btn.disabled = false;
    if (btn.dataset.prev) btn.innerHTML = btn.dataset.prev;
  }
}

function wirePagoForms() {
  // Métodos de pago
  document.querySelectorAll('.metodo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const m = btn.dataset.metodo;
      document.getElementById('formPagoTarjeta')?.classList.toggle('active', m === 'tarjeta');
      document.getElementById('formPagoQR')?.classList.toggle('active', m === 'qr');
    });
  });

  // Formato tarjeta visual
  const tarjeta = document.getElementById('tarjeta');
  if (tarjeta && !tarjeta.dataset.wired) {
    tarjeta.dataset.wired = '1';
    tarjeta.addEventListener('input', () => {
      let v = tarjeta.value.replace(/\D/g, '').slice(0, 16);
      tarjeta.value = v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    });
  }
  const cad = document.getElementById('caducidad');
  if (cad && !cad.dataset.wired) {
    cad.dataset.wired = '1';
    cad.addEventListener('input', () => {
      let v = cad.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
      cad.value = v;
    });
  }

  const formT = document.getElementById('formPagoTarjeta');
  if (formT && !formT.dataset.wired) {
    formT.dataset.wired = '1';
    formT.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nombre = (document.getElementById('nombre')?.value || '').trim();
      const tel = (document.getElementById('telefono')?.value || '').trim();
      if (!nombre) {
        if (typeof mostrarToast === 'function') mostrarToast('Ingresa tu nombre completo', 'error');
        document.getElementById('nombre')?.focus();
        return;
      }
      // Validación visual de tarjeta (opcional pero se ve profesional)
      const num = (document.getElementById('tarjeta')?.value || '').replace(/\s/g, '');
      if (num && num.length < 13) {
        if (typeof mostrarToast === 'function') mostrarToast('Número de tarjeta incompleto', 'warn');
        return;
      }
      const btn = formT.querySelector('.btn-pagar, button[type="submit"]');
      setBtnLoading(btn, true);
      try {
        // Pequeña pausa para sensación de procesamiento real
        await new Promise(r => setTimeout(r, 600));
        await generarFacturaCompleta(nombre, tel, 'tarjeta');
      } finally {
        setBtnLoading(btn, false);
      }
    });
  }

  const formQ = document.getElementById('formPagoQR');
  if (formQ && !formQ.dataset.wired) {
    formQ.dataset.wired = '1';
    formQ.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nombre = (document.getElementById('nombre-qr')?.value || '').trim();
      const tel = (document.getElementById('telefono-qr')?.value || '').trim();
      if (!nombre) {
        if (typeof mostrarToast === 'function') mostrarToast('Ingresa tu nombre completo', 'error');
        document.getElementById('nombre-qr')?.focus();
        return;
      }
      const btn = formQ.querySelector('.btn-pagar, button[type="submit"]');
      setBtnLoading(btn, true);
      try {
        await new Promise(r => setTimeout(r, 500));
        await generarFacturaCompleta(nombre, tel, 'qr');
      } finally {
        setBtnLoading(btn, false);
      }
    });
  }

  document.getElementById('btnImprimirFactura')?.addEventListener('click', imprimirFactura);
  document.getElementById('btnDescargarImagen')?.addEventListener('click', descargarFacturaImagen);
  document.getElementById('btnDescargarFacturaImg')?.addEventListener('click', descargarFacturaImagen);
  document.getElementById('cerrarModalFactura')?.addEventListener('click', () => {
    document.getElementById('modalFactura')?.classList.remove('active');
    document.body.style.overflow = '';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wirePagoForms);
} else {
  wirePagoForms();
}

window.mostrarFactura = mostrarFactura;
window.generarFacturaCompleta = generarFacturaCompleta;
window.imprimirFactura = imprimirFactura;
window.descargarFacturaImagen = descargarFacturaImagen;
window.generarFacturaHTML = generarFacturaHTML;
window.getCarritoItems = getCarritoItems;

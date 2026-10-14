// Panel Dueño — local-first (rápido) + Supabase opcional en segundo plano
let productos = [];
let reservas = [];
let empleados = [];
let editId = null;
let editEmpEmail = null;

function esEmpleadoBloqueado(email) {
  const em = String(email || '').toLowerCase();
  return ['doristiliza', 'empleado@ejemplo'].some(b => em.includes(b));
}

function comprimirImagen(dataUrl, maxW, calidad) {
  return new Promise((resolve) => {
    if (!dataUrl || !String(dataUrl).startsWith('data:image')) {
      resolve(dataUrl || '');
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const max = maxW || 700;
        let w = img.width, h = img.height;
        if (w > max) { h = Math.round(h * (max / w)); w = max; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', calidad || 0.6));
      } catch (_) { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

function safeSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    try {
      const light = (Array.isArray(data) ? data : []).map(p => {
        if (!p || typeof p !== 'object') return p;
        const o = { ...p };
        if (o.imagen && String(o.imagen).length > 50000) o.imagen = '';
        if (o.image_url && String(o.image_url).length > 50000) o.image_url = '';
        return o;
      });
      localStorage.setItem(key, JSON.stringify(light));
      mostrarToast?.('Espacio lleno: se guardó sin algunas imágenes grandes', 'warn');
      return true;
    } catch (_) {
      mostrarToast?.('No hay espacio en el navegador', 'error');
      return false;
    }
  }
}

function leerProductos() {
  try {
    const arr = JSON.parse(localStorage.getItem('stiliza_productos_admin') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function guardarProductos(lista) {
  return safeSet('stiliza_productos_admin', lista);
}
function leerReservas() {
  try {
    const arr = JSON.parse(localStorage.getItem('stiliza_reservas') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}
function leerEmpleadosAuth() {
  try {
    return JSON.parse(localStorage.getItem('stiliza_empleados_auth') || '[]')
      .filter(e => e && e.email && !esEmpleadoBloqueado(e.email));
  } catch (_) { return []; }
}
function guardarEmpleadosAuth(lista) {
  localStorage.setItem('stiliza_empleados_auth', JSON.stringify(lista));
  const simple = lista.map(e => e.email);
  localStorage.setItem('stiliza_empleados', JSON.stringify(simple));
}

function mostrarPreviewImagen(hiddenId, previewWrapId, previewImgId, placeholderId) {
  const val = document.getElementById(hiddenId)?.value || '';
  const wrap = document.getElementById(previewWrapId);
  const img = document.getElementById(previewImgId);
  const ph = document.getElementById(placeholderId);
  if (val && img) {
    img.src = val;
    if (wrap) wrap.style.display = 'block';
    if (img.style) img.style.display = 'block';
    if (ph) ph.style.display = 'none';
  } else {
    if (wrap) wrap.style.display = 'none';
    if (ph) ph.style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const profile = (window.StilizaAuth && window.StilizaAuth.requireRole)
    ? window.StilizaAuth.requireRole(['dueno'])
    : JSON.parse(localStorage.getItem('stiliza_session') || 'null');
  if (!profile || profile.role !== 'dueno') {
    location.href = (location.pathname.includes('/dueno/') ? '../' : '') + 'index.html';
    return;
  }
  const oe = document.getElementById('ownerEmail');
  if (oe) oe.textContent = profile.email || 'dueno@stiliza.com';

  const KEY = 'theme_dueno';
  const saved = localStorage.getItem(KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('toggleThemePanel');
  if (btn) {
    btn.textContent = saved === 'dark' ? '☀️' : '🌙';
    btn.onclick = () => {
      const n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', n);
      localStorage.setItem(KEY, n);
      btn.textContent = n === 'dark' ? '☀️' : '🌙';
    };
  }

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const s = item.dataset.section;
      if (!s) return;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.panel-section').forEach(x => x.classList.remove('active'));
      document.getElementById('section-' + s)?.classList.add('active');
      const titles = {
        dashboard: 'Dashboard', productos: 'Productos', reservas: 'Reservas', empleados: 'Empleados',
        estadisticas: 'Estadísticas', destacados: 'Destacados', promociones: 'Promociones', mensajes: 'Mensajes'
      };
      const pt = document.getElementById('panelTitle');
      if (pt) pt.textContent = titles[s] || s;
      // render inmediato (local)
      if (s === 'dashboard') renderDashboard();
      if (s === 'productos') renderProductos();
      if (s === 'reservas') renderReservas();
      if (s === 'empleados') renderEmpleados();
      if (s === 'estadisticas') renderEstadisticas();
      if (s === 'mensajes') renderMensajes();
      if (s === 'destacados') renderDestacados();
      if (s === 'promociones') renderPromos();
    });
  });

  setupProductos();
  setupEmpleados();
  setupReservasFiltros();
  setupDestacados();
  setupPromos();

  // Carga inmediata del dashboard al entrar
  renderDashboard();
  renderProductos();
  renderEmpleados();
});

function renderDashboard() {
  productos = leerProductos();
  reservas = leerReservas();
  const auth = leerEmpleadosAuth();

  const prodsActivos = productos.filter(p => p && (p.is_active !== false) && (p.activo !== false) && (p.name || p.nombre)).length;
  const lista = reservas.map(r => ({
    ...r,
    reservation_number: r.reservation_number || r.numero || '—',
    customer_name: r.customer_name || r.cliente || 'Cliente',
    deposit_amount: Number(r.deposit_amount ?? r.anticipo ?? 0),
    total_amount: Number(r.total_amount ?? r.total ?? 0),
    pickup_status: r.pickup_status || r.estado || 'pendiente',
    employee_email: r.employee_email || r.empleado || ''
  }));
  const pendientes = lista.filter(r => r.pickup_status === 'pendiente').length;
  const ingresos = lista.reduce((s, r) => s + r.deposit_amount, 0);

  const elR = document.getElementById('statReservas');
  const elI = document.getElementById('statIngresos');
  const elP = document.getElementById('statProductos');
  const elPend = document.getElementById('statPendientes');
  if (elR) elR.textContent = lista.length;
  if (elI) elI.textContent = 'Bs ' + ingresos.toFixed(0);
  if (elP) elP.textContent = prodsActivos;
  if (elPend) elPend.textContent = pendientes;

  const cont = document.getElementById('ultimasReservas');
  if (cont) {
    const ultimas = lista.slice().sort((a, b) => new Date(b.created_at || b.fecha || 0) - new Date(a.created_at || a.fecha || 0)).slice(0, 5);
    cont.innerHTML = ultimas.length ? ultimas.map(r => {
      const total = Number(r.total_amount || r.total || 0);
      const ant = Number(r.deposit_amount || r.anticipo || 0);
      const saldo = Number(r.remaining_amount != null ? r.remaining_amount : (r.saldo != null ? r.saldo : Math.max(0, total - ant)));
      const esVenta = r.tipo === 'venta_tienda' || r.pickup_status === 'vendido';
      return `
      <div class="mini-row">
        <div>
          <strong>${r.reservation_number}</strong>
          <small>${r.customer_name}</small>
          ${esVenta ? '' : `<small style="display:block;color:#b45309;">Falta: Bs ${saldo.toFixed(0)}</small>`}
        </div>
        <div class="mini-right">
          <span class="badge ${r.pickup_status}">${r.pickup_status}</span>
          <strong>Ant. Bs ${ant.toFixed(0)}</strong>
        </div>
      </div>`;
    }).join('') : '<p class="empty-msg">Sin reservas aún</p>';
  }

  const topBox = document.getElementById('topEmpleado');
  if (topBox) {
    const byEmp = {};
    lista.forEach(r => {
      const em = r.employee_email;
      if (!em || esEmpleadoBloqueado(em)) return;
      if (!byEmp[em]) byEmp[em] = { count: 0, total: 0 };
      byEmp[em].count += 1;
      byEmp[em].total += r.total_amount || r.deposit_amount;
    });
    const ranking = Object.entries(byEmp).sort((a, b) => b[1].count - a[1].count);
    if (!ranking.length) {
      topBox.innerHTML = '<p class="empty-msg">Aún no hay ventas de empleados</p>';
    } else {
      const [email, info] = ranking[0];
      const emp = auth.find(e => e.email === email);
      const nombre = emp?.nombre || email.split('@')[0];
      topBox.innerHTML = `
        <div class="top-emp-card">
          <div class="top-emp-avatar">${(nombre || 'E')[0].toUpperCase()}</div>
          <div class="top-emp-info">
            <span class="top-emp-label">🏆 Más ventas</span>
            <strong class="top-emp-name">${nombre}</strong>
            <small>${email}</small>
          </div>
          <div class="top-emp-nums">
            <div><span class="num">${info.count}</span><small>ventas</small></div>
            <div><span class="num">Bs ${info.total.toFixed(0)}</span><small>monto</small></div>
          </div>
        </div>`;
    }
  }
}

function setupProductos() {
  const modal = document.getElementById('modalProducto');
  document.getElementById('btnNuevoProducto')?.addEventListener('click', () => {
    editId = null;
    document.getElementById('formProducto')?.reset();
    const hi = document.getElementById('prodImagen');
    if (hi) hi.value = '';
    const prev = document.getElementById('prodImagenPreview');
    if (prev) prev.style.display = 'none';
    const ph = document.getElementById('imgUploadPlaceholder');
    if (ph) ph.style.display = 'flex';
    modal?.classList.add('active');
  });
  document.getElementById('cerrarModalProducto')?.addEventListener('click', () => modal?.classList.remove('active'));

  document.getElementById('prodImagenFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await comprimirImagen(ev.target.result, 700, 0.55);
      const hi = document.getElementById('prodImagen');
      if (hi) hi.value = compressed;
      const img = document.getElementById('prodImagenPreviewImg');
      const prev = document.getElementById('prodImagenPreview');
      const ph = document.getElementById('imgUploadPlaceholder');
      if (img) { img.src = compressed; }
      if (prev) prev.style.display = 'block';
      if (ph) ph.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('btnQuitarImg')?.addEventListener('click', () => {
    const hi = document.getElementById('prodImagen');
    if (hi) hi.value = '';
    const prev = document.getElementById('prodImagenPreview');
    if (prev) prev.style.display = 'none';
    const ph = document.getElementById('imgUploadPlaceholder');
    if (ph) ph.style.display = 'flex';
  });

  document.getElementById('formProducto')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tallas = [...document.querySelectorAll('#formProducto .tallas-check input:checked')]
      .map(c => c.value);
    let imageData = document.getElementById('prodImagen')?.value || '';
    if (imageData && imageData.length > 350000) {
      imageData = await comprimirImagen(imageData, 500, 0.45);
    }
    const name = document.getElementById('prodNombre').value.trim();
    const price = parseFloat(document.getElementById('prodPrecio').value) || 0;
    if (!name || price <= 0) {
      mostrarToast?.('Nombre y precio obligatorios', 'error');
      return;
    }
    let local = leerProductos();
    const row = {
      id: editId || ('local-' + Date.now()),
      nombre: name, name,
      descripcion: document.getElementById('prodDesc')?.value.trim() || '',
      description: document.getElementById('prodDesc')?.value.trim() || '',
      material: document.getElementById('prodMaterial')?.value.trim() || '',
      categoria: document.getElementById('prodCategoria').value,
      category: document.getElementById('prodCategoria').value,
      precio: price, price,
      imagen: imageData, image_url: imageData,
      tallas: tallas.length ? tallas : ['S', 'M', 'L'],
      sizes: tallas.length ? tallas : ['S', 'M', 'L'],
      activo: true, is_active: true
    };
    if (editId) {
      const i = local.findIndex(x => String(x.id) === String(editId));
      if (i >= 0) {
        // conservar imagen si no se cambió
        if (!imageData && (local[i].imagen || local[i].image_url)) {
          row.imagen = local[i].imagen || local[i].image_url;
          row.image_url = row.imagen;
        }
        local[i] = { ...local[i], ...row };
      } else local.unshift(row);
    } else {
      local.unshift(row);
    }
    if (!guardarProductos(local)) return;
    modal?.classList.remove('active');
    mostrarToast?.('Producto guardado');
    renderProductos();
    renderDashboard();
  });
}

function renderProductos() {
  productos = leerProductos();
  const cont = document.getElementById('listaProductos');
  if (!cont) return;
  if (!productos.length) {
    cont.innerHTML = '<p class="empty-msg">No hay productos. Agrega el primero.</p>';
    return;
  }
  cont.innerHTML = `<div class="tabla-productos"><div class="tabla-header"><span>Producto</span><span>Categoría</span><span>Precio</span><span>Estado</span><span>Acciones</span></div>
    ${productos.map(p => {
      const nombre = p.name || p.nombre || '';
      const cat = p.category || p.categoria || '';
      const precio = Number(p.price ?? p.precio ?? 0);
      const activo = p.is_active !== false && p.activo !== false;
      const id = String(p.id || '').replace(/'/g, '');
      return `<div class="tabla-row ${activo ? '' : 'inactivo'}">
      <div class="prod-nombre"><strong>${nombre}</strong></div>
      <span class="cat-badge">${cat}</span>
      <strong class="precio-cell">Bs ${precio.toFixed(0)}</strong>
      <span class="badge ${activo ? 'activo' : 'inactivo'}">${activo ? 'Activo' : 'Oculto'}</span>
      <div class="acciones-cell">
        <button type="button" class="btn-icon" title="Editar" onclick="editarProducto('${id}')">✏️</button>
        <button type="button" class="btn-icon" title="${activo ? 'Ocultar' : 'Mostrar'}" onclick="toggleProducto('${id}')">${activo ? '👁️' : '🚫'}</button>
        <button type="button" class="btn-icon btn-danger" title="Eliminar" onclick="eliminarProducto('${id}')">🗑️</button>
      </div></div>`;
    }).join('')}</div>`;
}

window.editarProducto = (id) => {
  const p = leerProductos().find(x => String(x.id) === String(id));
  if (!p) return;
  editId = id;
  document.getElementById('prodNombre').value = p.name || p.nombre || '';
  document.getElementById('prodDesc').value = p.description || p.descripcion || '';
  document.getElementById('prodMaterial').value = p.material || '';
  document.getElementById('prodCategoria').value = p.category || p.categoria || 'gala';
  document.getElementById('prodPrecio').value = p.price ?? p.precio ?? 0;
  const img = p.image_url || p.imagen || '';
  const hi = document.getElementById('prodImagen');
  if (hi) hi.value = img;
  const prevImg = document.getElementById('prodImagenPreviewImg');
  const prev = document.getElementById('prodImagenPreview');
  const ph = document.getElementById('imgUploadPlaceholder');
  if (img && prevImg) {
    prevImg.src = img;
    if (prev) prev.style.display = 'block';
    if (ph) ph.style.display = 'none';
  } else {
    if (prev) prev.style.display = 'none';
    if (ph) ph.style.display = 'flex';
  }
  const sizes = p.sizes || p.tallas || [];
  document.querySelectorAll('#formProducto .tallas-check input').forEach(c => {
    c.checked = !sizes.length || sizes.includes(c.value);
  });
  document.getElementById('modalProducto')?.classList.add('active');
};

window.toggleProducto = (id) => {
  let local = leerProductos();
  const i = local.findIndex(x => String(x.id) === String(id));
  if (i < 0) return;
  const next = !(local[i].is_active !== false && local[i].activo !== false);
  local[i].is_active = next;
  local[i].activo = next;
  guardarProductos(local);
  mostrarToast?.(next ? 'Producto visible' : 'Producto oculto');
  renderProductos();
  renderDashboard();
};

window.eliminarProducto = async (id) => {
  const ok = typeof confirmarElegante === 'function'
    ? await confirmarElegante({ titulo: '¿Eliminar producto?', mensaje: 'Se quitará del catálogo.', okText: 'Eliminar', peligro: true })
    : confirm('¿Eliminar producto?');
  if (ok === false) return;
  guardarProductos(leerProductos().filter(x => String(x.id) !== String(id)));
  mostrarToast?.('Eliminado');
  renderProductos();
  renderDashboard();
};

function setupReservasFiltros() {
  document.querySelectorAll('#section-reservas .filtro-admin').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#section-reservas .filtro-admin').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const q = document.getElementById('buscarReservaCodigo')?.value || '';
      renderReservas(btn.dataset.filtro, q);
    });
  });
  const buscar = () => {
    const q = document.getElementById('buscarReservaCodigo')?.value || '';
    const filtro = document.querySelector('#section-reservas .filtro-admin.active')?.dataset.filtro || 'todas';
    renderReservas(filtro, q);
  };
  document.getElementById('btnBuscarReserva')?.addEventListener('click', buscar);
  document.getElementById('buscarReservaCodigo')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscar(); }
  });
  document.getElementById('buscarReservaCodigo')?.addEventListener('input', () => {
    // búsqueda en vivo al escribir
    buscar();
  });
  document.getElementById('btnLimpiarBusquedaReserva')?.addEventListener('click', () => {
    const inp = document.getElementById('buscarReservaCodigo');
    if (inp) inp.value = '';
    renderReservas(document.querySelector('#section-reservas .filtro-admin.active')?.dataset.filtro || 'todas', '');
  });
}

function montosReserva(r) {
  const total = Number(r.total || r.total_amount || 0);
  const st = r.pickup_status || r.estado || 'pendiente';
  const esVenta = r.tipo === 'venta_tienda' || st === 'vendido';
  const esRecogido = st === 'recogido';
  // Si ya se recogió = pagó el saldo completo
  let anticipo, saldo;
  if (esVenta || esRecogido) {
    anticipo = total;
    saldo = 0;
  } else {
    anticipo = Number(r.anticipo != null ? r.anticipo : (r.deposit_amount != null ? r.deposit_amount : total * 0.2));
    saldo = Number(r.saldo != null ? r.saldo : (r.remaining_amount != null ? r.remaining_amount : Math.max(0, total - anticipo)));
  }
  return { total, anticipo, saldo, st, esVenta, esRecogido };
}

function renderReservas(filtro = 'todas', busqueda = '') {
  let lista = leerReservas();
  const now = Date.now();
  let changed = false;
  lista = lista.map(r => {
    const st = r.pickup_status || r.estado || 'pendiente';
    if (st === 'pendiente' && r.tipo !== 'venta_tienda') {
      const created = new Date(r.created_at || r.fecha || 0).getTime();
      const deadline = r.pickup_deadline ? new Date(r.pickup_deadline).getTime() : (created + 7 * 86400000);
      if (created && now > deadline) {
        r.pickup_status = 'expirado';
        r.estado = 'expirado';
        changed = true;
      }
    }
    return r;
  });
  if (changed) {
    try { localStorage.setItem('stiliza_reservas', JSON.stringify(lista)); } catch (_) {}
  }
  if (filtro && filtro !== 'todas') {
    lista = lista.filter(r => (r.pickup_status || r.estado) === filtro);
  }
  const q = String(busqueda || '').trim().toLowerCase();
  if (q) {
    lista = lista.filter(r => {
      const num = String(r.numero || r.reservation_number || '').toLowerCase();
      const cli = String(r.cliente || r.customer_name || '').toLowerCase();
      const tel = String(r.telefono || r.customer_phone || '').toLowerCase();
      return num.includes(q) || cli.includes(q) || tel.includes(q);
    });
  }
  const cont = document.getElementById('listaReservas');
  if (!cont) return;

  if (!lista.length) {
    cont.innerHTML = '<p class="empty-msg">No hay reservas en este filtro</p>';
    return;
  }
  cont.innerHTML = lista.slice().reverse().map(r => {
    const num = r.numero || r.reservation_number || '—';
    const st = r.pickup_status || r.estado || 'pendiente';
    const items = r.items || r.reservation_items || [];
    const names = items.map(i => i.nombre || i.product_name).filter(Boolean).join(', ') || '';
    const id = r.id || num;
    const m = montosReserva(r);
    const total = m.total, anticipo = m.anticipo, saldo = m.saldo;
    const esVenta = m.esVenta;
    const esRecogido = m.esRecogido;
    return `<div class="reserva-admin-card">
      <div class="reserva-admin-header">
        <strong>${num}</strong>
        <span class="badge ${st}">${st}</span>
      </div>
      <div class="reserva-admin-body">
        <p><strong>Cliente:</strong> ${r.cliente || r.customer_name || ''}</p>
        <p><strong>Total:</strong> Bs ${total.toFixed(2)}</p>
        ${esVenta
          ? `<p><strong>Pagado completo:</strong> Bs ${total.toFixed(2)} <span style="opacity:.7;">(venta tienda)</span></p>`
          : esRecogido
            ? `<p><strong>Pagado completo:</strong> <span style="color:#2e7d32;font-weight:700;">Bs ${total.toFixed(2)}</span> <span style="opacity:.7;">(recogido · saldo saldado)</span></p>`
            : `<p><strong>Anticipo cobrado:</strong> <span style="color:#2e7d32;font-weight:600;">Bs ${anticipo.toFixed(2)}</span></p>
             <p><strong>Falta por pagar:</strong> <span style="color:#b45309;font-weight:700;">Bs ${saldo.toFixed(2)}</span></p>`}
        ${names ? `<p style="opacity:.85;">${names}</p>` : ''}
      </div>
      ${st === 'pendiente' ? `<div class="reserva-admin-actions">
        <button type="button" class="btn btn-primario btn-sm" onclick="marcarReserva('${String(id).replace(/'/g, '')}','recogido')">✓ Recogido</button>
        <button type="button" class="btn btn-secundario btn-sm" onclick="marcarReserva('${String(id).replace(/'/g, '')}','expirado')">Expirar</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

window.marcarReserva = (id, estado) => {
  const lista = leerReservas();
  const i = lista.findIndex(r => String(r.id) === String(id) || String(r.numero) === String(id) || String(r.reservation_number) === String(id));
  if (i >= 0) {
    lista[i].pickup_status = estado;
    lista[i].estado = estado;
    // Recogido = el cliente pagó el saldo que faltaba → queda en 0 pendiente
    if (estado === 'recogido') {
      const total = Number(lista[i].total || lista[i].total_amount || 0);
      lista[i].saldo = 0;
      lista[i].remaining_amount = 0;
      lista[i].anticipo = total;
      lista[i].deposit_amount = total;
      lista[i].payment_status = 'pagado';
      lista[i].pagado_completo = true;
    }
    try { localStorage.setItem('stiliza_reservas', JSON.stringify(lista)); } catch (_) {}
    try {
      if (lista[i].id && window.StilizaReservations?.updateStatus) {
        window.StilizaReservations.updateStatus(lista[i].id, estado).catch(() => {});
      }
    } catch (_) {}
  }
  mostrarToast?.(estado === 'recogido' ? 'Recogido · saldo pagado completo' : 'Actualizado');
  const q = document.getElementById('buscarReservaCodigo')?.value || '';
  renderReservas(document.querySelector('#section-reservas .filtro-admin.active')?.dataset.filtro || 'todas', q);
  renderDashboard();
};

function setupEmpleados() {
  const card = document.getElementById('formEmpleadoCard');
  document.getElementById('btnNuevoEmpleado')?.addEventListener('click', () => {
    editEmpEmail = null;
    document.getElementById('formNuevoEmpleado')?.reset();
    const h = card?.querySelector('h3');
    if (h) h.textContent = 'Nuevo empleado';
    if (card) card.style.display = 'block';
  });
  document.getElementById('cancelarEmpleado')?.addEventListener('click', () => {
    if (card) card.style.display = 'none';
    editEmpEmail = null;
  });
  document.getElementById('formNuevoEmpleado')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('empNombre')?.value.trim() || '';
    const email = (document.getElementById('empEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('empPassword')?.value || '';
    if (!email || !password) {
      mostrarToast?.('Correo y contraseña obligatorios', 'warn');
      return;
    }
    if (password.length < 6) {
      mostrarToast?.('Contraseña mínimo 6 caracteres', 'warn');
      return;
    }
    let lista = leerEmpleadosAuth();
    if (editEmpEmail) {
      const i = lista.findIndex(x => (x.email || '').toLowerCase() === editEmpEmail.toLowerCase());
      if (i >= 0) {
        lista[i] = { ...lista[i], email, password, nombre: nombre || lista[i].nombre };
      }
    } else {
      if (lista.some(x => (x.email || '').toLowerCase() === email)) {
        mostrarToast?.('Ese correo ya está registrado', 'warn');
        return;
      }
      lista.push({ email, password, nombre });
    }
    guardarEmpleadosAuth(lista);
    document.getElementById('formNuevoEmpleado')?.reset();
    if (card) card.style.display = 'none';
    editEmpEmail = null;
    mostrarToast?.(editEmpEmail ? 'Empleado actualizado' : 'Empleado creado');
    renderEmpleados();
  });
}

function renderEmpleados() {
  const lista = leerEmpleadosAuth();
  const cont = document.getElementById('listaEmpleados');
  if (!cont) return;
  if (!lista.length) {
    cont.innerHTML = '<p class="empty-msg">Sin empleados. Crea el primero con correo y contraseña.</p>';
    return;
  }
  cont.innerHTML = lista.map(e => {
    const nombre = e.nombre || e.name || e.email;
    const email = e.email || '';
    return `<div class="empleado-row">
      <div class="emp-avatar">${(nombre || 'E')[0].toUpperCase()}</div>
      <div class="emp-info"><strong>${nombre}</strong><small>${email}</small></div>
      <button type="button" class="btn-icon" title="Editar" onclick="editarEmpleado('${email.replace(/'/g, '')}')">✏️</button>
      <button type="button" class="btn-icon btn-danger" title="Eliminar" onclick="eliminarEmpleadoAuth('${email.replace(/'/g, '')}')">🗑️</button>
    </div>`;
  }).join('');
}

window.editarEmpleado = (email) => {
  const e = leerEmpleadosAuth().find(x => (x.email || '').toLowerCase() === String(email).toLowerCase());
  if (!e) return;
  editEmpEmail = e.email;
  document.getElementById('empNombre').value = e.nombre || '';
  document.getElementById('empEmail').value = e.email || '';
  document.getElementById('empPassword').value = e.password || '';
  const card = document.getElementById('formEmpleadoCard');
  const h = card?.querySelector('h3');
  if (h) h.textContent = 'Editar empleado';
  if (card) card.style.display = 'block';
  card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.eliminarEmpleadoAuth = async (email) => {
  const ok = typeof confirmarElegante === 'function'
    ? await confirmarElegante({ titulo: '¿Eliminar empleado?', mensaje: email, okText: 'Eliminar', peligro: true })
    : confirm('¿Eliminar ' + email + '?');
  if (ok === false) return;
  guardarEmpleadosAuth(leerEmpleadosAuth().filter(e => (e.email || '').toLowerCase() !== String(email).toLowerCase()));
  mostrarToast?.('Empleado eliminado');
  renderEmpleados();
};

function renderEstadisticas() {
  const reservasLocal = leerReservas();
  const prods = leerProductos();
  const empsAuth = leerEmpleadosAuth();
  const conteo = {};
  const imgs = {};
  prods.forEach(p => {
    const n = p.name || p.nombre;
    if (n) imgs[n] = p.image_url || p.imagen || '';
  });
  reservasLocal.forEach(r => {
    (r.reservation_items || r.items || []).forEach(i => {
      const key = i.product_name || i.nombre || 'Producto';
      conteo[key] = (conteo[key] || 0) + Number(i.quantity || i.cantidad || 1);
    });
  });
  const ranking = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  const top3 = ranking.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const el = document.getElementById('top3Vestidos');
  if (el) {
    el.innerHTML = top3.length
      ? `<div class="top3-grid">${top3.map(([n, c], i) => `
          <div class="top3-card rank-${i + 1}">
            <div class="top3-medal">${medals[i]}</div>
            <div class="top3-img">${imgs[n] ? `<img src="${imgs[n]}" alt="">` : '<span>👗</span>'}</div>
            <strong>${n}</strong>
            <span class="top3-cant">${c} venta${c !== 1 ? 's' : ''}</span>
          </div>`).join('')}</div>`
      : '<p class="empty-msg">Aún no hay ventas.</p>';
  }
  const ctx = document.getElementById('chartVestidos');
  if (ctx && window.Chart) {
    if (window.chartV) { try { window.chartV.destroy(); } catch (_) {} }
    if (ranking.length) {
      window.chartV = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ranking.slice(0, 8).map(([n]) => n.length > 22 ? n.slice(0, 22) + '…' : n),
          datasets: [{ data: ranking.slice(0, 8).map(([, c]) => c), backgroundColor: ['#b48b7a', '#d4a5a5', '#c9a88a', '#8b7355', '#e8c4b8', '#a67c6d', '#c4a484', '#9c7b6b'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, cutout: '55%' }
      });
    }
  }
  const byEmp = {};
  reservasLocal.forEach(r => {
    const email = r.employee_email || r.empleado;
    if (!email || esEmpleadoBloqueado(email)) return;
    if (!byEmp[email]) byEmp[email] = { count: 0 };
    byEmp[email].count++;
  });
  const contE = document.getElementById('graficoEmpleados');
  if (contE) {
    const entries = Object.entries(byEmp);
    empsAuth.forEach(e => { if (e.email && !byEmp[e.email]) entries.push([e.email, { count: 0 }]); });
    entries.sort((a, b) => b[1].count - a[1].count);
    contE.innerHTML = entries.length ? entries.map(([email, info]) => {
      const emp = empsAuth.find(e => e.email === email);
      const name = emp?.nombre || email.split('@')[0];
      return `<div class="emp-stat-card">
        <div class="emp-avatar">${(name || 'E')[0].toUpperCase()}</div>
        <div class="emp-stat-info"><strong>${name}</strong><small>${email}</small></div>
        <div class="emp-stat-num"><span class="num">${info.count}</span><small>ventas</small></div>
      </div>`;
    }).join('') : '<p class="empty-msg">Sin ventas de empleados aún</p>';
  }
}

function renderMensajes() {
  const cont = document.getElementById('listaMensajes');
  if (!cont) return;
  let msgs = [];
  try { msgs = JSON.parse(localStorage.getItem('stiliza_mensajes') || '[]'); } catch (_) {}
  msgs = msgs.slice().reverse();
  cont.innerHTML = msgs.length ? msgs.map(m => {
    const texto = encodeURIComponent('Hola ' + (m.name || m.nombre || '') + ', te escribe Stiliza.');
    return `<div class="msg-card">
      <div class="msg-header"><strong>${m.name || m.nombre || 'Cliente'}</strong>
      <small>${m.fecha || m.created_at ? new Date(m.fecha || m.created_at).toLocaleString('es-BO') : ''}</small></div>
      <p class="msg-email">${m.email || ''}</p>
      <p class="msg-body">${m.message || m.mensaje || ''}</p>
      <div class="msg-actions"><a class="btn btn-primario btn-sm" target="_blank" rel="noopener" href="https://wa.me/59174954029?text=${texto}">WhatsApp</a></div>
    </div>`;
  }).join('') : '<p class="empty-msg">Aún no hay mensajes de contacto</p>';
  // intentar Supabase en segundo plano
  try {
    window.StilizaMessages?.list?.().then(remote => {
      if (remote?.length) {
        const merged = [...remote, ...msgs];
        // no reescribir si ya hay locales
      }
    }).catch(() => {});
  } catch (_) {}
}

const PROMO_KEY = 'stiliza_promociones';
const DEST_KEY = 'stiliza_destacados';

function daysLeft(p) {
  if (p.end_date) {
    const end = new Date(p.end_date + 'T23:59:59');
    return Math.max(0, Math.ceil((end - new Date()) / 86400000));
  }
  if (p.created_at && p.days_total) {
    const start = new Date(p.created_at);
    const end = new Date(start.getTime() + Number(p.days_total) * 86400000);
    return Math.max(0, Math.ceil((end - new Date()) / 86400000));
  }
  return p.days_total || 0;
}
function loadPromos() {
  let list = null;
  try { list = JSON.parse(localStorage.getItem(PROMO_KEY) || 'null'); } catch (_) {}
  if (!list) list = [];
  return list;
}
function savePromos(list) { safeSet(PROMO_KEY, list); }
function loadDestacados() {
  try { return JSON.parse(localStorage.getItem(DEST_KEY) || '[]'); } catch { return []; }
}
function saveDestacados(list) { safeSet(DEST_KEY, list); }

function setupPromos() {
  const modal = document.getElementById('modalPromo');
  document.getElementById('btnNuevaPromo')?.addEventListener('click', () => {
    window.__editPromoId = null;
    document.getElementById('formPromo')?.reset();
    const pi = document.getElementById('promoImagen');
    if (pi) pi.value = '';
    const prev = document.getElementById('promoImagenPreview');
    if (prev) prev.style.display = 'none';
    const dias = document.getElementById('promoDias');
    if (dias) dias.value = '20';
    const tit = document.getElementById('tituloModalPromo');
    if (tit) tit.textContent = 'Nueva promoción';
    modal?.classList.add('active');
  });
  document.getElementById('cerrarModalPromo')?.addEventListener('click', () => modal?.classList.remove('active'));
  document.getElementById('promoImagenFile')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async (ev) => {
      const compressed = await comprimirImagen(ev.target.result, 600, 0.55);
      document.getElementById('promoImagen').value = compressed;
      document.getElementById('promoImagenPreviewImg').src = compressed;
      document.getElementById('promoImagenPreview').style.display = 'block';
    };
    r.readAsDataURL(f);
  });
  document.getElementById('formPromo')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const list = loadPromos();
    const dias = parseInt(document.getElementById('promoDias')?.value, 10) || 20;
    const fechaFin = document.getElementById('promoFechaFin')?.value || '';
    const created = new Date().toISOString();
    let imageData = document.getElementById('promoImagen').value || '';
    const payload = {
      id: window.__editPromoId || ('p' + Date.now()),
      title: document.getElementById('promoTitulo').value.trim(),
      description: document.getElementById('promoDesc').value.trim(),
      discount_percent: parseInt(document.getElementById('promoDescPct').value, 10) || 0,
      discount_label: document.getElementById('promoLabel').value.trim() || ('-' + (document.getElementById('promoDescPct').value || 0) + '%'),
      category: document.getElementById('promoCat').value,
      image_url: imageData,
      original_price: parseFloat(document.getElementById('promoPrecioBase')?.value) || 0,
      is_active: true,
      days_total: dias,
      end_date: fechaFin || null,
      created_at: window.__editPromoId ? (list.find(x => x.id === window.__editPromoId)?.created_at || created) : created
    };
    if (!fechaFin && dias > 0) {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      payload.end_date = d.toISOString().slice(0, 10);
    }
    if (!payload.title) return mostrarToast?.('Título requerido', 'warn');
    if (window.__editPromoId && !imageData) {
      const old = list.find(x => x.id === window.__editPromoId);
      if (old?.image_url) payload.image_url = old.image_url;
    }
    const idx = list.findIndex(x => x.id === payload.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...payload };
    else list.unshift(payload);
    savePromos(list);
    modal?.classList.remove('active');
    mostrarToast?.('Promoción guardada');
    renderPromos();
  });
}

function renderPromos() {
  const list = loadPromos();
  const cont = document.getElementById('listaPromos');
  if (!cont) return;
  if (!list.length) {
    cont.innerHTML = '<p class="empty-msg">No hay promociones. Crea la primera.</p>';
    return;
  }
  cont.innerHTML = list.map(p => {
    const left = daysLeft(p);
    const vencida = left <= 0;
    const activa = p.is_active !== false && !vencida;
    return `
    <div class="promo-admin-card ${!activa ? 'promo-inactiva' : ''}">
      <div class="promo-admin-img">${p.image_url ? `<img src="${p.image_url}" alt="">` : '<span>🌸</span>'}</div>
      <div class="promo-admin-info">
        <strong>${p.title}</strong>
        <small>${p.discount_label || ''} · ${p.category || ''}</small>
        <p>${(p.description || '').substring(0, 90)}</p>
        <div class="promo-timer ${vencida ? 'vencida' : ''}">${vencida ? '⏱ Finalizada' : '⏱ Quedan <strong>' + left + '</strong> días'}</div>
        <span class="badge ${activa ? 'activo' : 'inactivo'}">${activa ? 'Visible' : 'Oculta'}</span>
      </div>
      <div class="promo-admin-actions">
        <button type="button" class="btn-icon" onclick="togglePromoVisible('${p.id}')">${activa ? '👁️' : '🚫'}</button>
        <button type="button" class="btn-icon" onclick="editarPromo('${p.id}')">✏️</button>
        <button type="button" class="btn-icon btn-danger" onclick="eliminarPromo('${p.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

window.togglePromoVisible = (id) => {
  const list = loadPromos();
  const p = list.find(x => x.id === id);
  if (!p) return;
  if (daysLeft(p) <= 0) return mostrarToast?.('Esta promoción ya venció.', 'warn');
  p.is_active = !p.is_active;
  savePromos(list);
  renderPromos();
  mostrarToast?.(p.is_active ? 'Promoción visible' : 'Promoción ocultada');
};
window.editarPromo = (id) => {
  const p = loadPromos().find(x => x.id === id);
  if (!p) return;
  window.__editPromoId = id;
  document.getElementById('promoTitulo').value = p.title;
  document.getElementById('promoDesc').value = p.description || '';
  document.getElementById('promoDescPct').value = p.discount_percent || 0;
  document.getElementById('promoLabel').value = p.discount_label || '';
  document.getElementById('promoCat').value = p.category || 'general';
  if (document.getElementById('promoDias')) document.getElementById('promoDias').value = p.days_total || daysLeft(p) || 20;
  if (document.getElementById('promoPrecioBase')) document.getElementById('promoPrecioBase').value = p.original_price || '';
  if (document.getElementById('promoFechaFin')) document.getElementById('promoFechaFin').value = p.end_date || '';
  document.getElementById('promoImagen').value = p.image_url || '';
  if (p.image_url) {
    document.getElementById('promoImagenPreviewImg').src = p.image_url;
    document.getElementById('promoImagenPreview').style.display = 'block';
  }
  document.getElementById('tituloModalPromo').textContent = 'Editar promoción';
  document.getElementById('modalPromo')?.classList.add('active');
};
window.eliminarPromo = async (id) => {
  const ok = typeof confirmarElegante === 'function'
    ? await confirmarElegante({
        titulo: '¿Eliminar promoción?',
        mensaje: 'Se quitará de la lista de promociones.',
        okText: 'Eliminar',
        peligro: true
      })
    : confirm('¿Eliminar promoción?');
  if (ok === false) return;
  savePromos(loadPromos().filter(x => x.id !== id));
  mostrarToast?.('Promoción eliminada');
  renderPromos();
};

function setupDestacados() {
  const modal = document.getElementById('modalDestacado');
  document.getElementById('btnNuevoDestacado')?.addEventListener('click', () => {
    window.__editDestId = null;
    document.getElementById('formDestacado')?.reset();
    document.getElementById('destImagen').value = '';
    document.querySelectorAll('input[name="destTalla"]').forEach(c => {
      c.checked = ['S', 'M', 'L'].includes(c.value);
    });
    const prev = document.getElementById('destImagenPreviewImg');
    if (prev) { prev.style.display = 'none'; prev.src = ''; }
    const ph = document.getElementById('destImgPlaceholder');
    if (ph) ph.style.display = 'flex';
    modal?.classList.add('active');
  });
  document.getElementById('cerrarModalDestacado')?.addEventListener('click', () => modal?.classList.remove('active'));
  document.getElementById('destImagenFile')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async (ev) => {
      const compressed = await comprimirImagen(ev.target.result, 600, 0.55);
      document.getElementById('destImagen').value = compressed;
      const img = document.getElementById('destImagenPreviewImg');
      if (img) { img.src = compressed; img.style.display = 'block'; }
      const ph = document.getElementById('destImgPlaceholder');
      if (ph) ph.style.display = 'none';
    };
    r.readAsDataURL(f);
  });
  document.getElementById('formDestacado')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const list = loadDestacados();
    const tallas = [...document.querySelectorAll('input[name="destTalla"]:checked')].map(c => c.value);
    let imageData = document.getElementById('destImagen').value || '';
    const payload = {
      id: window.__editDestId || ('dest-' + Date.now()),
      nombre: document.getElementById('destNombre').value.trim(),
      descripcion: document.getElementById('destDesc').value.trim(),
      material: document.getElementById('destMaterial')?.value.trim() || '',
      precio: parseFloat(document.getElementById('destPrecio').value) || 0,
      categoria: document.getElementById('destCat').value,
      imagen: imageData,
      tallas: tallas.length ? tallas : ['S', 'M', 'L'],
      activo: true,
      is_active: true
    };
    if (!payload.nombre) return mostrarToast?.('Nombre requerido', 'warn');
    if (!payload.precio) return mostrarToast?.('Precio requerido', 'warn');
    if (window.__editDestId && !imageData) {
      const old = list.find(x => x.id === window.__editDestId);
      if (old?.imagen) payload.imagen = old.imagen;
    }
    const idx = list.findIndex(x => x.id === payload.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...payload };
    else list.unshift(payload);
    saveDestacados(list);
    modal?.classList.remove('active');
    mostrarToast?.('Destacado guardado');
    renderDestacados();
  });
}

function renderDestacados() {
  const list = loadDestacados();
  const cont = document.getElementById('listaDestacados');
  if (!cont) return;
  cont.innerHTML = list.length ? list.map(p => {
    const activo = p.activo !== false && p.is_active !== false;
    return `
    <div class="promo-admin-card ${!activo ? 'promo-inactiva' : ''}">
      <div class="promo-admin-img">${p.imagen ? `<img src="${p.imagen}" alt="">` : '<span>👗</span>'}</div>
      <div class="promo-admin-info">
        <strong>${p.nombre}</strong>
        <small>${p.categoria || ''} · Bs ${Number(p.precio).toFixed(0)}</small>
        <p>${(p.descripcion || '').substring(0, 80)}</p>
        <span class="badge ${activo ? 'activo' : 'inactivo'}">${activo ? 'Visible' : 'Oculto'}</span>
      </div>
      <div class="promo-admin-actions">
        <button type="button" class="btn-icon" title="${activo ? 'Ocultar' : 'Mostrar'}" onclick="toggleDestacado('${p.id}')">${activo ? '👁️' : '🚫'}</button>
        <button type="button" class="btn-icon" title="Editar" onclick="editarDestacado('${p.id}')">✏️</button>
        <button type="button" class="btn-icon btn-danger" title="Eliminar" onclick="eliminarDestacado('${p.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('') : '<p class="empty-msg">Aún no hay destacados.</p>';
}

window.toggleDestacado = (id) => {
  const list = loadDestacados();
  const p = list.find(x => x.id === id);
  if (!p) return;
  const next = !(p.activo !== false && p.is_active !== false);
  p.activo = next;
  p.is_active = next;
  saveDestacados(list);
  mostrarToast?.(next ? 'Destacado visible' : 'Destacado oculto');
  renderDestacados();
};

window.editarDestacado = (id) => {
  const p = loadDestacados().find(x => x.id === id);
  if (!p) return;
  window.__editDestId = id;
  document.getElementById('destNombre').value = p.nombre || '';
  document.getElementById('destDesc').value = p.descripcion || '';
  if (document.getElementById('destMaterial')) document.getElementById('destMaterial').value = p.material || '';
  document.getElementById('destPrecio').value = p.precio || 0;
  document.getElementById('destCat').value = p.categoria || 'gala';
  document.getElementById('destImagen').value = p.imagen || '';
  const img = document.getElementById('destImagenPreviewImg');
  const ph = document.getElementById('destImgPlaceholder');
  if (p.imagen && img) {
    img.src = p.imagen;
    img.style.display = 'block';
    if (ph) ph.style.display = 'none';
  }
  document.querySelectorAll('input[name="destTalla"]').forEach(c => {
    c.checked = (p.tallas || []).includes(c.value);
  });
  document.getElementById('modalDestacado')?.classList.add('active');
};

window.eliminarDestacado = async (id) => {
  const ok = typeof confirmarElegante === 'function'
    ? await confirmarElegante({
        titulo: '¿Quitar de destacados?',
        mensaje: 'Ya no aparecerá en la portada.',
        okText: 'Quitar',
        peligro: true
      })
    : confirm('¿Quitar de destacados?');
  if (ok === false) return;
  saveDestacados(loadDestacados().filter(x => x.id !== id));
  mostrarToast?.('Quitado de destacados');
  renderDestacados();
};
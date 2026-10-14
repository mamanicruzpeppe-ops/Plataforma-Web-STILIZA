// Panel empleado — venta multi-vestido rápida + reservas
let itemCount = 0;

document.addEventListener('DOMContentLoaded', () => {
  const session = (window.StilizaAuth && window.StilizaAuth.obtenerSesion)
    ? window.StilizaAuth.obtenerSesion()
    : JSON.parse(localStorage.getItem('stiliza_session') || 'null');
  if (!session || (session.role !== 'empleado' && session.role !== 'dueno')) {
    location.href = '../index.html';
    return;
  }
  window.__empProfile = session;
  const nameEl = document.getElementById('empNombre');
  if (nameEl) nameEl.textContent = session.full_name || session.name || session.email || 'Empleado';

  const KEY = 'theme_empleado';
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

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const s = item.dataset.section;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.panel-section').forEach(x => x.classList.remove('active'));
      document.getElementById('section-' + s)?.classList.add('active');
      const pt = document.getElementById('panelTitle');
      if (pt) {
        const titles = { reservas: 'Reservas', 'nueva-venta': 'Nueva venta', historial: 'Historial' };
        pt.textContent = titles[s] || s;
      }
      if (s === 'reservas') renderReservasEmp();
      if (s === 'historial') renderHistorial();
    });
  });

  document.querySelectorAll('#section-reservas .filtro-admin').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#section-reservas .filtro-admin').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const q = document.getElementById('buscarReservaCodigoEmp')?.value || '';
      renderReservasEmp(btn.dataset.filtro, q);
    });
  });
  const buscarEmp = () => {
    const q = document.getElementById('buscarReservaCodigoEmp')?.value || '';
    const filtro = document.querySelector('#section-reservas .filtro-admin.active')?.dataset.filtro || 'pendiente';
    renderReservasEmp(filtro, q);
  };
  document.getElementById('btnBuscarReservaEmp')?.addEventListener('click', buscarEmp);
  document.getElementById('buscarReservaCodigoEmp')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscarEmp(); }
  });
  document.getElementById('buscarReservaCodigoEmp')?.addEventListener('input', buscarEmp);
  document.getElementById('btnLimpiarBusquedaReservaEmp')?.addEventListener('click', () => {
    const inp = document.getElementById('buscarReservaCodigoEmp');
    if (inp) inp.value = '';
    renderReservasEmp(document.querySelector('#section-reservas .filtro-admin.active')?.dataset.filtro || 'pendiente', '');
  });

  document.getElementById('btnAgregarItemVenta')?.addEventListener('click', () => agregarLineaVenta());
  agregarLineaVenta();

  document.getElementById('formNuevaVenta')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const cliente = document.getElementById('ventaCliente')?.value.trim();
    const telefono = document.getElementById('ventaTelefono')?.value.trim() || '';
    const metodo = document.querySelector('input[name="ventaMetodo"]:checked')?.value || 'efectivo';
    const items = recolectarItemsVenta();
    if (!cliente) return mostrarToast?.('Nombre del cliente requerido', 'warn');
    if (!items.length) return mostrarToast?.('Agrega al menos un vestido', 'warn');

    const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const numero = 'V-2026-' + String(Math.floor(Math.random() * 90000) + 10000);
    const empEmail = session.email || 'empleado';
    const fecha = new Date().toISOString();

    const venta = {
      id: 'v-' + Date.now(),
      numero,
      reservation_number: numero,
      cliente,
      customer_name: cliente,
      telefono,
      items: items.map(i => ({
        nombre: i.nombre, product_name: i.nombre,
        talla: i.talla, size: i.talla,
        precio: i.precio, unit_price: i.precio,
        cantidad: i.cantidad, quantity: i.cantidad
      })),
      reservation_items: items.map(i => ({
        product_name: i.nombre, size: i.talla,
        unit_price: i.precio, quantity: i.cantidad
      })),
      total, total_amount: total,
      anticipo: total, deposit_amount: total,
      saldo: 0, remaining_amount: 0,
      estado: 'vendido', pickup_status: 'vendido',
      tipo: 'venta_tienda',
      metodo_pago: metodo, payment_method: metodo,
      fecha, created_at: fecha,
      empleado: empEmail, employee_email: empEmail
    };

    // Guardar YA (local) y mostrar factura YA
    try {
      const reservas = JSON.parse(localStorage.getItem('stiliza_reservas') || '[]');
      reservas.push(venta);
      localStorage.setItem('stiliza_reservas', JSON.stringify(reservas));
    } catch (_) {}

    // Supabase en segundo plano
    try {
      window.StilizaReservations?.createReservation?.({
        customer_name: cliente,
        customer_phone: telefono,
        items: items.map(i => ({ product_name: i.nombre, size: i.talla, unit_price: i.precio, quantity: i.cantidad })),
        payment_method: metodo,
        tipo: 'venta_tienda',
        employee_email: empEmail
      }).catch(() => {});
    } catch (_) {}

    mostrarToast?.('Venta registrada');
    e.target.reset();
    document.getElementById('ventaItemsLista').innerHTML = '';
    itemCount = 0;
    agregarLineaVenta();
    actualizarTotalVenta();

    if (typeof window.mostrarFactura === 'function') {
      window.mostrarFactura({
        numero,
        cliente,
        telefono,
        items: items.map(i => ({ nombre: i.nombre, talla: i.talla, precio: i.precio, cantidad: i.cantidad })),
        total,
        anticipo: total,
        saldo: 0,
        fecha: new Date(),
        tipo: 'venta',
        payment_method: metodo
      });
    }
    renderReservasEmp();
  });

  renderReservasEmp();
});

function agregarLineaVenta() {
  const lista = document.getElementById('ventaItemsLista');
  if (!lista) return;
  const id = ++itemCount;
  const div = document.createElement('div');
  div.className = 'venta-item-row';
  div.dataset.line = id;
  div.innerHTML = `
    <div class="form-group" style="flex:2;">
      <label>Vestido</label>
      <input type="text" class="vi-nombre" required placeholder="Nombre del vestido">
    </div>
    <div class="form-group">
      <label>Talla</label>
      <select class="vi-talla">
        <option>XS</option><option>S</option><option selected>M</option><option>L</option><option>XL</option>
      </select>
    </div>
    <div class="form-group">
      <label>Precio (Bs)</label>
      <input type="number" class="vi-precio" min="0" step="0.01" required placeholder="0">
    </div>
    <div class="form-group">
      <label>Cant.</label>
      <input type="number" class="vi-cant" min="1" value="1" required>
    </div>
    <button type="button" class="btn-quitar-linea" title="Quitar">✕</button>
  `;
  lista.appendChild(div);
  div.querySelector('.btn-quitar-linea').onclick = () => {
    if (lista.children.length <= 1) {
      mostrarToast?.('Debe quedar al menos un vestido', 'warn');
      return;
    }
    div.remove();
    actualizarTotalVenta();
  };
  div.querySelectorAll('.vi-precio, .vi-cant').forEach(inp => {
    inp.addEventListener('input', actualizarTotalVenta);
  });
  actualizarTotalVenta();
}

function recolectarItemsVenta() {
  return [...document.querySelectorAll('.venta-item-row')].map(r => {
    const nombre = r.querySelector('.vi-nombre')?.value.trim();
    const talla = r.querySelector('.vi-talla')?.value || 'M';
    const precio = parseFloat(r.querySelector('.vi-precio')?.value) || 0;
    const cantidad = parseInt(r.querySelector('.vi-cant')?.value, 10) || 1;
    return { nombre, talla, precio, cantidad };
  }).filter(i => i.nombre && i.precio > 0);
}

function actualizarTotalVenta() {
  const items = recolectarItemsVenta();
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const el = document.getElementById('ventaTotalLabel');
  if (el) el.textContent = 'Bs ' + total.toFixed(2);
}

function montosReservaEmp(r) {
  const total = Number(r.total || r.total_amount || 0);
  const st = r.pickup_status || r.estado || 'pendiente';
  const esVenta = r.tipo === 'venta_tienda' || st === 'vendido';
  const esRecogido = st === 'recogido';
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

function renderReservasEmp(filtro = 'pendiente', busqueda = '') {
  let all = [];
  try { all = JSON.parse(localStorage.getItem('stiliza_reservas') || '[]'); } catch (_) {}
  const now = Date.now();
  let changed = false;
  all = all.map(r => {
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
    try { localStorage.setItem('stiliza_reservas', JSON.stringify(all)); } catch (_) {}
  }

  let lista = all;
  if (filtro === 'pendiente') lista = all.filter(r => (r.pickup_status || r.estado) === 'pendiente' && r.tipo !== 'venta_tienda');
  else if (filtro === 'recogido') lista = all.filter(r => (r.pickup_status || r.estado) === 'recogido');
  else if (filtro === 'expirado') lista = all.filter(r => (r.pickup_status || r.estado) === 'expirado');
  else if (filtro === 'vendido') lista = all.filter(r => (r.pickup_status || r.estado) === 'vendido' || r.tipo === 'venta_tienda');
  else if (filtro === 'todas') lista = all;

  const q = String(busqueda || '').trim().toLowerCase();
  if (q) {
    lista = lista.filter(r => {
      const num = String(r.numero || r.reservation_number || '').toLowerCase();
      const cli = String(r.cliente || r.customer_name || '').toLowerCase();
      const tel = String(r.telefono || r.customer_phone || '').toLowerCase();
      return num.includes(q) || cli.includes(q) || tel.includes(q);
    });
  }

  const cont = document.getElementById('listaReservasEmp');
  if (!cont) return;

  const cards = lista.length ? lista.slice().reverse().map(r => {
    const num = r.numero || r.reservation_number;
    const st = r.pickup_status || r.estado || 'pendiente';
    const items = r.items || r.reservation_items || [];
    const names = items.map(i => i.nombre || i.product_name).filter(Boolean).join(', ') || r.producto || '';
    const rid = r.id || num;
    const m = montosReservaEmp(r);
    return `<div class="reserva-card">
      <div class="reserva-header"><strong>${num}</strong><span class="badge ${st}">${st}</span></div>
      <div class="reserva-body">
        <p><strong>Cliente:</strong> ${r.cliente || r.customer_name || ''}</p>
        <p><strong>Total:</strong> Bs ${m.total.toFixed(2)}</p>
        ${m.esVenta
          ? `<p><strong>Pagado:</strong> Bs ${m.total.toFixed(2)} <span style="color:var(--text-muted);font-size:0.85em;">(venta completa)</span></p>`
          : m.esRecogido
            ? `<p><strong>Pagado completo:</strong> <span style="color:#2e7d32;font-weight:700;">Bs ${m.total.toFixed(2)}</span></p>`
            : `<p><strong>Anticipo (20%):</strong> <span style="color:#2e7d32;font-weight:600;">Bs ${m.anticipo.toFixed(2)}</span></p>
             <p><strong>Falta por pagar:</strong> <span style="color:#b45309;font-weight:700;">Bs ${m.saldo.toFixed(2)}</span></p>`}
        <p>${names}</p>
      </div>
      ${st === 'pendiente' ? `<button class="btn btn-primario btn-sm" onclick="marcarRec('${String(rid).replace(/'/g, '')}')">✓ Marcar recogido</button>` : ''}
    </div>`;
  }).join('') : '<p class="empty-msg">No hay registros en este filtro</p>';

  cont.innerHTML = cards;
}

window.marcarRec = (id) => {
  const reservas = JSON.parse(localStorage.getItem('stiliza_reservas') || '[]');
  const i = reservas.findIndex(r => r.id === id || r.numero === id || r.reservation_number === id);
  if (i >= 0) {
    const total = Number(reservas[i].total || reservas[i].total_amount || 0);
    reservas[i].estado = 'recogido';
    reservas[i].pickup_status = 'recogido';
    reservas[i].saldo = 0;
    reservas[i].remaining_amount = 0;
    reservas[i].anticipo = total;
    reservas[i].deposit_amount = total;
    reservas[i].payment_status = 'pagado';
    reservas[i].pagado_completo = true;
    localStorage.setItem('stiliza_reservas', JSON.stringify(reservas));
    try {
      if (reservas[i].id && window.StilizaReservations?.updateStatus) {
        window.StilizaReservations.updateStatus(reservas[i].id, 'recogido').catch(() => {});
      }
    } catch (_) {}
  }
  mostrarToast?.('Recogido · saldo pagado completo');
  const q = document.getElementById('buscarReservaCodigoEmp')?.value || '';
  renderReservasEmp(document.querySelector('#section-reservas .filtro-admin.active')?.dataset.filtro || 'pendiente', q);
};

function renderHistorial() {
  let all = [];
  try { all = JSON.parse(localStorage.getItem('stiliza_reservas') || '[]'); } catch (_) {}
  const cont = document.getElementById('historialLista');
  if (!cont) return;
  const lista = all.slice().reverse();
  let totalGeneral = 0;
  let totalAnticipos = 0;
  let totalSaldos = 0;
  let totalVentas = 0;
  lista.forEach(r => {
    const m = montosReservaEmp(r);
    totalGeneral += m.total;
    if (m.esVenta) totalVentas += m.total;
    else if (m.esRecogido) {
      // cobrado completo: no suma a anticipos ni saldos
      totalVentas += 0;
    } else if (m.st === 'pendiente') {
      totalAnticipos += m.anticipo;
      totalSaldos += m.saldo;
    }
  });

  const filas = lista.slice(0, 50).map(r => {
    const total = Number(r.total || r.total_amount || 0);
    const anticipo = Number(r.anticipo != null ? r.anticipo : (r.deposit_amount != null ? r.deposit_amount : (r.tipo === 'venta_tienda' ? total : total * 0.2)));
    const saldo = Number(r.saldo != null ? r.saldo : (r.remaining_amount != null ? r.remaining_amount : Math.max(0, total - anticipo)));
    const st = r.pickup_status || r.estado || '';
    const esVenta = r.tipo === 'venta_tienda' || st === 'vendido';
    return `
    <div class="mini-row" style="padding:0.75rem 0;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
      <div>
        <strong>${r.numero || r.reservation_number || '—'}</strong>
        <small style="display:block;color:var(--text-muted);">${r.cliente || r.customer_name || ''}</small>
        <small style="display:block;color:var(--text-muted);">
          ${esVenta
            ? 'Venta: Bs ' + total.toFixed(2)
            : 'Anticipo: Bs ' + anticipo.toFixed(2) + ' · Falta: Bs ' + saldo.toFixed(2)}
        </small>
      </div>
      <div style="text-align:right;">
        <span class="badge ${st}">${st}</span>
        <div style="font-weight:600;margin-top:4px;">Bs ${total.toFixed(2)}</div>
      </div>
    </div>`;
  }).join('') || '<p class="empty-msg">Sin movimientos</p>';
  cont.innerHTML = filas;
}

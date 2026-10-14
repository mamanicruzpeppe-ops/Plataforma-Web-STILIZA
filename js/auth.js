// Login Stiliza — dueño / empleado / cliente (local + Supabase)
const OWNER_EMAIL = 'dueno@stiliza.com';
const OWNER_PASSWORD = 'STILIZA555$';
const EMP_PASS_KEY = 'stiliza_empleados_auth';

function getEmpleadosAuth() {
  try { return JSON.parse(localStorage.getItem(EMP_PASS_KEY) || '[]'); } catch { return []; }
}
function saveEmpleadosAuth(list) {
  localStorage.setItem(EMP_PASS_KEY, JSON.stringify(list));
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getSupabaseClient() {
  try {
    if (window.StilizaDB?.sb) return window.StilizaDB.sb;
    if (typeof window.getSupabase === 'function') return window.getSupabase();
  } catch (_) {}
  return null;
}

/** Guarda o actualiza un cliente en Supabase (tabla clientes) */
async function registrarClienteSupabase(nombre, email) {
  const sb = getSupabaseClient();
  if (!sb) {
    console.warn('[Stiliza] Supabase no conectado');
    return false;
  }
  const em = normalizeEmail(email);
  const fullName = (nombre || '').trim() || em.split('@')[0];

  // Columnas: id, full_name, email, created_at
  const { data, error } = await sb
    .from('clientes')
    .upsert(
      { full_name: fullName, email: em },
      { onConflict: 'email' }
    )
    .select();

  if (error) {
    console.error('[Stiliza] Error al guardar cliente:', error);
    // Fallback por si la columna se llama "nombre"
    const r2 = await sb.from('clientes').upsert(
      { nombre: fullName, email: em },
      { onConflict: 'email' }
    ).select();
    if (r2.error) {
      console.error('[Stiliza] Fallback también falló:', r2.error);
      return false;
    }
    console.log('[Stiliza] Cliente guardado (nombre):', em);
    return true;
  }
  console.log('[Stiliza] Cliente guardado en Supabase:', em, data);
  return true;
}

function getRoleFromEmail(email) {
  const clean = normalizeEmail(email);
  if (!clean) return 'cliente';
  if (clean.includes('doristiliza')) return 'cliente';
  if (
    clean === 'dueno@stiliza.com' ||
    clean === 'dueño@stiliza.com' ||
    clean === 'dueno@gmail.com' ||
    (clean.includes('dueno') && clean.includes('stiliza')) ||
    (clean.includes('dueño') && clean.includes('stiliza'))
  ) return 'dueno';

  const emps = getEmpleadosAuth();
  if (emps.some(e => normalizeEmail(e.email) === clean)) return 'empleado';
  try {
    const simple = JSON.parse(localStorage.getItem('stiliza_empleados') || '[]');
    if (simple.some(e => normalizeEmail(typeof e === 'string' ? e : e.email) === clean)) return 'empleado';
  } catch (_) {}
  return 'cliente';
}

function guardarSesion(email, role, name = '') {
  const session = {
    email: normalizeEmail(email),
    role,
    name: name || '',
    full_name: name || '',
    loginAt: new Date().toISOString()
  };
  localStorage.setItem('stiliza_session', JSON.stringify(session));
  return session;
}

function obtenerSesion() {
  try { return JSON.parse(localStorage.getItem('stiliza_session') || 'null'); } catch { return null; }
}

function panelBase() {
  const path = location.pathname.replace(/\\/g, '/');
  if (path.includes('/dueno/') || path.includes('/empleado/')) return '../';
  return '';
}

function cerrarSesion() {
  localStorage.removeItem('stiliza_session');
  try { window.StilizaDB?.sb?.auth?.signOut?.(); } catch (_) {}
  location.href = panelBase() + 'index.html';
}

function redirigirSegunRol(role) {
  const path = location.pathname.replace(/\\/g, '/');
  const inDueno = path.includes('/dueno/');
  const inEmp = path.includes('/empleado/');
  if (role === 'dueno') {
    if (inDueno) location.href = 'index.html';
    else if (inEmp) location.href = '../dueno/index.html';
    else location.href = 'dueno/index.html';
  } else if (role === 'empleado') {
    if (inEmp) location.href = 'index.html';
    else if (inDueno) location.href = '../empleado/index.html';
    else location.href = 'empleado/index.html';
  } else {
    location.href = (inDueno || inEmp) ? '../index.html' : 'index.html';
  }
}

function requireRole(allowed) {
  const session = obtenerSesion();
  if (!session || !allowed.includes(session.role)) {
    location.href = panelBase() + 'index.html';
    return null;
  }
  return session;
}

function updateAuthUI(session) {
  const btnLogin = document.getElementById('btnAbrirLogin');
  const userInfo = document.getElementById('userInfo');
  if (!userInfo) return;
  if (session) {
    if (btnLogin) btnLogin.style.display = 'none';
    userInfo.style.display = 'flex';
    const go = session.role === 'dueno' || session.role === 'empleado';
    userInfo.innerHTML = `
      <span class="user-email">${session.name || session.email}</span>
      ${go ? '<button type="button" class="btn-login" id="btnIrPanel">Panel</button>' : ''}
      <button type="button" class="btn-logout" id="btnLogout">Salir</button>`;
    document.getElementById('btnLogout')?.addEventListener('click', cerrarSesion);
    document.getElementById('btnIrPanel')?.addEventListener('click', () => redirigirSegunRol(session.role));
  } else {
    if (btnLogin) btnLogin.style.display = '';
    userInfo.style.display = 'none';
    userInfo.innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modalLogin');
  const form = document.getElementById('formLogin');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  const passGroup = document.getElementById('loginPassGroup') || passInput?.closest('.form-group');
  const subtitle = modal?.querySelector('.modal-sub') || modal?.querySelector('.modal-header p');

  if (passGroup) passGroup.style.display = 'none';
  if (passInput) { passInput.required = false; passInput.value = ''; }
  if (subtitle) subtitle.textContent = 'Solo necesitas tu correo electrónico';

  let pendingStaff = null;

  document.getElementById('btnAbrirLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    pendingStaff = null;
    if (passGroup) passGroup.style.display = 'none';
    if (passInput) { passInput.required = false; passInput.value = ''; }
    if (subtitle) subtitle.textContent = 'Solo necesitas tu correo electrónico';
    modal?.classList.add('active');
  });
  document.getElementById('cerrarModalLogin')?.addEventListener('click', () => {
    modal?.classList.remove('active');
    pendingStaff = null;
  });
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) { modal.classList.remove('active'); pendingStaff = null; }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput?.value.trim() || '';
    const name = document.getElementById('loginName')?.value.trim() || '';
    const password = String(passInput?.value || '').trim();

    if (!email) {
      if (typeof mostrarToast === 'function') mostrarToast('Ingresa tu correo', 'warn');
      return;
    }

    // —— Dueño / empleado con contraseña ——
    if (pendingStaff) {
      if (pendingStaff.role === 'dueno') {
        const ok = password === OWNER_PASSWORD || password === 'STILIZA555$' || password === 'STILIZA555';
        if (!ok) {
          if (typeof mostrarToast === 'function') mostrarToast('Contraseña incorrecta. Usá: STILIZA555$', 'error');
          return;
        }
        guardarSesion(pendingStaff.email, 'dueno', pendingStaff.name || 'Dueño');
        modal?.classList.remove('active');
        redirigirSegunRol('dueno');
        return;
      }
      if (pendingStaff.role === 'empleado') {
        const mail = normalizeEmail(pendingStaff.email);
        const emp = getEmpleadosAuth().find(e => normalizeEmail(e.email) === mail);
        const ok = !!(emp && String(emp.password) === String(password));
        if (!ok) {
          if (typeof mostrarToast === 'function') mostrarToast('Contraseña incorrecta o empleado no registrado', 'error');
          return;
        }
        guardarSesion(mail, 'empleado', emp?.nombre || pendingStaff.name || mail);
        modal?.classList.remove('active');
        redirigirSegunRol('empleado');
        return;
      }
    }

    const role = getRoleFromEmail(email);
    if (role === 'dueno' || role === 'empleado') {
      pendingStaff = { email, role, name };
      if (passGroup) passGroup.style.display = 'block';
      if (passInput) { passInput.required = true; passInput.value = ''; passInput.focus(); }
      if (subtitle) subtitle.textContent = 'Confirma tu acceso con la contraseña';
      if (typeof mostrarToast === 'function') mostrarToast('Ingresa tu contraseña para continuar', 'info');
      return;
    }

    // —— CLIENTE: nombre + correo → local + Supabase ——
    guardarSesion(email, 'cliente', name);

    try {
      const clientes = JSON.parse(localStorage.getItem('stiliza_clientes') || '[]');
      const em = normalizeEmail(email);
      if (!clientes.some(c => normalizeEmail(c.email) === em)) {
        clientes.push({ email: em, name, at: new Date().toISOString() });
        localStorage.setItem('stiliza_clientes', JSON.stringify(clientes));
      }
    } catch (_) {}

    const okDb = await registrarClienteSupabase(name, email);
    if (typeof mostrarToast === 'function') {
      mostrarToast(okDb ? '¡Registrado!' : 'Listo (revisá consola si no aparece en Supabase)', okDb ? 'ok' : 'warn');
    }

    modal?.classList.remove('active');
    updateAuthUI(obtenerSesion());
  });

  updateAuthUI(obtenerSesion());
});

window.StilizaAuth = {
  OWNER_EMAIL, OWNER_PASSWORD, getRoleFromEmail, guardarSesion, obtenerSesion,
  cerrarSesion, redirigirSegunRol, requireRole, getEmpleadosAuth, saveEmpleadosAuth, updateAuthUI,
  registrarClienteSupabase
};
// =============================================================================
// Panel de profesor: una página más del sitio (panel-profesor.html, con el mismo menú que Inicio o
// Sobre el Proyecto). Trabaja sobre la MISMA colección "nodos" y las MISMAS zonas que el botón "+"
// de las páginas (js/contenido-docente.js): lo que se guarda acá se ve en el sitio al instante, y lo
// que se agrega con el "+" aparece acá al instante.
//
//  - Lo fijo (especialidad, materias, temas y videos que son archivos HTML) se muestra con 🔒 y NO se
//    edita desde acá. Se lee de las propias páginas, así el panel nunca se desincroniza del sitio.
//  - Lo que se puede crear, editar, mover y borrar: temas, subtemas y videos agregados por docentes.
//  - Nada se crea vacío: como el sitio ya muestra todo en vivo, un borrador sería público al instante.
// Los textos entran con textContent / .value, nunca con innerHTML.
// =============================================================================
import { db, auth } from './firebase-config.js';
import { collection, onSnapshot, addDoc, updateDoc, doc, setDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const RAIZ = new URL('../', import.meta.url).href;
const COL = collection(db, 'nodos');
const $ = (s) => document.querySelector(s);
const vista = () => document.getElementById('adm-vista');
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

let aj = new Map();                  // ajustes sobre contenido fijo, en vivo: clave -> datos
let dyn = new Map();                 // nodos de Firestore, en vivo: id -> nodo
let sel = null;                      // { k:'din', id } | { k:'fijo', ruta, titulo } | { k:'nuevo', padre, tipo }
const abiertos = new Set(), cache = new Map();   // cache: ruta -> info de la página (null = no se pudo leer)

const avisar = (t) => (window.tptAviso ? window.tptAviso(t, 'error') : alert(t));   // banner del sitio (header.js)
const mensajeError = (e) => (e && e.code === 'permission-denied'
    ? 'No tenés permiso para guardar. Revisá que tu cuenta tenga rol de docente y que las reglas de Firestore estén publicadas.'
    : 'No se pudo guardar (' + ((e && (e.code || e.message)) || 'error') + ').');

function idYoutube(texto) {          // acepta el ID solo o cualquier link de YouTube (igual que el sitio)
    const t = String(texto || '').trim();
    if (/^[\w-]{11}$/.test(t)) return t;
    let u; try { u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); } catch { return null; }
    const host = u.hostname.replace(/^(www|m)\./, ''); let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (u.pathname === '/watch') id = u.searchParams.get('v');
        else { const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
}

// ---------------------------------------------------------------- lectura de las páginas fijas
const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
function aRuta(href, desde) {
    if (!href || href === '#') return null;
    try { const u = new URL(href, RAIZ + desde);
          return u.href.startsWith(RAIZ) && /\.html$/.test(u.pathname) ? decodeURI(u.href.slice(RAIZ.length).split(/[?#]/)[0]) : null;
    } catch { return null; }
}
// Calcula las zonas EXACTAMENTE como lo hace contenido-docente.js (mismas claves "#g0", "#l0", "#s").
function analizar(d, ruta) {
    if (d.querySelector('main .contenedor-video, main iframe')) return { leccion: true, zonas: [] };
    const zonas = [], editable = ruta.startsWith('Mat/'), grupos = [];
    d.querySelectorAll('main .grilla-materias').forEach((g, i) => {
        const u = grupos[grupos.length - 1];
        if (u && u.cont === g.parentElement) u.grids.push(g); else grupos.push({ cont: g.parentElement, grids: [g], indice: i });
    });
    grupos.forEach(({ cont, grids, indice }) => zonas.push({
        clave: ruta + '#g' + indice, tipo: 'tema', editable, etiqueta: txt(cont.querySelector('h2')) || 'Temas',
        fijos: grids.flatMap((g) => [...g.querySelectorAll(':scope > .tarjeta-materia')]).map((c) => {
            const a = c.querySelector('a.btn');
            return { titulo: txt(c.querySelector('h3')), desc: txt(c.querySelector('p')), ruta: a ? aRuta(a.getAttribute('href'), ruta) : null };
        }).filter((f) => f.titulo),
    }));
    const listas = [...d.querySelectorAll('main .lista-recursos')];
    listas.forEach((ul, i) => zonas.push({
        clave: ruta + '#l' + i, tipo: 'video', editable, etiqueta: txt((ul.closest('section') || ul).querySelector('h2')) || 'Videos',
        fijos: [...ul.querySelectorAll(':scope > li a.tarjeta-recurso')].map((a) =>
            ({ titulo: txt(a.querySelector('h3')), desc: txt(a.querySelector('p')), ruta: aRuta(a.getAttribute('href'), ruta) })).filter((f) => f.titulo),
    }));
    if (listas.length && !grupos.length) zonas.push({ clave: ruta + '#s', tipo: 'tema', editable, etiqueta: 'Subtemas', fijos: [] });
    return { leccion: false, zonas };
}
async function leer(ruta) {
    try { const r = await fetch(RAIZ + ruta); cache.set(ruta, r.ok ? analizar(new DOMParser().parseFromString(await r.text(), 'text/html'), ruta) : null); }
    catch { cache.set(ruta, null); }
    pintar();
}

// ---------------------------------------------------------------- datos (en vivo)
const hijosDin = (padre) => [...dyn.values()].filter((n) => n.padre === padre).sort((a, b) => (a.orden || 0) - (b.orden || 0));
function rama(id) { const r = [id]; for (let i = 0; i < r.length; i++) hijosDin(r[i]).forEach((h) => r.push(h.id)); return r; }
async function mover(n, d) {
    const h = hijosDin(n.padre), j = h.findIndex((x) => x.id === n.id) + d; if (j < 0 || j >= h.length) return;
    const o = h[j], lote = writeBatch(db);
    lote.update(doc(db, 'nodos', n.id), { orden: o.orden }); lote.update(doc(db, 'nodos', o.id), { orden: n.orden });
    try { await lote.commit(); } catch (e) { avisar(mensajeError(e)); }
}
async function eliminar(n) {
    const ids = rama(n.id);
    if (!confirm(`¿Eliminar “${n.titulo}”${ids.length > 1 ? ` y todo lo que contiene (${ids.length} elementos)` : ''}?\nSe quita del sitio al instante y no se puede deshacer.`)) return;
    try { for (let i = 0; i < ids.length; i += 400) { const l = writeBatch(db); ids.slice(i, i + 400).forEach((x) => l.delete(doc(db, 'nodos', x))); await l.commit(); }
          sel = null; pintar(); } catch (e) { avisar(mensajeError(e)); }
}

// ---------------------------------------------------------------- árbol
function fila(nivel, chip, titulo, o = {}) {
    const f = el('div', 'fila' + (o.fijo ? ' fijo' : '') + (o.tenue ? ' oculto' : '') + (o.sel ? ' sel' : '')); f.style.paddingLeft = (nivel * 18 + 8) + 'px';
    const fl = el('span', 'flecha', o.flecha || ''); if (o.alAbrir) fl.onclick = (e) => { e.stopPropagation(); o.alAbrir(); };
    f.append(fl);
    if (o.fijo) f.append(el('span', 'cand', '🔒'));
    f.append(el('span', 'tit', titulo), el('span', 'chip', chip));
    if (o.alElegir) f.onclick = o.alElegir;
    return f;
}
function nodoFijo(f, chip, nivel, cont, ed, pag) {
    const info = f.ruta ? cache.get(f.ruta) : null, abierto = f.ruta && abiertos.has(f.ruta);
    const clave = f.ruta || (pag + '|' + f.titulo), x = aj.get(clave) || {};
    cont.append(fila(nivel, chip + (x.oculto ? ' · oculto' : ''), x.titulo || f.titulo, { fijo: !ed, tenue: Boolean(x.oculto), sel: sel && sel.k === 'fijo' && sel.clave === clave,
        flecha: f.ruta && !(info && info.leccion) ? (abierto ? '▾' : '▸') : '',
        alAbrir: () => { abierto ? abiertos.delete(f.ruta) : (abiertos.add(f.ruta), cache.has(f.ruta) || leer(f.ruta)); pintar(); },
        alElegir: () => { sel = { k: 'fijo', ruta: f.ruta, titulo: f.titulo, desc: f.desc || '', clave, ed, tipo: chip === 'Video' ? 'video' : 'tema' }; pintar(); } }));
    if (!abierto) return;
    if (!cache.has(f.ruta)) { cont.append(fila(nivel + 1, '', 'Cargando…', { fijo: true })); return; }
    if (!info) { cont.append(fila(nivel + 1, '', 'No se pudo leer esta página', { fijo: true })); return; }
    info.zonas.forEach((z) => {
        const zr = el('div', 'zona'); zr.style.paddingLeft = ((nivel + 1) * 18 + 8) + 'px'; zr.append(el('span', null, z.etiqueta));
        if (z.editable) {
            const b = el('button', 'adm-btn', '＋ ' + (z.tipo === 'video' ? 'Video' : 'Tema')); b.type = 'button';
            b.onclick = () => { sel = { k: 'nuevo', padre: z.clave, tipo: z.tipo }; pintar(); }; zr.append(b);
        }
        cont.append(zr);
        z.fijos.forEach((y) => nodoFijo(y, z.tipo === 'video' ? 'Video' : 'Tema', nivel + 2, cont, z.editable, f.ruta));
        dinamicos(z.clave, nivel + 2, cont);
    });
}
function dinamicos(padre, nivel, cont) {
    hijosDin(padre).forEach((n) => {
        const hs = hijosDin(n.id), abierto = abiertos.has(n.id);
        cont.append(fila(nivel, n.tipo === 'video' ? 'Video' : 'Tema', n.titulo, { sel: sel && sel.k === 'din' && sel.id === n.id,
            flecha: hs.length ? (abierto ? '▾' : '▸') : '', alAbrir: () => { abierto ? abiertos.delete(n.id) : abiertos.add(n.id); pintar(); },
            alElegir: () => { sel = { k: 'din', id: n.id }; pintar(); } }));
        if (abierto) dinamicos(n.id, nivel + 1, cont);
    });
}

// ---------------------------------------------------------------- editor
function msg(t, err) { const m = $('#adm-msg'); if (m) { m.textContent = t; m.className = 'adm-msg ' + (err ? 'err' : 'ok'); } }
function formulario(c, { tipo, nodo, padre }) {
    const video = tipo === 'video', campos = {};
    c.append(el('h3', null, (nodo ? 'Editar ' : 'Agregar ') + (video ? 'video' : 'tema')));
    const campo = (k, t, tag, extra = {}) => {
        const w = el('div', 'adm-campo'), l = el('label', null, t), i = el(tag); i.id = 'f-' + k; l.htmlFor = i.id;
        Object.assign(i, extra); w.append(l, i); c.append(w); campos[k] = i; return i;
    };
    campo('titulo', 'Título', 'input', { maxLength: 160 }).value = nodo ? nodo.titulo : '';
    if (video) campo('url', 'Link de YouTube', 'input').value = nodo && nodo.videoId ? 'https://youtu.be/' + nodo.videoId : '';
    campo('descripcion', video ? 'Descripción' : 'Descripción corta (opcional)', 'textarea', { maxLength: 600, rows: 3 }).value = nodo ? (nodo.descripcion || '') : '';
    if (video) {
        campo('mn', 'Material complementario: nombre (opcional)', 'input', { maxLength: 120 }).value = nodo ? (nodo.materialNombre || '') : '';
        campo('mu', 'Material complementario: link https (opcional)', 'input').value = nodo ? (nodo.materialUrl || '') : '';
    }
    const fb = el('div', 'adm-fila-btn'), g = el('button', 'adm-btn', nodo ? 'Guardar cambios' : 'Crear'); g.type = 'button';
    g.onclick = async () => {
        const datos = { titulo: campos.titulo.value.trim(), descripcion: campos.descripcion.value.trim() };
        if (!datos.titulo) return msg('Escribí un título.', 1);
        if (video) {
            const id = idYoutube(campos.url.value); if (!id) return msg('El link de YouTube no es válido.', 1);
            const mu = campos.mu.value.trim(); if (mu && !/^https:\/\//i.test(mu)) return msg('El link del material tiene que empezar con https://', 1);
            Object.assign(datos, { videoId: id, materialUrl: mu, materialNombre: campos.mn.value.trim() });
        }
        g.disabled = true;
        try {
            if (nodo) { await updateDoc(doc(db, 'nodos', nodo.id), datos); msg('Guardado ✔ (ya se ve en el sitio)'); }
            else { const r = await addDoc(COL, { padre, tipo, ...datos, orden: Date.now(), creadoPor: (auth.currentUser || {}).email || '', fecha: serverTimestamp() });
                   if (padre && !padre.includes('#')) abiertos.add(padre); sel = { k: 'din', id: r.id }; pintar(); msg('Creado ✔ (ya se ve en el sitio)'); }
        } catch (e) { console.error(e); msg(mensajeError(e), 1); }
        g.disabled = false;
    };
    fb.append(g);
    if (nodo) {
        const nuevo = (t, lbl) => { const b = el('button', 'adm-btn sec', lbl); b.type = 'button'; b.onclick = () => { abiertos.add(nodo.id); sel = { k: 'nuevo', padre: nodo.id, tipo: t }; pintar(); }; return b; };
        if (nodo.tipo === 'tema') fb.append(nuevo('tema', '＋ Subtema'), nuevo('video', '＋ Video'));
        const s = el('button', 'adm-btn sec', '↑'), b = el('button', 'adm-btn sec', '↓'), x = el('button', 'adm-btn rojo', '🗑 Eliminar');
        s.type = b.type = x.type = 'button'; s.title = 'Subir'; b.title = 'Bajar'; s.onclick = () => mover(nodo, -1); b.onclick = () => mover(nodo, 1); x.onclick = () => eliminar(nodo);
        const ver = el('a', 'adm-btn sec', 'Ver en el sitio'); ver.href = RAIZ + 'contenido.html?id=' + encodeURIComponent(nodo.id); ver.target = '_blank'; ver.rel = 'noopener';
        fb.append(s, b, ver, x);
    }
    const m = el('p', 'adm-msg'); m.id = 'adm-msg'; c.append(fb, m);
}
function formularioFijo(c, s) {
    const x = aj.get(s.clave) || {}, video = s.tipo === 'video', campos = {};
    c.append(el('h3', null, 'Editar ' + (video ? 'video' : 'tema') + ' del sitio'));
    if (x.oculto) c.append(el('div', 'adm-aviso', 'Este elemento está oculto: no se ve en el sitio. Tocá “Restaurar” para mostrarlo de nuevo.'));
    c.append(el('p', 'adm-migas', 'Es contenido original del sitio (un archivo). Tus cambios se guardan aparte y se ven al instante, sin modificar el archivo.'));
    const campo = (k, t, tag, extra = {}) => {
        const w = el('div', 'adm-campo'), l = el('label', null, t), i = el(tag); i.id = 'f-' + k; l.htmlFor = i.id;
        Object.assign(i, extra); w.append(l, i); c.append(w); campos[k] = i; return i;
    };
    campo('titulo', 'Título', 'input', { maxLength: 160 }).value = x.titulo || s.titulo;
    campo('descripcion', 'Descripción corta (la de la tarjeta)', 'textarea', { maxLength: 600, rows: 3 }).value = x.descripcion || s.desc;
    if (video) { campo('url', 'Reemplazar el video: link de YouTube (vacío = deja el original)', 'input').value = x.videoId ? 'https://youtu.be/' + x.videoId : ''; }
    const id = encodeURIComponent(s.clave);
    const guardar = async (extra = {}) => {
        const datos = { clave: s.clave, titulo: campos.titulo.value.trim(), descripcion: campos.descripcion.value.trim(), oculto: Boolean(x.oculto), ...extra,
                        editadoPor: (auth.currentUser || {}).email || '', fecha: serverTimestamp() };
        if (!datos.titulo) return msg('Escribí un título.', 1);
        if (video) { const v = campos.url.value.trim(), vid = v ? idYoutube(v) : ''; if (v && !vid) return msg('El link de YouTube no es válido.', 1); datos.videoId = vid; }
        try { await setDoc(doc(db, 'ajustes', id), datos, { merge: true }); msg('Guardado ✔ (ya se ve en el sitio)'); } catch (e) { console.error(e); msg(mensajeError(e), 1); }
    };
    const fb = el('div', 'adm-fila-btn'), btn = (t, cl, f) => { const b = el('button', cl, t); b.type = 'button'; b.onclick = f; fb.append(b); };
    btn('Guardar cambios', 'adm-btn', () => guardar());
    if (x.oculto) btn('Restaurar', 'adm-btn sec', () => guardar({ oculto: false }));
    else btn('🗑 Eliminar del sitio', 'adm-btn rojo', () => { if (confirm(`¿Eliminar “${x.titulo || s.titulo}” del sitio?\nDeja de verse al instante. Podés restaurarlo desde acá cuando quieras.`)) guardar({ oculto: true }); });
    if (aj.has(s.clave)) btn('Quitar mis cambios', 'adm-btn sec', async () => { if (confirm('Vuelve a como estaba el original (título, descripción, video y visibilidad). ¿Continuar?')) { try { await deleteDoc(doc(db, 'ajustes', id)); msg('Se restauró el original.'); } catch (e) { msg(mensajeError(e), 1); } } });
    if (s.ruta) { const a = el('a', 'adm-btn sec', 'Abrir esta página'); a.href = RAIZ + s.ruta; a.target = '_blank'; a.rel = 'noopener'; fb.append(a); }
    const m = el('p', 'adm-msg'); m.id = 'adm-msg'; c.append(fb, m);
}

function editor(c) {
    if (!sel) { c.append(el('p', 'adm-guia', 'Elegí un tema o video de la lista para editarlo, o tocá “＋ Tema” / “＋ Video” en la zona donde querés agregar. Lo que guardes se ve en el sitio al instante.')); return; }
    if (sel.k === 'fijo' && sel.ed) return formularioFijo(c, sel);
    if (sel.k === 'fijo') {
        c.append(el('h3', null, sel.titulo), el('div', 'adm-aviso', '🔒 La especialidad y las materias no se editan desde el panel. Lo que sí podés hacer es editar, ocultar o agregar temas, subtemas y videos dentro de ellas.'));
        if (sel.ruta) { const a = el('a', 'adm-btn sec', 'Abrir esta página'); a.href = RAIZ + sel.ruta; a.target = '_blank'; a.rel = 'noopener'; c.append(a); }
        return;
    }
    if (sel.k === 'nuevo') return formulario(c, { tipo: sel.tipo, padre: sel.padre });
    const n = dyn.get(sel.id); if (!n) { sel = null; return editor(c); }
    formulario(c, { tipo: n.tipo, nodo: n });
}

// ---------------------------------------------------------------- pantalla
function pintar() {
    const V = vista(); V.replaceChildren();
    const g = el('div', 'adm-grid'), a = el('section', 'adm-card'), e = el('section', 'adm-card');
    a.append(el('h3', null, 'Contenido del sitio'));
    const lista = el('div'); lista.style.margin = '.8rem 0'; nodoFijo({ titulo: 'Química', ruta: 'quimica.html' }, 'Especialidad', 0, lista, false, '');
    const ley = el('div', 'adm-leyenda', '🔒 especialidad y materias: no se editan desde el panel · el resto sí (temas, subtemas y videos)');
    a.append(lista, ley); editor(e); g.append(a, e); V.append(g);
}
function soloDocentes() {
    const V = vista(); V.replaceChildren();
    const c = el('section', 'adm-card'); c.append(el('h3', null, 'Esta sección es solo para docentes'));
    const l = el('a', 'adm-btn', 'Iniciar sesión'); l.href = RAIZ + 'login.html'; c.append(l); V.append(c);
}

let escuchando = false;
onAuthStateChanged(auth, (user) => {
    const docente = Boolean(user) && ['profesor', 'admin'].includes(localStorage.getItem('rolUsuario'));
    if (!docente) { soloDocentes(); return; }
    if (!escuchando) {
        escuchando = true; abiertos.add('quimica.html'); leer('quimica.html');
        onSnapshot(collection(db, 'ajustes'), (snap) => { aj = new Map(snap.docs.map((d) => [d.data().clave, d.data()])); pintar(); }, (e) => console.error(e));
        onSnapshot(COL, (snap) => { dyn = new Map(snap.docs.map((d) => [d.id, { ...d.data(), id: d.id }])); pintar(); },
            (e) => { console.error(e); vista().replaceChildren(el('p', 'adm-msg err', 'No se pudo leer el contenido. Revisá la conexión y las reglas de Firestore.')); });
    }
    pintar();
});

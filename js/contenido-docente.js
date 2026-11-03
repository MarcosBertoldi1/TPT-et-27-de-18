// =============================================================================
// Contenido agregado por docentes: temas, subtemas y videos, EN VIVO desde Firestore.
//
//  - En las páginas de Mat/ (materias y temas) agrega, al final de cada grilla de tarjetas y de
//    cada lista de recursos, lo que los docentes hayan cargado, más el botón "+" para sumar más.
//  - contenido.html?id=<id> muestra un tema/subtema o un video agregado, con la MISMA estructura
//    que las páginas existentes (migas de pan, cabecera, tarjetas, video + descripción + material
//    + comentarios).
//
// Colección "nodos"  { padre, tipo: 'tema' | 'video', titulo, descripcion, orden, creadoPor, fecha,
//                      videoId, materialUrl, materialNombre }
//   padre = clave de la zona de una página fija ("Mat/mat-L.html#g0", "Mat/L/introL.html#l0")
//           o el id de otro nodo (así se arman subtemas dentro de subtemas).
// Ver el botón "+" lo decide el rol guardado al iniciar sesión; el permiso real lo exigen las
// reglas de Firestore (solo los correos docentes pueden escribir). Los textos entran con textContent.
// =============================================================================
import { db, auth } from './firebase-config.js';
import { collection, query, where, onSnapshot, addDoc, updateDoc, getDocs, getDoc, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const RAIZ = new URL('../', import.meta.url).href;       // carpeta raíz del sitio
const COL = collection(db, 'nodos');
const NS = 'http://www.w3.org/2000/svg';
const ICONOS = {
    tema: 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z',
    video: 'M8 5v14l11-7z',
};
const estado = { docente: false };
const repintar = [];                                      // se vuelven a ejecutar cuando cambia el rol

// ---------------------------------------------------------------- utilidades
const el = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; };
function icono(nombre) {
    const svg = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    svg.setAttribute('class', 'ico'); svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    p.setAttribute('d', ICONOS[nombre]); p.setAttribute('fill', 'currentColor'); svg.append(p);
    return svg;
}
const enlaceNodo = (id) => RAIZ + 'contenido.html?id=' + encodeURIComponent(id);
const volverA = (n) => (n.padre.includes('#') ? RAIZ + n.padre.split('#')[0] : enlaceNodo(n.padre));
const limpiar = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const correoActual = () => (auth.currentUser && auth.currentUser.email) || '';

function idYoutube(texto) {                               // acepta el ID solo o cualquier link de YouTube
    const t = String(texto || '').trim();
    if (/^[\w-]{11}$/.test(t)) return t;
    let u; try { u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); } catch { return null; }
    const host = u.hostname.replace(/^(www|m)\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (u.pathname === '/watch') id = u.searchParams.get('v');
        else { const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
}
const avisar = (t) => (window.tptAviso ? window.tptAviso(t, 'error') : alert(t));   // banner del sitio (header.js)
const mensajeError = (e) => (e && e.code === 'permission-denied'
    ? 'No tenés permiso para guardar. Entrá con una cuenta docente y revisá que las reglas de Firestore estén publicadas.'
    : 'No se pudo guardar (' + ((e && (e.code || e.message)) || 'error') + ').');

// ---------------------------------------------------------------- estilos (usan las variables del tema claro/oscuro)
function inyectarEstilos() {
    if (document.getElementById('estilos-docente')) return;
    const s = el('style'); s.id = 'estilos-docente';
    s.textContent = `
    .tarjeta-agregar { border-style: dashed; background: transparent; justify-content: center; min-height: 12rem; cursor: pointer; padding: 0; }
    .tarjeta-agregar button { background: none; border: 0; color: var(--color-primario); font: inherit; font-weight: 700; cursor: pointer;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .4rem; width: 100%; height: 100%; min-height: 12rem; padding: 1rem; }
    .tarjeta-agregar .mas { font-size: 3rem; line-height: 1; }
    .tarjeta-agregar:hover, .tarjeta-agregar:focus-within { border-color: var(--color-primario); }
    .item-agregar button { width: 100%; border: 2px dashed var(--color-borde); background: transparent; color: var(--color-primario);
        padding: 1rem; border-radius: 12px; font: inherit; font-weight: 700; cursor: pointer; }
    .item-agregar button:hover { border-color: var(--color-primario); }
    .acciones-docente { display: flex; gap: .5rem; margin-top: .75rem; justify-content: center; flex-wrap: wrap; }
    li > .acciones-docente { justify-content: flex-start; margin: .35rem 0 0 .25rem; }
    .btn-mini { padding: .35rem .8rem; border-radius: 8px; border: 1px solid var(--color-borde); background: transparent;
        color: var(--color-primario); font: inherit; font-size: .85rem; font-weight: 700; cursor: pointer; }
    .btn-mini:hover { border-color: var(--color-primario); }
    .btn-mini.peligro { color: #dc3545; border-color: #dc3545; }
    .zona-subtemas-titulo { margin: 2rem 0 1rem; }
    .acciones-pagina { justify-content: flex-start; margin: 0 0 1.5rem; }
    dialog.dlg-docente { border: 2px solid var(--color-borde); border-radius: 12px; background: var(--color-fondo); color: var(--color-texto);
        padding: 1.5rem; width: min(560px, 92vw); }
    dialog.dlg-docente::backdrop { background: rgba(4,24,13, .6); }
    .dlg-docente h2 { margin: 0 0 .5rem; }
    .dlg-docente label { display: block; font-weight: 700; margin: .9rem 0 .3rem; }
    .dlg-docente input, .dlg-docente textarea { width: 100%; box-sizing: border-box; padding: .6rem .7rem; border: 1px solid var(--color-borde);
        border-radius: 8px; background: var(--color-gris-claro); color: var(--color-texto); font: inherit; }
    .dlg-docente textarea { min-height: 6rem; resize: vertical; }
    .dlg-docente .dlg-ayuda { font-size: .85rem; color: var(--color-texto-suave); margin: .25rem 0 0; }
    .dlg-docente .dlg-error { color: #dc3545; font-weight: 700; min-height: 1.2rem; margin: .8rem 0 0; }
    .dlg-docente .dlg-botones { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1rem; }
    `;
    document.head.append(s);
}

// ---------------------------------------------------------------- formulario (ventana modal)
function abrirFormulario({ tipo, nodo = null, alGuardar }) {
    inyectarEstilos();
    const video = tipo === 'video', editando = Boolean(nodo);
    const dlg = el('dialog', 'dlg-docente'), f = el('form');
    dlg.setAttribute('aria-labelledby', 'dlg-titulo');
    const campo = (id, etiqueta, control, ayuda) => {
        const l = el('label', null, etiqueta); l.htmlFor = id; control.id = id; f.append(l, control);
        if (ayuda) f.append(el('p', 'dlg-ayuda', ayuda)); return control;
    };
    const h = el('h2', null, (editando ? 'Editar ' : 'Agregar ') + (video ? 'video' : (nodo ? 'tema' : 'tema / subtema')));
    h.id = 'dlg-titulo'; f.append(h);

    const titulo = campo('dlg-t', 'Título', el('input')); titulo.required = true; titulo.maxLength = 160; titulo.value = nodo ? nodo.titulo : '';
    const url = video ? campo('dlg-url', 'Link de YouTube', el('input'), 'Pegá el link del video (youtube.com o youtu.be).') : null;
    if (url) { url.required = true; url.value = nodo && nodo.videoId ? 'https://youtu.be/' + nodo.videoId : ''; }
    const desc = campo('dlg-d', video ? 'Descripción' : 'Descripción corta (opcional)', el('textarea')); desc.maxLength = 600; desc.value = nodo ? (nodo.descripcion || '') : '';
    let matNombre = null, matUrl = null;
    if (video) {
        matNombre = campo('dlg-mn', 'Material complementario: nombre (opcional)', el('input')); matNombre.maxLength = 120; matNombre.value = nodo ? (nodo.materialNombre || '') : '';
        matUrl = campo('dlg-mu', 'Material complementario: link (opcional)', el('input'), 'Un link https:// a un PDF, documento o carpeta.'); matUrl.value = nodo ? (nodo.materialUrl || '') : '';
    }
    const error = el('p', 'dlg-error'); error.setAttribute('role', 'alert');
    const botones = el('div', 'dlg-botones');
    const cancelar = el('button', 'btn-mini', 'Cancelar'); cancelar.type = 'button';
    const guardar = el('button', 'btn btn-primario', 'Guardar'); guardar.type = 'submit';
    botones.append(cancelar, guardar); f.append(error, botones); dlg.append(f);

    cancelar.onclick = () => dlg.close();
    dlg.addEventListener('close', () => dlg.remove());
    f.addEventListener('submit', async (ev) => {
        ev.preventDefault(); error.textContent = '';
        const datos = { titulo: titulo.value.trim(), descripcion: desc.value.trim() };
        if (!datos.titulo) { error.textContent = 'Escribí un título.'; return; }
        if (video) {
            const id = idYoutube(url.value);
            if (!id) { error.textContent = 'El link de YouTube no es válido.'; return; }
            datos.videoId = id;
            const mu = matUrl.value.trim();
            if (mu && !/^https:\/\//i.test(mu)) { error.textContent = 'El link del material tiene que empezar con https://'; return; }
            datos.materialUrl = mu; datos.materialNombre = matNombre.value.trim();
        }
        guardar.disabled = true;
        try { await alGuardar(datos); dlg.close(); }
        catch (e) { console.error('No se pudo guardar:', e); error.textContent = mensajeError(e); guardar.disabled = false; }
    });
    document.body.append(dlg); dlg.showModal(); titulo.focus();
}

// ---------------------------------------------------------------- datos
const crearNodo = (padre, tipo, datos) => addDoc(COL, { padre, tipo, ...limpiar(datos), orden: Date.now(), creadoPor: correoActual(), fecha: serverTimestamp() });
const editarNodo = (id, datos) => updateDoc(doc(db, 'nodos', id), limpiar(datos));
async function eliminarRama(id) {                          // borra el nodo y todo lo que cuelga de él
    const ids = [id], cola = [id];
    while (cola.length) {
        const p = cola.shift();
        (await getDocs(query(COL, where('padre', '==', p)))).forEach((d) => { ids.push(d.id); cola.push(d.id); });
    }
    for (let i = 0; i < ids.length; i += 400) {
        const lote = writeBatch(db); ids.slice(i, i + 400).forEach((x) => lote.delete(doc(db, 'nodos', x))); await lote.commit();
    }
}
function escuchar(clave, alCambiar) {                      // hijos de una zona o de un nodo, ordenados
    return onSnapshot(query(COL, where('padre', '==', clave)),
        (snap) => alCambiar(snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (a.orden || 0) - (b.orden || 0))),
        (error) => console.error('No se pudo leer el contenido de', clave, error));
}

// ---------------------------------------------------------------- piezas (iguales a las de las páginas fijas)
function botonMini(texto, alClick, peligro) {
    const b = el('button', 'btn-mini' + (peligro ? ' peligro' : ''), texto); b.type = 'button'; b.onclick = alClick; return b;
}
function accionesDe(n) {
    const caja = el('div', 'acciones-docente');
    caja.append(
        botonMini('Editar', () => abrirFormulario({ tipo: n.tipo, nodo: n, alGuardar: (d) => editarNodo(n.id, d) })),
        botonMini('Eliminar', async () => {
            if (!confirm('¿Eliminar "' + n.titulo + '"' + (n.tipo === 'tema' ? ' y todo lo que contiene' : '') + '?')) return;
            try { await eliminarRama(n.id); } catch (e) { avisar(mensajeError(e)); }
        }, true));
    return caja;
}
function tarjetaTema(n) {
    const a = el('article', 'tarjeta-materia activa'); a.dataset.dinamico = '1';
    const cab = el('div', 'tarjeta-cabecera'), ic = el('span', 'icono'); ic.setAttribute('aria-hidden', 'true'); ic.append(icono('tema'));
    cab.append(ic, el('h3', null, n.titulo));
    const ver = el('a', 'btn btn-secundario btn-bloque', 'Ver temas'); ver.href = enlaceNodo(n.id);
    a.append(cab, el('p', null, n.descripcion || ''), ver);
    if (estado.docente) a.append(accionesDe(n));
    return a;
}
function tarjetaAgregar(texto, alClick) {
    const a = el('article', 'tarjeta-materia tarjeta-agregar'); a.dataset.dinamico = '1';
    const b = el('button'); b.type = 'button'; b.onclick = alClick;
    const mas = el('span', 'mas', '+'); mas.setAttribute('aria-hidden', 'true');
    b.append(mas, el('span', null, texto)); a.append(b); return a;
}
function itemVideo(n) {
    const li = el('li'); li.dataset.dinamico = '1';
    const a = el('a', 'tarjeta-recurso'); a.href = enlaceNodo(n.id);
    const ic = el('div', 'recurso-icono'), sp = el('span'); sp.setAttribute('aria-hidden', 'true'); sp.append(icono('video')); ic.append(sp);
    const tx = el('div', 'recurso-texto'); tx.append(el('h3', null, n.titulo)); if (n.descripcion) tx.append(el('p', null, n.descripcion));
    const fl = el('div', 'recurso-flecha', '›'); fl.setAttribute('aria-hidden', 'true');
    a.append(ic, tx, fl); li.append(a);
    if (estado.docente) li.append(accionesDe(n));
    return li;
}
function itemAgregar(texto, alClick) {
    const li = el('li', 'item-agregar'); li.dataset.dinamico = '1';
    const b = el('button', null, '+ ' + texto); b.type = 'button'; b.onclick = alClick; li.append(b); return li;
}
const quitarDinamicos = (c) => c.querySelectorAll(':scope > [data-dinamico]').forEach((x) => x.remove());
function pintarGrilla(grid, temas, clave) {
    quitarDinamicos(grid); inyectarEstilos();
    temas.forEach((n) => grid.append(tarjetaTema(n)));
    if (estado.docente) grid.append(tarjetaAgregar('Agregar tema', () => abrirFormulario({ tipo: 'tema', alGuardar: (d) => crearNodo(clave, 'tema', d) })));
}
function pintarLista(ul, videos, clave) {
    quitarDinamicos(ul); inyectarEstilos();
    videos.forEach((n) => ul.append(itemVideo(n)));
    if (estado.docente) ul.append(itemAgregar('Agregar video', () => abrirFormulario({ tipo: 'video', alGuardar: (d) => crearNodo(clave, 'video', d) })));
}

// ---------------------------------------------------------------- páginas fijas (Mat/...)
function mejorarPaginaFija() {
    const href = location.href.split(/[?#]/)[0];
    const pagina = decodeURI(href.startsWith(RAIZ) ? href.slice(RAIZ.length) : location.pathname.replace(/^\//, ''));
    if (!pagina.startsWith('Mat/')) return;   // portada y especialidad: solo lectura (los docentes no agregan materias)

    // Temas: si varias grillas seguidas están en la misma sección (por ejemplo una fila de 4 y otra de 3),
    // se tratan como una sola y el "+" va al final de la última.
    const grupos = [];
    document.querySelectorAll('main .grilla-materias').forEach((g, i) => {
        const ultimo = grupos[grupos.length - 1];
        if (ultimo && ultimo.contenedor === g.parentElement) ultimo.destino = g;
        else grupos.push({ contenedor: g.parentElement, destino: g, indice: i });
    });
    grupos.forEach(({ destino, indice }) => {
        const clave = pagina + '#g' + indice; let hijos = [];
        const pintar = () => pintarGrilla(destino, hijos.filter((n) => n.tipo === 'tema'), clave);
        escuchar(clave, (l) => { hijos = l; pintar(); }); repintar.push(pintar);
    });

    // Videos: cada lista tiene los suyos. Los subtemas son uno por página, debajo de la última lista.
    const listas = [...document.querySelectorAll('main .lista-recursos')];
    listas.forEach((ul, i) => {
        const clave = pagina + '#l' + i; let hijos = [];
        const pintar = () => pintarLista(ul, hijos.filter((n) => n.tipo === 'video'), clave);
        escuchar(clave, (l) => { hijos = l; pintar(); }); repintar.push(pintar);
    });
    if (listas.length && !grupos.length) {
        const ultima = listas[listas.length - 1], clave = pagina + '#s'; let hijos = [];
        const sub = el('section', 'zona-subtemas'), grid = el('div', 'grilla-materias');
        sub.append(el('h2', 'zona-subtemas-titulo', 'Subtemas'), grid);
        (ultima.closest('.seccion-recursos') || ultima).after(sub);
        const pintar = () => {
            const temas = hijos.filter((n) => n.tipo === 'tema');
            pintarGrilla(grid, temas, clave); sub.hidden = !temas.length && !estado.docente;
        };
        escuchar(clave, (l) => { hijos = l; pintar(); }); repintar.push(pintar);
    }
}

// ---------------------------------------------------------------- página dinámica (contenido.html?id=...)
async function migasFijas(pagina) {                        // copia las migas de la página fija, con sus enlaces
    const url = RAIZ + pagina;
    try {
        const r = await fetch(url); if (!r.ok) throw new Error('sin página');
        const d = new DOMParser().parseFromString(await r.text(), 'text/html');
        const pasos = [...d.querySelectorAll('.migas-de-pan li')].map((li) => {
            const a = li.querySelector('a');
            return { texto: li.textContent.trim(), href: a ? new URL(a.getAttribute('href'), url).href : url };
        });
        if (pasos.length) return pasos;
    } catch (e) { /* se usa el camino mínimo de abajo */ }
    return [{ texto: 'Inicio', href: RAIZ + 'index.html' }, { texto: 'Materias', href: RAIZ + 'quimica.html' }, { texto: 'Volver', href: url }];
}
async function pasosMigas(nodo) {
    const dinamicos = []; let actual = nodo;
    while (actual.padre && !actual.padre.includes('#')) {
        const s = await getDoc(doc(db, 'nodos', actual.padre));
        if (!s.exists()) break;
        actual = { ...s.data(), id: s.id }; dinamicos.unshift({ texto: actual.titulo, href: enlaceNodo(actual.id) });
    }
    const base = actual.padre && actual.padre.includes('#') ? await migasFijas(actual.padre.split('#')[0])
        : [{ texto: 'Inicio', href: RAIZ + 'index.html' }, { texto: 'Materias', href: RAIZ + 'quimica.html' }];
    return [...base, ...dinamicos, { texto: nodo.titulo }];
}
function migasDe(nodo) {
    const nav = el('nav', 'migas-de-pan'), ol = el('ol'); nav.setAttribute('aria-label', 'Migas de pan'); nav.append(ol);
    const pintar = (pasos) => ol.replaceChildren(...pasos.map((p, i) => {
        const li = el('li');
        if (p.href && i < pasos.length - 1) { const a = el('a', null, p.texto); a.href = p.href; li.append(a); }
        else { li.textContent = p.texto; if (i === pasos.length - 1) li.setAttribute('aria-current', 'page'); }
        return li;
    }));
    pintar([{ texto: 'Inicio', href: RAIZ + 'index.html' }, { texto: nodo.titulo }]);
    pasosMigas(nodo).then(pintar).catch((e) => console.error('No se pudieron armar las migas:', e));
    return nav;
}
function cabeceraDe(titulo, subtitulo, ic) {
    const c = el('div', 'cabecera-materia'), t = el('div', 'titulo-materia-icono');
    const i = el('span', 'icono-grande'); i.setAttribute('aria-hidden', 'true'); i.append(icono(ic));
    const d = el('div'); d.append(el('h1', null, titulo)); if (subtitulo) d.append(el('p', null, subtitulo));
    t.append(i, d); c.append(t); return c;
}

function paginaDinamica(cont) {
    inyectarEstilos();
    const id = new URLSearchParams(location.search).get('id');
    const mensaje = (t, d) => {
        const s = el('section', 'seccion-temas'); s.append(el('h1', null, t), el('p', null, d));
        const v = el('a', 'btn btn-secundario', '← Volver a las materias'); v.href = RAIZ + 'quimica.html'; s.append(v);
        cont.replaceChildren(s);
    };
    if (!id) return mensaje('Falta indicar qué contenido mostrar', 'Elegí una materia desde la lista de materias.');

    let nodo, hijos = [], hijosListos = false, migas = null, migasId = null, firma = '', cuerpoVideo = null, comentarios = null;
    const acciones = el('div', 'acciones-docente acciones-pagina');
    const grid = el('div', 'grilla-materias'), secTemas = el('section', 'seccion-temas'); secTemas.append(el('h2', 'zona-subtemas-titulo', 'Subtemas'), grid);
    const ul = el('ul', 'lista-recursos'), secVideos = el('section', 'seccion-recursos'), instruccion = el('p', 'instruccion-recurso', 'Elegí un recurso para ver su contenido.');
    secVideos.append(el('h2', 'sr-only', 'Recursos disponibles'), instruccion, ul);
    const vacio = el('p', 'instruccion-recurso', 'Todavía no hay contenido acá. ¡Pronto vas a encontrarlo!');

    function pintarAcciones() {
        acciones.replaceChildren();
        if (!estado.docente || !nodo) return;
        acciones.append(
            botonMini('Editar', () => abrirFormulario({ tipo: nodo.tipo, nodo, alGuardar: (d) => editarNodo(nodo.id, d) })),
            botonMini('Eliminar', async () => {
                if (!confirm('¿Eliminar "' + nodo.titulo + '"' + (nodo.tipo === 'tema' ? ' y todo lo que contiene' : '') + '?')) return;
                try { const volver = volverA(nodo); await eliminarRama(nodo.id); location.href = volver; } catch (e) { avisar(mensajeError(e)); }
            }, true));
    }
    function vistaTema() {
        const temas = hijos.filter((n) => n.tipo === 'tema'), videos = hijos.filter((n) => n.tipo === 'video');
        pintarGrilla(grid, temas, nodo.id); pintarLista(ul, videos, nodo.id);
        secTemas.hidden = !temas.length && !estado.docente;
        secVideos.hidden = !videos.length && !estado.docente;
        instruccion.textContent = videos.length ? 'Elegí un recurso para ver su contenido.'
            : 'Todavía no hay videos acá. Tocá "+ Agregar video" para cargar el primero.';
        instruccion.hidden = !videos.length && !estado.docente;
        vacio.hidden = Boolean(hijos.length) || estado.docente;
        cont.replaceChildren(migas, cabeceraDe(nodo.titulo, nodo.descripcion, 'tema'), acciones, secVideos, secTemas, vacio);
    }
    function vistaVideo() {
        const nueva = JSON.stringify([nodo.titulo, nodo.descripcion, nodo.videoId, nodo.materialUrl, nodo.materialNombre, nodo.padre]);
        if (nueva === firma && cuerpoVideo) return;           // no se vuelve a cargar el video si no cambió nada
        firma = nueva;
        const principal = el('div', 'recurso-principal'), cv = el('div', 'contenedor-video');
        if (/^[\w-]{11}$/.test(nodo.videoId || '')) {
            const fr = document.createElement('iframe');
            fr.src = 'https://www.youtube.com/embed/' + nodo.videoId; fr.title = 'Video: ' + nodo.titulo;
            fr.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); fr.setAttribute('frameborder', '0');
            fr.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            fr.setAttribute('allowfullscreen', ''); cv.append(fr);
        } else cv.append(el('p', 'instruccion-recurso', 'El video todavía no está disponible.'));
        const volver = el('a', 'btn btn-secundario btn-volver', '← Volver a recursos'); volver.href = volverA(nodo);
        principal.append(cv, volver);
        const lateral = el('aside', 'recurso-sidebar'), tarjeta = el('div', 'tarjeta-info');
        tarjeta.append(el('h3', null, 'Descripción'));
        const parrafos = String(nodo.descripcion || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
        (parrafos.length ? parrafos : ['Sin descripción.']).forEach((x) => tarjeta.append(el('p', null, x)));
        lateral.append(tarjeta);
        if (/^https:\/\//i.test(nodo.materialUrl || '')) {
            const mat = el('div', 'tarjeta-info'), fila = el('div', 'material-descarga'), info = el('div', 'info-pdf');
            info.append(el('strong', null, nodo.materialNombre || 'Material complementario'));
            const a = el('a', 'btn btn-primario btn-chico', 'Abrir'); a.href = nodo.materialUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
            fila.append(info, a); mat.append(el('h3', null, 'Material complementario'), fila); lateral.append(mat);
        }
        cuerpoVideo = el('section', 'contenedor-recurso'); cuerpoVideo.append(principal, lateral);
        const primera = !comentarios;
        if (primera) { comentarios = el('section', 'seccion-comentarios'); comentarios.dataset.paginaId = nodo.id; }
        cont.replaceChildren(migas, cabeceraDe(nodo.titulo, 'Video explicativo', 'video'), acciones, cuerpoVideo, comentarios);
        if (primera) import('./comentarios.js');            // arma el formulario y la lista de comentarios
    }
    function render() {
        if (nodo === undefined) return;
        if (nodo === null) return mensaje('Este contenido no existe', 'Puede que se haya eliminado o que el enlace sea incorrecto.');
        document.title = nodo.titulo + ' - ET27';
        if (migasId !== nodo.id + '|' + nodo.padre) { migasId = nodo.id + '|' + nodo.padre; migas = migasDe(nodo); }
        pintarAcciones();
        if (nodo.tipo === 'video') vistaVideo();
        else if (hijosListos) vistaTema();
    }
    onSnapshot(doc(db, 'nodos', id), (snap) => { nodo = snap.exists() ? { ...snap.data(), id: snap.id } : null; render(); },
        (error) => { console.error('No se pudo leer el contenido:', error); mensaje('No se pudo cargar el contenido', 'Probá de nuevo en unos minutos.'); });
    escuchar(id, (l) => { hijos = l; hijosListos = true; render(); });
    repintar.push(render);
}

// ---------------------------------------------------------------- ajustes sobre contenido FIJO (los archivos HTML)
// Colección "ajustes": un documento por elemento fijo { clave, oculto, titulo, descripcion, videoId }.
//   clave = ruta de la página a la que apunta la tarjeta (ej. "Mat/L/introL.html"); si la tarjeta no tiene
//   enlace (todavía no existe), "<página donde está>|<título original>".
// El archivo HTML NO se modifica: acá se aplican los ajustes por encima, al instante, a todo el que mire.
const rutaDe = (href) => {
    if (!href || href === '#') return null;
    try { const u = new URL(href, location.href);
          return u.href.startsWith(RAIZ) && /\.html$/.test(u.pathname) ? decodeURI(u.href.slice(RAIZ.length).split(/[?#]/)[0]) : null;
    } catch { return null; }
};
function aplicarAjustes(pagina, aj) {
    const orig = (nodo, sel) => { const e = nodo.querySelector(sel); if (e && e.dataset.orig === undefined) e.dataset.orig = e.textContent; return e; };
    document.querySelectorAll('main .grilla-materias > .tarjeta-materia:not([data-dinamico]), main .lista-recursos > li:not([data-dinamico]):not(.item-agregar)').forEach((it) => {
        const a = it.querySelector('a.btn, a.tarjeta-recurso'), h3 = orig(it, 'h3'), p = orig(it, 'p');
        if (!h3) return;
        const x = aj.get(rutaDe(a && a.getAttribute('href')) || (pagina + '|' + h3.dataset.orig)) || {};
        it.style.display = x.oculto ? 'none' : '';
        h3.textContent = x.titulo || h3.dataset.orig;
        if (p) p.textContent = x.descripcion || p.dataset.orig;
    });
    const yo = aj.get(pagina);                                    // ajustes de ESTA página
    if (!yo) return;
    if (yo.oculto) {
        const m = document.querySelector('main');
        if (m) { const a = el('a', 'btn btn-secundario', 'Volver al inicio'); a.href = RAIZ + 'index.html';
                 m.replaceChildren(el('p', 'instruccion-recurso', 'Este contenido ya no está disponible.'), a); }
        return;
    }
    const h1 = orig(document, '.cabecera-materia h1'), mig = orig(document, '.migas-de-pan [aria-current="page"]');
    if (h1 && yo.titulo) h1.textContent = yo.titulo;
    if (mig && yo.titulo) mig.textContent = yo.titulo;
    const ifr = document.querySelector('main .contenedor-video iframe');
    if (ifr && yo.videoId && !ifr.src.includes(yo.videoId)) ifr.src = 'https://www.youtube.com/embed/' + yo.videoId;
}
function escucharAjustes() {
    const href = location.href.split(/[?#]/)[0];
    const pagina = decodeURI(href.startsWith(RAIZ) ? href.slice(RAIZ.length) : location.pathname.replace(/^\//, ''));
    if (!pagina.startsWith('Mat/')) return;
    onSnapshot(collection(db, 'ajustes'),
        (snap) => aplicarAjustes(pagina, new Map(snap.docs.map((x) => [x.data().clave, x.data()]))),
        (error) => console.error('No se pudieron leer los ajustes:', error));
}

// ---------------------------------------------------------------- arranque
onAuthStateChanged(auth, (user) => {
    estado.docente = Boolean(user) && ['profesor', 'admin'].includes(localStorage.getItem('rolUsuario'));
    repintar.forEach((f) => f());
});
const dinamica = document.getElementById('contenido-dinamico');
if (dinamica) paginaDinamica(dinamica); else { mejorarPaginaFija(); escucharAjustes(); }

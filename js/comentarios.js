// =============================================================
// Módulo de comentarios reutilizable (Firestore + Auth)
//
// Uso en cualquier página de video:
//   1) <section class="seccion-comentarios" data-pagina-id="ID_UNICO"></section>
//   2) <script type="module" src="../../../js/comentarios.js"></script>
//
// El módulo arma el formulario y la lista dentro de esa sección.
// Colección: comentarios_leyes
// Campos:    paginaId, autor, uid, comentario, fecha
// =============================================================
import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const COLECCION = "comentarios_leyes";
const MAX_COMENTARIOS = 20;   // límite de lecturas para cuidar la cuota gratuita
const MAX_CARACTERES = 1000;
const URL_LOGIN = new URL('../login.html', import.meta.url).href;

function crearMensaje(texto, clase = 'comentarios-vacio') {
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    return p;
}

// Todo el texto del usuario entra con textContent (nunca innerHTML)
function crearTarjeta(data) {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'comentario-item';

    const cabecera = document.createElement('div');
    cabecera.className = 'comentario-cabecera';

    const autor = document.createElement('strong');
    autor.className = 'comentario-autor';
    autor.textContent = data.autor || 'Anónimo';

    const fecha = document.createElement('small');
    fecha.className = 'comentario-fecha';
    fecha.textContent = data.fecha && typeof data.fecha.toDate === 'function'
        ? data.fecha.toDate().toLocaleString('es-AR')
        : 'Recién publicado';

    cabecera.append(autor, fecha);

    const texto = document.createElement('p');
    texto.className = 'comentario-texto';
    texto.textContent = data.comentario || '';

    tarjeta.append(cabecera, texto);
    return tarjeta;
}

function iniciarSeccion(seccion) {
    const paginaId = seccion.dataset.paginaId;
    if (!paginaId) {
        console.warn('comentarios.js: falta data-pagina-id en la sección de comentarios.');
        return;
    }

    // Markup estático (no incluye datos del usuario)
    seccion.innerHTML = `
        <h2>Dudas y Comentarios</h2>
        <p>Dejá tu duda acá abajo. ¡Nos ayudamos entre todos!</p>

        <div class="comentarios-aviso" hidden>
            Para dejar un comentario, tenés que <a href="${URL_LOGIN}"><strong>iniciar sesión</strong></a> primero.
        </div>

        <form class="comentarios-form" hidden>
            <label class="comentarios-label">
                Tu comentario o consulta:
                <textarea class="comentarios-texto" rows="4" maxlength="${MAX_CARACTERES}" required
                    placeholder="Escribí tu consulta sobre este video acá..."></textarea>
            </label>
            <p class="comentarios-error" role="alert" hidden></p>
            <button type="submit" class="comentarios-btn">Publicar comentario</button>
        </form>

        <div class="comentarios-lista" aria-live="polite"></div>
    `;

    const aviso = seccion.querySelector('.comentarios-aviso');
    const form = seccion.querySelector('.comentarios-form');
    const textarea = seccion.querySelector('.comentarios-texto');
    const error = seccion.querySelector('.comentarios-error');
    const boton = seccion.querySelector('.comentarios-btn');
    const lista = seccion.querySelector('.comentarios-lista');

    lista.append(crearMensaje('Cargando comentarios...'));

    // --- Sesión ---
    let usuario = null;
    onAuthStateChanged(auth, (user) => {
        usuario = user;
        form.hidden = !user;
        aviso.hidden = !!user;
    });

    // --- Publicar ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!usuario) return;

        const texto = textarea.value.trim();
        if (!texto) return;

        error.hidden = true;
        boton.disabled = true;
        boton.textContent = 'Publicando...';

        const autor = usuario.displayName || (usuario.email || '').split('@')[0] || 'Anónimo';

        try {
            await addDoc(collection(db, COLECCION), {
                paginaId: paginaId,
                autor: autor,
                uid: usuario.uid,
                comentario: texto,
                fecha: serverTimestamp()
            });
            form.reset();
        } catch (err) {
            console.error('Error al publicar el comentario:', err);
            error.textContent = 'Hubo un error al publicar. Probá de nuevo en unos minutos.';
            error.hidden = false;
        } finally {
            boton.disabled = false;
            boton.textContent = 'Publicar comentario';
        }
    });

    // --- Leer en tiempo real ---
    const q = query(
        collection(db, COLECCION),
        where('paginaId', '==', paginaId),
        orderBy('fecha', 'desc'),
        limit(MAX_COMENTARIOS)
    );

    onSnapshot(q, (snapshot) => {
        lista.replaceChildren();
        if (snapshot.empty) {
            lista.append(crearMensaje('Aún no hay comentarios. ¡Sé el primero en preguntar!'));
            return;
        }
        snapshot.forEach((doc) => lista.append(crearTarjeta(doc.data())));
    }, (err) => {
        console.error('Error al leer los comentarios:', err);
        lista.replaceChildren(crearMensaje('No se pudieron cargar los comentarios.'));
    });
}

document.querySelectorAll('.seccion-comentarios[data-pagina-id]').forEach(iniciarSeccion);

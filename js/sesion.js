// ==========================================================================
// SESIÓN: lee el usuario de Firebase y mantiene el menú del header al día.
// Se carga en todas las páginas con:  <script type="module" src=".../js/sesion.js"></script>
// ==========================================================================
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

window.tptSesionListo = true;   // avisa a header.js que el cierre de sesión lo hace este archivo

// Dirección del inicio, calculada desde este mismo archivo (sirve en cualquier carpeta y en GitHub Pages)
const urlInicio = new URL('../index.html', import.meta.url).href;

onAuthStateChanged(auth, (user) => {
    if (user && user.email) {
        localStorage.setItem('tptUsuario', user.email);
        if (window.tptSesion) window.tptSesion.mostrar(user.email);
    } else {
        localStorage.removeItem('tptUsuario');
        localStorage.removeItem('rolUsuario');      // sin sesión no hay rol
        if (window.tptSesion) window.tptSesion.mostrar(null);
    }
});

window.addEventListener('tpt-salir', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    } finally {
        localStorage.removeItem('tptUsuario');
        localStorage.removeItem('rolUsuario');
        window.location.href = urlInicio;
    }
});
// Dirección de este archivo: sirve para armar enlaces y cargar módulos correctos desde cualquier carpeta (Mat/, etc.)
var TPT_JS = (document.currentScript && document.currentScript.src) || '';

// ==========================================
// 0. MENÚ DE USUARIO, MODO OSCURO Y TAMAÑO DE LETRA (NUEVO)
//    - Hay "sesión" cuando existe el correo guardado en localStorage ('tptUsuario'),
//      que escribe js/sesion.js a partir de Firebase.
//    - Sin sesión: la página se ve con el tema claro y la letra normal, y no hay controles.
//    - Con sesión: se aplican (y se pueden cambiar) el tema y el tamaño de letra.
// ==========================================
(function () {
    const raiz = document.documentElement;

    const TAMANOS = [16, 18, 20, 22];
    const NOMBRES = ['normal', 'grande', 'muy grande', 'máximo'];
    let nivel = parseInt(localStorage.getItem('tamanoLetra'), 10);
    if (!(nivel >= 0 && nivel < TAMANOS.length)) nivel = 0;

    const aplicarLetra = () => {
        const px = TAMANOS[nivel] + 'px';
        raiz.style.fontSize = px;                      // escala todo lo que usa rem
        raiz.style.setProperty('--fuente-base', px);   // escala el texto del <body>
    };
    const quitarLetra = () => {
        raiz.style.fontSize = '';
        raiz.style.removeProperty('--fuente-base');
    };
    const temaGuardadoOscuro = () => {
        const g = localStorage.getItem('tema');
        return g ? g === 'oscuro' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    };
    const ponerTema = (oscuro) => {
        if (oscuro) raiz.setAttribute('data-tema', 'oscuro');
        else raiz.removeAttribute('data-tema');
        const sw = document.getElementById('btnTema');
        if (sw) sw.setAttribute('aria-checked', oscuro ? 'true' : 'false');
    };

    // --- Panel del usuario ---
    const panel = () => document.getElementById('usuarioPanel');
    const botonAvatar = () => document.getElementById('btnUsuario');
    const cerrarPanel = () => {
        const p = panel(), b = botonAvatar();
        if (p) p.hidden = true;
        if (b) b.setAttribute('aria-expanded', 'false');
    };

    const actualizarBotonesLetra = () => {
        const menos = document.getElementById('btnLetraMenos');
        const mas = document.getElementById('btnLetraMas');
        const txt = document.getElementById('letraNivel');
        if (menos) menos.disabled = nivel === 0;
        if (mas) mas.disabled = nivel === TAMANOS.length - 1;
        if (txt) txt.textContent = NOMBRES[nivel];
    };

    // --- Mostrar u ocultar todo según haya sesión ---
    function mostrarSesion(email) {
        if (email) {
            raiz.setAttribute('data-sesion', 'activa');
            const c = email.trim().charAt(0).toUpperCase();
            raiz.style.setProperty('--inicial', '"' + (/[A-Z0-9]/.test(c) ? c : '?') + '"');
            const el = document.getElementById('usuarioEmail');
            if (el) {
                el.textContent = '';
                const i = email.indexOf('@');
                if (i > 0) el.append(email.slice(0, i + 1), document.createElement('wbr'), email.slice(i + 1));   // si no entra, se parte después de la arroba
                else el.textContent = email;
            }
            aplicarLetra();
            ponerTema(temaGuardadoOscuro());
            actualizarBotonesLetra();
        } else {
            raiz.removeAttribute('data-sesion');
            raiz.style.removeProperty('--inicial');
            quitarLetra();
            ponerTema(false);
            cerrarPanel();
        }
    }
    window.tptSesion = { mostrar: mostrarSesion };   // lo usa js/sesion.js cuando Firebase confirma la sesión

    mostrarSesion(localStorage.getItem('tptUsuario'));

    document.addEventListener('DOMContentLoaded', () => {
        mostrarSesion(localStorage.getItem('tptUsuario'));   // por si el script se cargó antes que el HTML

        const avatar = botonAvatar();
        if (avatar) {
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                const abrir = panel().hidden;
                panel().hidden = !abrir;
                avatar.setAttribute('aria-expanded', abrir ? 'true' : 'false');
            });
            document.addEventListener('click', (e) => {
                const menu = document.getElementById('usuarioMenu');
                if (menu && !menu.contains(e.target)) cerrarPanel();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { cerrarPanel(); avatar.focus(); }
            });
        }

        const sw = document.getElementById('btnTema');
        if (sw) {
            sw.addEventListener('click', () => {
                const oscuro = raiz.getAttribute('data-tema') !== 'oscuro';
                localStorage.setItem('tema', oscuro ? 'oscuro' : 'claro');
                ponerTema(oscuro);
            });
        }

        const cambiarLetra = (delta) => {
            nivel = Math.max(0, Math.min(TAMANOS.length - 1, nivel + delta));
            localStorage.setItem('tamanoLetra', nivel);
            aplicarLetra();
            actualizarBotonesLetra();
        };
        const mas = document.getElementById('btnLetraMas');
        const menos = document.getElementById('btnLetraMenos');
        if (mas) mas.addEventListener('click', () => cambiarLetra(1));
        if (menos) menos.addEventListener('click', () => cambiarLetra(-1));
        actualizarBotonesLetra();

        const salir = document.getElementById('btnSalir');
        if (salir) {
            salir.addEventListener('click', () => {
                if (window.tptSesionListo) {
                    window.dispatchEvent(new CustomEvent('tpt-salir'));   // js/sesion.js cierra la sesión en Firebase
                } else {                                                  // sin Firebase (ej. archivo abierto con doble clic)
                    localStorage.removeItem('tptUsuario');
                    localStorage.removeItem('rolUsuario');
                    location.reload();
                }
            });
        }
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. TU CÓDIGO ORIGINAL (NO SE TOCÓ NADA)
    // ==========================================
    const header = document.querySelector('.encabezado-principal');
    let esperandoFotograma = false;

    const evaluarScrollHeader = () => {
        // Verificamos si la pantalla es de un celular (menor a 768px de ancho)
        const esCelular = window.innerWidth < 768;

        if (esCelular) {
            // Lógica para celulares: achicamos al bajar más de 80px
            if (window.scrollY > 80) {
                header.classList.add('encabezado-compacto');
            } else {
                header.classList.remove('encabezado-compacto');
            }
        } else {
            // Lógica para PC: siempre garantizamos que tenga su tamaño original
            header.classList.remove('encabezado-compacto');
        }
        
        esperandoFotograma = false;
    };

    // Escuchamos el scroll
    window.addEventListener('scroll', () => {
        if (!esperandoFotograma) {
            window.requestAnimationFrame(evaluarScrollHeader);
            esperandoFotograma = true;
        }
    });

    // NUEVO: Escuchamos si el usuario redimensiona la ventana
    window.addEventListener('resize', () => {
        if (!esperandoFotograma) {
            window.requestAnimationFrame(evaluarScrollHeader);
            esperandoFotograma = true;
        }
    });
    
    // Evaluamos al cargar la página
    evaluarScrollHeader();

    // ==========================================
    // 2. NUEVA LÓGICA DE ROLES (Evita editar los HTML)
    // ==========================================
    const rolActual = localStorage.getItem('rolUsuario') || 'alumno';
    
    // Buscamos la lista (ul) del menú y el enlace de Materiales
    const ulMenu = document.querySelector('.navegacion-principal ul');
    const linkMateriales = document.querySelector('a[href$="materiales.html"]');

    // Si el que inició sesión es profesor o admin...
    if (rolActual === 'profesor' || rolActual === 'admin') {
        
        // A. Ocultamos la pestaña "Materiales" a los profesores
        if (linkMateriales) {
            linkMateriales.parentElement.style.display = 'none';
        }

        // B. Verificamos que no exista ya el botón para no duplicarlo, y lo creamos
        if (ulMenu && !document.getElementById('nav-panel-profesor')) {
            const liProfesor = document.createElement('li');
            liProfesor.id = 'nav-panel-profesor';
            
            // Página propia del panel, con el mismo menú que el resto del sitio. La dirección sale de este
            // archivo, así funciona desde cualquier carpeta (Mat/, etc.).
            const enlacePanel = document.createElement('a');
            enlacePanel.href = new URL('../panel-profesor.html', TPT_JS).href;
            enlacePanel.textContent = 'Panel Profesor';
            enlacePanel.style.cssText = 'font-weight: bold; color: var(--color-primario);';
            liProfesor.append(enlacePanel);

            // Lo insertamos en el menú justo después de donde estaba "Materiales"
            if (linkMateriales) {
                linkMateriales.parentElement.after(liProfesor);
            } else {
                ulMenu.appendChild(liProfesor);
            }
        }
    }
});

// --- Edición de contenido por docentes: agrega el "+" en materias y temas (solo páginas de /Mat/) ---
(function () {
    const src = document.currentScript && document.currentScript.src;
    if (!src || !/\/Mat\//.test(location.pathname)) return;
    document.addEventListener('DOMContentLoaded', function () {
        import(new URL('contenido-docente.js', src).href)
            .catch(function (e) { console.error('No se pudo cargar contenido-docente.js:', e); });
    });
})();


// =============================================================================
// AVISOS DEL SITIO (reemplazan a los alert) · SALUDO AL INICIAR SESIÓN
//   window.tptAviso(titulo, 'ok' | 'error', { detalle, accion: { texto, alClick } })
// =============================================================================
(function () {
    function estilos() {
        if (document.getElementById('estilos-avisos')) return;
        const s = document.createElement('style'); s.id = 'estilos-avisos';
        s.textContent = `
        #tpt-avisos { position: fixed; z-index: 10001; bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem); left: 50%; transform: translateX(-50%);
            width: min(540px, calc(100% - 2rem)); display: flex; flex-direction: column-reverse; gap: .6rem; pointer-events: none; }
        .tpt-aviso { pointer-events: auto; display: flex; align-items: flex-start; gap: .8rem; padding: .85rem 1rem;
            background: var(--color-fondo-header, #e8f6ed); color: var(--color-texto, #04180d);
            border: 1px solid var(--color-borde, #7fc49c); border-left: 6px solid #2f7a52; border-radius: 12px;
            box-shadow: 0 10px 28px rgba(4, 24, 13, .25); animation: tpt-aviso-entra .3s ease; }
        .tpt-aviso--error { border-left-color: #dc3545; }
        .tpt-aviso--sale { opacity: 0; transform: translateY(8px); transition: opacity .25s ease, transform .25s ease; }
        .tpt-aviso-icono { flex: none; width: 1.9rem; height: 1.9rem; border-radius: 50%; display: grid; place-items: center;
            background: #2f7a52; color: #fff; font-weight: 700; line-height: 1; }
        .tpt-aviso--error .tpt-aviso-icono { background: #dc3545; }
        .tpt-aviso-cuerpo { flex: 1; min-width: 0; }
        .tpt-aviso-titulo { display: block; font-weight: 700; }
        .tpt-aviso-detalle { display: block; font-size: .92rem; opacity: .9; margin-top: .15rem; overflow-wrap: anywhere; }
        .tpt-aviso-accion { margin-top: .55rem; padding: .35rem .9rem; border-radius: 8px; border: 0; cursor: pointer;
            background: var(--color-primario, #2f7a52); color: var(--color-texto-sobre-primario, #fff); font: inherit; font-size: .9rem; font-weight: 700; }
        .tpt-aviso-cerrar { flex: none; background: none; border: 0; color: inherit; font-size: 1.3rem; line-height: 1; cursor: pointer; padding: .1rem .35rem; border-radius: 6px; opacity: .7; }
        .tpt-aviso-cerrar:hover { opacity: 1; }
        .tpt-aviso-accion:focus-visible, .tpt-aviso-cerrar:focus-visible { outline: 3px solid var(--color-primario, #2f7a52); outline-offset: 2px; }
        @keyframes tpt-aviso-entra { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .tpt-aviso { animation: none; } .tpt-aviso--sale { transition: none; } }`;
        document.head.append(s);
    }

    window.tptAviso = function (titulo, tipo, opciones) {
        const o = opciones || {}, error = tipo === 'error';
        estilos();
        let caja = document.getElementById('tpt-avisos');
        if (!caja) { caja = document.createElement('div'); caja.id = 'tpt-avisos'; document.body.append(caja); }

        const a = document.createElement('div');
        a.className = 'tpt-aviso' + (error ? ' tpt-aviso--error' : '');
        a.setAttribute('role', error ? 'alert' : 'status');
        const ic = document.createElement('span'); ic.className = 'tpt-aviso-icono'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = error ? '!' : '✓';
        const cuerpo = document.createElement('div'); cuerpo.className = 'tpt-aviso-cuerpo';
        const t = document.createElement('span'); t.className = 'tpt-aviso-titulo'; t.textContent = titulo; cuerpo.append(t);
        if (o.detalle) { const d = document.createElement('span'); d.className = 'tpt-aviso-detalle'; d.textContent = o.detalle; cuerpo.append(d); }
        let temporizador = 0;
        const cerrar = () => {
            clearTimeout(temporizador); a.classList.add('tpt-aviso--sale');
            setTimeout(() => a.remove(), 260);
        };
        if (o.accion) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'tpt-aviso-accion'; b.textContent = o.accion.texto;
            b.addEventListener('click', () => { cerrar(); o.accion.alClick(); }); cuerpo.append(b);
        }
        const x = document.createElement('button'); x.type = 'button'; x.className = 'tpt-aviso-cerrar'; x.setAttribute('aria-label', 'Cerrar aviso'); x.textContent = '×';
        x.addEventListener('click', cerrar);
        a.append(ic, cuerpo, x); caja.append(a);

        // Se va solo; si lo señalás con el mouse o el teclado, se queda hasta que lo cierres
        const programar = () => { temporizador = setTimeout(cerrar, error ? 12000 : 8000); };
        a.addEventListener('mouseenter', () => clearTimeout(temporizador)); a.addEventListener('mouseleave', programar);
        a.addEventListener('focusin', () => clearTimeout(temporizador)); a.addEventListener('focusout', programar);
        programar();
        return cerrar;
    };

    document.addEventListener('DOMContentLoaded', () => {
        // Saludo al iniciar sesión (lo deja guardado js/login.js antes de redirigir)
        try {
            const crudo = sessionStorage.getItem('tptBienvenida');
            if (crudo) {
                sessionStorage.removeItem('tptBienvenida');
                const b = JSON.parse(crudo), docente = b.rol === 'profesor' || b.rol === 'admin';
                window.tptAviso(docente ? '¡Bienvenido/a, profesor/a!' : '¡Bienvenido/a!', 'ok', {
                    detalle: 'Iniciaste sesión como ' + b.email + '.' + (docente ? ' Desde acá podés abrir el panel para agregar y editar contenido.' : ''),
                    accion: docente ? { texto: 'Ir al panel', alClick: () => { location.href = new URL('../panel-profesor.html', TPT_JS).href; } } : null,
                });
            }
        } catch (e) { /* sin saludo */ }
    });
})();

import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, linkWithCredential } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const btnGoogle = document.getElementById('btn-google');
const mensajeError = document.getElementById('mensaje-error');
const mensajeErrorRegistro = document.getElementById('mensaje-error-registro');

// --- BANNER DE BIENVENIDA (reemplaza al alert) ---
// Se arma solo desde acá: trae sus propios estilos, no hace falta tocar HTML ni CSS.
function mostrarBienvenida(esProfesor, email) {
    if (!document.getElementById('estilos-bienvenida')) {
        const estilos = document.createElement('style');
        estilos.id = 'estilos-bienvenida';
        estilos.textContent = `
        .bienvenida { position: fixed; z-index: 10001; left: 50%; transform: translateX(-50%);
            bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem); width: min(540px, calc(100% - 2rem));
            display: flex; align-items: flex-start; gap: .8rem; padding: .85rem 1rem;
            background: var(--color-fondo-header, #e8f6ed); color: var(--color-texto, #04180d);
            border: 1px solid var(--color-borde, #7fc49c); border-left: 6px solid #2f7a52; border-radius: 12px;
            box-shadow: 0 10px 28px rgba(4, 24, 13, .25); animation: bienvenida-entra .3s ease; }
        .bienvenida-icono { flex: none; width: 1.9rem; height: 1.9rem; border-radius: 50%; display: grid; place-items: center;
            background: #2f7a52; color: #fff; font-weight: 700; line-height: 1; }
        .bienvenida-titulo { display: block; font-weight: 700; }
        .bienvenida-detalle { display: block; font-size: .92rem; opacity: .9; margin-top: .15rem; overflow-wrap: anywhere; }
        @keyframes bienvenida-entra { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @media (prefers-reduced-motion: reduce) { .bienvenida { animation: none; } }`;
        document.head.append(estilos);
    }
    const aviso = document.createElement('div');
    aviso.className = 'bienvenida';
    aviso.setAttribute('role', 'status');

    const icono = document.createElement('span');
    icono.className = 'bienvenida-icono';
    icono.setAttribute('aria-hidden', 'true');
    icono.textContent = '✓';

    const cuerpo = document.createElement('div');
    const titulo = document.createElement('span');
    titulo.className = 'bienvenida-titulo';
    titulo.textContent = esProfesor ? '¡Bienvenido/a, profesor/a!' : '¡Bienvenido/a!';
    const detalle = document.createElement('span');
    detalle.className = 'bienvenida-detalle';
    detalle.textContent = 'Iniciaste sesión como ' + email + '. Entrando al sitio…';   // textContent: el correo nunca se interpreta como HTML
    cuerpo.append(titulo, detalle);

    aviso.append(icono, cuerpo);
    document.body.append(aviso);
}

// --- FUNCIÓN PARA VERIFICAR EL ROL Y REDIRIGIR ---
async function verificarRolYRedirigir(user) {
    const emailIngresado = user.email ? user.email.trim().toLowerCase() : '';

    // ÚNICOS correos con rol de profesor (en minúsculas). El resto son alumnos.
    const correosProfesores = [
        'marcos.bertoldi.945@alu.tecnica29de6.edu.ar',
        'pepito@tecnica29de6.edu.ar',
        'upruebadocente@gmail.com'
    ];

    const esProfesor = correosProfesores.includes(emailIngresado);
    localStorage.setItem('rolUsuario', esProfesor ? 'profesor' : 'alumno');

    // Mostramos el banner un instante y después entramos al sitio
    mostrarBienvenida(esProfesor, user.email);
    await new Promise((listo) => setTimeout(listo, 1800));

    // Redirección relativa: va al index.html que está junto a login.html (funciona en cualquier repositorio)
    window.location.href = new URL('index.html', window.location.href).href;
}

// --- INICIO DE SESIÓN CON CORREO Y CONTRASEÑA ---
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        if (mensajeError) mensajeError.textContent = '';

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            await verificarRolYRedirigir(userCredential.user);
        } catch (error) {
            console.error("Error al iniciar sesión:", error.code);
            if (mensajeError) {
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                    mensajeError.textContent = 'Correo o contraseña incorrectos.';
                } else if (error.code === 'auth/user-not-found') {
                    mensajeError.textContent = 'No existe un usuario registrado con este correo.';
                } else {
                    mensajeError.textContent = 'Error al intentar ingresar (' + error.code + ').';
                }
            }
        }
    });
}

// --- INICIO DE SESIÓN CON GOOGLE ---
if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        if (mensajeError) mensajeError.textContent = ''; 

        try {
            const result = await signInWithPopup(auth, provider);
            await verificarRolYRedirigir(result.user);
        } catch (error) {
            console.error("Error con Google:", error.code);
            if (error.code !== 'auth/popup-closed-by-user' && mensajeError) {
                mensajeError.textContent = 'Error al iniciar sesión con Google.';
            }
        }
    });
}

// --- CREAR CUENTA NUEVA ---
if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email-registro').value.trim();
        const password = document.getElementById('password-registro').value.trim();
        if (mensajeErrorRegistro) mensajeErrorRegistro.textContent = '';

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await verificarRolYRedirigir(userCredential.user);
        } catch (error) {
            console.error("Error al crear cuenta:", error.code);
            if (mensajeErrorRegistro) {
                if (error.code === 'auth/email-already-in-use') {
                    mensajeErrorRegistro.textContent = 'Este correo ya está registrado. Intentá iniciar sesión.';
                } else if (error.code === 'auth/weak-password') {
                    mensajeErrorRegistro.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                } else {
                    mensajeErrorRegistro.textContent = 'Error al crear la cuenta.';
                }
            }
        }
    });
}
// --- RECUPERAR / CREAR CONTRASEÑA ---
const btnOlvide = document.getElementById('btn-olvide');
if (btnOlvide) {
    btnOlvide.addEventListener('click', async () => {
        const email = document.getElementById('email').value.trim();
        if (!email) {
            if (mensajeError) mensajeError.textContent = 'Escribí tu correo arriba y volvé a tocar este botón.';
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            if (mensajeError) mensajeError.textContent = 'Si el correo está registrado, te enviamos un mail para elegir tu contraseña. Revisá también Spam.';
        } catch (error) {
            console.error('Error al enviar el mail de recuperación:', error.code);
            if (mensajeError) mensajeError.textContent = 'No se pudo enviar el mail (' + error.code + ').';
        }
    });
}
// --- AGREGAR CONTRASEÑA A UNA CUENTA DE GOOGLE (se hace una sola vez) ---
const btnVincular = document.getElementById('btn-vincular');
if (btnVincular) {
    btnVincular.addEventListener('click', async () => {
        const password = document.getElementById('password').value.trim();
        if (mensajeError) { mensajeError.style.color = ''; mensajeError.textContent = ''; }

        if (password.length < 6) {
            if (mensajeError) mensajeError.textContent = 'Escribí arriba la contraseña que querés usar (mínimo 6 caracteres) y volvé a tocar este botón.';
            return;
        }
        try {
            const result = await signInWithPopup(auth, new GoogleAuthProvider());
            const user = result.user;
            await linkWithCredential(user, EmailAuthProvider.credential(user.email, password));
            if (mensajeError) {
                mensajeError.style.color = '#10b981';
                mensajeError.textContent = 'Listo: ahora podés entrar con Google y también con ' + user.email + ' y esta contraseña.';
            }
        } catch (error) {
            console.error('Error al vincular la contraseña:', error.code);
            if (!mensajeError) return;
            if (error.code === 'auth/provider-already-linked') {
                mensajeError.textContent = 'Esta cuenta ya tiene contraseña. Probá entrar con tu mail y contraseña.';
            } else if (error.code === 'auth/weak-password') {
                mensajeError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            } else if (error.code !== 'auth/popup-closed-by-user') {
                mensajeError.textContent = 'No se pudo agregar la contraseña (' + error.code + ').';
            }
        }
    });
}

import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, linkWithCredential } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const btnGoogle = document.getElementById('btn-google');
const mensajeError = document.getElementById('mensaje-error');
const mensajeErrorRegistro = document.getElementById('mensaje-error-registro');

// --- FUNCIÓN PARA VERIFICAR EL ROL Y REDIRIGIR ---
async function verificarRolYRedirigir(user) {
    const emailIngresado = user.email ? user.email.trim().toLowerCase() : '';

    // ÚNICOS correos con rol de profesor (en minúsculas). El resto son alumnos.
    const correosProfesores = [
        'marcos.bertoldi.945@alu.tecnica29de6.edu.ar',
        'pepito@tecnica29de6.edu.ar',
        'upruebadocente@gmail.com'
    ];

    if (correosProfesores.includes(emailIngresado)) {
        localStorage.setItem('rolUsuario', 'profesor');
    } else {
        localStorage.setItem('rolUsuario', 'alumno');
    }

    // El saludo no es un alert: se guarda y lo muestra como banner la página a la que vamos (js/header.js)
    try { sessionStorage.setItem('tptBienvenida', JSON.stringify({ rol: localStorage.getItem('rolUsuario'), email: user.email })); } catch (e) { /* sin saludo */ }

    // Redirección compatible con GitHub Pages y Localhost
    const esGitHub = window.location.hostname.includes('github.io');
    const repoNombre = 'TPT---actualizacion--BBDD';

    window.location.href = esGitHub
        ? `/${repoNombre}/index.html`
        : './index.html';
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
import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// MAPEO DE MATERIAS Y MÓDULOS
const modulosPorMateria = {
    "Física Aplicada": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Procesos y Operaciones Químicas": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Química General": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Química Inorgánica": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Laboratorio de Instrumental y Certificación de Normas": ["Temas"],
    "Química Analítica Cualitativa": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Química Industrial I": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Química Orgánica I": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Química Analítica Cuantitativa": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Química Industrial II": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Tecnología de los Alimentos": ["Teoría", "Trabajos prácticos (T.P.)"],
    "Prácticas Profesionalizantes": ["Temas"]
};

const form = document.getElementById('form-aportar-material');
const selectMateria = document.getElementById('select-materia');
const selectModulo = document.getElementById('select-modulo');
const inputYoutube = document.getElementById('url-youtube');
const boxPreview = document.getElementById('contenedor-preview-youtube');
const iframePreview = document.getElementById('iframe-preview');
const mensajeEstado = document.getElementById('mensaje-estado-material');

let usuarioLogueado = null;

// Verificar usuario en Firebase Auth
onAuthStateChanged(auth, (user) => {
    if (user) {
        usuarioLogueado = user;
    }
});

// Selector dinámico de Módulos segun Materia
if (selectMateria && selectModulo) {
    selectMateria.addEventListener('change', (e) => {
        const materiaSeleccionada = e.target.value;
        selectModulo.innerHTML = '';

        if (materiaSeleccionada && modulosPorMateria[materiaSeleccionada]) {
            selectModulo.disabled = false;
            selectModulo.innerHTML = '<option value="">-- Seleccionar Módulo --</option>';

            modulosPorMateria[materiaSeleccionada].forEach(modulo => {
                const opt = document.createElement('option');
                opt.value = modulo;
                opt.textContent = modulo;
                selectModulo.appendChild(opt);
            });
        } else {
            selectModulo.disabled = true;
            selectModulo.innerHTML = '<option value="">-- Primero selecciona materia --</option>';
        }
    });
}

// Extractor de ID de YouTube para Live Preview
function extraerYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Live Preview de YouTube
if (inputYoutube) {
    inputYoutube.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        const videoId = extraerYouTubeId(url);

        if (videoId) {
            iframePreview.src = `https://www.youtube.com/embed/${videoId}`;
            boxPreview.style.display = 'block';
        } else {
            boxPreview.style.display = 'none';
            iframePreview.src = '';
        }
    });
}

// Envío del Formulario
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const titulo = document.getElementById('titulo-material').value.trim();
        const materia = selectMateria.value;
        const modulo = selectModulo.value;
        const urlYoutube = inputYoutube.value.trim();
        const descripcion = document.getElementById('descripcion-material').value.trim();

        if (!materia || !modulo) {
            mensajeEstado.textContent = 'Por favor, selecciona la materia y el módulo correspondiente.';
            mensajeEstado.style.color = '#ef4444';
            return;
        }

        mensajeEstado.textContent = 'Enviando material a revisión...';
        mensajeEstado.style.color = '#2f7a52';

        try {
            await addDoc(collection(db, "materiales"), {
                titulo: titulo,
                materia: materia,
                modulo: modulo,
                tipo: 'youtube',
                url: urlYoutube,
                descripcion: descripcion,
                subidoPor: usuarioLogueado ? usuarioLogueado.email : 'Alumno Anónimo',
                fecha: serverTimestamp(),
                estado: 'pendiente' // Pendiente de aprobación docente
            });

            form.reset();
            boxPreview.style.display = 'none';
            iframePreview.src = '';
            selectModulo.disabled = true;
            selectModulo.innerHTML = '<option value="">-- Primero selecciona materia --</option>';

            mensajeEstado.textContent = '¡Gracias por tu aporte! Tu contenido fue enviado y será revisado por un profesor antes de publicarse.';
            mensajeEstado.style.color = '#10b981';

            setTimeout(() => {
                mensajeEstado.textContent = '';
            }, 6000);

        } catch (error) {
            console.error("Error al enviar aporte:", error);
            mensajeEstado.textContent = 'Ocurrió un error al enviar el material: ' + error.message;
            mensajeEstado.style.color = '#ef4444';
        }
    });
}
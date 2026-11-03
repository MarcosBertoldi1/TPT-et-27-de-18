import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// El ID del contenedor que pusimos en el HTML
const contenedorVideos = document.getElementById('recursos-firebase-introduccion');

document.addEventListener('DOMContentLoaded', () => {
    if (contenedorVideos) {
        cargarVideosDelModulo('Lógica Computacional', 'Introducción');
    }
});

async function cargarVideosDelModulo(nombreMateria, nombreModulo) {
    try {
        // Consultamos a Firebase: Materia = Lógica, Modulo = Introducción, Estado = aprobado
        const q = query(
            collection(db, "materiales"),
            where("materia", "==", nombreMateria),
            where("modulo", "==", nombreModulo),
            where("estado", "==", "aprobado")
            // Nota: Para usar múltiples 'where' con 'orderBy' en Firebase, puede que te pida crear un índice en la consola.
            // Si la consola arroja error, quita el orderBy o haz clic en el enlace que te da el error para crear el índice.
        );

        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((documento) => {
            const data = documento.data();
            
            // Creamos el botón/tarjeta con el mismo estilo visual que tus recursos actuales
            const enlace = document.createElement('a');
            enlace.href = data.url;
            enlace.target = "_blank"; // Abre en otra pestaña
            // Aplica aquí las mismas clases CSS que usan tus botones de recursos actuales
            enlace.style = "display: flex; align-items: center; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-decoration: none; color: inherit; transition: box-shadow 0.2s; margin-bottom: 10px;";
            
            enlace.innerHTML = `
                <div style="background: #e8f6ed; color: #2f7a52; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 1.2rem;">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 5px 0; color: #14452c; font-size: 1.1rem;">${data.titulo}</h4>
                    <p style="margin: 0; color: #64748b; font-size: 0.9rem;">${data.descripcion}</p>
                    <small style="color: #94a3b8; display: block; margin-top: 5px;">Aportado por: ${data.subidoPor}</small>
                </div>
                <div style="color: #cbd5e1;"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></div>
            `;
            
            // Efecto Hover simple por JS (si ya tienes una clase CSS en tu proyecto para esto, úsala en vez de style)
            enlace.onmouseover = () => enlace.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
            enlace.onmouseout = () => enlace.style.boxShadow = "none";

            contenedorVideos.appendChild(enlace);
        });

    } catch (error) {
        console.error("Error al cargar los videos del módulo:", error);
    }
}
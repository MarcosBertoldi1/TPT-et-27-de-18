// Importamos los servicios de Firebase desde la CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Configuración de Firebase 
const firebaseConfig = {
  apiKey: "AIzaSyB5XqLifX-qKZSGsTdyRCAvUfEg6_rEwFc",
  authDomain: "tpt-2026.firebaseapp.com",
  projectId: "tpt-2026",
  storageBucket: "tpt-2026.firebasestorage.app",
  messagingSenderId: "118270392527",
  appId: "1:118270392527:web:722ae06e66cfad8ae29fba",
  measurementId: "G-02RFXMNWVN"
};

// Inicializar la App
const app = initializeApp(firebaseConfig);

// Exportar las herramientas 
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

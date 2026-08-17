import { initializeApp } from "firebase/app";
import { getAuth ,GoogleAuthProvider} from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

const firebaseConfig = {
  apiKey:apiKey,
  authDomain: "ominimindai.firebaseapp.com",
  projectId: "ominimindai",
  storageBucket: "ominimindai.firebasestorage.app",
  messagingSenderId: "509646102600",
  appId: "1:509646102600:web:844f64aed61c9f6fbe787d",
  measurementId: "G-TLFE23WDP7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider=new GoogleAuthProvider()
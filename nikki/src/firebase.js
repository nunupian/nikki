import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDLNkON7Zi2b1WW69FDJBDIRMNMveDs1cE",
  authDomain: "nikki-dd2c5.firebaseapp.com",
  projectId: "nikki-dd2c5",
  storageBucket: "nikki-dd2c5.firebasestorage.app",
  messagingSenderId: "546932812724",
  appId: "1:546932812724:web:cca75aa5589b4624f520e1"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);


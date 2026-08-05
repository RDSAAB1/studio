const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU",
  authDomain: "bizsuite-dataflow.firebaseapp.com",
  projectId: "bizsuite-dataflow",
  storageBucket: "bizsuite-dataflow.appspot.com",
  messagingSenderId: "1083654429292",
  appId: "1:1083654429292:web:735c2b52865c1f394a5e0f",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedFirestore() {
  const companyId = "biz_lnvo9ml47";
  const userId = "W4c6zvfpsQa3HuIAKWFvaK3AxLq1";

  const companyData = {
    name: "JAGDAMBE RICE MILL",
    createdBy: userId,
    createdAt: new Date().toISOString(),
    subCompanies: {
      "sub_r12ygcdvu": {
        name: "JUGDAMBE RICE MILL",
        seasons: {
          "sea_viawbkqq9": "WHEAT 2026",
          "sea_b2j77ib9e": "WHEAT 2026"
        }
      },
      "sub_ayhfzen36": {
        name: "JUGDAMBE RICE MILL (UNIT 2)",
        seasons: {
          "sea_b2j77ib9e": "WHEAT 2026"
        }
      }
    }
  };

  try {
    console.log("Updating Company Document in Firestore...", companyId);
    await setDoc(doc(db, "companies", companyId), companyData, { merge: true });

    console.log("SUCCESS! Firestore sub-company updated successfully.");
    process.exit(0);
  } catch (err) {
    console.error("ERROR Updating Firestore:", err);
    process.exit(1);
  }
}

seedFirestore();

const fs = require('fs');
const path = require('path');

// Custom .env.local parser to load credentials
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let value = parts.slice(1).join('=').trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            value = value.replace(/\\n/g, '\n');
            process.env[key] = value;
        }
    });
}

const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin credentials in .env.local!");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
    })
});

const db = admin.firestore();

async function run() {
    console.log("Fetching companies from Firestore...");
    const companiesSnapshot = await db.collection('companies').get();
    
    let found = false;
    for (const doc of companiesSnapshot.docs) {
        const data = doc.data();
        const subCompanies = data.subCompanies || {};
        
        let docUpdated = false;
        
        for (const [subId, subData] of Object.entries(subCompanies)) {
            const seasons = subData.seasons || {};
            if (seasons['sea_viawbkqq9']) {
                console.log(`Found season 'sea_viawbkqq9' in Company: ${data.name || doc.id}, Unit: ${subData.name || subId}. Current name: ${seasons['sea_viawbkqq9']}`);
                seasons['sea_viawbkqq9'] = '2026 WHEAT';
                docUpdated = true;
                found = true;
            }
        }
        
        if (docUpdated) {
            console.log(`Updating document ${doc.id} in Firestore...`);
            await db.collection('companies').doc(doc.id).update({ subCompanies });
            console.log(`Document ${doc.id} updated successfully!`);
        }
    }
    
    if (!found) {
        console.log("Season ID 'sea_viawbkqq9' was not found in any Firestore company documents.");
    }
}

run().catch(console.error);

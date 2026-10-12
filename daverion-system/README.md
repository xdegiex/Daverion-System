# Daverion System v3 – Firebase Sync

Aplikacja do zarządzania zakładem produkcyjnym z synchronizacją w czasie rzeczywistym.

## Struktura

```
daverion-system/
├── index.html
├── css/styles.css
├── js/
│   ├── firebase-config.js   ← TU WKLEJ SWÓJ CONFIG
│   ├── app.js
│   └── config.js
├── assets/
└── README.md
```

## Uruchomienie synchronizacji (Firebase)

### 1. Włącz Firestore

1. Wejdź na [console.firebase.google.com](https://console.firebase.google.com)
2. Wybierz swój projekt
3. W menu: **Build → Firestore Database → Create database**
4. Wybierz tryb **test mode** (na start) lub production z regułami
5. Wybierz lokalizację (np. `europe-west1`)

### 2. Skopiuj konfigurację Web

1. Project settings (koło zębate) → **Your apps** → dodaj aplikację Web `</>`
2. Skopiuj obiekt `firebaseConfig`
3. Wklej go do pliku `js/firebase-config.js` (zastąp placeholdery)

Przykład:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "twoj-projekt.firebaseapp.com",
  projectId: "twoj-projekt",
  storageBucket: "twoj-projekt.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

### 3. Reguły Firestore (na start – test mode)

W Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> Na produkcję warto później zaostrzyć reguły.

### 4. Wdróż ponownie

```bash
firebase deploy
```

Po wdrożeniu w prawym górnym rogu zobaczysz **☁ sync** – wtedy dane są wspólne dla wszystkich urządzeń.

## Logowanie

**Bramka:** `dav`  
| Login | Hasło | Rola |
|-------|-------|------|
| administr | nimda!2 | Administrator |
| mechan | mech!@ | Utrzymanie Ruchu |
| kierow | kier!@ | Kierownik |
| admi | adm!@ | Biuro |
| dzjak | dzj!@ | Dział Jakości |
| magaz | mag!@ | Magazyn |
| prod | pro!@ | Produkcja |

## Co jest synchronizowane

- Aktualności, Czat, Awarie (alarm)
- Park Maszyn, Magazyn, Magazyn UR
- Kalendarz, Kontakty, Pracownicy
- Wpisy działów

Motyw i sesja logowania pozostają lokalne na urządzeniu.

## Autor

Black Baron System · 519-357-574

import admin from "firebase-admin";
import serviceAccount from "../../firebase/cl-sektionen-test-firebase-adminsdk-hg4t4-d28e5cc501.json";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send({ message: "Only POST requests allowed" });
    return;
  }
  console.log("Received notification request with message:", req.body);

  if (!req.body.userId || !req.body.postId) {
    res.status(400).send({ message: "Felaktiga attribut i body." });
    return;
  }

  let postData;
  try {
    postData = await verifyRequest(req.body.userId, req.body.postId);
  } catch (error) {
    console.error(error);
    res.status(400).send({ message: error });
    return;
  }

  // Typ lite oklart vad dessa headers gör
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Content-Type", "application/json");

  try {
    // Skickar notis till alla som följer eventuella taggar
    let response = await sendNotification(postData);
    // Skickar tillbaka respons
    res
      .status(200)
      .json({ message: `Notis skickat till ${response.tokens} enheter`, data: req.query.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Ett fel inträffade`, error });
  }
  return;
}

async function sendNotification(data) {
  // Admin initialization
  return new Promise(async (resolve, reject) => {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Initialized.");
    } catch (error) {
      /*
       * We skip the "already exists" message which is
       * not an actual error when we're hot-reloading.
       */
      if (!/already exists/u.test(error.message)) {
        console.error("Firebase admin initialization error", error.stack);
        reject({ ok: false, tokens: 0, error });
      }
    }

    // Skapa payload objekt med all data
    const payload = createPayload(data);

    // Hämtar alla tokens - de som ska få notisen
    const tokens = await getTokens(data.type);

    console.log(`Sending notification to ${tokens.length} devices`);
    if (tokens.length > 0) {
      // Send notifications to all tokens.
      const options = {
        collapse_key: "new_post",
      };
      try {
        const response = await admin.messaging().sendToDevice(tokens, payload, options);
        await cleanupTokens(response, tokens);
        console.log("Notifications have been sent and tokens cleaned up.");
        resolve({ ok: true, tokens: tokens.length });
      } catch (error) {
        console.error(
          "Something went wrong with sending notification or cleaning up tokens.",
          error
        );
        reject({ ok: false, tokens: 0, error });
      }
    }
  });
}

function createPayload(data) {
  return {
    data: {
      title: `${data.committee} publicerade ${data.type == "event" ? "ett event" : "ett inlägg"}`,
      body: `${data.title}`,
      image: data.image || "",
      icon: "/media/grafik/favicon/android-chrome-512x512.png", // kanske alla nämnders loggor här
      tag: "Nytt inlägg",
      link: `/aktuellt/${data.id}`,
    },
  };
}

async function getTokens(type) {
  const allTokens = new Set(); // Set dör att tokens inte ska räknas dubbelt
  const fcmTokensCollection = admin.firestore().collection("fcmTokens");

  return new Promise(async (resolve, reject) => {
    if (type === "event") {
      const eventTokenDoc = await fcmTokensCollection.doc("event").get();
      const eventTokens = eventTokenDoc.data().tokens;
      eventTokens.forEach((token) => allTokens.add(token));

      resolve(Array.from(allTokens));
    } else if (type === "information") {
      const infoTokenDoc = await fcmTokensCollection.doc("information").get();
      const infoTokens = infoTokenDoc.data().tokens;
      infoTokens.forEach((token) => allTokens.add(token));

      resolve(Array.from(allTokens));
    } else {
      reject("Wrong type");
    }
  });
}

// Cleans up the tokens that are no longer valid.
function cleanupTokens(response, tokens) {
  console.warn("No cleanup");
  return;
  // For each notification we check if there was an error.
  const tokensDelete = [];
  response.results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      console.error("Failure sending notification to", tokens[index], error);
      // Cleanup the tokens that are not registered anymore.
      if (
        error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        // Ta bort från alla prenumerationer struktur kommer förändras
        const deleteTask = admin.firestore().collection("fcmTokens").doc(tokens[index]).delete();
        tokensDelete.push(deleteTask);
      }
    }
  });
  return Promise.all(tokensDelete);
}

function verifyRequest(userId, postId) {
  return new Promise(async (resolve, reject) => {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Initialized.");
    } catch (error) {
      if (!/already exists/u.test(error.message)) {
        console.error("Firebase admin initialization error", error.stack);
        reject({ error });
      }
    }
    const db = admin.firestore();
    const postRef = db.collection("posts").doc(postId);
    const snap = postRef.get();

    snap
      .then((docSnap) => {
        if (docSnap.exists) {
          const postData = docSnap.data();

          if (postData.creator !== userId) {
            reject({ error: "not a valid user" });
          }

          postData.id = postId;

          resolve(postData);
        } else {
          reject({ error: "no document" });
        }
      })
      .catch((err) => {
        reject({ error: err });
      });
  });
}

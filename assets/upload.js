const formElem = document.getElementById("form");

formElem.addEventListener("submit", async function onsubmit(e) {
  e.preventDefault();
  const formData = new FormData(this);
  let file = formData.get("file");
  const encrypt = formData.get("encrypt") === "on";

  try {
    formElem.querySelector("button").innerText = "Uploading...";
    formElem.querySelector("button").disabled = true;

    const req = await fetch("/api/upload", {
      method: "POST",
      body: JSON.stringify({
        expire: Number(formData.get("expire")),
        name: file.name,
        size: file.size,
        encrypt: encrypt,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!req.ok) {
      alert(JSON.stringify(await req.json()));
      return;
    }

    const { url, redirect } = await req.json();

    let encKey, objectKey;
    if (encrypt) {
      console.log("%cEncrypting file...", "color: cyan");

      // Generate encryption key
      encKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 128 },
        true,
        ["encrypt", "decrypt"]
      );

      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Encrypt the file
      const iv = new Uint8Array(12);
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        encKey,
        arrayBuffer
      );

      // Convert encrypted data to a Blob for uploading
      file = new Blob([encrypted]);
      console.log("%cFile encrypted successfully", "color: cyan", encKey, file);
      objectKey = await window.crypto.subtle.exportKey("jwk", encKey);
    }

    // Upload file to the URL
    await fetch(url, {
      method: "PUT",
      body: file,
    });

    console.log("File uploaded successfully");
    window.location.href = encrypt ? `${redirect}#${objectKey.k}` : redirect;
  } catch (error) {
    console.error(error);
    alert(JSON.stringify(error));
  } finally {
    formElem.querySelector("button").innerText = "Upload";
    formElem.querySelector("button").disabled = false;
  }
});

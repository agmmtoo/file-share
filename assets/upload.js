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

    let encKey

    if (encrypt) {
      console.log("%cEncrypting file...", "color: cyan");
      // ENCRYPTION
      // REF: https://plus.excalidraw.com/blog/end-to-end-encryption
      const encKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      )

      file = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: window.crypto.getRandomValues(new Uint8Array(12)) },
        encKey,
        file,
      )
      console.log("%cFile encrypted successfully", "color: cyan", encKey, file);
    }

    // upload file to the url
    await fetch(url, {
      method: "PUT",
      body: file,
    });

    console.log("File uploaded successfully");
    window.location.href = encrypt ? `${redirect}#${encKey}` : redirect;
  } catch (error) {
    console.error(error);
    alert(JSON.stringify(error));
  } finally {
    formElem.querySelector("button").innerText = "Upload";
    formElem.querySelector("button").disabled = false;
  }
});

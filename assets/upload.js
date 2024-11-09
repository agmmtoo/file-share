const formElem = document.getElementById("form");

formElem.addEventListener("submit", async function onsubmit(e) {
  e.preventDefault();
  const formData = new FormData(this);
  const file = formData.get("file");

  try {
    formElem.querySelector("button").innerText = "Uploading...";
    formElem.querySelector("button").disabled = true;

    const req = await fetch("/api/upload", {
      method: "POST",
      body: JSON.stringify({
        expire: Number(formData.get("expire")),
        name: file.name,
        size: file.size,
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

    // upload file to the url
    await fetch(url, {
      method: "PUT",
      body: file,
    });

    console.log("File uploaded successfully");
    window.location.href = redirect;
  } catch (error) {
    alert(JSON.stringify(error));
  } finally {
    formElem.querySelector("button").innerText = "Upload";
    formElem.querySelector("button").disabled = false;
  }
});

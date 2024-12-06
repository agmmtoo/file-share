
async function decryptFile() {
    const url = new URL(window.location.href);
    let keyFragment = url.hash.substring(1);

    if (!keyFragment) {
        keyFragment = prompt("Enter the decryption key:");
        window.location.hash = keyFragment;
    }

    try {
        const decryptionKey = await window.crypto.subtle.importKey(
            "jwk",
            {
                k: keyFragment,
                alg: "A128GCM",
                ext: true,
                key_ops: ["encrypt", "decrypt"],
                kty: "oct",
            },
            { name: "AES-GCM", length: 128 },
            false, // extractable
            ["decrypt"],
        );
        
        const presignedUrl = document.getElementById("copy-button").dataset.presignedUrl;
        const name = document.getElementById("copy-button").dataset.name;

        const res = await fetch(presignedUrl);
        if (!res.ok) throw new Error("Failed to fetch the encrypted file.");

        const encrypted = await res.arrayBuffer();
        const iv = new Uint8Array(12); // Use the same IV from encryption
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            decryptionKey,
            encrypted
        );

        const blob = new Blob([decryptedBuffer]);
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = name;
        link.click();
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error("Decryption failed:", err);
        alert("Failed to decrypt the file. Check the console for details.");
    }
}

document.getElementById("download-button").addEventListener("click", decryptFile);

const expire = document.getElementById("expire");
const share = document.getElementById("share-button");
const copy = document.getElementById("copy-button");
const qr = document.querySelector("svg>path")

share.addEventListener("click", () => {
    if (navigator.share) {
        const shareButton = document.querySelector("#share-button");

        shareButton.addEventListener("click", async () => {
            try {
                await navigator.share({
                    title: document.title,
                    url: window.location.href,
                });
            } catch (error) {
                console.error("Error sharing:", error.message);
            }
        });
    } else {
        console.log("Web Share API not supported");
    }
});

copy.addEventListener("click", async function () {
    if (!navigator.clipboard) {
        console.error("Clipboard API not supported");
        return;
    }
    await navigator.clipboard.writeText(this.dataset.link)
    this.innerText = "Copied!";
    setTimeout(() => {
        this.innerText = "Copy Link";
    }, 2e3);
});

const countdown = () => {
    const now = new Date().getTime();
    const diff = Number(expire.dataset.expire) - now;
    if (diff <= 0) {
        expire.textContent = "Expired";
        return;
    }

    const hours = Math.floor(diff / 3.6e6);
    const minutes = Math.floor((diff % 3.6e6) / 6e4);
    const seconds = Math.floor((diff % 6e4) / 1e3);

    expire.textContent = `${hours}:${minutes}:${seconds}`;
};

// set random 127, 127, 127 color
// document.documentElement.style.setProperty('--color-theme', `${Math.floor(Math.random() * 128) + 128}, ${Math.floor(Math.random() * 128) + 128}, ${Math.floor(Math.random() * 128) + 128}`);

countdown();
setInterval(countdown, 1e3);
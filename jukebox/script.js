const form = document.querySelector("#request-form");
const successPanel = document.querySelector("#success-panel");
const submitButton = document.querySelector("#submit-button");
const buttonLabel = submitButton.querySelector(".button-label");
const errorMessage = document.querySelector("#form-error");
const songInput = document.querySelector("#song");
const artistInput = document.querySelector("#artist");
const nameInput = document.querySelector("#name");

function setError(message) {
  errorMessage.textContent = message;
}

function markRequiredFields() {
  const missingSong = !songInput.value.trim();
  const missingArtist = !artistInput.value.trim();
  songInput.setAttribute("aria-invalid", String(missingSong));
  artistInput.setAttribute("aria-invalid", String(missingArtist));
  return missingSong || missingArtist;
}

function setSending(isSending) {
  submitButton.disabled = isSending;
  buttonLabel.textContent = isSending ? "SENDING..." : "SEND REQUEST";
}

[songInput, artistInput].forEach((input) => {
  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    if (songInput.value.trim() && artistInput.value.trim()) setError("");
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");

  if (markRequiredFields()) {
    setError("PLEASE ENTER SONG & ARTIST.");
    (!songInput.value.trim() ? songInput : artistInput).focus();
    return;
  }

  setSending(true);

  try {
    const response = await fetch("https://jukebox-api.chemicalcomputerclub.com/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        song: songInput.value.trim(),
        artist: artistInput.value.trim(),
        name: nameInput.value.trim()
      })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error("Request failed");

    form.hidden = true;
    successPanel.hidden = false;
    successPanel.focus();
    window.setTimeout(() => {
      window.location.assign("/");
    }, 1000);
  } catch {
    setError("COULD NOT SEND. PLEASE TRY AGAIN.");
  } finally {
    setSending(false);
  }
});

document.getElementById("analisarBtn").addEventListener("click", () => {
  const urls = document.getElementById("inputUrls").value
    .split("\n")
    .map(u => u.trim())
    .filter(Boolean);

  if (urls.length > 0) {
    chrome.storage.local.set({ urlsParaValidar: urls }, () => {
      if (chrome.runtime.lastError) {
        console.error("Erro ao salvar URLs:", chrome.runtime.lastError);
      } else {
        chrome.tabs.create({ url: "resultados.html" });
      }
    });
  }
});
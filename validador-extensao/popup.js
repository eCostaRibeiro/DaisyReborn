document.getElementById("analisarBtn").addEventListener("click", () => {
  // Limpa domínios/URLs de listas coladas, tabelas e colunas
  function limparDominiosAvancado(texto) {
    return texto
      .split('\n')
      .map(linha => {
        // Divide por tabulação ou espaço, pega a primeira parte que contenha ponto
        const partes = linha.split(/\s+/);
        let url = partes.find(p => p.includes('.'));
        if (url) {
          // Remove prefixo 'Public' se houver
          url = url.replace(/^Public/i, '');
          url = url.replace(/^[^a-zA-Z0-9]*|[\\/]+$/g, '').trim();
        }
        return url || null;
      })
      .filter(Boolean);
  }

  const urls = limparDominiosAvancado(document.getElementById("inputUrls").value);

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

document.getElementById("ler-tabela").addEventListener("click", () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    // Novo modo: extrair tabela genérica e copiar para a área de transferência
    chrome.tabs.sendMessage(tabs[0].id, {action: "extrairTabelaGenerica"}, (response) => {
      if (response && response.urls && response.urls.length > 0) {
        document.getElementById("inputUrls").value = response.urls.join("\n");
        alert("URLs extraídas e copiadas para a área de transferência!");
      } else {
        alert("Nenhuma URL encontrada na tabela da página.");
      }
    });
  });
});

// Função para limpar domínios de listas coladas (ex: domínio + Copy)
function limparDominios(texto) {
  return texto
    .split('\n')
    .map(linha => linha.replace(/\s*Copy\s*$/i, '').replace(/\t.*$/, '').trim())
    .filter(linha => linha.length > 0 && linha.includes('.'));
}

// Remove o botão de limpeza se existir
const btn = document.getElementById('limpar-dominios');
if (btn) btn.remove();
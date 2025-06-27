chrome.storage.local.get("urlsParaValidar", (data) => {
  const urls = data.urlsParaValidar || [];
  if (!urls.length) {
    document.getElementById("resultado").innerHTML = "⚠️ Nenhuma URL recebida.";
    return;
  }

  document.getElementById("resultado").style.display = "none";
  const progresso = document.getElementById("progresso-barra");

  let pct = 0;
  const animar = setInterval(() => {
    pct = Math.min(95, pct + Math.random() * 3);
    progresso.style.width = pct + "%";
  }, 300);

  chrome.runtime.sendMessage({ action: "validar", urls }, (resposta) => {
    clearInterval(animar);
    progresso.style.width = "100%";
    setTimeout(() => {
      document.getElementById("progresso").style.display = "none";
      // Busca e histórico
      const resultado = document.getElementById("resultado");
      resultado.innerHTML = "";
      const busca = criarCampoBusca(filtro => renderizarResultados(resposta.agrupados, filtro));
      const btnHistorico = criarBotaoHistorico(() => mostrarHistorico());
      resultado.appendChild(busca);
      resultado.appendChild(btnHistorico);
      renderizarResultados(resposta.agrupados);
    }, 600);
  });
});

// Adiciona atalho para busca ao digitar Enter
function criarCampoBusca(onBusca) {
  const buscaDiv = document.createElement("div");
  buscaDiv.style.margin = "1rem 0";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Filtrar URLs, títulos, status...";
  input.style.width = "60%";
  input.style.padding = "0.5rem";
  input.style.marginRight = "1rem";
  input.oninput = () => onBusca(input.value);
  input.addEventListener("keydown", e => { if (e.key === "Enter") onBusca(input.value); });
  buscaDiv.appendChild(input);
  return buscaDiv;
}

function criarBotaoHistorico(onClick) {
  const btn = document.createElement("button");
  btn.textContent = "Ver histórico de análises";
  btn.style.marginLeft = "1rem";
  btn.onclick = onClick;
  return btn;
}

function renderizarResultados(agrupados, filtro = "") {
  const resultado = document.getElementById("resultado");
  resultado.style.display = "block";
  resultado.innerHTML = "";

  const icones = {
    "Funcionando normalmente": "🟢",
    "Indícios de Inatividade": "🟡",
    "Fora do ar": "🔴",
    "Acesso restrito": "⛔",
    "Redirecionamento detectado": "🔀",
    "Falha ao acessar": "⚠️"
  };

  for (const grupo in agrupados) {
    let lista = agrupados[grupo];
    if (filtro) {
      const f = filtro.toLowerCase();
      lista = lista.filter(info =>
        (info.url && info.url.toLowerCase().includes(f)) ||
        (info.title && info.title.toLowerCase().includes(f)) ||
        (info.status && String(info.status).includes(f))
      );
    }
    if (lista.length > 0) {
      const bloco = document.createElement("div");
      bloco.className = "grupo";

      const cabecalho = document.createElement("div");
      cabecalho.className = "grupo-cabecalho";

      const toggle = document.createElement("button");
      toggle.className = "grupo-toggle";
      toggle.innerHTML = `▶️ ${icones[grupo]} ${grupo} (${lista.length})`;

      const copiarBtn = document.createElement("button");
      copiarBtn.className = "grupo-copiar";
      copiarBtn.textContent = "📋";
      copiarBtn.title = "Copiar URLs desse grupo";

      copiarBtn.addEventListener("click", () => {
        const texto = lista.map(info => info.url).join("\n");
        navigator.clipboard.writeText(texto);
        copiarBtn.textContent = "✅";
        setTimeout(() => (copiarBtn.textContent = "📋"), 1000);
      });

      // Botão para abrir todas as URLs do grupo
      const abrirTodasBtn = document.createElement("button");
      abrirTodasBtn.className = "grupo-abrir-todas";
      abrirTodasBtn.textContent = "🔗 Abrir todas";
      abrirTodasBtn.title = "Abrir todas as URLs deste grupo";
      abrirTodasBtn.style.marginLeft = "0.5rem";
      abrirTodasBtn.onclick = () => {
        lista.forEach(info => {
          chrome.tabs.create({ url: info.url });
        });
      };

      cabecalho.appendChild(toggle);
      cabecalho.appendChild(copiarBtn);
      cabecalho.appendChild(abrirTodasBtn);
      bloco.appendChild(cabecalho);

      const listaContainer = document.createElement("div");
      listaContainer.className = "grupo-conteudo";
      listaContainer.style.display = "none";

      toggle.addEventListener("click", () => {
        const visivel = listaContainer.style.display === "block";
        listaContainer.style.display = visivel ? "none" : "block";
        toggle.innerHTML = `${visivel ? "▶️" : "🔽"} ${icones[grupo]} ${grupo} (${lista.length})`;
      });

      lista.forEach(info => {
        const linha = document.createElement("div");
        linha.className = "linha-url";

        const urlEl = document.createElement("div");
        urlEl.className = "url-texto";
        urlEl.textContent = info.url;
        urlEl.title = "Clique para copiar";

        urlEl.addEventListener("click", () => {
          navigator.clipboard.writeText(info.url);
          urlEl.classList.add("copiado");
          setTimeout(() => {
            urlEl.classList.remove("copiado");
          }, 1000);
        });

        const detalhesEl = document.createElement("div");
        detalhesEl.className = "detalhes-url";
        detalhesEl.textContent = `${info.status || "erro"}${info.title ? " · " + info.title : ""}` +
          (info.tamanho !== undefined ? ` · ${info.tamanho} bytes` : "") +
          (info.tempo !== undefined ? ` · ${info.tempo}ms` : "") +
          (info.redirecionado ? " · 🔀 Redirecionado" : "");

        const botaoGo = document.createElement("button");
        botaoGo.textContent = "GO!";
        botaoGo.className = "btn-go";
        botaoGo.title = "Abrir esta URL";
        botaoGo.onclick = () => {
          chrome.tabs.create({ url: info.url });
        };

        const favicon = document.createElement("img");
        favicon.className = "favicon";
        try {
          const dominio = new URL(info.url).hostname;
          favicon.src = `https://www.google.com/s2/favicons?sz=32&domain=${dominio}`;
          favicon.alt = "favicon";
        } catch {
          favicon.src = "";
        }

        linha.appendChild(favicon);
        linha.appendChild(urlEl);
        linha.appendChild(detalhesEl);
        linha.appendChild(botaoGo);
        listaContainer.appendChild(linha);
      });

      bloco.appendChild(listaContainer);
      resultado.appendChild(bloco);
    }
  }
}

function mostrarHistorico() {
  chrome.storage.local.get("historicoAnalises", (data) => {
    const historico = data.historicoAnalises || [];
    const resultado = document.getElementById("resultado");
    resultado.innerHTML = "<h3>Histórico de Análises</h3>";
    const btnLimpar = document.createElement("button");
    btnLimpar.textContent = "Limpar histórico";
    btnLimpar.onclick = () => {
      chrome.storage.local.set({ historicoAnalises: [] }, () => mostrarHistorico());
    };
    resultado.appendChild(btnLimpar);
    historico.forEach((item, idx) => {
      const bloco = document.createElement("div");
      bloco.className = "grupo";
      bloco.innerHTML = `<b>${new Date(item.data).toLocaleString()}</b> <button id="ver-${idx}">Ver</button>`;
      resultado.appendChild(bloco);
      setTimeout(() => {
        document.getElementById(`ver-${idx}`).onclick = () => {
          resultado.innerHTML = "";
          const busca = criarCampoBusca(filtro => renderizarResultados(item.agrupados, filtro));
          const btnHistorico = criarBotaoHistorico(() => mostrarHistorico());
          resultado.appendChild(busca);
          resultado.appendChild(btnHistorico);
          renderizarResultados(item.agrupados);
        };
      }, 0);
    });
    if (!historico.length) resultado.innerHTML += "<div>Nenhum histórico encontrado.</div>";
  });
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "validar" && Array.isArray(msg.urls)) {
    const agrupados = {
      "Funcionando normalmente": [],
      "Indícios de Inatividade": [],
      "Fora do ar": [],
      "Acesso restrito": [],
      "Redirecionamento detectado": [],
      "Falha ao acessar": []
    };

    const falsoConteudo = [
      // Português
      "domínio", "construção", "em breve", "padrão",
      "desenvolvimento", "hospedagem", "webmail", "houve um erro", "erro", "indisponível",
      // Inglês
      "domain", "construction", "coming soon", "default",
      "parked", "placeholder", "hosting", "powered", "web hosting", "store is unavailable", "unavailable", "error", "this store is unavailable",
      // Espanhol
      "dominio", "construcción", "pronto", "predeterminada",
      "aparcado", "hospedado", "mantenimiento", "alojado"
      // Francês
      ,"domaine", "construction", "bientôt", "page par défaut", "hébergé par", "hébergement", "prochainement",
      // Alemão
      "domain", "im aufbau", "demnächst", "standardseite", "geparkt", "gehostet von", "wartung",
      // Italiano
      "dominio", "in costruzione", "prossimamente", "pagina predefinita", "ospitato da", "in manutenzione"
    ];

    async function tentarComFallback(urlOriginal) {
      let url = urlOriginal.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
      }

      // Timeout de 10 segundos
      function fetchComTimeout(resource, options = {}) {
        const { timeout = 10000 } = options;
        return Promise.race([
          fetch(resource, options),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout))
        ]);
      }

      try {
        const res = await fetchComTimeout(url, { method: "GET", mode: "cors", timeout: 10000 });
        return { url, res };
      } catch {
        if (url.startsWith("https://")) {
          try {
            const httpUrl = url.replace(/^https:\/\//i, "http://");
            const res = await fetchComTimeout(httpUrl, { method: "GET", mode: "cors", timeout: 10000 });
            return { url: httpUrl, res };
          } catch {}
        }
        throw new Error("Falha em ambas as tentativas");
      }
    }

    const promises = msg.urls.map(async (urlOriginal) => {
      const inicio = performance.now();
      let redirecionado = false;
      let urlFinal = urlOriginal.trim();
      try {
        const { url, res } = await tentarComFallback(urlOriginal);
        urlFinal = url;
        const status = res.status;
        let title = null;
        let texto = "";
        let tamanho = 0;
        try {
          texto = await res.text();
          tamanho = texto.length;
          const match = texto.match(/<title>(.*?)<\/title>/i);
          title = match ? match[1].trim() : null;
        } catch {}
        const textoLimpo = texto.toLowerCase();
        const contemPlaceholder = falsoConteudo.some(f =>
          textoLimpo.includes(f)
        );
        if (urlFinal !== urlOriginal.trim()) redirecionado = true;
        const tempo = Math.round(performance.now() - inicio);
        const info = { url: urlFinal, status, title, tamanho, tempo, redirecionado };
        if (redirecionado && status >= 200 && status < 400) {
          agrupados["Redirecionamento detectado"].push(info);
        } else if (
          status === 403 ||
          urlFinal.includes("forms.office") ||
          urlFinal.includes("login") ||
          urlFinal.includes("acesso")
        ) {
          agrupados["Acesso restrito"].push(info);
        } else if (contemPlaceholder) {
          agrupados["Indícios de Inatividade"].push(info);
        } else if (status >= 200 && status < 400) {
          agrupados["Funcionando normalmente"].push(info);
        } else {
          agrupados["Fora do ar"].push(info);
        }
      } catch {
        agrupados["Falha ao acessar"].push({ url: urlFinal });
      }
    });

    Promise.all(promises).then(() => {
      // Salvar histórico
      chrome.storage.local.get("historicoAnalises", (data) => {
        const historico = data.historicoAnalises || [];
        historico.unshift({ data: new Date().toISOString(), agrupados });
        chrome.storage.local.set({ historicoAnalises: historico.slice(0, 10) }); // mantém só os 10 últimos
      });
      // Notificação
      if (chrome.notifications) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: "Validação concluída",
          message: "A análise das URLs foi finalizada."
        });
      }
      sendResponse({ agrupados });
    });
    return true;
  }
});
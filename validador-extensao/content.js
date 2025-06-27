// Este content script extrai a primeira coluna de todas as tabelas da página e retorna apenas valores que parecem URLs/domínios
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "extrairTabelaUrls") {
    // Extrai a primeira coluna de todas as tabelas
    const urls = [];
    const regexUrl = /([a-z0-9][a-z0-9\-\.]+\.[a-z]{2,})(:[0-9]+)?(\/[\S]*)?/i;
    document.querySelectorAll('table').forEach(tabela => {
      for (const row of tabela.rows) {
        const cell = row.cells[0];
        if (cell) {
          const valor = cell.textContent.trim();
          if (regexUrl.test(valor)) {
            urls.push(valor);
          }
        }
      }
    });
    sendResponse({urls});
    return true;
  }
  if (msg.action === "extrairTdDominios") {
    // Captura todos os elementos <td> com textos que lembram domínios
    const allCells = Array.from(document.querySelectorAll('td'))
      .map(td => td.textContent.trim())
      .filter(text => text.includes('.') && !text.includes(' '));
    // Remove duplicatas
    const domains = [...new Set(allCells)];
    sendResponse({urls: domains});
    return true;
  }
  if (msg.action === "extrairAvancado") {
    // 1. <a href> (texto e href)
    const aTags = Array.from(document.querySelectorAll('a'))
      .map(a => [a.textContent.trim(), a.getAttribute('href')])
      .flat()
      .filter(Boolean);
    // 2. <li>, <span>, <div>, <input>, <textarea>
    const extraTags = ['li', 'span', 'div', 'input', 'textarea'];
    let extraTexts = [];
    extraTags.forEach(tag => {
      extraTexts = extraTexts.concat(Array.from(document.querySelectorAll(tag)).map(e => e.value || e.textContent.trim()));
    });
    // 3. Todas as colunas de todas as tabelas
    let allTableCells = [];
    document.querySelectorAll('table').forEach(tabela => {
      for (const row of tabela.rows) {
        for (const cell of row.cells) {
          allTableCells.push(cell.textContent.trim());
        }
      }
    });
    // Junta tudo
    let candidatos = [].concat(aTags, extraTexts, allTableCells);
    // Filtra por padrão de domínio/URL
    const regexUrl = /([a-z0-9][a-z0-9\-\.]+\.[a-z]{2,})(:[0-9]+)?(\/[\S]*)?/i;
    candidatos = candidatos.filter(text => typeof text === 'string' && regexUrl.test(text) && text.includes('.') && !text.includes(' '));
    // Remove duplicatas
    const urls = [...new Set(candidatos)];
    sendResponse({urls});
    return true;
  }
  if (msg.action === "extrairTudoTexto") {
    // Varre todo o texto visível da página e extrai domínios/URLs
    const regexUrl = /([a-z0-9][a-z0-9\-\.]+\.[a-z]{2,})(:[0-9]+)?(\/[\S]*)?/gi;
    // Pega todo o texto visível do body
    let texto = document.body.innerText || '';
    // Extrai todos os matches
    let matches = texto.match(regexUrl) || [];
    // Remove duplicatas e espaços
    const urls = [...new Set(matches.map(x => x.trim()))];
    sendResponse({urls});
    return true;
  }
  if (msg.action === "extrairSuperAgressivo") {
    // Varre todos os elementos visíveis e extrai domínios/URLs de texto e atributos
    const regexUrl = /([a-z0-9][a-z0-9\-\.]+\.[a-z]{2,})(:[0-9]+)?(\/[\S]*)?/gi;
    let candidatos = [];
    // 1. Texto de todos os elementos visíveis
    const allElements = Array.from(document.querySelectorAll('body *'));
    allElements.forEach(el => {
      // Texto visível
      if (el.offsetParent !== null) {
        const txt = el.textContent ? el.textContent.trim() : '';
        if (txt && txt.length < 100) candidatos.push(txt);
        // Atributos comuns
        ['title', 'data-domain', 'data-url', 'href'].forEach(attr => {
          const val = el.getAttribute && el.getAttribute(attr);
          if (val) candidatos.push(val.trim());
        });
      }
    });
    // 2. Extrai domínios/URLs de todos os textos coletados
    let urls = [];
    candidatos.forEach(txt => {
      if (typeof txt === 'string') {
        const found = txt.match(regexUrl);
        if (found) urls = urls.concat(found.map(x => x.trim()));
      }
    });
    // Remove duplicatas
    urls = [...new Set(urls)];
    sendResponse({urls});
    return true;
  }
  if (msg.action === "extrairNextDataHostnames") {
    // Extrai domínios do JSON do <script id="__NEXT_DATA__">
    try {
      const script = document.getElementById("__NEXT_DATA__");
      if (script) {
        const data = JSON.parse(script.textContent);
        let hostnames = [];
        // Caminho seguro até os domínios
        if (data && data.props && data.props.pageProps && data.props.pageProps.serverResponse && data.props.pageProps.serverResponse.data && data.props.pageProps.serverResponse.data.records) {
          hostnames = data.props.pageProps.serverResponse.data.records.map(r => r.hostname).filter(Boolean);
        }
        // Remove duplicatas
        hostnames = [...new Set(hostnames)];
        sendResponse({urls: hostnames});
        return true;
      }
    } catch (e) {
      // Se der erro, retorna vazio
      sendResponse({urls: []});
      return true;
    }
    sendResponse({urls: []});
    return true;
  }
  if (msg.action === "extrairTabelaGenerica") {
    let urls = [];
    const regexUrl = /([a-z0-9][a-z0-9\-\.]+\.[a-z]{2,})(:[0-9]+)?(\/[\S]*)?/i;
    // 1. Tenta extrair de <a title> (usado em urlscan.io)
    const aTitle = Array.from(document.querySelectorAll('a[title]'))
      .map(a => a.getAttribute('title'))
      .filter(title => title && regexUrl.test(title));
    urls = urls.concat(aTitle);
    // 2. Se não achou nada, tenta <a href>
    if (urls.length === 0) {
      const aHref = Array.from(document.querySelectorAll('a'))
        .map(a => a.getAttribute('href'))
        .filter(href => href && regexUrl.test(href));
      urls = urls.concat(aHref);
    }
    // 3. Se ainda não achou nada, tenta texto de <a>
    if (urls.length === 0) {
      const aTexts = Array.from(document.querySelectorAll('a'))
        .map(a => a.textContent.trim())
        .filter(text => regexUrl.test(text));
      urls = urls.concat(aTexts);
    }
    // 4. Se ainda não achou nada, tenta pegar a primeira célula de cada linha de <table>
    if (urls.length === 0) {
      document.querySelectorAll('table').forEach(tabela => {
        for (const row of tabela.rows) {
          if (row.cells.length > 0) {
            let valor = row.cells[0].textContent.trim();
            valor = valor.replace(/^Public/i, '').replace(/^[^a-zA-Z0-9]*|[\\/]+$/g, '').trim();
            if (valor.includes('.')) {
              urls.push(valor);
            }
          }
        }
      });
    }
    // 5. Limpa, remove duplicatas e espaços
    urls = urls.map(u => u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').trim());
    urls = urls.filter(u => u && u.includes('.') && !u.includes(' '));
    urls = [...new Set(urls)];
    // Copia para a área de transferência
    if (urls.length > 0 && navigator.clipboard) {
      navigator.clipboard.writeText(urls.join('\n'));
    }
    sendResponse({urls});
    return true;
  }
});

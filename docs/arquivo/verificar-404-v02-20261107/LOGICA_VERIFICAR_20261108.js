(function () {
  "use strict";
  // A integridade é conferida NO SERVIDOR (ma-demello-preview): 200 => já
  // verificado (integrity.status === "VERIFIED"); 409 => não confere. Esta
  // página só apresenta o PUBLIC_PREVIEW_V1 sanitizado — nunca recebe o
  // registro interno, a assinatura interna nem o fator da metodologia.
  var ENDPOINT = "https://ma-demello-preview.ma-demello.workers.dev/api/previews/v1/";
  var out = document.getElementById("vf-out");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function render(html) { out.innerHTML = html; }
  function box(kind, title, msg) {
    return '<div class="vf-status ' + kind + '"><h2>' + esc(title) + "</h2><p>" + esc(msg) + "</p></div>";
  }

  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(String(iso || ""));
    return m ? m[3] + "/" + m[2] + "/" + m[1] + " " + m[4] + ":" + m[5] + " UTC" : String(iso || "");
  }
  function brl(s) {
    var n = Number(String(s).replace(",", "."));
    if (!isFinite(n)) return String(s);
    return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Chaves PÚBLICAS do registro verificável -> rótulo comercial.
  var REF_ORDER = ["secid_pr", "fundepar", "altoqi", "mercado", "maxicad", "rfb", "cim_amunesc", "ibape"];
  var REF_LABEL = {
    secid_pr: "SECID/PR", fundepar: "FUNDEPAR", altoqi: "AltoQi", mercado: "AltoQi + SECID/PR",
    maxicad: "MaxiCAD", rfb: "Receita Federal", cim_amunesc: "CIM-AMUNESC", ibape: "IBAPE-PR"
  };
  // Nome comercial do serviço (o registro público traz o código interno) e situação em português.
  var SERVICE_LABEL = {
    ESTRUTURAL: "Estrutural", ELETRICA: "Projeto Elétrico", HIDROSSANITARIO: "Hidrossanitário", INCENDIO: "Incêndio",
    GAS_GLP: "Gás", ARQUITETURA: "Arquitetura", COMPATIBILIZACAO: "Compatibilização BIM", ORCAMENTO: "Orçamento e cronograma",
    REGULARIZACAO: "Regularização", TERRAPLENAGEM: "Terraplanagem", CONSULTORIA_TECNICA: "Consultoria técnica",
    MENTORIA_TECNICA: "Mentoria técnica"
  };
  var STATUS_LABEL = { ISSUED: "Emitida" };
  // Versão da tabela GRAVADA no registro (V1 histórico ou V2 corrente); nunca o regime interno.
  function tableLabel(view) {
    var tv = view && view.methodology && view.methodology.table_version;
    var m = /^DEMELLO_(V\d+)$/.exec(String(tv || ""));
    return m ? "Tabela DEMELLO " + m[1] : "Tabela DEMELLO";
  }

  function show(rec) {
    var view = rec.preview || {};
    var pv = view.pricing || {};
    var cs = view.case_summary || {};
    var disclaimers = Array.isArray(view.disclaimers) ? view.disclaimers : [];
    var rows = "";
    var order = ["necessidade", "situacao", "finalidade", "localizacao", "tipo_imovel", "documentos",
      "motivo_diferenca", "servicos", "area_iptu", "area_matricula", "diferenca",
      "area_nova", "area_existente", "area_total", "area_projecao", "area_atendida", "area_terreno", "area_escopo"];
    var labels = {
      necessidade: "Necessidade", situacao: "Situação", finalidade: "Finalidade", localizacao: "Localização",
      tipo_imovel: "Imóvel", documentos: "Documentos", motivo_diferenca: "Motivo da diferença", servicos: "Serviços",
      area_iptu: "Área IPTU", area_matricula: "Área matrícula", diferenca: "Diferença",
      area_nova: "Área nova", area_existente: "Área existente", area_total: "Área total", area_projecao: "Área de projeção",
      area_atendida: "Área atendida", area_terreno: "Área do terreno", area_escopo: "Área do escopo"
    };
    order.forEach(function (k) {
      if (cs[k] == null || cs[k] === "") return;
      var val = Array.isArray(cs[k]) ? cs[k].join(", ") : cs[k];
      rows += "<dt>" + esc(labels[k] || k) + "</dt><dd>" + esc(val) + "</dd>";
    });
    var svcs = "";
    (pv.services || []).forEach(function (s) {
      if (s.status !== "CALCULATED") return;
      var parts = [];
      REF_ORDER.forEach(function (k) {
        if (s.references && s.references[k] && s.references[k].total != null) {
          parts.push(esc(REF_LABEL[k]) + " " + esc(brl(s.references[k].total)));
        }
      });
      svcs += '<li class="vf-svc"><div class="vf-svc-line"><span class="vf-svc-name">' + esc(SERVICE_LABEL[s.service] || s.service) + "</span>" +
        (s.total_demello != null ? '<strong class="vf-svc-price">' + esc(brl(s.total_demello)) + "</strong>" : "") + "</div>" +
        (parts.length ? '<p class="vf-svc-refs">Referências públicas consultadas: ' + parts.join(" · ") + "</p>" : "") + "</li>";
    });
    var total = pv.status === "CALCULATED" && pv.total_demello ? brl(pv.total_demello) : "Avaliação humana necessária";

    render(
      box("ok", "Prévia DEMELLO verificada",
        "Este registro foi emitido pela DEMELLO Engenharia e não foi alterado desde a emissão.") +
      '<dl class="vf-dl">' +
        "<dt>Código</dt><dd class=\"vf-code\">" + esc(rec.verification_code) + "</dd>" +
        "<dt>Emitida em</dt><dd>" + esc(fmtDate(rec.issued_at)) + "</dd>" +
        "<dt>Situação</dt><dd>" + esc(STATUS_LABEL[rec.status || "ISSUED"] || rec.status) + "</dd>" +
        "<dt>Metodologia</dt><dd>" + esc(tableLabel(view)) + "</dd>" +
      "</dl>" +
      "<p class=\"eyebrow\" style=\"margin:24px 0 4px\">Previsão DEMELLO</p>" +
      '<p class="vf-total">' + esc(total) + "</p>" +
      (svcs ? '<p class="eyebrow" style="margin:24px 0 4px">Serviços</p><ul class="vf-svcs" aria-label="Valor DEMELLO por serviço">' + svcs + "</ul>" : "") +
      (rows ? "<p class=\"eyebrow\" style=\"margin:24px 0 4px\">Informações do caso (fornecidas pelo usuário)</p><dl class=\"vf-dl\">" + rows + "</dl>" : "") +
      (disclaimers.length ? '<div class="vf-note">' + disclaimers.map(function (d) { return "<p>" + esc(d) + "</p>"; }).join("") + "</div>" : "")
    );
  }

  var code = new URLSearchParams(location.search).get("codigo") || "";
  if (!/^[a-z2-7]{6,64}$/.test(code)) {
    render(box("bad", "Código ausente ou inválido", "Abra o link completo da prévia (ex.: /verificar/?codigo=…) ou aponte o QR da imagem."));
    return;
  }

  fetch(ENDPOINT + encodeURIComponent(code), { headers: { Accept: "application/json" } })
    .then(function (res) {
      if (res.status === 404) { render(box("bad", "Código não encontrado", "Nenhuma prévia DEMELLO corresponde a este código.")); return null; }
      if (res.status === 409) { render(box("bad", "Integridade não confere", "O conteúdo deste registro não corresponde ao que foi emitido. Não confie nesta prévia.")); return null; }
      if (!res.ok) { render(box("bad", "Serviço temporariamente indisponível", "Não foi possível verificar a prévia agora. Tente novamente em instantes.")); return null; }
      return res.json();
    })
    .then(function (rec) {
      if (!rec) return;
      if (rec.schema !== "PUBLIC_PREVIEW_V1" || !rec.integrity || rec.integrity.status !== "VERIFIED" || !rec.preview) {
        render(box("bad", "Registro inválido", "A resposta do serviço de verificação está incompleta ou não pôde ser confirmada."));
        return;
      }
      show(rec);
    })
    .catch(function () {
      render(box("bad", "Serviço temporariamente indisponível", "Não foi possível contatar o serviço de verificação. Tente novamente em instantes."));
    });
})();

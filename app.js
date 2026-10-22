// Landing de lançamento: entradas com pop, palavras por máscara, gravações em
// loop com anotações presas à interface, indicador de etapa e formulário.
(() => {
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Títulos: cada palavra sobe por máscara, em sequência (como no filme).
  document.querySelectorAll('[data-palavras]').forEach((titulo) => {
    let indice = 0;
    titulo.querySelectorAll(':scope > span').forEach((linha) => {
      const palavras = linha.textContent.trim().split(/\s+/);
      linha.textContent = '';
      palavras.forEach((texto, i) => {
        const palavra = document.createElement('span');
        palavra.className = 'palavra';
        const dentro = document.createElement('span');
        dentro.textContent = texto;
        dentro.style.setProperty('--p', indice++);
        palavra.append(dentro);
        linha.append(palavra);
        if (i < palavras.length - 1) linha.append(' ');
      });
    });
  });

  // Entradas: uma vez, quando o elemento chega na tela.
  const revelar = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('visivel');
      revelar.unobserve(e.target);
    }
  }, {threshold: 0.18, rootMargin: '0px 0px -6% 0px'});
  document.querySelectorAll('[data-revelar], [data-janela], [data-palavras]').forEach((el) => revelar.observe(el));
  // The hero is the first screen: play its entrance right away, without waiting for the observer.
  requestAnimationFrame(() => document.querySelectorAll('.hero [data-revelar], .hero [data-palavras], .hero [data-janela]').forEach((el) => el.classList.add('visivel')));

  // Anotações: caixas posicionadas em % da gravação, ativas numa janela de tempo do loop.
  const comMarcas = [];
  document.querySelectorAll('[data-marcas]').forEach((tela) => {
    const video = tela.querySelector('video');
    const marcas = JSON.parse(tela.dataset.marcas).map((m) => {
      const el = document.createElement('div');
      el.className = 'marca';
      Object.assign(el.style, {left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%`});
      tela.append(el);
      return {...m, el};
    });
    comMarcas.push({video, marcas});
  });

  // Hero: abas que trocam a gravação; cada uma roda uma vez e passa para a próxima.
  const hero = document.querySelector('[data-abas]');
  const heroVideo = hero.querySelector('video');
  const abas = [...hero.querySelectorAll('.aba')];
  let abaAtual = 0;
  let voltas = 0;
  const escolherAba = (i) => {
    abaAtual = (i + abas.length) % abas.length;
    voltas = 0;
    abas.forEach((aba, j) => aba.setAttribute('aria-selected', String(j === abaAtual)));
    heroVideo.style.opacity = '0';
    setTimeout(() => {
      heroVideo.src = abas[abaAtual].dataset.video;
      heroVideo.play().catch(() => {});
      heroVideo.style.opacity = '1';
    }, 160);
  };
  heroVideo.style.transition = 'opacity 0.16s';
  abas.forEach((aba, i) => aba.addEventListener('click', () => escolherAba(i)));
  // Short clips run twice before moving on, so each tab stays at least ~4s.
  heroVideo.addEventListener('ended', () => {
    voltas++;
    if (heroVideo.duration < 4 && voltas < 2) { heroVideo.play().catch(() => {}); return; }
    escolherAba(abaAtual + 1);
  });

  // Gravações só tocam enquanto estão na tela.
  const tocar = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      const video = e.target;
      if (e.isIntersecting) {
        if (video.preload === 'none') video.preload = 'auto';
        if (!calmo || video === heroVideo) video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, {threshold: 0.2});
  document.querySelectorAll('video[muted]').forEach((v) => { v.muted = true; tocar.observe(v); });

  const quadro = () => {
    const progresso = heroVideo.duration ? heroVideo.currentTime / heroVideo.duration : 0;
    abas[abaAtual].style.setProperty('--progresso', String(progresso));
    for (const {video, marcas} of comMarcas) {
      if (video.paused && !calmo) continue;
      const t = video.currentTime;
      for (const m of marcas) m.el.classList.toggle('ativa', calmo || (t >= m.de && t < m.ate));
    }
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);

  // Indicador de etapa: acompanha a seção que está no meio da tela.
  const indicador = document.querySelector('.indicador');
  const barras = [...indicador.querySelectorAll('.indicador__barras i')];
  const nome = indicador.querySelector('.indicador__nome');
  const etapas = [...document.querySelectorAll('[data-etapa]')];
  const marcarEtapa = (i) => {
    nome.textContent = etapas[i].dataset.etapa;
    barras.forEach((b, j) => { b.classList.toggle('feita', j < i); b.classList.toggle('atual', j === i); });
  };
  marcarEtapa(0);
  const observarEtapas = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) marcarEtapa(etapas.indexOf(e.target));
  }, {rootMargin: '-45% 0px -50% 0px'});
  etapas.forEach((etapa) => observarEtapas.observe(etapa));
  // The pill floats only while the four steps fill the screen.
  new IntersectionObserver(([e]) => indicador.classList.toggle('visivel', e.isIntersecting), {rootMargin: '-40% 0px -40% 0px'})
    .observe(document.querySelector('[data-processo]'));

  // Formulário de interesse → POST /api/interesse (servidor.py grava em SQLite).
  // Fora do servidor local (ex.: GitHub Pages, que é só estático) é uma prévia.
  const PREVIA = !['127.0.0.1', 'localhost'].includes(location.hostname);
  const form = document.querySelector('[data-formulario]');
  const aviso = form.querySelector('.formulario__aviso');
  const botao = form.querySelector('button[type="submit"]');
  if (PREVIA) form.classList.add('formulario--previa');
  const campo = (nomeCampo) => form.querySelector(`[name="${nomeCampo}"]`)?.closest('.campo') || form.querySelector(`[data-campo="${nomeCampo}"]`);
  const marcarErros = (lista) => {
    form.querySelectorAll('.campo').forEach((c) => c.classList.remove('invalido'));
    lista.forEach((n) => campo(n)?.classList.add('invalido'));
    if (lista.length) campo(lista[0])?.querySelector('input, textarea')?.focus();
  };
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    aviso.textContent = '';
    const dados = {
      nome: form.nome.value.trim(),
      email: form.email.value.trim(),
      nucleo: form.nucleo.value.trim(),
      comentario: form.comentario.value.trim(),
      ferramentas: [...form.querySelectorAll('[name="ferramentas"]:checked')].map((c) => c.value),
    };
    const erros = [];
    if (!dados.nome) erros.push('nome');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dados.email)) erros.push('email');
    if (!dados.nucleo) erros.push('nucleo');
    if (!dados.ferramentas.length) erros.push('ferramentas');
    marcarErros(erros);
    if (erros.length) return;
    if (PREVIA) {
      aviso.textContent = 'Esta é uma prévia da página: o envio ainda não está ligado. Nada foi enviado.';
      return;
    }

    botao.disabled = true;
    botao.textContent = 'Enviando…';
    try {
      const resposta = await fetch('/api/interesse', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dados)});
      const corpo = await resposta.json().catch(() => ({}));
      if (resposta.status === 422) { marcarErros(corpo.campos || []); return; }
      if (!resposta.ok) throw new Error(corpo.erro || resposta.statusText);
      form.querySelector('.sucesso').hidden = false;
    } catch {
      aviso.textContent = 'Não foi possível enviar agora. Tente de novo em instantes.';
    } finally {
      botao.disabled = false;
      botao.textContent = 'Quero participar';
    }
  });
  form.querySelectorAll('input, textarea').forEach((el) => el.addEventListener('input', () => el.closest('.campo')?.classList.remove('invalido')));
})();

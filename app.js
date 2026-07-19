// =========================================================
// SGC — Sistema de Gestão de Clube — lógica da aplicação
// =========================================================

let supabase = null;
let escaloes = [];
let jogadoras = [];
let tarefas = [];
let filtroEscalaoId = 'todos';
let editEscalaoId = null;
let editJogadoraId = null;
let editTarefaId = null;
let novaFotoFile = null;

const POSICOES = ['Guarda-redes','Fixo','Fixo/Ala','Fixo/Pivot','Ala','Ala/Pivot','Pivot','Universal'];
const ESTADOS = ['Por Fazer','A Fazer','Feito'];

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const configOk = typeof SUPABASE_URL !== 'undefined'
    && SUPABASE_URL && !SUPABASE_URL.includes('COLA_AQUI')
    && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('COLA_AQUI');

  if (!configOk) {
    document.getElementById('configBanner').classList.add('active');
    return;
  }

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setupNav();
  setupModals();
  carregarTudo();
});

function setupNav(){
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('view-' + item.dataset.view).classList.add('active');
    });
  });
}

async function carregarTudo(){
  await Promise.all([carregarEscaloes(), carregarJogadoras(), carregarTarefas()]);
  renderEscaloes();
  renderFiltroEscalao();
  renderJogadoras();
  renderTarefas();
}

function toast(msg, isError){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// =========================================================
// ESCALÕES
// =========================================================
async function carregarEscaloes(){
  const { data, error } = await supabase.from('escaloes').select('*').order('idade_min', { ascending:true });
  if (error){ toast('Erro ao carregar escalões', true); return; }
  escaloes = data || [];
}

function renderEscaloes(){
  const grid = document.getElementById('escaloesGrid');
  grid.innerHTML = '';

  escaloes.forEach(e => {
    const n = jogadoras.filter(j => j.escalao_id === e.id).length;
    const faixa = e.idade_max ? `${e.idade_min}–${e.idade_max} anos` : `${e.idade_min}+ anos`;
    const card = document.createElement('div');
    card.className = 'escalao-card';
    card.innerHTML = `
      <div class="card-actions">
        <button class="btn-icon" title="Editar" onclick="abrirModalEscalao('${e.id}');event.stopPropagation();">✎</button>
        <button class="btn-icon" title="Eliminar" onclick="eliminarEscalao('${e.id}');event.stopPropagation();">✕</button>
      </div>
      <span class="badge-idade">${faixa}</span>
      <h3>${escapeHtml(e.nome)}</h3>
      <div class="count">${n} jogadora${n===1?'':'s'}</div>
    `;
    card.addEventListener('click', () => {
      filtroEscalaoId = e.id;
      document.querySelector('.nav-item[data-view="jogadoras"]').click();
      document.getElementById('filtroEscalao').value = e.id;
      renderJogadoras();
    });
    grid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'add-card';
  addCard.textContent = '+ Novo escalão';
  addCard.addEventListener('click', () => abrirModalEscalao(null));
  grid.appendChild(addCard);
}

function abrirModalEscalao(id){
  editEscalaoId = id;
  const e = id ? escaloes.find(x => x.id === id) : null;
  document.getElementById('escalaoModalTitle').textContent = id ? 'Editar escalão' : 'Novo escalão';
  document.getElementById('escalaoNome').value = e ? e.nome : '';
  document.getElementById('escalaoIdadeMin').value = e ? e.idade_min : '';
  document.getElementById('escalaoIdadeMax').value = e && e.idade_max ? e.idade_max : '';
  document.getElementById('escalaoDeleteBtn').style.display = id ? 'inline-flex' : 'none';
  document.getElementById('overlayEscalao').classList.add('active');
}

async function guardarEscalao(ev){
  ev.preventDefault();
  const nome = document.getElementById('escalaoNome').value.trim();
  const idade_min = parseInt(document.getElementById('escalaoIdadeMin').value, 10);
  const idadeMaxRaw = document.getElementById('escalaoIdadeMax').value;
  const idade_max = idadeMaxRaw ? parseInt(idadeMaxRaw, 10) : null;

  if (!nome || isNaN(idade_min)){ toast('Preenche o nome e a idade mínima', true); return; }

  const payload = { nome, idade_min, idade_max };
  let error;
  if (editEscalaoId){
    ({ error } = await supabase.from('escaloes').update(payload).eq('id', editEscalaoId));
  } else {
    ({ error } = await supabase.from('escaloes').insert(payload));
  }
  if (error){ toast('Erro ao guardar escalão', true); return; }

  fecharModal('overlayEscalao');
  await carregarEscaloes();
  renderEscaloes();
  renderFiltroEscalao();
  toast('Escalão guardado');
}

async function eliminarEscalao(id){
  if (!confirm('Eliminar este escalão? As jogadoras associadas ficam sem escalão.')) return;
  const { error } = await supabase.from('escaloes').delete().eq('id', id);
  if (error){ toast('Erro ao eliminar escalão', true); return; }
  await carregarTudo();
  toast('Escalão eliminado');
}

// =========================================================
// JOGADORAS
// =========================================================
async function carregarJogadoras(){
  const { data, error } = await supabase.from('jogadoras').select('*').order('nome_completo');
  if (error){ toast('Erro ao carregar jogadoras', true); return; }
  jogadoras = data || [];
}

function renderFiltroEscalao(){
  const sel = document.getElementById('filtroEscalao');
  const atual = sel.value || 'todos';
  sel.innerHTML = '<option value="todos">Todos os escalões</option>' +
    escaloes.map(e => `<option value="${e.id}">${escapeHtml(e.nome)}</option>`).join('');
  sel.value = escaloes.some(e => e.id === atual) ? atual : 'todos';
  filtroEscalaoId = sel.value;

  const modalSel = document.getElementById('jogadoraEscalao');
  modalSel.innerHTML = escaloes.map(e => `<option value="${e.id}">${escapeHtml(e.nome)}</option>`).join('');
}

function renderJogadoras(){
  const grid = document.getElementById('jogadorasGrid');
  const lista = filtroEscalaoId === 'todos' ? jogadoras : jogadoras.filter(j => j.escalao_id === filtroEscalaoId);
  grid.innerHTML = '';

  if (lista.length === 0){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <h3>Sem jogadoras</h3><p>Adiciona a primeira jogadora deste escalão.</p>
      </div>`;
  }

  lista.forEach(j => {
    const iniciais = (j.nome_curto || j.nome_completo || '?').trim().slice(0,2).toUpperCase();
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="player-photo">${j.foto_url ? `<img src="${j.foto_url}" alt="">` : iniciais}</div>
      <div class="player-info">
        <div class="p-name">${escapeHtml(j.nome_curto)}</div>
        <div class="p-meta">${escapeHtml(j.nacionalidade || '')} · ${idadeDe(j.data_nascimento)} anos</div>
        <span class="pos-tag">${escapeHtml(j.posicao)}</span>
      </div>
    `;
    card.addEventListener('click', () => abrirModalJogadora(j.id));
    grid.appendChild(card);
  });
}

function idadeDe(dataNasc){
  if (!dataNasc) return '?';
  const hoje = new Date();
  const n = new Date(dataNasc);
  let idade = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--;
  return idade;
}

function abrirModalJogadora(id){
  editJogadoraId = id;
  novaFotoFile = null;
  const j = id ? jogadoras.find(x => x.id === id) : null;

  document.getElementById('jogadoraModalTitle').textContent = id ? 'Editar jogadora' : 'Nova jogadora';
  document.getElementById('jogadoraNomeCompleto').value = j ? j.nome_completo : '';
  document.getElementById('jogadoraNomeCurto').value = j ? j.nome_curto : '';
  document.getElementById('jogadoraDataNasc').value = j ? j.data_nascimento : '';
  document.getElementById('jogadoraNacionalidade').value = j ? j.nacionalidade : '';
  document.getElementById('jogadoraPosicao').innerHTML = POSICOES.map(p =>
    `<option value="${p}" ${j && j.posicao===p ? 'selected':''}>${p}</option>`).join('');
  document.getElementById('jogadoraEscalao').value = j ? (j.escalao_id || '') : (filtroEscalaoId !== 'todos' ? filtroEscalaoId : '');
  document.getElementById('jogadoraFotoInput').value = '';

  const preview = document.getElementById('fotoPreview');
  preview.innerHTML = j && j.foto_url ? `<img src="${j.foto_url}" alt="">` : '📷';

  document.getElementById('jogadoraDeleteBtn').style.display = id ? 'inline-flex' : 'none';
  document.getElementById('overlayJogadora').classList.add('active');
}

function onFotoSelecionada(ev){
  const file = ev.target.files[0];
  if (!file) return;
  novaFotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('fotoPreview').innerHTML = `<img src="${e.target.result}" alt="">`;
  };
  reader.readAsDataURL(file);
}

async function guardarJogadora(ev){
  ev.preventDefault();
  const nome_completo = document.getElementById('jogadoraNomeCompleto').value.trim();
  const nome_curto = document.getElementById('jogadoraNomeCurto').value.trim();
  const data_nascimento = document.getElementById('jogadoraDataNasc').value;
  const nacionalidade = document.getElementById('jogadoraNacionalidade').value.trim();
  const posicao = document.getElementById('jogadoraPosicao').value;
  const escalao_id = document.getElementById('jogadoraEscalao').value || null;

  if (!nome_completo || !nome_curto || !data_nascimento || !nacionalidade){
    toast('Preenche todos os campos obrigatórios', true); return;
  }

  let foto_url = null;
  if (editJogadoraId){
    const atual = jogadoras.find(j => j.id === editJogadoraId);
    foto_url = atual ? atual.foto_url : null;
  }

  if (novaFotoFile){
    const nomeFicheiro = `${Date.now()}-${novaFotoFile.name.replace(/\s+/g,'-')}`;
    const { error: upErr } = await supabase.storage.from('jogadoras-fotos').upload(nomeFicheiro, novaFotoFile, { upsert:true });
    if (upErr){ toast('Erro ao carregar a foto', true); return; }
    const { data: pub } = supabase.storage.from('jogadoras-fotos').getPublicUrl(nomeFicheiro);
    foto_url = pub.publicUrl;
  }

  const payload = { nome_completo, nome_curto, data_nascimento, nacionalidade, posicao, escalao_id, foto_url, updated_at: new Date().toISOString() };
  let error;
  if (editJogadoraId){
    ({ error } = await supabase.from('jogadoras').update(payload).eq('id', editJogadoraId));
  } else {
    ({ error } = await supabase.from('jogadoras').insert(payload));
  }
  if (error){ toast('Erro ao guardar jogadora', true); return; }

  fecharModal('overlayJogadora');
  await carregarJogadoras();
  renderEscaloes();
  renderJogadoras();
  toast('Jogadora guardada');
}

async function eliminarJogadora(){
  if (!editJogadoraId) return;
  if (!confirm('Eliminar esta jogadora?')) return;
  const { error } = await supabase.from('jogadoras').delete().eq('id', editJogadoraId);
  if (error){ toast('Erro ao eliminar jogadora', true); return; }
  fecharModal('overlayJogadora');
  await carregarJogadoras();
  renderEscaloes();
  renderJogadoras();
  toast('Jogadora eliminada');
}

// =========================================================
// TAREFAS
// =========================================================
async function carregarTarefas(){
  const { data, error } = await supabase.from('tarefas').select('*').order('created_at', { ascending:false });
  if (error){ toast('Erro ao carregar tarefas', true); return; }
  tarefas = data || [];
}

function slug(estado){ return estado.toLowerCase().replace(/\s+/g,'-'); }

function renderTarefas(){
  ESTADOS.forEach(estado => {
    const col = document.getElementById('col-' + slug(estado));
    const lista = tarefas.filter(t => t.estado === estado);
    document.getElementById('count-' + slug(estado)).textContent = lista.length;
    col.innerHTML = '';

    if (lista.length === 0){
      col.innerHTML = '<div class="empty-state" style="padding:24px 8px;">Sem tarefas</div>';
      return;
    }

    lista.forEach(t => {
      const card = document.createElement('div');
      card.className = 'task-card estado-' + slug(t.estado);
      const outros = ESTADOS.filter(e => e !== t.estado);
      card.innerHTML = `
        <div class="t-title">${escapeHtml(t.titulo)}</div>
        ${t.descricao ? `<div class="t-desc">${escapeHtml(t.descricao)}</div>` : ''}
        <div class="t-actions">
          ${outros.map(e => `<button class="btn btn-ghost btn-sm" onclick="moverTarefa('${t.id}','${e}')">→ ${e}</button>`).join('')}
        </div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        abrirModalTarefa(t.id);
      });
      col.appendChild(card);
    });
  });
}

async function moverTarefa(id, novoEstado){
  const { error } = await supabase.from('tarefas').update({ estado: novoEstado, updated_at: new Date().toISOString() }).eq('id', id);
  if (error){ toast('Erro ao mover tarefa', true); return; }
  await carregarTarefas();
  renderTarefas();
}

function abrirModalTarefa(id){
  editTarefaId = id;
  const t = id ? tarefas.find(x => x.id === id) : null;
  document.getElementById('tarefaModalTitle').textContent = id ? 'Editar tarefa' : 'Nova tarefa';
  document.getElementById('tarefaTitulo').value = t ? t.titulo : '';
  document.getElementById('tarefaDescricao').value = t ? (t.descricao || '') : '';
  document.getElementById('tarefaEstado').innerHTML = ESTADOS.map(e =>
    `<option value="${e}" ${t && t.estado===e ? 'selected':''}>${e}</option>`).join('');
  document.getElementById('tarefaDeleteBtn').style.display = id ? 'inline-flex' : 'none';
  document.getElementById('overlayTarefa').classList.add('active');
}

async function guardarTarefa(ev){
  ev.preventDefault();
  const titulo = document.getElementById('tarefaTitulo').value.trim();
  const descricao = document.getElementById('tarefaDescricao').value.trim();
  const estado = document.getElementById('tarefaEstado').value;

  if (!titulo){ toast('Escreve um título para a tarefa', true); return; }

  const payload = { titulo, descricao, estado, updated_at: new Date().toISOString() };
  let error;
  if (editTarefaId){
    ({ error } = await supabase.from('tarefas').update(payload).eq('id', editTarefaId));
  } else {
    ({ error } = await supabase.from('tarefas').insert(payload));
  }
  if (error){ toast('Erro ao guardar tarefa', true); return; }

  fecharModal('overlayTarefa');
  await carregarTarefas();
  renderTarefas();
  toast('Tarefa guardada');
}

async function eliminarTarefa(){
  if (!editTarefaId) return;
  if (!confirm('Eliminar esta tarefa?')) return;
  const { error } = await supabase.from('tarefas').delete().eq('id', editTarefaId);
  if (error){ toast('Erro ao eliminar tarefa', true); return; }
  fecharModal('overlayTarefa');
  await carregarTarefas();
  renderTarefas();
  toast('Tarefa eliminada');
}

// =========================================================
// Modais / utilitários
// =========================================================
function setupModals(){
  document.getElementById('formEscalao').addEventListener('submit', guardarEscalao);
  document.getElementById('formJogadora').addEventListener('submit', guardarJogadora);
  document.getElementById('formTarefa').addEventListener('submit', guardarTarefa);
  document.getElementById('jogadoraFotoInput').addEventListener('change', onFotoSelecionada);
  document.getElementById('filtroEscalao').addEventListener('change', ev => {
    filtroEscalaoId = ev.target.value;
    renderJogadoras();
  });

  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', ev => { if (ev.target === ov) ov.classList.remove('active'); });
  });
}

function fecharModal(id){
  document.getElementById(id).classList.remove('active');
}

function escapeHtml(str){
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

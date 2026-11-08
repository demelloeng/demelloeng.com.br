// Histórico do navegador ligado à jornada (P01). Módulo puro, sem DOM: o App só liga os eventos.
//
// Só o que não identifica ninguém vai para o history.state: ids de nós da própria jornada (ex.: "CA2"),
// a profundidade e um token da sessão. Respostas, contato e texto livre NUNCA entram aqui e a URL não muda.
// Voltar/Avançar do navegador trocam só a pergunta exibida; as respostas válidas ficam no estado do App.
export const NAV_KEY='dm-calc';

export const newSession=()=>Math.random().toString(36).slice(2,10);

export function snapshot({id,history,depth,prevId,session}){
 return {[NAV_KEY]:true,id,history:[...history],depth,prevId:prevId??null,session};
}

// Devolve o snapshot válido ou null. Nunca confia em dados de fora: confere o formato e os ids.
export function readSnapshot(state,nodes){
 if(!state||typeof state!=='object'||state[NAV_KEY]!==true)return null;
 const known=x=>typeof x==='string'&&Object.hasOwn(nodes,x);
 if(!known(state.id)||!Array.isArray(state.history)||!state.history.every(known))return null;
 if(!Number.isInteger(state.depth)||state.depth<0||typeof state.session!=='string')return null;
 return {id:state.id,history:[...state.history],depth:state.depth,prevId:known(state.prevId)?state.prevId:null,session:state.session};
}

// A navegação do App é "o mesmo passo" quando id e caminho não mudaram (digitar não cria entrada no histórico).
export const navKey=(id,history)=>`${id}|${history.join(',')}`;

// Voltar do aplicativo: se a entrada anterior do navegador é a pergunta anterior da jornada, usa o histórico
// do navegador (mantém as duas pilhas alinhadas). Senão (edição pelo lápis, troca de rota), volta pelo caminho da jornada.
export const backMode=({last,history})=>last&&last.depth>0&&last.prevId!==null&&last.prevId===history.at(-1)?'browser':'app';

// Entrada de outra carga da página (recarregar, voltar de outro site): a calculadora não reconstrói
// um estado que não é dela. A ação é sair da pilha antiga, para o que veio antes dela.
export const staleOffset=(snap,session)=>snap&&snap.session!==session?-(snap.depth+1):0;

// Funil pós-resultado: o que o visitante pede DEPOIS de receber a estimativa (ou o enquadramento).
//
//   estimativa concluída  -> proposta solicitada | dúvida sobre escopo
//   sem estimativa        -> caso enviado apenas para avaliação
//
// Tudo aqui é determinístico e puro (sem DOM, sem rede, sem IA). O contato só é pedido DEPOIS
// do resultado: o único caminho até o nó de contato (X4) passa por uma destas escolhas.
import {safetyHold,resultFor} from './journey.mjs';
import {packageForCRMv2} from './payload_v2.mjs';

export const REQUEST_INTENTS=Object.freeze(['proposal','scope_question','evaluation_only']);

// Textos dos botões. O primeiro de cada lista é o CTA principal.
export const INTENT_LABEL=Object.freeze({
 proposal:'Quero receber uma proposta',
 scope_question:'Tenho uma dúvida sobre o escopo',
 evaluation_only:'Enviar meu caso para avaliação',
});

// Tipo de resultado entregue ao visitante, na MESMA regra que a tela de resultado usa:
//  - held       : relato com sinal de risco (retenção para avaliação humana; nunca vira venda automática)
//  - calculated : X3A com previsão efetivamente calculada pelo motor
//  - review     : qualquer outro caso (enquadramento sem valor calculado)
export function resultKind(answers,mode='preview'){
 if(safetyHold(answers))return 'held';
 const id=resultFor(answers,mode);
 if(id==='X3A'&&packageForCRMv2(answers).pricing_preview.status==='CALCULATED')return 'calculated';
 return 'review';
}

export function allowedIntents(answers,mode='preview'){
 return resultKind(answers,mode)==='calculated'?['proposal','scope_question']:['evaluation_only'];
}

export const isIntentAllowed=(answers,intent,mode='preview')=>allowedIntents(answers,mode).includes(intent);

// Estado dos dados (vai em answers.estimate_state, junto de answers.request_intent):
//   completed     = estimativa calculada e mostrada
//   not_available = enquadramento sem valor (avaliação humana)
export const estimateState=(answers,mode='preview')=>resultKind(answers,mode)==='calculated'?'completed':'not_available';

// Rótulos estáveis para o CRM/relatórios — um por estado distinto pedido pela operação.
export const LEAD_STAGE=Object.freeze({
 proposal:'proposta_solicitada',
 scope_question:'duvida_sobre_escopo',
 evaluation_only:'caso_para_avaliacao',
});

// "Tenho uma dúvida sobre o escopo": texto curto, limite explícito, validação determinística.
// A dúvida NUNCA vai para analytics, URL ou deduplicação; só para o resumo privado e o CRM (após a confirmação do envio).
export const SCOPE_QUESTION_MAX=280;
export const SCOPE_QUESTION_MIN=3;
// Devolve null (válido) ou um código estável de erro: 'vazio' | 'curto' | 'longo' | 'caractere_invalido'.
export function scopeQuestionError(text){
 if(typeof text!=='string')return 'vazio';
 const t=text.trim();
 if(!t)return 'vazio';
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t))return 'caractere_invalido';
 if(t.length<SCOPE_QUESTION_MIN)return 'curto';
 if(text.length>SCOPE_QUESTION_MAX||t.length>SCOPE_QUESTION_MAX)return 'longo';
 return null;
}
export const scopeQuestionValid=text=>scopeQuestionError(text)===null;
export const SCOPE_QUESTION_MESSAGE=Object.freeze({
 vazio:'Escreva a sua dúvida para continuar.',
 curto:'Escreva um pouco mais: a dúvida precisa de pelo menos '+SCOPE_QUESTION_MIN+' caracteres.',
 longo:'A dúvida pode ter até '+SCOPE_QUESTION_MAX+' caracteres.',
 caractere_invalido:'Use apenas texto simples na dúvida.',
});

// Só se pode enviar com uma intenção coerente com o resultado entregue — e, na dúvida sobre o escopo, com a dúvida escrita.
export const canSend=(answers,mode='preview')=>isIntentAllowed(answers,answers.request_intent,mode)&&(answers.request_intent!=='scope_question'||scopeQuestionValid(answers.scope_question));

// Lead qualificado — REGRA COMERCIAL VIGENTE R1 (aprovada; ver docs/MENSURACAO_FUNIL.md). Os critérios não devem ser alterados.
// Todas as condições precisam ser verdadeiras, e todas são verificáveis no navegador:
//   1. o CRM aceitou o envio (HTTP 202 accepted);
//   2. a intenção é "proposal" (pediu proposta);
//   3. a estimativa foi calculada e entregue antes do contato (resultKind === 'calculated');
//   4. o caso não é de risco/retenção (safety_hold = false);
//   5. há ao menos um meio de contato válido (nome + WhatsApp ou e-mail, já validado pelo nó X4).
export function evaluateQualifiedLead({accepted,answers,contactValid,mode='preview'}){
 return accepted===true&&answers?.request_intent==='proposal'&&resultKind(answers,mode)==='calculated'&&!safetyHold(answers)&&contactValid===true;
}

"""Contrato editorial específico da frente PSCIP + GLP; não muda os perfis anteriores."""
import html
import re

LABELS = ['TITULO','DESCRICAO','H1','CHAMADA','INTRODUCAO 1','INTRODUCAO 2','PARA QUEM E','O QUE MUDA PARA VOCE','DO PROJETO AO AVCB','O QUE A DEMELLO FAZ','GAS E GLP','PERGUNTAS','EXPERIENCIA APLICADA','PROVA TECNICA','PROXIMO PASSO','CTA (rotulo)','CTA (secundario)','CTA (micro, mantido)','ESCOPO E LIMITES']

def paragraphs(s): return [x.strip() for x in s.splitlines() if x.strip()]
def block(title, lines): return {'titulo':title,'conteudo':[{'tipo':'paragrafo','texto':p} for p in lines]}
def linked(text, phrase, href):
    if phrase not in text: raise ValueError(f'Link sem texto: {phrase}')
    return text.replace(phrase, f'<a href="{href}">{phrase}</a>', 1)

def parse_copy(text, slug, filename, name):
    matches = list(re.finditer(r'^('+ '|'.join(map(re.escape,LABELS)) +r'):[ \t]*(.*)$', text, re.M))
    keys = [m[1] for m in matches]
    if set(keys) != set(LABELS) or len(keys) != len(LABELS): raise ValueError('Copy PSCIP incompleta ou rótulo repetido')
    s = {m[1]:(m[2]+'\n'+text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)]).strip() for i,m in enumerate(matches)}
    # Recusa rótulos desconhecidos em caixa alta em vez de absorver outra seção.
    for value in s.values():
        if re.search(r'^(?!NOTA EDITORIAL:)[A-ZÀ-Ú][A-ZÀ-Ú ()0-9/]+:',value,re.M): raise ValueError('Rótulo desconhecido na copy')
    benefits=[]
    for line in paragraphs(s['O QUE MUDA PARA VOCE']):
        m=re.fullmatch(r'\d+\.\s+(.*?)\.\s+(.*)',line)
        if not m: raise ValueError('Benefício fora do contrato')
        benefits.append({'titulo':m[1],'texto':m[2]})
    questions=[]; editorial=[]
    for line in paragraphs(s['PERGUNTAS']):
        if line.startswith('NOTA EDITORIAL:'):
            if not questions: raise ValueError('Nota sem pergunta')
            editorial.append({'pergunta':questions[-1]['pergunta'],'texto':line.split(':',1)[1].strip(),'publicar':False})
        elif line.endswith('?'):
            questions.append({'pergunta':line,'paragrafos':[]})
        else:
            if not questions: raise ValueError('Resposta sem pergunta')
            questions[-1]['paragrafos'].append(line)
    if not questions or any(not q['paragrafos'] for q in questions): raise ValueError('FAQ incompleta')
    for q in questions: q['resposta']='</p><p>'.join(q['paragrafos'])
    who=paragraphs(s['PARA QUEM E']); exp=paragraphs(s['EXPERIENCIA APLICADA'])
    middle=paragraphs(s['DO PROJETO AO AVCB'])
    steps=[]
    for line in middle:
        if line.startswith('- '):
            title,body=line[2:].split(':',1);steps.append({'titulo':title,'texto':body.strip()})
    if [x['titulo'] for x in steps] != ['Projeto','Aprovação','Obra','Vistoria']: raise ValueError('Etapas inválidas')
    gas=paragraphs(s['GAS E GLP'])
    gas[-1]=linked(gas[-1],'projeto de gás/GLP','../projeto-gas-glp/')
    next_step=paragraphs(s['PROXIMO PASSO'])
    next_step[-1]=linked(next_step[-1],'página específica de gás/GLP','../projeto-gas-glp/')
    return {'slug':slug,'nome_servico':name,'fonte_copy':filename,'layout':'rico','perfil':'pscip-glp',
        'titulo_pagina':s['TITULO'],'descricao':s['DESCRICAO'],'h1':s['H1'],'chamada':s['CHAMADA'],
        'introducao':[s['INTRODUCAO 1'],s['INTRODUCAO 2']],
        'cta':{'rotulo':s['CTA (rotulo)'],'micro':s['CTA (micro, mantido)'],'href':'../../orcamento/?situacao=known&amp;servico=incendio'},
        'cta_secundario':{'rotulo':s['CTA (secundario)'],'href':'../../orcamento/?situacao=known&amp;servico=gas-glp'},
        'blocos_novos':{
            'para_quem':{'titulo':'Para quem é','conteudo':[{'tipo':'paragrafo','texto':who[0]},{'tipo':'lista','itens':[x[2:] for x in who[1:]]}]},
            'muda':{'titulo':'O que muda para você','conteudo':[{'tipo':'beneficios','itens':benefits}]},
            'etapas':{'titulo':'Do projeto ao AVCB','conteudo':[{'tipo':'passos','itens':steps}]+[{'tipo':'paragrafo','texto':x} for x in middle if not x.startswith('- ')]},
            'faz':block('O que a DEMELLO faz',paragraphs(s['O QUE A DEMELLO FAZ'])),
            'gas':block('Rede e central de gás/GLP',gas),
            'perguntas':{'titulo':'Perguntas','conteudo':[{'tipo':'perguntas','itens':questions}]},
            'experiencia':block(exp[0],exp[1:]),'prova':block('Prova técnica',paragraphs(s['PROVA TECNICA'])),
            'limites':block('Escopo e limites',paragraphs(s['ESCOPO E LIMITES']))},
        'ordem':['para_quem','muda','etapas','faz','gas','experiencia','prova','perguntas','limites'],
        'proximo_passo':{'titulo':'Próximo passo','paragrafos':next_step},'notas_editoriais':editorial,'removidos':[]}

def gas_copy(d):
    """A fonte GLP continua sendo o JSON vigente; sem duplicar a copy de AVCB."""
    blocks={str(i):b for i,b in enumerate(d['blocos'])}
    return {**{k:d[k] for k in ['slug','titulo_pagina','descricao','h1','chamada','introducao','cta']},
        'nome_servico':'Projeto de gás / GLP','fonte_copy':'projeto-gas-glp.json','layout':'rico','perfil':'gas-glp',
        'blocos_novos':blocks,'ordem':list(blocks),'proximo_passo':{'titulo':'Próximo passo',
        'paragrafos':[x['texto'] for x in d['proximo_passo'][0]['conteudo']]},'removidos':[]}
